from pathlib import Path

from photorounds.core import dedupe, hashing, quality, scan

from conftest import make_photo, resave


def _mf(path: Path) -> scan.MediaFile:
    return scan.MediaFile(path=path, kind=scan.classify(path) or "photo",
                          size=path.stat().st_size)


def test_sha256_detects_exact_copies(tmp_path):
    a = make_photo(tmp_path / "a.jpg", seed=7)
    b = tmp_path / "copy.jpg"
    b.write_bytes(a.read_bytes())
    c = make_photo(tmp_path / "c.jpg", seed=8)
    assert hashing.sha256_file(a) == hashing.sha256_file(b)
    assert hashing.sha256_file(a) != hashing.sha256_file(c)


def test_dhash_similar_for_reencodes_distinct_for_different(tmp_path):
    original = make_photo(tmp_path / "orig.png", size=(400, 300), seed=42)
    smaller = resave(original, tmp_path / "small.jpg", scale=0.5, quality=55)
    other = make_photo(tmp_path / "other.png", size=(400, 300), seed=999)

    h_orig = hashing.perceptual_hash(original)
    h_small = hashing.perceptual_hash(smaller)
    h_other = hashing.perceptual_hash(other)
    assert hashing.hamming(h_orig, h_small) <= 4
    assert hashing.hamming(h_orig, h_other) > 10


def test_near_duplicate_clusters_bucketing(tmp_path):
    base = make_photo(tmp_path / "x.png", size=(320, 240), seed=5)
    twin = resave(base, tmp_path / "x_export.jpg", scale=0.75, quality=50)
    loner = make_photo(tmp_path / "solo.png", size=(320, 240), seed=77)
    hashes = {p: hashing.perceptual_hash(p) for p in (base, twin, loner)}
    clusters = hashing.near_duplicate_clusters(hashes, threshold=4)
    assert len(clusters) == 1
    assert clusters[0] == {base, twin}


def test_quality_prefers_format_then_pixels(tmp_path):
    png = make_photo(tmp_path / "shot.png", size=(400, 300), seed=3)
    jpg_small = resave(png, tmp_path / "shot_small.jpg", scale=0.5)
    jpg_big = resave(png, tmp_path / "shot_big.jpg", scale=1.0, quality=95)
    best = quality.pick_best([_mf(jpg_small), _mf(png), _mf(jpg_big)])
    assert best.path == png
    best_jpg = quality.pick_best([_mf(jpg_small), _mf(jpg_big)])
    assert best_jpg.path == jpg_big


def test_raw_outranks_everything_by_format(tmp_path):
    fake_raw = tmp_path / "shot.cr2"
    fake_raw.write_bytes(b"\x00" * 500)
    jpg = make_photo(tmp_path / "shot.jpg", size=(4000, 3000))
    best = quality.pick_best([_mf(jpg), _mf(fake_raw)])
    assert best.path == fake_raw


def test_find_duplicates_exact_and_similar(tmp_path):
    original = make_photo(tmp_path / "beach.png", size=(400, 300), seed=11)
    exact_copy = tmp_path / "beach_copy.png"
    exact_copy.write_bytes(original.read_bytes())
    reexport = resave(original, tmp_path / "beach_small.jpg", scale=0.6, quality=50)
    unrelated = make_photo(tmp_path / "mountain.png", size=(400, 300), seed=222)

    files = scan.collect([tmp_path])
    result = dedupe.find_duplicates(files, threshold=4)

    kept = {mf.path.name for mf in result.keepers}
    dropped = {mf.path.name for mf in result.dropped}
    assert "mountain.png" in kept
    assert kept & {"beach.png", "beach_copy.png"}
    assert "beach_small.jpg" in dropped
    assert len(kept) == 2 and len(dropped) == 2


def test_videos_only_exact_deduped(tmp_path):
    v1 = tmp_path / "clip1.mp4"
    v2 = tmp_path / "clip1_copy.mp4"
    v3 = tmp_path / "clip2.mp4"
    v1.write_bytes(b"AAAA" * 1000)
    v2.write_bytes(b"AAAA" * 1000)
    v3.write_bytes(b"BBBB" * 900)
    files = scan.collect([tmp_path])
    result = dedupe.find_duplicates(files)
    assert len(result.keepers) == 2
    assert len(result.dropped) == 1
