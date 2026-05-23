import os
import sys
import time
import wave
import threading
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import pyaudio
import mss
from PIL import Image

# ── Config ────────────────────────────────────────────────────────────────────

AUDIO_RATE = 44100
AUDIO_CHANNELS = 1
AUDIO_CHUNK = 1024
FRAME_INTERVAL = 5
OUTPUT_DIR = Path("skills/raw")

# ── State ─────────────────────────────────────────────────────────────────────

stop_flag = threading.Event()
frames_audio = []
screen_frames = []

# ── Audio thread ──────────────────────────────────────────────────────────────

def record_audio():
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=AUDIO_CHANNELS,
        rate=AUDIO_RATE,
        input=True,
        frames_per_buffer=AUDIO_CHUNK,
    )
    print("  [audio] recording...")
    while not stop_flag.is_set():
        data = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
        frames_audio.append(data)
    stream.stop_stream()
    stream.close()
    pa.terminate()
    print("  [audio] stopped.")

# ── Screen capture thread ─────────────────────────────────────────────────────

def record_screen():
    sct = mss.MSS()
    monitor = sct.monitors[1]
    last_grab = 0
    print("  [screen] recording...")
    while not stop_flag.is_set():
        now = time.time()
        if now - last_grab >= FRAME_INTERVAL:
            raw = sct.grab(monitor)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            screen_frames.append((now, img))
            last_grab = now
        time.sleep(0.1)
    print(f"  [screen] stopped. {len(screen_frames)} frames captured.")

# ── Save raw outputs ──────────────────────────────────────────────────────────

def save_outputs(run_dir: Path):
    run_dir.mkdir(parents=True, exist_ok=True)

    # Save WAV
    wav_path = run_dir / "audio.wav"
    wf = wave.open(str(wav_path), "wb")
    wf.setnchannels(AUDIO_CHANNELS)
    wf.setsampwidth(pyaudio.PyAudio().get_sample_size(pyaudio.paInt16))
    wf.setframerate(AUDIO_RATE)
    wf.writeframes(b"".join(frames_audio))
    wf.close()
    print(f"  [save] audio -> {wav_path}")

    # Save frames
    frames_dir = run_dir / "frames"
    frames_dir.mkdir(exist_ok=True)
    frame_manifest = []
    for i, (ts, img) in enumerate(screen_frames):
        fname = frames_dir / f"frame_{i:04d}.jpg"
        img.save(str(fname), "JPEG", quality=80)
        frame_manifest.append({"index": i, "timestamp": ts, "path": str(fname)})

    import json
    manifest_path = run_dir / "frame_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(frame_manifest, f, indent=2)
    print(f"  [save] {len(screen_frames)} frames -> {frames_dir}/")

    return wav_path, frames_dir, manifest_path

# ── Main ──────────────────────────────────────────────────────────────────────

def wait_for_terminal_quit():
    """Block until the orchestrator forwards q + Enter on stdin."""
    quit_event = threading.Event()

    def read_stdin():
        while not quit_event.is_set():
            try:
                line = sys.stdin.readline()
            except (KeyboardInterrupt, EOFError):
                quit_event.set()
                break
            if line == "":
                break
            if line.strip().lower() == "q":
                quit_event.set()
                break

    reader = threading.Thread(target=read_stdin, daemon=True)
    reader.start()
    quit_event.wait()
    reader.join(timeout=1)

def main():
    if len(sys.argv) < 2:
        print("Usage: python capture.py <skill-name> [--no-distribute]")
        print("  e.g: python capture.py git-rebase-workflow")
        sys.exit(1)

    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = set(sys.argv[1:])
    skill_name = args[0].lower().replace(" ", "-")
    skip_distribute = "--no-distribute" in flags
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT_DIR / skill_name / timestamp

    print(f"\n=== Skill Capture: {skill_name} ===")
    print(f"Output dir: {run_dir}")
    print("\nStarting in 3 seconds...")
    time.sleep(3)
    print("\nRecording! Type q and press Enter in the orchestrator terminal to stop.\n", flush=True)

    audio_thread = threading.Thread(target=record_audio, daemon=True)
    screen_thread = threading.Thread(target=record_screen, daemon=True)
    audio_thread.start()
    screen_thread.start()

    start_time = time.time()
    wait_for_terminal_quit()
    duration = time.time() - start_time
    stop_flag.set()

    print(f"\n\nStopped after {duration:.1f}s. Saving raw files...")
    audio_thread.join(timeout=3)
    screen_thread.join(timeout=3)

    wav_path, frames_dir, manifest_path = save_outputs(run_dir)

    # ── Auto-process ──────────────────────────────────────────────────────────
    print("\nStarting processing pipeline automatically...\n")

    import importlib.util
    process_path = Path(__file__).resolve().parent / "process.py"
    spec = importlib.util.spec_from_file_location("skill_capture_process", process_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load process module from {process_path}")
    process = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(process)
    transcript  = process.transcribe_audio(wav_path)
    annotations = process.annotate_frames(frames_dir, manifest_path)
    skill_md    = process.extract_skill(skill_name, transcript, annotations)
    bundle_dir  = process.save_skill_bundle(skill_name, skill_md, transcript, annotations)

    if not skip_distribute:
        from cdr_publish import publish_skill_to_cdr
        publish_skill_to_cdr(skill_name, bundle_dir)

    print(f"\n=== Done ===")
    print(f"SKILL.md preview:\n")
    lines = skill_md.splitlines()
    for line in lines[:30]:
        print(f"  {line}")
    if len(lines) > 30:
        print(f"  ... ({len(lines) - 30} more lines)")

if __name__ == "__main__":
    main()