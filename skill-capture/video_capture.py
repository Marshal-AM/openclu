"""
Training data video recording — system camera + microphone, encoded to webm, stored as base64.
"""
import base64
import json
import os
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

import cv2
import pyaudio

AUDIO_RATE = 44100
AUDIO_CHANNELS = 1
AUDIO_CHUNK = 1024
FRAME_INTERVAL = 0.1  # ~10 fps for mux
OUTPUT_RAW = Path("training-data/raw")
OUTPUT_BUNDLE = Path("training-data")
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 MB soft cap
WARMUP_READS = 45
BLACK_LUMA_THRESHOLD = 15.0
MIN_BYTES_PER_FRAME = 8_000  # heuristic vs healthy captures (~15KB/frame)

stop_flag = threading.Event()
frames_audio: list[bytes] = []
video_frames: list = []

_latest_frame_lock = threading.Lock()
_latest_frame = None


def _camera_device_index() -> int:
    raw = os.environ.get("TRAINING_CAMERA_INDEX", "0").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def _open_camera(device_index: int) -> cv2.VideoCapture:
    """Open default or indexed camera (Windows DShow / macOS AVFoundation when available)."""
    if sys.platform == "win32":
        cap = cv2.VideoCapture(device_index, cv2.CAP_DSHOW)
    elif sys.platform == "darwin":
        cap = cv2.VideoCapture(device_index, cv2.CAP_AVFOUNDATION)
    else:
        cap = cv2.VideoCapture(device_index)
    if cap.isOpened():
        return cap
    return cv2.VideoCapture(device_index)


def _mean_luma(frame) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (64, 36), interpolation=cv2.INTER_AREA)
    return float(small.mean())


def _warmup_camera(cap: cv2.VideoCapture) -> None:
    """Discard initial frames while the camera auto-exposure stabilizes."""
    print(f"  [video] warming up camera ({WARMUP_READS} frames)...")
    for _ in range(WARMUP_READS):
        cap.grab()
    # One retrieve to flush pipeline
    cap.retrieve()


def _camera_grab_loop(cap: cv2.VideoCapture) -> None:
    """Continuously grab frames so blocking read() does not limit sample rate."""
    global _latest_frame
    while not stop_flag.is_set():
        if not cap.grab():
            time.sleep(0.001)
            continue
        ok, frame = cap.retrieve()
        if ok and frame is not None:
            with _latest_frame_lock:
                _latest_frame = frame.copy()


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


def record_camera_frames(wall_clock_start: float):
    global _latest_frame
    device = _camera_device_index()
    cap = _open_camera(device)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open camera (device index {device}). "
            "Check permissions and set TRAINING_CAMERA_INDEX if needed.",
        )

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_FPS, max(1, int(1.0 / FRAME_INTERVAL)))

    _warmup_camera(cap)

    print(f"  [video] camera recording (device {device})...")
    grab_thread = threading.Thread(target=_camera_grab_loop, args=(cap,), daemon=True)
    grab_thread.start()

    target_fps = 1.0 / FRAME_INTERVAL
    last_sample = 0.0
    failed_reads = 0
    try:
        while not stop_flag.is_set():
            now = time.time()
            if now - last_sample >= FRAME_INTERVAL:
                with _latest_frame_lock:
                    frame = None if _latest_frame is None else _latest_frame.copy()
                if frame is not None:
                    video_frames.append(frame)
                    last_sample = now
                else:
                    failed_reads += 1
            time.sleep(0.005)
    finally:
        grab_thread.join(timeout=2)
        cap.release()

    elapsed = time.time() - wall_clock_start
    expected = max(1, int(elapsed * target_fps))
    captured = len(video_frames)
    ratio = captured / expected if expected else 0
    print(
        f"  [video] camera stopped. {captured} frames captured "
        f"(expected ~{expected} at {target_fps:.0f} fps, ratio {ratio:.0%}).",
    )
    if failed_reads:
        print(f"  [video] warning: {failed_reads} sample ticks had no frame yet.")
    if ratio < 0.5:
        print(
            "  [video] warning: frame count is far below wall-clock duration — "
            "check TRAINING_CAMERA_INDEX and camera permissions.",
        )

    if video_frames:
        luma = _mean_luma(video_frames[0])
        print(f"  [video] first frame mean luma: {luma:.1f}")
        if luma < BLACK_LUMA_THRESHOLD:
            msg = (
                f"  [video] error: first captured frame looks black (luma {luma:.1f} < "
                f"{BLACK_LUMA_THRESHOLD}). Try another TRAINING_CAMERA_INDEX or wait for "
                "the camera to expose."
            )
            print(msg)
            if os.environ.get("TRAINING_ALLOW_BLACK_FRAMES", "").strip() != "1":
                raise RuntimeError(msg.strip())


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
    try:
        import imageio_ffmpeg

        bundled = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled and Path(bundled).is_file():
            return bundled
    except ImportError:
        pass
    return None


def _find_ffprobe(ffmpeg: str | None) -> str | None:
    probe = shutil.which("ffprobe")
    if probe:
        return probe
    if ffmpeg:
        name = "ffprobe.exe" if sys.platform == "win32" else "ffprobe"
        sibling = Path(ffmpeg).parent / name
        if sibling.is_file():
            return str(sibling)
    return None


def _probe_webm_duration(ffprobe: str, webm_path: Path) -> float | None:
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(webm_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return None
    try:
        return float(result.stdout.strip())
    except ValueError:
        return None


def _transcode_input_to_webm(ffmpeg: str, input_path: Path, out_path: Path) -> None:
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(input_path),
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "32",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-2000:]}")


def _capture_from_media_input(
    slug: str,
    media_path: Path,
    skip_distribute: bool,
    run_dir: Path,
    ffmpeg: str,
) -> None:
    device = _camera_device_index()
    print(f"\n=== Training data video: {slug} ===")
    print(f"Output dir: {run_dir}")
    print(f"Camera device index: {device} (override with TRAINING_CAMERA_INDEX)")
    print("\nStarting in 3 seconds...")
    time.sleep(3)
    print(
        "\nVideo recording started (camera + microphone). "
        "Type q and press Enter in the orchestrator terminal to stop.\n",
        flush=True,
    )
    start_time = time.time()
    webm_path = run_dir / "recording.webm"
    _transcode_input_to_webm(ffmpeg, media_path, webm_path)
    if not webm_path.is_file():
        print(f"Error: recording file missing at {webm_path}")
        sys.exit(1)

    ffprobe = _find_ffprobe(ffmpeg)
    duration = _probe_webm_duration(ffprobe, webm_path) if ffprobe else None
    if duration is None:
        duration = max(0.1, time.time() - start_time)
    frame_count = max(1, int(duration / FRAME_INTERVAL))
    print(f"\nStopped video recording after {duration:.1f}s wall time.")
    save_bundle(slug, webm_path, duration, frame_count, ffmpeg)

    if not skip_distribute:
        from cdr_publish import publish_training_to_cdr

        bundle_dir = OUTPUT_BUNDLE / slug
        publish_training_to_cdr(slug, str(bundle_dir))

    print("\n=== Done ===")


def _mux_to_webm(ffmpeg: str, run_dir: Path, wav_path: Path) -> Path:
    frames_dir = run_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for i, frame in enumerate(video_frames):
        cv2.imwrite(str(frames_dir / f"frame_{i:04d}.jpg"), frame)

    out_path = run_dir / "recording.webm"
    fps = max(1, min(30, int(1.0 / FRAME_INTERVAL)))
    cmd = [
        ffmpeg,
        "-y",
        "-start_number",
        "0",
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
    print(f"  [video] encoding with ffmpeg ({len(video_frames)} frames @ {fps} fps)...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr[-2000:]}")
    return out_path


def save_bundle(
    slug: str,
    webm_path: Path,
    wall_clock_sec: float,
    frame_count: int,
    ffmpeg: str,
):
    bundle_dir = OUTPUT_BUNDLE / slug
    bundle_dir.mkdir(parents=True, exist_ok=True)

    raw_bytes = webm_path.read_bytes()
    if len(raw_bytes) > MAX_VIDEO_BYTES:
        print(
            f"  [video] warning: video is {len(raw_bytes) / (1024*1024):.1f} MB "
            f"(recommended max {MAX_VIDEO_BYTES // (1024*1024)} MB)",
        )

    ffprobe = _find_ffprobe(ffmpeg)
    webm_duration = _probe_webm_duration(ffprobe, webm_path) if ffprobe else None
    if webm_duration is None:
        webm_duration = frame_count / max(1, int(1.0 / FRAME_INTERVAL))
        print(
            f"  [video] warning: ffprobe unavailable; durationSec estimated as {webm_duration:.2f}",
        )

    target_fps = 1.0 / FRAME_INTERVAL
    expected_frames = max(1, int(wall_clock_sec * target_fps))
    if frame_count < expected_frames * 0.5:
        print(
            f"  [video] warning: only {frame_count} frames for {wall_clock_sec:.1f}s wall time "
            f"(expected ~{expected_frames}).",
        )
    if frame_count > 0 and len(raw_bytes) < frame_count * MIN_BYTES_PER_FRAME:
        print(
            f"  [video] warning: byteLength {len(raw_bytes)} is low for {frame_count} frames "
            f"(expected roughly >{frame_count * MIN_BYTES_PER_FRAME} bytes).",
        )

    b64 = base64.b64encode(raw_bytes).decode("ascii")
    (bundle_dir / "video.b64").write_text(b64, encoding="utf-8")

    meta = {
        "mimeType": "video/webm",
        "durationSec": round(webm_duration, 2),
        "wallClockSec": round(wall_clock_sec, 2),
        "frameCount": frame_count,
        "byteLength": len(raw_bytes),
        "recordedAt": datetime.utcnow().isoformat() + "Z",
        "contentKind": "trainingData",
        "captureSource": "camera",
    }
    (bundle_dir / "video.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(
        f"  [video] bundle -> {bundle_dir}/video.b64 "
        f"({len(b64)} chars base64, durationSec={meta['durationSec']})",
    )
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
        print(
            "Error: ffmpeg not available. Run from skill-capture: "
            "pip install -r requirements.txt  (or: npm run setup)",
        )
        sys.exit(1)

    media_input = os.environ.get("SKILL_CAPTURE_MEDIA_INPUT", "").strip()
    if media_input:
        path = Path(media_input)
        if not path.is_file():
            print(f"Error: media input not found at {path}")
            sys.exit(1)
        _capture_from_media_input(slug, path, skip_distribute, run_dir, ffmpeg)
        return

    device = _camera_device_index()
    print(f"\n=== Training data video: {slug} ===")
    print(f"Output dir: {run_dir}")
    print(f"Camera device index: {device} (override with TRAINING_CAMERA_INDEX)")
    print("\nStarting in 3 seconds...")
    time.sleep(3)
    print(
        "\nVideo recording started (camera + microphone). "
        "Type q and press Enter in the orchestrator terminal to stop.\n",
        flush=True,
    )

    start_time = time.time()
    audio_thread = threading.Thread(target=record_audio, daemon=True)
    video_thread = threading.Thread(
        target=record_camera_frames,
        args=(start_time,),
        daemon=True,
    )
    audio_thread.start()
    video_thread.start()
    wait_for_terminal_quit()
    wall_clock_sec = time.time() - start_time
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
        print("Error: no camera frames captured.")
        sys.exit(1)
    frame_count = len(video_frames)
    webm_path = _mux_to_webm(ffmpeg, run_dir, wav_path)

    if not webm_path.is_file():
        print(f"Error: recording file missing at {webm_path}")
        sys.exit(1)

    print(f"\nStopped video recording after {wall_clock_sec:.1f}s wall time.")
    save_bundle(slug, webm_path, wall_clock_sec, frame_count, ffmpeg)

    if not skip_distribute:
        from cdr_publish import publish_training_to_cdr

        bundle_dir = OUTPUT_BUNDLE / slug
        publish_training_to_cdr(slug, str(bundle_dir))

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
