"""Detection of optional external tools and Python extras.

The core app needs only Python + Pillow. ExifTool, ffmpeg/ffprobe, rawpy and
pillow-heif each unlock extra capability; everything degrades gracefully and
reports what is missing instead of failing.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from functools import lru_cache


@lru_cache(maxsize=None)
def exiftool_path() -> str | None:
    return shutil.which("exiftool")


@lru_cache(maxsize=None)
def ffmpeg_path() -> str | None:
    return shutil.which("ffmpeg")


@lru_cache(maxsize=None)
def ffprobe_path() -> str | None:
    return shutil.which("ffprobe")


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
