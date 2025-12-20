from openai import OpenAI
import os
from typing import List

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Updated to accept a LIST of image strings (base64)
    def get_answer(self, context_images: List[str], question: str) -> str:
        
        # 1. Prepare the User Message
        # We start with the text question
        user_content = [
            {"type": "text", "text": f"Here are the pages of a PDF document. Please answer this question based on these images: {question}"}
        ]

        # 2. Append each image to the message
        # (Limit to first 5 pages to avoid token errors if document is large)
        for img_url in context_images: 
                user_content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": img_url,  # Direct URL from Supabase
                        "detail": "auto"
                    }
                })

        # 3. Send to GPT-4o-mini
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. You are analyzing PDF slides/pages provided as images."},
                {"role": "user", "content": user_content}
            ],
            max_tokens=500
        )
        return response.choices[0].message.content

    def transcribe_audio(self, audio_file) -> str:
        transcript = self.client.audio.transcriptions.create(
            model="gpt-4o-mini-transcribe", 
            file=audio_file,
            response_format="text"
        )
        return transcript