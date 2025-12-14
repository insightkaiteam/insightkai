import os
from openai import OpenAI

class OpenAIService:
    def __init__(self):
        # We will set this Key in Render Dashboard in Part 3
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("⚠️ WARNING: OPENAI_API_KEY is not set!")
        self.client = OpenAI(api_key=api_key)

    def get_answer(self, context: str, question: str) -> str:
        if not context:
            return "I can't find the document content."

        # Truncate to save tokens (approx 15k chars)
        safe_context = context[:15000] 

        system_prompt = f"""
        You are a helpful assistant. Answer the user's question based strictly on the document context provided below.
        IMPORTANT: Format all mathematical equations using LaTeX. 
        - Use single $ for inline math (e.g., $E=mc^2$)
        - Use $$ for block math (e.g., $$x = \\frac{{-b}}{{2a}}$$)
        
        Document Context:
        {safe_context}
        """
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error contacting OpenAI: {str(e)}"