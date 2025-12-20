from openai import OpenAI, RateLimitError
import os
from typing import List
from tenacity import retry, stop_after_attempt, wait_random_exponential

class OpenAIService:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # --- THE NEW RETRY WRAPPER ---
    @retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
    def get_answer_with_backoff(self, messages, model="gpt-4o-mini"):
        return self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=500
        )

    def get_answer(self, context_images: List[str], question: str) -> str:

# Scenario A: Normal Chat (No images)
        if not context_images:
            messages = [
                {"role": "system", "content": "You are a helpful AI assistant. Answer the user's question directly."},
                {"role": "user", "content": question}
            ]
# Scenario B: Document Chat (With images)
        else:
            user_content = [
                {"type": "text", "text": f"Answer strictly based on these images: {question}"}
            ]
            # Add images (Limit to 5)
            for img_url in context_images[:5]: 
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": img_url, "detail": "auto"}
                })
            
            messages = [
                {"role": "system", "content": "You are a helpful assistant analyzing PDF images."},
                {"role": "user", "content": user_content}
            ]

        # Call OpenAI (with Retry Wrapper)
        try:
            response = self.get_answer_with_backoff(messages=messages)
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"