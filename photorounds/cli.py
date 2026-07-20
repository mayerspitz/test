"""Command-line interface. Run `photorounds gui` (or plain `photorounds`) for the window app."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import APP_NAME, __version__, ops
from .core import rounds, tools
from .core.organize import GRANULARITIES
from .core.resize import FIT_MODES, PRINT_PRESETS, ResizeSpec


def _echo(msg: str) -> None:
    print(msg, flush=True)


def _resolve_input(args_input: str | None, project: Path) -> Path:
    if args_input and args_input != "latest":
        return Path(args_input)
    last = rounds.latest_round(project)
    if last is None:
        raise SystemExit(f"No rounds found in {project}. Run 'ingest' first, or pass --input FOLDER.")
    return last.path


def _spec_from_args(args) -> ResizeSpec:
    if args.size in PRINT_PRESETS:
        return ResizeSpec.from_preset(args.size, dpi=args.dpi, mode=args.mode)
    try:
        w, h = args.size.lower().replace("px", "").split("x")
        return ResizeSpec.from_pixels(int(w), int(h), dpi=args.dpi, mode=args.mode)
    except ValueError:
        raise SystemExit(
            f"--size must be a preset ({', '.join(PRINT_PRESETS)}) or WxH pixels like 1800x1200")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="photorounds",
        description=f"{APP_NAME} {__version__} — offline photo/video consolidation in immutable rounds.")
    p.add_argument("--version", action="version", version=f"{APP_NAME} {__version__}")
    sub = p.add_subparsers(dest="command")

    sp = sub.add_parser("ingest", help="Round 1: copy sources into a date-organized tree")
    sp.add_argument("sources", nargs="+", help="files/folders: SD cards, disk folders, extracted Google Takeout")
    sp.add_argument("--dest", required=True, help="project folder that will hold all rounds")
    sp.add_argument("--by", choices=GRANULARITIES, default="month", help="folder granularity (default: month)")
    sp.add_argument("--no-month-names", action="store_true", help="folders like 2021-05 instead of '2021-05 May'")
    sp.add_argument("--verify", action="store_true", help="re-hash every copy to verify integrity (slower)")

    sp = sub.add_parser("dedupe", help="Round 2: find duplicates, keep highest quality")
    sp.add_argument("--dest", required=True, help="project folder")
    sp.add_argument("--input", default="latest", help="round/folder to read (default: latest round)")
    sp.add_argument("--mode", choices=("remove", "report"), default="remove",
                    help="remove: keep best copy only; report: copy all, just list duplicates")
    sp.add_argument("--threshold", type=int, default=4,
                    help="visual similarity strictness 0-10; lower = stricter (default 4)")

    sp = sub.add_parser("convert", help="Round 3: everything to JPEG/MP4 (RAW included)")
    sp.add_argument("--dest", required=True, help="project folder")
    sp.add_argument("--input", default="latest", help="round/folder to read (default: latest round)")
    sp.add_argument("--jpeg-quality", type=int, default=95)

    sp = sub.add_parser("resize", help="Round 4: print-ready resize (4x6 etc.)")
    sp.add_argument("--dest", required=True, help="project folder")
    sp.add_argument("--input", default="latest", help="round/folder to read (default: latest round)")
    sp.add_argument("--size", default="4x6", help=f"preset ({', '.join(PRINT_PRESETS)}) or WxH pixels")
    sp.add_argument("--dpi", type=int, default=300)
    sp.add_argument("--mode", choices=FIT_MODES, default="crop",
                    help="crop: fill print exactly (labs do this); fit: shrink only; pad: white borders")
    sp.add_argument("--jpeg-quality", type=int, default=95)
    sp.add_argument("--videos", choices=("skip", "copy"), default="skip")

    sp = sub.add_parser("single", help="process one file into a folder of your choice")
    sp.add_argument("file")
    sp.add_argument("--dest", required=True, help="destination folder")
    sp.add_argument("--to-jpeg", action="store_true", help="convert photo to JPEG / video to MP4")
    sp.add_argument("--size", help=f"resize photo: preset ({', '.join(PRINT_PRESETS)}) or WxH pixels")
    sp.add_argument("--dpi", type=int, default=300)
    sp.add_argument("--mode", choices=FIT_MODES, default="crop")
    sp.add_argument("--jpeg-quality", type=int, default=95)
    sp.add_argument("--rename-chrono", action="store_true", help="rename to 20210512_143055_name.jpg style")

    sub.add_parser("rounds", help="list rounds in a project").add_argument("--dest", required=True)
    sub.add_parser("tools", help="show which optional components are installed")
    sub.add_parser("gui", help="open the window app")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command in (None, "gui"):
        from . import gui
        return gui.main()

    try:
        if args.command == "ingest":
            ops.run_ingest(args.sources, Path(args.dest), granularity=args.by,
                           month_names=not args.no_month_names, verify=args.verify,
                           progress=_echo)
        elif args.command == "dedupe":
            project = Path(args.dest)
            ops.run_dedupe(_resolve_input(args.input, project), project,
                           mode=args.mode, threshold=args.threshold, progress=_echo)
        elif args.command == "convert":
            project = Path(args.dest)
            ops.run_convert(_resolve_input(args.input, project), project,
                            jpeg_quality=args.jpeg_quality, progress=_echo)
        elif args.command == "resize":
            project = Path(args.dest)
            ops.run_resize(_resolve_input(args.input, project), project,
                           _spec_from_args(args), jpeg_quality=args.jpeg_quality,
                           videos=args.videos, progress=_echo)
        elif args.command == "single":
            size = None
            if args.size:
                size = _spec_from_args(args)
            ops.run_single(args.file, args.dest, to_jpeg=args.to_jpeg, size=size,
                           jpeg_quality=args.jpeg_quality, rename_chrono=args.rename_chrono,
                           progress=_echo)
        elif args.command == "rounds":
            found = rounds.list_rounds(Path(args.dest))
            if not found:
                _echo(f"No rounds in {args.dest} yet.")
            for r in found:
                _echo(f"  Round {r.number:02d}  {r.operation:10s}  {r.path}")
        elif args.command == "tools":
            _echo(tools.capability_report())
    except (ValueError, FileExistsError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
