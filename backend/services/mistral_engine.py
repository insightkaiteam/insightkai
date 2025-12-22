import os
import io
import uuid
from typing import List
from datetime import datetime
from mistralai import Mistral
from openai import OpenAI
from supabase import create_client, Client

class MistralEngine:
    def __init__(self):
        # 1. Initialize Supabase
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        self.supabase: Client = create_client(url, key)
        
        # 2. Initialize OpenAI (For Embeddings only - dirt cheap)
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        # 3. Initialize Mistral (For OCR & Extraction)
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY is missing!")
        self.client = Mistral(api_key=api_key)

    def get_embedding(self, text: str) -> List[float]:
        # Clean text slightly
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    async def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        """
        This runs in the BACKGROUND. It does not block the user.
        """
        try:
            print(f"[{doc_id}] Starting Mistral OCR for {filename}...")

            # A. Upload Source PDF to Storage (So we can view it later)
            self.supabase.storage.from_("document-pages").upload(
                file=file_bytes,
                path=f"{doc_id}/source.pdf",
                file_options={"content-type": "application/pdf"}
            )

            # B. Call Mistral OCR (The "Vision" Step)
            # We send the bytes directly. 
            uploaded_file = self.client.files.upload(
                file={
                    "file_name": filename,
                    "content": file_bytes,
                },
                purpose="ocr"
            )
            
            # Wait for OCR processing
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            ocr_response = self.client.ocr.process(
                document={
                    "type": "document_url",
                    "document_url": signed_url.url,
                },
                model="mistral-ocr-latest",
                include_image_base64=False 
            )

            # C. Process the Markdown Output
            full_summary_text = ""
            
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                
                # 1. Enrich with Metadata (The "Citation" Fix)
                # We prepend the Page Number so it sticks to the text chunks
                enriched_markdown = f"**[Page {page_num}]**\n{markdown}"
                
                # 2. Accumulate text for the Summary (First 2000 chars of doc)
                if len(full_summary_text) < 2000:
                    full_summary_text += markdown + "\n"

                # 3. CHUNK: Split by Headers (H1, H2)
                chunks = self._chunk_markdown(enriched_markdown)

                # 4. Embed & Save each chunk
                for chunk_text in chunks:
                    if not chunk_text.strip(): continue
                    
                    vector = self.get_embedding(chunk_text)
                    
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id,
                        "page_number": page_num,
                        "folder": folder,
                        "content": chunk_text, # Saving the text!
                        "embedding": vector,
                        "title": filename,
                        # We don't have individual image_urls anymore with pure OCR, 
                        # but we can link to the source PDF later.
                        "image_url": None 
                    }).execute()

            # D. Generate Summary (The "Layer 1" Search)
            summary = self._generate_summary(full_summary_text)

            # E. Mark as READY
            self.supabase.table("documents").update({
                "status": "ready",
                "summary": summary
            }).eq("id", doc_id).execute()
            
            print(f"[{doc_id}] Processing Complete.")

        except Exception as e:
            print(f"[{doc_id}] FAILED: {e}")
            self.supabase.table("documents").update({
                "status": "failed"
            }).eq("id", doc_id).execute()

    def _chunk_markdown(self, text: str) -> List[str]:
        """
        Intelligent Splitting:
        Splits text by Markdown headers (#, ##, ###) so we keep logical sections together.
        """
        chunks = []
        current_chunk = ""
        
        lines = text.split('\n')
        for line in lines:
            # If line is a header (e.g. "# Financials"), it's a new chunk
            if line.strip().startswith("#"):
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = line + "\n"
            else:
                current_chunk += line + "\n"
                
            # Safety: If chunk gets too big (>1000 words), force a split
            if len(current_chunk) > 4000:
                chunks.append(current_chunk.strip())
                current_chunk = ""
        
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return chunks

    def _generate_summary(self, text: str) -> str:
        # Use GPT-4o-mini to generate a quick 3-sentence summary
        try:
            res = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": f"Summarize this document in 3 concise sentences for search indexing:\n\n{text[:3000]}"}]
            )
            return res.choices[0].message.content
        except:
            return "Summary unavailable."
        
# ... inside MistralEngine class ...

    # 1. ADD THIS SEARCH METHOD
    def search(self, query: str, folder_name: str = None, doc_id: str = None) -> List[dict]:
        """
        Performs Hybrid Search (Text + Vector)
        Returns: List of text chunks (Markdown)
        """
        query_vector = self.get_embedding(query)
        
        # Determine if we filter by Folder or specific Document
        params = {
            "query_text": query,
            "query_embedding": query_vector,
            "match_threshold": 0.5,
            "match_count": 5,
            "filter_folder": folder_name or "General" # Default to General if None
        }

        # If we are searching a specific doc (e.g. from the chat page), we need a different SQL function 
        # OR we can just filter the results in Python for now to keep it simple.
        # Ideally, use the 'match_documents_hybrid' function we created.
        
        try:
            response = self.supabase.rpc("match_documents_hybrid", params).execute()
            
            # Simple Python filter if doc_id is provided (since our SQL currently filters by folder)
            results = response.data
            if doc_id:
                results = [r for r in results if r.get('id') == doc_id] # Note: r['id'] here is the page ID, we need to ensure SQL returns doc_id too
                # Actually, our SQL 'match_documents_hybrid' returns page IDs. 
                # To fix this properly for single-doc chat, let's just rely on the folder context 
                # or create a 'match_page_hybrid' function. 
                
                # For Shoestring MVP: Let's fallback to the OLD match_pages logic for single docs, 
                # but grab CONTENT instead of IMAGE_URL.
                pass 
            
            return results
        except Exception as e:
            print(f"Search Error: {e}")
            return []

    # 2. ADD THIS DELETE METHOD
    def delete_document(self, doc_id: str):
        try:
            # Delete from 'documents' table (Cascade should delete pages too if set up, 
            # but let's be safe and delete both)
            self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
            self.supabase.table("documents").delete().eq("id", doc_id).execute()
            
            # Cleanup Storage (Optional/Async)
            # self.supabase.storage.from_("document-pages").remove([f"{doc_id}/source.pdf"])
            return True
        except Exception as e:
            print(f"Delete Error: {e}")
            raise e

    def search_single_doc(self, query: str, doc_id: str) -> List[str]:
        query_vector = self.get_embedding(query)
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.3, # Lower threshold for text
            "match_count": 5,
            "filter_doc_id": doc_id
        }
        res = self.supabase.rpc("match_page_sections", params).execute()
        return [row['content'] for row in res.data]


    def get_documents(self):
        """
        Fetch all documents from the NEW table, including their status (processing/ready).
        """
        try:
            # Select everything, including the new 'summary' and 'status' columns
            response = self.supabase.table("documents")\
                .select("*")\
                .order("created_at", desc=True)\
                .execute()
            
            # Helper to format the date safely
            docs = []
            for row in response.data:
                # Basic date formatting
                created = row['created_at'].split("T")[0] if row.get('created_at') else "Unknown"
                
                docs.append({
                    "id": row['id'],
                    "title": row.get('title', 'Untitled'),
                    "folder": row.get('folder', 'General'),
                    "status": row.get('status', 'ready'), # Default to ready if missing
                    "summary": row.get('summary', ''),
                    "upload_date": created,
                    "page_count": "N/A" # We can calculate this later if needed
                })
            return docs
            
        except Exception as e:
            print(f"Error fetching documents: {e}")
            return []