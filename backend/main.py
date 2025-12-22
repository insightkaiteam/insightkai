from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from typing import List, Optional
import io
import uuid
# Import services
from services.pdf_engine import PDFEngine
from services.openai_service import OpenAIService
from services.mistral_engine import MistralEngine

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
ocr_engine = MistralEngine()
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
    # Use ocr_engine so we get the 'status' and 'summary' fields
    return {"documents": ocr_engine.get_documents()}

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
    # Use the OCR engine to delete
    ocr_engine.delete_document(doc_id)
    return {"status": "success"}

@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks, # <--- Magic handled here
    file: UploadFile = File(...),
    folder: str = Form("General")
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    # 1. Read file bytes immediately (Before request closes)
    file_bytes = await file.read()
    
    # 2. Create an ID and Initial DB Entry
    doc_id = str(uuid.uuid4())
    
    try:
        # Insert "Processing" record into NEW documents table
        ocr_engine.supabase.table("documents").insert({
            "id": doc_id,
            "title": file.filename,
            "folder": folder,
            "status": "processing"
        }).execute()
        
        # 3. Offload the heavy lifting to Background Task
        background_tasks.add_task(
            ocr_engine.process_pdf_background, 
            doc_id, 
            file_bytes, 
            file.filename, 
            folder
        )
        
        # 4. Return IMMEDIATELY
        return {"status": "processing", "doc_id": doc_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{doc_id}/status")
def get_document_status(doc_id: str):
    # Fetch status from DB
    res = ocr_engine.supabase.table("documents").select("status, summary").eq("id", doc_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return res.data[0]


@app.post("/chat")
async def chat(request: ChatRequest):
    relevant_chunks = []

    # CASE A: Chat with Folder
    if request.folder_name:
        # Implementation for folder search (Hybrid)
        results = ocr_engine.search(request.message, folder_name=request.folder_name)
        relevant_chunks = [r['content'] for r in results]

    # CASE B: Chat with Single Document
    elif request.document_id:
        print(f"Searching Text in Doc: {request.document_id}")
        # Use the NEW text-based search
        relevant_chunks = ocr_engine.search_single_doc(request.message, request.document_id)

    # 3. Get Answer (Now sending TEXT, not images)
    answer = ai_service.get_answer(relevant_chunks, request.message)
        
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