from openai import OpenAI
import os
import json
import re
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_random_exponential
import difflib

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
        
        short_history = history[-3:] 
        
        prompt = (
            "You are a search query optimizer. The user is asking a question in a chat context.\n"
            "Your goal: Rewrite the 'Current Question' into a standalone, specific search query that includes necessary context from the 'Chat History'.\n"
            "If the question is already specific, return it unchanged.\n"
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
            return data.get("refined_query", current_question)
        except:
            return current_question
        
    def _find_best_match(self, source_text, quote):
        # 1. Try exact match first
        if quote in source_text:
            return quote
            
        # 2. Fuzzy match finding (Handles missed punctuation/spaces)
        matcher = difflib.SequenceMatcher(None, source_text, quote)
        match = matcher.find_longest_match(0, len(source_text), 0, len(quote))
        
        # If we found a decent match (>30 chars), return the real text from source
        if match.size > 30:
            return source_text[match.a : match.a + match.size]
            
        return quote # Fallback to AI's version if retrieval fails

    # --- SOTA STEP 2: LLM RE-RANKING ---
    def rerank_chunks(self, chunks: List[dict], query: str) -> List[dict]:
        if not chunks: return []
        if len(chunks) <= 5: return chunks 
        
        chunk_text = ""
        for i, c in enumerate(chunks):
            # Preview for reranker
            preview = c['content'][:300].replace("\n", " ")
            chunk_text += f"[ID:{i}] {preview}...\n"

        prompt = (
            "You are a Relevance Judge. Select the Top 10 chunks most likely to contain the answer.\n"
            "Return JSON: { \"selected_indices\": [0, 4, 12] }"
        )

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Query: {query}\n\nChunks:\n{chunk_text}"}
        ]

        try:
            response = self.get_answer_with_backoff(messages)
            data = json.loads(response.choices[0].message.content)
            indices = data.get("selected_indices", [])
            selected_chunks = [chunks[i] for i in indices if 0 <= i < len(chunks)]
            if not selected_chunks: return chunks[:5]
            return selected_chunks
        except Exception:
            return chunks[:8]

    def select_relevant_files(self, file_summaries: List[dict], question: str) -> List[str]:
        if not file_summaries: return []
        context = "AVAILABLE FILES:\n"
        for f in file_summaries:
            context += f"- [ID: {f['id']}] Title: {f['title']}\n  Summary: {f['summary'][:300]}...\n\n"

        prompt = (
            "You are a Research Assistant. Select the top 3-4 documents relevant to the question.\n"
            "Return JSON: { \"selected_ids\": [\"id_1\", \"id_2\"] }"
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

    # --- MAIN ANSWER FUNCTION (SOTA UPGRADE) ---
    def get_answer(self, context_chunks: List[dict], question: str, mode: str = "single_doc", history: List[Dict[str, str]] = []) -> Dict[str, Any]:
        
        # 1. Reranking
        final_chunks = context_chunks
        if mode in ["folder_deep", "single_doc"] and len(context_chunks) > 0:
            final_chunks = self.rerank_chunks(context_chunks, question)

        # 2. Build Context String with Explicit IDs
        context_text = ""
        system_prompt = ""

        if mode == "single_doc" or mode == "folder_deep":
            if final_chunks:
                for i, chunk in enumerate(final_chunks):
                    # We inject the LIST INDEX [ID:0], [ID:1] so the LLM can reference it easily
                    page = chunk.get('page', '?')
                    src = chunk.get('source', 'Document')
                    context_text += f"\n[ID: {i}] [Page {page} of {src}] {chunk['content']}\n"
            else:
                context_text = "No specific document context found."

            system_prompt = (
                "You are a Senior Financial Analyst. Answer the user question based ONLY on the provided context.\n"
                "You must return a JSON object with two keys:\n"
                "1. 'answer': A precise, professional answer. Do not mention 'the provided text'—just state the facts.\n"
                "2. 'citations': An array of objects, where each object has:\n"
                "   - 'source_id': The integer ID from the context (e.g. 0, 1) that supports this statement.\n"
                "   - 'quote': A verbatim, 2-3 sentence passage from that chunk. Do not edit the text.\n"
            )

        elif mode == "folder_fast" or mode == "simple":
            # Fast mode logic (Summaries) - simplified
            if final_chunks:
                context_text += "--- FILE SUMMARIES ---\n"
                for i, chunk in enumerate(final_chunks):
                    filename = chunk.get('source', 'Unknown File')
                    context_text += f"[ID: {i}] [File: {filename}] {chunk['content']}\n\n"
            else:
                context_text = "No file summaries found."

            system_prompt = (
                "You are a Digital Librarian. Use the summaries to answer.\n"
                "Return JSON: { 'answer': '...', 'citations': [] }"
            )

        # 3. Chat
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
            
            raw_citations = data.get("citations", [])
            formatted_citations = []
            
            # 4. Verify Citations (The "SOTA" Part)
            if mode != "folder_fast":
                for cit in raw_citations:
                    try:
                        source_id = int(cit.get('source_id', -1))
                        ai_quote = cit.get('quote', '')
                        
                        # Validate ID
                        if source_id < 0 or source_id >= len(final_chunks):
                            continue # invalid hallucinated ID
                            
                        # Get the actual text chunk the AI claimed to use
                        target_chunk = final_chunks[source_id]
                        
                        # Fuzzy Match the quote against the REAL text
                        # This fixes "near miss" quotes
                        real_quote = self._find_best_match(target_chunk['content'], ai_quote)
                        
                        formatted_citations.append({
                            "content": real_quote, # The REAL text from DB, not AI hallucination
                            "page": target_chunk.get('page', 1),
                            "source": target_chunk.get('source', 'Document'),
                            "id": target_chunk.get('id', 0)
                        })
                    except Exception as e:
                        continue # Skip bad citations

            return {"answer": data.get("answer", ""), "citations": formatted_citations}
        except Exception as e:
            print(f"AI Error: {e}")
            return {"answer": "Error generating response.", "citations": []}

    def transcribe_audio(self, audio_file):
        try:
            transcript = self.client.audio.transcriptions.create(model="whisper-1", file=audio_file)
            return transcript.text
        except: return "Error transcribing audio."