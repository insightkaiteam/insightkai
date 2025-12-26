from openai import OpenAI
import os
import re
from typing import List, Optional, Dict, Any
from tenacity import retry, stop_after_attempt, wait_random_exponential

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini"):
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3, # Low temp for strict ID adherence
            max_tokens=1000 
        )

    def get_answer(self, context_chunks: List[dict], question: str, system_message_override: Optional[str] = None) -> Dict[str, Any]:
        
        # 1. Build Indexed Context
        # We assign a temporary ID [0], [1] to each chunk for this specific chat turn.
        context_text = ""
        if context_chunks:
            context_text += "--- SOURCE DOCUMENTS ---\n"
            for i, chunk in enumerate(context_chunks):
                # We strip newlines for the prompt readability, but keep the original content in memory
                clean_content = chunk['content'].replace('\n', ' ')
                context_text += f"[ID:{i}] {clean_content}\n\n"
        else:
            context_text = "No documents found."

        # 2. Strict Citation Prompt
        system_prompt = (
            "You are a Senior Financial Analyst. Answer the question using ONLY the provided Source Documents.\n"
            "CRITICAL CITATION RULES:\n"
            "1. Every single claim you make must be immediately followed by a citation ID like [0], [1], etc.\n"
            "2. Do NOT write out the source name or page number. Just use the [ID].\n"
            "3. If you combine information from multiple sources, cite all of them: [0][2].\n"
            "4. Do not invent information. If the answer is not in the sources, say 'Data not available'."
        )

        user_content = f"{system_message_override or ''}\n\n{context_text}\n\nQuestion: {question}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            response = self.get_answer_with_backoff(messages=messages)
            raw_answer = response.choices[0].message.content
            
            # 3. Parse Citations from the Answer
            # We extract all [0], [1] tags to build the evidence list
            citation_indices = set()
            matches = re.findall(r'\[(\d+)\]', raw_answer)
            for m in matches:
                if m.isdigit():
                    idx = int(m)
                    if 0 <= idx < len(context_chunks):
                        citation_indices.add(idx)
            
            # 4. Resolve Indices to Original Data
            # We return the RAW DB text. This ensures that even if the text has OCR errors 
            # (e.g. "lnvestment"), we send that exact string to the browser so highlighting works.
            final_citations = []
            for idx in sorted(citation_indices):
                chunk = context_chunks[idx]
                final_citations.append({
                    "page": chunk.get("page", 1),
                    "source": chunk.get("source", "Unknown"),
                    "content": chunk["content"], # RAW TEXT for perfect highlighting
                    "id": idx
                })

            # Optional: Remove the [0] tags from the user-facing answer if you want it cleaner,
            # or keep them so the user knows which sentence maps to which card.
            # For now, we keep them as they act as visual anchors.
            return {
                "answer": raw_answer,
                "citations": final_citations
            }

        except Exception as e:
            print(f"AI Error: {e}")
            return {"answer": "Error generating analysis.", "citations": []}

    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except Exception as e:
            return "Error transcribing audio."