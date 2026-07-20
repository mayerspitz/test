"""Duplicate detection: exact byte duplicates plus near-duplicate photos.

Photos: SHA-256 exact matching, then perceptual (dHash) clustering that also
catches the same shot saved as RAW + JPEG or re-exported at another size.
Videos: exact SHA-256 matching only — automatically judging "similar" videos
is unsafe, so distinct videos are never dropped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from . import hashing, quality
from .scan import MediaFile


@dataclass
class DupeCluster:
    keep: MediaFile
    drop: list[MediaFile]
    reason: str                     # "exact" | "similar"


@dataclass
class DedupeResult:
    keepers: list[MediaFile]
    clusters: list[DupeCluster] = field(default_factory=list)

    @property
    def dropped(self) -> list[MediaFile]:
        return [mf for c in self.clusters for mf in c.drop]


def find_duplicates(files: list[MediaFile], threshold: int = 4,
                    progress=None) -> DedupeResult:
    """Group duplicates and pick the highest-quality file of each group."""
    def note(msg: str) -> None:
        if progress:
            progress(msg)

    # Pass 1 — exact duplicates (photos and videos alike)
    by_sha: dict[str, list[MediaFile]] = {}
    for idx, mf in enumerate(files):
        sha = hashing.sha256_file(mf.path)
        mf.extras["sha256"] = sha
        by_sha.setdefault(sha, []).append(mf)
        if idx % 100 == 99:
            note(f"  checksums... {idx + 1}/{len(files)}")

    clusters: list[DupeCluster] = []
    representatives: list[MediaFile] = []
    for group in by_sha.values():
        if len(group) == 1:
            representatives.append(group[0])
        else:
            best = quality.pick_best(group)
            clusters.append(DupeCluster(keep=best,
                                        drop=[m for m in group if m is not best],
                                        reason="exact"))
            representatives.append(best)

    # Pass 2 — near-duplicate photos among the remaining representatives
    photo_reps = [mf for mf in representatives if mf.kind == "photo"]
    phashes: dict[Path, int] = {}
    path_to_mf = {mf.path: mf for mf in photo_reps}
    for idx, mf in enumerate(photo_reps):
        ph = hashing.perceptual_hash(mf.path)
        if ph is not None:
            phashes[mf.path] = ph
        if idx % 50 == 49:
            note(f"  visual fingerprints... {idx + 1}/{len(photo_reps)}")

    absorbed: set[Path] = set()
    for cluster_paths in hashing.near_duplicate_clusters(phashes, threshold=threshold):
        members = [path_to_mf[p] for p in cluster_paths]
        best = quality.pick_best(members)
        drop = [m for m in members if m is not best]
        # merge with an exact-cluster the winner may already own
        existing = next((c for c in clusters if c.keep is best), None)
        if existing:
            existing.drop.extend(drop)
            existing.reason = "exact+similar"
        else:
            clusters.append(DupeCluster(keep=best, drop=drop, reason="similar"))
        absorbed.update(m.path for m in drop)

    keepers = [mf for mf in representatives if mf.path not in absorbed]
    return DedupeResult(keepers=keepers, clusters=clusters)
