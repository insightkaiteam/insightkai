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
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini", json_mode=True):
        kwargs = {
            "model": model,
            "messages": messages,
            "max_tokens": 1000
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        return self.client.chat.completions.create(**kwargs)

    def _extract_best_sentence(self, full_text: str, query: str) -> str:
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

    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc") -> Dict[str, Any]:
        
        # ====================================================
        # MODE 1: SINGLE DOCUMENT (YOUR EXACT ORIGINAL LOGIC)
        # ====================================================
        if mode == "single_doc":
            # 1. Construct Context Block (Your Original Format)
            context_text = ""
            if context_chunks:
                for i, chunk in enumerate(context_chunks):
                    # We include the page number in the text so the LLM can reference it if needed
                    context_text += f"\n[ID:{i}] [Page {chunk.get('page', '?')}] {chunk['content']}\n"
            else:
                context_text = "No specific document context found."

            # 2. Analyst Persona with STRICT JSON Instructions (Your Original Prompt)
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
                data = json.loads(content)
                
                # To maintain compatibility with main.py which expects "citations",
                # we map your "quotes" strings into a citation object format.
                raw_quotes = data.get("quotes", [])
                formatted_citations = []
                
                # We try to find metadata for these quotes if possible, otherwise just pass the content
                for q in raw_quotes:
                    # Basic metadata matching (Optional improvement, but safe)
                    page_num = 1
                    for c in context_chunks:
                        if q in c['content']:
                            page_num = c.get('page', 1)
                            break
                    
                    formatted_citations.append({
                        "content": q,
                        "page": page_num,
                        "source": "Document"
                    })

                return {
                    "answer": data.get("answer", ""),
                    "citations": formatted_citations 
                }
            except Exception as e:
                print(f"AI Error: {e}")
                return {"answer": "Error generating response.", "citations": []}

        # ====================================================
        # MODE 2: FOLDER CHAT (FAST & DEEP)
        # ====================================================
        else:
            # 1. Build Context (Includes Filenames)
            context_text = ""
            if context_chunks:
                context_text += "--- FOLDER FILES ---\n"
                for i, chunk in enumerate(context_chunks):
                    clean = chunk['content'].replace('\n', ' ')
                    # We distinguish between Summary and Content for the AI
                    label = "SUMMARY" if chunk.get("type") == "summary" else "CONTENT"
                    filename = chunk.get('source', 'Unknown File')
                    context_text += f"[ID:{i}] [{label} of '{filename}'] {clean}\n\n"
            else:
                context_text = "No documents found."

            # 2. Select Persona
            if mode == "folder_fast":
                persona = (
                    "You are a Digital Librarian. You have access to high-level SUMMARIES of files.\n"
                    "Goal: Identify which file contains specific info (e.g. 'The power bill is in file X').\n"
                    "Rules: Be concise. If asked for a detail (like an amount) found in the summary, state it."
                )
            else: # folder_deep
                persona = (
                    "You are a Senior Research Analyst. You are analyzing excerpts from MULTIPLE documents.\n"
                    "Goal: Synthesize information across files. Compare findings.\n"
                    "Rules: Always attribute claims to their specific source filename and give the exact quote from each file."
                )

            system_prompt = (
                f"{persona}\n"
                "Using ONLY the provided Source Material, return a JSON object with:\n"
                "1. 'answer': Your response in markdown.\n"
                "2. 'source_indexes': A list of integers (e.g. [0, 2]) corresponding to the [ID:x] of the chunks used."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"}
            ]

            try:
                response = self.get_answer_with_backoff(messages=messages)
                content = response.choices[0].message.content
                data = json.loads(content)
                
                indices = data.get("source_indexes", [])
                
                # Robust Index Parsing
                valid_indices = []
                for i in indices:
                    try:
                        idx = int(i)
                        if 0 <= idx < len(context_chunks): valid_indices.append(idx)
                    except: continue
                unique_indices = sorted(list(set(valid_indices)))
                
                final_citations = []
                for idx in unique_indices:
                    chunk = context_chunks[idx]
                    
                    # Logic: If summary, show summary snippet. If content, do smart extraction.
                    full_text = chunk["content"]
                    if chunk.get("type") == "summary":
                        tight_quote = full_text[:150] + "..." 
                    else:
                        tight_quote = self._extract_best_sentence(full_text, question)
                    
                    final_citations.append({
                        "page": chunk.get("page", 1),
                        "source": chunk.get("source", "Unknown"),
                        "content": tight_quote,
                        "id": idx
                    })

                return {
                    "answer": data.get("answer", ""),
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