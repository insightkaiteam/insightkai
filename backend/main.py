from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from typing import List, Optional
import io
# Import services
from services.pdf_engine import PDFEngine
from services.openai_service import OpenAIService
#here
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pdf_engine = PDFEngine()
ai_service = OpenAIService()

class ChatRequest(BaseModel):
    message: str
    document_id: Optional[str] = None # Now optional
    folder_name: Optional[str] = None # New field

# --- FIX 1: ADD THIS MISSING CLASS ---
class FolderRequest(BaseModel):
    name: str

@app.get("/")
def read_root():
    return {"status": "Backend is running", "message": "Ready"}

@app.get("/documents")
def get_documents():
    return {"documents": pdf_engine.get_all_documents()}

# --- NEW ENDPOINTS ---

@app.get("/folders")
def get_folders():
    return {"folders": pdf_engine.get_folders()}

@app.post("/folders")
def create_folder(req: FolderRequest):
    pdf_engine.create_folder(req.name)
    return {"status": "success", "folders": pdf_engine.get_folders()}

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    pdf_engine.delete_document(doc_id)
    return {"status": "success"}

# --- FIX 2: REMOVED DUPLICATE DECORATOR HERE ---
@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    folder: str = Form("General") # Defaults to "General" if not specified
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        content = await file.read()
        # Pass the folder to the engine
        doc_id = await pdf_engine.process_pdf(content, file.filename, folder)
        return {"status": "success", "doc_id": doc_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Server Error")
    
@app.post("/chat")
async def chat(request: ChatRequest):
    
    relevant_chunks = []

    # CASE A: Chat with Folder
    if request.folder_name:
        print(f"FOLDER CHAT: Searching folder '{request.folder_name}'")
        # Returns list of dicts: [{'image_url': '...', 'document_name': '...'}]
        data = pdf_engine.get_relevant_folder_pages(request.message, request.folder_name)
        
        # Format for AI Service
        # We just send the URLs for now. 
        # (Optional: You can update OpenAI service to take document names too)
        relevant_chunks = [item['image_url'] for item in data]

    # CASE B: Chat with Single Document
    elif request.document_id:
        print(f"DOC CHAT: Searching document {request.document_id}")
        relevant_chunks = pdf_engine.get_relevant_pages(request.message, request.document_id)

    # 3. Get Answer from AI
    if relevant_chunks:
        answer = ai_service.get_answer(relevant_chunks, request.message)
    else:
        # Fallback: Normal AI Chat if no docs found
        answer = ai_service.get_answer([], request.message)
        
    return {"answer": answer}

@app.get("/documents/{doc_id}/download")
def download_pdf(doc_id: str):
    pdf_bytes = pdf_engine.get_pdf_bytes(doc_id)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    return Response(content=pdf_bytes, media_type="application/pdf")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    content = await file.read()
    audio_file = io.BytesIO(content)
    audio_file.name = "recording.webm"
    text = ai_service.transcribe_audio(audio_file)
    return {"text": text}