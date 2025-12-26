import os
import io
import uuid
import json
from typing import List, Any
from mistralai import Mistral
from mistralai.extra import response_format_from_pydantic_model
from openai import OpenAI
from supabase import create_client, Client
from pydantic import BaseModel, Field

# --- SCHEMA DEFINITION (Unchanged) ---
class VisualContext(BaseModel):
    image_description: str = Field(..., description="Detailed description of the image visual content.")
    data_extraction: str = Field(..., description="If this is a chart/table, transcribe the key numbers, axis labels, and trends. If a diagram, describe the flow.")
    comparative_analysis: str = Field(..., description="What is the key takeaway or insight from this figure?")

class MistralEngine:
    def __init__(self):
        url: str = os.environ.get("SUPABASE_URL")
        key: str = os.environ.get("SUPABASE_KEY")
        self.supabase: Client = create_client(url, key)
        self.openai = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        api_key = os.environ.get("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY is missing!")
        self.client = Mistral(api_key=api_key)

    def get_embedding(self, text: str) -> List[float]:
        text = text.replace("\n", " ")
        return self.openai.embeddings.create(input=[text], model="text-embedding-3-small").data[0].embedding

    # --- UNCHANGED: SUMMARY GENERATOR ---
    def _generate_summary(self, full_text: str) -> str:
        try:
            preview_text = full_text[:8000]
            system_prompt = (
                "You are a sophisticated document analyzer. Analyze the text and return a summary in EXACTLY this format:\n\n"
                "[TAG]: <Classify into one: INVOICE, RESEARCH, FINANCIAL, LEGAL, RECEIPT, OTHER>\n"
                "[DESC]: <A single, concise sentence describing the file (e.g. 'August 2023 Power Bill for $150')>\n"
                "[DETAILED]: <A dense, 5-10 line summary containing specific entities (company names, authors), dates, key outcomes, core themes, and numerical data. This will be used for search retrieval, so be specific.>"
            )
            response = self.openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this document content:\n\n{preview_text}"}
                ],
                max_tokens=300
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Summary Generation Error: {e}")
            return "[TAG]: OTHER\n[DESC]: Processed document.\n[DETAILED]: No summary available."

    # --- UNCHANGED: FOLDER MANIFEST ---
    def get_folder_manifest(self, folder_name: str) -> str:
        try:
            res = self.supabase.table("documents").select("title, summary").eq("folder", folder_name).execute()
            if not res.data:
                return "This folder is empty."

            manifest = f"### 📂 FOLDER CONTENT MANIFEST ({len(res.data)} files):\n"
            
            for doc in res.data:
                raw_summary = doc.get('summary') or ""
                clean_summary = raw_summary.split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").strip()
                if not clean_summary: clean_summary = "[TAG]: FILE\n[DESC]: Unknown content."
                manifest += f"📄 **FILENAME: {doc['title']}**\n{clean_summary}\n\n---\n"
            
            return manifest
        except Exception as e:
            return f"Error fetching folder manifest: {e}"

    # --- UNCHANGED: SINGLE DOC SEARCH ---
    def search_single_doc(self, query: str, doc_id: str) -> List[dict]:
        """
        Returns structured chunks with page numbers for highlighting.
        """
        query_vector = self.get_embedding(query)
        params = {"query_embedding": query_vector, "match_threshold": 0.01, "match_count": 8, "filter_doc_id": doc_id}
        try:
            res = self.supabase.rpc("match_page_sections", params).execute()
            return [
                {
                    "content": row['content'], 
                    "page": row.get('page_number', 1),
                    "similarity": row.get('similarity', 0)
                } 
                for row in res.data if row.get('content')
            ]
        except Exception as e:
            print(f"Search Error: {e}")
            return []

    # ==========================================
    # 🚀 NEW: FAST FOLDER SEARCH (Summaries Only)
    # ==========================================
    def search_folder_fast(self, query: str, folder_name: str) -> List[dict]:
        """
        Searches ONLY the document summaries (TAG, DESC, DETAILED). 
        Used for quick metadata lookups like 'Where is the August bill?'
        """
        query_vector = self.get_embedding(query)
        params = {
            "query_embedding": query_vector,
            "match_threshold": 0.1, # Higher threshold for relevance
            "match_count": 5,        # Only need top 5 matches
            "filter_folder": folder_name
        }
        try:
            # ⚠️ Calls the NEW SQL function 'match_document_summaries'
            response = self.supabase.rpc("match_document_summaries", params).execute()
            
            results = []
            for row in response.data:
                # We format the summary as the "Content" so the AI reads the summary
                clean_summary = row['summary'].split("---_SEPARATOR_---")[0].replace("**Content Summary:**", "").strip()
                results.append({
                    "content": f"**FILE MATCH: {row['title']}**\n{clean_summary}", 
                    "page": 1, # Metadata always points to page 1
                    "source": row['title'],
                    "similarity": row.get('similarity', 0)
                })
            return results
        except Exception as e:
            print(f"Fast Search Error: {e}")
            return []

    # ==========================================
    # 🚀 NEW: DEEP FOLDER SEARCH (Two-Step)
    # ==========================================
    def search_folder_deep(self, query: str, folder_name: str) -> List[dict]:
        """
        Step 1: Find top 4 relevant FILES using summary search.
        Step 2: Find top chunks ONLY from those files.
        """
        try:
            # Step 1: Identify relevant docs
            query_vector = self.get_embedding(query)
            
            # Using summary search to pick the best files
            params_summary = {
                "query_embedding": query_vector,
                "match_threshold": 0.1, 
                "match_count": 4, # Pick top 4 most relevant files
                "filter_folder": folder_name
            }
            summary_res = self.supabase.rpc("match_document_summaries", params_summary).execute()
            
            if not summary_res.data:
                return []
            
            # Extract IDs of the top files
            target_doc_ids = [row['id'] for row in summary_res.data]
            
            # Step 2: Search for chunks WITHIN these docs
            # We need a new RPC or we can loop. Since it's only 4 docs, looping is actually fine and safer given RPC limits.
            # But efficiently, let's use a filter on the existing 'match_documents_hybrid' if possible?
            # Actually, standard vector search across folder is fine, but we will filter results in Python
            # OR better: iterate the top 4 docs and get top 3 chunks from EACH.
            
            aggregated_chunks = []
            
            for doc_id in target_doc_ids:
                # Re-use single doc search logic for these specific files
                # This ensures we get high quality "Analysis" chunks
                doc_chunks = self.search_single_doc(query, doc_id)
                
                # Take top 3 chunks from this file
                for chunk in doc_chunks[:3]:
                    # Append file title to content so AI knows context
                    file_title = next((item['title'] for item in summary_res.data if item['id'] == doc_id), "Unknown File")
                    chunk['content'] = f"[Source File: {file_title}]\n{chunk['content']}"
                    chunk['source'] = file_title
                    aggregated_chunks.append(chunk)
            
            # Sort all chunks by similarity (if available) or just return list
            # Since search_single_doc sorts by relevance, we have a list of (Top chunks of Doc A) + (Top chunks of Doc B)...
            return aggregated_chunks

        except Exception as e:
            print(f"Deep Search Error: {e}")
            return []

    # --- UPDATED: PROCESSING TO SAVE SUMMARY EMBEDDING ---
    async def process_pdf_background(self, doc_id: str, file_bytes: bytes, filename: str, folder: str):
        try:
            print(f"[{doc_id}] Starting Mistral Native OCR (Latest) for {filename}...")
            self.supabase.storage.from_("document-pages").upload(file=file_bytes, path=f"{doc_id}/source.pdf", file_options={"content-type": "application/pdf"})
            uploaded_file = self.client.files.upload(file={"file_name": filename, "content": file_bytes}, purpose="ocr")
            signed_url = self.client.files.get_signed_url(file_id=uploaded_file.id, expiry=1)
            
            ocr_response = self.client.ocr.process(
                document={"type": "document_url", "document_url": signed_url.url},
                model="mistral-ocr-latest", include_image_base64=True, 
                bbox_annotation_format=response_format_from_pydantic_model(VisualContext)
            )

            full_document_text = ""
            manifest_log = f"**🔍 Extraction Verification Log: {filename}**\n\n"
            
            for i, page in enumerate(ocr_response.pages):
                page_num = i + 1
                markdown = page.markdown
                visual_section = ""
                image_count_on_page = 0
                
                if page.images:
                    for j, img in enumerate(page.images):
                        image_count_on_page += 1
                        figure_id = f"Figure {page_num}-{image_count_on_page}"
                        annotation_data = None
                        raw_ann = getattr(img, 'image_annotation', None)
                        if raw_ann:
                            if isinstance(raw_ann, str):
                                try: annotation_data = json.loads(raw_ann)
                                except: annotation_data = {"image_description": raw_ann}
                            else: annotation_data = raw_ann
                        
                        if annotation_data:
                            if isinstance(annotation_data, dict):
                                desc = annotation_data.get('image_description', 'N/A')
                                data_pts = annotation_data.get('data_extraction', 'N/A')
                                analysis = annotation_data.get('comparative_analysis', 'N/A')
                            else:
                                desc = getattr(annotation_data, 'image_description', 'N/A')
                                data_pts = getattr(annotation_data, 'data_extraction', 'N/A')
                                analysis = getattr(annotation_data, 'comparative_analysis', 'N/A')

                            visual_section += (f"\n> **[{figure_id} Analysis]**\n> - **Visual:** {desc}\n> - **Data:** {data_pts}\n> - **Insight:** {analysis}\n")
                            manifest_log += f"- **Page {page_num}**: Found {figure_id}. Data: *\"{str(data_pts)[:50]}...\"*\n"

                enriched_content = f"**[Page {page_num}]**\n{markdown}\n"
                if visual_section: enriched_content += "\n### 📊 Visual Data Extracted:\n" + visual_section

                if len(full_document_text) < 15000:
                    full_document_text += enriched_content + "\n"

                chunks = self._chunk_markdown(enriched_content)
                for chunk in chunks:
                    if not chunk.strip(): continue
                    vector = self.get_embedding(chunk)
                    self.supabase.table("document_pages").insert({
                        "document_id": doc_id, "page_number": page_num, "folder": folder,
                        "content": chunk, "embedding": vector, "title": filename, "image_url": ""
                    }).execute()

            # --- GENERATE AND SAVE SUMMARY ---
            content_summary = self._generate_summary(full_document_text)
            final_summary_field = f"**Content Summary:** {content_summary}\n\n---_SEPARATOR_---\n\n{manifest_log}\n✅ **Extraction Complete.**"
            
            # 🚀 NEW: Generate Embedding for the Summary
            summary_vector = self.get_embedding(content_summary)
            
            self.supabase.table("documents").update({
                "status": "ready", 
                "summary": final_summary_field,
                "summary_embedding": summary_vector # 🚀 Save Vector
            }).eq("id", doc_id).execute()
            
            print(f"[{doc_id}] Success. Summary Generated & Embedded.")

        except Exception as e:
            print(f"[{doc_id}] FAILED: {e}")
            self.supabase.table("documents").update({"status": "failed"}).eq("id", doc_id).execute()

    def _chunk_markdown(self, text: str) -> List[str]:
        chunks = []
        current_chunk = ""
        lines = text.split('\n')
        for line in lines:
            if line.strip().startswith("#") and len(current_chunk) > 600:
                chunks.append(current_chunk.strip()); current_chunk = line + "\n"
            else: current_chunk += line + "\n"
            if len(current_chunk) > 3500: chunks.append(current_chunk.strip()); current_chunk = ""
        if current_chunk: chunks.append(current_chunk.strip())
        return chunks

    def get_documents(self):
        try:
            res = self.supabase.table("documents").select("*").order("created_at", desc=True).execute()
            return [{
                "id": r['id'], "title": r.get('title','Untitled'), "folder": r.get('folder','General'),
                "status": r.get('status','ready'), "summary": r.get('summary',''),
                "upload_date": r['created_at'].split("T")[0] if r.get('created_at') else "N/A"
            } for r in res.data]
        except: return []

    def delete_document(self, doc_id: str):
        self.supabase.table("document_pages").delete().eq("document_id", doc_id).execute()
        self.supabase.table("documents").delete().eq("id", doc_id).execute()

    def debug_document(self, doc_id: str):
        try:
            doc = self.supabase.table("documents").select("*").eq("id", doc_id).execute().data[0]
            pages = self.supabase.table("document_pages").select("page_number, content").eq("document_id", doc_id).limit(3).execute()
            return {"status": doc['status'], "preview": [p['content'][:300] for p in pages.data]}
        except Exception as e: return {"error": str(e)}

    def debug_search(self, doc_id: str, query: str):
        try:
            query_vector = self.get_embedding(query)
            params = {"query_embedding": query_vector, "match_threshold": 0.01, "match_count": 3, "filter_doc_id": doc_id}
            res = self.supabase.rpc("match_page_sections", params).execute()
            return {"query": query, "chunks_found": len(res.data), "preview": res.data[0]['content'][:200] if res.data else "None"}
        except Exception as e: return {"error": str(e)}