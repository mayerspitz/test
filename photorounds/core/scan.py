"""Media discovery: walk sources, classify files, pair Google Takeout sidecars."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

RAW_EXTS = {
    ".cr2", ".cr3", ".crw",              # Canon
    ".nef", ".nrw",                      # Nikon
    ".arw", ".srf", ".sr2",              # Sony
    ".orf",                              # Olympus
    ".rw2",                              # Panasonic
    ".raf",                              # Fujifilm
    ".pef",                              # Pentax
    ".srw",                              # Samsung
    ".dng", ".raw", ".x3f", ".3fr", ".kdc", ".mrw", ".mef", ".erf",
}

PHOTO_EXTS = RAW_EXTS | {
    ".jpg", ".jpeg", ".jpe", ".jfif",
    ".png", ".gif", ".bmp",
    ".tif", ".tiff",
    ".webp", ".heic", ".heif", ".avif",
}

VIDEO_EXTS = {
    ".mp4", ".m4v", ".mov", ".avi", ".mkv", ".wmv",
    ".mpg", ".mpeg", ".mts", ".m2ts", ".m2v", ".3gp", ".3g2",
    ".webm", ".flv", ".vob", ".ts", ".divx",
}

SKIP_NAMES = {"thumbs.db", "desktop.ini", ".ds_store", "zbthumbnail.info", "picasa.ini", ".picasa.ini"}
SKIP_DIRS = {"@eadir", ".thumbnails", "$recycle.bin", "system volume information", "_round_info"}


@dataclass
class MediaFile:
    path: Path
    kind: str                     # "photo" | "video"
    size: int
    sidecar_json: Path | None = None   # Google Takeout metadata JSON, if found
    extras: dict = field(default_factory=dict)

    @property
    def ext(self) -> str:
        return self.path.suffix.lower()

    @property
    def is_raw(self) -> bool:
        return self.ext in RAW_EXTS


def classify(path: Path) -> str | None:
    ext = path.suffix.lower()
    if ext in PHOTO_EXTS:
        return "photo"
    if ext in VIDEO_EXTS:
        return "video"
    return None


def _find_takeout_sidecar(path: Path) -> Path | None:
    """Locate the Google Takeout JSON sidecar for a media file, if any.

    Takeout has produced several naming schemes over the years:
      IMG.jpg.json, IMG.jpg.supplemental-metadata.json (sometimes truncated),
      IMG.json, and for numbered copies IMG(1).jpg -> IMG.jpg(1).json.
    """
    parent, name, stem = path.parent, path.name, path.stem
    candidates = [parent / f"{name}.json", parent / f"{stem}.json"]
    if stem.endswith(")") and "(" in stem:
        base, _, num = stem.rpartition("(")
        candidates.append(parent / f"{base}{path.suffix}({num[:-1]}).json")
    for cand in candidates:
        if cand.is_file():
            return cand
    # Truncated/suffixed variants: "<full media filename>.<anything>.json"
    prefix = name + "."
    try:
        for entry in os.scandir(parent):
            if entry.name.startswith(prefix) and entry.name.lower().endswith(".json"):
                return Path(entry.path)
    except OSError:
        pass
    return None


def collect(sources: list[Path | str], find_sidecars: bool = True) -> list[MediaFile]:
    """Gather media files from files/folders. Folders are walked recursively."""
    found: dict[Path, MediaFile] = {}

    def add(p: Path) -> None:
        if p.name.lower() in SKIP_NAMES or p.name.startswith("._"):
            return
        kind = classify(p)
        if kind is None:
            return
        try:
            size = p.stat().st_size
        except OSError:
            return
        rp = p.resolve()
        if rp in found:
            return
        sidecar = _find_takeout_sidecar(p) if find_sidecars else None
        found[rp] = MediaFile(path=p, kind=kind, size=size, sidecar_json=sidecar)

    for src in sources:
        src = Path(src)
        if src.is_file():
            add(src)
        elif src.is_dir():
            for root, dirs, files in os.walk(src):
                dirs[:] = [d for d in dirs if d.lower() not in SKIP_DIRS and not d.startswith(".")]
                for fname in files:
                    add(Path(root) / fname)

    return sorted(found.values(), key=lambda m: str(m.path).lower())
