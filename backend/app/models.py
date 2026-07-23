from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    String,
    Text,
)

from app.database import Base


class VoiceNote(Base):

    __tablename__ = "voice_notes"


    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )


    filename = Column(
        String,
        nullable=False,
    )


    audio_path = Column(
        String,
        nullable=False,
    )


    transcription = Column(
        Text,
        nullable=False,
    )


    language = Column(
        String(10),
        nullable=False,
    )


    summary = Column(
        Text,
        nullable=True,
    )


    topics = Column(
        Text,
        nullable=True,
    )


    ideas = Column(
        Text,
        nullable=True,
    )


    tasks = Column(
        Text,
        nullable=True,
    )


    people = Column(
        Text,
        nullable=True,
    )


    projects = Column(
        Text,
        nullable=True,
    )


    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )