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

    # --- MAIN TASK (UNCHANGED) ---
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

            manifest_log = f"**🔍 Extraction Verification Log: {filename}**\n\n"
            
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                visual_section = ""
                image_count_on_page = 0
                
                if page.images:
                    for j, img in enumerate(page.images):
                        image_count_on_page += 1
                        figure_id = f"Figure {page_num}-{image_count_on_page}"
                        annotation_data = None
                        raw_ann = getattr(img, 'image_annotation', None)
                        
                        if raw_ann:
                            if isinstance(raw_ann, str):
                                try: annotation_data = json.loads(raw_ann)
                                except: annotation_data = {"image_description": raw_ann}
                            else: annotation_data = raw_ann
                        
                        if annotation_data:
                            # Robust field access
                            if isinstance(annotation_data, dict):
                                desc = annotation_data.get('image_description', 'N/A')
                                data_pts = annotation_data.get('data_extraction', 'N/A')
                                analysis = annotation_data.get('comparative_analysis', 'N/A')
                            else:
                                desc = getattr(annotation_data, 'image_description', 'N/A')
                                data_pts = getattr(annotation_data, 'data_extraction', 'N/A')
                                analysis = getattr(annotation_data, 'comparative_analysis', 'N/A')

                            visual_section += (f"\n> **[{figure_id} Analysis]**\n> - **Visual:** {desc}\n> - **Data:** {data_pts}\n> - **Insight:** {analysis}\n")
                            manifest_log += f"- **Page {page_num}**: Found {figure_id}. Data: *\"{str(data_pts)[:50]}...\"*\n"
                        else:
                            manifest_log += f"- **Page {page_num}**: Found {figure_id} BUT annotation was empty.\n"

                enriched_content = f"**[Page {page_num}]**\n{markdown}\n"
                if visual_section: enriched_content += "\n### 📊 Visual Data Extracted:\n" + visual_section

                chunks = self._chunk_markdown(enriched_content)
                for chunk in chunks:
                    if not chunk.strip(): continue
                    vector = self.get_embedding(chunk)
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id, "page_number": page_num, "folder": folder,
                        "content": chunk, "embedding": vector, "title": filename, "image_url": ""
                    }).execute()

            manifest_log += "\n✅ **Extraction Complete.**"
            self.supabase.table("documents").update({"status": "ready", "summary": manifest_log}).eq("id", doc_id).execute()
            print(f"[{doc_id}] Success. Manifest saved.")

        except Exception as e:
            print(f"[{doc_id}] FAILED: {e}")
            self.supabase.table("documents").update({"status": "failed"}).eq("id", doc_id).execute()

    # --- HELPERS ---
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

    def search_single_doc(self, query: str, doc_id: str) -> List[str]:
        query_vector = self.get_embedding(query)
        params = {"query_embedding": query_vector, "match_threshold": 0.01, "match_count": 10, "filter_doc_id": doc_id}
        try:
            res = self.supabase.rpc("match_page_sections", params).execute()
            return [row['content'] for row in res.data if row.get('content')]
        except: return []

    # --- UPDATED FOLDER SEARCH WITH CONTEXT INJECTION ---
    def search(self, query: str, folder_name: str = None, limit: int = 5) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {
            "query_text": query, 
            "query_embedding": query_vector, 
            "match_threshold": 0.5, 
            "match_count": limit, # Dynamic limit (5 for simple, 20 for deep)
            "filter_folder": folder_name or "General"
        }
        try:
            response = self.supabase.rpc("match_documents_hybrid", params).execute()
            
            # --- CONTEXT INJECTION MAGIC ---
            # We wrap the content so the LLM knows WHERE it came from.
            results = []
            for row in response.data:
                filename = row.get('title', 'Unknown File')
                # Inject a clear header that GPT-4o-mini will pay attention to
                injected_content = f"[[SOURCE DOCUMENT: {filename}]]\n\n{row['content']}"
                row['content'] = injected_content
                results.append(row)
                
            return results
        except Exception as e:
            print(f"Search Error: {e}")
            return []

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