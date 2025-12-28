import os
import io
import uuid
import json
from typing import List, Any
from mistralai import Mistral
from mistralai.extra import response_format_from_pydantic_model
from openai import OpenAI
from supabase import create_client, Client
from pydantic import BaseModel, Field

# --- SCHEMA DEFINITION ---
class VisualContext(BaseModel):
    image_description: str = Field(..., description="Detailed description of the image visual content.")
    data_extraction: str = Field(..., description="If this is a chart/table, transcribe the key numbers, axis labels, and trends. If a diagram, describe the flow.")
    comparative_analysis: str = Field(..., description="What is the key takeaway or insight from this figure?")

class MistralEngine:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        self.supabase: Client = create_client(url, key)
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY is missing!")
        self.client = Mistral(api_key=api_key)

    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    def get_folder_files(self, folder_name: str) -> List[dict]:
        try:
            res = self.supabase.table("documents")\
                .select("id, title, summary")\
                .eq("folder", folder_name)\
                .execute()
            
            files = []
            for doc in res.data:
                raw = doc.get("summary", "")
                if not raw: continue
                clean = raw.split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").strip()
                files.append({
                    "id": doc["id"],
                    "title": doc["title"],
                    "summary": clean
                })
            return files
        except Exception as e:
            print(f"Error getting folder files: {e}")
            return []

    # --- SOTA UPGRADE: Sliding Window Retrieval ---
    def search_single_doc(self, query: str, doc_id: str) -> List[dict]:
        query_vector = self.get_embedding(query)
        
        # 1. Get the "Center" matches (Ranked by similarity)
        # Note: This relies on your updated SQL function returning 'id'
        params = {
            "query_embedding": query_vector, 
            "match_threshold": 0.01, 
            "match_count": 5, 
            "filter_doc_id": doc_id
        }
        
        try:
            # Check if V2 exists, otherwise fall back to V1. 
            # If you updated 'match_page_sections' directly, this works fine.
            res = self.supabase.rpc("match_page_sections_v2", params).execute()
            
            if not res.data: return []

            # 2. Collect IDs and Calculate "Window" IDs (Previous and Next chunks)
            # We want [ID-1, ID, ID+1] to give the AI full paragraphs.
            center_ids = [row['id'] for row in res.data]
            neighbor_ids = []
            for cid in center_ids:
                neighbor_ids.extend([cid - 1, cid, cid + 1])
            
            # Remove duplicates and filter invalid IDs (e.g. -1)
            unique_ids_to_fetch = sorted(list(set([i for i in neighbor_ids if i > 0])))

            # 3. Fetch the content for this expanded window
            context_res = self.supabase.table("document_pages")\
                .select("id, content, page_number")\
                .in_("id", unique_ids_to_fetch)\
                .order("id")\
                .execute()
            
            # 4. Group them back into "Extended Chunks"
            extended_chunks = []
            rows_by_id = {r['id']: r for r in context_res.data}
            
            for cid in center_ids:
                # Reconstruct the window: Prev + Center + Next
                prev_chunk = rows_by_id.get(cid - 1, {}).get('content', '')
                center_chunk = rows_by_id.get(cid, {}).get('content', '')
                next_chunk = rows_by_id.get(cid + 1, {}).get('content', '')
                
                # Merge them nicely with newlines to form a coherent passage
                combined_text = f"{prev_chunk}\n{center_chunk}\n{next_chunk}".strip()
                
                # Get the metadata from the CENTER chunk
                center_meta = rows_by_id.get(cid, {})
                
                extended_chunks.append({
                    "content": combined_text, # NOW CONTAINS ~3x MORE CONTEXT
                    "page": center_meta.get('page_number', 1),
                    "id": cid,
                    "similarity": 0 # We prioritize context over raw score here
                })

            return extended_chunks

        except Exception as e:
            print(f"Search Error: {e}")
            return []

    def _chunk_markdown(self, text: str) -> List[str]:
        chunks = []
        current_chunk = ""
        lines = text.split('\n')
        for line in lines:
            if line.strip().startswith("#") and len(current_chunk) > 600:
                chunks.append(current_chunk.strip()); current_chunk = line + "\n"
            else: current_chunk += line + "\n"
            if len(current_chunk) > 3500: chunks.append(current_chunk.strip()); current_chunk = ""
        if current_chunk: chunks.append(current_chunk.strip())
        return chunks

    def _generate_summary(self, full_text: str) -> str:
        try:
            preview_text = full_text[:8000]
            system_prompt = (
                "You are a sophisticated document analyzer. Analyze the text and return a summary in EXACTLY this format:\n\n"
                "[TAG]: <Classify into one: INVOICE, RESEARCH, FINANCIAL, LEGAL, RECEIPT, RESUME, OTHER>\n"
                "[DESC]: <A single, concise sentence describing the file (e.g. 'August 2023 Power Bill for $150')>\n"
                "[DETAILED]: <A dense, 5-10 line summary containing specific entities (company names, authors), dates, key outcomes, core themes, and numerical data. This will be used for search retrieval, so be specific.>"
            )
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this document content:\n\n{preview_text}"}
                ],
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            return "[TAG]: OTHER\n[DESC]: Processed document.\n[DETAILED]: No summary available."

    async def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            self.supabase.storage.from_("document-pages").upload(file=file_bytes, path=f"{doc_id}/source.pdf", file_options={"content-type": "application/pdf"})
            uploaded_file = self.client.files.upload(file={"file_name": filename, "content": file_bytes}, purpose="ocr")
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            ocr_response = self.client.ocr.process(document={"type": "document_url", "document_url": signed_url.url}, model="mistral-ocr-latest", include_image_base64=True, bbox_annotation_format=response_format_from_pydantic_model(VisualContext))
            
            full_document_text = ""
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                if len(full_document_text) < 15000: full_document_text += markdown + "\n"
                chunks = self._chunk_markdown(markdown)
                for chunk in chunks:
                    if not chunk.strip(): continue
                    vector = self.get_embedding(chunk)
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id, "page_number": page_num, "folder": folder,
                        "content": chunk, "embedding": vector, "title": filename, "image_url": ""
                    }).execute()
            
            summary = self._generate_summary(full_document_text)
            final_summary = f"**Content Summary:** {summary}\n\n---_SEPARATOR_---\n\nVerified."
            self.supabase.table("documents").update({"status": "ready", "summary": final_summary}).eq("id", doc_id).execute()
        except Exception as e:
            self.supabase.table("documents").update({"status": "failed"}).eq("id", doc_id).execute()

    def get_documents(self):
        try:
            res = self.supabase.table("documents").select("*").order("created_at", desc=True).execute()
            return [{
                "id": r['id'], "title": r.get('title','Untitled'), "folder": r.get('folder','General'),
                "status": r.get('status','ready'), "summary": r.get('summary',''),
                "upload_date": r['created_at'].split("T")[0] if r.get('created_at') else "N/A"
            } for r in res.data]
        except: return []

    def delete_document(self, doc_id: str):
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        self.supabase.table("documents").delete().eq("id", doc_id).execute()

    def debug_document(self, doc_id: str):
        return {"status": "ok"} 

    def debug_search(self, doc_id: str, query: str):
        return {"status": "ok"}