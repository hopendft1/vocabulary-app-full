from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, Float, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    words = relationship("Word", back_populates="course")

class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, index=True)
    pinyin = Column(String)
    definition = Column(Text)
    example = Column(Text, nullable=True)
    audio_link = Column(String, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"))
    
    course = relationship("Course", back_populates="words")
    learning_data = relationship("LearningData", back_populates="word", uselist=False)

class LearningData(Base):
    __tablename__ = "learning_data"

    id = Column(Integer, primary_key=True, index=True)
    word_id = Column(Integer, ForeignKey("words.id"))
    error_count = Column(Integer, default=0)
    consecutive_correct = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    next_review = Column(DateTime, nullable=True)
    is_difficult = Column(Boolean, default=False)
    
    word = relationship("Word", back_populates="learning_data")
