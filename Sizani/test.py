import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

# Load environment variables from .env file
load_dotenv()

class SanityCheck(BaseModel):
    item_description: str
    amount: float
    currency: str
    entry_date: str
    confidence_score: float

# Now os.environ.get("GEMINI_API_KEY") will find the key from .env
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

response = client.models.generate_content(
    model="gemini-3.6-flash",
    contents="A trader sold 3 loaves of bread for 45 Rand today, 16 September 2026.",
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=SanityCheck,
        temperature=0.1
    ),
)

print(response.text)