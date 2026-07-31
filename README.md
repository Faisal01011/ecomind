# 🌱 EcoMind

**EcoMind** is a personal voice-memory system that turns spoken thoughts into structured, searchable memory. Record a voice note, and EcoMind automatically transcribes it, understands it with a local LLM, and extracts the topics, ideas, tasks, people, and projects mentioned — all stored for later recall.

Everything runs locally: speech-to-text via **Faster-Whisper** and understanding via **Llama 3 (Ollama)**, so your voice notes never leave your machine.

---

## ✨ Features

- 🎙️ **In-browser voice recording** — record directly from the web app, no external tools needed
- 📝 **Automatic transcription** — powered by [Faster-Whisper](https://github.com/SYSTRAN/faster-whisper), with GPU acceleration when available
- 🌍 **Multi-language support** — auto-detect, English, Hindi, Punjabi, Arabic, Spanish, French, and German
- 🧠 **AI memory extraction** — a local Llama 3 model (via [Ollama](https://ollama.com)) rewrites each note into a concise summary and pulls out topics, ideas, tasks, people, and projects
- ⚡ **Async processing** — upload returns immediately; Whisper + LLM run in the background
- 📄 **Markdown export** — single memory or full library (Obsidian / Notion friendly)
- 🔎 **Search & filter** — search past memories and filter to show only notes containing tasks
- 🗂️ **Persistent history** — PostgreSQL with JSONB for structured fields
- 🗑️ **Memory management** — delete notes and clean up audio files on disk
- 🔒 **Fully local & private** — transcription and AI analysis stay on your machine

---

## 🏗️ Architecture & design decisions

```
Browser (React)
    │  record audio (MediaRecorder)
    ▼
FastAPI
    │  POST /upload → save file + create row (status=pending) → return immediately
    │  BackgroundTask
    ▼
Whisper (local STT)  →  Ollama / Llama 3.2 3B (structured extraction)
    │
    ▼
PostgreSQL (JSONB topics/tasks/… + status lifecycle)
```

### Why these choices?

| Decision | Trade-off |
|----------|-----------|
| **Local Whisper + Ollama** | Privacy and offline use; slower than cloud APIs; quality depends on hardware (GPU helps a lot). |
| **FastAPI `BackgroundTasks`** | Zero extra infra for async jobs; fine for a single-user app. Not durable across restarts — upgrade to Redis/ARQ when you need reliability at scale. |
| **Status polling** | Simple for the frontend; WebSockets would be nicer for multi-user real-time. |
| **JSONB columns** | Queryable structured metadata without a separate tags table; good enough until you need normalized relations or full-text search indexes. |
| **Markdown export** | Portable second brain (Obsidian, Notion, plain files) without locking data in the app. |

**Status lifecycle:** `pending` → `processing` → `completed` \| `failed`

---

## 🏗️ Tech Stack

**Frontend:** React 19 + TypeScript, Vite, Lucide React, MediaRecorder API  
**Backend:** FastAPI, SQLAlchemy, PostgreSQL (JSONB), Faster-Whisper, Ollama (`llama3.2:3b`)

---

## 📁 Project Structure

```
ecomind/
├── backend/
│   ├── app/
│   │   ├── main.py               # API routes, background jobs, Markdown export
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── transcription.py
│   │   └── memory_processor.py
│   └── requirements.txt
└── frontend/
    └── src/App.tsx
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+, Node.js 18+, PostgreSQL
- [Ollama](https://ollama.com) with `ollama pull llama3.2:3b`

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
```

`.env`:

```env
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/ecomind
```

If upgrading from an older schema:

```sql
DROP TABLE IF EXISTS voice_notes;
```

```bash
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend && npm install && npm run dev
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API status |
| GET | `/health` | Health check |
| POST | `/api/v1/voice-notes/upload` | Upload → `status: pending` (async) |
| GET | `/api/v1/voice-notes` | List all notes |
| GET | `/api/v1/voice-notes/{id}` | Single note (polling) |
| GET | `/api/v1/voice-notes/{id}/export.md` | Export one note as Markdown |
| GET | `/api/v1/voice-notes/export.md` | Export all completed notes as Markdown |
| DELETE | `/api/v1/voice-notes/{id}` | Delete note + audio file |

**Upload:** `multipart/form-data` with `audio` (file) and `language` (`auto`, `en`, `hi`, `pa`, …).

---

## 🗺️ Roadmap

- [x] Async processing + status polling
- [x] Markdown export
- [ ] Clickable topic / person / project filters
- [ ] Authentication for multi-user support
- [ ] Durable job queue (Redis / ARQ)
- [ ] Postgres full-text search
- [ ] Docker Compose one-command setup
- [ ] Deploy a hosted demo

---

## 🤝 Contributing

Issues and PRs welcome.

## 📄 License

Currently unlicensed — add a license if you open-source publicly.

## 👤 Author

**Faisal Fayaz**  
GitHub: [@Faisal01011](https://github.com/Faisal01011) · LinkedIn: [faisal-fayaz](https://linkedin.com/in/faisal-fayaz)
