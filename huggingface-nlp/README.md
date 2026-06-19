# Pilihan Boemi Emergency NLP

Small Hugging Face Space for emergency report text classification.

## Files

- `app.py`: XLM-RoBERTa zero-shot classifier with emergency safety rules.
- `requirements.txt`: Python dependencies for Hugging Face Spaces.

## Hugging Face Setup

1. Create a new Hugging Face Space.
2. Choose **Gradio** as the SDK.
3. Upload the files in this folder.
4. Wait until the Space finishes building.

The JSON endpoint will be:

```text
https://YOUR_USERNAME-YOUR_SPACE_NAME.hf.space/classify
```

Test body:

```json
{
  "text": "Ada orang sesak napas dan nyeri dada di dekat jalan utama"
}
```

Expected response:

```json
{
  "available": true,
  "model": "joeddav/xlm-roberta-large-xnli",
  "classifications": [],
  "result": {
    "type": "Cardiac / Stroke Emergency",
    "service": "ambulance",
    "services": ["ambulance"],
    "score": 10,
    "indicators": ["NLP blind-spot rule: possible heart attack or stroke symptoms"]
  }
}
```

## Vercel Environment Variables

Preferred production setup: upload this folder as a Hugging Face Space, then set this in Vercel:

```text
HF_NLP_API_URL=https://YOUR_USERNAME-YOUR_SPACE_NAME.hf.space/classify
```

Optional direct Hugging Face Inference API fallback:

```text
HUGGINGFACE_API_KEY=hf_xxx
HF_NLP_MODEL=joeddav/xlm-roberta-large-xnli
```

If you use a custom model repository, set it explicitly and make sure it returns labels compatible with the app mappings:

```text
HUGGINGFACE_API_KEY=hf_xxx
HF_NLP_MODEL=Alief2004/nlp_p2a
```
