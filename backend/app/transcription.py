from faster_whisper import WhisperModel


# Load the model once when the server starts
model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)


def transcribe_audio(
    audio_path: str,
    language: str = "auto"
) -> str:

    transcribe_options = {
        "beam_size": 5
    }

    if language != "auto":
        transcribe_options["language"] = language

    segments, info = model.transcribe(
        audio_path,
        **transcribe_options
    )

    transcript = " ".join(
        segment.text.strip()
        for segment in segments
    )

    return transcript