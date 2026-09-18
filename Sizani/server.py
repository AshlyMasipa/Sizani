import os
import json
import hashlib
import requests
from typing import Optional, List, Any
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from scoring import compute_credit_score, LedgerInput, CreditScoreResult

load_dotenv()

app = FastAPI(title="Sizani AI Service")

# Allow the front-end (served from a different origin, e.g. file:// or a
# local dev server) to call this API through the ngrok tunnel.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten this to your actual front-end origin(s) later
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

CACHE_FILE = "demo_cache.json"
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r") as f:
            demo_cache = json.load(f)
    except Exception:
        demo_cache = {}
else:
    demo_cache = {}

# Section 2.2 / 2.3 Interface Schemas
class ParseRequest(BaseModel):
    trader_id: str
    message_type: str  # "image" or "audio"
    media_url: str
    whatsapp_message_id: str
    received_at: str

class ParsedLedgerEntry(BaseModel):
    item_description: str = Field(description="Clear summary of items or services sold")
    amount: float = Field(description="Total numeric transaction amount in ZAR")
    currency: str = Field(default="ZAR", description="Currency code, strictly ZAR")
    entry_date: str = Field(description="Date in YYYY-MM-DD format")
    confidence_score: float = Field(description="Confidence between 0.0 and 1.0")

class ParseResponse(BaseModel):
    success: bool
    parsed: Optional[ParsedLedgerEntry] = None
    raw_ai_output: Optional[dict[str, Any]] = None
    error: Optional[dict[str, str]] = None

class ScoreRequest(BaseModel):
    trader_id: str
    ledger_entries: List[LedgerInput]

@app.post("/parse", response_model=ParseResponse)
def parse_media_endpoint(req: ParseRequest):
    try:
        # Fetch file from URL or read from local disk
        if req.media_url.startswith("http://") or req.media_url.startswith("https://"):
            resp = requests.get(req.media_url, timeout=12)
            resp.raise_for_status()
            media_bytes = resp.content
        else:
            with open(req.media_url, "rb") as f:
                media_bytes = f.read()

        file_hash = hashlib.sha256(media_bytes).hexdigest()

        # Cache check to avoid live stage rate-limits or slow Wi-Fi
        if file_hash in demo_cache:
            return ParseResponse(
                success=True,
                parsed=ParsedLedgerEntry(**demo_cache[file_hash]),
                raw_ai_output={"source": "cache", "payload": demo_cache[file_hash]},
                error=None
            )

        mime_type = "image/jpeg" if req.message_type == "image" else "audio/ogg"
        current_date = req.received_at.split("T")[0]

        if req.message_type == "image":
            prompt = (
                f"You are extracting a single sales transaction from a photo of a handwritten "
                f"ledger entry or receipt written by a small business owner in South Africa. "
                f"The handwriting may be informal or mix English with local languages.\n"
                f"Current date: {current_date}.\n"
                f"If you cannot confidently extract an amount, set confidence_score below 0.5. "
                f"Never fabricate an amount you cannot see evidence for."
            )
        else:
            prompt = (
                f"You are extracting a single sales transaction from a voice note recorded by "
                f"a small business owner in South Africa describing a sale, possibly in English, "
                f"Zulu, Sotho, or a mix of languages.\n"
                f"Resolve terms like 'today' or 'yesterday' relative to {current_date}.\n"
                f"If the audio is unclear, set confidence_score below 0.5."
            )

        part = types.Part.from_bytes(data=media_bytes, mime_type=mime_type)

        ai_res = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ParsedLedgerEntry,
                temperature=0.1
            )
        )

        parsed_dict = json.loads(ai_res.text)
        demo_cache[file_hash] = parsed_dict
        with open(CACHE_FILE, "w") as f:
            json.dump(demo_cache, f, indent=2)

        return ParseResponse(
            success=True,
            parsed=ParsedLedgerEntry(**parsed_dict),
            raw_ai_output=parsed_dict,
            error=None
        )

    except Exception as e:
        return ParseResponse(
            success=False,
            parsed=None,
            raw_ai_output=None,
            error={"code": "PARSE_FAILED", "message": str(e)}
        )

@app.post("/score", response_model=CreditScoreResult)
def score_endpoint(req: ScoreRequest):
    return compute_credit_score(req.ledger_entries, client=client)