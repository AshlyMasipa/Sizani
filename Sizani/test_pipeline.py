import subprocess
import time
import requests
from PIL import Image, ImageDraw

def create_sample_receipt(filename="test_receipt.jpg"):
    img = Image.new("RGB", (500, 250), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((30, 40), "Sizani Spaza Shop", fill=(0, 0, 0))
    d.text((30, 80), "Date: 2026-09-16", fill=(0, 0, 0))
    d.text((30, 120), "Item: 2x White Bread, 1x Milk 2L", fill=(0, 0, 0))
    d.text((30, 160), "Total: R 54.50", fill=(0, 0, 0))
    img.save(filename)
    print(f"Created sample fixture: {filename}")

def run_tests():
    create_sample_receipt()

    print("\nStarting Uvicorn test server...")
    proc = subprocess.Popen(
        [".venv\\Scripts\\python.exe", "-m", "uvicorn", "server:app", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(3)  # Wait for server startup

    try:
        # 1. Test POST /parse with generated image
        print("\n--- Testing POST /parse (Image Extraction) ---")
        parse_payload = {
            "trader_id": "c1f7b0a2-9b2a-4a2b-8a8b-1b9c8d7e6f5a",
            "message_type": "image",
            "media_url": "test_receipt.jpg",
            "whatsapp_message_id": "wamid.HBgLMTIzNDU2",
            "received_at": "2026-09-16T10:30:00Z"
        }
        res = requests.post("http://127.0.0.1:8000/parse", json=parse_payload, timeout=20)
        print("Status Code:", res.status_code)
        print("Response Body:\n", res.json())

        data = res.json()
        assert data["success"] is True, "Parsing failed"
        assert data["parsed"]["amount"] == 54.5, f"Expected 54.5, got {data['parsed']['amount']}"
        print("POST /parse test passed successfully.")

        # 2. Test POST /score
        print("\n--- Testing POST /score (Heuristic & AI Explanation) ---")
        score_payload = {
            "trader_id": "c1f7b0a2-9b2a-4a2b-8a8b-1b9c8d7e6f5a",
            "ledger_entries": [
                {"amount": 54.5, "entry_date": "2026-09-01"},
                {"amount": 120.0, "entry_date": "2026-09-04"},
                {"amount": 230.0, "entry_date": "2026-09-08"},
                {"amount": 340.0, "entry_date": "2026-09-12"},
                {"amount": 450.0, "entry_date": "2026-09-16"}
            ]
        }
        res_score = requests.post("http://127.0.0.1:8000/score", json=score_payload, timeout=15)
        print("Status Code:", res_score.status_code)
        print("Response Body:\n", res_score.json())

        score_data = res_score.json()
        assert score_data["score"] > 0, "Credit score should be > 0"
        assert len(score_data["explanation"]) > 0, "Explanation should not be empty"
        print("POST /score test passed successfully.")

    finally:
        proc.terminate()
        print("\nTest server stopped.")

if __name__ == "__main__":
    run_tests()