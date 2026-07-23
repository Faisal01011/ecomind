import time

from faster_whisper import WhisperModel


# --------------------------------------------------
# WHISPER CONFIGURATION
# --------------------------------------------------

MODEL_SIZE = "small"


# --------------------------------------------------
# DETECT DEVICE
# --------------------------------------------------

try:

    import torch

    GPU_AVAILABLE = torch.cuda.is_available()

except ImportError:

    GPU_AVAILABLE = False


if GPU_AVAILABLE:

    DEVICE = "cuda"

    COMPUTE_TYPE = "float16"

else:

    DEVICE = "cpu"

    COMPUTE_TYPE = "int8"


print(
    "🎙️ Loading Whisper model..."
)

print(
    f"🖥️ Device: {DEVICE}"
)

print(
    f"⚙️ Compute type: {COMPUTE_TYPE}"
)


# --------------------------------------------------
# LOAD MODEL ONCE
# --------------------------------------------------

model = WhisperModel(

    MODEL_SIZE,

    device=DEVICE,

    compute_type=COMPUTE_TYPE,

)


print(
    "✅ Whisper model loaded"
)


# --------------------------------------------------
# TRANSCRIPTION FUNCTION
# --------------------------------------------------

def transcribe_audio(

    audio_path: str,

    language: str = "auto",

) -> str:

    start_time = time.time()


    # ----------------------------------------------
    # LANGUAGE HANDLING
    # ----------------------------------------------

    if language == "auto":

        language_code = None

    else:

        language_code = language


    # ----------------------------------------------
    # TRANSCRIBE
    # ----------------------------------------------

    segments, info = model.transcribe(

        audio_path,

        language=language_code,

        beam_size=1,

        best_of=1,

        temperature=0,

        vad_filter=True,

        condition_on_previous_text=False,

    )


    # ----------------------------------------------
    # COMBINE SEGMENTS
    # ----------------------------------------------

    transcript = " ".join(

        segment.text.strip()

        for segment in segments

    )


    elapsed_time = (

        time.time()

        - start_time

    )


    print(

        f"🎙️ Whisper language detected: "
        f"{info.language}"

    )

    print(

        f"🎙️ Whisper transcription time: "
        f"{elapsed_time:.2f} seconds"

    )


    return transcript.strip()