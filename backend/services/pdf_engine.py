import io
import base64
import uuid
from typing import Dict, List, Set, Optional, Tuple
from datetime import datetime

# New Imports
import pypdfium2 as pdfium
from PIL import Image

class PDFEngine:
    def __init__(self):
        # Stores text for "searching" (optional for future, but good to keep)
        self.document_content: Dict[str, str] = {} 
        self.document_metadata: Dict[str, dict] = {}
        self.document_files: Dict[str, bytes] = {}
        
        # NEW: Store images of each page
        # Format: { "doc_id": { page_number (int): "base64_string" } }
        self.document_images: Dict[str, Dict[int, str]] = {}
        
        self.folders: Set[str] = {"General"}

    def create_folder(self, folder_name: str):
        self.folders.add(folder_name)

    def get_folders(self) -> List[str]:
        return list(sorted(self.folders))

    async def process_pdf(self, file_content: bytes, filename: str, folder: str = "General") -> str:
        try:
            # 1. Load PDF with pypdfium2
            pdf = pdfium.PdfDocument(io.BytesIO(file_content))
            n_pages = len(pdf)
            
            if n_pages > 20:
                raise ValueError(f"Page limit exceeded. Max 20 pages allowed.")

            doc_id = str(uuid.uuid4())
            self.create_folder(folder)

            # Initialize storage for this doc
            self.document_images[doc_id] = {}
            full_text_preview = ""

            # 2. Iterate through pages and convert to Images
            for i in range(n_pages):
                page = pdf[i]
                
                # Render page to bitmap (scale=2 for better quality/OCR reading)
                bitmap = page.render(scale=2)
                pil_image = bitmap.to_pil()
                
                # Convert PIL Image to Base64 String
                buffered = io.BytesIO()
                pil_image.save(buffered, format="JPEG", quality=80) # JPEG is smaller than PNG
                img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
                
                # Store in memory
                self.document_images[doc_id][i] = img_str
                
                # (Optional) Extract text just for preview/metadata
                text_page = page.get_textpage()
                full_text_preview += text_page.get_text_bounded() + "\n"

            # 3. Store Metadata
            self.document_files[doc_id] = file_content
            self.document_content[doc_id] = full_text_preview # Keep text for fallback
            self.document_metadata[doc_id] = {
                "id": doc_id,
                "title": filename,
                "folder": folder,
                "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "page_count": n_pages
            }
            
            return doc_id

        except Exception as e:
            print(f"Error processing PDF: {e}")
            raise e

    def delete_document(self, doc_id: str):
        self.document_content.pop(doc_id, None)
        self.document_metadata.pop(doc_id, None)
        self.document_files.pop(doc_id, None)
        self.document_images.pop(doc_id, None)

    # --- CRITICAL CHANGE: Return Images instead of Text ---
    def get_document_context(self, doc_id: str) -> Optional[List[str]]:
        """
        Returns a list of base64 image strings for the document.
        For now, we return ALL pages so the AI can compare them.
        (In a real app, you would only return the 'relevant' pages).
        """
        images_dict = self.document_images.get(doc_id)
        if not images_dict:
            return None
        
        # Return all pages in order as a list of base64 strings
        return [images_dict[i] for i in sorted(images_dict.keys())]

    def get_all_documents(self) -> List[dict]:
        return list(self.document_metadata.values())
    
    def get_pdf_bytes(self, doc_id: str) -> bytes:
        return self.document_files.get(doc_id, None)