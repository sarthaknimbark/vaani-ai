import os
from groq import Groq
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# with open("services/index.fa", "r", encoding="utf-8") as f:
#     context = f.read()

def generate_response(user_text, context="", conversation_memory=""):
    # Ensure context is not empty
    if not context:
        context = "No context available. Please rephrase your question."
    
    prompt = f"""You are Vaani, Esanad Insurance UAE support. Answer FAST using context only.

Rules:
- Max 2 short sentences, under 280 characters
- Simple voice-friendly words
- If unknown: "Sorry, I don't have that information."
- Use conversation history when relevant

{conversation_memory}

Context:
{context}

Question: {user_text}

Answer:"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=120,
    )

    return response.choices[0].message.content