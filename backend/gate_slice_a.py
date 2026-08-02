"""Slice A gate: run scorer against 3 reference resumes, report before/after.
Run from backend/: python gate_slice_a.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
REFERENCE = ROOT / "reference"

sys.path.insert(0, str(Path(__file__).parent))

from parsing.parser import parse_resume
from rewrite.composer import compose_markdown
from scoring.scorer import score_resume


def score_file(path: Path, structure: str = "S1") -> dict:
    text = path.read_text(encoding="utf-8")
    parsed = parse_resume(text)
    # Supply minimal answers to avoid blocking on gaps
    from wizard.gaps import detect_gaps
    gaps = detect_gaps(parsed)
    answers = []
    for g in gaps:
        if g["kind"] == "mc":
            answers.append({"question": f"{g['id']} :: {g['question']}", "answer": g["options"][0]})
        elif g["id"].startswith("quant_"):
            answers.append({"question": f"{g['id']} :: {g['question']}", "answer": "(skipped)"})
        elif g["id"] == "contact_linkedin":
            # Use linkedin from raw text if present, else skip
            import re
            m = re.search(r"linkedin\.com/in/[\w-]+", text, re.IGNORECASE)
            answers.append({"question": f"{g['id']} :: {g['question']}", "answer": m.group() if m else "(skipped)"})
        else:
            answers.append({"question": f"{g['id']} :: {g['question']}", "answer": "(skipped)"})
    md, status, _ = compose_markdown(parsed, answers, structure)
    return score_resume(md)


def report(name: str, result: dict) -> None:
    score = result["value"]
    bar = "█" * (score // 5) + "░" * (20 - score // 5)
    print(f"\n{'─'*60}")
    print(f"  {name:30s}  score: {score:3d}  [{bar}]")
    print(f"{'─'*60}")
    for c in result["checks"]:
        pts = c["points"]
        mx = c["max_points"]
        icon = "✓" if pts >= mx * 0.99 else ("✗" if pts == 0 else "~")
        print(f"  {icon} {c['label']:45s} {pts:4.1f}/{mx}")
        if pts < mx * 0.99:
            print(f"      → {c['detail']}")


FILES = [
    ("strong.txt",   "S1", "Strong (should score >75)"),
    ("medium.txt",   "S1", "Medium (mixed quality)"),
    ("sparse.txt",   "S3", "Sparse (should score low)"),
]

print("=" * 60)
print("  GATE SLICE A — ATS Scorer")
print("=" * 60)

for filename, structure, label in FILES:
    path = REFERENCE / filename
    if not path.exists():
        print(f"\n  MISSING: {path}")
        continue
    result = score_file(path, structure)
    report(label, result)

print(f"\n{'='*60}")
strong_score = score_file(REFERENCE / "strong.txt", "S1")["value"]
gate = "PASS" if strong_score > 75 else "FAIL"
print(f"  GATE: strong resume scored {strong_score} — {gate} (need >75)")
print(f"{'='*60}\n")
