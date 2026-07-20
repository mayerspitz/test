"""Exact and perceptual hashing — pure Pillow, no numpy required.

Exact duplicates: SHA-256 over file bytes.
Near duplicates (same picture, different size/compression/format): 64-bit
difference hash (dHash) over an 8x8 grayscale reduction; two photos are
"near" when the Hamming distance of their dHashes is small.
"""

from __future__ import annotations

import hashlib
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

from . import tools
from .scan import RAW_EXTS


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            block = f.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def dhash_image(im: Image.Image, hash_size: int = 8) -> int:
    im = ImageOps.exif_transpose(im)
    gray = im.convert("L").resize((hash_size + 1, hash_size), Image.LANCZOS)
    if hasattr(gray, "get_flattened_data"):      # Pillow >= 12; getdata removed in 14
        px = list(gray.get_flattened_data())
    else:
        px = list(gray.getdata())
    bits = 0
    w = hash_size + 1
    for row in range(hash_size):
        for col in range(hash_size):
            bits = (bits << 1) | (1 if px[row * w + col] > px[row * w + col + 1] else 0)
    return bits


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def _raw_preview_image(path: Path) -> Image.Image | None:
    """Get a viewable image for a RAW file: rawpy if present, else the JPEG
    preview embedded in the RAW extracted with ExifTool."""
    if tools.has_rawpy():
        try:
            import rawpy
            with rawpy.imread(str(path)) as raw:
                rgb = raw.postprocess(use_camera_wb=True, half_size=True, output_bps=8)
            return Image.fromarray(rgb)
        except Exception:
            pass
    exe = tools.exiftool_path()
    if exe:
        for tag in ("-JpgFromRaw", "-PreviewImage", "-ThumbnailImage"):
            try:
                proc = subprocess.run([exe, "-b", tag, str(path)],
                                      capture_output=True, timeout=120,
                                      **tools.SUBPROCESS_KW)
                if proc.returncode == 0 and len(proc.stdout) > 1000:
                    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
                        tf.write(proc.stdout)
                        tmp = Path(tf.name)
                    try:
                        with Image.open(tmp) as im:
                            im.load()
                            return im.copy()
                    finally:
                        tmp.unlink(missing_ok=True)
            except Exception:
                continue
    return None


def open_for_hash(path: Path) -> Image.Image | None:
    """Open any photo well enough to perceptually hash it. None => exact-hash only."""
    tools.has_heif()
    if path.suffix.lower() in RAW_EXTS:
        return _raw_preview_image(path)
    try:
        with Image.open(path) as im:
            im.load()
            return im.copy()
    except Exception:
        return None


def perceptual_hash(path: Path) -> int | None:
    im = open_for_hash(path)
    if im is None:
        return None
    try:
        return dhash_image(im)
    except Exception:
        return None
    finally:
        im.close()


def near_duplicate_clusters(hashes: dict[Path, int], threshold: int = 4) -> list[set[Path]]:
    """Cluster paths whose dHashes are within `threshold` Hamming distance.

    Uses multi-index bucketing: split each 64-bit hash into threshold+1 bands;
    any two hashes within the threshold must agree exactly on at least one
    band, so only files sharing a band are compared pairwise. Scales far
    beyond the naive O(n^2) all-pairs comparison.
    """
    paths = list(hashes)
    parent: dict[Path, Path] = {p: p for p in paths}

    def find(x: Path) -> Path:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: Path, b: Path) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    bands = threshold + 1
    band_bits = 64 // bands
    buckets: dict[tuple[int, int], list[Path]] = {}
    for p in paths:
        h = hashes[p]
        for b in range(bands):
            key = (b, (h >> (b * band_bits)) & ((1 << band_bits) - 1))
            buckets.setdefault(key, []).append(p)

    for members in buckets.values():
        if len(members) < 2:
            continue
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                a, b = members[i], members[j]
                if find(a) != find(b) and hamming(hashes[a], hashes[b]) <= threshold:
                    union(a, b)

    clusters: dict[Path, set[Path]] = {}
    for p in paths:
        clusters.setdefault(find(p), set()).add(p)
    return [c for c in clusters.values() if len(c) > 1]
