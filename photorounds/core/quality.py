"""Quality ranking used by "keep highest quality" duplicate removal.

Score is a tuple compared lexicographically:
  (format rank, megapixels, file size)
RAW always beats a JPEG of the same shot; among same-format versions the one
with more pixels wins, then the larger (less compressed) file.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from . import tools
from .scan import MediaFile, RAW_EXTS

_FORMAT_RANK = {
    **{ext: 60 for ext in RAW_EXTS},
    ".tif": 50, ".tiff": 50,
    ".png": 40,
    ".heic": 35, ".heif": 35, ".avif": 35,
    ".webp": 25,
    ".jpg": 20, ".jpeg": 20, ".jpe": 20, ".jfif": 20,
    ".bmp": 10, ".gif": 5,
}


def pixel_count(path: Path) -> int:
    tools.has_heif()
    try:
        with Image.open(path) as im:
            w, h = im.size
        return w * h
    except Exception:
        return 0


def quality_score(mf: MediaFile) -> tuple[float, int, int]:
    rank = _FORMAT_RANK.get(mf.ext, 15)
    pixels = pixel_count(mf.path) if (mf.kind == "photo" and not mf.is_raw) else 0
    return (rank, pixels, mf.size)


def pick_best(candidates: list[MediaFile]) -> MediaFile:
    """Highest quality wins; ties broken by first path alphabetically for determinism."""
    best = candidates[0]
    best_score = quality_score(best)
    for mf in candidates[1:]:
        score = quality_score(mf)
        if score > best_score or (score == best_score
                                  and str(mf.path).lower() < str(best.path).lower()):
            best, best_score = mf, score
    return best
