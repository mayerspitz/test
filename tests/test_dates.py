from datetime import datetime

from photorounds.core import dates, scan

from conftest import make_photo, make_takeout_sidecar, set_mtime


def test_parse_exif_datetime_variants():
    assert dates.parse_exif_datetime("2021:05:12 14:30:55") == datetime(2021, 5, 12, 14, 30, 55)
    assert dates.parse_exif_datetime("2021-05-12T14:30:55") == datetime(2021, 5, 12, 14, 30, 55)
    assert dates.parse_exif_datetime("2021:05:12 14:30:55+02:00") is not None
    assert dates.parse_exif_datetime("0000:00:00 00:00:00") is None
    assert dates.parse_exif_datetime(None) is None
    assert dates.parse_exif_datetime("not a date") is None


def test_implausible_years_rejected():
    assert dates.parse_exif_datetime("1904:01:01 00:00:00") is None
    assert dates.parse_exif_datetime("2150:01:01 00:00:00") is None


def test_exif_date_read_from_jpeg(tmp_path):
    dt = datetime(2018, 7, 4, 12, 1, 2)
    photo = make_photo(tmp_path / "a.jpg", exif_dt=dt)
    assert dates.date_from_pillow(photo) == dt


def test_takeout_sidecar_date(tmp_path):
    dt = datetime(2016, 3, 2, 8, 30, 0)
    photo = make_photo(tmp_path / "b.jpg")
    make_takeout_sidecar(photo, dt)
    files = scan.collect([tmp_path])
    assert files[0].sidecar_json is not None
    parsed = dates.date_from_takeout_json(files[0].sidecar_json)
    assert parsed is not None and abs((parsed - dt).total_seconds()) < 24 * 3600


def test_filename_patterns():
    cases = {
        "IMG_20210512_143055.jpg": datetime(2021, 5, 12, 14, 30, 55),
        "PXL_20220101_000102003.jpg": datetime(2022, 1, 1, 0, 1, 2),
        "IMG-20190315-WA0012.jpg": datetime(2019, 3, 15),
        "2020-06-07 19.20.21.png": datetime(2020, 6, 7, 19, 20, 21),
        "Screenshot 2023-11-30.png": datetime(2023, 11, 30),
        "20171225_101112.mp4": datetime(2017, 12, 25, 10, 11, 12),
    }
    for name, expected in cases.items():
        assert dates.date_from_filename(name) == expected, name


def test_filename_no_false_positive():
    assert dates.date_from_filename("DSC_98765432.jpg") is None
    assert dates.date_from_filename("holiday.jpg") is None


def test_resolution_ladder(tmp_path):
    exif_dt = datetime(2018, 7, 4, 12, 0, 0)
    takeout_dt = datetime(2016, 3, 2, 9, 0, 0)
    mtime_dt = datetime(2014, 1, 20, 6, 30, 0)

    with_exif = make_photo(tmp_path / "exif.jpg", seed=1, exif_dt=exif_dt)
    with_json = make_photo(tmp_path / "takeout.jpg", seed=2)
    make_takeout_sidecar(with_json, takeout_dt)
    named = make_photo(tmp_path / "IMG_20200808_101010.jpg", seed=3)
    plain = make_photo(tmp_path / "plain.jpg", seed=4)
    for p in (with_exif, with_json, named, plain):
        set_mtime(p, mtime_dt)

    files = scan.collect([tmp_path])
    resolved = dates.resolve_dates(files)

    assert resolved[with_exif] == (exif_dt, "exif")
    dt, source = resolved[with_json]
    assert source == "takeout-json" and abs((dt - takeout_dt).total_seconds()) < 24 * 3600
    assert resolved[named][1] in ("filename",)
    assert resolved[named][0] == datetime(2020, 8, 8, 10, 10, 10)
    assert resolved[plain] == (mtime_dt, "file-timestamp")
