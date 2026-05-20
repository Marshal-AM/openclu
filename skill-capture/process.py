import os
import sys
import json
import base64
import textwrap
from pathlib import Path
from datetime import datetime

from groq import Groq

# ── Config ────────────────────────────────────────────────────────────────────
from dotenv import load_dotenv

_SKILL_CAPTURE_ROOT = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
load_dotenv(_SKILL_CAPTURE_ROOT / ".env")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TEXT_MODEL   = "llama-3.3-70b-versatile"
MAX_FRAME_SIZE_KB = 3500
FRAMES_PER_BATCH = 5

# ── Helpers ───────────────────────────────────────────────────────────────────

def encode_image(path: Path, max_kb: int = MAX_FRAME_SIZE_KB) -> str:
    from PIL import Image
    import io
    img = Image.open(path)
    quality = 80
    while True:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        size_kb = buf.tell() / 1024
        if size_kb <= max_kb or quality < 30:
            break
        w, h = img.size
        img = img.resize((int(w * 0.8), int(h * 0.8)), Image.LANCZOS)
        quality = max(quality - 10, 30)
    return base64.b64encode(buf.getvalue()).decode("utf-8")

# ── Step 1: Transcribe audio with Groq Whisper ────────────────────────────────

def transcribe_audio(wav_path: Path) -> dict:
    print(f"\n[1/3] Transcribing audio with Groq Whisper...")
    client = Groq(api_key=GROQ_API_KEY)

    with open(wav_path, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(wav_path.name, f),
            model="whisper-large-v3",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = [
        {
            "t_start": round(s["start"], 2),
            "t_end":   round(s["end"], 2),
            "text":    s["text"].strip(),
        }
        for s in response.segments
    ]

    print(f"    -> {len(segments)} segments, language: {response.language}")
    print(f"\n--- TRANSCRIPTION OUTPUT ---")
    print(f"Full text: {response.text}")
    print(f"\nSegments:")
    for s in segments:
        print(f"  [{s['t_start']}s – {s['t_end']}s] {s['text']}")
    print(f"--- END TRANSCRIPTION ---\n")
    return {
        "full_text": response.text,
        "segments":  segments,
        "language":  response.language,
    }

# ── Step 2: Annotate frames with Groq vision ──────────────────────────────────

def annotate_frames(frames_dir: Path, manifest_path: Path) -> list:
    print(f"\n[2/3] Annotating screen frames with Groq vision ({VISION_MODEL})...")

    client = Groq(api_key=GROQ_API_KEY)

    with open(manifest_path) as f:
        manifest = json.load(f)

    if not manifest:
        print("    -> No frames found, skipping.")
        return []

    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    if not frame_files:
        print("    -> No frame files found.")
        return []

    annotations = []

    for batch_start in range(0, len(frame_files), FRAMES_PER_BATCH):
        batch = frame_files[batch_start : batch_start + FRAMES_PER_BATCH]
        batch_meta = manifest[batch_start : batch_start + FRAMES_PER_BATCH]

        print(f"    Batch {batch_start//FRAMES_PER_BATCH + 1}: frames {batch_start}–{batch_start+len(batch)-1}")

        content = [
            {
                "type": "text",
                "text": (
                    "You are analyzing screen recording frames from an expert demonstrating a skill. "
                    "For EACH frame below, describe concisely: "
                    "(1) what application/tool is visible, "
                    "(2) what action appears to be happening, "
                    "(3) any key UI elements, text, or data visible. "
                    "Format your response as a JSON array with one object per frame: "
                    '[{"frame": 0, "app": "...", "action": "...", "details": "..."}]. '
                    "Return only the JSON array, no other text."
                )
            }
        ]

        for i, (fpath, meta) in enumerate(zip(batch, batch_meta)):
            b64 = encode_image(fpath)
            content.append({
                "type": "text",
                "text": f"Frame {meta['index']} (t={meta['timestamp']:.1f}s):"
            })
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}"
                }
            })

        try:
            response = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[{"role": "user", "content": content}],
                max_tokens=1024,
                temperature=0.1,
            )
            raw = response.choices[0].message.content.strip()

            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]

            batch_annotations = json.loads(raw)

            for ann in batch_annotations:
                frame_idx = ann.get("frame", 0)
                if frame_idx < len(manifest):
                    ann["timestamp"] = manifest[frame_idx]["timestamp"]

            annotations.extend(batch_annotations)
            print(f"      -> annotated {len(batch_annotations)} frames")

        except Exception as e:
            print(f"      ⚠ Vision batch failed: {e}")
            for meta in batch_meta:
                annotations.append({
                    "frame": meta["index"],
                    "timestamp": meta["timestamp"],
                    "app": "unknown",
                    "action": "annotation failed",
                    "details": str(e)
                })

    print(f"    -> {len(annotations)} frames annotated total")
    return annotations

# ── Step 3: Extract skill schema with Groq text ───────────────────────────────

SKILL_EXTRACTION_PROMPT = """
You are an expert at extracting structured skill knowledge from recordings of human experts.

You will receive:
1. A full audio transcript (with timestamps) of someone demonstrating a skill
2. Screen frame annotations showing what was happening on screen at each moment

Your job is to extract a complete SKILL.md file for an AI agent to use.

The SKILL.md format is:
---
name: <kebab-case-name>
description: <one sentence: what this skill does and when to use it>
triggers:
  - "<natural language phrase that would invoke this skill>"
  - "<another trigger phrase>"
expertise_source: human_recording
recorded_at: <ISO date>
---

## Overview
<2-3 sentences about what this skill accomplishes>

## Prerequisites
<bulleted list of what must be true before starting>

## Steps
<numbered list of steps. For each step that involves a decision, add a nested list of branches>

## Decision branches
<key decision points and what to do in each case>

## Common mistakes
<what the expert avoided or corrected>

## Tools and context
<what applications, commands, APIs, or resources are used>

## Notes
<tacit knowledge, tips, timing cues, anything the expert said that reveals their reasoning>

---

Transcript:
{transcript}

Frame annotations:
{frame_annotations}

Respond ONLY with the complete SKILL.md content, starting with ---.
"""

def extract_skill(skill_name: str, transcript: dict, frame_annotations: list) -> str:
    print(f"\n[3/3] Extracting skill schema with Groq ({TEXT_MODEL})...")

    client = Groq(api_key=GROQ_API_KEY)

    transcript_text = "\n".join(
        f"[{s['t_start']:.1f}s–{s['t_end']:.1f}s] {s['text']}"
        for s in transcript["segments"]
    )

    frames_text = "\n".join(
        f"[t={a.get('timestamp', '?'):.1f}s] app={a.get('app','?')} | "
        f"action={a.get('action','?')} | details={a.get('details','?')}"
        for a in frame_annotations
    )

    prompt = SKILL_EXTRACTION_PROMPT.format(
        transcript=transcript_text or "(no audio transcript available)",
        frame_annotations=frames_text or "(no frame annotations available)",
    )

    response = client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You extract structured AI agent skills from human recordings. Output only valid SKILL.md content."
            },
            {"role": "user", "content": prompt}
        ],
        max_tokens=4096,
        temperature=0.2,
    )

    skill_md = response.choices[0].message.content.strip()
    print("    -> skill schema extracted")
    return skill_md

# ── Save skill bundle ─────────────────────────────────────────────────────────

def _parse_frontmatter_block(content: str):
    import re
    m = re.match(r"^---\r?\n([\s\S]*?)\r?\n---", content)
    return m.group(1) if m else None


def _merge_skill_md(existing_path: Path, generated_md: str) -> str:
    """Keep user pre-capture frontmatter from draft SKILL.md when Groq regenerates body."""
    import re
    if not existing_path.exists():
        return generated_md
    existing = existing_path.read_text(encoding="utf-8")
    existing_fm = _parse_frontmatter_block(existing)
    if not existing_fm:
        return generated_md
    gen_body_m = re.match(r"^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)", generated_md)
    gen_body = gen_body_m.group(1).strip() if gen_body_m else generated_md
    return f"---\n{existing_fm}\n---\n\n{gen_body}\n"


def save_skill_bundle(skill_name: str, skill_md: str, transcript: dict, annotations: list):
    import re
    bundle_dir = Path("skills") / skill_name
    bundle_dir.mkdir(parents=True, exist_ok=True)

    skill_path = bundle_dir / "SKILL.md"
    merged = _merge_skill_md(skill_path, skill_md)
    with open(skill_path, "w", encoding="utf-8") as f:
        f.write(merged)

    transcript_path = bundle_dir / "transcript.json"
    with open(transcript_path, "w", encoding="utf-8") as f:
        json.dump(transcript, f, indent=2)

    annotations_path = bundle_dir / "frame_annotations.json"
    with open(annotations_path, "w", encoding="utf-8") as f:
        json.dump(annotations, f, indent=2)

    scripts_dir = bundle_dir / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    readme = scripts_dir / "README.md"
    if not readme.exists():
        readme.write_text("# Scripts\nAdd executable helpers for this skill here.\n")

    print(f"\n✓ Skill bundle saved to: {bundle_dir}/")
    print(f"  {skill_path.name}")
    print(f"  {transcript_path.name}")
    print(f"  {annotations_path.name}")
    print(f"  scripts/")
    print(f"\nTo load in OpenHuman, copy {bundle_dir}/ to your openhuman-skills repo")
    print(f"or set: skills.local_path = \"{Path('skills').resolve()}\" in config.toml")

    return bundle_dir

# ── Main (for running process.py standalone if needed) ────────────────────────

def main():
    if len(sys.argv) < 3:
        print("Usage: python process.py <skill-name> <run-dir>")
        print("  e.g: python process.py git-rebase-workflow skills/raw/git-rebase-workflow/20250520_143000")
        sys.exit(1)

    if not GROQ_API_KEY:
        print("ERROR: Set GROQ_API_KEY environment variable")
        sys.exit(1)

    skill_name = sys.argv[1]
    run_dir    = Path(sys.argv[2])

    wav_path      = run_dir / "audio.wav"
    frames_dir    = run_dir / "frames"
    manifest_path = run_dir / "frame_manifest.json"

    if not wav_path.exists():
        print(f"ERROR: {wav_path} not found")
        sys.exit(1)

    print(f"\n=== Processing: {skill_name} ===")
    print(f"Source: {run_dir}\n")

    transcript  = transcribe_audio(wav_path)
    annotations = annotate_frames(frames_dir, manifest_path)
    skill_md    = extract_skill(skill_name, transcript, annotations)
    bundle_dir  = save_skill_bundle(skill_name, skill_md, transcript, annotations)

    print(f"\n=== Done ===")
    lines = skill_md.splitlines()
    for line in lines[:30]:
        print(f"  {line}")
    if len(lines) > 30:
        print(f"  ... ({len(lines) - 30} more lines)")

if __name__ == "__main__":
    main()