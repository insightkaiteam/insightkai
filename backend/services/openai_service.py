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

    def _normalize(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text).strip().lower()

    # --- UPDATED: Added history parameter ---
    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc", history: List[Dict[str, str]] = []) -> Dict[str, Any]:
        
        # 1. Build Persona & System Prompt
        context_text = ""
        system_prompt = ""

        if mode == "single_doc":
            if context_chunks:
                for i, chunk in enumerate(context_chunks):
                    context_text += f"\n[ID:{i}] [Page {chunk.get('page', '?')}] {chunk['content']}\n"
            else:
                context_text = "No specific document context found."

            system_prompt = (
                "You are a Senior Financial Analyst. Answer the user question based ONLY on the provided context.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A precise, professional answer. Do not mention 'the provided text'—just state the facts.\n"
                "2. 'quotes': An array of strings. Copy the EXACT sentences from the context that support your answer. These will be used for highlighting.\n"
                "   - If you combine multiple facts, include multiple quotes.\n"
                "   - Do NOT modify the quotes. They must match the source text exactly for the highlighter to work.\n"
            )

        elif mode == "folder_fast" or mode == "simple":
            if context_chunks:
                context_text += "--- FILE SUMMARIES ---\n"
                for i, chunk in enumerate(context_chunks):
                    filename = chunk.get('source', 'Unknown File')
                    context_text += f"[ID:{i}] [File: {filename}] {chunk['content']}\n\n"
            else:
                context_text = "No file summaries found."

            system_prompt = (
                "You are a Digital Librarian. You have access to high-level SUMMARIES of files.\n"
                "Goal: Identify which file contains specific info or extract metadata.\n"
                "Rules: Be concise. Use the summaries to answer.\n"
                "Return JSON: { 'answer': '...', 'quotes': [] }"
            )

        elif mode == "folder_deep":
            if context_chunks:
                context_text += "--- SELECTED FILE CONTENTS ---\n"
                for i, chunk in enumerate(context_chunks):
                    filename = chunk.get('source', 'Unknown File')
                    page = chunk.get('page', '?')
                    context_text += f"[ID:{i}] [File: {filename} | Page {page}] {chunk['content']}\n\n"
            else:
                context_text = "No documents found."

            system_prompt = (
                "You are a Senior Research Analyst. You are analyzing excerpts from MULTIPLE selected files.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A synthesized answer based ONLY on the provided text. Point out contradictions if any.\n"
                "2. 'quotes': An array of strings. Copy the EXACT sentences from the context that support your answer.\n"
                "   - BE COMPREHENSIVE. Provide multiple quotes per claim if available.\n"
                "   - Do NOT include [File:...] tags in the quote string.\n"
                "   - Do NOT paraphrase. Exact substrings only.\n"
            )

        # 2. CONSTRUCT MESSAGES WITH HISTORY
        messages = [{"role": "system", "content": system_prompt}]

        # Inject History (Last 6 turns to keep context window manageable)
        if history:
            for msg in history[-6:]:
                # Ensure roles are strictly 'user' or 'assistant'
                role = "user" if msg.get("role") == "user" else "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})

        # Add current user prompt with RAG context
        messages.append({"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"})

        try:
            response = self.get_answer_with_backoff(messages=messages)
            content = response.choices[0].message.content
            data = json.loads(content)
            
            # --- CITATION PROCESSING (Logic remains same) ---
            raw_quotes = data.get("quotes", [])
            formatted_citations = []
            
            # Only process citations for Doc and Deep modes
            if mode != "folder_fast":
                for q in raw_quotes:
                    best_match = None
                    # 1. Exact Match
                    for c in context_chunks:
                        if q in c['content']:
                            best_match = c
                            break
                    # 2. Fuzzy Match
                    if not best_match:
                        norm_q = self._normalize(q)
                        for c in context_chunks:
                            if norm_q in self._normalize(c['content']):
                                best_match = c
                                break

                    formatted_citations.append({
                        "content": q,
                        "page": best_match.get('page', 1) if best_match else 1,
                        "source": best_match.get('source', 'Unknown') if best_match else "Folder",
                        "id": best_match.get('id', 0) if best_match else 0
                    })

            return {"answer": data.get("answer", ""), "citations": formatted_citations}
        except Exception as e:
            print(f"AI Error: {e}")
            return {"answer": "Error generating response.", "citations": []}

    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except: return "Error transcribing audio."