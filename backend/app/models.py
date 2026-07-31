from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class VoiceNote(Base):
    __tablename__ = "voice_notes"

    id = Column(Integer, primary_key=True, index=True)

    filename = Column(String, nullable=False)
    audio_path = Column(String, nullable=False)
    language = Column(String(10), nullable=False)

    # Processing lifecycle
    # pending -> processing -> completed | failed
    status = Column(String(20), nullable=False, default="pending", index=True)
    error_message = Column(Text, nullable=True)

    transcription = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)

    # Structured extraction fields stored as native JSONB
    topics = Column(JSONB, nullable=True, default=list)
    ideas = Column(JSONB, nullable=True, default=list)
    tasks = Column(JSONB, nullable=True, default=list)
    people = Column(JSONB, nullable=True, default=list)
    projects = Column(JSONB, nullable=True, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
