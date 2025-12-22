import os
import io
import uuid
import base64
from typing import List
from mistralai import Mistral
from openai import OpenAI
from supabase import create_client, Client

class MistralEngine:
    def __init__(self):
        # 1. Initialize Supabase
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        self.supabase: Client = create_client(url, key)
        
        # 2. Initialize OpenAI (Embeddings & Chat)
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        # 3. Initialize Mistral (OCR & Vision)
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY is missing!")
        
        self.client = Mistral(api_key=api_key)

    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    # --- MAIN PROCESSING TASK ---
    async def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            print(f"[{doc_id}] Starting Mistral OCR 3.0 (v25.12) for {filename}...")

            # A. Upload Source PDF to Supabase
            self.supabase.storage.from_("document-pages").upload(
                file=file_bytes,
                path=f"{doc_id}/source.pdf",
                file_options={"content-type": "application/pdf"}
            )

            # B. Upload File to Mistral
            uploaded_file = self.client.files.upload(
                file={
                    "file_name": filename,
                    "content": file_bytes,
                },
                purpose="ocr"
            )
            
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            
            # C. Run OCR (Force using the specific V3 model)
            ocr_response = self.client.ocr.process(
                document={
                    "type": "document_url",
                    "document_url": signed_url.url,
                },
                model="mistral-ocr-2512", # <--- Explicit V3 Model
                include_image_base64=True
            )

            full_summary_text = ""
            
            # D. Iterate through Pages
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                
                # --- ROBUST VISUAL EXTRACTION ---
                # Instead of trying to find/replace tags, we simply collect ALL visual data
                # and append it as a "Visual Appendix" to the page text.
                visual_descriptions = []
                
                for img in page.images:
                    base64_data = img.image_base64
                    if base64_data:
                        # Describe the image
                        desc = self._describe_with_pixtral(base64_data)
                        visual_descriptions.append(f"> **[Figure/Chart Analysis]:** {desc}")

                # Combine Text + Visuals
                enriched_content = f"**[Page {page_num}]**\n{markdown}\n\n"
                
                if visual_descriptions:
                    enriched_content += "### Visual Data Extracted from Page:\n" + "\n\n".join(visual_descriptions)

                # Append to full summary accumulator
                if len(full_summary_text) < 5000:
                    full_summary_text += enriched_content + "\n"

                # Chunk & Save
                # We save larger chunks now to ensure description stays with context
                chunks = self._chunk_markdown(enriched_content)

                for chunk_text in chunks:
                    if not chunk_text.strip(): continue
                    
                    vector = self.get_embedding(chunk_text)
                    
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id,
                        "page_number": page_num,
                        "folder": folder,
                        "content": chunk_text,
                        "embedding": vector,
                        "title": filename,
                        "image_url": "" 
                    }).execute()

            # E. Generate Summary
            summary = self._generate_summary(full_summary_text)
            self.supabase.table("documents").update({
                "status": "ready",
                "summary": summary
            }).eq("id", doc_id).execute()
            
            print(f"[{doc_id}] Success.")

        except Exception as e:
            print(f"[{doc_id}] FAILED: {e}")
            self.supabase.table("documents").update({"status": "failed"}).eq("id", doc_id).execute()

    def _describe_with_pixtral(self, base64_img: str) -> str:
        """
        Aggressive prompt to force detailed data extraction.
        """
        try:
            res = self.client.chat.complete(
                model="pixtral-12b-2409",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Analyze this image in extreme detail. 1. If it is a chart, extract the axis labels, key trends, and specific data points (numbers). 2. If it is a diagram, explain the flow. 3. If it is a document screenshot, transcribe the key header details. Do not summarize; be specific."},
                            {"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_img}"}
                        ]
                    }
                ],
                temperature=0.1 # Lower temp for more factual extraction
            )
            return res.choices[0].message.content
        except Exception as e:
            print(f"Vision Error: {e}")
            return "Image analysis unavailable."

    def _chunk_markdown(self, text: str) -> List[str]:
        """
        Improved chunker: Splits by headers but ensures chunks aren't too small.
        """
        chunks = []
        current_chunk = ""
        lines = text.split('\n')
        
        for line in lines:
            # Split on H1/H2 but ONLY if current chunk is substantial (>500 chars)
            # This prevents splitting a header from its immediate paragraph
            if line.strip().startswith("#") and len(current_chunk) > 500:
                chunks.append(current_chunk.strip())
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"
            
            # Hard limit to prevent token overflow
            if len(current_chunk) > 3500:
                chunks.append(current_chunk.strip())
                current_chunk = ""
        
        if current_chunk: 
            chunks.append(current_chunk.strip())
            
        return chunks

    # --- UTILS ---
    def _generate_summary(self, text: str) -> str:
        try:
            res = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Summarize this document in 3 concise sentences:\n\n{text[:4000]}"}]
            )
            return res.choices[0].message.content
        except: return "Summary unavailable."

    def search(self, query: str, folder_name: str = None) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {
            "query_text": query,
            "query_embedding": query_vector,
            "match_threshold": 0.5,
            "match_count": 5,
            "filter_folder": folder_name or "General"
        }
        try:
            response = self.supabase.rpc("match_documents_hybrid", params).execute()
            return response.data
        except: return []

    def search_single_doc(self, query: str, doc_id: str) -> List[str]:
        query_vector = self.get_embedding(query)
        # Low threshold (0.01) ensures we capture the "Visual Data" sections 
        # which might use different vocabulary than the user's query.
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.01, 
            "match_count": 10, # Increased count to get more context
            "filter_doc_id": doc_id
        }
        try:
            res = self.supabase.rpc("match_page_sections", params).execute()
            return [row['content'] for row in res.data if row.get('content')]
        except: return []

    def delete_document(self, doc_id: str):
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        self.supabase.table("documents").delete().eq("id", doc_id).execute()

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

    def debug_document(self, doc_id: str):
        try:
            doc = self.supabase.table("documents").select("*").eq("id", doc_id).execute().data[0]
            # Fetch 3 random chunks to see if visuals are there
            pages = self.supabase.table("document_pages").select("page_number, content").eq("document_id", doc_id).limit(3).execute()
            return {"status": doc['status'], "preview": [p['content'][:300] for p in pages.data]}
        except Exception as e: return {"error": str(e)}