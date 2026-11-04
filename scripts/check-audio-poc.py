#!/usr/bin/env python3
"""Safe process checks: no TTY, no assets, no capture or TCC requests."""
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
BINARY = ROOT / "native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC"
CASES = [
    ([], 0, "MeetingCopilotAudioPOC"),
    (["--help"], 0, "MeetingCopilotAudioPOC"),
    (["--capture"], 64, "POC_INVALID_ARGUMENTS"),
    (["--capture", "--source", "mic"], 64, "POC_MANUAL_TERMINAL_REQUIRED"),
    (["--prepare-assets", "--capture", "--source", "both"], 64, "POC_INVALID_ARGUMENTS"),
]
for arguments, code, marker in CASES:
    result = subprocess.run(
        [str(BINARY), *arguments], stdin=subprocess.DEVNULL,
        capture_output=True, text=True, timeout=5, check=False,
    )
    if result.returncode != code or marker not in result.stdout + result.stderr:
        raise SystemExit(f"FAIL: {arguments}, exit={result.returncode}")
    if code != 0 and result.stdout:
        raise SystemExit(f"FAIL: unexpected output before rejection: {arguments}")
    print(f"PASS: {arguments or ['no arguments']}, exit={code}")
