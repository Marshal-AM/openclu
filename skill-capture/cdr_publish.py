"""Spawn CLI distribute (local Story + Helia + Arkiv - no HTTP servers)."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CLI_DIR = ROOT / "cli"


def _node_tsx_distribute(skill_name: str, bundle_dir: Path | None = None) -> int:
    """Run distribute via node + tsx (avoids npm.cmd EINVAL on Windows)."""
    node = os.environ.get("NODE", "node")
    tsx = CLI_DIR / "node_modules" / "tsx" / "dist" / "cli.mjs"
    pipeline = CLI_DIR / "src" / "pipeline.ts"
    if not tsx.is_file():
        print("tsx missing — run: cd skill-capture/cli && npm install", file=sys.stderr)
        return 1
    args = [str(tsx), str(pipeline), "distribute", skill_name]
    if bundle_dir is not None:
        args.append(str(bundle_dir))
    print(f"\n=== Distributing {skill_name} via CLI ===\n")
    r = subprocess.run(
        [node, *args],
        cwd=CLI_DIR,
        env={**os.environ},
        shell=False,
    )
    return r.returncode


def publish_skill_to_cdr(skill_name: str, bundle_dir: Path) -> int:
    return _node_tsx_distribute(skill_name, bundle_dir)


def publish_training_to_cdr(skill_name: str, bundle_dir: str | Path) -> int:
    """Run distribute-training via node + tsx."""
    node = os.environ.get("NODE", "node")
    tsx = CLI_DIR / "node_modules" / "tsx" / "dist" / "cli.mjs"
    pipeline = CLI_DIR / "src" / "pipeline.ts"
    if not tsx.is_file():
        print("tsx missing — run: cd skill-capture/cli && npm install", file=sys.stderr)
        return 1
    bundle = Path(bundle_dir)
    args = [str(tsx), str(pipeline), "distribute-training", skill_name, str(bundle)]
    print(f"\n=== Distributing training data {skill_name} via CLI ===\n")
    r = subprocess.run(
        [node, *args],
        cwd=CLI_DIR,
        env={**os.environ},
        shell=False,
    )
    return r.returncode


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python cdr_publish.py <skill-name> <bundle-dir>")
        sys.exit(1)
    sys.exit(publish_skill_to_cdr(sys.argv[1], Path(sys.argv[2])))
