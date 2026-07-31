# 🌱 EcoMind

**EcoMind** is a personal voice-memory system that turns spoken thoughts into structured, searchable memory. Record a voice note, and EcoMind automatically transcribes it, understands it with a local LLM, and extracts the topics, ideas, tasks, people, and projects mentioned — all stored for later recall.

Everything runs locally: speech-to-text via **Faster-Whisper** and understanding via **Llama 3 (Ollama)**, so your voice notes never leave your machine.

---

## ✨ Features

- 🎙️ **In-browser voice recording** — record directly from the web app, no external tools needed
- 📝 **Automatic transcription** — powered by [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper), with GPU acceleration when available
- 🌍 **Multi-language support** — auto-detect, English, Hindi, Punjabi, Arabic, Spanish, French, and German
- 🧠 **AI memory extraction** — a local Llama 3 model (via [Ollama](https://ollama.com)) rewrites each note into a concise summary and pulls out:
  - Topics discussed
  - Ideas, thoughts, and plans
  - Actionable tasks
  - People mentioned
  - Projects mentioned
- ⚡ **Async processing** — upload returns immediately; Whisper + LLM run in the background
- 🔎 **Search & filter** — search past memories and filter to show only notes containing tasks
- 🗂️ **Persistent history** — every note is stored in PostgreSQL (JSONB for structured fields)
- 🗑️ **Memory management** — review and delete saved notes (audio files are cleaned up too)
- 🔒 **Fully local & private** — transcription and AI analysis both run on your own infrastructure

---

## 🏗️ Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite
- Lucide React (icons)
- Native `MediaRecorder` API for in-browser audio capture

**Backend**
- FastAPI (Python) + BackgroundTasks for async jobs
- SQLAlchemy + PostgreSQL (JSONB columns)
- Faster-Whisper for speech-to-text
- Ollama running `llama3.2:3b` for memory extraction

---

## 📁 Project Structure

```
ecomind/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app & API routes
│   │   ├── database.py           # SQLAlchemy engine/session setup
│   │   ├── models.py             # VoiceNote ORM model
│   │   ├── transcription.py      # Faster-Whisper transcription
│   │   └── memory_processor.py   # Ollama/Llama 3 memory extraction
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main application UI
│   │   ├── main.tsx
│   │   └── App.css
│   └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL
- [Ollama](https://ollama.com) installed locally, with the `llama3.2:3b` model pulled:
  ```bash
  ollama pull llama3.2:3b
  ```

### 1. Clone the repository

```bash
git clone https://github.com/Faisal01011/ecomind.git
cd ecomind
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

pip install -r requirements.txt
```

Create a `.env` file in `backend/` with your database connection string:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/ecomind
```

> **Note on schema changes:** If you already have an existing `voice_notes` table from an older version, drop it (or recreate the database) so the new columns (`status`, `error_message`, `updated_at`, and JSONB fields) are created cleanly:
> ```sql
> DROP TABLE IF EXISTS voice_notes;
> ```

Make sure Ollama is running in the background, then start the API server:

```bash
uvicorn app.main:app --reload
```

The backend will be available at `http://127.0.0.1:8000`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The web app will be available at `http://localhost:5173`.

---

## 🔌 API Reference

| Method | Endpoint                          | Description                                              |
|--------|------------------------------------|------------------------------------------------------------|
| GET    | `/`                                | API status check                                          |
| GET    | `/health`                          | Health check                                               |
| POST   | `/api/v1/voice-notes/upload`       | Upload audio → returns immediately (`status: pending`)    |
| GET    | `/api/v1/voice-notes`              | Retrieve all saved voice notes                              |
| GET    | `/api/v1/voice-notes/{note_id}`    | Get a single note (use for status polling)                  |
| DELETE | `/api/v1/voice-notes/{note_id}`    | Delete a voice note + its audio file                        |

**Upload request** (`multipart/form-data`):

| Field      | Type   | Description                                      |
|------------|--------|---------------------------------------------------|
| `audio`    | file   | The recorded audio file                            |
| `language` | string | Language code (`auto`, `en`, `hi`, `pa`, `ar`, `es`, `fr`, `de`) |

**Upload response (immediate):**

```json
{
  "id": 1,
  "filename": "recording.webm",
  "language": "en",
  "status": "pending",
  "transcription": null,
  "summary": null,
  "topics": [],
  "ideas": [],
  "tasks": [],
  "people": [],
  "projects": [],
  "created_at": "2026-07-31T12:00:00",
  "message": "Voice note accepted. Processing started in the background."
}
```

**Status lifecycle:** `pending` → `processing` → `completed` | `failed`

Poll `GET /api/v1/voice-notes/{id}` until `status` is `completed` or `failed`.

---

## 🗺️ Roadmap

- [ ] Update frontend to poll for processing status + show progress
- [ ] Add authentication for multi-user support
- [ ] Export memories to Markdown / Notion / Obsidian
- [ ] Tag-based navigation across topics, people, and projects
- [ ] Proper job queue (Redis / ARQ) for production scale
- [ ] Deploy a hosted demo

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to open an issue or submit a pull request.

## 📄 License

This project is currently unlicensed. Add a license file if you intend to open source this project publicly.

## 👤 Author

**Faisal Fayaz**
- GitHub: [@Faisal01011](https://github.com/Faisal01011)
- LinkedIn: [faisal-fayaz](https://linkedin.com/in/faisal-fayaz)
