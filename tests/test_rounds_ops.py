import json
from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image

from photorounds import ops
from photorounds.core import rounds

from conftest import make_photo, make_takeout_sidecar, resave, set_mtime


def _tree(root: Path) -> set[str]:
    return {str(p.relative_to(root)).replace("\\", "/")
            for p in root.rglob("*") if p.is_file()}


def _media_tree(root: Path) -> set[str]:
    return {p for p in _tree(root) if not p.startswith(rounds.INFO_DIR)}


def _build_sources(src: Path) -> dict[str, Path]:
    files = {}
    files["may"] = make_photo(src / "sd1" / "IMG_001.jpg", seed=1,
                              exif_dt=datetime(2021, 5, 12, 14, 30, 55))
    files["january"] = make_photo(src / "sd1" / "IMG_002.jpg", seed=2,
                                  exif_dt=datetime(2021, 1, 2, 8, 0, 0))
    files["takeout"] = make_photo(src / "takeout" / "Photos from 2019" / "party.jpg", seed=3)
    make_takeout_sidecar(files["takeout"], datetime(2019, 12, 31, 23, 0, 0))
    files["dupe_exact"] = src / "pc" / "IMG_001 copy.jpg"
    files["dupe_exact"].parent.mkdir(parents=True)
    files["dupe_exact"].write_bytes(files["may"].read_bytes())
    files["dupe_small"] = resave(files["may"], src / "pc" / "IMG_001_small.jpg",
                                 scale=0.5, quality=50)
    set_mtime(files["dupe_small"], datetime(2021, 5, 12, 14, 30, 55))
    files["video"] = src / "sd1" / "20210512_150000.mp4"
    files["video"].write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 2000)
    (src / "sd1" / "Thumbs.db").write_bytes(b"junk")
    return files


def test_full_pipeline(workspace):
    src, project = workspace["src"], workspace["project"]
    _build_sources(src)

    # Round 1 — ingest
    r1 = ops.run_ingest([src], project, granularity="month", verify=True)
    assert r1.name == "Round_01_ingest"
    media1 = _media_tree(r1)
    assert "2021/2021-05 May/20210512_143055_IMG_001.jpg" in media1
    assert "2021/2021-01 January/20210102_080000_IMG_002.jpg" in media1
    assert any(p.startswith("2019/2019-12 December/") and "party" in p for p in media1)
    assert any("20210512_150000" in p and p.endswith(".mp4") for p in media1)
    assert len(media1) == 6  # 5 photos + 1 video; Thumbs.db and .json excluded
    manifest1 = json.loads((r1 / rounds.INFO_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert manifest1["counts"]["copied"] == 6
    assert not manifest1["warnings"]

    # Round 2 — dedupe (remove mode keeps best of the three IMG_001 variants)
    before = _tree(r1)
    r2 = ops.run_dedupe(r1, project, mode="remove")
    assert r2.name == "Round_02_dedupe"
    assert _tree(r1) == before, "earlier rounds must never be modified"
    media2 = _media_tree(r2)
    assert len(media2) == 4  # 3 unique photos + video
    assert sum("IMG_001" in p for p in media2) == 1

    # Round 3 — convert everything to JPEG/MP4
    r3 = ops.run_convert(r2, project)
    assert r3.name == "Round_03_convert"
    media3 = _media_tree(r3)
    assert len(media3) == 4
    assert all(p.endswith((".jpg", ".mp4")) for p in media3)

    # Round 4 — resize for 4x6 print, videos skipped
    from photorounds.core.resize import ResizeSpec
    r4 = ops.run_resize(r3, project, ResizeSpec.from_preset("4x6"), videos="skip")
    assert r4.name == "Round_04_resize"
    media4 = _media_tree(r4)
    assert len(media4) == 3 and all(p.endswith(".jpg") for p in media4)
    for rel in media4:
        with Image.open(r4 / rel) as im:
            assert {im.width, im.height} == {1200, 1800}

    # chronological ordering: alphabetical == chronological inside the tree
    photos_sorted = sorted(p for p in media1 if p.endswith(".jpg"))
    assert photos_sorted[0].startswith("2019/")
    assert photos_sorted[-1].startswith("2021/2021-05")

    all_rounds = rounds.list_rounds(project)
    assert [r.number for r in all_rounds] == [1, 2, 3, 4]


def test_dedupe_report_mode_copies_everything(workspace):
    src, project = workspace["src"], workspace["project"]
    _build_sources(src)
    r1 = ops.run_ingest([src], project)
    r2 = ops.run_dedupe(r1, project, mode="report")
    assert len(_media_tree(r2)) == len(_media_tree(r1))
    report = (r2 / rounds.INFO_DIR / "report.txt").read_text(encoding="utf-8")
    assert "Duplicate groups found" in report
    assert "flagged" in report


def test_ingest_rejects_dest_inside_source(workspace):
    src = workspace["src"]
    make_photo(src / "a.jpg")
    with pytest.raises(ValueError, match="inside source"):
        ops.run_ingest([src], src / "project")


def test_ingest_empty_source_errors(workspace):
    with pytest.raises(ValueError, match="No photo or video"):
        ops.run_ingest([workspace["src"]], workspace["project"])


def test_rounds_never_reused(workspace):
    project = workspace["project"]
    project.mkdir()
    first = rounds.create_round(project, "ingest")
    second = rounds.create_round(project, "dedupe")
    assert first.name == "Round_01_ingest"
    assert second.name == "Round_02_dedupe"
    assert rounds.latest_round(project).path == second


def test_single_file_copy_and_resize(workspace):
    src, tmp = workspace["src"], workspace["tmp"]
    photo = make_photo(src / "one.png", size=(3000, 2000),
                       exif_dt=datetime(2020, 4, 5, 6, 7, 8))
    dest_dir = tmp / "picked"

    copied = ops.run_single(photo, dest_dir)
    assert copied.name == "one.png"

    from photorounds.core.resize import ResizeSpec
    resized = ops.run_single(photo, dest_dir, size=ResizeSpec.from_preset("4x6"),
                             rename_chrono=True)
    assert resized.name.startswith("20200405_060708_one")
    with Image.open(resized) as im:
        assert {im.width, im.height} == {1200, 1800}


def test_cli_smoke(workspace, capsys):
    from photorounds.cli import main
    src, project = workspace["src"], workspace["project"]
    make_photo(src / "x.jpg", exif_dt=datetime(2021, 5, 1, 1, 1, 1))
    assert main(["ingest", str(src), "--dest", str(project)]) == 0
    assert main(["rounds", "--dest", str(project)]) == 0
    assert main(["tools"]) == 0
    out = capsys.readouterr().out
    assert "Round 01" in out and "Optional components" in out
