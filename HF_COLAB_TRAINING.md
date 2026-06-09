# Hugging Face NLP Training for Emergency Routing

This guide trains the Hugging Face text model used by the emergency app so its labels stay aligned with the app's fusion layer.

## Label taxonomy

Use exactly these labels in your dataset and model output:

- `medical emergency`
- `fire rescue emergency`
- `police security emergency`
- `natural disaster`
- `lost property non emergency`

These labels must stay synchronized with:

- `api/nlp.ts`
- `src/app/services/nlp.ts`
- `src/app/services/ai.ts`

## Dataset format

Use a CSV with these columns:

```csv
text,label
"Person not breathing and unconscious","medical emergency"
"Smoke coming from building with people trapped","fire rescue emergency"
"Armed person near school entrance","police security emergency"
"Road blocked after earthquake","natural disaster"
"Lost wallet at mall, no threat","lost property non emergency"
```

Guidelines:

- Keep one label per row for single-label classification.
- If you need multi-label later, keep the same taxonomy and train a separate multi-label head.
- Include both English and Bahasa Indonesia examples.
- Keep short and long descriptions mixed together.

## Colab training script

Paste this into Google Colab.

```python
!pip -q install transformers datasets accelerate evaluate scikit-learn huggingface_hub

import os
import numpy as np
import pandas as pd
from datasets import Dataset, DatasetDict, ClassLabel
from sklearn.model_selection import train_test_split
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    DataCollatorWithPadding
)
from evaluate import load as load_metric

MODEL_NAME = "xlm-roberta-base"
LABELS = [
    "medical emergency",
    "fire rescue emergency",
    "police security emergency",
    "natural disaster",
    "lost property non emergency",
]

df = pd.read_csv("/content/train.csv")
df["label"] = pd.Categorical(df["label"], categories=LABELS)
df = df.dropna(subset=["label", "text"]).copy()

label2id = {label: i for i, label in enumerate(LABELS)}
id2label = {i: label for label, i in label2id.items()}
df["label_id"] = df["label"].map(label2id)

train_df, eval_df = train_test_split(
    df,
    test_size=0.2,
    random_state=42,
    stratify=df["label_id"]
)

train_ds = Dataset.from_pandas(train_df[["text", "label_id"]].rename(columns={"label_id": "labels"}), preserve_index=False)
eval_ds = Dataset.from_pandas(eval_df[["text", "label_id"]].rename(columns={"label_id": "labels"}), preserve_index=False)
dataset = DatasetDict({"train": train_ds, "validation": eval_ds})

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

def tokenize(batch):
    return tokenizer(batch["text"], truncation=True)

dataset = dataset.map(tokenize, batched=True)
data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    num_labels=len(LABELS),
    id2label=id2label,
    label2id=label2id
)

accuracy = load_metric("accuracy")
f1 = load_metric("f1")

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy.compute(predictions=predictions, references=labels)["accuracy"],
        "f1": f1.compute(predictions=predictions, references=labels, average="weighted")["f1"]
    }

training_args = TrainingArguments(
    output_dir="/content/emergency-nlp-model",
    learning_rate=2e-5,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    num_train_epochs=4,
    weight_decay=0.01,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1",
    save_total_limit=2,
    logging_steps=20,
    report_to="none"
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["validation"],
    tokenizer=tokenizer,
    data_collator=data_collator,
    compute_metrics=compute_metrics
)

trainer.train()
trainer.evaluate()

trainer.save_model("/content/emergency-nlp-model/final")
tokenizer.save_pretrained("/content/emergency-nlp-model/final")
```

## Inference contract

Your deployed model should return a response shaped like this:

```json
{
  "labels": ["medical emergency", "fire rescue emergency"],
  "scores": [0.91, 0.06]
}
```

That format keeps `api/nlp.ts` simple and compatible with the existing app.

## Why this works with the current app

- `Roboflow` or YOLO handles visual evidence from photos.
- Hugging Face handles textual intent and context.
- `src/app/services/ai.ts` now fuses the signals into one final service and severity.
- The final answer is selected by the fusion layer, so the models do not fight each other.

## Practical rule

If you change labels in Colab, update the same labels in both `api/nlp.ts` and `src/app/services/nlp.ts` at the same time.
