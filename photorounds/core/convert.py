"""Round 3 engine: normalize everything to universal formats.

Photos of any format (RAW included) become high-quality JPEG; files already
JPEG are copied through untouched (no generation loss). Videos become MP4
(H.264/AAC) via ffmpeg, or are copied through when ffmpeg is unavailable or
the file is already MP4.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

from . import tools
from .scan import MediaFile


@dataclass
class ConvertOutcome:
    dest: Path
    action: str        # "converted" | "copied" | "failed"
    note: str = ""


def _stamp_times(dest: Path, dt: datetime | None) -> None:
    """Keep the capture date as the file's modified time so chronology
    survives even in formats/paths where EXIF is lost."""
    if dt is None:
        return
    try:
        import os
        ts = dt.timestamp()
        os.utime(dest, (ts, ts))
    except (OSError, OverflowError, ValueError):
        pass


def _copy_exif_with_exiftool(src: Path, dest: Path) -> bool:
    exe = tools.exiftool_path()
    if not exe:
        return False
    try:
        proc = subprocess.run(
            [exe, "-overwrite_original", "-tagsfromfile", str(src),
             "-exif:all", "-icc_profile", str(dest)],
            capture_output=True, timeout=120)
        return proc.returncode == 0
    except Exception:
        return False


def _develop_raw(src: Path) -> Image.Image | None:
    if tools.has_rawpy():
        try:
            import rawpy
            with rawpy.imread(str(src)) as raw:
                rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
            return Image.fromarray(rgb)
        except Exception:
            pass
    return None


def _extract_raw_jpeg(src: Path, dest: Path) -> bool:
    """Fall back to the full-size JPEG most cameras embed inside the RAW."""
    exe = tools.exiftool_path()
    if not exe:
        return False
    for tag in ("-JpgFromRaw", "-PreviewImage"):
        try:
            proc = subprocess.run([exe, "-b", tag, str(src)],
                                  capture_output=True, timeout=180)
            if proc.returncode == 0 and len(proc.stdout) > 50_000:
                dest.write_bytes(proc.stdout)
                return True
        except Exception:
            continue
    return False


def _flatten_to_rgb(im: Image.Image) -> Image.Image:
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA", "PA"):
        background = Image.new("RGB", im.size, (255, 255, 255))
        background.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
        return background
    if im.mode != "RGB":
        return im.convert("RGB")
    return im


def photo_to_jpeg(mf: MediaFile, dest: Path, jpeg_quality: int = 95,
                  capture_dt: datetime | None = None) -> ConvertOutcome:
    dest = dest.with_suffix(".jpg")
    dest.parent.mkdir(parents=True, exist_ok=True)

    if mf.ext in (".jpg", ".jpeg", ".jpe", ".jfif"):
        shutil.copy2(mf.path, dest)
        _stamp_times(dest, capture_dt)
        return ConvertOutcome(dest, "copied", "already JPEG, copied without recompression")

    if mf.is_raw:
        developed = _develop_raw(mf.path)
        if developed is not None:
            developed.save(dest, "JPEG", quality=jpeg_quality, optimize=True)
            _copy_exif_with_exiftool(mf.path, dest)
            _stamp_times(dest, capture_dt)
            return ConvertOutcome(dest, "converted", "RAW developed with rawpy (camera white balance)")
        if _extract_raw_jpeg(mf.path, dest):
            _copy_exif_with_exiftool(mf.path, dest)
            _stamp_times(dest, capture_dt)
            return ConvertOutcome(dest, "converted", "embedded full-size JPEG extracted from RAW")
        shutil.copy2(mf.path, dest.with_suffix(mf.ext))
        _stamp_times(dest.with_suffix(mf.ext), capture_dt)
        return ConvertOutcome(dest.with_suffix(mf.ext), "copied",
                              "RAW kept as-is: install rawpy or ExifTool to convert")

    tools.has_heif()
    try:
        with Image.open(mf.path) as im:
            exif_bytes = im.info.get("exif")
            if not exif_bytes:
                # TIFF & friends keep tags natively instead of an EXIF blob
                exif_obj = im.getexif()
                if exif_obj:
                    exif_bytes = exif_obj.tobytes()
            icc = im.info.get("icc_profile")
            out = _flatten_to_rgb(im)
            params: dict = {"quality": jpeg_quality, "optimize": True}
            if exif_bytes:
                params["exif"] = exif_bytes
            if icc:
                params["icc_profile"] = icc
            out.save(dest, "JPEG", **params)
        _stamp_times(dest, capture_dt)
        return ConvertOutcome(dest, "converted", f"{mf.ext} -> .jpg")
    except Exception as exc:
        fallback = dest.with_suffix(mf.ext)
        shutil.copy2(mf.path, fallback)
        _stamp_times(fallback, capture_dt)
        return ConvertOutcome(fallback, "copied", f"could not convert ({exc}); original copied")


def _video_codec(path: Path) -> str | None:
    exe = tools.ffprobe_path()
    if not exe:
        return None
    try:
        proc = subprocess.run(
            [exe, "-v", "quiet", "-select_streams", "v:0", "-show_entries",
             "stream=codec_name", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, timeout=120)
        return proc.stdout.strip() or None
    except Exception:
        return None


def video_to_mp4(mf: MediaFile, dest: Path,
                 capture_dt: datetime | None = None) -> ConvertOutcome:
    dest = dest.with_suffix(".mp4")
    dest.parent.mkdir(parents=True, exist_ok=True)

    if mf.ext in (".mp4", ".m4v") and _video_codec(mf.path) in ("h264", "hevc", None):
        shutil.copy2(mf.path, dest)
        _stamp_times(dest, capture_dt)
        return ConvertOutcome(dest, "copied", "already an MP4, copied unchanged")

    exe = tools.ffmpeg_path()
    if not exe:
        fallback = dest.with_suffix(mf.ext)
        shutil.copy2(mf.path, fallback)
        _stamp_times(fallback, capture_dt)
        return ConvertOutcome(fallback, "copied", "ffmpeg not installed: video copied in original format")

    try:
        proc = subprocess.run(
            [exe, "-y", "-v", "error", "-i", str(mf.path),
             "-map_metadata", "0",
             "-c:v", "libx264", "-crf", "20", "-preset", "medium",
             "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k",
             "-movflags", "+faststart",
             str(dest)],
            capture_output=True, text=True, timeout=7200)
        if proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
            _stamp_times(dest, capture_dt)
            return ConvertOutcome(dest, "converted", f"{mf.ext} -> .mp4 (H.264/AAC)")
        err = (proc.stderr or "").strip().splitlines()
        note = err[-1] if err else "ffmpeg failed"
    except Exception as exc:
        note = str(exc)

    dest.unlink(missing_ok=True)
    fallback = dest.with_suffix(mf.ext)
    shutil.copy2(mf.path, fallback)
    _stamp_times(fallback, capture_dt)
    return ConvertOutcome(fallback, "copied", f"conversion failed ({note}); original copied")
