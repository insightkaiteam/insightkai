from fastapi import FastAPI, UploadFile, File, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from typing import List, Optional
import io
import uuid
import re
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

# --- HELPER: NORMALIZE TEXT FOR MATCHING ---
def normalize_text(text: str) -> str:
    """Removes special characters and lowercases text for better fuzzy matching."""
    return re.sub(r'[^a-zA-Z0-9\s]', '', text).lower().replace('\n', ' ').strip()

# --- UPDATED CHAT ENDPOINT ---@app.post("/chat")
async def chat(request: ChatRequest):
    relevant_chunks = []
    system_manifest = None

    # 1. Retrieval Strategy Selection
    if request.folder_name:
        # Get Manifest (Table of Contents) for context
        system_manifest = ocr_engine.get_folder_manifest(request.folder_name)
        
        # 🚀 STRATEGY A: FAST CHAT (Summary Only)
        if request.mode == "simple":
            relevant_chunks = ocr_engine.search_folder_fast(request.message, request.folder_name)
            
            # If fast search fails to find metadata, we fallback to a light deep search
            if not relevant_chunks:
                relevant_chunks = ocr_engine.search_folder_deep(request.message, request.folder_name)

        # 🚀 STRATEGY B: DEEP CHAT (Targeted Rerank)
        else:
             relevant_chunks = ocr_engine.search_folder_deep(request.message, request.folder_name)
            
    elif request.document_id:
        # UNCHANGED: Single Doc Chat
        relevant_chunks = ocr_engine.search_single_doc(request.message, request.document_id)

    # 2. Generation (Get Answer + Exact Quotes)
    ai_response = ai_service.get_answer(relevant_chunks, request.message, system_message_override=system_manifest)
    
    # [Rest of the function remains identical to preserve citation logic]
    if isinstance(ai_response, str):
        answer_text = ai_response
        used_quotes = []
    else:
        answer_text = ai_response.get("answer", "")
        used_quotes = ai_response.get("quotes", [])

    final_citations = []
    
    for quote in used_quotes:
        best_match = None
        highest_score = 0
        norm_quote = normalize_text(quote)
        
        for chunk in relevant_chunks:
            norm_chunk = normalize_text(chunk['content'])
            
            if norm_quote in norm_chunk:
                best_match = chunk
                break
            
            quote_words = norm_quote.split()
            if len(quote_words) < 4: continue
            
            matches = 0
            total_snippets = len(quote_words) - 3
            for i in range(total_snippets):
                snippet = " ".join(quote_words[i:i+4])
                if snippet in norm_chunk:
                    matches += 1
            
            score = matches / total_snippets if total_snippets > 0 else 0
            
            if score > 0.5 and score > highest_score:
                highest_score = score
                best_match = chunk

        if best_match:
            final_citations.append({
                "page": best_match.get("page", 1),
                "source": best_match.get("source", "Unknown"),
                "content": quote 
            })

    return {
        "answer": answer_text,
        "citations": final_citations
    }

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