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

    # --- NEW: AI SELECTOR FOR DEEP SEARCH ---
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

    # --- MAIN ANSWER FUNCTION ---
    def get_answer(self, context_chunks: List[dict], question: str, system_message_override: Optional[str] = None, mode: str = "simple") -> Dict[str, Any]:
        
        # ====================================================
        # PATH 1: SIMPLE / SINGLE DOC (STRICTLY PRESERVED)
        # ====================================================
        if mode == "simple":
            # 1. Build Context (Original Format)
            context_text = ""
            if context_chunks:
                context_text += "--- SOURCE DOCUMENTS ---\n"
                for i, chunk in enumerate(context_chunks):
                    clean_content = chunk['content'].replace('\n', ' ')
                    context_text += f"[ID:{i}] [Page {chunk.get('page', '?')}] {clean_content}\n\n"
            else:
                context_text = "No specific document context found."

            # 2. Original System Prompt
            system_prompt = (
                "You are a Senior Financial Analyst. Answer the user question based ONLY on the provided context.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A precise, professional answer. Do not mention 'the provided text'—just state the facts.\n"
                "2. 'quotes': An array of strings. Copy the EXACT sentences from the context that support your answer. These will be used for highlighting.\n"
                "   - If you combine multiple facts, include multiple quotes.\n"
                "   - Do NOT modify the quotes. They must match the source text exactly for the highlighter to work.\n"
            )

            user_content = f"{system_message_override or ''}\n\nContext:\n{context_text}\n\nQuestion: {question}"

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ]

            try:
                response = self.get_answer_with_backoff(messages=messages)
                content = response.choices[0].message.content
                data = json.loads(content)
                
                # Format legacy 'quotes' string array into objects
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
        # PATH 2: DEEP FOLDER CHAT (MULTI-FILE SYNTHESIS)
        # ====================================================
        elif mode == "deep_folder":
            # 1. Build Context with FILENAMES
            context_text = ""
            if context_chunks:
                context_text += "--- SELECTED RELEVANT FILES ---\n"
                for i, chunk in enumerate(context_chunks):
                    clean = chunk['content'].replace('\n', ' ')
                    filename = chunk.get('source', 'Unknown File')
                    context_text += f"[ID:{i}] [File: {filename} | Page {chunk.get('page', '?')}] {clean}\n\n"
            else:
                context_text = "No documents found."

            system_prompt = (
                "You are a Senior Research Analyst. You are analyzing chunks from MULTIPLE selected files.\n"
                "Goal: Synthesize information across files to answer the user query.\n"
                "Rules:\n"
                "1. If files contradict, note it.\n"
                "2. When making a claim, try to mention the source file name in your text (e.g. 'According to the Q3 Report...').\n"
                "Return JSON:\n"
                "{ 'answer': '...', 'quotes': ['exact substring match from text'] }"
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"}
            ]

            try:
                response = self.get_answer_with_backoff(messages=messages)
                data = json.loads(response.choices[0].message.content)
                
                raw_quotes = data.get("quotes", [])
                formatted_citations = []
                for q in raw_quotes:
                    best_match = None
                    for c in context_chunks:
                        if q in c['content']:
                            best_match = c
                            break
                    
                    formatted_citations.append({
                        "content": q,
                        "page": best_match.get('page', 1) if best_match else 1,
                        "source": best_match.get('source', 'Unknown') if best_match else "Folder Context"
                    })

                return {"answer": data.get("answer", ""), "citations": formatted_citations}
            except Exception as e:
                print(f"Deep Chat Error: {e}")
                return {"answer": "Error generating analysis.", "citations": []}
        
        return {"answer": "Invalid Mode", "citations": []}

    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except: return "Error transcribing audio."