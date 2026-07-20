"""Date-based folder layout and chronological file naming.

Folder and file names are built so that plain alphabetical order in Windows
Explorer equals chronological order (earliest first) — no special sorting
software needed at the print store.
"""

from __future__ import annotations

import calendar
import re
from datetime import datetime
from pathlib import Path, PurePosixPath

GRANULARITIES = ("year", "month", "week", "day")

_WINDOWS_FORBIDDEN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_component(name: str) -> str:
    """Make a string safe as a single Windows/macOS/Linux path component."""
    cleaned = _WINDOWS_FORBIDDEN.sub("_", name).strip().rstrip(". ")
    return cleaned or "file"


def folder_for(dt: datetime, granularity: str = "month", month_names: bool = True) -> PurePosixPath:
    if granularity not in GRANULARITIES:
        raise ValueError(f"granularity must be one of {GRANULARITIES}, got {granularity!r}")
    year = f"{dt.year:04d}"
    month = f"{dt.year:04d}-{dt.month:02d}"
    if month_names:
        month += f" {calendar.month_name[dt.month]}"
    if granularity == "year":
        return PurePosixPath(year)
    if granularity == "month":
        return PurePosixPath(year) / month
    if granularity == "week":
        iso = dt.isocalendar()
        return PurePosixPath(f"{iso.year:04d}") / f"{iso.year:04d}-W{iso.week:02d}"
    return PurePosixPath(year) / month / f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}"


_TS_PREFIX = re.compile(r"^\d{8}_\d{6}_")


def chrono_name(dt: datetime, original_name: str) -> str:
    """`20210512_143055_beach.jpg` — sorts chronologically, keeps the original name."""
    stem = Path(original_name).stem
    ext = Path(original_name).suffix.lower()
    stem = _TS_PREFIX.sub("", stem)  # don't stack prefixes when re-ingesting our own output
    stem = sanitize_component(stem)[:80]
    stamp = f"{dt:%Y%m%d_%H%M%S}"
    if stem == stamp:                # filename was already exactly this timestamp
        return f"{stamp}{ext}"
    return f"{stamp}_{stem}{ext}"


def unique_path(dest_dir: Path, filename: str) -> Path:
    """Resolve name collisions with _001, _002... suffixes."""
    candidate = dest_dir / filename
    if not candidate.exists():
        return candidate
    stem, ext = Path(filename).stem, Path(filename).suffix
    for i in range(1, 10000):
        candidate = dest_dir / f"{stem}_{i:03d}{ext}"
        if not candidate.exists():
            return candidate
    raise FileExistsError(f"could not find a free name for {filename} in {dest_dir}")


UNKNOWN_DATE_FOLDER = "_Unknown_Date"


def target_relpath(dt: datetime | None, original_name: str, granularity: str = "month",
                   month_names: bool = True) -> PurePosixPath:
    """Relative destination (folder + chronological filename) for one file."""
    if dt is None:
        return PurePosixPath(UNKNOWN_DATE_FOLDER) / sanitize_component(original_name)
    return folder_for(dt, granularity, month_names) / chrono_name(dt, original_name)
