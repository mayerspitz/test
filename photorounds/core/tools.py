"""Detection of optional external tools and Python extras.

The core app needs only Python + Pillow. ExifTool, ffmpeg/ffprobe, rawpy and
pillow-heif each unlock extra capability; everything degrades gracefully and
reports what is missing instead of failing.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

# Passed to every helper-tool subprocess call so the packaged (windowed) app
# doesn't flash a console window per ExifTool/ffmpeg invocation.
SUBPROCESS_KW: dict = (
    {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
)


def user_tools_dir() -> Path:
    """Per-user folder where the app's one-click helper download installs tools."""
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
        return base / "PhotoRounds" / "tools"
    return Path.home() / ".photorounds" / "tools"


def _bundled_dir() -> Path | None:
    """Tools shipped inside the frozen .exe (PyInstaller extraction dir)."""
    base = getattr(sys, "_MEIPASS", None)
    return Path(base) / "bundled_tools" if base else None


def _find_tool(name: str) -> str | None:
    """Search order: system PATH, then the per-user tools dir, then the bundle."""
    found = shutil.which(name)
    if found:
        return found
    exe = name + (".exe" if os.name == "nt" else "")
    for root in (user_tools_dir(), _bundled_dir()):
        if root is None:
            continue
        for cand in (root / exe, root / name / exe):
            if cand.is_file():
                return str(cand)
    return None


_cache: dict[str, str | None] = {}


def _tool(name: str) -> str | None:
    if name not in _cache:
        _cache[name] = _find_tool(name)
    return _cache[name]


def refresh() -> None:
    """Forget cached tool locations (call after installing helpers)."""
    _cache.clear()


def exiftool_path() -> str | None:
    return _tool("exiftool")


def ffmpeg_path() -> str | None:
    return _tool("ffmpeg")


def ffprobe_path() -> str | None:
    return _tool("ffprobe")


@lru_cache(maxsize=None)
def has_rawpy() -> bool:
    try:
        import rawpy  # noqa: F401
        return True
    except Exception:
        return False


@lru_cache(maxsize=None)
def has_heif() -> bool:
    """Register HEIF/HEIC support into Pillow if pillow-heif is installed."""
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
        return True
    except Exception:
        return False


@dataclass
class Capability:
    name: str
    available: bool
    enables: str
    install_hint: str


def capabilities() -> list[Capability]:
    return [
        Capability("Pillow", True, "JPEG/PNG/TIFF/BMP/WebP/GIF processing", "bundled requirement"),
        Capability("pillow-heif", has_heif(), "HEIC/HEIF photos (iPhone)", "pip install pillow-heif"),
        Capability("rawpy", has_rawpy(), "true RAW development (CR2/CR3/NEF/ARW/DNG...)", "pip install rawpy"),
        Capability("ExifTool", exiftool_path() is not None,
                   "best-quality dates for RAW & video, RAW preview extraction, EXIF copy on convert",
                   "https://exiftool.org (put exiftool.exe on PATH)"),
        Capability("ffmpeg", ffmpeg_path() is not None, "video conversion to MP4",
                   "https://ffmpeg.org or 'winget install ffmpeg'"),
        Capability("ffprobe", ffprobe_path() is not None, "video capture-date detection",
                   "installed together with ffmpeg"),
    ]


def capability_report() -> str:
    lines = ["Optional components status:"]
    for cap in capabilities():
        mark = "OK " if cap.available else "-- "
        lines.append(f"  [{mark}] {cap.name:12s} {cap.enables}")
        if not cap.available:
            lines.append(f"        install: {cap.install_hint}")
    return "\n".join(lines)
