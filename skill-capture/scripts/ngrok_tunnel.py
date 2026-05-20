#!/usr/bin/env python3
"""
Expose the local orchestrator (default :8790) via ngrok.

Requires: pip install pyngrok
Set NGROK_AUTHTOKEN from https://dashboard.ngrok.com/get-started/your-authtoken

Prints JSON to stdout: {"public_url": "https://....ngrok-free.app"}

With --daemon, keeps the tunnel open until SIGINT (used by orchestrator on npm run start).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Same .env as device wallet (skill-capture/.env at repo root)
SKILL_CAPTURE_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = SKILL_CAPTURE_ROOT / ".env"


def load_root_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    if ENV_FILE.is_file():
        load_dotenv(ENV_FILE, override=False)


def main() -> None:
    load_root_env()

    parser = argparse.ArgumentParser(description="Tunnel orchestrator port with ngrok")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("ORCHESTRATOR_PORT", "8790")),
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Keep tunnel alive after printing JSON (orchestrator startup)",
    )
    args = parser.parse_args()

    try:
        from pyngrok import conf, ngrok
    except ImportError:
        print(json.dumps({"error": "pyngrok not installed — run: pip install pyngrok"}))
        sys.exit(1)

    authtoken = os.environ.get("NGROK_AUTHTOKEN", "").strip()
    if not authtoken:
        print(
            json.dumps(
                {
                    "error": f"NGROK_AUTHTOKEN missing — add to {ENV_FILE}",
                }
            )
        )
        sys.exit(1)

    conf.get_default().auth_token = authtoken
    if not args.daemon:
        ngrok.kill()
    tunnel = ngrok.connect(args.port, bind_tls=True)
    public_url = str(tunnel.public_url).rstrip("/")
    print(json.dumps({"public_url": public_url, "port": args.port}), flush=True)

    if args.daemon:
        try:
            import time

            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
        finally:
            try:
                ngrok.disconnect(public_url)
            except Exception:
                ngrok.kill()


if __name__ == "__main__":
    main()
