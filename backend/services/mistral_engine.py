import os
import io
import uuid
import json
from typing import List, Any
from mistralai import Mistral
from openai import OpenAI
from supabase import create_client, Client
from pydantic import BaseModel, Field

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

    # --- 1. EMBEDDINGS: KEEP OPENAI (CRITICAL FOR CHAT) ---
    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ").strip()
        if not text: return []
        # Uses text-embedding-3-small (1536 dims) to match your existing DB
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    def _generate_summary(self, text: str) -> str:
        prompt = f"Summarize this document in 3 concise sentences. Capture the main topic, key entities, and purpose.\n\nText: {text[:10000]}"
        try:
            res = self.client.chat.complete(model="mistral-small-latest", messages=[{"role": "user", "content": prompt}])
            return res.choices[0].message.content
        except: return "Summary unavailable."

    def _extract_resume_data(self, text: str) -> dict:
        prompt = (
            "You are a Technical Recruiter. Extract structured data from this resume text into JSON.\n"
            "Format requirements:\n"
            "- name: Candidate Name\n"
            "- phone: Phone Number\n"
            "- email: Email Address\n"
            "- education: concise string (e.g. 'BTech - IIT Patna; PhD - IISC')\n"
            "- experience: concise string (e.g. 'EY - 2yrs - Market Risk; Google - 1yr - Dev')\n"
            "- skills: comma separated string of top 5 hard skills (e.g. 'Python, Calculus, React')\n"
            "\n"
            "Return ONLY the JSON object."
        )
        try:
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text[:25000]} 
                ],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"Resume Extraction Error: {e}")
            return {"name": "Extraction Error", "education": "Failed to parse"}

    def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            print(f"Processing {filename} in {folder}")
            
            # --- 2. UPLOAD TO SUPABASE (STORAGE BACKUP) ---
            self.supabase.storage.from_("document-pages").upload(f"{doc_id}/source.pdf", file_bytes, {"content-type": "application/pdf"})
            
            # --- 3. UPLOAD TO MISTRAL (REQUIRED FOR OCR) ---
            # We must upload first. We pass raw bytes directly (not io.BytesIO).
            print("Uploading to Mistral...")
            uploaded_file = self.client.files.upload(
                file={
                    "file_name": filename,
                    "content": file_bytes, 
                },
                purpose="ocr"
            )
            
            # --- 4. RUN OCR ON FILE ID ---
            print(f"Running OCR on file_id: {uploaded_file.id}...")
            ocr_response = self.client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "document",
                    "file_id": uploaded_file.id,
                    "file_name": filename
                },
                include_image_base64=False
            )
            
            # --- 5. PROCESS TEXT & EMBEDDINGS ---
            full_document_text = ""
            for page in ocr_response.pages:
                page_text = page.markdown
                full_document_text += page_text + "\n\n"
                
                # Chunking
                chunks = [page_text[i:i+1000] for i in range(0, len(page_text), 800)]
                for chunk in chunks:
                    if not chunk.strip(): continue
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id,
                        "content": chunk,
                        "page_number": page.index + 1,
                        "embedding": self.get_embedding(chunk), # Uses OpenAI
                        "bboxes": [] 
                    }).execute()
            
            # --- 6. ROUTING LOGIC (HIRING vs GENERAL) ---
            final_summary_content = ""
            clean_folder = folder.strip().lower() if folder else "general"
            
            if clean_folder == "hiring kai":
                print("Running Resume Extraction Pipeline...")
                structured_data = self._extract_resume_data(full_document_text)
                text_summary = self._generate_summary(full_document_text)
                final_summary_content = json.dumps({
                    "type": "resume",
                    "structured": structured_data,
                    "fast_summary": text_summary
                })
            else:
                print("Running Standard Summary Pipeline...")
                summary = self._generate_summary(full_document_text)
                final_summary_content = f"**Content Summary:** {summary}\n\nVerified."

            # --- 7. FINALIZE ---
            self.supabase.table("documents").update({
                "status": "ready", 
                "summary": final_summary_content
            }).eq("id", doc_id).execute()
            print(f"Success: {doc_id} is ready.")
            
        except Exception as e:
            print(f"Ingestion Error: {e}")
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

    def search_single_doc(self, query: str, doc_id: str, limit: int = 5):
        query_embedding = self.get_embedding(query)
        try:
            return self.supabase.rpc("match_document_pages", {
                "query_embedding": query_embedding,
                "match_threshold": 0.5,
                "match_count": limit,
                "filter_doc_id": doc_id
            }).execute().data
        except Exception as e:
            print(f"Search Error: {e}")
            return []
            
    def get_folder_files(self, folder_name: str):
        try:
            res = self.supabase.table("documents").select("id, title, summary").eq("folder", folder_name).execute()
            return res.data
        except: return []