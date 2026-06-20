import os
import re
import json
from functools import lru_cache
from typing import Dict, List, Optional

import gradio as gr
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import pipeline


MODEL_ID = os.getenv("HF_NLP_MODEL", "joeddav/xlm-roberta-large-xnli")

with open(os.path.join(os.path.dirname(__file__), "labels.json"), encoding="utf-8") as handle:
    CANDIDATE_LABELS = json.load(handle)["labels"]

LABEL_MAPPING: Dict[str, Dict[str, object]] = {
    "medical emergency": {"service": "ambulance", "type": "Medical Emergency", "baseScore": 7, "services": ["ambulance"]},
    "minor medical issue": {"service": "ambulance", "type": "Minor Medical Issue", "baseScore": 3, "services": ["ambulance"]},
    "injury or wound": {"service": "ambulance", "type": "Injury or Wound", "baseScore": 6, "services": ["ambulance"]},
    "burn injury medical emergency": {"service": "ambulance", "type": "Burn Injury Medical Emergency", "baseScore": 8, "services": ["ambulance"]},
    "burn injury": {"service": "ambulance", "type": "Burn Injury Medical Emergency", "baseScore": 8, "services": ["ambulance"]},
    "medical issue": {"service": "ambulance", "type": "Medical Issue", "baseScore": 4, "services": ["ambulance"]},
    "wound": {"service": "ambulance", "type": "Injury or Wound", "baseScore": 6, "services": ["ambulance"]},
    "fire rescue emergency": {"service": "fire", "type": "Fire Emergency", "baseScore": 7, "services": ["fire"]},
    "fire emergency": {"service": "fire", "type": "Fire Emergency", "baseScore": 7, "services": ["fire"]},
    "explosion emergency": {"service": "fire", "type": "Explosion Emergency", "baseScore": 9, "services": ["fire"]},
    "police security emergency": {"service": "police", "type": "Police Emergency", "baseScore": 7, "services": ["police"]},
    "police emergency": {"service": "police", "type": "Police Emergency", "baseScore": 7, "services": ["police"]},
    "natural disaster": {"service": "fire", "type": "Natural Disaster", "baseScore": 8, "services": ["fire"]},
    "lost property non emergency": {"service": "police", "type": "Lost Property Report", "baseScore": 2, "services": ["police"]},
    "threatening incident": {"service": "police", "type": "Police Emergency", "baseScore": 7, "services": ["police"]},
    "dangerous animal threat": {"service": "fire", "type": "Firefighter - Animal Rescue", "baseScore": 6, "services": ["fire"]},
    "large dangerous animal threat": {"service": "police", "type": "Police Ranger - Dangerous Animal", "baseScore": 8, "services": ["police"]},
    "drug related crime": {"service": "police", "type": "Police Emergency", "baseScore": 8, "services": ["police"]},
    "gas leak hazmat emergency": {"service": "fire", "type": "Gas Leak / Hazmat Emergency", "baseScore": 9, "services": ["fire", "ambulance"]},
    "gas leak or hazmat emergency": {"service": "fire", "type": "Gas Leak / Hazmat Emergency", "baseScore": 9, "services": ["fire", "ambulance"]},
    "heart attack or stroke emergency": {"service": "ambulance", "type": "Cardiac / Stroke Emergency", "baseScore": 9, "services": ["ambulance"]},
    "cardiac emergency": {"service": "ambulance", "type": "Cardiac / Stroke Emergency", "baseScore": 9, "services": ["ambulance"]},
    "respiratory distress emergency": {"service": "ambulance", "type": "Respiratory Distress Emergency", "baseScore": 9, "services": ["ambulance"]},
    "poisoning or chemical exposure emergency": {"service": "ambulance", "type": "Poisoning / Chemical Exposure", "baseScore": 8, "services": ["ambulance", "fire"]},
    "animal rescue": {"service": "fire", "type": "Firefighter - Animal Rescue", "baseScore": 6, "services": ["fire"]},
    "traffic accident": {"service": "ambulance", "type": "Traffic Accident", "baseScore": 7, "services": ["ambulance"]},
    "general emergency": {"service": "ambulance", "type": "General Emergency", "baseScore": 4, "services": ["ambulance"]},
}

SAFETY_RULES = [
    (
        r"(\bexplod(?:e|es|ed|ing)?\b|\bexplosion\b|\bblast(?:ed|ing)?\b|\bdetonat(?:e|es|ed|ing|ion)\b|\bblew up\b|\bblown up\b|\bledakan\b|\bmeledak+k?\b|\bmeleduk\b|\bdentuman keras\b|\bletupan\b|\bmeletup\b|\bsumabog\b|\bpagsabog\b|\bvụ nổ\b|\bphát nổ\b|bom (meledak|explode)|tabung gas (meledak|explode)|boiler (meledak|explode)|gas cylinder exploded)",
        "explosion emergency",
        "NLP safety rule: explosion or detonation reported",
    ),
    (
        r"(buaya|crocodile|harimau|tiger|beruang|bear|lion|singa|serigala|wolf|macan|leopard|panther|komodo|hewan buas besar|hewan liar besar|predator besar)",
        "large dangerous animal threat",
        "NLP animal rule: large dangerous animal needs police-ranger response",
    ),
    (
        r"(ular|snake|cobra|kobra|python|piton|musang|civet|anjing galak|aggressive dog|rabid dog|biawak|monitor lizard|tawon|lebah|sarang tawon|wasp nest|hewan kecil berbahaya|animal rescue|hewan terjebak|kucing terjebak|anjing terjebak)",
        "dangerous animal threat",
        "NLP animal rule: firefighter animal rescue needed",
    ),
    (
        r"(kebocoran gas|gas bocor|bau gas|gas menyengat|gas leak|gas odor|carbon monoxide|karbon monoksida|hazmat|bau kimia|asap kimia)",
        "gas leak hazmat emergency",
        "NLP blind-spot rule: possible gas leak or hazardous material exposure",
    ),
    (
        r"(nyeri dada|dada tertindih|serangan jantung|henti jantung|heart attack|cardiac|keringat dingin|menjalar ke lengan|stroke|wajah mencong|bicara pelo|lemah sebelah|slurred speech|face drooping)",
        "heart attack or stroke emergency",
        "NLP blind-spot rule: possible heart attack or stroke symptoms",
    ),
    (
        r"(sesak napas|sulit bernapas|tidak bisa bernapas|tidak bernapas|napas berhenti|bibir.*biru|bibir.*membiru|asma parah|respiratory|difficulty breathing|not breathing)",
        "respiratory distress emergency",
        "NLP blind-spot rule: respiratory distress reported in text",
    ),
    (
        r"(keracunan|tertelan obat|overdose|poison|poisoning|muntah hebat|paparan kimia|chemical exposure|terhirup racun|menghirup asap kimia)",
        "poisoning or chemical exposure emergency",
        "NLP blind-spot rule: possible poisoning or chemical exposure",
    ),
]


class ClassifyRequest(BaseModel):
    text: str


@lru_cache(maxsize=1)
def get_classifier():
    return pipeline("zero-shot-classification", model=MODEL_ID)


def mapped_result(label: str, confidence: float, indicator: Optional[str] = None) -> Dict[str, object]:
    mapping = LABEL_MAPPING[label]
    score = max(1, min(10, round(float(mapping["baseScore"]) + (confidence - 0.5) * 1.2, 1)))
    indicators = [indicator] if indicator else [f"XLM-RoBERTa NLP: {mapping['type']} ({round(confidence * 100)}% confidence)"]
    return {
        "type": mapping["type"],
        "service": mapping["service"],
        "services": mapping["services"],
        "score": score,
        "indicators": indicators,
    }


def safety_rule_result(text: str) -> Optional[Dict[str, object]]:
    for pattern, label, indicator in SAFETY_RULES:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return mapped_result(label, 0.95, indicator)
    return None


def classify_text(text: str) -> Dict[str, object]:
    clean_text = (text or "").strip()
    if not clean_text:
        return {"available": True, "model": MODEL_ID, "classifications": [], "result": None}

    rule_result = safety_rule_result(clean_text)
    if rule_result:
        return {
            "available": True,
            "model": MODEL_ID,
            "classifications": [],
            "result": rule_result,
        }

    classifier = get_classifier()
    prediction = classifier(clean_text, CANDIDATE_LABELS, multi_label=True)
    classifications = [
        {"label": label, "score": float(score)}
        for label, score in zip(prediction["labels"], prediction["scores"])
    ]
    strongest = classifications[0] if classifications else None

    if not strongest or strongest["score"] < 0.42:
        return {
            "available": True,
            "model": MODEL_ID,
            "classifications": classifications,
            "result": {
                "type": "Manual Review",
                "service": "ambulance",
                "services": ["ambulance"],
                "score": 3,
                "indicators": ["XLM-RoBERTa confidence below threshold; manual review recommended"],
            },
        }

    return {
        "available": True,
        "model": MODEL_ID,
        "classifications": classifications,
        "result": mapped_result(strongest["label"], strongest["score"]),
    }


api = FastAPI(title="Pilihan Boemi Emergency NLP")


@api.get("/")
def health():
    return {"ok": True, "model": MODEL_ID}


@api.post("/classify")
def classify(request: ClassifyRequest):
    return classify_text(request.text)


demo = gr.Interface(
    fn=classify_text,
    inputs=gr.Textbox(label="Emergency report text", lines=5),
    outputs=gr.JSON(label="NLP result"),
    title="Pilihan Boemi Emergency NLP",
    description="XLM-RoBERTa emergency text classifier for ambulance, fire, police, and animal rescue routing.",
)

app = gr.mount_gradio_app(api, demo, path="/demo")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
