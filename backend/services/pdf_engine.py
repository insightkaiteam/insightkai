import io
from pypdf import PdfReader
from typing import Dict, List, Set
from datetime import datetime
import uuid

class PDFEngine:
    def __init__(self):
        self.document_content: Dict[str, str] = {}
        self.document_metadata: Dict[str, dict] = {}
        self.document_files: Dict[str, bytes] = {}
        # NEW: Keep track of folder names. Start with "General".
        self.folders: Set[str] = {"General"}

    def create_folder(self, folder_name: str):
        self.folders.add(folder_name)

    def get_folders(self) -> List[str]:
        return list(sorted(self.folders))

    # Updated: Now accepts 'folder' argument
    async def process_pdf(self, file_content: bytes, filename: str, folder: str = "General") -> str:
        try:
            reader = PdfReader(io.BytesIO(file_content))
            
            # Guardrail: Page Limit
            if len(reader.pages) > 20:
                raise ValueError(f"Page limit exceeded. Max 20 pages allowed.")
            
            full_text = ""
            for page in reader.pages:
                text = page.extract_text()
                if text: full_text += text + "\n"
            
            doc_id = str(uuid.uuid4())
            
            # Ensure folder exists
            self.create_folder(folder)

            self.document_files[doc_id] = file_content
            self.document_content[doc_id] = full_text
            self.document_metadata[doc_id] = {
                "id": doc_id,
                "title": filename,
                "folder": folder, # <--- Storing the folder name
                "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "page_count": len(reader.pages)
            }
            return doc_id
        except Exception as e:
            print(f"Error: {e}")
            raise e

    # NEW: Delete function
    def delete_document(self, doc_id: str):
        self.document_content.pop(doc_id, None)
        self.document_metadata.pop(doc_id, None)
        self.document_files.pop(doc_id, None)

    def get_document_context(self, doc_id: str) -> str:
        return self.document_content.get(doc_id, "")

    def get_all_documents(self) -> List[dict]:
        return list(self.document_metadata.values())
    
    def get_pdf_bytes(self, doc_id: str) -> bytes:
        return self.document_files.get(doc_id, None)