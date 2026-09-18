import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

class ParsedLedgerEntry(BaseModel):
    item_description: str
    amount: float
    currency: str = "ZAR"
    entry_date: str
    confidence_score: float

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

audio_path = "test_voice.ogg"  # adjust extension if .m4a or .ogg
with open(audio_path, "rb") as f:
    audio_bytes = f.read()

part = types.Part.from_bytes(data=audio_bytes, mime_type="audio/mp3")

prompt = (
    "Extract a single sales transaction from this South African trader voice note. "
    "Resolve 'today' or 'yesterday' relative to 2026-09-18. Return ZAR amounts. "
    "If unclear, set confidence_score < 0.5."
)

response = client.models.generate_content(
    model="gemini-3.6-flash",
    contents=[part, prompt],
    config=types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ParsedLedgerEntry,
        temperature=0.1
    )
)

print(json.dumps(json.loads(response.text), indent=2))