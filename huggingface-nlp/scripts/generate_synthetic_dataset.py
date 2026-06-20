#!/usr/bin/env python3
"""Generate a large synthetic emergency text dataset for bootstrapping.

This is intended as seed data. Mix it with real public/licensed data before training.
"""

from __future__ import annotations

import argparse
import csv
import random
import re
from pathlib import Path


LABEL_TEMPLATES = {
    "medical emergency": [
        "Ada korban {symptom} di {place}.",
        "There is a patient with {symptom} at {place}.",
        "Warga melapor {symptom} dan perlu ambulans segera.",
        "Pasien {symptom} setelah kejadian di {place}.",
        "Report says {symptom} di {place}, tolong kirim bantuan medis.",
    ],
    "minor medical issue": [
        "Korban {symptom} ringan setelah jatuh kecil.",
        "Minor {symptom} reported at {place}.",
        "Ada {symptom} ringan di lutut setelah terpeleset.",
        "Warga minta bantuan untuk {symptom} kecil di {place}.",
        "Luka {symptom} ringan, cukup penanganan medis dasar.",
    ],
    "injury or wound": [
        "Korban {injury} di {place} dan butuh bantuan medis.",
        "There is a wound and bleeding at {place}.",
        "Ada {injury} setelah kecelakaan di {place}.",
        "Warga melapor {injury} cukup serius.",
        "Report says {injury} dan korban kesakitan.",
    ],
    "burn injury medical emergency": [
        "Korban {burn} di {place}, tolong ambulans.",
        "Patient has a burn injury at {place}.",
        "Ada {burn} karena air panas.",
        "Warga melapor {burn} dan butuh pertolongan medis segera.",
        "Report says {burn} pada tangan dan kaki.",
    ],
    "fire rescue emergency": [
        "Ada {fire} di {place}.",
        "There is smoke and fire at {place}.",
        "Warga melapor {fire} dan asap tebal.",
        "Kebakaran {place} membuat warga panik.",
        "Report says {fire}, tolong kirim petugas pemadam.",
    ],
    "explosion emergency": [
        "Terjadi {explosion} di {place}.",
        "Something {explosion} near {place}, send firefighters now.",
        "Warga melapor {explosion} dan terdengar dentuman keras.",
        "Report says {explosion} at {place}.",
        "Ada {explosion}, kemungkinan masih berbahaya.",
    ],
    "police security emergency": [
        "Ada {crime} di {place}.",
        "There is a threat and police are needed at {place}.",
        "Warga melapor {threat} dan minta polisi.",
        "Report says {crime} terjadi di {place}.",
        "Ada ancaman {threat} di lokasi.",
    ],
    "natural disaster": [
        "Terjadi {disaster} di {place}.",
        "A {disaster} has been reported near {place}.",
        "Warga melapor {disaster} dan butuh evakuasi.",
        "Report says {disaster} melanda wilayah {place}.",
        "Banyak korban akibat {disaster}.",
    ],
    "lost property non emergency": [
        "Kehilangan {item} di {place}.",
        "Warga melapor {item} hilang.",
        "Report says {item} tertinggal di {place}.",
        "Ada laporan kehilangan barang pribadi.",
    ],
    "threatening incident": [
        "Ada {threat} di {place}.",
        "Warga merasa terancam oleh {threat}.",
        "Report says {threat} dan suasana tidak aman.",
        "Ada ancaman verbal dan intimidasi di {place}.",
    ],
    "dangerous animal threat": [
        "Ada {animal} masuk rumah di {place}.",
        "Warga melapor {animal} di lingkungan.",
        "Report says {animal} berkeliaran di {place}.",
        "Ada hewan berbahaya yang perlu ditangani.",
    ],
    "large dangerous animal threat": [
        "Ada {large_animal} di {place}.",
        "Warga melapor {large_animal} dekat pemukiman.",
        "Report says {large_animal} mengancam warga.",
        "Butuh penanganan untuk {large_animal} di lokasi.",
    ],
    "drug related crime": [
        "Ada {drug} di {place}.",
        "Warga melapor aktivitas {drug}.",
        "Report says {drug} di lingkungan sekolah.",
        "Ada dugaan {drug} di lokasi.",
    ],
    "gas leak hazmat emergency": [
        "Tercium {gas} di {place}.",
        "Warga melapor {hazmat} dan minta evakuasi.",
        "Report says {gas} di area {place}.",
        "Ada paparan kimia dan bau menyengat di lokasi.",
    ],
    "heart attack or stroke emergency": [
        "Korban {cardiac} di {place}.",
        "Warga melapor gejala {stroke} dan butuh ambulans.",
        "Report says {cardiac} pada pasien.",
        "Ada gejala {stroke} di lokasi.",
    ],
    "respiratory distress emergency": [
        "Korban {breathing} di {place}.",
        "Warga melapor {breathing} dan sesak berat.",
        "Report says {breathing} pada pasien.",
        "Ada pasien yang sulit bernapas di {place}.",
    ],
    "poisoning or chemical exposure emergency": [
        "Korban {poison} di {place}.",
        "Warga melapor {poison} dan muntah hebat.",
        "Report says {poison} terjadi setelah paparan {place}.",
        "Ada kemungkinan keracunan atau paparan kimia.",
    ],
    "animal rescue": [
        "Ada {animal} terjebak di {place}.",
        "Warga melapor {animal} perlu diselamatkan.",
        "Report says {animal} di {place} dan tidak bisa keluar.",
        "Butuh bantuan untuk penyelamatan hewan.",
    ],
    "traffic accident": [
        "Terjadi {crash} di {place}.",
        "Warga melapor {crash} dan ada korban luka.",
        "Report says {crash} di jalan utama.",
        "Ada kecelakaan lalu lintas dan butuh ambulans.",
    ],
    "general emergency": [
        "Ada kondisi darurat di {place}.",
        "Warga melapor keadaan darurat dan butuh bantuan.",
        "Report says ada situasi darurat yang perlu dicek.",
        "Tolong kirim bantuan ke lokasi segera.",
    ],
}


PLACE = [
    "rumah", "jalan utama", "gang sempit", "sekolah", "pasar", "kantor", "dapur", "parkiran", "terminal", "pemukiman",
    "dekat sungai", "pinggir jalan", "lorong apartemen", "area industri", "lantai dua", "belakang gedung", "kawasan perumahan"
]

SYMPTOM = ["lecet", "pusing", "sesak napas", "nyeri dada", "mual", "pingsan", "darah keluar", "lemas", "memar", "kejang"]
INJURY = ["luka robek", "luka berdarah", "patah tulang", "memar besar", "cedera kepala", "cedera kaki"]
BURN = ["luka bakar", "kulit melepuh", "tangan terbakar", "tersiram air panas"]
FIRE = ["kebakaran", "api besar", "asap tebal", "rumah terbakar", "ledakan kecil"]
EXPLOSION = [
    "ledakan besar", "tabung gas meledak", "boiler meledak", "bom meledak",
    "an explosion", "something exploded", "the gas cylinder blew up", "a loud blast",
    "letupan kuat", "sumabog ang tangke", "pagsabog sa gusali", "vụ nổ lớn"
]
CRIME = ["perampokan", "pencurian", "penyerangan", "pengancaman", "begal"]
THREAT = ["ancaman senjata", "ancaman verbal", "orang bersenjata", "intimidasi"]
DISASTER = ["banjir", "gempa bumi", "longsor", "angin kencang", "badai", "tsunami"]
ITEM = ["dompet", "hp", "tas", "motor", "kunci rumah"]
ANIMAL = ["ular", "anjing galak", "kucing", "biawak", "tawon", "sarang lebah"]
LARGE_ANIMAL = ["buaya", "harimau", "beruang", "singa", "serigala", "komodo"]
DRUG = ["peredaran narkoba", "jual narkoba", "sabu-sabu", "obat terlarang"]
GAS = ["bau gas", "gas bocor", "asap kimia", "bau menyengat"]
HAZMAT = ["paparan kimia", "bahan berbahaya", "hazmat", "kontaminasi"]
CARDIAC = ["serangan jantung", "henti jantung", "nyeri dada berat"]
STROKE = ["stroke", "wajah mencong", "bicara pelo", "lemah sebelah"]
BREATHING = ["sesak napas", "sulit bernapas", "tidak bisa bernapas"]
POISON = ["keracunan", "overdose", "paparan obat", "muntah hebat"]
CRASH = ["tabrakan mobil", "kecelakaan motor", "mobil menabrak", "motor jatuh"]


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def choose(rng: random.Random, values):
    return rng.choice(values)


def render(label: str, rng: random.Random) -> str:
    template = rng.choice(LABEL_TEMPLATES[label])
    return normalize(template.format(
        place=choose(rng, PLACE),
        symptom=choose(rng, SYMPTOM),
        injury=choose(rng, INJURY),
        burn=choose(rng, BURN),
        fire=choose(rng, FIRE),
        explosion=choose(rng, EXPLOSION),
        crime=choose(rng, CRIME),
        threat=choose(rng, THREAT),
        disaster=choose(rng, DISASTER),
        item=choose(rng, ITEM),
        animal=choose(rng, ANIMAL),
        large_animal=choose(rng, LARGE_ANIMAL),
        drug=choose(rng, DRUG),
        gas=choose(rng, GAS),
        hazmat=choose(rng, HAZMAT),
        cardiac=choose(rng, CARDIAC),
        stroke=choose(rng, STROKE),
        breathing=choose(rng, BREATHING),
        poison=choose(rng, POISON),
        crash=choose(rng, CRASH),
    ))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=1000)
    parser.add_argument("--out", type=Path, default=Path("huggingface-nlp/data/synthetic_1000.csv"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    labels = list(LABEL_TEMPLATES.keys())
    weights = [8, 4, 6, 4, 8, 6, 8, 8, 2, 4, 5, 4, 3, 5, 6, 6, 5, 5, 6, 2]

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seen = set()
    rows = []

    while len(rows) < args.rows:
        label = rng.choices(labels, weights=weights, k=1)[0]
        text = render(label, rng)
        key = (text.lower(), label)
        if key in seen:
            continue
        seen.add(key)
        rows.append((text, label))

    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label"])
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
    main()
