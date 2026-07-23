import json
import re
import time

import ollama


MODEL_NAME = "llama3.2:3b"


def extract_json(text: str) -> dict:
    """
    Extract JSON safely from Ollama's response.

    Handles:
    - Pure JSON
    - ```json ... ```
    - Extra text surrounding JSON
    """

    text = text.strip()

    # Remove Markdown code fences
    text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text)
    text = text.strip()

    # Try direct JSON parsing first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find the first JSON object in the response
    match = re.search(r"\{.*\}", text, re.DOTALL)

    if match:
        json_text = match.group(0)

        try:
            return json.loads(json_text)
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("Could not extract valid JSON", text, 0)


def process_memory(transcription: str) -> dict:
    """
    Analyze a voice note transcription and extract structured memory
    information using Llama 3 through Ollama.
    """

    start_time = time.time()

    prompt = f"""
You are EcoMind, an AI personal memory assistant.

Your job is to understand a voice note and convert it into useful structured memory.

IMPORTANT:
The summary MUST NOT copy the transcript.
The summary MUST be shorter than the transcript.
The summary MUST rewrite the main meaning in your own words.

VOICE NOTE:
{transcription}

Return ONLY valid JSON.

Use exactly this structure:

{{
    "summary": "A short rewritten summary of the main meaning",
    "topics": [],
    "ideas": [],
    "tasks": [],
    "people": [],
    "projects": []
}}

Rules:

1. SUMMARY:
   - Rewrite the main meaning in your own words.
   - Keep it concise.
   - Do not copy the transcript.
   - Do not return the entire transcript.
   - Usually use one or two sentences.

2. TOPICS:
   - Extract the main subjects discussed.
   - Use short labels.
   - Example: ["software development", "fitness"]

3. IDEAS:
   - Extract important ideas, thoughts, plans, or insights.
   - Do not repeat the entire transcript.

4. TASKS:
   - Extract only actionable tasks.
   - Write them as clear action items.
   - Example: "Finish the EcoMind backend"

5. PEOPLE:
   - Extract names of people explicitly mentioned.
   - Do not invent names.

6. PROJECTS:
   - Extract projects explicitly mentioned.
   - Do not invent projects.

7. If a category does not apply, return an empty array.

8. Return ONLY valid JSON.
Do not use Markdown.
Do not write explanations before or after the JSON.

VOICE NOTE:
{transcription}
"""

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            format="json",
            options={"temperature": 0.2, "num_ctx": 2048, "num_predict":300,},
        )

        response_text = response["message"]["content"].strip()

        memory = extract_json(response_text)

        # Ensure every expected field exists
        result = {
            "summary": memory.get("summary"),
            "topics": memory.get("topics", []),
            "ideas": memory.get("ideas", []),
            "tasks": memory.get("tasks", []),
            "people": memory.get("people", []),
            "projects": memory.get("projects", []),
        }

        elapsed = time.time() - start_time

        print(f"🧠 Ollama analysis completed in {elapsed:.2f} seconds")

        return result

    except Exception as error:
        elapsed = time.time() - start_time

        print(f"⚠️ Ollama processing failed after {elapsed:.2f} seconds")
        print(f"Error: {error}")

        # Do NOT use the entire transcript as the summary fallback.
        return {
            "summary": "AI analysis could not be completed.",
            "topics": [],
            "ideas": [],
            "tasks": [],
            "people": [],
            "projects": [],
        }