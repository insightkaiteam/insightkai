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

    # --- EMBEDDINGS (OPENAI) ---
    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ").strip()
        if not text: return []
        # Uses OpenAI to match your existing vector DB schema
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    # --- SEARCH LOGIC (FIXED) ---
    def search_single_doc(self, query: str, doc_id: str) -> List[dict]:
        query_vector = self.get_embedding(query)
        try:
            # SAFETY FIX: Ensure doc_id is a string or None.
            # This prevents the "operator does not exist: text = uuid" crash.
            safe_doc_id = str(doc_id) if doc_id else None

            params = {
                "query_embedding": query_vector, 
                "match_threshold": 0.01, 
                "match_count": 25, 
                "filter_doc_id": safe_doc_id 
            }
            # RPC call handles the rest
            res = self.supabase.rpc("match_document_pages", params).execute()
            
            chunks = []
            if res.data:
                for row in res.data:
                    chunks.append({
                        "content": row.get('content'),
                        "page": row.get('page_number', 1),
                        "similarity": row.get('similarity', 0),
                        "id": row.get('id', uuid.uuid4().hex),
                        "document_id": row.get('document_id')
                    })
            return chunks
        except Exception as e:
            print(f"Search Error: {e}")
            return []

    # --- CHUNKING ---
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

    # --- SUMMARY GENERATION ---
    def _generate_summary(self, full_text: str) -> str:
        try:
            if not full_text.strip():
                return "No content could be extracted."
                
            preview_text = full_text[:8000]
            system_prompt = (
                "You are a sophisticated document analyzer. Analyze the text and return a summary in EXACTLY this format:\n\n"
                "[TAG]: <Classify into one: INVOICE, RESEARCH, FINANCIAL, LEGAL, RECEIPT, OTHER>\n"
                "[DESC]: <A single, concise sentence describing the file (e.g. 'August 2023 Power Bill for $150')>\n"
                "[DETAILED]: <A dense, 5-10 line summary containing specific entities (company names, authors), dates, key outcomes, core themes, and numerical data.>"
            )
            
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Document Text:\n{preview_text}"}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Summary Error: {e}")
            return "Summary unavailable."

    # --- MAIN PROCESSOR (CLEANED) ---
    def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            print(f"Processing {filename} in {folder}")
            
            # 1. Upload to Supabase
            self.supabase.storage.from_("document-pages").upload(f"{doc_id}/source.pdf", file_bytes, {"content-type": "application/pdf"})
            
            # 2. Upload to Mistral (Required for OCR)
            print("Uploading to Mistral...")
            uploaded_file = self.client.files.upload(
                file={
                    "file_name": filename,
                    "content": file_bytes, 
                },
                purpose="ocr"
            )
            
            # 3. Mistral OCR
            print(f"Running OCR on file_id: {uploaded_file.id}...")
            ocr_response = self.client.ocr.process(
                model="mistral-ocr-latest",
                document={
                    "type": "file", # Required 'file' type
                    "file_id": uploaded_file.id,
                    "file_name": filename
                },
                include_image_base64=True
            )
            
            # 4. Chunk & Embed
            full_document_text = ""
            for page in ocr_response.pages:
                full_document_text += page.markdown + "\n\n"
            
            chunks = self._chunk_markdown(full_document_text)
            
            for i, chunk in enumerate(chunks):
                if not chunk.strip(): continue
                self.supabase.table("document_pages").insert({
                    "document_id": doc_id,
                    "content": chunk,
                    "page_number": 1, 
                    "embedding": self.get_embedding(chunk),
                    "bboxes": [] 
                }).execute()
            
            # 5. Standard Summary
            summary = self._generate_summary(full_document_text)

            # 6. Final Update
            self.supabase.table("documents").update({
                "status": "ready", 
                "summary": summary
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
    
    def get_folder_files(self, folder_name: str):
        try:
            return self.supabase.table("documents").select("id, title, summary").eq("folder", folder_name).execute().data
        except: return []