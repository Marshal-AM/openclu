#!/usr/bin/env python3
"""Install Python dependencies and ensure ffmpeg is available for training video capture."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def resolve_python() -> str:
    if sys.platform == "win32":
        venv_py = ROOT / "venv" / "Scripts" / "python.exe"
    else:
        venv_py = ROOT / "venv" / "bin" / "python"
    if venv_py.is_file():
        return str(venv_py)
    return sys.executable


def main() -> int:
    py = resolve_python()
    req = ROOT / "requirements.txt"
    print(f"  [setup] Installing Python deps with {py} …")
    subprocess.check_call([py, "-m", "pip", "install", "-r", str(req)])

    print("  [setup] Ensuring ffmpeg for training video encoding …")
    subprocess.check_call(
        [py, "-c", "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"],
        cwd=str(ROOT),
    )
    print("  [setup] Python dependencies ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
