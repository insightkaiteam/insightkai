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
        # Increased max_tokens to 1500 to allow for detailed bullet points
        kwargs = {"model": model, "messages": messages, "max_tokens": 1500}
        if json_mode: kwargs["response_format"] = {"type": "json_object"}
        return self.client.chat.completions.create(**kwargs)

    # --- 1. REFINED QUERY GENERATION ---
    def generate_refined_query(self, history: List[Dict[str, str]], current_question: str) -> str:
        if not history: return current_question
        
        short_history = history[-3:] 
        prompt = (
            "You are a query optimizer. Rewrite the 'Current Question' into a specific, standalone search query using the 'Chat History'.\n"
            "Example: History=['The revenue is $5M'], Current='Why is it low?' -> Output='Why is $5M revenue considered low?'\n"
            "Return JSON: { \"refined_query\": \"...\" }"
        )
        
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in short_history])
        
        try:
            response = self.get_answer_with_backoff([
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Chat History:\n{history_text}\n\nCurrent Question: {current_question}"}
            ])
            data = json.loads(response.choices[0].message.content)
            return data.get("refined_query", current_question)
        except: return current_question

    # --- 2. RE-RANKING (Filter 45 -> Top 20) ---
    def rerank_chunks(self, chunks: List[dict], query: str) -> List[dict]:
        if not chunks: return []
        if len(chunks) <= 5: return chunks 
        
        chunk_text = ""
        for i, c in enumerate(chunks):
            # 300 char preview for re-ranker
            preview = c['content'][:300].replace("\n", " ")
            chunk_text += f"[ID:{i}] {preview}...\n"

        prompt = (
            "You are a Relevance Judge. Select the Top 20 chunks that help answer the query.\n"
            "Prioritize chunks with: specific numbers, dates, names, or explanations.\n"
            "Return JSON: { \"selected_indices\": [0, 4, 12, ...] }"
        )

        try:
            response = self.get_answer_with_backoff([
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Query: {query}\n\nChunks:\n{chunk_text}"}
            ])
            data = json.loads(response.choices[0].message.content)
            indices = data.get("selected_indices", [])
            selected_chunks = [chunks[i] for i in indices if 0 <= i < len(chunks)]
            
            # Fallback if AI returns empty list
            return selected_chunks if selected_chunks else chunks[:10]
        except: return chunks[:15]

    def select_relevant_files(self, file_summaries: List[dict], question: str) -> List[str]:
        if not file_summaries: return []
        context = "AVAILABLE FILES:\n"
        for f in file_summaries:
            context += f"- [ID: {f['id']}] Title: {f['title']}\n  Summary: {f['summary'][:300]}...\n\n"

        prompt = (
            "You are a Research Assistant. Select the top 3-4 documents that are most likely to contain the answer.\n"
            "Return JSON: { \"selected_ids\": [\"id_1\", \"id_2\"] }"
        )
        try:
            res = self.get_answer_with_backoff([
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"{context}\n\nQuestion: {question}"}
            ])
            return json.loads(res.choices[0].message.content).get("selected_ids", [])
        except: return []

    def _normalize(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text).strip().lower()

    # --- MAIN ANSWER FUNCTION (Analyst Mode) ---
    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc", history: List[Dict[str, str]] = []) -> Dict[str, Any]:
        
        # 1. Reranking Step (For Deep/Doc modes)
        final_chunks = context_chunks
        if mode in ["folder_deep", "single_doc"] and len(context_chunks) > 0:
            final_chunks = self.rerank_chunks(context_chunks, question)

        context_text = ""
        system_prompt = ""

        # 2. Build Context
        if mode in ["single_doc", "folder_deep"]:
            if final_chunks:
                context_text += "--- SOURCE MATERIAL ---\n"
                for i, chunk in enumerate(final_chunks):
                    source_label = chunk.get('source', 'Document')
                    context_text += f"[ID:{i}] [Source: {source_label} | Page {chunk.get('page', '?')}] {chunk['content']}\n\n"
            else:
                context_text = "No specific document context found."

            # --- SOTA ANALYST PROMPT ---
            system_prompt = (
                "You are a Senior Financial Analyst. Answer based ONLY on the provided context.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A markdown string formatted strictly as follows:\n"
                "   **Executive Summary**\n"
                "   [A 2-3 sentence high-level summary of the findings]\n\n"
                "   **Key Insights**\n"
                "   - **[Insight Title]:** [Detailed explanation of 2-3 sentences. Explain WHY this matters.]\n"
                "   - **[Insight Title]:** [Detailed explanation...]\n\n"
                "2. 'quotes': An array of strings. Copy the EXACT sentences used to derive the answer.\n"
                "   - Rule: Use CONTEXTUAL QUOTING. Do not just quote a number. Quote the full sentence containing the number so it is verifiable.\n"
                "   - Aim for 5-7 distinct citations if the text supports it.\n"
                "   - Do NOT modify the text inside the quotes."
            )

        elif mode == "folder_fast" or mode == "simple":
            if final_chunks:
                context_text += "--- FILE SUMMARIES ---\n"
                for i, chunk in enumerate(final_chunks):
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

        # 3. Messages & Response
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for msg in history[-6:]:
                role = "user" if msg.get("role") == "user" else "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"})

        try:
            response = self.get_answer_with_backoff(messages=messages)
            data = json.loads(response.choices[0].message.content)
            
            raw_quotes = data.get("quotes", [])
            formatted_citations = []
            
            for ai_quote in raw_quotes:
                best_match = None
                # Match the AI's quote to our source chunks to find the coordinates
                for c in final_chunks:
                    if ai_quote[:30].lower() in c['content'].lower():
                        best_match = c
                        break
                
                if best_match:
                    formatted_citations.append({
                        "content": ai_quote,
                        "page": best_match.get('page', 1),
                        "source": best_match.get('source', 'Document'),
                        "coords": best_match.get('bboxes', []), # NEW: Include coordinates
                        "id": best_match.get('id', 0)
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