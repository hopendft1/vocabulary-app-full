from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

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
app.include_router(words.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Vocabulary Learning API"}

# Use environment port (important for Railway)
port = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)

