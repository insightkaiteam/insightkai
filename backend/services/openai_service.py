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
    def get_answer(self, context_chunks: List[Dict[str, Any]], question: str) -> str:
        
        # Scenario A: No Context found
        if not context_chunks:
            return "I couldn't find any relevant information in your documents to answer that question."

        # Scenario B: Text-Based RAG (SOTA Approach)
        # 1. Build the Context String
        context_text = ""
        for chunk in context_chunks:
            # Handle both Folder search (has 'document_name') and Doc search (might not)
            source = chunk.get('document_name', 'Current Document')
            page = chunk.get('page_number', '?')
            content = chunk.get('content', '') # This is the Markdown from Mistral
            
            context_text += f"\n--- SOURCE: {source} (Page {page}) ---\n{content}\n"

        # 2. Construct the Prompt
        system_prompt = (
            "You are an expert research assistant. Answer the user's question using ONLY the provided context.\n"
            "GUIDELINES:\n"
            "1. Use the provided Markdown context to answer.\n"
            "2. CITE YOUR SOURCES. Every claim must be followed by [Page X].\n"
            "3. If the answer involves a table, format it as a Markdown table.\n"
            "4. If the answer is not in the context, say so."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"CONTEXT:\n{context_text}\n\nUSER QUESTION: {question}"}
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