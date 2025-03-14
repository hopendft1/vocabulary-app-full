from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import csv
import io

from .. import models, schemas
from ..database import get_db



router = APIRouter(
    prefix="/courses",
    tags=["courses"],
    responses={404: {"description": "Not found"}},
)

@router.delete("/{course_id}", response_model=schemas.Course)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # 删除关联的单词
    db.query(models.Word).filter(models.Word.course_id == course_id).delete()
    db.delete(course)
    db.commit()
    return course

@router.post("/", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = models.Course(**course.dict())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

@router.get("/", response_model=List[schemas.Course])
def read_courses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    courses = db.query(models.Course).offset(skip).limit(limit).all()
    return courses

@router.get("/{course_id}", response_model=schemas.CourseWithWords)
def read_course(course_id: int, db: Session = Depends(get_db)):
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return db_course

@router.post("/{course_id}/upload-csv", response_model=schemas.CourseWithWords)
def upload_csv(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Check if course exists
    db_course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    
    # Read and parse CSV file
    try:
        contents = file.file.read().decode('utf-8')
        csv_reader = csv.reader(io.StringIO(contents))
        
        # Skip header if exists
        try:
            next(csv_reader)
        except StopIteration:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        
        # Process CSV rows
        for row in csv_reader:
            if len(row) < 3:  # At minimum: word, pinyin, definition
                continue
                
            # Create word with available data
            word_data = {
                "word": row[0],
                "pinyin": row[1],
                "definition": row[2],
                "example": row[3] if len(row) > 3 else None,
                "audio_link": row[4] if len(row) > 4 else None,
                "course_id": course_id
            }
            
            # Add word to database
            db_word = models.Word(**word_data)
            db.add(db_word)
            db.commit()
            db.refresh(db_word)
            
            # Initialize learning data for the word
            learning_data = models.LearningData(word_id=db_word.id)
            db.add(learning_data)
            
        db.commit()
        
        # Return updated course with words
        return db_course
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process CSV file: {str(e)}")
    finally:
        file.file.close()
