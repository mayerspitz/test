# Open items

Questions for the owner, and our own to-dos. Answer by number (e.g. "P1 b, P3 Latin
weddings in Mexico and the US, rest OK"). Any question left unanswered keeps its
default.

**Status key:** WAITING = no answer yet · ANSWERED = see where it's recorded.

## Questions for the owner

| # | Question | Default if you don't object | What your answer changes | Status |
|---|---|---|---|---|
| P1 | **Who are the customers, and who runs the music live at the event?** (a) event hosts themselves, (b) band companies, DJs and event companies, (c) venues and hotels, (d) all, as freemium + Pro | (d). For the MVP a trained operator runs the live console | How simple the live UI must be, support load, pricing | WAITING |
| P2 | **Are there ever human performers on stage?** (a) never: fully virtual, (b) a live singer with the AI band, (c) a live musician with AI filling in the rest, (d) all | (a) for the MVP; (b)/(c) later | Following a live performer's tempo and key is a large extra subsystem | WAITING |
| P3 | **Launch focus:** which 1–3 musical traditions, which 1–2 event types, which countries? | None: I can't pick this for you. Suggestion: where you already have talent and customers | Data, talent, tuning (12-tone vs microtonal), languages, and **which laws apply** | WAITING |
| P4 | **Is an on-site computer at each event acceptable?** (GPU laptop or mini-PC + audio interface + a standby) | Yes. Streaming from the cloud risks dead air if the venue's internet drops | The whole deployment model | WAITING |
| P5 | **Where does the sound go?** Stereo into the venue's speakers, or separate stems to a sound engineer's mixer? | Stereo as standard, 8–16 stems as a Pro option | Audio hardware; who does the final mix | WAITING |
| P6 | **Confirm the core design D1–D5** (SPEC 8.1): notes generated in seconds, sound rendered live, effects live (natural stops), vocals rendered a few seconds ahead, offline venue node, services as separate packages with no network hops in the audio path | Confirmed | Everything downstream | WAITING |
| P7 | **Launch talent:** which singers and musicians, how many, and do you already have relationships? | 5–10 voices + 5–10 instrumentalists, recorded in a studio | Recruiting, studio budget, what launches first | WAITING |
| P8 | **Children's voices** (kids' choirs, child soloists): in scope? | Not in the MVP | Guardian consent flows, legal risk | WAITING |
| P9 | **Songs:** what do you already have (MIDI files, stems, sheet music, sample libraries, recordings, keyboard styles)? And how should we source rights? | Start with public-domain songs, commissioned originals and licensed catalog. No extraction from commercial recordings until a lawyer approves | What the library holds on day one; whether `ingest` is internal-only or open to customers | WAITING |
| P10 | **Songs that aren't in the library, requested live** (by name, by humming, by uploading a recording): in scope? | MVP: library songs only, plus "hum a melody" in the Creator Studio before the event. Live on-the-spot ingestion later | A fast live ingestion pipeline | WAITING |
| P11 | **AI autonomy:** carry out commands and the program only, or also "read the room" with a microphone or camera? | Commands + program, plus keeping continuous sets flowing | Sensors, privacy, extra models | WAITING |
| P12 | **Persona marketplace:** can users share or sell the personas they build, and earn from them? | Sharing at launch; selling in Phase 3 | Marketplace, moderation, creator payouts | WAITING |
| P13 | **Talent money model:** revenue share split by the rights bill of materials, or a fixed price per trait per event? Who sets prices? What % goes to talent? What happens to booked events on revocation? | Revenue-share pool; talent sets a minimum per trait; talent controls free and promo caps; booked events are honored | Ledger design; the pitch to talent | WAITING |
| P14 | **Cloning a user's own voice** (e.g. a parent sings at their child's wedding): allowed, with identity and liveness checks? Or style reference only? | Style reference only in the MVP; own-voice cloning in Phase 3 | Biometric-data compliance; a verification vendor | WAITING |
| P15 | **Team, budget, and target date for the first real event?** Solo with AI agents, or a team (audio engineers, ML engineers, musicians)? | None: needed to size the MVP | MVP size; what we build vs. license | WAITING |
| P16 | **Tech stack preference?** (The repo's `main` has a C#/.NET project file, unrelated to this project.) | C++ (JUCE) for the real-time engine, Python for ML, TypeScript for web apps and cloud services (or C#/.NET if your team prefers it) | All code | WAITING |
| P17 | **Quality references:** 3–5 recordings or bands whose sound defines "right" for your launch style | None | Acceptance tests and curation targets | WAITING |
| P18 | **Housekeeping:** (a) the product name (working name "LiveBand"); (b) I followed "New Project Handoff" (folder `liveband/` in `mayerspitz/test`, on the assigned branch). The other PDF describes an orphan branch in `mayerspitz/tailored-travel-planning`. Confirm it doesn't apply | (a) LiveBand until renamed; (b) as done | Folder and repo names; trademark check | WAITING |

## Assumptions (correct any that are wrong)

| # | Assumption |
|---|---|
| A1 | "Kits" means drum and percussion kits, their groove patterns, and ensemble presets |
| A2 | "5 to 10 to start" means 5–10 instruments and 5–10 voice/singing styles at launch, deep rather than wide |
| A3 | "Violin pitches and squeezes" are playing techniques (slides, bends, pressure swells, sobs…). They live in the technique library, separate from digital effects |
| A4 | "Micro or app services libraries" means each part is an independent package with its own contract. Whether it runs as a network service or in-process is decided per D5 |
| A5 | Events are live and in person; online or streamed events come later |
| A6 | The Jewish-wedding draft (v0.3) stays in `docs/history/` as a worked example of a style pack + event template. Say if you want it removed |

## Our to-dos

| # | To-do | Status |
|---|---|---|
| T1 | Re-check the PARTLY rows in RESEARCH_NOTES when those sites are reachable | Open |
| T2 | Trademark check once the name is chosen (P18) | Blocked on P18 |
| T3 | Draft the first style pack(s) and event template(s) | Blocked on P3 |
| T4 | Write the PoC-1 plan (natural stop and switch) with a test harness | Blocked on P6 and P16 |
| T5 | Brief a lawyer using LEGAL_AND_RIGHTS.md | Blocked on P3 |
