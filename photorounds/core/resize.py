"""Round 4 engine: resize photos for printing (4x6 and friends).

Print sizes are specified in inches at a chosen DPI (default 300, the print
industry standard). The image is auto-rotated per its EXIF orientation, the
target is flipped to portrait when the photo is portrait, and by default the
photo is scaled+center-cropped to fill the print exactly — what photo labs do.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from . import tools

PRINT_PRESETS: dict[str, tuple[float, float]] = {
    "4x6": (4, 6), "5x7": (5, 7), "8x10": (8, 10),
    "3.5x5": (3.5, 5), "11x14": (11, 14), "A4": (8.27, 11.69),
}

FIT_MODES = ("crop", "fit", "pad")


@dataclass
class ResizeSpec:
    width_px: int
    height_px: int
    dpi: int = 300
    mode: str = "crop"          # crop=fill print exactly, fit=shrink only, pad=white borders
    label: str = ""

    @classmethod
    def from_preset(cls, preset: str, dpi: int = 300, mode: str = "crop") -> "ResizeSpec":
        if preset not in PRINT_PRESETS:
            raise ValueError(f"unknown size {preset!r}; options: {', '.join(PRINT_PRESETS)}")
        w_in, h_in = PRINT_PRESETS[preset]
        return cls(round(w_in * dpi), round(h_in * dpi), dpi, mode, label=preset)

    @classmethod
    def from_pixels(cls, width: int, height: int, dpi: int = 300, mode: str = "crop") -> "ResizeSpec":
        return cls(width, height, dpi, mode, label=f"{width}x{height}px")


@dataclass
class ResizeOutcome:
    dest: Path
    action: str                 # "resized" | "failed"
    low_res: bool = False
    note: str = ""


def _oriented_target(im: Image.Image, spec: ResizeSpec) -> tuple[int, int]:
    """Match target orientation to the photo: portrait photo -> portrait print."""
    long_side, short_side = max(spec.width_px, spec.height_px), min(spec.width_px, spec.height_px)
    if im.height >= im.width:
        return short_side, long_side
    return long_side, short_side


def resize_photo(src: Path, dest: Path, spec: ResizeSpec,
                 jpeg_quality: int = 95) -> ResizeOutcome:
    tools.has_heif()
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with Image.open(src) as raw_im:
            im = ImageOps.exif_transpose(raw_im)
            exif_bytes = raw_im.info.get("exif")
            icc = raw_im.info.get("icc_profile")
            tw, th = _oriented_target(im, spec)

            # effective DPI if this image were printed at the requested physical size
            scale = max(tw / im.width, th / im.height)
            effective_dpi = spec.dpi / scale if scale > 0 else spec.dpi
            low_res = scale > 2.0 or effective_dpi < 150

            if spec.mode == "crop":
                out = ImageOps.fit(im, (tw, th), Image.LANCZOS, centering=(0.5, 0.5))
            elif spec.mode == "fit":
                out = im.copy()
                out.thumbnail((tw, th), Image.LANCZOS)
            else:  # pad
                fitted = im.copy()
                fitted.thumbnail((tw, th), Image.LANCZOS)
                canvas = Image.new("RGB", (tw, th), (255, 255, 255))
                canvas.paste(fitted, ((tw - fitted.width) // 2, (th - fitted.height) // 2))
                out = canvas

            if out.mode != "RGB":
                out = out.convert("RGB")

            dest = dest.with_suffix(".jpg")
            params: dict = {"quality": jpeg_quality, "optimize": True,
                            "dpi": (spec.dpi, spec.dpi)}
            if exif_bytes:
                params["exif"] = exif_bytes
            if icc:
                params["icc_profile"] = icc
            out.save(dest, "JPEG", **params)

        note = f"{im.width}x{im.height} -> {out.width}x{out.height}"
        if low_res:
            note += f" (LOW RESOLUTION: ~{effective_dpi:.0f} DPI at {spec.label or 'target'} size)"
        return ResizeOutcome(dest, "resized", low_res=low_res, note=note)
    except Exception as exc:
        return ResizeOutcome(dest, "failed", note=str(exc))
