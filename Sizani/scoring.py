import numpy as np
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from google import genai
from google.genai import types

class LedgerInput(BaseModel):
    amount: float
    entry_date: str  # YYYY-MM-DD

class ScoreBreakdown(BaseModel):
    consistency: float
    volume_trend: float
    frequency: float

class CreditScoreResult(BaseModel):
    score: float
    breakdown: ScoreBreakdown
    explanation: str

def compute_credit_score(entries: List[LedgerInput], client: Optional[genai.Client] = None) -> CreditScoreResult:
    if not entries:
        return CreditScoreResult(
            score=0.0,
            breakdown=ScoreBreakdown(consistency=0.0, volume_trend=0.0, frequency=0.0),
            explanation="No transaction history available to evaluate."
        )

    # Sort entries chronologically
    sorted_entries = sorted(entries, key=lambda e: datetime.strptime(e.entry_date, "%Y-%m-%d"))
    dates = [datetime.strptime(e.entry_date, "%Y-%m-%d") for e in sorted_entries]
    amounts = [e.amount for e in sorted_entries]
    n = len(sorted_entries)

    # 1. Frequency: transaction count relative to date span (normalized against a 30-day window)
    total_days = max((dates[-1] - dates[0]).days, 1)
    frequency = min(1.0, (n / max(total_days, 14)) * 2.0)

    # 2. Consistency: standard deviation of interval gaps between sales
    if n > 2:
        intervals = [(dates[i] - dates[i-1]).days for i in range(1, n)]
        std_dev = float(np.std(intervals))
        consistency = max(0.0, min(1.0, 1.0 - (std_dev / 7.0)))
    else:
        consistency = 0.5

    # 3. Volume Trend: normalized slope of sales value over time
    if n > 2:
        x = np.arange(n)
        slope, _ = np.polyfit(x, amounts, 1)
        mean_val = max(float(np.mean(amounts)), 1.0)
        norm_slope = slope / mean_val
        volume_trend = max(0.0, min(1.0, 0.5 + (norm_slope * 2.0)))
    else:
        volume_trend = 0.5

    final_score = round(float((consistency * 0.35 + volume_trend * 0.35 + frequency * 0.30) * 100), 2)
    breakdown = ScoreBreakdown(
        consistency=round(consistency, 2),
        volume_trend=round(volume_trend, 2),
        frequency=round(frequency, 2)
    )

    explanation = f"Consistent sales profile with {n} recorded sales over {total_days} days."
    if client:
        try:
            prompt = (
                f"Given this sales history breakdown for a small trader:\n"
                f"- Consistency score: {breakdown.consistency}\n"
                f"- Volume trend: {breakdown.volume_trend}\n"
                f"- Frequency score: {breakdown.frequency}\n"
                f"- Entries considered: {n}\n\n"
                f"Write one plain-language sentence (max 25 words) a bank loan officer could "
                f"read to understand this trader's reliability. No jargon. Describe this as "
                f"an 'activity profile', not a formal credit score."
            )
            res = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=60
                )
            )
            explanation = res.text.strip().replace('"', '')
        except Exception:
            pass

    return CreditScoreResult(score=final_score, breakdown=breakdown, explanation=explanation)