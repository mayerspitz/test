"""Tkinter window app — 100% local, no network.

One window, one tab per round type. Every run writes a new immutable round
folder inside the chosen project folder.
"""

from __future__ import annotations

import queue
import threading
import traceback
from pathlib import Path

from . import APP_NAME, __version__, ops
from .core import rounds, tools
from .core.organize import GRANULARITIES
from .core.resize import FIT_MODES, PRINT_PRESETS, ResizeSpec

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
    from tkinter.scrolledtext import ScrolledText
    HAVE_TK = True
except ImportError:
    HAVE_TK = False

MEDIA_FILETYPES = [
    ("Photos & videos", "*.jpg *.jpeg *.png *.gif *.bmp *.tif *.tiff *.webp *.heic *.heif "
                        "*.cr2 *.cr3 *.crw *.nef *.arw *.orf *.rw2 *.raf *.dng "
                        "*.mp4 *.mov *.avi *.mkv *.wmv *.mts *.m2ts *.3gp *.webm"),
    ("All files", "*.*"),
]


class App:
    def __init__(self, root: "tk.Tk") -> None:
        self.root = root
        root.title(f"{APP_NAME} {__version__} — offline photo & video organizer")
        root.geometry("860x640")
        root.minsize(760, 560)

        self.log_queue: queue.Queue[str] = queue.Queue()
        self.worker: threading.Thread | None = None
        self.last_round: Path | None = None

        outer = ttk.Frame(root, padding=10)
        outer.pack(fill="both", expand=True)

        proj = ttk.LabelFrame(outer, text="Project folder (all rounds are created inside it)", padding=8)
        proj.pack(fill="x")
        self.project_var = tk.StringVar()
        ttk.Entry(proj, textvariable=self.project_var).pack(side="left", fill="x", expand=True, padx=(0, 6))
        ttk.Button(proj, text="Browse...", command=self._pick_project).pack(side="left")

        self.nb = ttk.Notebook(outer)
        self.nb.pack(fill="x", pady=8)
        self._build_ingest_tab()
        self._build_dedupe_tab()
        self._build_convert_tab()
        self._build_resize_tab()
        self._build_single_tab()

        runrow = ttk.Frame(outer)
        runrow.pack(fill="x")
        self.run_btn = ttk.Button(runrow, text="Run this round", command=self._run_clicked)
        self.run_btn.pack(side="left")
        self.open_btn = ttk.Button(runrow, text="Open result folder", command=self._open_result,
                                   state="disabled")
        self.open_btn.pack(side="left", padx=6)
        ttk.Button(runrow, text="Optional components...",
                   command=lambda: messagebox.showinfo("Optional components",
                                                       tools.capability_report())).pack(side="right")

        logframe = ttk.LabelFrame(outer, text="Progress", padding=4)
        logframe.pack(fill="both", expand=True, pady=(8, 0))
        self.log = ScrolledText(logframe, height=12, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True)

        self._log(f"{APP_NAME} runs entirely on this computer. "
                  "No photo ever leaves your machine.")
        self._log(tools.capability_report())
        root.after(120, self._poll_log)

    # ---------- tabs ----------

    def _build_ingest_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="  1. Ingest & organize  ")
        ttk.Label(tab, text="Sources — SD cards, folders, extracted Google Takeout "
                            "(its JSON date files are read automatically):").pack(anchor="w")
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=4)
        self.sources_list = tk.Listbox(row, height=5, selectmode="extended")
        self.sources_list.pack(side="left", fill="x", expand=True)
        btns = ttk.Frame(row)
        btns.pack(side="left", padx=6)
        ttk.Button(btns, text="Add folder...", command=self._add_source_folder).pack(fill="x")
        ttk.Button(btns, text="Add files...", command=self._add_source_files).pack(fill="x", pady=3)
        ttk.Button(btns, text="Remove selected", command=self._remove_sources).pack(fill="x")

        opts = ttk.Frame(tab)
        opts.pack(fill="x", pady=4)
        ttk.Label(opts, text="Group folders by:").pack(side="left")
        self.granularity = tk.StringVar(value="month")
        ttk.Combobox(opts, textvariable=self.granularity, values=GRANULARITIES,
                     state="readonly", width=8).pack(side="left", padx=6)
        self.month_names = tk.BooleanVar(value=True)
        ttk.Checkbutton(opts, text="month names in folders (2021-05 May)",
                        variable=self.month_names).pack(side="left", padx=10)
        self.verify = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, text="verify every copy (slower)",
                        variable=self.verify).pack(side="left", padx=10)
        ttk.Label(tab, foreground="#555",
                  text="Copies only — your originals are never touched. Files are named "
                       "20210512_143055_name.jpg so oldest sorts first.").pack(anchor="w")

    def _build_dedupe_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="  2. Duplicates  ")
        self.dedupe_input = self._input_row(tab)
        opts = ttk.Frame(tab)
        opts.pack(fill="x", pady=4)
        self.dedupe_mode = tk.StringVar(value="remove")
        ttk.Radiobutton(opts, text="Choose highest quality and remove duplicates",
                        variable=self.dedupe_mode, value="remove").pack(anchor="w")
        ttk.Radiobutton(opts, text="Report only — copy everything, just list duplicates",
                        variable=self.dedupe_mode, value="report").pack(anchor="w")
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Visual similarity strictness (0 = identical only, 10 = loose):").pack(side="left")
        self.dedupe_threshold = tk.IntVar(value=4)
        ttk.Spinbox(row, from_=0, to=10, textvariable=self.dedupe_threshold, width=4).pack(side="left", padx=6)
        ttk.Label(tab, foreground="#555",
                  text="Also matches the same shot saved as RAW + JPEG or at different sizes "
                       "(RAW wins). Videos: exact duplicates only. Nothing is deleted — "
                       "dropped files remain in the previous round.").pack(anchor="w")

    def _build_convert_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="  3. Convert to JPG / MP4  ")
        self.convert_input = self._input_row(tab)
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="JPEG quality:").pack(side="left")
        self.convert_quality = tk.IntVar(value=95)
        ttk.Spinbox(row, from_=70, to=100, textvariable=self.convert_quality, width=4).pack(side="left", padx=6)
        ttk.Label(tab, foreground="#555",
                  text="RAW (Canon CR2/CR3, Nikon, Sony...) is developed to JPEG; HEIC/PNG/TIFF "
                       "become JPEG; existing JPEGs are copied untouched. Videos become MP4 "
                       "when ffmpeg is installed.").pack(anchor="w")

    def _build_resize_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="  4. Resize for print  ")
        self.resize_input = self._input_row(tab)
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text="Print size:").pack(side="left")
        self.resize_size = tk.StringVar(value="4x6")
        ttk.Combobox(row, textvariable=self.resize_size, values=list(PRINT_PRESETS),
                     width=7).pack(side="left", padx=6)
        ttk.Label(row, text="DPI:").pack(side="left")
        self.resize_dpi = tk.IntVar(value=300)
        ttk.Spinbox(row, from_=150, to=600, increment=50, textvariable=self.resize_dpi,
                    width=5).pack(side="left", padx=6)
        ttk.Label(row, text="Fit:").pack(side="left")
        self.resize_mode = tk.StringVar(value="crop")
        ttk.Combobox(row, textvariable=self.resize_mode, values=FIT_MODES, state="readonly",
                     width=6).pack(side="left", padx=6)
        self.resize_videos = tk.BooleanVar(value=False)
        ttk.Checkbutton(row, text="copy videos through", variable=self.resize_videos).pack(side="left", padx=10)
        ttk.Label(tab, foreground="#555",
                  text="crop = fill the print exactly like photo labs (default) · fit = shrink, no "
                       "cropping · pad = white borders. Low-resolution photos are flagged in the "
                       "report.").pack(anchor="w")

    def _build_single_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="  Single file  ")
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=2)
        ttk.Label(row, text="File:").pack(side="left")
        self.single_file = tk.StringVar()
        ttk.Entry(row, textvariable=self.single_file).pack(side="left", fill="x", expand=True, padx=6)
        ttk.Button(row, text="Browse...", command=self._pick_single_file).pack(side="left")
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=2)
        ttk.Label(row, text="Destination folder:").pack(side="left")
        self.single_dest = tk.StringVar()
        ttk.Entry(row, textvariable=self.single_dest).pack(side="left", fill="x", expand=True, padx=6)
        ttk.Button(row, text="Browse...", command=self._pick_single_dest).pack(side="left")
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=4)
        self.single_tojpeg = tk.BooleanVar(value=False)
        ttk.Checkbutton(row, text="convert to JPG (photos) / MP4 (videos)",
                        variable=self.single_tojpeg).pack(side="left")
        ttk.Label(row, text="   Resize:").pack(side="left")
        self.single_size = tk.StringVar(value="(no resize)")
        ttk.Combobox(row, textvariable=self.single_size,
                     values=["(no resize)", *PRINT_PRESETS], state="readonly",
                     width=10).pack(side="left", padx=6)
        self.single_chrono = tk.BooleanVar(value=False)
        ttk.Checkbutton(row, text="rename to date style", variable=self.single_chrono).pack(side="left", padx=8)

    def _input_row(self, tab: "ttk.Frame") -> "tk.StringVar":
        row = ttk.Frame(tab)
        row.pack(fill="x", pady=2)
        ttk.Label(row, text="Input round/folder:").pack(side="left")
        var = tk.StringVar(value="latest round")
        combo = ttk.Combobox(row, textvariable=var, width=52)
        combo.pack(side="left", fill="x", expand=True, padx=6)
        combo.configure(postcommand=lambda c=combo: self._fill_rounds(c))
        ttk.Button(row, text="Other folder...",
                   command=lambda v=var: self._pick_into(v)).pack(side="left")
        return var

    # ---------- pickers ----------

    def _pick_project(self) -> None:
        path = filedialog.askdirectory(title="Choose the project folder (rounds are created inside)")
        if path:
            self.project_var.set(path)

    def _fill_rounds(self, combo: "ttk.Combobox") -> None:
        project = self.project_var.get().strip()
        values = ["latest round"]
        if project:
            values += [str(r.path) for r in rounds.list_rounds(Path(project))]
        combo["values"] = values

    def _pick_into(self, var: "tk.StringVar") -> None:
        path = filedialog.askdirectory(title="Choose input folder")
        if path:
            var.set(path)

    def _add_source_folder(self) -> None:
        path = filedialog.askdirectory(title="Add a source folder (SD card, Pictures, Takeout...)")
        if path:
            self.sources_list.insert("end", path)

    def _add_source_files(self) -> None:
        for path in filedialog.askopenfilenames(title="Add photo/video files", filetypes=MEDIA_FILETYPES):
            self.sources_list.insert("end", path)

    def _remove_sources(self) -> None:
        for idx in reversed(self.sources_list.curselection()):
            self.sources_list.delete(idx)

    def _pick_single_file(self) -> None:
        path = filedialog.askopenfilename(title="Choose a photo or video", filetypes=MEDIA_FILETYPES)
        if path:
            self.single_file.set(path)

    def _pick_single_dest(self) -> None:
        path = filedialog.askdirectory(title="Choose destination folder")
        if path:
            self.single_dest.set(path)

    # ---------- running ----------

    def _log(self, msg: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", msg + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _poll_log(self) -> None:
        try:
            while True:
                self._log(self.log_queue.get_nowait())
        except queue.Empty:
            pass
        self.root.after(120, self._poll_log)

    def _project(self) -> Path | None:
        text = self.project_var.get().strip()
        if not text:
            messagebox.showwarning(APP_NAME, "Choose a project folder first.")
            return None
        return Path(text)

    def _input_path(self, var: "tk.StringVar", project: Path) -> Path | None:
        text = var.get().strip()
        if text in ("", "latest round", "latest"):
            last = rounds.latest_round(project)
            if last is None:
                messagebox.showwarning(APP_NAME, "No rounds exist yet — run Ingest first, "
                                                 "or pick an input folder.")
                return None
            return last.path
        return Path(text)

    def _run_clicked(self) -> None:
        if self.worker and self.worker.is_alive():
            return
        tab = self.nb.index(self.nb.select())
        job = self._make_job(tab)
        if job is None:
            return
        self.run_btn.configure(state="disabled")
        self.open_btn.configure(state="disabled")

        def work() -> None:
            try:
                result = job()
                self.last_round = result
                self.log_queue.put(f"DONE. Output: {result}")
            except Exception as exc:
                self.log_queue.put(f"ERROR: {exc}")
                self.log_queue.put(traceback.format_exc(limit=3))
            finally:
                self.root.after(0, lambda: (self.run_btn.configure(state="normal"),
                                            self.open_btn.configure(state="normal")))

        self.worker = threading.Thread(target=work, daemon=True)
        self.worker.start()

    def _make_job(self, tab: int):
        progress = self.log_queue.put
        if tab == 0:
            project = self._project()
            sources = list(self.sources_list.get(0, "end"))
            if project is None:
                return None
            if not sources:
                messagebox.showwarning(APP_NAME, "Add at least one source folder or file.")
                return None
            return lambda: ops.run_ingest(sources, project, granularity=self.granularity.get(),
                                          month_names=self.month_names.get(),
                                          verify=self.verify.get(), progress=progress)
        if tab == 1:
            project = self._project()
            if project is None:
                return None
            input_dir = self._input_path(self.dedupe_input, project)
            if input_dir is None:
                return None
            return lambda: ops.run_dedupe(input_dir, project, mode=self.dedupe_mode.get(),
                                          threshold=self.dedupe_threshold.get(), progress=progress)
        if tab == 2:
            project = self._project()
            if project is None:
                return None
            input_dir = self._input_path(self.convert_input, project)
            if input_dir is None:
                return None
            return lambda: ops.run_convert(input_dir, project,
                                           jpeg_quality=self.convert_quality.get(), progress=progress)
        if tab == 3:
            project = self._project()
            if project is None:
                return None
            input_dir = self._input_path(self.resize_input, project)
            if input_dir is None:
                return None
            try:
                spec = ResizeSpec.from_preset(self.resize_size.get(), dpi=self.resize_dpi.get(),
                                              mode=self.resize_mode.get())
            except ValueError as exc:
                messagebox.showwarning(APP_NAME, str(exc))
                return None
            videos = "copy" if self.resize_videos.get() else "skip"
            return lambda: ops.run_resize(input_dir, project, spec, videos=videos, progress=progress)
        if tab == 4:
            file, dest = self.single_file.get().strip(), self.single_dest.get().strip()
            if not file or not dest:
                messagebox.showwarning(APP_NAME, "Pick a file and a destination folder.")
                return None
            size = None
            if self.single_size.get() != "(no resize)":
                size = ResizeSpec.from_preset(self.single_size.get())
            return lambda: ops.run_single(file, dest, to_jpeg=self.single_tojpeg.get(), size=size,
                                          rename_chrono=self.single_chrono.get(), progress=progress)
        return None

    def _open_result(self) -> None:
        if self.last_round is None:
            return
        try:
            import os
            os.startfile(self.last_round)  # Windows
        except (AttributeError, OSError):
            self._log(f"Result folder: {self.last_round}")


def main() -> int:
    if not HAVE_TK:
        print("tkinter is not available in this Python. On Windows, install Python from "
              "python.org (tkinter is included). CLI mode still works: photorounds --help")
        return 1
    root = tk.Tk()
    try:
        ttk.Style().theme_use("vista")
    except Exception:
        pass
    App(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
