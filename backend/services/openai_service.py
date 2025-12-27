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
        kwargs = {"model": model, "messages": messages, "max_tokens": 1000}
        if json_mode: kwargs["response_format"] = {"type": "json_object"}
        return self.client.chat.completions.create(**kwargs)

    # --- NEW: AI SELECTION FOR DEEP CHAT ---
    def select_relevant_files(self, file_summaries: List[dict], question: str) -> List[str]:
        if not file_summaries: return []
        context = "AVAILABLE FILES:\n"
        for f in file_summaries:
            context += f"- [ID: {f['id']}] Title: {f['title']}\n  Summary: {f['summary'][:300]}...\n\n"

        prompt = (
            "You are a Research Assistant. Select the top 3-4 documents that are most likely to contain the answer to the user's question.\n"
            "Return a JSON object: { \"selected_ids\": [\"id_1\", \"id_2\"] }\n"
            "If no files seem relevant, return an empty list."
        )
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"{context}\n\nQuestion: {question}"}
        ]
        try:
            res = self.get_answer_with_backoff(messages=messages)
            data = json.loads(res.choices[0].message.content)
            return data.get("selected_ids", [])
        except: return []

    def _extract_best_sentence(self, full_text: str, query: str) -> str:
        # Used ONLY for Folder modes
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
        return best_sent.strip()

    # --- MAIN ANSWER FUNCTION ---
    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc", system_message_override: Optional[str] = None) -> Dict[str, Any]:
        
        # ====================================================
        # MODE 1: SINGLE DOCUMENT (EXACT ORIGINAL LOGIC)
        # ====================================================
        if mode == "single_doc":
            context_text = ""
            if context_chunks:
                for i, chunk in enumerate(context_chunks):
                    context_text += f"\n[ID:{i}] [Page {chunk.get('page', '?')}] {chunk['content']}\n"
            else:
                context_text = "No specific document context found."

# --- KEY CHANGE: STRICTER PROMPT ---
            system_prompt = (
                "You are a Senior Research Analyst. You are analyzing excerpts from MULTIPLE selected files.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A synthesized answer based ONLY on the provided text. If files contradict each other, explicitly point this out.\n"
                "2. 'quotes': An array of strings. Copy the EXACT sentences from the context that support your answer.\n"
                "   - Do NOT paraphrase the quotes. They must match the source text exactly for citation linking.\n"
                "   - Do NOT include the [File:...] tags inside the quote string itself.\n"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"}
            ]

            try:
                response = self.get_answer_with_backoff(messages=messages)
                content = response.choices[0].message.content
                data = json.loads(content)
                
                raw_quotes = data.get("quotes", [])
                formatted_citations = []
                for q in raw_quotes:
                    page_num = 1
                    for c in context_chunks:
                        if q in c['content']:
                            page_num = c.get('page', 1)
                            break
                    formatted_citations.append({"content": q, "page": page_num, "source": "Document"})

                return {"answer": data.get("answer", ""), "citations": formatted_citations}
            except Exception as e:
                print(f"AI Error: {e}")
                return {"answer": "Error generating response.", "citations": []}

        # ====================================================
        # MODE 2: FOLDER CHAT (FAST & DEEP)
        # Uses your PREFERRED 'source_indexes' logic
        # ====================================================
        else:
            context_text = ""
            if context_chunks:
                context_text += "--- FOLDER FILES ---\n"
                for i, chunk in enumerate(context_chunks):
                    clean = chunk['content'].replace('\n', ' ')
                    label = "SUMMARY" if chunk.get("type") == "summary" else "FULL TEXT"
                    filename = chunk.get('source', 'Unknown File')
                    context_text += f"[ID:{i}] [{label} of '{filename}'] {clean}\n\n"
            else:
                context_text = "No documents found."

            # Differentiate Persona based on Mode
            if mode == "folder_fast":
                persona = (
                    "You are a Digital Librarian. You have access to high-level SUMMARIES of files.\n"
                    "Goal: Identify which file contains specific info (e.g. 'The power bill is in file X').\n"
                    "Rules: Be concise. Use the summaries to answer."
                )
            else: # folder_deep
                persona = (
                    "You are a Senior Research Analyst. You are analyzing content from MULTIPLE selected files.\n"
                    "Goal: Synthesize information across files.\n"
                    "Rules: Always attribute claims to their specific source filename."
                )


            system_prompt = (
                f"{persona}\n"
                "Using ONLY the provided Source Material, return a JSON object with:\n"
                "1. 'answer': A precise, professional answer. Do not mention 'the provided text'—just state the facts.\n"
                "2. 'source_indexes': A list of integers (e.g. [0, 2]) corresponding to the [ID:x] of the chunks used. Copy the EXACT sentences from the context that support your answer. Do NOT modify the quotes"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"}
            ]

            try:
                response = self.get_answer_with_backoff(messages=messages)
                content = response.choices[0].message.content
                data = json.loads(content)
                
                # Robust Index Parsing from the user's preferred block
                indices = data.get("source_indexes", [])
                valid_indices = []
                for i in indices:
                    try:
                        idx = int(i)
                        if 0 <= idx < len(context_chunks): valid_indices.append(idx)
                    except: continue
                
                final_citations = []
                for idx in sorted(list(set(valid_indices))):
                    chunk = context_chunks[idx]
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

                return {"answer": data.get("answer", ""), "citations": final_citations}
            except Exception as e:
                print(f"Folder Chat Error: {e}")
                return {"answer": "Error generating analysis.", "citations": []}

    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except: return "Error transcribing audio."