from openai import OpenAI
import os

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def get_answer(self, context: str, question: str) -> str:
        # ... (Your existing chat logic remains the same)
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Use the provided context to answer questions."},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"}
            ]
        )
        return response.choices[0].message.content

    # --- UPDATED METHOD ---
    def transcribe_audio(self, audio_file) -> str:
        transcript = self.client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe",  # <--- CHANGED from "whisper-1"
            file=audio_file,
            response_format="text" # Optional: "json" or "text"
        )
        # Note: If you use response_format="json" (default), use transcript.text
        # If you use response_format="text", transcript is the string itself.
        return transcript