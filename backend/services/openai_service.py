from openai import OpenAI
import os
import json
import re
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
            response_format={"type": "json_object"}, 
            max_tokens=1000 
        )

    def _extract_best_sentence(self, full_text: str, query: str) -> str:
        """
        Extracts the most relevant sentence for the quote card.
        """
        clean_text = full_text.replace('\n', ' ')
        sentences = re.split(r'(?<=[.!?])\s+', clean_text)
        if not sentences: return clean_text[:150]
        
        query_words = set(query.lower().split())
        best_sent = sentences[0]
        max_overlap = 0
        
        for sent in sentences:
            sent_words = set(sent.lower().split())
            overlap = len(query_words.intersection(sent_words))
            if overlap > max_overlap:
                max_overlap = overlap
                best_sent = sent
        
        if len(best_sent) < 20: return clean_text[:150] + "..."
        return best_sent.strip()

    def get_answer(self, context_chunks: List[dict], question: str, system_message_override: Optional[str] = None) -> Dict[str, Any]:
        
        # Build Indexed Context for the AI
        context_text = ""
        if context_chunks:
            context_text += "--- SOURCE MATERIAL ---\n"
            for i, chunk in enumerate(context_chunks):
                clean = chunk['content'].replace('\n', ' ')
                source_label = f" (File: {chunk.get('source', 'Unknown')}, Page {chunk.get('page', '?')})"
                context_text += f"[ID:{i}] {source_label}: {clean}\n\n"
        else:
            context_text = "No documents found."

        system_prompt = (
            "You are a Senior Analyst. Answer the question using ONLY the provided Source Material.\n"
            "Return a JSON object with two keys:\n"
            "1. 'answer': Your detailed response in markdown.\n"
            "2. 'source_indexes': A list of integers (e.g. [0, 2]) corresponding to the [ID:x] of the chunks that support your answer.\n"
            "   - Only cite sources that explicitly support your answer.\n"
            "   - If no sources are relevant, return an empty list."
        )

        user_content = f"{system_message_override or ''}\n\n{context_text}\n\nQuestion: {question}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]

        try:
            response = self.get_answer_with_backoff(messages=messages)
            content = response.choices[0].message.content
            data = json.loads(content)
            
            raw_answer = data.get("answer", "No answer generated.")
            indices = data.get("source_indexes", [])
            
            # Robust Parsing of Indices
            valid_indices = []
            for i in indices:
                try:
                    idx = int(i)
                    if 0 <= idx < len(context_chunks):
                        valid_indices.append(idx)
                except: continue
            
            unique_indices = sorted(list(set(valid_indices)))
            
            final_citations = []
            for idx in unique_indices:
                chunk = context_chunks[idx]
                full_text = chunk["content"]
                tight_quote = self._extract_best_sentence(full_text, question)
                
                final_citations.append({
                    "page": chunk.get("page", 1),
                    "source": chunk.get("source", "Unknown"),
                    "content": tight_quote,     # The smart short quote
                    "raw_text": full_text,      # The full text for robust highlighting
                    "id": idx
                })

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
        except: return "Error transcribing."