"""
Training data video recording — display + microphone, encoded to webm, stored as base64.
"""
import base64
import json
import shutil
import subprocess
import sys
import threading
import time
import wave
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import pyaudio
import mss
from PIL import Image

AUDIO_RATE = 44100
AUDIO_CHANNELS = 1
AUDIO_CHUNK = 1024
FRAME_INTERVAL = 0.1  # ~10 fps for mux
OUTPUT_RAW = Path("training-data/raw")
OUTPUT_BUNDLE = Path("training-data")
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB soft cap

stop_flag = threading.Event()
frames_audio = []
video_frames = []


def record_audio():
    pa = pyaudio.PyAudio()
    stream = pa.open(
        format=pyaudio.paInt16,
        channels=AUDIO_CHANNELS,
        rate=AUDIO_RATE,
        input=True,
        frames_per_buffer=AUDIO_CHUNK,
    )
    print("  [video] audio recording...")
    while not stop_flag.is_set():
        data = stream.read(AUDIO_CHUNK, exception_on_overflow=False)
        frames_audio.append(data)
    stream.stop_stream()
    stream.close()
    pa.terminate()
    print("  [video] audio stopped.")


def record_video_frames():
    sct = mss.mss()
    monitor = sct.monitors[1]
    last_grab = 0.0
    print("  [video] video recording...")
    while not stop_flag.is_set():
        now = time.time()
        if now - last_grab >= FRAME_INTERVAL:
            raw = sct.grab(monitor)
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            video_frames.append(img)
            last_grab = now
        time.sleep(0.02)
    print(f"  [video] video stopped. {len(video_frames)} frames captured.")


def wait_for_terminal_quit():
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


def _find_ffmpeg() -> str | None:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    return None


def _mux_to_webm(ffmpeg: str, run_dir: Path, wav_path: Path) -> Path:
    frames_dir = run_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for i, img in enumerate(video_frames):
        img.save(str(frames_dir / f"frame_{i:04d}.jpg"), "JPEG", quality=85)

    out_path = run_dir / "recording.webm"
    fps = max(1, min(30, int(1.0 / FRAME_INTERVAL)))
    cmd = [
        ffmpeg,
        "-y",
        "-framerate",
        str(fps),
        "-i",
        str(frames_dir / "frame_%04d.jpg"),
        "-i",
        str(wav_path),
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "32",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        "-shortest",
        str(out_path),
    ]
    print(f"  [video] encoding with ffmpeg ({len(video_frames)} frames)...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-2000:]}")
    return out_path


def save_bundle(slug: str, webm_path: Path, duration_sec: float):
    bundle_dir = OUTPUT_BUNDLE / slug
    bundle_dir.mkdir(parents=True, exist_ok=True)

    raw_bytes = webm_path.read_bytes()
    if len(raw_bytes) > MAX_VIDEO_BYTES:
        print(
            f"  [video] warning: video is {len(raw_bytes) / (1024*1024):.1f} MB "
            f"(recommended max {MAX_VIDEO_BYTES // (1024*1024)} MB)",
        )

    b64 = base64.b64encode(raw_bytes).decode("ascii")
    (bundle_dir / "video.b64").write_text(b64, encoding="utf-8")

    meta = {
        "mimeType": "video/webm",
        "durationSec": round(duration_sec, 2),
        "byteLength": len(raw_bytes),
        "recordedAt": datetime.utcnow().isoformat() + "Z",
        "contentKind": "trainingData",
    }
    (bundle_dir / "video.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"  [video] bundle -> {bundle_dir}/video.b64 ({len(b64)} chars base64)")
    return bundle_dir


def main():
    if len(sys.argv) < 2:
        print("Usage: python video_capture.py <slug> [--no-distribute]")
        sys.exit(1)

    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = set(sys.argv[1:])
    slug = args[0].lower().replace(" ", "-")
    skip_distribute = "--no-distribute" in flags
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT_RAW / slug / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    training_md = OUTPUT_BUNDLE / slug / "TRAINING.md"
    if not training_md.is_file():
        print(f"Error: draft TRAINING.md missing at {training_md}")
        sys.exit(1)

    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        print("Error: ffmpeg not found on PATH — install ffmpeg for video encoding.")
        sys.exit(1)

    print(f"\n=== Training data video: {slug} ===")
    print(f"Output dir: {run_dir}")
    print("\nStarting in 3 seconds...")
    time.sleep(3)
    print("\nVideo recording started. Type q and press Enter in the orchestrator terminal to stop.\n", flush=True)

    start_time = time.time()
    audio_thread = threading.Thread(target=record_audio, daemon=True)
    video_thread = threading.Thread(target=record_video_frames, daemon=True)
    audio_thread.start()
    video_thread.start()
    wait_for_terminal_quit()
    duration = time.time() - start_time
    stop_flag.set()
    audio_thread.join(timeout=5)
    video_thread.join(timeout=5)

    wav_path = run_dir / "audio.wav"
    wf = wave.open(str(wav_path), "wb")
    wf.setnchannels(AUDIO_CHANNELS)
    wf.setsampwidth(pyaudio.PyAudio().get_sample_size(pyaudio.paInt16))
    wf.setframerate(AUDIO_RATE)
    wf.writeframes(b"".join(frames_audio))
    wf.close()

    if not video_frames:
        print("Error: no video frames captured.")
        sys.exit(1)
    webm_path = _mux_to_webm(ffmpeg, run_dir, wav_path)

    if not webm_path.is_file():
        print(f"Error: recording file missing at {webm_path}")
        sys.exit(1)

    print(f"\nStopped video recording after {duration:.1f}s.")
    save_bundle(slug, webm_path, duration)

    if not skip_distribute:
        from cdr_publish import publish_training_to_cdr

        bundle_dir = OUTPUT_BUNDLE / slug
        publish_training_to_cdr(slug, str(bundle_dir))

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
