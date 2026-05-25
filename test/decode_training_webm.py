"""
Decode a training bundle video.b64 to .webm and print size / duration.

Usage:
  python decode_training_webm.py path/to/video.b64
  python decode_training_webm.py path/to/training-data/<slug>   # uses video.b64 inside

Verify round-trip after capture or purchase:
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 restored.webm
"""
import base64
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _find_ffprobe() -> str | None:
    probe = shutil.which("ffprobe")
    if probe:
        return probe
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        if ffmpeg:
            sibling = Path(ffmpeg).parent / (
                "ffprobe.exe" if sys.platform == "win32" else "ffprobe"
            )
            if sibling.is_file():
                return str(sibling)
    except ImportError:
        pass
    return None


def _probe_duration(ffprobe: str, webm_path: Path) -> float | None:
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


def resolve_b64_path(arg: str) -> Path:
    p = Path(arg)
    if p.is_dir():
        candidate = p / "video.b64"
        if not candidate.is_file():
            raise FileNotFoundError(f"No video.b64 in {p}")
        return candidate
    if not p.is_file():
        raise FileNotFoundError(f"Not found: {p}")
    return p


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    b64_path = resolve_b64_path(sys.argv[1])
    out_path = b64_path.parent / "restored.webm"
    if len(sys.argv) >= 3:
        out_path = Path(sys.argv[2])

    encoded = b64_path.read_text(encoding="utf-8")
    video_data = base64.b64decode("".join(encoded.split()))
    out_path.write_bytes(video_data)

    print(f"Decoded {len(video_data)} bytes -> {out_path}")

    meta_path = b64_path.parent / "video.meta.json"
    if meta_path.is_file():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        print(
            "video.meta.json:",
            f"durationSec={meta.get('durationSec')}",
            f"wallClockSec={meta.get('wallClockSec')}",
            f"frameCount={meta.get('frameCount')}",
            f"byteLength={meta.get('byteLength')}",
        )
        if meta.get("byteLength") and meta["byteLength"] != len(video_data):
            print(
                f"  warning: byteLength {meta['byteLength']} != decoded {len(video_data)}",
            )

    ffprobe = _find_ffprobe()
    if ffprobe:
        dur = _probe_duration(ffprobe, out_path)
        if dur is not None:
            print(f"ffprobe duration: {dur:.2f}s")
        else:
            print("ffprobe: could not read duration")
    else:
        print("ffprobe not found — install ffmpeg or imageio-ffmpeg")


if __name__ == "__main__":
    main()
