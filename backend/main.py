from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from typing import List

# Import our new services
from services.pdf_engine import PDFEngine
from services.openai_service import OpenAIService

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
    document_id: str

@app.get("/")
def read_root():
    return {"status": "Backend is running", "message": "Ready"}

@app.get("/documents")
def get_documents():
    return {"documents": pdf_engine.get_all_documents()}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    content = await file.read()
    doc_id = await pdf_engine.process_pdf(content, file.filename)
    return {"status": "success", "doc_id": doc_id}

@app.post("/chat")
async def chat(request: ChatRequest):
    context = pdf_engine.get_document_context(request.document_id)
    if not context:
        return {"answer": "Error: Document context not found. Please re-upload (Server Memory Cleared)."}

    answer = ai_service.get_answer(context, request.message)
    return {"answer": answer}

@app.get("/documents/{doc_id}/download")
def download_pdf(doc_id: str):
    pdf_bytes = pdf_engine.get_pdf_bytes(doc_id)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    return Response(content=pdf_bytes, media_type="application/pdf")