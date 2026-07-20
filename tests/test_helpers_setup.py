import os
import shutil
import zipfile
from pathlib import Path

import pytest

from photorounds.core import helpers_setup, tools


@pytest.fixture(autouse=True)
def _clean_tool_cache():
    tools.refresh()
    yield
    tools.refresh()


def _make_zip(path: Path, entries: dict[str, bytes]) -> Path:
    with zipfile.ZipFile(path, "w") as zf:
        for name, data in entries.items():
            zf.writestr(name, data)
    return path


def test_exiftool_zip_modern_layout(tmp_path):
    z = _make_zip(tmp_path / "et.zip", {
        "exiftool-13.30_64/exiftool(-k).exe": b"MZ fake",
        "exiftool-13.30_64/exiftool_files/perl.dll": b"dll",
        "exiftool-13.30_64/exiftool_files/lib/File/mod.pm": b"pm",
    })
    exe = helpers_setup._install_exiftool_from_zip(z, tmp_path / "tools")
    assert exe == tmp_path / "tools" / "exiftool" / "exiftool.exe"
    assert exe.read_bytes() == b"MZ fake"
    assert (tmp_path / "tools" / "exiftool" / "exiftool_files" / "perl.dll").exists()
    assert (tmp_path / "tools" / "exiftool" / "exiftool_files" / "lib" / "File" / "mod.pm").exists()


def test_exiftool_zip_flat_layout_and_reinstall(tmp_path):
    z = _make_zip(tmp_path / "et.zip", {"exiftool(-k).exe": b"v1"})
    exe = helpers_setup._install_exiftool_from_zip(z, tmp_path / "tools")
    assert exe.read_bytes() == b"v1"
    z2 = _make_zip(tmp_path / "et2.zip", {"exiftool.exe": b"v2"})
    exe2 = helpers_setup._install_exiftool_from_zip(z2, tmp_path / "tools")
    assert exe2 == exe and exe2.read_bytes() == b"v2"


def test_exiftool_zip_without_exe_raises(tmp_path):
    z = _make_zip(tmp_path / "bad.zip", {"readme.txt": b"nope"})
    with pytest.raises(RuntimeError, match="not found"):
        helpers_setup._install_exiftool_from_zip(z, tmp_path / "tools")


def test_ffmpeg_zip_layout(tmp_path):
    z = _make_zip(tmp_path / "ff.zip", {
        "ffmpeg-7.1-essentials_build/bin/ffmpeg.exe": b"MZ ffmpeg",
        "ffmpeg-7.1-essentials_build/bin/ffprobe.exe": b"MZ ffprobe",
        "ffmpeg-7.1-essentials_build/README.txt": b"doc",
    })
    ffmpeg, ffprobe = helpers_setup._install_ffmpeg_from_zip(z, tmp_path / "tools")
    assert ffmpeg == tmp_path / "tools" / "ffmpeg.exe"
    assert ffprobe == tmp_path / "tools" / "ffprobe.exe"
    assert ffmpeg.read_bytes() == b"MZ ffmpeg"


def test_zip_traversal_entries_skipped(tmp_path):
    z = _make_zip(tmp_path / "evil.zip", {
        "../escape.exe": b"bad",
        "exiftool(-k).exe": b"ok",
    })
    exe = helpers_setup._install_exiftool_from_zip(z, tmp_path / "tools")
    assert exe.read_bytes() == b"ok"
    assert not (tmp_path / "escape.exe").exists()


def test_tool_search_order_user_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(tools, "user_tools_dir", lambda: tmp_path / "ut")
    monkeypatch.setattr(tools.shutil, "which", lambda name: None)
    tools.refresh()
    assert tools.ffmpeg_path() is None

    exe_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    exe = tmp_path / "ut" / exe_name
    exe.parent.mkdir(parents=True)
    exe.write_bytes(b"x")
    assert tools.ffmpeg_path() is None, "cached miss until refresh()"
    tools.refresh()
    assert tools.ffmpeg_path() == str(exe)

    et_name = "exiftool.exe" if os.name == "nt" else "exiftool"
    et = tmp_path / "ut" / "exiftool" / et_name
    et.parent.mkdir(parents=True)
    et.write_bytes(b"x")
    tools.refresh()
    assert tools.exiftool_path() == str(et), "nested <tool>/<tool>.exe layout is found"


def test_missing_helpers_names(monkeypatch):
    monkeypatch.setattr(tools, "exiftool_path", lambda: None)
    monkeypatch.setattr(tools, "ffmpeg_path", lambda: "/x/ffmpeg")
    monkeypatch.setattr(tools, "ffprobe_path", lambda: None)
    assert helpers_setup.missing_helpers() == ["ExifTool", "ffmpeg"]
    monkeypatch.setattr(tools, "exiftool_path", lambda: "/x/exiftool")
    monkeypatch.setattr(tools, "ffprobe_path", lambda: "/x/ffprobe")
    assert helpers_setup.missing_helpers() == []


def test_install_missing_rejects_non_windows(monkeypatch):
    if os.name == "nt":
        pytest.skip("behavior under test is the non-Windows guard")
    with pytest.raises(ValueError, match="Windows"):
        helpers_setup.install_missing(progress=lambda _m: None)
