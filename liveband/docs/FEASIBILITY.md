# Feasibility: how close to "perfect" can this get at large live events?

Assessment date: 2026-09-29. It is based on the research notes and general knowledge of
the field, and **nothing has been measured yet**. The four prototypes (SPEC 12) will
replace these judgments with numbers.

## Bottom line

- **Perfect at everything, in any culture, on day one: no.**
- **Excellent and reliable for a focused first scope: yes.**
- The part you care most about, **natural live behavior** (stops, switches, cues), is
  the most doable part.
- The hardest parts:
  - lead singing with rich ornaments;
  - mixing individual traits from different singers;
  - fully automatic song extraction;
  - the work that isn't software: content per culture, talent deals and song rights.

## Goal by goal

| # | Goal | Doable today? | Why | How we close the gap |
|---|---|---|---|---|
| 1 | Natural stop with tails; mid-song switches; vamps; cues | **Yes** | Already proven: arranger keyboards play intros, fills and endings on the fly; game-music engines switch music on bar boundaries; touring shows run backing tracks from redundant computers. This is engineering, not research | Build it well and test it hard (AT-1 to AT-4) |
| 2 | Never failing at a large event | **Yes, with professional practice** | An offline computer on site, a hot standby, failsafe tracks and rehearsals, as pro tours do. The risk is never zero (power, human error), but that's also true for a human band | Soak tests; rehearsal mode; standby handover |
| 3 | Full arrangement within seconds of a command | **Yes** for speed | Generating notes is fast, and live sound rendering is real-time | See row 4 for quality |
| 4 | Arrangements as good as a top band | **Partly** | Style-based accompaniment is mature (keyboard styles). A fully AI arrangement of any song, in any style, at top level is not reliable today | Library songs are arranged ahead of time by AI with a musician's approval. AI handles live variations, transitions and medleys, so **everything that plays has passed a musician's ear** |
| 5 | Instrument sound | **Yes** for a full band or orchestra at event volume. **Partly** for exposed expressive solos | Good samples in a dense mix are very convincing. A solo violin, sax, oud or ney in a quiet moment is where samples still sound artificial | Modeled instruments for solos; our own recordings (commercial sample licenses often forbid embedding them in another product) |
| 6 | Choir | **Mostly yes** | Ensemble blend hides small artifacts | Stack multiple synthesized voices with natural variation |
| 7 | Lead singing in a real singer's voice (with consent) | **Mostly yes** for pop-style singing with hours of studio data. **Partly** for heavily ornamented styles (sobs, maqam, gamaka) and for languages with little data | The lead vocal is what the audience listens to most, so it's the highest bar in the product | Studio sessions per talent; an ornament library curated per style; PoC-2 measures it |
| 8 | Personas: A's voice + B's vibrato + C's sob | **Partly** | Mixing voice color and overall style between singers exists today. Picking individual ornaments from specific singers as clean building blocks is research-grade, and some combinations will sound unnatural | Model ornaments as explicit pitch and energy shapes; compatibility checks; previews; PoC-2 decides how fine-grained we can go |
| 9 | Creator Studio (hum it, describe it, refine it) | **Mostly yes** | Pitch from humming is mature, and AI turns descriptions into settings easily. Inventing a brand-new *singing* voice from scratch is less mature than for speech | Start from blends of consenting talent's voices |
| 10 | Extract songs from recordings into full arrangements | **Not fully** | Vocals, drums and bass separate well; melody and chords transcribe decently. Every band part from a dense mix is unreliable | A human correction step: a production tool, not a one-click button. PoC-4 measures the minutes per song |
| 11 | Any culture | **Yes for the architecture; slow for the content** | The software handles any tuning, rhythm or language. Each tradition still needs musicians, recordings, talent and curated songs | Grow one style pack at a time, with musicians from that tradition |
| 12 | Chat control by the event admins | **Yes** | AI understands commands in about a second | Big buttons for split-second moments |
| 13 | Stage presence at large events | **Not a technology problem, and a real gap** | Big events expect people on stage who read the crowd, hype it and react. Today's AI can't replace that | Optional live frontperson (singer, MC or DJ) with the AI as the band behind them; stage visuals |
| 14 | Talent opting in for royalties | **Yes technically; adoption uncertain** | Consent and royalty ledgers are standard software. Some artists already license AI versions of their voices for a royalty share (from memory, not re-checked). Top stars may be blocked by label contracts | Start with rising and mid-tier talent in the launch culture; a fair, transparent split |
| 15 | Legal certainty | **Partly** | Voice consent can be handled with contracts. The law on song rights for AI arrangements and on extracting from recordings is still unsettled in several countries | A lawyer per launch country; a public-domain and commissioned catalog first |

## Where the effort really goes

With AI coding agents, the software (live engine, services, apps) is the faster part.
The slow parts are:

1. **Recordings and data:** talent studio sessions, instrument samples, curated songs.
2. **Musicians' ears:** judging and approving arrangements and traits for each culture.
3. **Training the singing and trait models:** GPU time plus iteration.
4. **Talent deals and legal work.**
5. **Field testing at real events**, small ones before large ones.

## Rough effort (orders of magnitude; depends on P15)

| Stage | Rough size | What it tells us |
|---|---|---|
| Prototypes PoC-1 to PoC-4 | About 2–4 months | How good the singing, blending and extraction really are, measured |
| MVP: one culture, 1–2 event types, AI band + choir, a few licensed voices, operator console | Roughly a year or more, with a small specialist team (audio engine, singing AI, backend/web, 1–2 producers/arrangers, part-time legal) | Whether real events accept it |
| Broad multi-culture product | Multi-year, growing one pack at a time | — |

## Recommended path to "as close to perfect as possible"

1. **Lead with the strengths:** the live engine, backing band and choir, where AI is
   already close to professional.
2. **Keep humans where AI is weakest at first:** musician-approved arrangements, and
   optionally a live frontperson at large events.
3. **Prove the risky parts before building everything:** singing and blending (PoC-2)
   decide how far the persona feature can go at launch.
4. **Small events first, then large ones,** always with a failsafe.
