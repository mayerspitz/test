"""Immutable round folders.

Every operation writes a brand-new `Round_NN_<operation>` folder inside the
project. Existing rounds are only ever read, never modified — each one is a
frozen snapshot you can go back to. Each round carries its own manifest
(machine-readable) and report (human-readable) under `_round_info/`.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

ROUND_PATTERN = re.compile(r"^Round_(\d{2,})_([A-Za-z0-9-]+)$")
INFO_DIR = "_round_info"


@dataclass
class RoundInfo:
    path: Path
    number: int
    operation: str


def list_rounds(project: Path) -> list[RoundInfo]:
    rounds = []
    if project.is_dir():
        for child in project.iterdir():
            m = ROUND_PATTERN.match(child.name)
            if child.is_dir() and m:
                rounds.append(RoundInfo(child, int(m.group(1)), m.group(2)))
    return sorted(rounds, key=lambda r: r.number)


def latest_round(project: Path) -> RoundInfo | None:
    rounds = list_rounds(project)
    return rounds[-1] if rounds else None


def create_round(project: Path, operation: str) -> Path:
    """Allocate the next Round_NN_<operation> folder. Never reuses a folder."""
    operation = re.sub(r"[^A-Za-z0-9-]+", "-", operation).strip("-") or "step"
    existing = list_rounds(project)
    number = existing[-1].number + 1 if existing else 1
    path = project / f"Round_{number:02d}_{operation}"
    if path.exists():
        raise FileExistsError(f"{path} already exists; rounds are never reused")
    (path / INFO_DIR).mkdir(parents=True)
    return path


@dataclass
class Manifest:
    round_path: Path
    operation: str
    options: dict = field(default_factory=dict)
    entries: list[dict] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    started: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))

    def add(self, *, src: Path | str, dest: Path | str | None, action: str,
            date: datetime | None = None, date_source: str = "",
            note: str = "", **extra) -> None:
        self.entries.append({
            "src": str(src),
            "dest": str(dest) if dest else None,
            "action": action,
            "date": date.isoformat(timespec="seconds") if date else None,
            "date_source": date_source,
            "note": note,
            **extra,
        })

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def counts(self) -> dict[str, int]:
        c: dict[str, int] = {}
        for e in self.entries:
            c[e["action"]] = c.get(e["action"], 0) + 1
        return c

    def save(self, report_lines: list[str] | None = None) -> None:
        info = self.round_path / INFO_DIR
        info.mkdir(parents=True, exist_ok=True)
        payload = {
            "app": "PhotoRounds",
            "operation": self.operation,
            "round": self.round_path.name,
            "started": self.started,
            "finished": datetime.now().isoformat(timespec="seconds"),
            "options": self.options,
            "counts": self.counts(),
            "warnings": self.warnings,
            "entries": self.entries,
        }
        (info / "manifest.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        lines = [
            f"PhotoRounds — {self.operation} — {self.round_path.name}",
            f"Started {self.started}, finished {payload['finished']}",
            "",
            "Counts: " + (", ".join(f"{k}={v}" for k, v in sorted(self.counts().items())) or "none"),
        ]
        if self.warnings:
            lines += ["", f"Warnings ({len(self.warnings)}):"]
            lines += [f"  - {w}" for w in self.warnings]
        if report_lines:
            lines += [""] + report_lines
        (info / "report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
