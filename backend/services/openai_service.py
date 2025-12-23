from openai import OpenAI, RateLimitError
import os
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_random_exponential

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini"):
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=1000 
        )

    # --- UPDATED TO ACCEPT SYSTEM CONTEXT ---
    def get_answer(self, context_chunks: List[str], question: str, system_message_override: Optional[str] = None) -> str:
        
        # Default System Message
        system_context = "You are a helpful assistant. Use the following context to answer the user's question.\n"
        
        # If there is a manifest (list of files), add it first
        if system_message_override:
            system_context += f"\n{system_message_override}\n"

        if context_chunks:
            system_context += "\n--- RELEVANT TEXT CHUNKS ---\n"
            system_context += "\n---\n".join(context_chunks)
        else:
            system_context += "\n(No specific text matches found in documents for this query. Answer based on general knowledge or the file list above if applicable.)"

        messages = [
            {"role": "system", "content": system_context},
            {"role": "user", "content": question}
        ]

        try:
            response = self.get_answer_with_backoff(messages=messages)
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
    
    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            return transcript.text
        except Exception as e:
            print(f"Whisper Error: {e}")
            return "Error transcribing audio."