"""One-click installation of the optional helper tools — no command line.

Downloads official Windows builds of ExifTool (exiftool.org) and ffmpeg
(gyan.dev "essentials" build) into the per-user tools folder that PhotoRounds
searches automatically. Nothing is installed system-wide; deleting the folder
removes everything.

This is the ONLY network activity in the whole app, it runs only when the
user asks for it, and it downloads tools — no photo, filename, or any other
personal data is ever sent anywhere.
"""

from __future__ import annotations

import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from . import tools

EXIFTOOL_VER_URL = "https://exiftool.org/ver.txt"
EXIFTOOL_ZIP_URL = "https://exiftool.org/exiftool-{ver}_64.zip"
FFMPEG_ZIP_URL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
_UA = {"User-Agent": "PhotoRounds-helper-setup/1.0"}


def missing_helpers() -> list[str]:
    missing = []
    if not tools.exiftool_path():
        missing.append("ExifTool")
    if not (tools.ffmpeg_path() and tools.ffprobe_path()):
        missing.append("ffmpeg")
    return missing


def _http_text(url: str) -> str:
    with urllib.request.urlopen(urllib.request.Request(url, headers=_UA), timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")


def _fetch(url: str, dest: Path, progress=None) -> None:
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=180) as resp, open(dest, "wb") as out:
        total = int(resp.headers.get("Content-Length") or 0)
        done = reported = 0
        while True:
            chunk = resp.read(1 << 16)
            if not chunk:
                break
            out.write(chunk)
            done += len(chunk)
            if progress and done - reported >= (8 << 20):
                reported = done
                if total:
                    progress(f"    downloaded {done >> 20} of {total >> 20} MB...")
                else:
                    progress(f"    downloaded {done >> 20} MB...")


def _safe_extract(zip_path: Path, target: Path) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/")
            if name.startswith("/") or ".." in name.split("/"):
                continue
            zf.extract(info, target)


def _install_exiftool_from_zip(zip_path: Path, dest_root: Path) -> Path:
    """Layout-agnostic install: find exiftool(-k).exe anywhere in the archive,
    keep its sibling files (newer builds need the exiftool_files folder)."""
    with tempfile.TemporaryDirectory(dir=dest_root.parent if dest_root.parent.is_dir() else None) as td:
        _safe_extract(zip_path, Path(td))
        exe = next((p for p in Path(td).rglob("*")
                    if p.is_file() and p.name.lower() in ("exiftool(-k).exe", "exiftool.exe")), None)
        if exe is None:
            raise RuntimeError("exiftool executable not found inside the downloaded archive")
        target = dest_root / "exiftool"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(exe.parent, target)
        installed = target / exe.name
        final = target / "exiftool.exe"
        if installed != final:
            # dropping "(-k)" from the name disables ExifTool's pause-on-exit mode
            installed.rename(final)
        return final


def _install_ffmpeg_from_zip(zip_path: Path, dest_root: Path) -> tuple[Path, Path]:
    with tempfile.TemporaryDirectory(dir=dest_root.parent if dest_root.parent.is_dir() else None) as td:
        _safe_extract(zip_path, Path(td))
        found: dict[str, Path] = {}
        for p in Path(td).rglob("*"):
            if p.is_file() and p.name.lower() in ("ffmpeg.exe", "ffprobe.exe"):
                found[p.name.lower()] = p
        if "ffmpeg.exe" not in found or "ffprobe.exe" not in found:
            raise RuntimeError("ffmpeg.exe/ffprobe.exe not found inside the downloaded archive")
        dest_root.mkdir(parents=True, exist_ok=True)
        ffmpeg = Path(shutil.copy2(found["ffmpeg.exe"], dest_root / "ffmpeg.exe"))
        ffprobe = Path(shutil.copy2(found["ffprobe.exe"], dest_root / "ffprobe.exe"))
        return ffmpeg, ffprobe


def install_exiftool(progress=print) -> Path:
    ver = _http_text(EXIFTOOL_VER_URL).strip()
    url = EXIFTOOL_ZIP_URL.format(ver=ver)
    progress(f"  ExifTool {ver} from exiftool.org...")
    dest_root = tools.user_tools_dir()
    dest_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "exiftool.zip"
        _fetch(url, zpath, progress)
        return _install_exiftool_from_zip(zpath, dest_root)


def install_ffmpeg(progress=print) -> tuple[Path, Path]:
    progress("  ffmpeg 'essentials' build from gyan.dev (about 90 MB)...")
    dest_root = tools.user_tools_dir()
    dest_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "ffmpeg.zip"
        _fetch(FFMPEG_ZIP_URL, zpath, progress)
        return _install_ffmpeg_from_zip(zpath, dest_root)


def install_missing(progress=print) -> list[str]:
    """Install whichever helpers are absent. Returns a summary of what was done."""
    if os.name != "nt":
        raise ValueError(
            "Automatic helper download is built for Windows. On this system install "
            "exiftool and ffmpeg with your package manager (apt/brew/...).")
    done: list[str] = []
    if not tools.exiftool_path():
        progress("Getting ExifTool (better dates for RAW & video)...")
        exe = install_exiftool(progress)
        done.append(f"ExifTool installed: {exe}")
    else:
        progress("ExifTool: already available.")
    if not (tools.ffmpeg_path() and tools.ffprobe_path()):
        progress("Getting ffmpeg (video conversion to MP4)...")
        ffmpeg, _ffprobe = install_ffmpeg(progress)
        done.append(f"ffmpeg installed: {ffmpeg}")
    else:
        progress("ffmpeg: already available.")
    tools.refresh()
    for line in done:
        progress(line)
    if done:
        progress("Helpers ready — they live in " + str(tools.user_tools_dir()))
    return done
