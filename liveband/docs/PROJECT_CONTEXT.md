# Project context: LiveBand (working name)

**Read this first.** It is the single source of truth. Every agent and every resumed
session starts here. Last updated 2026-09-29.

## 1. What this is

An AI band, orchestra and choir for live events, in any musical culture. It plays whole
events and reacts to live commands like a real bandleader: natural stops with ring-out,
musical mid-song switches, vamps and cues. Users build **personas** and a **master
model** (their dream band) from traits of consenting, paid talent, or from scratch in
the **Creator Studio**. Full requirements: [SPEC.md](SPEC.md). Legal map:
[LEGAL_AND_RIGHTS.md](LEGAL_AND_RIGHTS.md).

## 2. Stage

**Specification.** No code yet, nothing deployed. Waiting on the owner's answers to
P1–P18 in [OPEN_ITEMS.md](OPEN_ITEMS.md).

## 3. The owner's working rules (from the handoff)

- Don't ask what you can work out, or what they already said. Ask only questions that
  change the outcome, batched and numbered (P1, P2…), each saying what it changes.
- As automatic as possible: one-line installs, self-checks that explain problems in
  plain English, no manual dashboard steps.
- Quality over convenience. Off-the-shelf is a plus, never at the cost of the result.
- Finish, test, then report. Run the full test suite before every push. Try UIs in a
  real browser at phone size. Confirm deploys are live.
- Be honest about limits: say what was verified and what wasn't.
- Replies: plain English, outcome first, short tables and lists. Before any purchase,
  give exact products, quantities, approximate prices and totals.
- The owner uses Android and prefers web apps (mobile-first, installable) unless told
  otherwise.
- The owner often adds instructions mid-task. Fold them in without dropping the current
  work, and confirm they were handled.
- Keep nothing only in chat. Log every owner message in
  [history/CONVERSATION_LOG.md](history/CONVERSATION_LOG.md).

## 4. Environment and constraints

- Repository: `mayerspitz/test`, which is only a temporary home. Everything lives in
  `liveband/`. Branch: `claude/blissful-babbage-dxjkkp` (created from `origin/main`).
  Never merge into `main`, and no PRs unless asked.
- Other projects live on other branches of this repo. Never touch them, or their Render
  services (`home-audio`, `home-audio-demo`).
- Hosting preference: Render (free plan is fine for now). **Render has no GPUs**, so GPU
  work needs another provider (R12).
- The sandbox network only reaches GitHub, so many official sites can't be checked from
  here (see RESEARCH_NOTES).

## 5. Requirements (summary; details in SPEC.md)

1. Any musical culture, as **style packs** (data, not code): tuning in cents, scales,
   rhythms, instruments + technique libraries, vocal ornaments, languages and accents,
   repertoire, customs.
2. Any event type, as **event templates** of segments and cues.
3. Separate services, including the owner's list: midi, songs, kits, instruments,
   singing, scales and notes, songs library, AI live chat for event admins,
   extraction/ingestion, effects, player. Full map: SPEC 8.2.
4. Natural live behavior: stop with natural tails, mid-song switches with bridges,
   segments, vamps, cues, instant response.
5. Generate full arrangements within seconds of a command; the player runs them.
6. Personas and the master model: combine traits from many talents; the same for
   instruments.
7. Creator Studio: build from scratch with prompts, pickers and sung references, then
   iterate until right.
8. Support any sound samples; start with 5–10 instruments and 5–10 voice styles.
9. Talent opts in, gives consent per trait and use, and earns on every paid use. Free
   and promo use only with their consent and within their limits.
10. Freemium business model built for maximum engagement.
11. Legal help: mapped in LEGAL_AND_RIGHTS.md. A lawyer is still needed.

## 6. Decision log

| # | Date | Decision | Why | Alternatives rejected | By |
|---|---|---|---|---|---|
| 1 | 2026-09-29 | Scope is any culture and any event type, not Jewish or wedding-specific | Owner's instruction (messages 5–6) | Jewish weddings only (v0.3) | Owner |
| 2 | 2026-09-29 | Consent-only use of real voices and named styles; talent earns per use; free and promo use only within talent's limits | Owner's instruction (messages 1 and 3) | — | Owner |
| 3 | 2026-09-29 | Personas / master model built from many talents' traits; the same for instruments | Owner (message 2) | — | Owner |
| 4 | 2026-09-29 | Creator Studio: build from scratch with prompts, pickers and sung references, iterating | Owner (message 4) | — | Owner |
| 5 | 2026-09-29 | Project lives in `liveband/` on the assigned branch, following "New Project Handoff" | That handoff matches this repo and session; the other PDF describes a different repo and an orphan branch | Orphan branch in another repo | Agent (confirm in P18) |
| 6 | 2026-09-29 | Working name "LiveBand" | The earlier name was culture-specific | "Kol Simcha" | Agent (P18) |
| 7 | 2026-09-29 | Keep the v0.3 Jewish-wedding spec as a worked example in history | The owner wants nothing lost; it's a template for writing style packs | Delete it | Agent (A6) |
| 8 | 2026-09-29 | Treat source separation (Demucs) as a replaceable component | Meta's Demucs repo was archived in Jan 2025 (R1) | Hard dependency on it | Agent |
| 9 | 2026-09-29 | Persona blending requires shared multi-speaker trait models | DiffSinger mixes speakers only within one trained model (R5) | Blending separately trained models | Agent (inference; test in PoC-2) |

**Proposed, awaiting P6:** D1 notes first, sound live · D2 live effects · D3 vocals
rendered ahead · D4 offline venue node with hot standby · D5 packages per service, no
network in the audio path · D6 pitch in cents · D9 pre-generate the planned program.

## 7. What's built and where it runs

Nothing yet. No services, no URLs, no environment variables.

## 8. Verified vs. not

- Verified: the component and legal facts marked VERIFIED in RESEARCH_NOTES.
- Not verified: every latency target in SPEC section 9, singing quality, persona
  blending across talents, arrangement quality. All of them are PoC work (SPEC 12).

## 9. Next steps

1. The owner answers P1–P18 (most have defaults).
2. Update the spec to v0.5 with the answers, and draft the first style pack(s) and
   event template(s) (T3).
3. PoC-1 (natural stop and switch) with tests, then PoC-2 to PoC-4.
