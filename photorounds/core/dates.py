"""Capture-date detection.

Priority ladder (first hit wins):
  1. EXIF DateTimeOriginal / CreateDate / DateTime read by Pillow
  2. Google Takeout JSON sidecar (photoTakenTime.timestamp)
  3. ExifTool (batched) — covers RAW formats and video containers
  4. ffprobe creation_time — videos when ExifTool is absent
  5. Date pattern embedded in the filename (IMG_20210512_143055, WhatsApp, ...)
  6. Earliest filesystem timestamp (modified / created)

The chosen source is recorded per file so the manifest can show where every
date came from.
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from . import tools
from .scan import MediaFile

EXIF_DT_ORIGINAL = 36867
EXIF_DT_DIGITIZED = 36868
EXIF_IFD = 0x8769
EXIF_DT = 306

_MIN_YEAR = 1980


def _plausible(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    now = datetime.now()
    if _MIN_YEAR <= dt.year <= now.year + 1:
        return dt
    return None


def parse_exif_datetime(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    value = value.strip().replace("\x00", "")
    # "2021:05:12 14:30:55" possibly followed by timezone offset or subseconds
    m = re.match(r"(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})", value)
    if not m:
        m = re.match(r"(\d{4})[:-](\d{2})[:-](\d{2})$", value)
        if not m:
            return None
        try:
            return _plausible(datetime(int(m[1]), int(m[2]), int(m[3])))
        except ValueError:
            return None
    try:
        return _plausible(datetime(*(int(g) for g in m.groups())))
    except ValueError:
        return None


def date_from_pillow(path: Path) -> datetime | None:
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            if not exif:
                return None
            try:
                ifd = exif.get_ifd(EXIF_IFD)
            except Exception:
                ifd = {}
            for source in (ifd.get(EXIF_DT_ORIGINAL), ifd.get(EXIF_DT_DIGITIZED),
                           exif.get(EXIF_DT_ORIGINAL), exif.get(EXIF_DT)):
                dt = parse_exif_datetime(source)
                if dt:
                    return dt
    except Exception:
        return None
    return None


def date_from_takeout_json(sidecar: Path) -> datetime | None:
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception:
        return None
    for key in ("photoTakenTime", "creationTime"):
        ts = data.get(key, {}).get("timestamp") if isinstance(data.get(key), dict) else None
        if ts is not None:
            try:
                dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            except (ValueError, OSError, OverflowError):
                continue
            dt = _plausible(dt)
            if dt:
                return dt
    return None


_FILENAME_PATTERNS = [
    # 20210512_143055 / 20210512-143055 / IMG_20210512_143055 / PXL_20210512_143055123
    re.compile(r"(?<!\d)(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})"),
    # WhatsApp: IMG-20210512-WA0001
    re.compile(r"(?<!\d)(\d{4})(\d{2})(\d{2})-WA\d+", re.IGNORECASE),
    # 2021-05-12 14.30.55 / 2021-05-12_14-30-55
    re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})[ _](\d{2})[.\-](\d{2})[.\-](\d{2})"),
    # bare date 2021-05-12 or 20210512
    re.compile(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)"),
    re.compile(r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)"),
]


def date_from_filename(name: str) -> datetime | None:
    for pat in _FILENAME_PATTERNS:
        m = pat.search(name)
        if not m:
            continue
        g = m.groups()
        try:
            if len(g) >= 6:
                dt = datetime(int(g[0]), int(g[1]), int(g[2]), int(g[3]), int(g[4]), int(g[5]))
            else:
                dt = datetime(int(g[0]), int(g[1]), int(g[2]))
        except ValueError:
            continue
        dt = _plausible(dt)
        if dt:
            return dt
    return None


def date_from_filesystem(path: Path) -> datetime:
    st = path.stat()
    candidates = [st.st_mtime]
    birth = getattr(st, "st_birthtime", None)
    if birth:
        candidates.append(birth)
    ts = min(c for c in candidates if c > 0)
    dt = _plausible(datetime.fromtimestamp(ts))
    return dt or datetime.fromtimestamp(st.st_mtime)


def _exiftool_batch(paths: list[Path]) -> dict[Path, datetime]:
    """One ExifTool invocation for many files (per-file spawning is far too slow)."""
    exe = tools.exiftool_path()
    results: dict[Path, datetime] = {}
    if not exe or not paths:
        return results
    CHUNK = 400
    for i in range(0, len(paths), CHUNK):
        chunk = paths[i:i + CHUNK]
        cmd = [exe, "-j", "-fast2", "-charset", "filename=utf8",
               "-DateTimeOriginal", "-CreateDate", "-MediaCreateDate",
               "-TrackCreateDate", "-GPSDateTime", "-FileModifyDate",
               *[str(p) for p in chunk]]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600,
                                  **tools.SUBPROCESS_KW)
            data = json.loads(proc.stdout) if proc.stdout.strip() else []
        except Exception:
            continue
        for entry in data:
            src = entry.get("SourceFile")
            if not src:
                continue
            for key in ("DateTimeOriginal", "CreateDate", "MediaCreateDate",
                        "TrackCreateDate", "GPSDateTime"):
                dt = parse_exif_datetime(entry.get(key))
                # Cameras that lost their clock write 0000/1904 epochs; skip those
                if dt:
                    results[Path(src)] = dt
                    break
    return results


def _ffprobe_date(path: Path) -> datetime | None:
    exe = tools.ffprobe_path()
    if not exe:
        return None
    try:
        proc = subprocess.run(
            [exe, "-v", "quiet", "-print_format", "json", "-show_format", str(path)],
            capture_output=True, text=True, timeout=120, **tools.SUBPROCESS_KW)
        data = json.loads(proc.stdout)
        raw = (data.get("format", {}).get("tags", {}) or {}).get("creation_time")
        if not raw:
            return None
        raw = raw.replace("Z", "+00:00")
        return _plausible(datetime.fromisoformat(raw))
    except Exception:
        return None


def resolve_dates(files: list[MediaFile],
                  progress=None) -> dict[Path, tuple[datetime, str]]:
    """Resolve (capture datetime, source label) for every file."""
    resolved: dict[Path, tuple[datetime, str]] = {}
    needs_exiftool: list[MediaFile] = []

    for idx, mf in enumerate(files):
        dt = None
        if mf.kind == "photo" and not mf.is_raw:
            dt = date_from_pillow(mf.path)
            if dt:
                resolved[mf.path] = (dt, "exif")
        if mf.path not in resolved and mf.sidecar_json:
            dt = date_from_takeout_json(mf.sidecar_json)
            if dt:
                resolved[mf.path] = (dt, "takeout-json")
        if mf.path not in resolved:
            needs_exiftool.append(mf)
        if progress and idx % 200 == 199:
            progress(f"  reading dates... {idx + 1}/{len(files)}")

    exif_batch = _exiftool_batch([mf.path for mf in needs_exiftool])
    for mf in needs_exiftool:
        hit = exif_batch.get(mf.path) or exif_batch.get(mf.path.resolve())
        if hit:
            resolved[mf.path] = (hit, "exiftool")

    for mf in files:
        if mf.path in resolved:
            continue
        if mf.kind == "video":
            dt = _ffprobe_date(mf.path)
            if dt:
                resolved[mf.path] = (dt, "video-metadata")
                continue
        dt = date_from_filename(mf.path.name)
        if dt:
            resolved[mf.path] = (dt, "filename")
        else:
            resolved[mf.path] = (date_from_filesystem(mf.path), "file-timestamp")

    return resolved
