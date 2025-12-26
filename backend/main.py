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
    document_id: Optional[str] = None 
    folder_name: Optional[str] = None
    mode: Optional[str] = "simple" 

class FolderRequest(BaseModel):
    name: str

@app.get("/")
def read_root():
    return {"status": "Backend is running", "message": "Ready"}

@app.get("/documents")
def get_documents():
    return {"documents": ocr_engine.get_documents()}

@app.get("/folders")
def get_folders():
    return {"folders": pdf_engine.get_folders()}

@app.post("/folders")
def create_folder(req: FolderRequest):
    pdf_engine.create_folder(req.name)
    return {"status": "success", "folders": pdf_engine.get_folders()}

@app.delete("/folders/{folder_name}")
def delete_folder(folder_name: str):
    try:
        pdf_engine.delete_folder(folder_name)
        return {"status": "success", "folders": pdf_engine.get_folders()}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    ocr_engine.delete_document(doc_id)
    return {"status": "success"}

@app.get("/documents/{doc_id}/debug_search")
def debug_search_endpoint(doc_id: str, query: str):
    return ocr_engine.debug_search(doc_id, query)

@app.get("/documents/{doc_id}/debug")
def debug_document(doc_id: str):
    return ocr_engine.debug_document(doc_id)

@app.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    folder: str = Form("General")
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    file_bytes = await file.read()
    doc_id = str(uuid.uuid4())
    
    try:
        ocr_engine.supabase.table("documents").insert({
            "id": doc_id,
            "title": file.filename,
            "folder": folder,
            "status": "processing"
        }).execute()
        
        background_tasks.add_task(
            ocr_engine.process_pdf_background, 
            doc_id, 
            file_bytes, 
            file.filename, 
            folder
        )
        
        return {"status": "processing", "doc_id": doc_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{doc_id}/status")
def get_document_status(doc_id: str):
    res = ocr_engine.supabase.table("documents").select("status, summary").eq("id", doc_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Document not found")
    return res.data[0]

# --- UPDATED CHAT ENDPOINT ---
@app.post("/chat")
async def chat(request: ChatRequest):
    relevant_chunks = []
    
    # 1. FOLDER CHAT LOGIC (Split by Mode)
    if request.folder_name:
        if request.mode == "simple":
            # FAST MODE: Summaries Only
            relevant_chunks = ocr_engine.get_folder_summaries(request.folder_name)
        else:
            # DEEP MODE: Full Vector Search
            relevant_chunks = ocr_engine.search(request.message, folder_name=request.folder_name, limit=20)

    # 2. INDIVIDUAL DOC LOGIC (Unchanged - Preserved)
    elif request.document_id:
        relevant_chunks = ocr_engine.search_single_doc(request.message, request.document_id)

    # 3. GENERATE ANSWER
    result = ai_service.get_answer(relevant_chunks, request.message, mode=request.mode)
    
    return result

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