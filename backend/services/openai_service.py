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

    # --- UPDATED TO ACCEPT DICTIONARY CHUNKS AND ANALYST PERSONA ---
    def get_answer(self, context_chunks: List[dict], question: str, system_message_override: Optional[str] = None) -> str:
        
        # 1. Analyst Persona System Prompt
        system_context = (
            "You are a Senior Financial & Research Analyst. "
            "Your goal is to provide precise, data-driven answers based ONLY on the provided context.\n"
            "Style Guidelines:\n"
            "- Be concise and professional.\n"
            "- Prioritize numerical data, dates, and specific entities.\n"
            "- Do not hedge (e.g., 'The document suggests...'). State facts found in the text.\n"
            "- If the answer is not in the context, state 'Data not found in documents.' clearly.\n"
        )
        
        # 2. Inject Folder Manifest if available
        if system_message_override:
            system_context += f"\n--- GLOBAL CONTEXT (Folder Manifest) ---\n{system_message_override}\n"

        # 3. Inject Context Chunks with Source IDs
        if context_chunks:
            system_context += "\n--- SEARCH RESULTS (Use these to answer) ---\n"
            for i, chunk in enumerate(context_chunks):
                # We label chunks so the AI can verify them, though we don't force it to output [1] tags strictly
                # because we handle citations in the UI via the 'sources' array.
                source_label = f"Page {chunk.get('page', '?')}"
                if 'source' in chunk: source_label += f" ({chunk['source']})"
                
                system_context += f"\n[Result {i+1}] ({source_label}):\n{chunk['content']}\n"
        else:
            system_context += "\n(No specific text matches found. Answer based on general knowledge or the manifest.)"

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