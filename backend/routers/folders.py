from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# Create the router
router = APIRouter()

# Define a simple model for data validation (optional but good practice)
class FolderCreate(BaseModel):
    name: str

# Mock database for demonstration (replace with your real DB logic later)
fake_folders_db = [
    {"id": 1, "name": "Financial Docs"}, 
    {"id": 2, "name": "Research Papers"}
]

# 1. GET /folders - List all folders
@router.get("/folders")
def get_folders():
    return fake_folders_db

# 2. POST /folders - Create a new folder
@router.post("/folders")
def create_folder(folder: FolderCreate):
    new_id = len(fake_folders_db) + 1
    new_folder = {"id": new_id, "name": folder.name}
    fake_folders_db.append(new_folder)
    return new_folder