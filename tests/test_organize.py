from datetime import datetime
from pathlib import PurePosixPath

from photorounds.core import organize


DT = datetime(2021, 5, 12, 14, 30, 55)


def test_month_folder_default():
    assert organize.folder_for(DT, "month") == PurePosixPath("2021/2021-05 May")


def test_month_folder_plain():
    assert organize.folder_for(DT, "month", month_names=False) == PurePosixPath("2021/2021-05")


def test_year_week_day_folders():
    assert organize.folder_for(DT, "year") == PurePosixPath("2021")
    assert organize.folder_for(DT, "week") == PurePosixPath("2021/2021-W19")
    assert organize.folder_for(DT, "day") == PurePosixPath("2021/2021-05 May/2021-05-12")


def test_folders_sort_chronologically():
    dts = [datetime(2019, 11, 3), datetime(2020, 2, 1), datetime(2020, 10, 9), datetime(2021, 1, 1)]
    folders = [str(organize.folder_for(d, "month")) for d in dts]
    assert folders == sorted(folders)


def test_chrono_name_sorts_earliest_first():
    early = organize.chrono_name(datetime(2021, 5, 12, 9, 0, 0), "zebra.jpg")
    late = organize.chrono_name(datetime(2021, 5, 12, 18, 0, 0), "alpha.jpg")
    assert early < late
    assert early == "20210512_090000_zebra.jpg"


def test_chrono_name_does_not_stack_prefixes():
    once = organize.chrono_name(DT, "IMG_007.jpg")
    twice = organize.chrono_name(DT, once)
    assert twice == once


def test_chrono_name_pure_timestamp_not_doubled():
    dt = datetime(2021, 5, 12, 15, 0, 0)
    assert organize.chrono_name(dt, "20210512_150000.mp4") == "20210512_150000.mp4"


def test_chrono_name_lowercases_extension():
    assert organize.chrono_name(DT, "PHOTO.JPG").endswith(".jpg")


def test_sanitize_windows_forbidden_characters():
    assert organize.sanitize_component('a<b>:c"|?*.jpg') == "a_b__c____.jpg"
    assert organize.sanitize_component("trailing. ") == "trailing"
    assert organize.sanitize_component("") == "file"


def test_unique_path_collision_suffixes(tmp_path):
    first = organize.unique_path(tmp_path, "x.jpg")
    first.parent.mkdir(parents=True, exist_ok=True)
    first.write_bytes(b"1")
    second = organize.unique_path(tmp_path, "x.jpg")
    assert second.name == "x_001.jpg"
    second.write_bytes(b"2")
    assert organize.unique_path(tmp_path, "x.jpg").name == "x_002.jpg"


def test_target_relpath_unknown_date():
    rel = organize.target_relpath(None, "mystery.png")
    assert rel.parts[0] == organize.UNKNOWN_DATE_FOLDER
