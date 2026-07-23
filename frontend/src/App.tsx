import { useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  Trash2,
  Loader2,
  ChevronDown,
  Leaf,
  X,
  Sparkles,
  CheckSquare,
  Lightbulb,
  Users,
  FolderKanban,
} from "lucide-react";
import "./App.css";

const PETAL_COUNT = 48;
const BASE_RADIUS = 64;
const IDLE_AMPLITUDE = 5;
const REST_LENGTH = 14;

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

type MemoryData = {
  summary: string | null;
  topics: string[];
  ideas: string[];
  tasks: string[];
  people: string[];
  projects: string[];
};

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [memory, setMemory] = useState<MemoryData>({
    summary: null,
    topics: [],
    ideas: [],
    tasks: [],
    people: [],
    projects: [],
  });

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

  useEffect(() => {
    const frame = (time: number) => {
      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      let averageLevel = 0;

      for (let i = 0; i < PETAL_COUNT; i++) {
        const petal = petalRefs.current[i];

        if (!petal) {
          continue;
        }

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
        const pulse = analyser ? 1 + averageLevel * 0.12 : 1 + Math.sin(time / 900) * 0.015;

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
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setErrorMessage(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        const url = URL.createObjectURL(audioBlob);

        setAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();

      setIsRecording(true);
      setRecordingTime(0);
      setTranscription(null);

      setMemory({
        summary: null,
        topics: [],
        ideas: [],
        tasks: [],
        people: [],
        projects: [],
      });

      timerRef.current = window.setInterval(() => {
        setRecordingTime((previousTime) => previousTime + 1);
      }, 1000);
    } catch (error) {
      console.error("Microphone access denied:", error);

      setErrorMessage(
        "EcoMind needs microphone access to record. Check your browser permissions and try again."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

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
    if (!audioUrl) {
      return;
    }

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

      const uploadResponse = await fetch(
        "http://127.0.0.1:8000/api/v1/voice-notes/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      const result = await uploadResponse.json();

      setTranscription(result.transcription);

      setMemory({
        summary: result.summary ?? null,
        topics: result.topics ?? [],
        ideas: result.ideas ?? [],
        tasks: result.tasks ?? [],
        people: result.people ?? [],
        projects: result.projects ?? [],
      });

      console.log("EcoMind memory created:", result);
    } catch (error) {
      console.error("Upload error:", error);

      setErrorMessage(
        "Couldn't save that recording. Check your connection and try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl(null);
    setTranscription(null);
    setRecordingTime(0);

    setMemory({
      summary: null,
      topics: [],
      ideas: [],
      tasks: [],
      people: [],
      projects: [],
    });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const hasMemory =
    memory.summary ||
    memory.topics.length > 0 ||
    memory.ideas.length > 0 ||
    memory.tasks.length > 0 ||
    memory.people.length > 0 ||
    memory.projects.length > 0;

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
          {/* LANGUAGE SELECTOR */}
          <div className="language-field">
            <label htmlFor="language">Transcribe in</label>

            <div className="select-wrap">
              <select
                id="language"
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value);
                }}
                disabled={isRecording}
                aria-label="Choose transcription language"
              >
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="select-chevron"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* RECORDER */}
          <div className="recorder">
            <div className="organism-wrap">
              <div className="petal-ring" ref={ringRef}>
                {Array.from({ length: PETAL_COUNT }).map((_, index) => (
                  <div
                    key={index}
                    className="petal"
                    ref={(element) => {
                      petalRefs.current[index] = element;
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

          {/* ERROR */}
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

          {/* RECORDING RESULT */}
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
                      Saving and analyzing…
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

              {/* TRANSCRIPT */}
              {transcription && (
                <div className="transcript">
                  <div className="transcript__label">
                    <Leaf size={14} />
                    Transcript
                  </div>

                  <p>{transcription}</p>
                </div>
              )}

              {/* AI MEMORY */}
              {hasMemory && (
                <div className="memory-section">
                  <div className="memory-header">
                    <Sparkles size={18} />

                    <div>
                      <h2>EcoMind understood</h2>
                      <p>Your voice note has been transformed into memory.</p>
                    </div>
                  </div>

                  {memory.summary && (
                    <div className="memory-block memory-block--summary">
                      <div className="memory-block__label">
                        <Sparkles size={15} />
                        Summary
                      </div>

                      <p>{memory.summary}</p>
                    </div>
                  )}

                  {memory.topics.length > 0 && (
                    <div className="memory-block">
                      <div className="memory-block__label">Topics</div>

                      <div className="memory-tags">
                        {memory.topics.map((topic, index) => (
                          <span key={`${topic}-${index}`} className="memory-tag">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {memory.ideas.length > 0 && (
                    <div className="memory-block">
                      <div className="memory-block__label">
                        <Lightbulb size={15} />
                        Ideas
                      </div>

                      <ul className="memory-list">
                        {memory.ideas.map((idea, index) => (
                          <li key={`${idea}-${index}`}>{idea}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {memory.tasks.length > 0 && (
                    <div className="memory-block">
                      <div className="memory-block__label">
                        <CheckSquare size={15} />
                        Tasks
                      </div>

                      <ul className="memory-list">
                        {memory.tasks.map((task, index) => (
                          <li key={`${task}-${index}`}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {memory.people.length > 0 && (
                    <div className="memory-block">
                      <div className="memory-block__label">
                        <Users size={15} />
                        People
                      </div>

                      <div className="memory-tags">
                        {memory.people.map((person, index) => (
                          <span key={`${person}-${index}`} className="memory-tag">
                            {person}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {memory.projects.length > 0 && (
                    <div className="memory-block">
                      <div className="memory-block__label">
                        <FolderKanban size={15} />
                        Projects
                      </div>

                      <div className="memory-tags">
                        {memory.projects.map((project, index) => (
                          <span
                            key={`${project}-${index}`}
                            className="memory-tag"
                          >
                            {project}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="footnote">
          Recordings stay on this device until you save them to EcoMind.
        </p>
      </main>
    </div>
  );
}

export default App;