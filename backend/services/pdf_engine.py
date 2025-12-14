import io
from pypdf import PdfReader
from typing import Dict, List
from datetime import datetime
import uuid

class PDFEngine:
    def __init__(self):
        # Stores content: {"doc_id": "full text..."}
        self.document_content: Dict[str, str] = {}
        # Stores metadata: {"doc_id": {"title": "...", "date": "..."}}
        self.document_metadata: Dict[str, dict] = {}

    async def process_pdf(self, file_content: bytes, filename: str) -> str:
        try:
            reader = PdfReader(io.BytesIO(file_content))
            full_text = ""
            for page in reader.pages:
                text = page.extract_text()
                if text: full_text += text + "\n"
            
            # Generate Unique ID
            doc_id = str(uuid.uuid4())
            
            # Store data
            self.document_content[doc_id] = full_text
            self.document_metadata[doc_id] = {
                "id": doc_id,
                "title": filename,
                "upload_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "page_count": len(reader.pages)
            }
            return doc_id
        except Exception as e:
            print(f"Error: {e}")
            raise e

    def get_document_context(self, doc_id: str) -> str:
        return self.document_content.get(doc_id, "")

    def get_all_documents(self) -> List[dict]:
        return list(self.document_metadata.values())