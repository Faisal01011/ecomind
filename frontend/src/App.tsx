import { useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import "./App.css";

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [language, setLanguage] = useState("en");
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

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

      timerRef.current = window.setInterval(() => {
        setRecordingTime((previousTime) => previousTime + 1);
      }, 1000);
    } catch (error) {
      console.error("Microphone access denied:", error);

      alert(
        "Please allow microphone access to record audio."
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
  };

  const uploadRecording = async () => {
    if (!audioUrl) {
      return;
    }

    try {
      setIsUploading(true);

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

      console.log("Upload successful:", result);
    } catch (error) {
      console.error("Upload error:", error);

      alert("Failed to upload and transcribe voice note.");
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
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  return (
    <div className="app">
      <header className="header">
        <h1>EcoMind</h1>

        <p>
          Your voice. Your memory.
        </p>
      </header>

      <main className="recorder-container">

        {/* Language Selector */}
        <div className="language-selector">
          <label htmlFor="language">
            Transcription Language
          </label>

          <select
            id="language"
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
            disabled={isRecording}
          >
            <option value="auto">
              Auto Detect
            </option>

            <option value="en">
              English
            </option>

            <option value="hi">
              Hindi
            </option>

            <option value="pa">
              Punjabi
            </option>

            <option value="ar">
              Arabic
            </option>

            <option value="es">
              Spanish
            </option>

            <option value="fr">
              French
            </option>

            <option value="de">
              German
            </option>
          </select>
        </div>

        {/* Recording Circle */}
        <div
          className={`recording-circle ${
            isRecording ? "recording" : ""
          }`}
        >
          <Mic size={48} />
        </div>

        {/* Timer */}
        <div className="timer">
          {formatTime(recordingTime)}
        </div>

        {/* Recording Button */}
        {!isRecording ? (
          <button
            className="record-button"
            onClick={startRecording}
          >
            <Mic size={20} />

            Start Recording
          </button>
        ) : (
          <button
            className="stop-button"
            onClick={stopRecording}
          >
            <Square size={20} />

            Stop Recording
          </button>
        )}

        {/* Audio Preview */}
        {audioUrl && (
          <div className="audio-preview">

            <h2>
              Your Recording
            </h2>

            <audio
              controls
              src={audioUrl}
            />

            {/* Upload Button */}
            <button
              className="upload-button"
              onClick={uploadRecording}
              disabled={isUploading}
            >
              {isUploading
                ? "Transcribing..."
                : "Upload to EcoMind"}
            </button>

            {/* Transcription */}
            {transcription && (
              <div className="transcription">

                <h2>
                  Transcript
                </h2>

                <p>
                  {transcription}
                </p>

              </div>
            )}

            {/* Delete Button */}
            <button
              className="delete-button"
              onClick={deleteRecording}
            >
              <Trash2 size={18} />

              Delete
            </button>

          </div>
        )}

      </main>
    </div>
  );
}

export default App;