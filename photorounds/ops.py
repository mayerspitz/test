"""High-level operations — one function per round type, plus single-file mode.

Every function returns the path of the round folder it created. Nothing here
ever writes into a source folder or an earlier round.
"""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

from .core import convert, dedupe, organize, rounds, scan
from .core.dates import resolve_dates
from .core.hashing import sha256_file
from .core.resize import ResizeSpec, resize_photo
from .core.rounds import Manifest


def _noop(_msg: str) -> None:
    pass


def _guard_dest_outside_sources(project: Path, sources: list[Path]) -> None:
    project = project.resolve()
    for src in sources:
        src = Path(src).resolve()
        if src == project or src in project.parents:
            raise ValueError(
                f"Destination project {project} lies inside source {src}; "
                "choose a destination outside all source folders.")


def _relative_to_input(path: Path, input_dir: Path) -> Path:
    try:
        rel = path.resolve().relative_to(input_dir.resolve())
    except ValueError:
        rel = Path(path.name)
    if rel.parts and rel.parts[0] == rounds.INFO_DIR:
        rel = Path(*rel.parts[1:]) if len(rel.parts) > 1 else Path(path.name)
    return rel


def run_ingest(sources: list[Path | str], project: Path | str,
               granularity: str = "month", month_names: bool = True,
               verify: bool = False, progress=_noop) -> Path:
    """Round type 1 — copy everything into a date-organized tree.

    Sources may be SD card folders, disk folders, single files, or an
    extracted Google Takeout folder (its JSON sidecars are understood).
    Originals are only read, never modified or deleted.
    """
    project = Path(project)
    src_paths = [Path(s) for s in sources]
    _guard_dest_outside_sources(project, [p for p in src_paths if p.is_dir()])

    progress("Scanning sources...")
    files = scan.collect(src_paths)
    if not files:
        raise ValueError("No photo or video files found in the selected sources.")
    progress(f"Found {len(files)} media files "
             f"({sum(f.kind == 'photo' for f in files)} photos, "
             f"{sum(f.kind == 'video' for f in files)} videos). Reading capture dates...")
    dated = resolve_dates(files, progress=progress)

    project.mkdir(parents=True, exist_ok=True)
    round_path = rounds.create_round(project, "ingest")
    manifest = Manifest(round_path, "ingest", options={
        "sources": [str(s) for s in src_paths],
        "granularity": granularity, "month_names": month_names, "verify": verify,
    })

    order = sorted(files, key=lambda mf: (dated[mf.path][0], str(mf.path).lower()))
    for idx, mf in enumerate(order):
        dt, dt_source = dated[mf.path]
        rel = organize.target_relpath(dt, mf.path.name, granularity, month_names)
        dest = organize.unique_path(round_path / rel.parent, rel.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(mf.path, dest)
        convert._stamp_times(dest, dt)
        entry_extra = {}
        if verify:
            src_sha, dst_sha = sha256_file(mf.path), sha256_file(dest)
            entry_extra["sha256"] = src_sha
            if src_sha != dst_sha:
                manifest.warn(f"VERIFY FAILED: {mf.path} -> {dest}")
        manifest.add(src=mf.path, dest=dest, action="copied",
                     date=dt, date_source=dt_source,
                     note=f"takeout sidecar: {mf.sidecar_json.name}" if mf.sidecar_json else "",
                     **entry_extra)
        if idx % 100 == 99:
            progress(f"  copied {idx + 1}/{len(order)}")

    date_sources: dict[str, int] = {}
    for _, s in dated.values():
        date_sources[s] = date_sources.get(s, 0) + 1
    manifest.save(report_lines=[
        "Date sources: " + ", ".join(f"{k}={v}" for k, v in sorted(date_sources.items())),
    ])
    progress(f"Ingest complete: {len(order)} files -> {round_path}")
    return round_path


def run_dedupe(input_dir: Path | str, project: Path | str,
               mode: str = "remove", threshold: int = 4, progress=_noop) -> Path:
    """Round type 2 — duplicate handling.

    mode="remove": keep only the highest-quality copy of each duplicate group.
    mode="report": copy everything through; just document what duplicates exist.
    Files that would be removed still exist untouched in the input round.
    """
    input_dir, project = Path(input_dir), Path(project)
    progress(f"Scanning {input_dir}...")
    files = scan.collect([input_dir], find_sidecars=False)
    if not files:
        raise ValueError(f"No media found in {input_dir}")

    progress(f"Analyzing {len(files)} files for duplicates...")
    result = dedupe.find_duplicates(files, threshold=threshold, progress=progress)

    round_path = rounds.create_round(project, "dedupe")
    manifest = Manifest(round_path, "dedupe", options={
        "input": str(input_dir), "mode": mode, "threshold": threshold,
    })

    to_copy = files if mode == "report" else result.keepers
    dropped_paths = {mf.path for mf in result.dropped}
    for idx, mf in enumerate(to_copy):
        rel = _relative_to_input(mf.path, input_dir)
        dest = organize.unique_path(round_path / rel.parent, rel.name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(mf.path, dest)
        action = "copied-duplicate" if (mode == "report" and mf.path in dropped_paths) else "kept"
        manifest.add(src=mf.path, dest=dest, action=action)
        if idx % 100 == 99:
            progress(f"  copied {idx + 1}/{len(to_copy)}")

    report = [f"Duplicate groups found: {len(result.clusters)}"]
    for ci, cluster in enumerate(result.clusters, 1):
        verb = "removed" if mode == "remove" else "flagged"
        report.append(f"[group {ci} — {cluster.reason}] KEPT {cluster.keep.path.name}")
        for mf in cluster.drop:
            manifest.add(src=mf.path, dest=None,
                         action=("removed" if mode == "remove" else "flagged"),
                         note=f"duplicate of {cluster.keep.path.name} ({cluster.reason})")
            report.append(f"    {verb}: {mf.path.name}")
    manifest.save(report_lines=report)

    kept = len(result.keepers)
    progress(f"Dedupe complete: {kept} kept, {len(result.dropped)} duplicates "
             f"{'removed' if mode == 'remove' else 'flagged (report mode: nothing removed)'} "
             f"-> {round_path}")
    return round_path


def run_convert(input_dir: Path | str, project: Path | str,
                jpeg_quality: int = 95, progress=_noop) -> Path:
    """Round type 3 — everything to universal formats (JPEG photos, MP4 videos)."""
    input_dir, project = Path(input_dir), Path(project)
    progress(f"Scanning {input_dir}...")
    files = scan.collect([input_dir], find_sidecars=False)
    if not files:
        raise ValueError(f"No media found in {input_dir}")
    dated = resolve_dates(files)

    round_path = rounds.create_round(project, "convert")
    manifest = Manifest(round_path, "convert", options={
        "input": str(input_dir), "jpeg_quality": jpeg_quality,
    })

    for idx, mf in enumerate(files):
        rel = _relative_to_input(mf.path, input_dir)
        dt = dated[mf.path][0]
        dest_base = round_path / rel
        if mf.kind == "photo":
            outcome = convert.photo_to_jpeg(mf, dest_base, jpeg_quality, capture_dt=dt)
        else:
            outcome = convert.video_to_mp4(mf, dest_base, capture_dt=dt)
        manifest.add(src=mf.path, dest=outcome.dest, action=outcome.action,
                     date=dt, note=outcome.note)
        if "kept as-is" in outcome.note or "not installed" in outcome.note:
            manifest.warn(f"{mf.path.name}: {outcome.note}")
        if idx % 25 == 24:
            progress(f"  converted {idx + 1}/{len(files)}")

    manifest.save()
    counts = manifest.counts()
    progress(f"Convert complete: {counts.get('converted', 0)} converted, "
             f"{counts.get('copied', 0)} copied through -> {round_path}")
    return round_path


def run_resize(input_dir: Path | str, project: Path | str, spec: ResizeSpec,
               jpeg_quality: int = 95, videos: str = "skip", progress=_noop) -> Path:
    """Round type 4 — print-ready resizing. Photos only; videos skip or copy through."""
    input_dir, project = Path(input_dir), Path(project)
    progress(f"Scanning {input_dir}...")
    files = scan.collect([input_dir], find_sidecars=False)
    if not files:
        raise ValueError(f"No media found in {input_dir}")

    round_path = rounds.create_round(project, "resize")
    manifest = Manifest(round_path, "resize", options={
        "input": str(input_dir), "size": spec.label or f"{spec.width_px}x{spec.height_px}px",
        "dpi": spec.dpi, "mode": spec.mode, "videos": videos,
    })

    low_res_count = 0
    for idx, mf in enumerate(files):
        rel = _relative_to_input(mf.path, input_dir)
        dest = round_path / rel
        if mf.kind == "video":
            if videos == "copy":
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(mf.path, dest)
                manifest.add(src=mf.path, dest=dest, action="copied", note="video copied through")
            else:
                manifest.add(src=mf.path, dest=None, action="skipped",
                             note="video (not printable) — use videos='copy' to carry along")
            continue
        outcome = resize_photo(mf.path, dest, spec, jpeg_quality)
        manifest.add(src=mf.path, dest=outcome.dest, action=outcome.action, note=outcome.note)
        if outcome.low_res:
            low_res_count += 1
            manifest.warn(f"LOW RESOLUTION for {spec.label or 'print'}: {mf.path.name} — {outcome.note}")
        if outcome.action == "failed":
            manifest.warn(f"FAILED: {mf.path.name} — {outcome.note}")
        if idx % 50 == 49:
            progress(f"  resized {idx + 1}/{len(files)}")

    manifest.save()
    counts = manifest.counts()
    msg = (f"Resize complete: {counts.get('resized', 0)} photos at "
           f"{spec.label or f'{spec.width_px}x{spec.height_px}'} -> {round_path}")
    if low_res_count:
        msg += f"  [{low_res_count} low-resolution warnings — see report.txt]"
    progress(msg)
    return round_path


def run_single(file: Path | str, dest_dir: Path | str,
               to_jpeg: bool = False, size: ResizeSpec | None = None,
               jpeg_quality: int = 95, rename_chrono: bool = False,
               progress=_noop) -> Path:
    """Single-file mode: copy/convert/resize one file into a folder of your choice."""
    file, dest_dir = Path(file), Path(dest_dir)
    if not file.is_file():
        raise ValueError(f"{file} is not a file")
    found = scan.collect([file])
    if not found:
        raise ValueError(f"{file.name} is not a recognized photo or video format")
    mf = found[0]
    dt, _src = resolve_dates([mf])[mf.path]
    name = organize.chrono_name(dt, file.name) if rename_chrono else organize.sanitize_component(file.name)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = organize.unique_path(dest_dir, name)

    if mf.kind == "photo" and size is not None:
        source: Path = mf.path
        if to_jpeg and mf.is_raw:
            tmp_outcome = convert.photo_to_jpeg(mf, dest, jpeg_quality, capture_dt=dt)
            source = tmp_outcome.dest
        outcome = resize_photo(source, dest, size, jpeg_quality)
        if source != mf.path and source != outcome.dest:
            source.unlink(missing_ok=True)
        convert._stamp_times(outcome.dest, dt)
        progress(f"{file.name} -> {outcome.dest} ({outcome.note})")
        return outcome.dest
    if to_jpeg and mf.kind == "photo":
        outcome = convert.photo_to_jpeg(mf, dest, jpeg_quality, capture_dt=dt)
        progress(f"{file.name} -> {outcome.dest} ({outcome.note})")
        return outcome.dest
    if to_jpeg and mf.kind == "video":
        outcome = convert.video_to_mp4(mf, dest, capture_dt=dt)
        progress(f"{file.name} -> {outcome.dest} ({outcome.note})")
        return outcome.dest
    shutil.copy2(mf.path, dest)
    convert._stamp_times(dest, dt)
    progress(f"{file.name} -> {dest} (copied)")
    return dest
