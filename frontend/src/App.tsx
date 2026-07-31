import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Trash2,
  Loader2,
  ChevronDown,
  Leaf,
  X,
  Download,
} from "lucide-react";
import "./App.css";

const PETAL_COUNT = 48;
const BASE_RADIUS = 64;
const IDLE_AMPLITUDE = 5;
const REST_LENGTH = 14;
const API_BASE = "http://127.0.0.1:8000";

const LANGUAGES = [
  { value: "auto", label: "Auto detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "pa", label: "Punjabi" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

interface VoiceNote {
  id: number;
  filename: string;
  audio_path: string;
  language: string;
  status?: string;
  error_message?: string | null;
  transcription: string | null;
  summary: string | null;
  topics: string[] | null;
  ideas: string[] | null;
  tasks: string[] | null;
  people: string[] | null;
  projects: string[] | null;
  created_at: string;
  updated_at?: string;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingNoteId, setProcessingNoteId] = useState<number | null>(null);
  const [language, setLanguage] = useState("en");
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [memories, setMemories] = useState<VoiceNote[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);

  const [selectedMemory, setSelectedMemory] = useState<VoiceNote | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<VoiceNote | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showTasksOnly, setShowTasksOnly] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const petalRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const coreRef = useRef<HTMLButtonElement | null>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const fetchMemories = async () => {
    try {
      setIsLoadingMemories(true);
      const response = await fetch(`${API_BASE}/api/v1/voice-notes`);
      if (!response.ok) throw new Error("Failed to fetch memories");
      const data = await response.json();
      setMemories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load memories:", error);
      setMemories([]);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  const downloadMarkdown = (path: string, filename: string) => {
    const a = document.createElement("a");
    a.href = `${API_BASE}${path}`;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportAllMarkdown = () => {
    downloadMarkdown("/api/v1/voice-notes/export.md", "ecomind-export.md");
  };

  const exportNoteMarkdown = (noteId: number) => {
    downloadMarkdown(
      `/api/v1/voice-notes/${noteId}/export.md`,
      `ecomind-memory-${noteId}.md`
    );
  };

  const pollNoteUntilDone = (noteId: number) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setProcessingNoteId(noteId);

    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/voice-notes/${noteId}`);
        if (!res.ok) return;
        const note: VoiceNote = await res.json();

        setMemories((prev) =>
          prev.map((m) => (m.id === noteId ? { ...m, ...note } : m))
        );

        if (note.status === "completed" || note.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setProcessingNoteId(null);
          setIsUploading(false);

          if (note.status === "completed") {
            setTranscription(note.transcription);
            setSummary(note.summary);
          } else {
            setErrorMessage(
              note.error_message || "Processing failed. Please try again."
            );
          }
          fetchMemories();
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const deleteMemory = async (memoryId: number) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/voice-notes/${memoryId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete memory");
      setMemories((current) => current.filter((m) => m.id !== memoryId));
      if (selectedMemory?.id === memoryId) setSelectedMemory(null);
      setMemoryToDelete(null);
    } catch (error) {
      console.error("Failed to delete memory:", error);
      setErrorMessage("Could not delete this memory.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchMemories(), 0);
    return () => clearTimeout(timer);
  }, []);

  const filteredMemories = memories.filter((memory) => {
    const searchText = searchQuery.toLowerCase().trim();
    const matchesSearch =
      searchText === "" ||
      memory.summary?.toLowerCase().includes(searchText) ||
      memory.transcription?.toLowerCase().includes(searchText) ||
      memory.topics?.some((t) => t.toLowerCase().includes(searchText)) ||
      memory.tasks?.some((t) => t.toLowerCase().includes(searchText)) ||
      memory.ideas?.some((i) => i.toLowerCase().includes(searchText)) ||
      memory.projects?.some((p) => p.toLowerCase().includes(searchText));
    const matchesTasks =
      !showTasksOnly || (memory.tasks && memory.tasks.length > 0);
    return matchesSearch && matchesTasks;
  });

  useEffect(() => {
    const frame = (time: number) => {
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      let averageLevel = 0;

      for (let i = 0; i < PETAL_COUNT; i++) {
        const petal = petalRefs.current[i];
        if (!petal) continue;
        const angle = (360 / PETAL_COUNT) * i;
        let level: number;

        if (analyser && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          const bin = Math.floor(
            (i % (PETAL_COUNT / 2)) * (dataArray.length / (PETAL_COUNT / 2))
          );
          level = dataArray[bin] / 255;
          averageLevel += level;
        } else {
          level =
            0.18 +
            0.14 * Math.sin(time / 900 + (i / PETAL_COUNT) * Math.PI * 2);
        }

        const extra = analyser ? level * 46 : level * IDLE_AMPLITUDE * 4;
        const length = REST_LENGTH + extra;
        const glow = analyser ? 0.35 + level * 0.65 : 0.3;
        petal.style.transform = `
          rotate(${angle}deg)
          translateY(${BASE_RADIUS}px)
          scaleY(${length / REST_LENGTH})
        `;
        petal.style.opacity = String(glow);
      }

      if (analyser && dataArray) {
        averageLevel = averageLevel / PETAL_COUNT;
        rotationRef.current += 0.02 + averageLevel * 0.12;
      } else {
        rotationRef.current += 0.015;
      }

      if (ringRef.current) {
        ringRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
      }
      if (coreRef.current) {
        const pulse = analyser
          ? 1 + averageLevel * 0.12
          : 1 + Math.sin(time / 900) * 0.015;
        coreRef.current.style.setProperty("--pulse", String(pulse));
        coreRef.current.style.setProperty(
          "--glow",
          String(analyser ? 0.4 + averageLevel * 0.9 : 0.25)
        );
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setTranscription(null);
      setSummary(null);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      console.error("Microphone access denied:", error);
      setErrorMessage(
        "EcoMind needs microphone access to record. Check your browser permissions and try again."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  const uploadRecording = async () => {
    if (!audioUrl) return;
    try {
      setIsUploading(true);
      setErrorMessage(null);
      const response = await fetch(audioUrl);
      const audioBlob = await response.blob();
      const formData = new FormData();
      formData.append(
        "audio",
        audioBlob,
        `ecomind-recording-${Date.now()}.webm`
      );
      formData.append("language", language);

      const uploadResponse = await fetch(`${API_BASE}/api/v1/voice-notes/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error("Upload failed");
      const result = await uploadResponse.json();
      await fetchMemories();
      if (result.id) pollNoteUntilDone(result.id);
      else setIsUploading(false);
    } catch (error) {
      console.error("Upload error:", error);
      setErrorMessage(
        "Couldn't save that recording. Check your connection and try again."
      );
      setIsUploading(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscription(null);
    setSummary(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const isProcessing = (memory: VoiceNote) =>
    memory.status === "pending" || memory.status === "processing";

  return (
    <div className="app">
      <div className="grain" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <header className="header">
        <div className="wordmark">
          <span className="wordmark__eco">Eco</span>
          <span className="wordmark__mind">Mind</span>
        </div>
        <p className="tagline">Speak freely. We'll remember it for you.</p>
      </header>

      <main className="stage">
        <div className="panel">
          <div className="language-field">
            <label htmlFor="language">Transcribe in</label>
            <div className="select-wrap">
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isRecording}
              >
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="select-chevron" aria-hidden="true" />
            </div>
          </div>

          <div className="recorder">
            <div className="organism-wrap">
              <div className="petal-ring" ref={ringRef}>
                {Array.from({ length: PETAL_COUNT }).map((_, index) => (
                  <div
                    key={index}
                    className="petal"
                    ref={(el) => {
                      petalRefs.current[index] = el;
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className={`core ${isRecording ? "core--recording" : ""}`}
                ref={coreRef}
                onClick={isRecording ? stopRecording : startRecording}
                aria-pressed={isRecording}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? <Square size={26} /> : <Mic size={30} />}
              </button>
            </div>
            <div className="timer">{formatTime(recordingTime)}</div>
            <p className="status-label">
              {isRecording
                ? "Listening… tap to stop"
                : "Tap the bloom to start recording"}
            </p>
          </div>

          {errorMessage && (
            <div className="banner banner--error" role="alert">
              <span>{errorMessage}</span>
              <button
                type="button"
                className="banner__dismiss"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss message"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {audioUrl && (
            <div className="result-card">
              <div className="result-card__header">
                <h2>Your recording</h2>
                <span className="result-card__duration">
                  {formatTime(recordingTime)}
                </span>
              </div>
              <div className="audio-well">
                <audio controls src={audioUrl} />
              </div>
              <div className="result-actions">
                <button
                  className="btn btn--primary"
                  onClick={uploadRecording}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="spin" />
                      {processingNoteId ? "Processing with AI…" : "Saving…"}
                    </>
                  ) : (
                    "Save to EcoMind"
                  )}
                </button>
                <button className="btn btn--ghost" onClick={deleteRecording}>
                  <Trash2 size={16} />
                  Discard
                </button>
              </div>
              {transcription && (
                <div className="transcript">
                  <div className="transcript__label">
                    <Leaf size={14} />
                    Transcript
                  </div>
                  <p>{transcription}</p>
                </div>
              )}
              {summary && (
                <div className="transcript">
                  <div className="transcript__label">
                    <Leaf size={14} />
                    EcoMind understood
                  </div>
                  <p>{summary}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <section className="memory-library">
          <div className="memory-library__header">
            <div>
              <p className="eyebrow">Your memories</p>
              <h2>Memory Library</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="tasks-button"
                onClick={exportAllMarkdown}
                title="Export all memories as Markdown"
              >
                <Download size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                Export MD
              </button>
              <span className="memory-count">
                {memories.length}{" "}
                {memories.length === 1 ? "memory" : "memories"}
              </span>
            </div>
          </div>

          <div className="memory-toolbar">
            <div className="memory-search">
              <input
                type="text"
                placeholder="Search your memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="tasks-button"
              onClick={() => setShowTasksOnly(!showTasksOnly)}
            >
              {showTasksOnly ? "Show all memories" : "View tasks"}
            </button>
          </div>

          {searchQuery && (
            <p className="search-results-count">
              Showing {filteredMemories.length} of {memories.length} memories
            </p>
          )}

          {isLoadingMemories ? (
            <div className="memory-empty">
              <Loader2 className="spin" size={22} />
              <span>Loading memories...</span>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="memory-empty">
              <Leaf size={24} />
              <p>
                {searchQuery || showTasksOnly
                  ? "No matching memories found."
                  : "Your saved memories will appear here."}
              </p>
              <span>
                {searchQuery || showTasksOnly
                  ? "Try a different search or filter."
                  : "Record something to start building your personal memory."}
              </span>
            </div>
          ) : (
            <div className="memory-list">
              {filteredMemories.map((memory) => (
                <article
                  key={memory.id}
                  className="memory-card"
                  onClick={() => setSelectedMemory(memory)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedMemory(memory);
                  }}
                >
                  <div className="memory-card__top">
                    <div className="memory-card__meta">
                      <span className="memory-card__date">
                        {new Date(memory.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="memory-card__language">
                        {(memory.language || "en").toUpperCase()}
                      </span>
                      {isProcessing(memory) && (
                        <span className="memory-card__language" style={{ opacity: 0.7 }}>
                          PROCESSING
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="memory-card__delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemoryToDelete(memory);
                      }}
                      aria-label="Delete memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <h3 className="memory-card__summary">
                    {isProcessing(memory) ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Loader2 size={16} className="spin" />
                        Processing with AI…
                      </span>
                    ) : (
                      memory.summary || "Untitled memory"
                    )}
                  </h3>

                  {!isProcessing(memory) && memory.topics && memory.topics.length > 0 && (
                    <div className="memory-card__topics">
                      {memory.topics.map((topic) => (
                        <span key={topic} className="topic-pill">{topic}</span>
                      ))}
                    </div>
                  )}

                  {!isProcessing(memory) && memory.tasks && memory.tasks.length > 0 && (
                    <div className="memory-card__section">
                      <p className="memory-card__section-label">TASKS</p>
                      <ul>
                        {memory.tasks.map((task) => (
                          <li key={task}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!isProcessing(memory) && memory.ideas && memory.ideas.length > 0 && (
                    <div className="memory-card__section">
                      <p className="memory-card__section-label">IDEAS</p>
                      <ul>
                        {memory.ideas.map((idea) => (
                          <li key={idea}>{idea}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!isProcessing(memory) && memory.people && memory.people.length > 0 && (
                    <div className="memory-card__section">
                      <p className="memory-card__section-label">PEOPLE</p>
                      <div className="memory-card__chips">
                        {memory.people.map((person) => (
                          <span key={person} className="memory-chip">{person}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isProcessing(memory) && memory.projects && memory.projects.length > 0 && (
                    <div className="memory-card__section">
                      <p className="memory-card__section-label">PROJECTS</p>
                      <div className="memory-card__chips">
                        {memory.projects.map((project) => (
                          <span key={project} className="memory-chip memory-chip--project">
                            {project}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isProcessing(memory) && memory.transcription && (
                    <details
                      className="memory-card__details"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <summary>View transcript</summary>
                      <p>{memory.transcription}</p>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="footnote">
          Recordings stay on this device until you save them to EcoMind.
        </p>
      </main>

      {selectedMemory && (
        <div className="memory-modal" onClick={() => setSelectedMemory(null)}>
          <div
            className="memory-modal__content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="memory-modal__close"
              onClick={() => setSelectedMemory(null)}
              aria-label="Close memory"
            >
              <X size={20} />
            </button>

            <div className="memory-modal__meta">
              <span>
                {new Date(selectedMemory.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>{(selectedMemory.language || "en").toUpperCase()}</span>
            </div>

            <p className="eyebrow">EcoMind understood</p>
            <h2 className="memory-modal__title">
              {isProcessing(selectedMemory)
                ? "Still processing…"
                : selectedMemory.summary || "Untitled memory"}
            </h2>

            {selectedMemory.topics && selectedMemory.topics.length > 0 && (
              <div className="memory-modal__group">
                <p className="memory-modal__label">TOPICS</p>
                <div className="memory-card__topics">
                  {selectedMemory.topics.map((topic) => (
                    <span key={topic} className="topic-pill">{topic}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedMemory.tasks && selectedMemory.tasks.length > 0 && (
              <div className="memory-modal__group">
                <p className="memory-modal__label">TASKS</p>
                <ul className="memory-modal__list">
                  {selectedMemory.tasks.map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedMemory.ideas && selectedMemory.ideas.length > 0 && (
              <div className="memory-modal__group">
                <p className="memory-modal__label">IDEAS</p>
                <ul className="memory-modal__list">
                  {selectedMemory.ideas.map((idea) => (
                    <li key={idea}>{idea}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedMemory.people && selectedMemory.people.length > 0 && (
              <div className="memory-modal__group">
                <p className="memory-modal__label">PEOPLE</p>
                <div className="memory-card__chips">
                  {selectedMemory.people.map((person) => (
                    <span key={person} className="memory-chip">{person}</span>
                  ))}
                </div>
              </div>
            )}

            {selectedMemory.projects && selectedMemory.projects.length > 0 && (
              <div className="memory-modal__group">
                <p className="memory-modal__label">PROJECTS</p>
                <div className="memory-card__chips">
                  {selectedMemory.projects.map((project) => (
                    <span key={project} className="memory-chip memory-chip--project">
                      {project}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedMemory.transcription && (
              <div className="memory-modal__transcript">
                <p className="memory-modal__label">ORIGINAL TRANSCRIPT</p>
                <p>{selectedMemory.transcription}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!isProcessing(selectedMemory) && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => exportNoteMarkdown(selectedMemory.id)}
                >
                  <Download size={16} />
                  Export Markdown
                </button>
              )}
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => setMemoryToDelete(selectedMemory)}
              >
                <Trash2 size={16} />
                Delete memory
              </button>
            </div>
          </div>
        </div>
      )}

      {memoryToDelete && (
        <div
          className="delete-confirm-overlay"
          onClick={() => setMemoryToDelete(null)}
        >
          <div
            className="delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-confirm-icon">
              <Trash2 size={22} />
            </div>
            <p className="eyebrow">Delete memory</p>
            <h2>Are you sure?</h2>
            <p className="delete-confirm-text">
              This memory will be permanently removed from your EcoMind library.
            </p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setMemoryToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => deleteMemory(memoryToDelete.id)}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
