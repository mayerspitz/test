# Handoff documents

The owner attached these two documents to the first message (2026-09-29). They are kept
here unchanged, with plain-text copies for search and reading without a PDF tool.

| File | What it is | Status |
|---|---|---|
| `New_Project_Handoff.pdf` / `.txt` | "New Project Handoff": how to work in `mayerspitz/test`. It covers isolation rules, the folder layout, documentation discipline, the owner's working preferences, repo and tooling conventions, moving to its own repo, and first steps | **Followed.** It matches this repo and session. Sections 1, 3 and 4 are copied into `../../CLAUDE.md`, and the rules are summarized in `../PROJECT_CONTEXT.md` |
| `project-handoff_orphan-branch.pdf` / `.txt` | "Handoff: independent project in a shared repository": an orphan-branch model (trunk `project/<slug>`) in `mayerspitz/tailored-travel-planning`, with `STATUS.md` and `[slug]`-prefixed issues and PRs | **Not followed.** It targets a different repo and isolation model. Awaiting the owner's confirmation (P18) |

SHA-256 of the originals:
- `New_Project_Handoff.pdf`: `422034cfca57946fa040d5ba912df4495aa59a5eca678570f2f8c8665200f4a6`
- `project-handoff_orphan-branch.pdf`: `1d5362deeed7eb8912a482d143193377a41f18200ba071ef9941527ab6ff93dd`

## Where the two documents contradict each other

| Topic | New Project Handoff (followed) | Orphan-branch handoff (not followed) |
|---|---|---|
| Repository | `mayerspitz/test` | `mayerspitz/tailored-travel-planning` |
| Isolation | One top-level folder on a branch created from `origin/main` | An orphan branch with no shared history; files at the branch root |
| Branch names | The branch the session assigns (`claude/blissful-babbage-dxjkkp`) | Trunk `project/<slug>`; work branches `project/<slug>--<topic>` |
| Resume file | `docs/PROJECT_CONTEXT.md` + `docs/OPEN_ITEMS.md` + `docs/history/` | `STATUS.md` |
| PRs | None unless the owner asks | PRs into the trunk, titles prefixed `[<slug>]` |
| Moving out later | `git subtree split --prefix=<project-name>` | `git push <new-repo> project/<slug>:main` |

**Rules both documents share, and which we follow:**
- secrets never committed;
- `.env.example` has names only;
- commit and push after each meaningful step;
- tests run offline;
- every external call has a timeout and a fallback;
- CI, if added, scoped to this project's branches only;
- never touch other projects.

## Reading the PDFs in a fresh sandbox

`pypdf` failed in this sandbox (a broken `cryptography` dependency). This works:

```
apt-get install -y poppler-utils
pdftotext -layout file.pdf -
```
