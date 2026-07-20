from __future__ import annotations

import json
import os
import random
from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image


def make_photo(path: Path, size=(320, 240), seed: int = 1,
               exif_dt: datetime | None = None, fmt: str | None = None,
               quality: int = 90) -> Path:
    """Create a synthetic photo with random-ish but deterministic content."""
    rng = random.Random(seed)
    im = Image.new("RGB", size)
    px = im.load()
    for x in range(0, size[0], 8):
        for y in range(0, size[1], 8):
            color = (rng.randrange(256), rng.randrange(256), rng.randrange(256))
            for dx in range(8):
                for dy in range(8):
                    if x + dx < size[0] and y + dy < size[1]:
                        px[x + dx, y + dy] = color
    path.parent.mkdir(parents=True, exist_ok=True)
    params = {}
    if exif_dt is not None:
        exif = Image.Exif()
        stamp = exif_dt.strftime("%Y:%m:%d %H:%M:%S")
        exif[306] = stamp
        exif.get_ifd(0x8769)[36867] = stamp
        params["exif"] = exif
    if (fmt or path.suffix.lstrip(".")).lower() in ("jpg", "jpeg"):
        params["quality"] = quality
    im.save(path, fmt, **params)
    return path


def resave(src: Path, dest: Path, scale: float = 1.0, quality: int = 60,
           fmt: str | None = None) -> Path:
    """Re-export an existing photo (recompressed / resized) => near duplicate."""
    with Image.open(src) as im:
        if scale != 1.0:
            im = im.resize((max(8, int(im.width * scale)), max(8, int(im.height * scale))),
                           Image.LANCZOS)
        params = {"quality": quality} if (fmt or dest.suffix.lstrip(".")).lower() in ("jpg", "jpeg") else {}
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.convert("RGB").save(dest, fmt, **params)
    return dest


def make_takeout_sidecar(media: Path, taken: datetime,
                         name: str | None = None) -> Path:
    sidecar = media.parent / (name or f"{media.name}.supplemental-metadata.json")
    sidecar.write_text(json.dumps({
        "title": media.name,
        "photoTakenTime": {"timestamp": str(int(taken.timestamp())),
                           "formatted": taken.isoformat()},
        "creationTime": {"timestamp": str(int(taken.timestamp()) + 999999)},
    }), encoding="utf-8")
    return sidecar


def set_mtime(path: Path, dt: datetime) -> None:
    ts = dt.timestamp()
    os.utime(path, (ts, ts))


@pytest.fixture
def workspace(tmp_path: Path) -> dict[str, Path]:
    src = tmp_path / "sources"
    project = tmp_path / "project"
    src.mkdir()
    return {"tmp": tmp_path, "src": src, "project": project}
