from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# Allow your frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only. In prod, we'll change this to your Vercel domain.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

@app.get("/")
def read_root():
    return {"status": "Backend is running", "message": "Hello from Render!"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    return {"filename": file.filename, "status": "File received"}

@app.post("/chat")
async def chat(request: ChatRequest):
    # Placeholder for OpenAI logic (we will add this next)
    return {"answer": f"You said: {request.message}. (AI Connection Pending)"}