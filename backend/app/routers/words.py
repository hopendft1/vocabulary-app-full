from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/words",
    tags=["words"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.WordWithLearningData])
def read_words(skip: int = 0, limit: int = 100, course_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Word)
    if course_id:
        query = query.filter(models.Word.course_id == course_id)
    words = query.offset(skip).limit(limit).all()
    return words

@router.get("/difficult", response_model=List[schemas.WordWithLearningData])
def get_difficult_words(limit: int = 20, db: Session = Depends(get_db)):
    words = db.query(models.Word).join(models.LearningData).filter(
        models.LearningData.is_difficult == True
    ).limit(limit).all()
    return words

@router.get("/{word_id}", response_model=schemas.WordWithLearningData)
def read_word(word_id: int, db: Session = Depends(get_db)):
    db_word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if db_word is None:
        raise HTTPException(status_code=404, detail="Word not found")
    return db_word

@router.post("/{word_id}/update-learning-data", response_model=schemas.LearningData)
def update_learning_data(
    word_id: int, 
    correct: bool, 
    db: Session = Depends(get_db)
):
    # Get the word and its learning data
    db_word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if db_word is None:
        raise HTTPException(status_code=404, detail="Word not found")
    
    # Get or create learning data
    learning_data = db.query(models.LearningData).filter(models.LearningData.word_id == word_id).first()
    if learning_data is None:
        learning_data = models.LearningData(word_id=word_id)
        db.add(learning_data)
    
    # Update learning data based on answer correctness
    now = datetime.utcnow()
    learning_data.last_reviewed = now
    
    if correct:
        learning_data.consecutive_correct += 1
        # Implement spaced repetition algorithm
        if learning_data.consecutive_correct == 1:
            interval = timedelta(hours=4)
        elif learning_data.consecutive_correct == 2:
            interval = timedelta(days=1)
        elif learning_data.consecutive_correct == 3:
            interval = timedelta(days=3)
        elif learning_data.consecutive_correct == 4:
            interval = timedelta(days=7)
        elif learning_data.consecutive_correct == 5:
            interval = timedelta(days=14)
        else:
            interval = timedelta(days=30)
        
        learning_data.next_review = now + interval
        
        # If error count is high but user gets correct answers consistently, 
        # eventually remove from difficult words
        if learning_data.consecutive_correct >= 3 and learning_data.is_difficult:
            learning_data.is_difficult = False
    else:
        learning_data.error_count += 1
        learning_data.consecutive_correct = 0
        # Schedule for quick review
        learning_data.next_review = now + timedelta(hours=1)
        
        # Mark as difficult if error count reaches threshold
        if learning_data.error_count >= 3:
            learning_data.is_difficult = True
    
    db.commit()
    db.refresh(learning_data)
    return learning_data

@router.get("/review/due", response_model=List[schemas.WordWithLearningData])
def get_due_words(limit: int = 20, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    words = db.query(models.Word).join(models.LearningData).filter(
        models.LearningData.next_review <= now
    ).limit(limit).all()
    return words


