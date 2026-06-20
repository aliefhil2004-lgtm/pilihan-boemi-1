#!/usr/bin/env python3
"""Fine-tune XLM-R for emergency text classification.

Expects JSONL files from build_dataset.py.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import numpy as np
from datasets import Dataset, DatasetDict, load_dataset
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)


LABELS = [
    "medical emergency",
    "minor medical issue",
    "injury or wound",
    "burn injury medical emergency",
    "fire rescue emergency",
    "explosion emergency",
    "police security emergency",
    "natural disaster",
    "lost property non emergency",
    "threatening incident",
    "dangerous animal threat",
    "large dangerous animal threat",
    "drug related crime",
    "gas leak hazmat emergency",
    "heart attack or stroke emergency",
    "respiratory distress emergency",
    "poisoning or chemical exposure emergency",
    "animal rescue",
    "traffic accident",
    "general emergency",
]

LABELS = list(dict.fromkeys(LABELS))

LABEL2ID = {label: idx for idx, label in enumerate(LABELS)}
ID2LABEL = {idx: label for label, idx in LABEL2ID.items()}


def load_jsonl(path: Path):
    return load_dataset("json", data_files=str(path), split="train")


def tokenize(batch, tokenizer):
    return tokenizer(batch["text"], truncation=True, max_length=192)


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_score(labels, predictions),
        "f1_macro": f1_score(labels, predictions, average="macro"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("huggingface-nlp/data/processed"))
    parser.add_argument("--model", type=str, default="xlm-roberta-base")
    parser.add_argument("--output-dir", type=Path, default=Path("huggingface-nlp/model-output"))
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    args = parser.parse_args()

    train_path = args.data_dir / "train.jsonl"
    val_path = args.data_dir / "val.jsonl"
    test_path = args.data_dir / "test.jsonl"

    ds = DatasetDict({
        "train": load_jsonl(train_path),
        "validation": load_jsonl(val_path),
        "test": load_jsonl(test_path),
    })

    def encode_label(example):
        label = str(example["label"]).strip().lower()
        if label not in LABEL2ID:
            raise ValueError(f"Unsupported label: {label}")
        return {"label_id": LABEL2ID[label]}

    ds = ds.map(encode_label)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    tokenized = ds.map(lambda batch: tokenize(batch, tokenizer), batched=True)
    tokenized = tokenized.remove_columns(["text", "label"])
    tokenized = tokenized.rename_column("label_id", "labels")
    tokenized.set_format("torch")

    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(LABELS),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )

    training_args = TrainingArguments(
        output_dir=str(args.output_dir),
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        logging_steps=25,
        report_to="none",
        fp16=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    metrics = trainer.evaluate(tokenized["test"])
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    with (args.output_dir / "labels.json").open("w", encoding="utf-8") as handle:
      json.dump({"labels": LABELS}, handle, ensure_ascii=False, indent=2)

    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
