#!/usr/bin/env python3
"""Merge multiple CSV/JSONL datasets into one deduplicated training source.

Expected fields:
  - text
  - label
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Iterable, Iterator, List, Tuple


def read_csv(path: Path) -> Iterator[Tuple[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            text = str(row.get("text", "")).strip()
            label = str(row.get("label", "")).strip().lower()
            if text and label:
                yield text, label


def read_jsonl(path: Path) -> Iterator[Tuple[str, str]]:
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            payload = json.loads(line)
            text = str(payload.get("text", "")).strip()
            label = str(payload.get("label", "")).strip().lower()
            if text and label:
                yield text, label


def load_file(path: Path) -> Iterator[Tuple[str, str]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return read_csv(path)
    if suffix in {".jsonl", ".ndjson"}:
        return read_jsonl(path)
    raise SystemExit(f"Unsupported file type: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, default=Path("huggingface-nlp/data/merged_dataset.csv"))
    args = parser.parse_args()

    seen = set()
    rows: List[Tuple[str, str]] = []
    for path in args.inputs:
      for text, label in load_file(path):
        key = (text.lower(), label)
        if key in seen:
          continue
        seen.add(key)
        rows.append((text, label))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label"])
        writer.writerows(rows)

    print(f"Merged {len(rows)} rows into {args.out}")


if __name__ == "__main__":
    main()
