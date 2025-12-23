import os
import io
import uuid
import json
from typing import List
from mistralai import Mistral
# NEW IMPORT: Helper for strict schema formatting
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
        # 1. Supabase
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        self.supabase: Client = create_client(url, key)
        
        # 2. OpenAI (Embeddings)
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        # 3. Mistral (Native OCR 3 + Annotation)
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY is missing!")
        self.client = Mistral(api_key=api_key)

    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    # --- MAIN TASK ---
    async def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            print(f"[{doc_id}] Starting Mistral Native OCR 3 for {filename}...")

            # A. Upload Source PDF
            self.supabase.storage.from_("document-pages").upload(
                file=file_bytes,
                path=f"{doc_id}/source.pdf",
                file_options={"content-type": "application/pdf"}
            )

            # B. Upload to Mistral
            uploaded_file = self.client.files.upload(
                file={
                    "file_name": filename,
                    "content": file_bytes,
                },
                purpose="ocr"
            )
            
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            
            # C. Run Native OCR with BBox Annotation
            # FIX: Use the SDK helper function to format the schema correctly
            ocr_response = self.client.ocr.process(
                document={
                    "type": "document_url",
                    "document_url": signed_url.url,
                },
                model="mistral-ocr-2512",
                include_image_base64=True, 
                bbox_annotation_format=response_format_from_pydantic_model(VisualContext)
            )

            # --- MANIFEST INITIALIZATION ---
            manifest_log = f"**🔍 Extraction Verification Log: {filename}**\n\n"
            full_text_for_embedding = ""

            # D. Iterate Pages
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                
                # --- PROCESS IMAGES WITH PAGE AWARENESS ---
                visual_section = ""
                image_count_on_page = 0
                
                if page.images:
                    for j, img in enumerate(page.images):
                        image_count_on_page += 1
                        figure_id = f"Figure {page_num}-{image_count_on_page}"
                        
                        # Extract Native Annotation
                        annotation_data = None
                        try:
                            # Mistral might return a dict or string depending on API version
                            raw_ann = getattr(img, 'annotation', None)
                            if raw_ann:
                                if isinstance(raw_ann, str):
                                    annotation_data = json.loads(raw_ann)
                                else:
                                    annotation_data = raw_ann
                        except:
                            annotation_data = None

                        if annotation_data:
                            # Access fields safely (handle both dict and object access just in case)
                            if isinstance(annotation_data, dict):
                                desc = annotation_data.get('image_description', 'N/A')
                                data_pts = annotation_data.get('data_extraction', 'N/A')
                                analysis = annotation_data.get('comparative_analysis', 'N/A')
                            else:
                                # Fallback if Pydantic object
                                desc = getattr(annotation_data, 'image_description', 'N/A')
                                data_pts = getattr(annotation_data, 'data_extraction', 'N/A')
                                analysis = getattr(annotation_data, 'comparative_analysis', 'N/A')

                            visual_section += (
                                f"\n> **[{figure_id} Analysis]**\n"
                                f"> - **Visual:** {desc}\n"
                                f"> - **Data:** {data_pts}\n"
                                f"> - **Insight:** {analysis}\n"
                            )
                            manifest_log += f"- **Page {page_num}**: Found {figure_id}. Extracted data points: *\"{str(data_pts)[:50]}...\"*\n"
                        else:
                            manifest_log += f"- **Page {page_num}**: Found {figure_id} but annotation was empty.\n"
                
                # --- MERGE & SAVE ---
                enriched_content = f"**[Page {page_num}]**\n{markdown}\n"
                
                if visual_section:
                    enriched_content += "\n### 📊 Visual Data Extracted:\n" + visual_section

                chunks = self._chunk_markdown(enriched_content)
                for chunk in chunks:
                    if not chunk.strip(): continue
                    vector = self.get_embedding(chunk)
                    
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id,
                        "page_number": page_num,
                        "folder": folder,
                        "content": chunk,
                        "embedding": vector,
                        "title": filename,
                        "image_url": ""
                    }).execute()

            # E. Finish Manifest & Save
            manifest_log += "\n✅ **Extraction Complete.** You can now ask questions like *'Compare Figure 2-1 with Figure 4-3'.*"
            
            self.supabase.table("documents").update({
                "status": "ready",
                "summary": manifest_log
            }).eq("id", doc_id).execute()
            
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
                chunks.append(current_chunk.strip())
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"
            if len(current_chunk) > 3500:
                chunks.append(current_chunk.strip())
                current_chunk = ""
        if current_chunk: chunks.append(current_chunk.strip())
        return chunks

    def search_single_doc(self, query: str, doc_id: str) -> List[str]:
        query_vector = self.get_embedding(query)
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.01,
            "match_count": 10,
            "filter_doc_id": doc_id
        }
        try:
            res = self.supabase.rpc("match_page_sections", params).execute()
            return [row['content'] for row in res.data if row.get('content')]
        except: return []

    def get_documents(self):
        try:
            res = self.supabase.table("documents").select("*").order("created_at", desc=True).execute()
            return [{
                "id": r['id'], 
                "title": r.get('title','Untitled'), 
                "folder": r.get('folder','General'),
                "status": r.get('status','ready'),
                "summary": r.get('summary',''),
                "upload_date": r['created_at'].split("T")[0] if r.get('created_at') else "N/A"
            } for r in res.data]
        except: return []

    def delete_document(self, doc_id: str):
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        self.supabase.table("documents").delete().eq("id", doc_id).execute()

    def search(self, query: str, folder_name: str = None) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {"query_text": query, "query_embedding": query_vector, "match_threshold": 0.5, "match_count": 5, "filter_folder": folder_name or "General"}
        try:
            response = self.supabase.rpc("match_documents_hybrid", params).execute()
            return response.data
        except: return []

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