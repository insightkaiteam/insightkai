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

    # --- SOTA STEP 1: CONTEXTUAL QUERY REWRITING ---
    def generate_refined_query(self, history: List[Dict[str, str]], current_question: str) -> str:
        if not history:
            return current_question
        
        # Take last 3 turns to maintain context without overloading
        short_history = history[-3:] 
        
        prompt = (
            "You are a search query optimizer. The user is asking a question in a chat context.\n"
            "Your goal: Rewrite the 'Current Question' into a standalone, specific search query that includes necessary context from the 'Chat History'.\n"
            "If the question is already specific, return it unchanged.\n"
            "Example:\n"
            "History: User: 'What about the Q3 report?' AI: 'It shows a loss.'\n"
            "Current: 'Who signed it?'\n"
            "Output: 'Who signed the Q3 report?'\n\n"
            "Return JSON: { \"refined_query\": \"...\" }"
        )
        
        history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in short_history])
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Chat History:\n{history_text}\n\nCurrent Question: {current_question}"}
        ]
        
        try:
            response = self.get_answer_with_backoff(messages)
            data = json.loads(response.choices[0].message.content)
            print(f"Refined Query: {data.get('refined_query')}") # Debug log
            return data.get("refined_query", current_question)
        except:
            return current_question

    # --- SOTA STEP 2: LLM RE-RANKING ---
    def rerank_chunks(self, chunks: List[dict], query: str) -> List[dict]:
        if not chunks: return []
        if len(chunks) <= 5: return chunks # No need to rerank few chunks
        
        # Prepare chunks for the LLM
        chunk_text = ""
        for i, c in enumerate(chunks):
            # We use the first 200 chars as a preview for the reranker to save tokens
            preview = c['content'][:300].replace("\n", " ")
            chunk_text += f"[ID:{i}] {preview}...\n"

        prompt = (
            "You are a Relevance Judge. You will receive a Search Query and a list of Content Chunks.\n"
            "Goal: Select the Top 10 chunks that are most likely to contain the answer to the query.\n"
            "Rules:\n"
            "1. Prioritize chunks with specific facts (dates, numbers, names) related to the query.\n"
            "2. Ignore generic or navigational text.\n"
            "Return JSON: { \"selected_indices\": [0, 4, 12, ...] }"
        )

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Query: {query}\n\nChunks:\n{chunk_text}"}
        ]

        try:
            response = self.get_answer_with_backoff(messages)
            data = json.loads(response.choices[0].message.content)
            indices = data.get("selected_indices", [])
            
            # Filter and return the full chunks based on selected indices
            selected_chunks = [chunks[i] for i in indices if 0 <= i < len(chunks)]
            
            # Fallback: if model returns nothing, take top 5 original
            if not selected_chunks: return chunks[:5]
            
            return selected_chunks
        except Exception as e:
            print(f"Rerank Error: {e}")
            return chunks[:8] # Fallback to top 8 on error

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

    # --- MAIN ANSWER FUNCTION ---
    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc", history: List[Dict[str, str]] = []) -> Dict[str, Any]:
        
        # 1. OPTIONAL: RERANKING (For Deep/Doc modes only)
        final_chunks = context_chunks
        if mode in ["folder_deep", "single_doc"] and len(context_chunks) > 0:
            final_chunks = self.rerank_chunks(context_chunks, question)

        # 2. BUILD PROMPT
        context_text = ""
        system_prompt = ""

        if mode == "single_doc":
            if final_chunks:
                for i, chunk in enumerate(final_chunks):
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
            # Fast mode uses Summaries, no reranking needed typically
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

        elif mode == "folder_deep":
            if final_chunks:
                context_text += "--- SELECTED FILE CONTENTS ---\n"
                for i, chunk in enumerate(final_chunks):
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
                "   - BE COMPREHENSIVE. Use 5-7 quotes if possible to support claims from different files.\n"
                "   - Do NOT include [File:...] tags in the quote string.\n"
                "   - Do NOT paraphrase. Exact substrings only.\n"
            )

        # 3. CONSTRUCT MESSAGES WITH HISTORY
        messages = [{"role": "system", "content": system_prompt}]

        if history:
            for msg in history[-6:]:
                role = "user" if msg.get("role") == "user" else "assistant"
                messages.append({"role": role, "content": msg.get("content", "")})

        messages.append({"role": "user", "content": f"Context:\n{context_text}\n\nQuestion: {question}"})

        try:
            response = self.get_answer_with_backoff(messages=messages)
            content = response.choices[0].message.content
            data = json.loads(content)
            
            raw_quotes = data.get("quotes", [])
            formatted_citations = []
            
            if mode != "folder_fast":
                for q in raw_quotes:
                    best_match = None
                    # Search within our filtered chunks first
                    for c in final_chunks:
                        if q in c['content']:
                            best_match = c
                            break
                    # Fuzzy fallback
                    if not best_match:
                        norm_q = self._normalize(q)
                        for c in final_chunks:
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