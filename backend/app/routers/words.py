from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from sqlalchemy.exc import SQLAlchemyError
from schemas import WordCreate, WordWithLearningData
from .. import models, schemas
from ..database import get_db
from app.models import Word, LearningData

router = APIRouter(
    prefix="/words",
    tags=["words"]
)

@router.get("/", response_model=List[schemas.WordWithLearningData])
def get_words(course_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    获取单词列表，可按课程 ID 过滤，支持分页，返回包含学习数据的单词。
    """
    query = db.query(models.Word).options(joinedload(models.Word.learning_data))
    if course_id is not None:
        query = query.filter(models.Word.course_id == course_id)
    words = query.offset(skip).limit(limit).all()
    return words

@router.post("/", response_model=schemas.Word)
def create_word(word: schemas.WordCreate, db: Session = Depends(get_db)):
    # 检查 course_id 是否存在
    if word.course_id and not db.query(models.Course).filter(models.Course.id == word.course_id).first():
        raise HTTPException(status_code=400, detail="指定的课程不存在")
    try:
        db_word = models.Word(**word.dict())
        db.add(db_word)
        db.commit()
        db.refresh(db_word)
        learning_data = models.LearningData(word_id=db_word.id)
        db.add(learning_data)
        db.commit()
        db.refresh(db_word)
        return db_word
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")

# app/routers/words.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.database import get_db
from app.models import Word, LearningData
from app.schemas import WordCreate, WordWithLearningData

router = APIRouter()

@router.post("/bulk", response_model=List[WordWithLearningData])
def create_words_bulk(words: List[WordCreate], db: Session = Depends(get_db)):
    """
    批量创建单词，支持 CourseScreen 的 CSV 上传，返回包含学习数据的单词。
    """
    try:
        db_words = []
        for word_data in words:
            db_word = Word(**word_data.dict(exclude_unset=True))
            db.add(db_word)
            db.flush()
            db_words.append(db_word)

        db.commit()

        learning_instances = [LearningData(word_id=word.id) for word in db_words]
        for instance in learning_instances:
            db.add(instance)
        db.commit()

        db_words = (
            db.query(Word)
            .options(joinedload(Word.learning_data))
            .filter(Word.id.in_([word.id for word in db_words]))
            .all()
        )
        return db_words
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"批量创建单词失败: {str(e)}")

@router.delete("/{word_id}")
def delete_word(word_id: int, db: Session = Depends(get_db)):
    """
    删除指定单词及其相关的学习数据。
    """
    word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")
    try:
        # 删除关联的学习数据
        db.query(models.LearningData).filter(models.LearningData.word_id == word_id).delete()
        db.delete(word)
        db.commit()
        return {"message": "单词已删除"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")

@router.put("/{word_id}/mark-difficult")
def mark_word_as_difficult(word_id: int, db: Session = Depends(get_db)):
    """
    将单词标记为难词，同步更新学习数据。
    """
    word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")
    try:
        word.is_difficult = True
        if word.learning_data:
            word.learning_data.is_difficult = True
        else:
            learning_data = models.LearningData(word_id=word_id, is_difficult=True)
            db.add(learning_data)
        db.commit()
        db.refresh(word)
        return {"message": "单词已标记为难词"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")

@router.post("/{word_id}/update-learning-data")
def update_learning_data(word_id: int, data: schemas.LearningDataBase, db: Session = Depends(get_db)):
    """
    更新单词的学习数据。
    """
    word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")
    try:
        if word.learning_data:
            learning_data = word.learning_data
            learning_data.error_count = data.error_count
            learning_data.consecutive_correct = data.consecutive_correct
            learning_data.is_difficult = data.is_difficult
            learning_data.last_reviewed = data.last_reviewed
            learning_data.next_review = data.next_review
        else:
            learning_data = models.LearningData(
                word_id=word_id,
                error_count=data.error_count,
                consecutive_correct=data.consecutive_correct,
                is_difficult=data.is_difficult,
                last_reviewed=data.last_reviewed,
                next_review=data.next_review
            )
            db.add(learning_data)
        # 根据 consecutive_correct 更新 is_learned
        word.is_learned = data.consecutive_correct >= 5
        db.commit()
        db.refresh(word)
        return {"message": "学习数据已更新"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")

@router.post("/{word_id}/add-to-review")
def add_to_review(word_id: int, db: Session = Depends(get_db)):
    """
    将单词添加到复习库。
    """
    word = db.query(models.Word).filter(models.Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词未找到")
    try:
        word.is_learned = True
        if word.learning_data:
            word.learning_data.last_reviewed = db.func.now()
            word.learning_data.next_review = db.func.now() + db.text("INTERVAL '1 day'")
        else:
            learning_data = models.LearningData(
                word_id=word_id,
                last_reviewed=db.func.now(),
                next_review=db.func.now() + db.text("INTERVAL '1 day'")
            )
            db.add(learning_data)
        db.commit()
        db.refresh(word)
        return {"message": "单词已添加到复习库"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")