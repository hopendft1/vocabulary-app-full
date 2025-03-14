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
    db_course = db.query(models.Course).options(joinedload(models.Course.words)).filter(models.Course.id == course_id).first()
    if db_course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        # Read and parse CSV file with UTF-8 encoding
        contents = file.file.read().decode('utf-8-sig')
        csv_reader = csv.reader(io.StringIO(contents))
        
        # Skip header if exists
        try:
            next(csv_reader)
        except StopIteration:
            raise HTTPException(status_code=400, detail="Empty CSV file")

        # Prepare bulk insert
        word_instances = []
        learning_instances = []
        
        for row in csv_reader:
            if not row or len(row) < 3 or all(field.strip() == "" for field in row):
                continue

            word_data = {
                "word": row[0],
                "pinyin": row[1],
                "definition": row[2],
                "example": row[3] if len(row) > 3 else None,
                "audio_link": row[4] if len(row) > 4 else None,
                "course_id": course_id
            }

            db_word = models.Word(**word_data)
            word_instances.append(db_word)

        # Bulk save words
        db.bulk_save_objects(word_instances)
        db.commit()

        # Add learning data for each word
        for word in word_instances:
            learning_instances.append(models.LearningData(word_id=word.id))
        
        db.bulk_save_objects(learning_instances)
        db.commit()

        # Return updated course with words
        return db_course
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process CSV file: {str(e)}")
    
    finally:
        file.file.close()
