#!/usr/bin/env python3
"""Run the API and dashboard together for local development."""

from __future__ import annotations

import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[1]


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def stop(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return


def dashboard_command(host: str, port: str, environment: dict[str, str]) -> list[str]:
    """Launch Vite with the host architecture on Apple Silicon.

    A Rosetta-only Python can otherwise cause a universal Node binary to start
    as x86_64, even when npm installed Rollup's arm64 package from the native
    shell. Calling Node through ``arch -arm64`` keeps the runtime aligned with
    the installed dashboard dependencies.
    """

    vite_entry = ROOT / "dashboard" / "node_modules" / "vite" / "bin" / "vite.js"
    node = shutil.which("node", path=environment.get("PATH"))
    if sys.platform == "darwin" and node and vite_entry.exists():
        arm64_capable = subprocess.run(
            ["/usr/sbin/sysctl", "-n", "hw.optional.arm64"],
            check=False,
            capture_output=True,
            text=True,
        ).stdout.strip() == "1"
        command = [
            node,
            str(vite_entry),
            str(ROOT / "dashboard"),
            "--host",
            host,
            "--port",
            port,
        ]
        if arm64_capable:
            return ["/usr/bin/arch", "-arm64", *command]
        return command
    return [
        "npm",
        "--prefix",
        str(ROOT / "dashboard"),
        "run",
        "dev",
        "--",
        "--host",
        host,
        "--port",
        port,
    ]


def main() -> int:
    environment = os.environ.copy()
    for key, value in load_env(ROOT / ".env").items():
        environment.setdefault(key, value)

    host = environment.get("API_HOST", "127.0.0.1")
    api_port = environment.get("API_PORT", "8000")
    dashboard_port = environment.get("DASHBOARD_PORT", "5173")
    environment.setdefault("VITE_API_PROXY_TARGET", f"http://{host}:{api_port}")

    node_modules = ROOT / "dashboard" / "node_modules"
    if not node_modules.exists():
        print("Dashboard dependencies are missing. Run `make setup` first.", file=sys.stderr)
        return 2

    processes_to_start = [
        (
            [
                sys.executable,
                "-m",
                "uvicorn",
                "dc_cooling.main:app",
                "--app-dir",
                str(ROOT / "backend" / "src"),
                "--host",
                host,
                "--port",
                api_port,
                "--reload",
            ],
            ROOT,
        ),
        (dashboard_command(host, dashboard_port, environment), ROOT / "dashboard"),
    ]

    processes: list[subprocess.Popen[bytes]] = []
    try:
        for command, working_directory in processes_to_start:
            processes.append(
                subprocess.Popen(
                    command,
                    cwd=working_directory,
                    env=environment,
                    start_new_session=True,
                )
            )
        print(f"API:       http://{host}:{api_port}/docs")
        print(f"Dashboard: http://{host}:{dashboard_port}")
        while True:
            for process in processes:
                exit_code = process.poll()
                if exit_code is not None:
                    return exit_code
            time.sleep(0.25)
    except KeyboardInterrupt:
        return 0
    finally:
        for process in processes:
            stop(process)
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass


if __name__ == "__main__":
    raise SystemExit(main())
