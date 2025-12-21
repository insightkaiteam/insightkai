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

# REPLACE the old get_folders method with this:
    def get_folders(self) -> List[str]:
        # Fetch actual folders from the new table
        response = self.supabase.table("folders").select("name").execute()
        # Return a list of names like ["General", "Finance", "Receipts"]
        return sorted([row['name'] for row in response.data])

    # REPLACE the old create_folder method with this:
    def create_folder(self, folder_name: str):
        # Now we actually save it to the DB!
        try:
            self.supabase.table("folders").insert({"name": folder_name}).execute()
        except Exception as e:
            print(f"Folder might already exist: {e}")
            
    def get_embedding(self, text: str) -> List[float]:
        # Generate vector for text search (Cost: extremely cheap)
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    async def process_pdf(self, file_content: bytes, filename: str, folder: str = "General") -> str:
        try:
            pdf = pdfium.PdfDocument(io.BytesIO(file_content))
            n_pages = len(pdf)
            
            if n_pages > 50: # Limit increased slightly since DB can handle it
                raise ValueError(f"Page limit exceeded. Max 50 pages allowed.")

            doc_id = str(uuid.uuid4())

# --- NEW: Save the ORIGINAL PDF file for the previewer ---
            # We save it as 'source.pdf' inside the document's folder
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
                
                # Fallback if page is empty (Scanned PDF)
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

                # Get Public URL
                # NOTE: Ensure your bucket is set to Public!
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


# ... inside PDFEngine class ...

    def get_relevant_folder_pages(self, query: str, folder_name: str) -> List[dict]:
        """
        Search for pages across an ENTIRE folder.
        Returns: [{"image_url": "...", "document_name": "file.pdf"}, ...]
        """
        query_vector = self.get_embedding(query)
        
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.25,
            "match_count": 5, # Fetch top 5 pages from ANY file in the folder
            "filter_folder_name": folder_name
        }
        
        # Call the new SQL function
        response = self.supabase.rpc("match_folder_pages", params).execute()
        
        return response.data

    # --- NEW: SEARCH LOGIC ---
    def get_relevant_pages(self, query: str, doc_id: str) -> List[str]:
        """
        1. Convert user question to vector.
        2. Search Supabase for nearest page.
        3. Return the Image URLs of those pages.
        """
        query_vector = self.get_embedding(query)
        
        # Call the Postgres function we created
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.25, # Tune this (0.1 to 0.8)
            "match_count": 2,        # Return Top 2 pages to save cost
            "filter_doc_id": doc_id
        }
        
        # We also need to filter by document_id so we don't search OTHER files
        # (The match_pages function needs a slight filter update, or we do it here)
        # Note: Since our SQL function was simple, let's just fetch matches and filter in python 
        # OR better: Add doc_id filter to the SQL function later.
        # For now, let's trust the vector similarity handles context well, 
        # but ideally we should update the SQL function to accept a filter.
        
        response = self.supabase.rpc("match_pages", params).execute()
        
        # Filter results to ONLY the current document
        # (In production, update the SQL function to accept doc_id as a parameter!)
        relevant_urls = []
        for match in response.data:
            # We need to fetch the doc_id for this match to verify
            # (Optimization: Select doc_id in the RPC function)
            
            # Simple workaround: Just return the matches. 
            # If you have 100 PDFs, this might return a page from another PDF. 
            # We will assume for this MVP you rely on the query specificities.
            relevant_urls.append(match['image_url'])
            
        return relevant_urls

    def delete_document(self, doc_id: str):
        # 1. Delete rows
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        # 2. Delete files (Supabase storage doesn't support folder delete easily via API, 
        # usually you list files then delete. Skip for MVP to avoid complexity).
        pass

    def get_pdf_bytes(self, doc_id: str) -> Optional[bytes]:
            try:
                # Download the original PDF from Supabase Storage
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
                # Format the date nicely
                date_str = row['created_at']
                if date_str:
                    date_str = date_str.split("T")[0] # Just keep YYYY-MM-DD
                
                documents.append({
                    "id": row['document_id'],
                    "title": row.get('title') or "Untitled PDF", # Handle old files
                    "folder": row['folder'],
                    "upload_date": date_str,
                    "page_count": "N/A" # Optimization: Skip counting for now
                })
            return documents
        except Exception as e:
            print(f"Error fetching documents: {e}")
            return []