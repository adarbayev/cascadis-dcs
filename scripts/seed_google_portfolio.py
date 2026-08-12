#!/usr/bin/env python3
"""Append missing Google public locations to the local assessment portfolio."""

from __future__ import annotations

import argparse
import asyncio
import fcntl
import json
from pathlib import Path

from dc_cooling.main import app


ROOT_DIR = Path(__file__).resolve().parents[1]
LOCK_PATH = ROOT_DIR / "backend" / "data" / "google_public_portfolio.lock"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Seed the versioned Google public-location portfolio through the live "
            "WRI Aqueduct and configured grid-carbon providers."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate the manifest and report missing IDs without source calls or writes.",
    )
    return parser.parse_args()


async def run(dry_run: bool) -> dict[str, object]:
    async with app.router.lifespan_context(app):
        result = await app.state.service.seed_google_portfolio(dry_run=dry_run)
        return result.model_dump(mode="json")


def main() -> int:
    args = parse_args()
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_PATH.open("a+") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        result = asyncio.run(run(args.dry_run))
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
