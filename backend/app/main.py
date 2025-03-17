from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from app import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from .database import engine, Base
from .routers import courses, words

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vocabulary Learning API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development - restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(courses.router)
app.include_router(words.router,prefix="/words")

Base.metadata.create_all(bind=engine)

@app.get("/")
@app.get("/words")
def get_words(course_id: int):
    return {"message": f"Words for course {course_id}"}
@app.head("/")
def read_root():
    return {"message": "Welcome to Vocabulary Learning API"}

