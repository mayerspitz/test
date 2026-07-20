from datetime import datetime
from pathlib import Path

from PIL import Image

from photorounds.core import convert, scan
from photorounds.core.resize import PRINT_PRESETS, ResizeSpec, resize_photo

from conftest import make_photo


def _mf(path: Path) -> scan.MediaFile:
    return scan.MediaFile(path=path, kind=scan.classify(path) or "photo",
                          size=path.stat().st_size)


def test_png_to_jpeg(tmp_path):
    src = make_photo(tmp_path / "in.png", size=(300, 200))
    out = convert.photo_to_jpeg(_mf(src), tmp_path / "out" / "in.png",
                                capture_dt=datetime(2020, 5, 1, 12, 0, 0))
    assert out.action == "converted"
    assert out.dest.suffix == ".jpg"
    with Image.open(out.dest) as im:
        assert im.format == "JPEG" and im.size == (300, 200)
    assert datetime.fromtimestamp(out.dest.stat().st_mtime).year == 2020


def test_jpeg_copied_byte_identical(tmp_path):
    src = make_photo(tmp_path / "photo.jpg", exif_dt=datetime(2019, 2, 3, 4, 5, 6))
    out = convert.photo_to_jpeg(_mf(src), tmp_path / "out" / "photo.jpg")
    assert out.action == "copied"
    assert out.dest.read_bytes() == src.read_bytes()


def test_rgba_flattened_on_white(tmp_path):
    src = tmp_path / "logo.png"
    Image.new("RGBA", (60, 40), (255, 0, 0, 0)).save(src)
    out = convert.photo_to_jpeg(_mf(src), tmp_path / "out" / "logo.png")
    with Image.open(out.dest) as im:
        assert im.mode == "RGB"
        assert im.getpixel((5, 5)) == (255, 255, 255)


def test_exif_preserved_through_conversion(tmp_path):
    dt = datetime(2017, 8, 9, 10, 11, 12)
    src = make_photo(tmp_path / "in.tiff", exif_dt=dt, fmt="TIFF")
    out = convert.photo_to_jpeg(_mf(src), tmp_path / "out" / "in.tiff")
    from photorounds.core.dates import date_from_pillow
    assert date_from_pillow(out.dest) == dt


def test_raw_without_tools_copied_with_warning(tmp_path, monkeypatch):
    from photorounds.core import tools
    monkeypatch.setattr(tools, "has_rawpy", lambda: False)
    monkeypatch.setattr(tools, "exiftool_path", lambda: None)
    raw = tmp_path / "shot.cr2"
    raw.write_bytes(b"\x49\x49\x2a\x00" + b"\x00" * 400)
    out = convert.photo_to_jpeg(_mf(raw), tmp_path / "out" / "shot.cr2")
    assert out.action == "copied"
    assert out.dest.suffix == ".cr2"
    assert "kept as-is" in out.note


def test_video_copy_without_ffmpeg(tmp_path, monkeypatch):
    from photorounds.core import tools
    monkeypatch.setattr(tools, "ffmpeg_path", lambda: None)
    monkeypatch.setattr(tools, "ffprobe_path", lambda: None)
    vid = tmp_path / "clip.avi"
    vid.write_bytes(b"RIFFxxxxAVI LIST" + b"\x00" * 100)
    out = convert.video_to_mp4(_mf(vid), tmp_path / "out" / "clip.avi")
    assert out.action == "copied"
    assert out.dest.suffix == ".avi"


def test_resize_presets_pixel_math():
    spec = ResizeSpec.from_preset("4x6", dpi=300)
    assert {spec.width_px, spec.height_px} == {1200, 1800}
    spec5 = ResizeSpec.from_preset("5x7", dpi=300)
    assert {spec5.width_px, spec5.height_px} == {1500, 2100}
    assert set(PRINT_PRESETS) >= {"4x6", "5x7", "8x10"}


def test_resize_crop_landscape_and_portrait(tmp_path):
    landscape = make_photo(tmp_path / "l.jpg", size=(4000, 3000))
    portrait = make_photo(tmp_path / "p.jpg", size=(3000, 4000))
    spec = ResizeSpec.from_preset("4x6", dpi=300, mode="crop")

    out_l = resize_photo(landscape, tmp_path / "out" / "l.jpg", spec)
    with Image.open(out_l.dest) as im:
        assert im.size == (1800, 1200)
        assert im.info.get("dpi", (300, 300))[0] in (300, 300.0)
    out_p = resize_photo(portrait, tmp_path / "out" / "p.jpg", spec)
    with Image.open(out_p.dest) as im:
        assert im.size == (1200, 1800)


def test_resize_fit_no_crop(tmp_path):
    src = make_photo(tmp_path / "wide.jpg", size=(4000, 1000))
    spec = ResizeSpec.from_preset("4x6", mode="fit")
    out = resize_photo(src, tmp_path / "out" / "wide.jpg", spec)
    with Image.open(out.dest) as im:
        assert im.width == 1800 and im.height == 450  # aspect preserved


def test_resize_pad_exact_canvas(tmp_path):
    src = make_photo(tmp_path / "wide.jpg", size=(4000, 1000))
    spec = ResizeSpec.from_preset("4x6", mode="pad")
    out = resize_photo(src, tmp_path / "out" / "wide.jpg", spec)
    with Image.open(out.dest) as im:
        assert im.size == (1800, 1200)


def test_low_resolution_flagged(tmp_path):
    tiny = make_photo(tmp_path / "tiny.jpg", size=(320, 240))
    spec = ResizeSpec.from_preset("4x6")
    out = resize_photo(tiny, tmp_path / "out" / "tiny.jpg", spec)
    assert out.low_res is True
    assert "LOW RESOLUTION" in out.note


def test_exif_orientation_respected(tmp_path):
    src = tmp_path / "rotated.jpg"
    im = Image.new("RGB", (4000, 3000), (10, 200, 30))
    exif = Image.Exif()
    exif[274] = 6  # stored landscape, orientation says rotate 90 => display portrait
    im.save(src, exif=exif, quality=90)
    spec = ResizeSpec.from_preset("4x6", mode="crop")
    out = resize_photo(src, tmp_path / "out" / "rotated.jpg", spec)
    with Image.open(out.dest) as result:
        assert result.size == (1200, 1800)
