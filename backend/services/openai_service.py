from openai import OpenAI, RateLimitError
import os
from typing import List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_random_exponential

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini"):
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1000 # Increased for detailed answers
        )

    # Updated to accept List of Dicts (Structured Data)
# Change the signature to accept List[str] which are TEXT chunks
    def get_answer(self, context_chunks: List[str], question: str) -> str:
        
        if not context_chunks:
            # Fallback for empty context
            return "I couldn't find any relevant information in the document."

        # 1. Build Text Context
        # context_chunks is now a list of strings like "**[Page 1]** ...text..."
        system_context = "You are a helpful assistant. Use the following context to answer the user's question.\n\n"
        system_context += "\n---\n".join(context_chunks)

        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": question}
        ]

        try:
            response = self.get_answer_with_backoff(messages=messages)
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
    
    # ... keep transcribe_audio ...

# ... (Keep existing get_answer methods above) ...

    def transcribe_audio(self, audio_file):
        # Calls the Whisper model (speech-to-text)
        try:
            transcript = self.client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            return transcript.text
        except Exception as e:
            print(f"Whisper Error: {e}")
            return "Error transcribing audio."