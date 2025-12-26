from openai import OpenAI
import os
import json
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_random_exponential

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini"):
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},  # FORCE JSON
            max_tokens=1000 
        )

    def get_answer(self, context_chunks: List[dict], question: str, system_message_override: Optional[str] = None) -> dict:
        
        # 1. Construct Context Block
        context_text = ""
        if context_chunks:
            for i, chunk in enumerate(context_chunks):
                # We include the page number in the text so the LLM can reference it if needed
                context_text += f"\n[ID:{i}] [Page {chunk.get('page', '?')}] {chunk['content']}\n"
        else:
            context_text = "No specific document context found."

        # 2. Analyst Persona with STRICT JSON Instructions
        system_prompt = (
            "You are a Senior Financial Analyst. Answer the user question based ONLY on the provided context.\n"
            "You must return a JSON object with two keys:\n"
            "1. 'answer': A precise, professional answer. Do not mention 'the provided text'—just state the facts.\n"
            "2. 'quotes': An array of strings. Copy the EXACT sentences from the context that support your answer. These will be used for highlighting.\n"
            "   - If you combine multiple facts, include multiple quotes.\n"
            "   - Do NOT modify the quotes. They must match the source text exactly for the highlighter to work.\n"
        )

        user_content = f"Context:\n{context_text}\n\nQuestion: {question}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            response = self.get_answer_with_backoff(messages=messages)
            content = response.choices[0].message.content
            return json.loads(content) # Return Dict: {'answer': '...', 'quotes': ['...']}
        except Exception as e:
            print(f"AI Error: {e}")
            return {"answer": "Error generating response.", "quotes": []}

    def transcribe_audio(self, audio_file):
        # (Keep existing transcription logic)
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except Exception as e:
            return "Error transcribing audio."