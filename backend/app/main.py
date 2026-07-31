import json
import time
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models
from app.database import Base, engine, get_db
from app.memory_processor import process_memory
from app.transcription import transcribe_audio


# --------------------------------------------------
# APPLICATION SETUP
# --------------------------------------------------

app = FastAPI(
    title="EcoMind API",
    description="Personal voice memory system powered by AI",
    version="0.1.0",
)


# --------------------------------------------------
# DATABASE SETUP
# --------------------------------------------------

Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# CORS CONFIGURATION
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# AUDIO UPLOAD DIRECTORY
# --------------------------------------------------

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "app": "EcoMind",
        "status": "online",
        "version": "0.1.0",
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "healthy"}


# --------------------------------------------------
# UPLOAD, TRANSCRIBE, ANALYZE, AND SAVE
# --------------------------------------------------

@app.post("/api/v1/voice-notes/upload")
async def upload_voice_note(
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    db: Session = Depends(get_db),
):
    total_start_time = time.time()

    # 1. Generate a unique ID
    file_id = str(uuid4())

    # 2. Determine file extension
    file_extension = Path(audio.filename or "recording.webm").suffix

    # 3. Create file path
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"

    # 4. Read uploaded audio
    file_content = await audio.read()

    # 5. Save audio file
    with open(file_path, "wb") as file:
        file.write(file_content)

    print("\n====================================")
    print("🌱 EcoMind processing started")
    print(f"📁 Audio file: {audio.filename}")
    print(f"🌍 Language: {language}")

    # 6. Transcribe audio
    transcription_start_time = time.time()
    transcript = transcribe_audio(str(file_path), language)
    transcription_time = time.time() - transcription_start_time

    print(f"🎙️ Transcription completed in {transcription_time:.2f} seconds")
    print(f"📝 Transcript length: {len(transcript)} characters")

    # 7. Analyze memory with Llama 3
    memory = process_memory(transcript)

    # 8. Create database record
    voice_note = models.VoiceNote(
        filename=audio.filename,
        audio_path=str(file_path),
        transcription=transcript,
        language=language,
        summary=memory.get("summary", "AI analysis unavailable"),
        topics=json.dumps(memory.get("topics", [])),
        ideas=json.dumps(memory.get("ideas", [])),
        tasks=json.dumps(memory.get("tasks", [])),
        people=json.dumps(memory.get("people", [])),
        projects=json.dumps(memory.get("projects", [])),
    )

    # 9. Save to PostgreSQL
    db.add(voice_note)
    db.commit()
    db.refresh(voice_note)

    total_time = time.time() - total_start_time

    print("💾 Database save completed")
    print(f"⏱️ Total processing time: {total_time:.2f} seconds")
    print("🌱 EcoMind processing completed")
    print("====================================\n")

    # 10. Return result
    return {
        "id": voice_note.id,
        "filename": voice_note.filename,
        "language": voice_note.language,
        "transcription": voice_note.transcription,
        "summary": voice_note.summary,
        "topics": json.loads(voice_note.topics or "[]"),
        "ideas": json.loads(voice_note.ideas or "[]"),
        "tasks": json.loads(voice_note.tasks or "[]"),
        "people": json.loads(voice_note.people or "[]"),
        "projects": json.loads(voice_note.projects or "[]"),
        "created_at": voice_note.created_at,
        "message": (
            "Voice note uploaded, transcribed, analyzed, and saved successfully"
        ),
    }


# --------------------------------------------------
# GET ALL VOICE NOTES
# --------------------------------------------------

@app.get("/api/v1/voice-notes")
def get_voice_notes(
    db: Session = Depends(get_db),
):
    notes = (
        db.query(models.VoiceNote)
        .order_by(models.VoiceNote.created_at.desc())
        .all()
    )

    results = []

    for note in notes:
        results.append(
            {
                "id": note.id,
                "filename": note.filename,
                "audio_path": note.audio_path,
                "language": note.language,
                "transcription": note.transcription,
                "summary": note.summary,
                "topics": json.loads(note.topics or "[]"),
                "ideas": json.loads(note.ideas or "[]"),
                "tasks": json.loads(note.tasks or "[]"),
                "people": json.loads(note.people or "[]"),
                "projects": json.loads(note.projects or "[]"),
                "created_at": note.created_at,
            }
        )

    print(f"📚 Returning {len(results)} memories")
    return results


# --------------------------------------------------
# DELETE A VOICE NOTE
# --------------------------------------------------

@app.delete("/api/v1/voice-notes/{note_id}")
def delete_voice_note(
    note_id: int,
    db: Session = Depends(get_db),
):
    note = (
        db.query(models.VoiceNote)
        .filter(models.VoiceNote.id == note_id)
        .first()
    )

    if not note:
        return {
            "success": False,
            "message": "Memory not found",
        }

    # Clean up the audio file from disk if it exists
    if note.audio_path:
        audio_file = Path(note.audio_path)
        if audio_file.exists():
            try:
                audio_file.unlink()
                print(f"🗑️ Deleted audio file: {note.audio_path}")
            except OSError as e:
                print(f"⚠️ Failed to delete audio file {note.audio_path}: {e}")

    db.delete(note)
    db.commit()

    return {
        "success": True,
        "message": "Memory deleted successfully",
        "id": note_id,
    }
