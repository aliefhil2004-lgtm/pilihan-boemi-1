#!/usr/bin/env python3
"""Build a training dataset for emergency incident classification.

Input format:
  CSV or JSONL with columns/fields:
    - text: report text
    - label: one of the supported emergency labels

Output:
  JSONL files in train/val/test splits, plus an augmented train set.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List, Optional


SUPPORTED_LABELS = [
    "medical emergency",
    "minor medical issue",
    "injury or wound",
    "burn injury medical emergency",
    "burn injury",
    "medical issue",
    "wound",
    "fire rescue emergency",
    "fire emergency",
    "explosion emergency",
    "police security emergency",
    "police emergency",
    "natural disaster",
    "lost property non emergency",
    "threatening incident",
    "dangerous animal threat",
    "large dangerous animal threat",
    "drug related crime",
    "gas leak hazmat emergency",
    "gas leak or hazmat emergency",
    "heart attack or stroke emergency",
    "cardiac emergency",
    "respiratory distress emergency",
    "poisoning or chemical exposure emergency",
    "animal rescue",
    "traffic accident",
    "general emergency",
]

SUPPORTED_LABELS = list(dict.fromkeys(SUPPORTED_LABELS))


TYPO_REPLACEMENTS = [
    (r"\blukaa\b", "luka"),
    (r"\blecettt?\b", "lecet"),
    (r"\bsesakkk?\b", "sesak"),
    (r"\bterbaka?r\b", "terbakar"),
    (r"\bmeledakk+\b", "meledak"),
    (r"\bexplodedd+\b", "exploded"),
    (r"\bbernapa?s\b", "bernapas"),
    (r"\btida?k\s+sadar\b", "tidak sadar"),
    (r"\bnggak\b", "tidak"),
    (r"\bgak\b", "tidak"),
    (r"\bga\b", "tidak"),
    (r"\bga?k\b", "tidak"),
]


CODE_SWITCH_PREFIXES = [
    "korban",
    "report says",
    "warga melapor",
    "someone says",
    "ada laporan",
]


@dataclass
class Row:
    text: str
    label: str


def normalize_text(value: str) -> str:
    return (
        value.lower()
        .encode("ascii", "ignore")
        .decode("ascii")
        .replace("_", " ")
    )


def apply_typos(value: str) -> str:
    out = value
    for pattern, replacement in TYPO_REPLACEMENTS:
        out = re.sub(pattern, replacement, out, flags=re.IGNORECASE)
    return out


def augment_text(text: str, label: str, rng: random.Random) -> str:
    base = apply_typos(normalize_text(text))

    variations = [base]

    if label in {"medical emergency", "injury or wound", "minor medical issue", "burn injury medical emergency"}:
        variations.extend([
            f"{base} di jalan",
            f"{base} korban butuh bantuan",
            f"ada warga {base}",
            f"{base} bleeding parah" if "bleeding" not in base else base,
            f"{base} in English",
        ])
    elif label in {"fire rescue emergency", "explosion emergency", "gas leak hazmat emergency"}:
        variations.extend([
            f"{base} asap tebal",
            f"{base} di rumah",
            f"report says {base}",
            f"{base} with heavy smoke",
        ])
    elif label in {"police security emergency", "threatening incident", "drug related crime"}:
        variations.extend([
            f"{base} ada ancaman",
            f"report says {base} urgent",
            f"warga bilang {base}",
            f"{base} is happening now",
        ])
    elif label in {"natural disaster", "traffic accident"}:
        variations.extend([
            f"{base} banyak korban",
            f"ada laporan {base} di lokasi",
            f"{base} butuh evakuasi",
            f"{base} reported in English",
        ])
    elif label in {"animal rescue", "dangerous animal threat", "large dangerous animal threat"}:
        variations.extend([
            f"{base} hewan masuk rumah",
            f"warga melapor {base}",
            f"{base} di pemukiman",
            f"{base} near the house",
        ])
    else:
        variations.extend([
            f"{base} urgent",
            f"ada laporan {base}",
            f"warga melapor {base}",
            f"{base} needs help",
        ])

    chosen = rng.choice(variations)
    if rng.random() < 0.35:
        chosen = f"{rng.choice(CODE_SWITCH_PREFIXES)} {chosen}"
    return re.sub(r"\s+", " ", chosen).strip()


def read_csv(path: Path) -> Iterator[Row]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            text = str(row.get("text", "")).strip()
            label = str(row.get("label", "")).strip().lower()
            if text and label:
                yield Row(text=text, label=label)


def read_jsonl(path: Path) -> Iterator[Row]:
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            payload = json.loads(line)
            text = str(payload.get("text", "")).strip()
            label = str(payload.get("label", "")).strip().lower()
            if text and label:
                yield Row(text=text, label=label)


def load_rows(inputs: List[Path]) -> List[Row]:
    rows: List[Row] = []
    for path in inputs:
        if path.suffix.lower() == ".csv":
            rows.extend(read_csv(path))
        elif path.suffix.lower() in {".jsonl", ".ndjson"}:
            rows.extend(read_jsonl(path))
        else:
            raise SystemExit(f"Unsupported file type: {path}")
    return rows


def dedupe_and_filter(rows: Iterable[Row]) -> List[Row]:
    seen = set()
    out = []
    for row in rows:
        key = (row.text.strip().lower(), row.label.strip().lower())
        if row.label not in SUPPORTED_LABELS:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(Row(text=row.text.strip(), label=row.label.strip().lower()))
    return out


def split_rows(rows: List[Row], seed: int):
    rng = random.Random(seed)
    items = rows[:]
    rng.shuffle(items)
    n = len(items)
    train_end = max(1, int(n * 0.8))
    val_end = max(train_end + 1, int(n * 0.9))
    return items[:train_end], items[train_end:val_end], items[val_end:]


def write_jsonl(path: Path, rows: Iterable[Row]):
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps({"text": row.text, "label": row.label}, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--out-dir", type=Path, default=Path("huggingface-nlp/data/processed"))
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--augment-multiplier", type=int, default=3)
    args = parser.parse_args()

    rows = dedupe_and_filter(load_rows(args.inputs))
    if not rows:
        raise SystemExit("No valid rows found")

    train, val, test = split_rows(rows, args.seed)
    rng = random.Random(args.seed)
    augmented_train: List[Row] = []
    for row in train:
        augmented_train.append(row)
        for _ in range(max(0, args.augment_multiplier - 1)):
            augmented_train.append(Row(text=augment_text(row.text, row.label, rng), label=row.label))

    args.out_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(args.out_dir / "train.jsonl", augmented_train)
    write_jsonl(args.out_dir / "val.jsonl", val)
    write_jsonl(args.out_dir / "test.jsonl", test)

    print(json.dumps({
        "input_rows": len(rows),
        "train_rows": len(augmented_train),
        "val_rows": len(val),
        "test_rows": len(test),
        "labels": SUPPORTED_LABELS,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
