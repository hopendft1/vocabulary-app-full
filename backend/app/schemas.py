from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Course Schemas
class CourseBase(BaseModel):
    title: str
    description: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Word Schemas
class WordBase(BaseModel):
    word: str
    pinyin: str
    definition: str
    example: Optional[str] = None
    is_difficult: Optional[bool] = False
    audio_link: Optional[str] = None

class WordCreate(WordBase):
    pass

class Word(WordBase):
    id: int
    course_id: int
    
    class Config:
        from_attributes = True

# Learning Data Schemas
class LearningDataBase(BaseModel):
    error_count: int = 0
    consecutive_correct: int = 0
    is_difficult: bool = False
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None

class LearningDataCreate(LearningDataBase):
    pass

class LearningData(LearningDataBase):
    id: int
    word_id: int
    
    class Config:
        from_attributes = True

# Combined Schemas
class WordWithLearningData(Word):
    learning_data: Optional[LearningData] = None
    
    class Config:
        from_attributes = True

class CourseWithWords(Course):
    words: List[Word] = []
    
    class Config:
        from_attributes = True
