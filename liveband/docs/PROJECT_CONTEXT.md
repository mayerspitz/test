# Project context: LiveBand (working name)

**Read this first.** It is the single source of truth. Every agent and every resumed
session starts here. Last updated 2026-09-29 (session 1, after message 8).

## 1. What this is

An AI band, orchestra and choir for live events, in any musical culture. It plays whole
events and reacts to live commands like a real bandleader: natural stops with ring-out,
musical mid-song switches, vamps and cues. Users build **personas** and a **master
model** (their dream band) from traits of consenting, paid talent, or from scratch in
the **Creator Studio**. Full requirements: [SPEC.md](SPEC.md). Legal map:
[LEGAL_AND_RIGHTS.md](LEGAL_AND_RIGHTS.md). Feasibility: [FEASIBILITY.md](FEASIBILITY.md).

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
- Reading PDFs in the sandbox: `pypdf` fails (broken `cryptography` dependency). Use
  `apt-get install -y poppler-utils`, then `pdftotext -layout file.pdf -`.
- Research method: a helper agent checks facts with strict VERIFIED / PARTLY /
  UNCONFIRMED labels. The brief and raw report are in `history/research/`.
- Commits end with the session's attribution lines. No model names in commits, code or
  docs.

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

Every decision, with its reasoning. **Status:** DECIDED (by the owner, or made by the
agent and final unless challenged) · PROPOSED (awaiting the owner, usually via a
P-question) · SUPERSEDED. The date is when it was made. "Msg N" refers to
[history/CONVERSATION_LOG.md](history/CONVERSATION_LOG.md).

### 6.1 Owner decisions (from the owner's messages)

| # | Decision | Source | Status |
|---|---|---|---|
| O1 | Build an app that replaces the entire music and choir at events | Msg 1 | DECIDED |
| O2 | It must know the accents, songs, music styles and song styles of every culture | Msg 1, widened by msg 5 | DECIDED |
| O3 | Replicate singers' styles and voices, including real voices, always with consent | Msg 1 | DECIDED |
| O4 | Build as separate parts ("micro or app services libraries"), each handling its own job. Named parts: midi, songs, kits, instruments, singing, scales and notes, songs library, AI live chat for event admins, extraction of existing songs into full arrangements in our formats, effects (its own service), player (its own service) | Msg 1 | DECIDED (the deployment form is proposal D5) |
| O5 | Switch in the middle of a song naturally | Msg 1 | DECIDED |
| O6 | Generate all tracks, instruments and parts, every note with its effects, within seconds of a command (switch song, play a segment or melody); the player then runs it | Msg 1 | DECIDED (implemented as D1–D3) |
| O7 | An abrupt stop must sound natural: the music stops where it is, but the after-sound rings out | Msg 1 | DECIDED |
| O8 | Support any sound samples and any instrumental and singing performance styles; start with about 5–10 | Msg 2 | DECIDED (meaning of "5–10" is assumption A2) |
| O9 | Keep an extensive library of sounds, samples and instrument playing techniques (e.g. violin "pitches and squeezes"), separate from digital effects | Msg 2 | DECIDED |
| O10 | Keep a library of voice techniques; combine many talents into one persona; users build a "master model" by picking styles and pitches from singers or models; the same for all instruments and musical parts | Msg 2 | DECIDED |
| O11 | The owner needs help with the legal side | Msg 3 | DECIDED → LEGAL_AND_RIGHTS.md |
| O12 | Talent opts in and earns when their talent is used; free or promo use needs their consent and has limits | Msg 3 | DECIDED |
| O13 | Business model: the standard AI-era model, engaging as many customers and users as possible | Msg 3 | DECIDED |
| O14 | Tools to build a model from scratch: pick pitches and effects, record one's own voice to show intent, the AI enhances and finishes it from a prompt, and the user tweaks until it's exact | Msg 4 | DECIDED |
| O15 | Any culture; nothing specifically Jewish | Msg 5 | DECIDED (supersedes the Jewish-only scope) |
| O16 | Any events, not specifically weddings | Msg 6 | DECIDED (supersedes the wedding-only scope) |
| O17 | Everything (spec, decisions with reasoning, handoff) saved in the repo so work can continue anywhere | Msg 8 | DECIDED |

### 6.2 Project and process decisions (agent)

| # | Decision | Why | Alternatives rejected | Status |
|---|---|---|---|---|
| G1 | The project lives in `liveband/` on branch `claude/blissful-babbage-dxjkkp`, created from `origin/main`, following "New Project Handoff" | That handoff is for this repo and this session's assigned branch; this session's GitHub access covers only `mayerspitz/test` | The orphan-branch handoff for `mayerspitz/tailored-travel-planning` | DECIDED, owner to confirm (P18) |
| G2 | Working name "LiveBand", folder `liveband/` | A folder was needed now. The first working name, "Kol Simcha" (from the wedding verse "kol sasson v'kol simcha"), became wrong once the scope went culture-neutral. Renaming a folder later is cheap | Keep "Kol Simcha"; wait for a name | DECIDED, owner to confirm (P18) |
| G3 | Keep the v0.3 Jewish-wedding spec as a worked example in `history/` | The owner wants nothing lost, and it shows how to write one style pack + event template in depth | Delete it (a strict reading of msg 5) | DECIDED, owner may reverse (A6) |
| G4 | The detailed spec lives in `SPEC.md`; this file summarizes it and holds the decisions | Size: this file must stay readable as the first thing every session reads | Everything in one file | DECIDED |
| G5 | Facts go through a strict VERIFIED / PARTLY / UNCONFIRMED check with sources (RESEARCH_NOTES) | Owner rule: be honest about what was verified. The sandbox reaches only GitHub | Writing from memory without flags | DECIDED |
| G6 | Every owner message is logged word for word, and every assistant reply too (`history/ASSISTANT_REPLIES.md`) | Handoff rule plus msg 8 | Summaries only | DECIDED |
| G7 | Both handoff PDFs are stored in the repo with text copies (`handoff/`) | Msg 8: "entire handoff" | Keep them only in chat uploads | DECIDED |

### 6.3 Product and architecture decisions

| # | Decision | Why | Alternatives rejected | Status |
|---|---|---|---|---|
| D1 | **Notes first, sound live.** Generate a complete arrangement (every note, technique, effect and mix move) in about 2 s, and render the sound live on the venue engine | The owner's "every key rendered with its effects" is what a sampler does. Notes are fast to generate and give note-level control, musical switching, and key and tempo changes without audio damage | End-to-end audio generation (no per-note control, no musical mid-phrase switching, weak stems, training-data lawsuits against Suno/Udio); pre-rendered WAV stems per song (a stop cuts the tails, switches need crossfades, pitch and tempo shifts degrade audio) | PROPOSED (P6) |
| D2 | **Effects run live, after the instruments** | A stop just stops new notes; reverb, delay, releases and ringing cymbals then decay naturally. This is exactly O7 | Baking effects into audio files | PROPOSED (P6) |
| D3 | **Vocals are rendered phrase by phrase, at least 8 s ahead**, then pass through live effects | Neural singing isn't instant (DiffSinger claims no real-time mode, R4). A stop is a natural release of the current syllable plus the live reverb tail | Real-time streaming singing (not proven) | PROPOSED (P6) |
| D4 | **The event runs offline on a venue node with a hot standby** | Venue internet is unreliable and an event can't be re-run. The cloud is for preparation only | Streaming the music from the cloud (risk of dead air) | PROPOSED (P4, P6) |
| D5 | **Every service is its own package** (contract, tests, version). Services that aren't real-time deploy as network services; the real-time ones (player, renderer, effects, instrument and kit runtimes) link into one engine process | Network hops in the audio path add delay, jitter and failure points. This keeps the owner's "separate parts" (O4) without those costs | Every part as a network microservice, including the audio path | PROPOSED (P6) |
| D6 | **Pitch stored in cents with tuning profiles**; MPE / MIDI 2.0 for export; MTS-ESP for tuning hosted instruments | Maqam, raga, dastgah, makam and gamelan need microtones; MIDI note numbers alone are 12-tone (R9, R10) | MIDI note numbers only | PROPOSED |
| D7 | **Consent for named people:** timbre always needs consent, whatever its weight in a blend; named style traits need consent; generic archetypes don't | Right of publicity; the ELVIS Act also covers tool-makers (R13); ethics; O3 | Allow imitating any singer's style by name without consent | PROPOSED (confirm with counsel) |
| D8 | **Musicians approve content before it plays live:** ingested songs and AI arrangements | Automatic transcription and arranging aren't reliable enough (FEASIBILITY rows 4 and 10) | Fully automatic pipeline | PROPOSED |
| D9 | **Pre-generate the whole planned program before the event** | Live commands then mostly hit a warm cache: less risk, less GPU load | Generate everything live | PROPOSED |
| D10 | **Switches default to the next phrase**; "now" is always available | That's how a live bandleader switches, so it sounds natural | Immediate cut or crossfade by default | PROPOSED |
| D11 | **The bridge buys time:** vamps and fills cover generation of a new song; never silence | Meets "within seconds" without dead air | Wait silently for generation | PROPOSED |
| D12 | **Cues for exact moments are armed in advance and fired by a button**, not chat | Chat takes about 1.5 s to understand; moments like a kiss, a goal or a winner's name need ≤ 50 ms | Chat-only control | PROPOSED |
| D13 | **Two control surfaces:** admin chat (natural language) + an operator console (buttons). The operator has final say | Speed for critical moments; resolving conflicting admins | Chat only | PROPOSED (P1) |
| D14 | **Lyrics stored in their original script with pronunciation markings**; pronunciation comes from rules per language and dialect; any voice can sing any language; accent is a separate trait | "Know the accent of all cultures" (O2); the same song in different accents | Transliteration only | PROPOSED |
| D15 | **Ornamented pitch** (slides, gamaka, meend, bends, vibrato) stored as expression curves on each note | Faking ornaments with extra notes sounds wrong and can't be moved between personas | Extra grace notes only | PROPOSED |
| D16 | **Rights bill of materials** on every persona and master model; rendering is refused if any consent is missing, expired, revoked or out of scope | Makes O12 enforceable and auditable; basis for royalties | Consent checked only at signup | PROPOSED |
| D17 | **A user's own voice is a style reference by default**; cloning their own timbre is a separate opt-in with identity and liveness checks | Voiceprints are biometric data in some jurisdictions (L3) | Clone every uploaded voice | PROPOSED (P14) |
| D18 | **Anti-impersonation:** uploads are matched against the talent voice registry; new synthetic timbres get a similarity check | Stops back-door cloning of talent; reduces tool-maker liability | Trust users' statements | PROPOSED |
| D19 | **Talent terms per trait:** preview free; promo only by opt-in, with caps; live use paid; export paid at a higher rate; commercial use off unless negotiated. Earnings split by the rights bill of materials. Revocation stops new uses, and booked events are honored | O12 and O13: fair pay plus a large free funnel | A single flat license per talent | PROPOSED (P13) |
| D20 | **Freemium:** free building, previews and limited Creator Studio; paid event licenses, recordings and premium talent; a Pro tier for bands, DJs, event companies and venues | O13: engage as many users as possible; event planning takes weeks to months | Paid-only | PROPOSED (P1) |
| D21 | **Watermark every generated output** and label it as an AI performance | EU AI Act Art. 50, in force since 2 Aug 2026 (R14); talent monitoring | No marking | PROPOSED |
| D22 | **Rules profile per event, enforced as hard filters** in the renderer (voice types, explicit lyrics, languages, song lists, volume caps, silent segments) | Religious and corporate events have firm rules; a UI preference isn't enough | Advisory settings only | PROPOSED |
| D23 | **Style packs and event templates are data, not code** | Any culture (O15) and any event (O16) without rewriting code; curators can add them | Code per culture or event | DECIDED |
| D24 | **Shared multi-speaker trait models** for all consented talent | DiffSinger mixes speakers only inside one jointly trained model (R5; an inference to test in PoC-2) | Blending separately trained models | DECIDED pending PoC-2 |
| D25 | **Source separation is a replaceable component** | Meta's Demucs repo was archived Jan 2025 (R1) | Hard dependency on Demucs | DECIDED |
| D26 | **Hosting:** web apps and APIs on Render (owner's preference; the free plan sleeps and loses its disk on restart); GPU work on a separate GPU provider | Render has no GPUs (R12) | Everything on Render | PROPOSED |
| D27 | **Default stack:** C++ with JUCE for the real-time engine, Python for AI, TypeScript for web apps and cloud services (C#/.NET instead if the team prefers) | Real-time audio can't risk garbage-collection pauses; JUCE is mature (AGPLv3 or commercial, R11); Python has the AI ecosystem; TypeScript suits installable web apps | Managed-language audio engine | PROPOSED (P16) |
| D28 | **Latency and quality targets** as in SPEC §9: note-offs ≤ 30 ms; cue ≤ 50 ms; chat ≤ 1.5 s; new library song ≤ 5 s; arrangement ≤ 2 s; vocal lead ≥ 8 s; 48 kHz / 24-bit; hot standby ≤ 2 s | Makes "natural" and "within seconds" testable (AT-1 to AT-13) | No numeric targets | PROPOSED |
| D29 | **Launch content: 5–10 instruments and 5–10 voice styles, deep rather than wide** | O8; depth matters more than breadth for quality | Broad and shallow | PROPOSED (A2) |
| D30 | **Build order:** four prototypes first (PoC-1 stop and switch, PoC-2 singing and personas, PoC-3 arranger, PoC-4 ingest), then the MVP | Prove the riskiest parts before building everything | Build all services at once | PROPOSED |
| D31 | **Path to "as close to perfect as possible":** lead with the engine, band and choir; musicians approve arrangements; optional live frontperson at large events; small events before large ones | FEASIBILITY.md: strongest parts first, humans where AI is weakest | Fully virtual at large events from day one | PROPOSED |

### 6.4 Superseded

| # | What | Superseded by |
|---|---|---|
| S1 | Scope: Jewish weddings only (spec v0.2–v0.3) | O15, O16 (msgs 5–6) |
| S2 | Working name "Kol Simcha", folder `kol-simcha/` (never committed) | G2 |
| S3 | Kol isha (no female voices) as a built-in default | Generalized into D22 (rules profiles) |

### 6.5 Spec version history

| Version | Date | Change |
|---|---|---|
| v0.2 | 2026-09-29 | First draft for Jewish weddings, with personas and the technique library (msgs 1–2). Never committed alone; its content is inside v0.3 |
| v0.3 | 2026-09-29 | Added the talent program, business model, Creator Studio and research findings (msgs 3–4). Archived: [history/SPEC_v0.3_jewish-weddings-example.md](history/SPEC_v0.3_jewish-weddings-example.md) |
| v0.4 | 2026-09-29 | Any culture, any event: style packs + event templates (msgs 5–6). Current: [SPEC.md](SPEC.md) |

## 7. What's built and where it runs

Nothing yet. No services, no URLs, no environment variables.

## 8. Verified vs. not

- Verified: the component and legal facts marked VERIFIED in RESEARCH_NOTES.
- Not verified: every latency target in SPEC section 9, singing quality, persona
  blending across talents, arrangement quality. All of them are PoC work (SPEC 12).
- Feasibility judgment per goal (not measured): [FEASIBILITY.md](FEASIBILITY.md).

## 9. Document map

| File | Holds |
|---|---|
| `PROJECT_CONTEXT.md` (this file) | Rules, environment, requirements, **all decisions with reasons**, status, next steps, how to resume |
| `SPEC.md` | The full product and system spec (v0.4) |
| `OPEN_ITEMS.md` | Questions P1–P18 with defaults and effects, assumptions A1–A6, to-dos |
| `FEASIBILITY.md` | How doable each goal is today, with the recommended path |
| `LEGAL_AND_RIGHTS.md` | Legal areas L1–L14, talent agreement outline, user terms |
| `handoff/` | Both handoff PDFs (original + text) and how they conflict |
| `history/CONVERSATION_LOG.md` | Every owner message, word for word |
| `history/ASSISTANT_REPLIES.md` | Every assistant reply, word for word |
| `history/RESEARCH_NOTES.md` | Checked facts R1–R17 with sources and status |
| `history/research/` | Raw fact-check report and the brief that produced it |
| `history/SPEC_v0.3_jewish-weddings-example.md` | Earlier spec, kept as a worked example |
| `../CLAUDE.md` | Rules for AI agents (copied from the handoff) |

## 10. How to resume in any new session

1. Open repo `mayerspitz/test`, branch `claude/blissful-babbage-dxjkkp`:
   `git fetch origin claude/blissful-babbage-dxjkkp && git checkout claude/blissful-babbage-dxjkkp`
   (If the session assigns a different branch, create it from this one, or ask the owner.)
2. Read, in order: `liveband/CLAUDE.md` → this file → `OPEN_ITEMS.md` → `SPEC.md`.
3. Run `git status` first; commit any half-finished edits as "WIP".
4. One-line prompt the owner can paste into a new session:
   > Continue the LiveBand project: repo mayerspitz/test, branch claude/blissful-babbage-dxjkkp, folder liveband/. Read liveband/CLAUDE.md and liveband/docs/PROJECT_CONTEXT.md first, then carry on from the next steps there.

## 11. Next steps

1. The owner answers P1–P18 (most have defaults).
2. Update the spec to v0.5 with the answers, and draft the first style pack(s) and
   event template(s) (T3).
3. PoC-1 (natural stop and switch) with tests, then PoC-2 to PoC-4.
