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

    # --- FAST FOLDER MODE: Summaries Only ---
    def get_folder_summaries(self, folder_name: str) -> List[dict]:
        """
        Fetches metadata summaries [TAG], [DESC] from the 'documents' table.
        Does NOT search vectors.
        """
        try:
            res = self.supabase.table("documents").select("id, title, summary").eq("folder", folder_name).execute()
            
            summaries = []
            for doc in res.data:
                raw_summary = doc.get("summary", "")
                if not raw_summary: continue
                
                # Cleanup
                clean_summary = raw_summary.split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").strip()
                
                summaries.append({
                    "id": doc["id"],
                    "source": doc["title"],
                    "content": clean_summary,
                    "page": 1, 
                    "type": "summary"
                })
            return summaries
        except Exception as e:
            print(f"Summary Fetch Error: {e}")
            return []

    # --- DEEP FOLDER MODE: Vector Search ---
    def search(self, query: str, folder_name: str = None, limit: int = 5) -> List[dict]:
        """
        Searches vectors across all files in a folder. 
        """
        query_vector = self.get_embedding(query)
        params = {
            "query_text": query, 
            "query_embedding": query_vector, 
            "match_threshold": 0.01,  
            "match_count": limit, 
            "filter_folder": folder_name or "General"
        }
        try:
            # Uses the NEW SQL function
            response = self.supabase.rpc("match_documents_hybrid", params).execute()
            
            chunks = []
            if response.data:
                # Metadata Rescue to get Titles
                doc_ids = list(set([row['document_id'] for row in response.data]))
                title_map = {}
                if doc_ids:
                    try:
                        docs_res = self.supabase.table("documents").select("id, title").in_("id", doc_ids).execute()
                        for d in docs_res.data:
                            title_map[d['id']] = d['title']
                    except: pass

                for row in response.data:
                    doc_id = row['document_id']
                    filename = title_map.get(doc_id, "Unknown File")
                    
                    chunks.append({
                        "id": row.get('id', 0),
                        "content": row['content'],
                        "page": row.get('page_number', 1),
                        "source": filename,
                        "similarity": row.get('similarity', 0),
                        "type": "chunk"
                    })
                
            return chunks
        except Exception as e:
            print(f"Deep Search Error: {e}")
            return []

    # --- SINGLE DOC SEARCH (UNCHANGED) ---
    def search_single_doc(self, query: str, doc_id: str) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {"query_embedding": query_vector, "match_threshold": 0.01, "match_count": 8, "filter_doc_id": doc_id}
        try:
            res = self.supabase.rpc("match_page_sections", params).execute()
            return [{
                "content": row['content'], 
                "page": row.get('page_number', 1),
                "source": "Current Document",
                "similarity": row.get('similarity', 0)
            } for row in res.data if row.get('content')]
        except Exception as e:
            print(f"Single Search Error: {e}")
            return []

    # --- OCR HELPERS (Unchanged) ---
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
                "[TAG]: <Classify into one: INVOICE, RESEARCH, FINANCIAL, LEGAL, RECEIPT, OTHER>\n"
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
            print(f"[{doc_id}] Starting Mistral Native OCR (Latest) for {filename}...")
            self.supabase.storage.from_("document-pages").upload(file=file_bytes, path=f"{doc_id}/source.pdf", file_options={"content-type": "application/pdf"})
            uploaded_file = self.client.files.upload(file={"file_name": filename, "content": file_bytes}, purpose="ocr")
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            
            ocr_response = self.client.ocr.process(
                document={"type": "document_url", "document_url": signed_url.url},
                model="mistral-ocr-latest", include_image_base64=True, 
                bbox_annotation_format=response_format_from_pydantic_model(VisualContext)
            )

            full_document_text = ""
            manifest_log = f"**🔍 Extraction Verification Log: {filename}**\n\n"
            
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                visual_section = ""
                if page.images:
                    for j, img in enumerate(page.images):
                        raw_ann = getattr(img, 'image_annotation', None)
                        if raw_ann:
                            if isinstance(raw_ann, str):
                                try: raw_ann = json.loads(raw_ann)
                                except: pass
                            desc = getattr(raw_ann, 'image_description', 'N/A') if not isinstance(raw_ann, dict) else raw_ann.get('image_description', 'N/A')
                            visual_section += (f"\n> **[Figure Analysis]** {desc}\n")

                enriched_content = f"**[Page {page_num}]**\n{markdown}\n{visual_section}"
                if len(full_document_text) < 15000: full_document_text += enriched_content + "\n"

                chunks = self._chunk_markdown(enriched_content)
                for chunk in chunks:
                    if not chunk.strip(): continue
                    vector = self.get_embedding(chunk)
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id, "page_number": page_num, "folder": folder,
                        "content": chunk, "embedding": vector, "title": filename, "image_url": ""
                    }).execute()

            content_summary = self._generate_summary(full_document_text)
            final_summary_field = f"**Content Summary:** {content_summary}\n\n---_SEPARATOR_---\n\n{manifest_log}\n✅ **Extraction Complete.**"
            self.supabase.table("documents").update({"status": "ready", "summary": final_summary_field}).eq("id", doc_id).execute()
            print(f"[{doc_id}] Success. Summary Generated.")

        except Exception as e:
            print(f"[{doc_id}] FAILED: {e}")
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
        try:
            doc = self.supabase.table("documents").select("*").eq("id", doc_id).execute().data[0]
            pages = self.supabase.table("document_pages").select("page_number, content").eq("document_id", doc_id).limit(3).execute()
            return {"status": doc['status'], "preview": [p['content'][:300] for p in pages.data]}
        except Exception as e: return {"error": str(e)}

    def debug_search(self, doc_id: str, query: str):
        try:
            query_vector = self.get_embedding(query)
            params = {"query_embedding": query_vector, "match_threshold": 0.01, "match_count": 3, "filter_doc_id": doc_id}
            res = self.supabase.rpc("match_page_sections", params).execute()
            return {"query": query, "chunks_found": len(res.data), "preview": res.data[0]['content'][:200] if res.data else "None"}
        except Exception as e: return {"error": str(e)}