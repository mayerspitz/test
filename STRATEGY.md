# The Consolidation Strategy

Goal: merge **SD cards + PC folders + Google Photos** — every format, photos and
videos — into **one organized master folder system**, deduplicated, converted, and
sized, ready to hand to the printing store. Everything happens **on your own
machine**: no cloud service, no AI, no photo ever uploaded anywhere.

This repo contains both the plan (this file) and the tool that executes it
(**PhotoRounds** — see [README.md](README.md)).

---

## 1. The Google Photos problem — solved without AI or cloud processing

You cannot point a local program at Google Photos directly, and you rightly don't
want your library flowing through any AI or third-party service. The answer is
**Google Takeout** — Google's official bulk-export door:

1. Go to **takeout.google.com** while signed in to your Google account.
2. *Deselect all*, then tick only **Google Photos**.
3. Choose export type *once*, file type `.zip`, size **50 GB** (fewest archives
   to download; pick 10 GB if your connection is flaky).
4. Google prepares the export (minutes to a couple of days for big libraries)
   and emails you download links. **Download promptly** — links expire after
   about a week — and save the zips onto a big external drive.
5. Extract the zips. You now have a `Takeout/Google Photos/...` folder tree
   containing your actual image/video files.

From this moment on, **everything is offline**. Takeout is a plain file
download — no analysis, no AI, no third-party tool touching your account.

### The Takeout catch — and how it's handled

Takeout is notorious for two quirks, both handled automatically by PhotoRounds:

- **Dates live in JSON sidecars.** Many exported files (screenshots, WhatsApp
  saves, edited copies) carry no EXIF date; the true capture time sits in an
  accompanying `photo.jpg.supplemental-metadata.json` file
  (`photoTakenTime`). PhotoRounds reads these sidecars natively during ingest,
  so every Google photo lands in the correct month folder. The file's modified
  time (which Takeout sets to the download date) is ignored.
- **Albums create duplicates.** A photo that is in three albums appears in the
  export up to four times (once per album folder + once in "Photos from
  YYYY"). You don't need to care: the **dedupe round** collapses them to one
  copy automatically.

Two practical notes:

- If Google Photos was set to "Storage saver", Takeout gives you the
  compressed version — that is simply all Google has; it still prints fine at
  4x6/5x7.
- Sanity-check completeness: compare the item count Google Photos shows with
  what the ingest report counts, and keep the downloaded zips until the whole
  consolidation is verified and backed up.

---

## 2. The master plan — six phases

### Phase 0 — one staging area (an external drive)

Buy/free up one external drive larger than everything combined, and create:

```
E:\Staging\
    SD_card_01\      SD_card_02\  ...   (straight copy of each card)
    PC_laptop_Pictures\                 (copies of each computer's folders)
    Takeout\                            (extracted Google Takeout)
```

Copy — never move — sources into it. Your originals stay untouched everywhere.
SD cards are the most fragile thing you own: copy them first, retire them after.

### Phase 1 — Round 1: Ingest & organize

Point PhotoRounds at the staging folders. It copies every photo and video into
a new date-organized tree (**by month by default, earliest first** — folders
*and* files sort chronologically in plain Windows Explorer):

```
MyPhotoMaster\Round_01_ingest\
    2015\2015-07 July\20150704_100000_holiday.png
    2019\2019-12 December\20191231_234500_NYE_party.jpg
    2021\2021-05 May\20210512_143055_IMG_0501.jpg
    ...
    _round_info\manifest.json   ← where every file came from, and how its date was found
```

The capture date is found by a ladder: EXIF → Takeout JSON → ExifTool
(RAW/video) → video metadata → date-in-filename → file timestamp; the manifest
records which source was used for every single file.

### Phase 2 — Round 2: Duplicates ("choose highest quality and remove")

Across SD cards, PC folders and Takeout albums you certainly have the same
shot many times. The dedupe round finds:

- **exact copies** (byte-identical, SHA-256), and
- **near duplicates** (perceptual hash): the same picture saved smaller,
  recompressed, or as RAW + JPEG pair,

then keeps only the **highest-quality version** of each group
(RAW > TIFF > PNG > HEIC > JPEG, then resolution, then file size). Videos are
deduplicated only when byte-identical — no guessing. There is also a
*report-only* mode that removes nothing and just lists what it found, if you
want to review before committing.

**Nothing is ever deleted**: a "removed" duplicate simply isn't copied into
Round 2 — it still sits in Round 1, which is never touched again.

### Phase 3 — Round 3: Convert everything to JPG / MP4

Canon RAW (CR2/CR3), Nikon/Sony/etc. RAW, HEIC, PNG, TIFF, BMP, WebP → **JPEG
(quality 95)**; existing JPEGs are copied through untouched (zero quality
loss). Videos → **MP4 (H.264/AAC)** via ffmpeg. EXIF metadata and capture
dates survive conversion. Print stores accept everything from this round.

### Phase 4 — Round 4: Resize for print

Every photo becomes an exact **4x6 @ 300 DPI (1800x1200)** file — or 5x7,
8x10, custom — auto-rotated, portrait/landscape aware, center-cropped to fill
the print exactly the way photo labs do (options: `fit`, `pad` white borders).
Photos too small to print well are flagged in the report so there are no ugly
surprises at the store. Videos are skipped here (or copied through if asked).

### Phase 5 — Verify, back up, print

- Compare counts across rounds (each report states them).
- Spot-check a few months in each year.
- Back up following **3-2-1**: the master on your PC/drive, a second copy on
  another drive, ideally one copy elsewhere. The rounds structure makes this
  trivial — copy the folder.
- Take the **Round 4** folder to the printing store (USB stick). Its files are
  small (~1 MB each), universally readable, and sorted chronologically.

### Why "rounds" and not in-place editing

Every step writes a **brand-new numbered folder and never modifies previous
ones**. Round 1 is your forever-archive of everything; Round 2 the cleaned
set; Round 3 the universal-format set; Round 4 the print set. Any mistake at
any step: delete that round's folder, adjust options, re-run. You can never
lose data by running the tool. (Cost: disk space — rounds are full copies.
Keep them on the big external drive; archive or delete intermediate rounds
once you've verified the result.)

---

## 3. Privacy guarantees

- **PhotoRounds contains zero network code.** It cannot upload anything; you
  can run it with Wi-Fi off.
- No AI, no cloud APIs: duplicate detection is pure math (SHA-256 + a
  perceptual difference hash computed locally), date detection is metadata
  reading, conversion is local pixel processing.
- The only online step in the whole plan is **downloading your own files from
  Google via Takeout** — an export, not a processing service.
- Optional helpers (ExifTool, ffmpeg, rawpy) are equally offline, open-source,
  industry-standard tools.

---

## 4. Format coverage

| Input | Handled by | Notes |
|---|---|---|
| JPEG, PNG, TIFF, BMP, GIF, WebP | built-in (Pillow) | always available |
| HEIC/HEIF (iPhone) | `pip install pillow-heif` | one-line install |
| Canon CR2 / CR3, Nikon NEF, Sony ARW, DNG, Olympus/Panasonic/Fuji/Pentax RAW | `pip install rawpy` (LibRaw) — true RAW development; or ExifTool fallback extracts the full-size JPEG embedded in every RAW | either path yields print-ready JPEGs |
| MP4, MOV, AVI, MKV, WMV, MTS/M2TS, 3GP, WebM... | ffmpeg | without ffmpeg videos are still organized/deduped, just not converted |
| Google Takeout JSON sidecars | built-in | dates restored automatically |

Anything the tool can't convert is **copied through with a warning in the
report** — never dropped silently, never blocking the rest of the run.

---

## 5. Where existing free tools fit (optional second opinions)

PhotoRounds gives you the one-flow experience, but these mature local tools
are worth knowing — all free, all offline:

- **ExifTool** — the gold standard metadata reader PhotoRounds itself uses
  when installed; install it and RAW/video dates get noticeably better.
- **digiKam** — full open-source photo manager (RAW support, similarity
  search); good for *browsing* the finished master library.
- **Czkawka** — blazing-fast standalone duplicate finder; handy to
  double-check the master folder afterwards.
- **GooglePhotosTakeoutHelper** — open-source script that rewrites Takeout
  JSON dates into EXIF; an alternative to PhotoRounds' built-in sidecar
  handling if you ever process a Takeout with other software.

---

## 6. Practical order of battle

1. External drive → build `Staging\` (Phase 0). Start the Google Takeout
   export *first* — it takes the longest.
2. `photorounds gui` → Ingest tab: add staging folders → Run. Skim the report.
3. Dedupe tab (report mode first if you're cautious) → Run → skim → run again
   in remove mode.
4. Convert tab → Run.
5. Resize tab, 4x6 → Run. Check the low-resolution warnings list.
6. Copy `Round_04_resize` to a USB stick → print store. Back up the project
   folder. Done — and next month's new photos just get ingested into a new
   round the same way.
