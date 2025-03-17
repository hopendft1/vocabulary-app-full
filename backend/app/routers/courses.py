import csv
import io
import logging
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from urllib.parse import urlparse

from .. import models, schemas
from ..database import get_db

router = APIRouter(
    prefix="/courses",
    tags=["courses"],
)

# Set up logging
logging.basicConfig(level=logging.INFO if not os.getenv('DEBUG') else logging.DEBUG)
logger = logging.getLogger(__name__)

@router.post("/{course_id}/upload-csv", response_model=schemas.CourseWithWords)
def upload_csv(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Processing CSV upload for course_id: {course_id}")

    # Check file size (limit to 10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    if file.size > MAX_FILE_SIZE:
        logger.error("File too large")
        raise HTTPException(status_code=400, detail="File too large. Max size is 10MB")

    # Check if course exists
    db_course = db.query(models.Course).options(joinedload(models.Course.words)).filter(models.Course.id == course_id).first()
    if db_course is None:
        logger.error("Course not found")
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        # Read CSV file with proper encoding
        logger.info("Reading CSV file")
        csv_reader = csv.DictReader(io.TextIOWrapper(file.file, encoding='utf-8-sig'))
        
        # Check for required headers
        required_fields = {"word", "pinyin", "meaning"}
        if not csv_reader.fieldnames or not required_fields.issubset(set(csv_reader.fieldnames)):
            logger.error("Invalid CSV headers")
            raise HTTPException(status_code=400, detail="CSV must contain 'word', 'pinyin', and 'meaning' headers")

        # Check for duplicate words
        existing_words = {word.word for word in db_course.words}
        word_instances = []
        for idx, row in enumerate(csv_reader, start=1):
            logger.debug(f"Processing row {idx}: {row}")
            # Skip empty or invalid rows
            if not any(row.values()) or len(row) < 3:
                logger.warning(f"Skipping invalid row {idx}")
                continue

            # Validate each field
            word = row.get("word", "").strip()
            pinyin = row.get("pinyin", "").strip()
            meaning = row.get("meaning", "").strip()
            example = row.get("example", "").strip() or None
            audio_link = row.get("audio_link", "").strip() or None

            if not word or not pinyin or not meaning:
                logger.warning(f"Skipping row {idx} due to missing fields")
                continue

            # Additional validation
            if len(word) > 50 or len(pinyin) > 50:
                logger.error(f"Row {idx}: 'word' or 'pinyin' too long")
                raise HTTPException(status_code=400, detail=f"Row {idx}: 'word' or 'pinyin' too long")
            if audio_link and not urlparse(audio_link).scheme:
                logger.error(f"Row {idx}: Invalid 'audio_link'")
                raise HTTPException(status_code=400, detail=f"Row {idx}: Invalid 'audio_link'")

            # Skip duplicates
            if word in existing_words:
                logger.warning(f"Skipping duplicate word: {word}")
                continue

            word_data = {
                "word": word,
                "pinyin": pinyin,
                "definition": meaning,  # Map 'meaning' to 'definition'
                "example": example,
                "audio_link": audio_link,
                "course_id": course_id
            }
            word_instances.append(models.Word(**word_data))
            existing_words.add(word)

        if not word_instances:
            logger.error("No valid word entries found in CSV")
            raise HTTPException(status_code=400, detail="CSV file contains no valid word entries")

        # Bulk save words in batches
        logger.info("Saving words to database")
        batch_size = 1000
        for i in range(0, len(word_instances), batch_size):
            db.bulk_save_objects(word_instances[i:i + batch_size])
            db.commit()

        # Add learning data for each word
        learning_instances = [models.LearningData(word_id=word.id) for word in word_instances]
        logger.info("Saving learning data to database")
        db.bulk_save_objects(learning_instances)
        db.commit()

        # Refresh course to include newly added words
        db.refresh(db_course)
        logger.info("Upload successful, returning course data")

        # Return Pydantic model for proper JSON serialization
        return schemas.CourseWithWords.from_orm(db_course)

    except UnicodeDecodeError as e:
        logger.error(f"Encoding error: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid file encoding. Please use UTF-8")
    except csv.Error as e:
        logger.error(f"CSV parsing error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail={"error": "Could not process CSV file", "message": str(e)})
    finally:
        file.file.close()
        logger.info("File handle closed")

# Other endpoints (if any) can go here
@router.get("/{course_id}", response_model=schemas.CourseWithWords)
def read_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).options(joinedload(models.Course.words)).filter(models.Course.id == course_id).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course

@router.get("/", response_model=List[schemas.Course])
def get_courses(db: Session = Depends(get_db)):
    courses = db.query(models.Course).all()
    return courses

@router.post("/", response_model=schemas.Course)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = models.Course(**course.dict())
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

