#!/usr/bin/env python3
"""Prepare a pinned Aqueduct 4.0 Baseline Annual GeoPackage.

The script deliberately stops after data preparation. The MVP keeps the local
provider disabled until its lookup implementation and release controls are
approved.
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile


SOURCE_URL = "https://files.wri.org/aqueduct/aqueduct-4-0-water-risk-data.zip"
PINNED_SHA256 = "bd3ed2bce88d6ff1b89191632ad134a2436e1e1d49599382f23a04d513624fc3"
SOURCE_GDB = "Aq40_Y2023D07M05.gdb"
SOURCE_LAYER = "baseline_annual"
OUTPUT_LAYER = "aqueduct_baseline_annual"
FIELDS = (
    "aq30_id,pfaf_id,aqid,gid_0,gid_1,name_0,name_1,"
    "bws_raw,bws_score,bws_cat,bws_label,"
    "w_awr_def_tot_raw,w_awr_def_tot_score,w_awr_def_tot_cat,"
    "w_awr_def_tot_label,w_awr_def_tot_weight_fraction,"
    "w_awr_elp_qan_raw,w_awr_elp_qan_score,w_awr_elp_qan_cat,"
    "w_awr_elp_qan_label,w_awr_elp_tot_raw,w_awr_elp_tot_score,"
    "w_awr_elp_tot_cat,w_awr_elp_tot_label,w_awr_elp_tot_weight_fraction,"
    "w_awr_smc_tot_raw,w_awr_smc_tot_score,w_awr_smc_tot_cat,"
    "w_awr_smc_tot_label,w_awr_smc_tot_weight_fraction"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--archive",
        type=Path,
        default=Path("data/aqueduct/aqueduct-4-0-water-risk-data.zip"),
        help="Path to the official WRI ZIP archive.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/aqueduct/aqueduct_4_0_baseline_annual.gpkg"),
        help="Output GeoPackage path.",
    )
    parser.add_argument("--download", action="store_true", help="Download the pinned archive when absent.")
    parser.add_argument("--expected-sha256", default=PINNED_SHA256)
    args = parser.parse_args()

    ogr2ogr = shutil.which("ogr2ogr")
    if ogr2ogr is None:
        print("ogr2ogr is required. Install GDAL before preparing the local dataset.", file=sys.stderr)
        return 2
    if not args.archive.exists():
        if not args.download:
            print(f"Archive not found: {args.archive}. Pass --download or supply --archive.", file=sys.stderr)
            return 2
        download(args.archive)

    actual_hash = sha256(args.archive)
    if actual_hash.lower() != args.expected_sha256.lower():
        print(
            f"Checksum mismatch for {args.archive}: expected {args.expected_sha256}, got {actual_hash}",
            file=sys.stderr,
        )
        return 3

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="aqueduct-4-") as temporary:
        extract_root = Path(temporary)
        with zipfile.ZipFile(args.archive) as archive:
            archive.extractall(extract_root)
        candidates = list(extract_root.rglob(SOURCE_GDB))
        if len(candidates) != 1:
            print(f"Expected one {SOURCE_GDB}; found {len(candidates)}.", file=sys.stderr)
            return 4
        subprocess.run(
            [
                ogr2ogr,
                "-f",
                "GPKG",
                str(args.output),
                str(candidates[0]),
                SOURCE_LAYER,
                "-nln",
                OUTPUT_LAYER,
                "-select",
                FIELDS,
                "-t_srs",
                "EPSG:4326",
                "-lco",
                "SPATIAL_INDEX=YES",
                "-overwrite",
            ],
            check=True,
        )

    print(f"Prepared {args.output}")
    print(f"Source SHA-256: {actual_hash}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
