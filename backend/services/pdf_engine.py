import io
import uuid
import os
from typing import List, Optional
from datetime import datetime

import pypdfium2 as pdfium
from PIL import Image
from supabase import create_client, Client
from openai import OpenAI

class PDFEngine:
    def __init__(self):
        # Initialize Supabase
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("Supabase credentials missing in environment variables.")
        self.supabase: Client = create_client(url, key)
        
        # Initialize OpenAI for Embeddings
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def get_folders(self) -> List[str]:
        # Fetch actual folders from the new table
        response = self.supabase.table("folders").select("name").execute()
        # Return a list of names like ["General", "Finance", "Receipts"]
        return sorted([row['name'] for row in response.data])

    def create_folder(self, folder_name: str):
        try:
            self.supabase.table("folders").insert({"name": folder_name}).execute()
        except Exception as e:
            print(f"Folder might already exist: {e}")

    # --- NEW: DELETE FOLDER ---
    def delete_folder(self, folder_name: str):
        if folder_name == "General":
            raise ValueError("Cannot delete the General folder")
        
        # 1. Move all documents in this folder to 'General' to prevent data loss
        # We need to update both the main 'documents' table and the 'document_pages' chunks
        try:
            self.supabase.table("documents").update({"folder": "General"}).eq("folder", folder_name).execute()
            self.supabase.table("document_pages").update({"folder": "General"}).eq("folder", folder_name).execute()
            
            # 2. Delete the folder itself
            self.supabase.table("folders").delete().eq("name", folder_name).execute()
        except Exception as e:
            print(f"Error deleting folder: {e}")
            raise e

    def get_embedding(self, text: str) -> List[float]:
        # Generate vector for text search (Cost: extremely cheap)
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    async def process_pdf(self, file_content: bytes, filename: str, folder: str = "General") -> str:
        try:
            pdf = pdfium.PdfDocument(io.BytesIO(file_content))
            n_pages = len(pdf)
            
            if n_pages > 50: 
                raise ValueError(f"Page limit exceeded. Max 50 pages allowed.")

            doc_id = str(uuid.uuid4())

            # Save the ORIGINAL PDF file for the previewer
            self.supabase.storage.from_("document-pages").upload(
                file=file_content,
                path=f"{doc_id}/source.pdf",
                file_options={"content-type": "application/pdf"}
            )

            print(f"Processing {filename} ({n_pages} pages)...")

            for i in range(n_pages):
                page = pdf[i]
                
                # A. Extract Text (For the Search Index)
                text_page = page.get_textpage()
                extracted_text = text_page.get_text_bounded()
                
                if len(extracted_text.strip()) < 10:
                    extracted_text = f"Image based page {i+1} of document {filename}. Contains visual data."

                # B. Generate Embedding (The "Search Fingerprint")
                vector = self.get_embedding(extracted_text)

                # C. Render Image (For the Vision AI)
                bitmap = page.render(scale=1) # High Res
                pil_image = bitmap.to_pil()
                
                # Convert to Bytes
                img_byte_arr = io.BytesIO()
                pil_image.save(img_byte_arr, format='JPEG', quality=80)
                img_bytes = img_byte_arr.getvalue()

                # D. Upload Image to Supabase Storage
                file_path = f"{doc_id}/{i}.jpg"
                self.supabase.storage.from_("document-pages").upload(
                    file=img_bytes,
                    path=file_path,
                    file_options={"content-type": "image/jpeg"}
                )

                public_url = self.supabase.storage.from_("document-pages").get_public_url(file_path)

                # E. Save Metadata to DB Table
                data = {
                    "document_id": doc_id,
                    "page_number": i + 1,
                    "folder": folder,
                    "image_url": public_url,
                    "embedding": vector,
                    "title": filename
                }
                self.supabase.table("document_pages").insert(data).execute()

            return doc_id

        except Exception as e:
            print(f"Error processing PDF: {e}")
            raise e

    def get_relevant_folder_pages(self, query: str, folder_name: str) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.25,
            "match_count": 5,
            "filter_folder_name": folder_name
        }
        response = self.supabase.rpc("match_folder_pages", params).execute()
        return response.data

    def get_relevant_pages(self, query: str, doc_id: str) -> List[dict]:
        query_vector = self.get_embedding(query)
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.25,
            "match_count": 5,
            "filter_doc_id": doc_id
        }
        response = self.supabase.rpc("match_pages", params).execute()
        return response.data

    def delete_document(self, doc_id: str):
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        pass

    def get_pdf_bytes(self, doc_id: str) -> Optional[bytes]:
            try:
                response = self.supabase.storage.from_("document-pages").download(f"{doc_id}/source.pdf")
                return response
            except Exception as e:
                print(f"Error downloading PDF: {e}")
                return None

    def get_all_documents(self) -> List[dict]:
        try:
            # Fetch "Page 1" of every document to get the list of unique files
            response = self.supabase.table("document_pages")\
                .select("document_id, title, folder, created_at")\
                .eq("page_number", 1)\
                .execute()
            
            documents = []
            for row in response.data:
                date_str = row['created_at']
                if date_str:
                    date_str = date_str.split("T")[0] 
                
                documents.append({
                    "id": row['document_id'],
                    "title": row.get('title') or "Untitled PDF", 
                    "folder": row['folder'],
                    "upload_date": date_str,
                    "page_count": "N/A" 
                })
            return documents
        except Exception as e:
            print(f"Error fetching documents: {e}")
            return []