import json

import ollama


MODEL_NAME = "llama3:8b"


def process_memory(transcription: str) -> dict:
    """
    Analyze a voice note transcription
    and extract structured memory information.
    """

    prompt = f"""
You are EcoMind, a personal memory assistant.

Analyze the following voice note:

VOICE NOTE:
{transcription}

Return ONLY valid JSON with exactly this structure:

{{
    "summary": "A concise summary of the voice note",
    "topics": [
        "topic 1",
        "topic 2"
    ],
    "ideas": [
        "important idea 1"
    ],
    "tasks": [
        "task 1"
    ],
    "people": [
        "person 1"
    ],
    "projects": [
        "project 1"
    ]
}}

Rules:

- summary must be a concise sentence
- topics should describe the main subjects
- ideas should contain important thoughts or plans
- tasks should contain actionable tasks
- people should contain mentioned people
- projects should contain mentioned projects
- use empty arrays when nothing applies
- return only valid JSON
"""

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    response_text = response["message"]["content"].strip()

    try:
        return json.loads(response_text)

    except json.JSONDecodeError:

        print(
            "Warning: Ollama returned invalid JSON:"
        )

        print(response_text)

        return {
            "summary": transcription,
            "topics": [],
            "ideas": [],
            "tasks": [],
            "people": [],
            "projects": [],
        }
