# Pilihan Boemi Emergency NLP

Small Hugging Face Space for emergency report text classification.

## Files

- `app.py`: XLM-RoBERTa zero-shot classifier with emergency safety rules.
- `scripts/build_dataset.py`: build and augment a supervised dataset from CSV or JSONL.
- `scripts/train_xlmr.py`: fine-tune an XLM-R classifier on the processed dataset.
- `requirements.txt`: Python dependencies for Hugging Face Spaces.

## Dataset strategy

Use public or licensed sources only. Good inputs are:

- open government incident reports,
- public disaster/emergency datasets,
- curated research datasets,
- internally labeled examples,
- consented community samples.

Avoid blind scraping from social media unless the source license explicitly allows reuse and the data has been anonymized.

### Suggested public sources

Use sources that already expose incident text or structured emergency logs:

- open government disaster feeds,
- city 911 / emergency call sample datasets,
- wildfire and flood incident summaries,
- road-accident and hospital triage datasets,
- Kaggle or Hugging Face datasets with explicit reuse terms,
- academic corpora for crisis, disaster, or emergency classification.

If you do use social posts, prefer only posts with explicit reuse permission or datasets that are already anonymized and redistributed for research.

The training pipeline supports code-switching and typo augmentation so the model can tolerate Indonesian-English mix, slang, and noisy text.

### Build dataset

```bash
python scripts/build_dataset.py data/raw1.csv data/raw2.jsonl --out-dir data/processed
```

### Generate synthetic seed data

```bash
python scripts/generate_synthetic_dataset.py --rows 1000 --out data/synthetic_1000.csv
```

This file is useful for bootstrapping, but it should be mixed with real public/licensed data before training.

Expected input columns:

- `text`
- `label`

### Supported labels

Keep labels normalized to one of these values:

- `medical emergency`
- `minor medical issue`
- `injury or wound`
- `burn injury medical emergency`
- `fire rescue emergency`
- `police security emergency`
- `natural disaster`
- `lost property non emergency`
- `threatening incident`
- `dangerous animal threat`
- `large dangerous animal threat`
- `drug related crime`
- `gas leak hazmat emergency`
- `heart attack or stroke emergency`
- `respiratory distress emergency`
- `poisoning or chemical exposure emergency`
- `animal rescue`
- `traffic accident`
- `general emergency`

### Train model

```bash
python scripts/train_xlmr.py --data-dir data/processed --model xlm-roberta-base --output-dir model-output
```

The output folder can be uploaded to Hugging Face and referenced by `HF_NLP_MODEL`.

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
