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
# ExifTool's binaries live on SourceForge. downloads.sourceforge.net redirects
# straight to a mirror's file; the /download page URL can serve an HTML
# interstitial to non-browser clients, so it is only a fallback (each download
# is zip-validated before use).
EXIFTOOL_ZIP_URLS = (
    "https://downloads.sourceforge.net/project/exiftool/exiftool-{ver}_64.zip",
    "https://sourceforge.net/projects/exiftool/files/exiftool-{ver}_64.zip/download",
    "https://exiftool.org/exiftool-{ver}_64.zip",
)
FFMPEG_ZIP_URLS = (
    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
    "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip",
)
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


def _fetch_zip_from_any(urls: list[str], zpath: Path, progress) -> None:
    """Download from the first source that yields a real zip file. Some hosts
    answer HTTP 200 with an HTML page instead of the file — validate."""
    last_error: Exception | None = None
    for url in urls:
        try:
            _fetch(url, zpath, progress)
            if not zipfile.is_zipfile(zpath):
                raise RuntimeError("server returned a web page instead of the zip")
            progress(f"    downloaded from {url.split('/')[2]}")
            return
        except Exception as exc:
            last_error = exc
            progress(f"    source unavailable, trying next... ({exc})")
    raise RuntimeError(f"could not download from any source: {last_error}")


def install_exiftool(progress=print) -> Path:
    ver = _http_text(EXIFTOOL_VER_URL).strip()
    progress(f"  ExifTool {ver} (official build)...")
    dest_root = tools.user_tools_dir()
    dest_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "exiftool.zip"
        _fetch_zip_from_any([u.format(ver=ver) for u in EXIFTOOL_ZIP_URLS], zpath, progress)
        return _install_exiftool_from_zip(zpath, dest_root)


def install_ffmpeg(progress=print) -> tuple[Path, Path]:
    progress("  ffmpeg (official build, about 90 MB)...")
    dest_root = tools.user_tools_dir()
    dest_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        zpath = Path(td) / "ffmpeg.zip"
        _fetch_zip_from_any(list(FFMPEG_ZIP_URLS), zpath, progress)
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
