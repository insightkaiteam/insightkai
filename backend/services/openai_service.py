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
        user_content = [
            {"type": "text", "text": f"Answer based on these images: {question}"}
        ]

        # Use 'detail: low' to Force-Save tokens (Optional but recommended)
        for img_url in context_images[:5]: 
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": img_url,
                    "detail": "auto" # or change to "low" for cheapest cost
                }
            })

        try:
            # CALL THE WRAPPED FUNCTION
            response = self.get_answer_with_backoff(
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": user_content}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Server is busy (Rate Limit). Please try again in 5 seconds."