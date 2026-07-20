# PhotoRounds

**Offline photo & video consolidation for Windows** (works on macOS/Linux too).
Select photos and videos in any format — including Canon CR2/CR3 and other RAW,
HEIC, and every common video container — and process them in **rounds**:

1. **Ingest & organize** — copy everything into a date-organized tree
   (by month by default; year/week/day available), named so that oldest sorts
   first in plain Windows Explorer. Google Takeout folders are understood,
   including their JSON date sidecars.
2. **Duplicates** — "choose highest quality and remove duplicates": finds
   byte-identical *and* visually identical copies (same shot as RAW + JPEG, or
   re-saved smaller) and keeps the best one. Report-only mode available.
3. **Convert** — everything to JPEG (RAW developed, HEIC/PNG/TIFF converted,
   existing JPEGs copied untouched) and videos to MP4.
4. **Resize for print** — exact 4x6 / 5x7 / 8x10 / custom at 300 DPI,
   auto-rotation, lab-style crop (or fit/pad), low-resolution warnings.

**Every round writes a brand-new numbered folder and never touches previous
rounds** — `Round_01_ingest`, `Round_02_dedupe`, ... Each round carries a
`_round_info\manifest.json` + `report.txt` documenting every file and decision.
Originals are only ever read. There is **no network code, no cloud, no AI** —
nothing leaves your machine.

The full consolidation plan (SD cards + PCs + Google Photos → print store),
including how to get your library out of Google Photos without any AI/cloud
processing, is in **[STRATEGY.md](STRATEGY.md)**.

---

## Install on Windows

### Option A — download the app (easiest, no Python needed)

1. Open this repository's **Releases** page:
   `https://github.com/mayerspitz/test/releases` → release **"PhotoRounds for
   Windows — latest build"** (built automatically by GitHub Actions from this
   code; also downloadable from any green Actions run under *Artifacts*).
2. Download **`PhotoRounds.exe`** and put it anywhere (Desktop is fine).
3. Double-click it. If Windows SmartScreen warns about an unknown app, click
   **More info → Run anyway** — the file is unsigned, which is normal for a
   personal build.

HEIC, RAW **and ExifTool** support are already inside the .exe. On first
launch the app offers to fetch **ffmpeg** (video conversion) by itself — one
click, no command line, downloaded once from its official site.

### Option B — one-click install from source

1. Click the green **Code** button on the repository page → **Download ZIP**,
   and extract it (or `git clone` it).
2. Double-click **`install_windows.bat`** in the extracted folder. It checks
   for Python (pointing you to python.org if missing — tick *"Add python.exe
   to PATH"* when installing), sets everything up, and puts a **PhotoRounds
   icon on your Desktop**.

### Option C — manual (for developers)

1. Install Python 3.10+ from [python.org](https://www.python.org/downloads/)
   (tick *"Add python.exe to PATH"*; tkinter for the window app is included).
2. In a Command Prompt:

   ```bat
   git clone https://github.com/mayerspitz/test photorounds && cd photorounds
   pip install -e .[all]
   ```

   `[all]` adds HEIC support (`pillow-heif`) and true RAW development
   (`rawpy`). Bare `pip install -e .` needs only Pillow.

### Helper tools — installed automatically

Two free helpers unlock extra capability: **ExifTool** (best dates for RAW &
video, RAW fallback conversion) and **ffmpeg** (video conversion to MP4). You
don't need to install them yourself:

- The **.exe already contains ExifTool**.
- On first launch the app **offers to download whatever is missing** — one
  click; or press **Get missing helpers** any time (CLI:
  `photorounds setup-helpers`). Official builds only (exiftool.org,
  gyan.dev), stored in `%LOCALAPPDATA%\PhotoRounds\tools`, nothing
  system-wide, and no photo data is ever sent anywhere — this download is the
  app's only network activity, and it's opt-in.

Everything still works without them (RAW/video are then organized and
deduplicated but copied through unconverted). The *Optional components…*
button (or `photorounds tools`) shows what's detected.

## Use — window app

```bat
photorounds
```

Pick a **project folder** (all rounds are created inside it), then work
through the tabs: *Ingest → Duplicates → Convert → Resize*, pressing **Run
this round** for each. Every tab's input defaults to the latest round, so the
rounds chain naturally. The *Single file* tab copies/converts/resizes one
picked file into any folder you choose.

## Use — command line

```bat
:: Round 1: organize everything (SD cards, folders, extracted Google Takeout)
photorounds ingest E:\Staging\SD_card_01 E:\Staging\PC_Pictures E:\Staging\Takeout ^
    --dest D:\MyPhotoMaster --by month

:: Round 2: keep highest quality, remove duplicates  (--mode report = list only)
photorounds dedupe --dest D:\MyPhotoMaster --mode remove

:: Round 3: everything to JPG / MP4
photorounds convert --dest D:\MyPhotoMaster

:: Round 4: print-ready 4x6 at 300 DPI
photorounds resize --dest D:\MyPhotoMaster --size 4x6

:: one-off single file
photorounds single C:\pics\IMG_0042.CR2 --dest C:\out --to-jpeg --size 4x6

photorounds rounds --dest D:\MyPhotoMaster     :: list existing rounds
```

Each command reads the previous round by default (`--input` overrides).
Organization options: `--by year|month|week|day`, `--no-month-names`;
resize options: `--size 4x6|5x7|8x10|3.5x5|11x14|A4|WxH`, `--dpi`,
`--mode crop|fit|pad`, `--videos skip|copy`.

## What the output looks like

```
D:\MyPhotoMaster\
  Round_01_ingest\
    2019\2019-12 December\20191231_234500_NYE_party.jpg
    2021\2021-05 May\20210512_143055_IMG_0501.jpg
    2021\2021-05 May\20210512_150000.mp4
    _round_info\manifest.json, report.txt
  Round_02_dedupe\   (same tree, duplicates gone)
  Round_03_convert\  (same tree, all .jpg/.mp4)
  Round_04_resize\   (same tree, exact 1800x1200 print files)
```

Alphabetical order = chronological order, for folders and files alike.

## Development

```bash
pip install -e .[dev]
pytest            # 44 tests: organizing, dates, dedupe, convert, resize, full pipeline
```
