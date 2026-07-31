import time
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models
from app.database import Base, SessionLocal, engine, get_db
from app.memory_processor import process_memory
from app.transcription import transcribe_audio


# --------------------------------------------------
# APPLICATION SETUP
# --------------------------------------------------

app = FastAPI(
    title="EcoMind API",
    description="Personal voice memory system powered by AI",
    version="0.2.0",
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


def serialize_note(note: models.VoiceNote) -> dict:
    """Convert a VoiceNote ORM object into an API response dict."""
    return {
        "id": note.id,
        "filename": note.filename,
        "audio_path": note.audio_path,
        "language": note.language,
        "status": note.status,
        "error_message": note.error_message,
        "transcription": note.transcription,
        "summary": note.summary,
        "topics": note.topics or [],
        "ideas": note.ideas or [],
        "tasks": note.tasks or [],
        "people": note.people or [],
        "projects": note.projects or [],
        "created_at": note.created_at,
        "updated_at": note.updated_at,
    }


def process_voice_note_background(note_id: int, audio_path: str, language: str):
    """
    Background worker that runs Whisper + Ollama and updates the DB record.
    Uses its own DB session because the request session is already closed.
    """
    db = SessionLocal()
    try:
        note = db.query(models.VoiceNote).filter(models.VoiceNote.id == note_id).first()
        if not note:
            return

        note.status = "processing"
        db.commit()

        print("\n====================================")
        print(f"🌱 Background processing started for note #{note_id}")
        print(f"📁 Audio file: {audio_path}")
        print(f"🌍 Language: {language}")

        # 1. Transcribe
        transcription_start = time.time()
        transcript = transcribe_audio(audio_path, language)
        print(f"🎙️ Transcription completed in {time.time() - transcription_start:.2f}s")
        print(f"📝 Transcript length: {len(transcript)} characters")

        # 2. Analyze with LLM
        memory = process_memory(transcript)

        # 3. Persist results
        note.transcription = transcript
        note.summary = memory.get("summary", "AI analysis unavailable")
        note.topics = memory.get("topics", [])
        note.ideas = memory.get("ideas", [])
        note.tasks = memory.get("tasks", [])
        note.people = memory.get("people", [])
        note.projects = memory.get("projects", [])
        note.status = "completed"
        note.error_message = None
        db.commit()

        print(f"✅ Note #{note_id} processed successfully")
        print("====================================\n")

    except Exception as e:
        print(f"❌ Background processing failed for note #{note_id}: {e}")
        try:
            note = db.query(models.VoiceNote).filter(models.VoiceNote.id == note_id).first()
            if note:
                note.status = "failed"
                note.error_message = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


# --------------------------------------------------
# ROOT ENDPOINT
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "app": "EcoMind",
        "status": "online",
        "version": "0.2.0",
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "healthy"}


# --------------------------------------------------
# UPLOAD (returns immediately, processing is async)
# --------------------------------------------------

@app.post("/api/v1/voice-notes/upload")
async def upload_voice_note(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    language: str = Form("auto"),
    db: Session = Depends(get_db),
):
    # 1. Generate a unique ID for the file
    file_id = str(uuid4())
    file_extension = Path(audio.filename or "recording.webm").suffix
    file_path = UPLOAD_DIR / f"{file_id}{file_extension}"

    # 2. Save audio to disk
    file_content = await audio.read()
    with open(file_path, "wb") as f:
        f.write(file_content)

    # 3. Create a pending record immediately
    voice_note = models.VoiceNote(
        filename=audio.filename or "recording.webm",
        audio_path=str(file_path),
        language=language,
        status="pending",
        transcription=None,
        summary=None,
        topics=[],
        ideas=[],
        tasks=[],
        people=[],
        projects=[],
    )
    db.add(voice_note)
    db.commit()
    db.refresh(voice_note)

    # 4. Kick off heavy work in the background
    background_tasks.add_task(
        process_voice_note_background,
        voice_note.id,
        str(file_path),
        language,
    )

    print(f"📤 Note #{voice_note.id} accepted — processing in background")

    # 5. Return immediately so the client is not blocked
    return {
        **serialize_note(voice_note),
        "message": "Voice note accepted. Processing started in the background.",
    }


# --------------------------------------------------
# GET ALL VOICE NOTES
# --------------------------------------------------

@app.get("/api/v1/voice-notes")
def get_voice_notes(db: Session = Depends(get_db)):
    notes = (
        db.query(models.VoiceNote)
        .order_by(models.VoiceNote.created_at.desc())
        .all()
    )
    results = [serialize_note(note) for note in notes]
    print(f"📚 Returning {len(results)} memories")
    return results


# --------------------------------------------------
# GET SINGLE VOICE NOTE (for status polling)
# --------------------------------------------------

@app.get("/api/v1/voice-notes/{note_id}")
def get_voice_note(note_id: int, db: Session = Depends(get_db)):
    note = (
        db.query(models.VoiceNote)
        .filter(models.VoiceNote.id == note_id)
        .first()
    )
    if not note:
        return {"success": False, "message": "Memory not found"}
    return serialize_note(note)


# --------------------------------------------------
# DELETE A VOICE NOTE
# --------------------------------------------------

@app.delete("/api/v1/voice-notes/{note_id}")
def delete_voice_note(note_id: int, db: Session = Depends(get_db)):
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
