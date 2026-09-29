# LiveBand: Product and System Specification

**Version:** 0.4 draft, 2026-09-29
**Status:** DRAFT. Waiting on the answers to P1–P18 in [OPEN_ITEMS.md](OPEN_ITEMS.md).
Anything marked **[proposed]** is a recommendation, not yet a decision.
"LiveBand" is a working name (P18).
Legal map: [LEGAL_AND_RIGHTS.md](LEGAL_AND_RIGHTS.md). Sources: [history/RESEARCH_NOTES.md](history/RESEARCH_NOTES.md).

> **Scope change (2026-09-29):** v0.3 targeted Jewish weddings. The owner widened it
> to **any musical culture and any kind of event**. v0.3 is kept as a worked example of
> one style pack plus one event template:
> [history/SPEC_v0.3_jewish-weddings-example.md](history/SPEC_v0.3_jewish-weddings-example.md).

---

## 1. Vision

LiveBand is an AI band, orchestra and choir for live events, in any musical culture. It
replaces live musicians and singers, or plays alongside them (P2). It knows each
tradition's tuning and scales, rhythms, instruments and playing techniques, vocal
styles and ornaments, languages and accents, and repertoire.

It reacts to live commands the way a great bandleader does:
- it stops with a natural ring-out;
- it switches songs mid-phrase through a real musical bridge;
- it vamps until the bride reaches the front or the award winner reaches the stage;
- it hits the fanfare on the exact beat of a cue.

Users design their **dream band**. For each voice or instrument they pick traits from
many singers and musicians: one singer's voice color, another's vibrato, a third's runs,
one violinist's tone, another's slides. The system combines these into **personas**,
and combines the personas into a **master model** (the ensemble) for the event. Users
can also design personas **from scratch** in the **Creator Studio**. They describe what
they want, pick pitches and techniques, and sing or hum examples, then refine until it
sounds right.

Real people's voices and styles are used only with their signed consent, and
**talent earns money every time their traits are used**.

## 2. Glossary

| Term | Meaning here |
|---|---|
| Style pack | All the knowledge for one musical tradition, stored as data (section 5) |
| Event template | A reusable program of segments and cues for one kind of event (section 4) |
| Segment | One part of an event program, e.g. "processional", "dinner", "awards walk-ups" |
| Cue | A moment the music must hit exactly, armed in advance and fired by a button |
| Tuning profile | The exact pitch of each scale step, in cents. Needed for maqam, raga, gamelan and similar traditions |
| Technique / articulation | How a note is played or sung: slide, vibrato, bend, pizzicato, trill, falsetto flip, and so on |
| Trait | One separable quality of a voice or player: timbre, vibrato, ornament set, phrasing, accent… |
| Persona | A virtual singer or player assembled from traits (section 7) |
| Master model | The full virtual ensemble for one event: personas + choir + arrangement style + mix style |
| Rights bill of materials | The list of every person whose traits a persona uses, with consent and share |
| Arrangement | Every part, note, technique, effect and mix move for one version of a song |
| Stem | Audio of one part or group (drums, bass, horns, lead vocal, choir…) |
| Tail | Sound that continues after a note or the music stops (release, reverb, delay) |
| Vamp | Repeat a passage until a cue arrives |
| Boundary / bridge | Where a switch happens (next beat, bar or phrase), and the music that connects the two songs |
| Venue node | The on-site computer that runs the live engine |
| SVS | Singing voice synthesis |
| MPE / MIDI 2.0 | MIDI standards with per-note pitch, used to carry microtones |

## 3. Users and roles

| Role | Who | What they do |
|---|---|---|
| Event host / admin | Couple, family, planner, corporate organizer, MC | Plan the program. Build personas and the master model. Give live commands by chat and quick buttons, within their permissions |
| Operator | On-site tech or "virtual bandleader" (P1) | Runs the live console. Has final say over admins. Handles failsafes |
| Organization | Band companies, DJs, event companies, venues, hotels, cruise lines | Run many events. Manage staff, hardware and billing |
| Producer / curator | Our musicians and arrangers | Build style packs. Ingest and correct songs. Approve arrangements, samples and trait models |
| Talent | Singers and instrumentalists | Opt in. Record source material. Set prices and free or promo allowances per trait. Approve each trait and use. See earnings. Revoke consent |
| Creator | Any user who builds personas or arrangements | Builds in the Creator Studio. May publish to the marketplace (P12) |
| Guest (later) | Event guests | Optional song requests by QR code, moderated by admins |
| Platform admin | Us | Operations, moderation, rights disputes |

## 4. Events: templates, segments and cues

Every event is a **program** of segments. Each segment has a musical character, rules
and cues. Templates are data. Hosts edit them, and style packs can add segments (for
example, a culture's own wedding customs). The whole planned program is
**pre-generated before the event** (D9), so most live commands hit a warm cache.

| Event type (examples) | Typical segments | Special live needs |
|---|---|---|
| Wedding (any culture) | Arrival, processional, ceremony, recessional, entrance, first dance, dance sets, dinner, cake, last dance; plus each culture's own customs | **Vamp until the person reaches the front, then end at the next cadence.** Hit the exact moment (vows, kiss, ring, breaking a glass…) |
| Birthday, anniversary, coming of age (quinceañera, sweet 16, bar/bat mitzvah…) | Entrance, toasts, special dances, candles and cake, dance sets | A song per honoree, cue-driven |
| Corporate gala, awards, conference | Walk-in, background, stage stings, **walk-up music per winner**, dinner, party | Many armed cues fired quickly; strict timing; brand-safe lyrics only |
| Party, club, festival | Continuous sets | Energy arc, auto-continue, requests |
| Restaurant, hotel, retail | Long background | Low volume, no repeats, moods by time of day |
| Religious or traditional ceremony | Tradition-specific | Rules profile: allowed instruments, voices, texts, silences |
| Sports and arena | Anthems, stingers, crowd songs | Instant cues |
| Concert, show, theater | Set list, possibly with a live performer (P2) | Follow the performer |

Every template has at least one **armed cue** type: the song is ready, the button fires
it on the next beat.

## 5. Culture and style packs

**Nothing culture-specific is hard-coded.** Each tradition is a **style pack**, which is
data plus trained models, built and approved by curators. A pack contains:

- tuning system and scales or modes
- harmony rules
- rhythms, meters and micro-timing feel
- song forms
- instruments with their technique libraries
- typical ensembles
- vocal traditions and ornaments
- languages and pronunciation traditions
- repertoire
- event customs (segments and cues it adds to templates)
- rules defaults
- mix character

The core must handle the full range shown below. The table only shows what the engine
must be able to represent. It is **not a launch list** (launch is P3). Each pack must be
checked with musicians from that tradition.

| Tradition (examples) | Tuning and scales | Rhythm | Signature instruments | Vocal traits |
|---|---|---|---|---|
| Western pop, rock, R&B, country | 12-tone equal | 4/4, backbeat, shuffle | Drums, bass, guitars, keys | Belting, runs, falsetto |
| Jazz, swing, big band | 12-tone, extended harmony | Swing feel | Horns, rhythm section | Scat, behind-the-beat phrasing |
| Classical, string quartet, choral | 12-tone (or historical temperaments) | Rubato | Strings, piano, organ | Choral blend |
| Gospel | 12-tone | Shout, 12/8 | Hammond organ, choir | Runs, call and response |
| Latin (salsa, merengue, bachata, cumbia, mariachi, reggaeton) | 12-tone | Clave-based, dembow | Congas, timbales, güira, trumpets, vihuela | Soneo (improvised calls) |
| Brazilian (samba, bossa nova, forró, sertanejo) | 12-tone | Samba, baião | Pandeiro, surdo, cavaquinho, accordion | |
| Arabic (Egyptian, Levantine, Gulf, Maghrebi) | Maqam, with quarter tones and regional intonation | Maqsum, baladi, masmoudi, 6/8 | Oud, qanun, ney, darbuka, riq, violin | Melisma, mawwal |
| Turkish | Makam (53-comma theory) | Aksak meters (9/8…) | Bağlama, kanun, clarinet, darbuka | |
| Persian | Dastgah (koron/sori microtones) | 6/8 | Tar, santur, kamancheh, tombak, daf | Tahrir |
| Indian (Hindustani, Carnatic, film, Bhangra) | Raga, with shruti inflections, gamaka (ornamented pitch) and drone | Tala cycles (16, 7, 10…), bhangra | Sitar, tabla, harmonium, dhol, bansuri, shehnai | Meend, gamak, taan |
| African (Afrobeats, highlife, soukous, amapiano…) | 12-tone and local systems | Polyrhythm, 12/8 bell patterns | Talking drum, djembe, guitars, log drum | Call and response |
| Caribbean (reggae, soca, dancehall, kompa) | 12-tone | One drop, soca | Steel pan, bass | |
| Balkan, Greek, Klezmer, Romani | Modal, some microtones | 7/8, 9/8, 11/8 | Brass band, clarinet, accordion, bouzouki | Heavy ornamentation |
| Celtic (Irish, Scottish) | Modal; bagpipe tunings | Jig 6/8, reel 4/4 | Fiddle, pipes, whistle, bodhrán | Sean-nós ornaments |
| East Asian (Chinese, Japanese, Korean) | Pentatonic and traditional scales | Varied | Erhu, guzheng, pipa, shamisen, koto, gayageum | |
| Southeast Asian (gamelan) | **Slendro and pelog: not 12-tone; each set is tuned uniquely** | Colotomic cycles | Metallophones, gongs, kendang | |
| Electronic, EDM, DJ culture | 12-tone | Four on the floor | Synths, drum machines | Processed vocals |

**Consequences for the core engine**

- **Pitch is stored in cents, not only as MIDI note numbers** (D6). Every pack, and
  where needed every ensemble (gamelan), has a tuning profile.
- **Ornamented pitch is first-class.** Slides, gamaka, meend, maqam inflections, bends
  and vibrato are stored as expression curves on each note, not faked with extra notes.
- **Rhythm handles every meter system:** additive meters (7/8, 9/8), long cycles (tala,
  colotomic), clave, and per-style micro-timing (swing, push, drag).
- **Lyrics are stored in their original script**, with the extra markings needed to
  pronounce them. Pronunciation comes from rules per language and dialect. **Any voice
  can sing any language** (cross-lingual singing), and accent is a separate trait.

## 6. Live behavior: "play like a real band"

This is the heart of the product. Every command maps to a musically correct action,
never an audio cut.

### 6.1 Command vocabulary

Chat, voice and buttons all become these structured commands. An AI model understands
free text in any supported language, or a mix, and matches song names across spellings
and scripts.

| Command | Parameters |
|---|---|
| `PLAY` / `QUEUE` | song, section, key, tempo, style, persona or master model, at-boundary |
| `SWITCH` | target song or section, at-boundary, transition type (optional) |
| `STOP` | mode (6.2) |
| `FADE` | seconds |
| `PAUSE` / `RESUME` | resume at: same bar, phrase start or section start |
| `VAMP` / `HOLD` | loop the current bar, phrase or section until `RELEASE` |
| `END` | at cadence, end of phrase, end of section, or a "button" ending |
| `TEMPO` | ±bpm or ±%, ramp length |
| `KEY` | ±semitones or a target key; modulation style |
| `ENERGY` | up or down (density, drums, horns, choir, tempo within limits) |
| `LAYER` | mute, solo or bring in: drums, choir, horns, strings, lead vocal… |
| `MODE` | voices only (a cappella) / instrumental only / full band |
| `STYLE` / `PERSONA` | switch style pack or swap a persona at the next boundary |
| `VOLUME` | master or per layer, capped by event limits |
| `CUE` | arm or fire a pre-built cue |
| `PROGRAM` | next segment, go to segment, skip, repeat |
| `SFX` | fire a musical effect (riser, drum roll, impact, fanfare) |
| `UNDO` | revert the last change, if it hasn't played yet |

### 6.2 Stop and end modes

| Mode | What you hear |
|---|---|
| **Stop now** | No new notes. Held notes get note-offs and release naturally: the piano's sustain pedal lifts, cymbals keep ringing, and the current sung syllable ends with a short natural release. Reverb and delay keep processing, so **the room hears the natural decay**. No clicks, no cut. |
| Stop on beat | The same, on the next beat |
| Button ending | One final accented chord on the next downbeat, then as above |
| End at cadence | Finish at the next natural phrase end, with a proper final chord |
| Fermata / freeze | Hold the current chord; release on command |
| Fade | Smooth fade over N seconds, then as above |

### 6.3 Switching and transitions

When a switch command arrives, the **player** (conductor) knows the current song,
section, bar, beat, tempo, key, groove and energy, and the target's. It picks a
**boundary** and asks the **transitions** service for a **bridge**:

- **Boundaries:** now (next beat), next bar, next phrase (usually 4 or 8 bars), end of
  section, end of song. **[proposed]** The default is the next phrase; "now" is always
  available.
- **Bridges:** a direct hit on the downbeat, a drum fill, a pickup, a pivot-chord or
  direct modulation (including the half-step lift common in dance sets), a tempo ramp, a
  break (drums drop out, voices pick up), or a crossfade (last resort only). Bridges can
  cross style packs too, for example from a samba groove into a pop ballad.
- **The bridge buys time.** If the target song was never generated, the band vamps or
  plays fills on the current groove while it generates. It never goes silent and never
  waits.

### 6.4 Segments, loops and vamps

"Play only the chorus of X", "Repeat the second part", "Loop this until I say", "Play
the melody from the entrance". Every song is stored with sections, phrase ends and
**safe transition points**, so any segment can be entered or left musically.

### 6.5 Autonomy

**[proposed]** By default the AI carries out commands and the planned program, and
keeps continuous sets flowing by picking the next song within the admins' lists. A
"read the room" mode that senses crowd energy through a microphone or camera is optional
(P11).

## 7. Personas and the master model

### 7.1 Hierarchy

```
Trait          one separable quality (e.g. "Singer B's vibrato", "Violinist D's slides")
  └ Persona    one virtual singer or player = base sound + chosen traits (with weights)
      └ Master model   the ensemble for an event = personas for every part
                       + choir + arrangement style + mix style
          └ Event profile   master model + style pack(s) + rules + program
```

### 7.2 Voice traits (each one selectable and previewable)

| Trait type | Examples |
|---|---|
| Timbre (voice color, identity) | Singer A's voice; a blend of consenting singers (7.6) |
| Range and tessitura | Comfortable range, strain point, falsetto range |
| Vibrato | Rate, depth, onset delay, shape; straight-tone habits |
| Ornaments | Runs and melisma, trills, turns, scoops, falls, sobs, yodel flips, gamaka, maqam ornaments, grace notes |
| Register behavior | Falsetto flips, belting, head/chest mix |
| Color effects | Breathiness, rasp, growl, vocal fry, nasality |
| Phrasing and timing | Rubato, behind or ahead of the beat, breath placement |
| Dynamics and emotion | Intensity arcs, tenderness vs. power |
| Language and accent | Any language and dialect the pronunciation rules support, independent of the voice |

### 7.3 Instrument traits

| Trait type | Examples |
|---|---|
| Sound source | A sampled instrument (a specific violin), a modeled or synth sound, or an imported sample set |
| Techniques | Which techniques from 7.4 this player uses, and how often |
| Ornament style | Density and choice of trills, slides, bends, grace notes, microtonal inflections |
| Timing feel | Swing, push or pull, rubato |
| Tone | Instrument-level tone (bow pressure, pick attack, mute type, amp or mic character) |

### 7.4 Technique library (the "violin pitches and squeezes")

Every instrument gets a growing catalog of named techniques with audio examples, stored
as recorded samples, modeled behavior, or both. These are playing techniques, not
digital effects like reverb or delay. Examples:

| Instrument | Techniques |
|---|---|
| Violin / fiddle | Legato, portamento and glissando (slides), vibrato types, trills, mordents, turns, grace notes, pizzicato, spiccato, staccato, tremolo, harmonics, double stops, sul ponticello, sul tasto, accents, "squeezes" and sobs (pressure swells and catches in the tone), microtonal bends |
| Guitar | Bends, slides, hammer-ons, pull-offs, palm mute, harmonics, tremolo picking, strums, rasgueado |
| Piano / keys | Pedaling, voicings, glissando, rolls, organ drawbar and Leslie moves |
| Trumpet / trombone | Shakes, falls, doits, rips, growls, mutes, flutter-tongue |
| Sax / clarinet | Subtone, growl, bends, altissimo, glissando, flutter-tongue, sobs |
| Oud, sitar, erhu, qanun | Tremolo, meend and slides, microtonal inflection, sympathetic strings, qanun lever changes |
| Drums and hand percussion | Rolls, ghost notes, flams, rimshots; tabla bols; darbuka doum/tek/ka; djembe tones and slaps |
| Bagpipes, whistles | Grace-note cuts, taps, rolls, birls |
| Voice | Everything in 7.2 |

Curators name, record and tag the techniques. The catalog grows with each style pack and
is never hard-coded.

### 7.5 Rules for personas **[proposed]**

1. **Rights bill of materials.** Every persona and master model lists every contributing
   person, which trait of theirs is used, their consent reference and their royalty
   share. Rendering is refused if any consent is missing, expired, revoked or out of
   scope.
2. **Timbre always needs consent**, whatever its weight in a blend. A persona that is 95%
   one singer's timbre *is* that singer.
3. **Named style traits need consent too** ("Singer B's runs"). Generic style archetypes
   with no named source ("gospel runs, heavy") need none.
4. **Compatibility checks with previews.** For example, the system warns when a persona
   is pushed outside its timbre owner's natural range and would sound artificial.
5. **No back-door cloning.** Every uploaded or recorded voice is checked against the
   registry of talent voices. A match to anyone other than the uploader is blocked. Any
   new synthetic timbre must pass a similarity check against every registered voice.
6. **A user's own voice is a style reference by default.** From a user's recording the
   system takes pitch, timing, ornaments and dynamics, not timbre. Cloning a user's own
   timbre is a separate opt-in with identity and liveness checks, because voiceprints
   are biometric data in some jurisdictions (P14).
7. Personas are saved per account. Sharing or selling them is P12.

### 7.6 Technical consequence: shared trait models

Checked in DiffSinger, a leading open-source singing synthesizer. The timbre model
(acoustic) and the expression model (variance: pitch curve, timing, energy,
breathiness, tension) are **separate models**. Speakers can be mixed, but **only inside
one jointly trained multi-speaker model**. So:

- All consented talent is trained into **shared multi-speaker trait models** for timbre
  and expression, so traits from different people can be combined. Adding a new talent
  means fine-tuning those shared models: a pipeline job, not a runtime job.
- Singing is rendered ahead of time, not streamed live (DiffSinger makes no real-time
  claim). That matches D3.
- Commercial tools already blend voices (ACE Studio's "Voice Blending"; Synthesizer V
  sets pitch, timbre and pronunciation modes separately within one voice). That shows
  the idea is viable. It is not a choice of components.

### 7.7 Creator Studio: build from scratch

For users who want something no existing talent offers. The studio turns *intent* into
a persona, an instrument part or an arrangement, then iterates until the user is happy.

**Inputs (any mix):**

| Input | Example |
|---|---|
| Text prompt | "Warm soul tenor, soft cry on long notes, little vibrato, bright top" |
| Pickers and sliders | Range, vibrato rate and depth, ornament density, breathiness, accent, techniques |
| **Sing or hum it** | The user records "like this": a phrase, a cry, a slide, a run. The system extracts pitch curve, timing, ornaments and dynamics as the target |
| Reference audio | "The violin slide at 1:12 of this recording": used for **style only**, never to copy an identifiable voice |
| Existing traits | Start from a talent persona and push it somewhere new |

**Loop:**

1. The studio generates 2–4 candidates.
2. The user listens and compares them (A/B).
3. The user tweaks by chat ("more cry, less vibrato"), with sliders, or by singing it
   again.
4. The studio refines, and the loop repeats.

Every version is kept and can be restored. When the user locks a version, it is saved
as a persona, instrument persona or arrangement part, with its rights bill of materials.

**The same flow works for instruments** ("a violin that slides into notes like this")
**and for music** (hum an intro or melody, and the arranger orchestrates it in the chosen
style).

**Limit:** "from scratch" still needs a base timbre. It comes from a consented blend pool
(no one person dominant, similarity-checked) or from voice-design models trained only on
consented data. Quality depends on PoC-2.

## 8. Architecture

### 8.1 Core design decisions **[proposed]**

- **D1 Notes first, sound live.** The arranger generates the *notes*: a complete
  multitrack arrangement with every note, technique, effect and mix move, in about 2
  seconds. The venue engine turns notes into sound **live**. Your idea of "every key
  rendered with its effects" is what a sampler does, so the engine is a sampler and synth
  host with live effects.
- **D2 Effects run live, after the instruments.** That gives the natural stop for free:
  stop sending notes, and reverb, delay, releases and ringing cymbals decay naturally.
- **D3 Vocals are rendered a few seconds ahead.** Neural singing is not instant. Vocals
  are rendered phrase by phrase ahead of the playhead, then pass through the same live
  effects. A stop is a natural release of the current syllable plus the live reverb tail.
- **D4 The whole event runs offline on a venue node.** The cloud is for preparation:
  library, ingestion, training and planning. The event runs on an on-site computer with a
  GPU, with a hot standby (P4).
- **D5 Separate services, no network hops in the audio path.** Every service is its own
  package with its own contract, tests and version. Services that aren't real-time run
  as network services. The real-time ones (player, renderer, effects, instrument and kit
  runtimes) are libraries linked into one venue-engine process (P6).

**Rejected alternatives**

- **End-to-end audio generation** (text-to-song models that output mixed audio): no
  per-note control, no natural mid-phrase switching, weak stems, and training-data
  rights problems (the major labels sued Suno and Udio in 2024).
- **Pre-rendered WAV stems per song:** a stop cuts the tails unless they are modeled
  separately, switches need crossfades, and live key or tempo changes degrade the audio.

### 8.2 Service map

| # | Service | Owns | Plane |
|---|---|---|---|
| 1 | `theory` (scales and notes) | Scales, modes, maqam/raga/dastgah/makam/gamelan tunings, tuning profiles in cents, chord and harmony rules, key and tempo math, meter systems | Library, used everywhere |
| 2 | `styles` | Style packs: validation, versions, curator approval | Cloud + local mirror |
| 3 | `library` (songs library) | Catalog: titles in every script and spelling, composer, tradition, event and segment fit, language, rights status, search | Cloud + local mirror |
| 4 | `songs` (scores) | Canonical song data: melody, harmony, form, sections, safe transition points, lyrics in original script, versions | Cloud + local mirror |
| 5 | `ingest` (extraction) | Audio, MIDI, MusicXML, sheet music or keyboard styles → stems → transcription → human correction → canonical score and arrangement | Cloud (offline) |
| 6 | `midi` | MIDI 1.0/2.0, MPE, SMF import/export, MusicXML bridge, live MIDI devices (controllers, pedals, keyboards) | Library + venue |
| 7 | `instruments` | Instrument definitions, technique catalog (7.4), sample and synth assets, **sample import from any common format** (automatic pitch, velocity and loop mapping), performer-style models | Cloud build + venue runtime |
| 8 | `kits` | Drum and percussion kits, groove and pattern libraries per style, ensemble presets | Cloud build + venue runtime |
| 9 | `personas` | Traits, personas, master models, rights bill of materials, compatibility and similarity checks, previews; trains talent into the shared trait models (7.6) | Cloud + local mirror |
| 10 | `arranger` | Full arrangements from score + style pack + master model + context. Medleys, intros, endings, fills. Humanized performance | Venue GPU (+ cloud pre-generation) |
| 11 | `transitions` | Bridges between any two musical states, across style packs too (6.3) | Venue |
| 12 | `singing` | Solo and choir voice synthesis from personas; pronunciation per language and dialect; ornaments; renders ahead of the playhead | Venue GPU (+ cloud) |
| 13 | `rights` | Consent records, scopes, expiry, revocation, audit log, audio watermarking; song and sample licenses | Cloud + signed local cache |
| 14 | `effects` | Effect chains and live DSP (reverb, delay, EQ, dynamics, modulation, vocal effects), musical sound effects, room compensation, volume limiter | Venue real-time |
| 15 | `renderer` | Real-time audio engine: note events → samplers and synths → effects → stems | Venue real-time |
| 16 | `player` (conductor) | Transport, timeline, cue queue, boundaries, vamps, stop and end modes, failsafes, output routing | Venue real-time |
| 17 | `live-chat` | AI chat and command service, quick buttons, permissions, conflict rules, command log | Cloud relay + local |
| 18 | `events` | Events, event templates, programs, rules profiles, preferences, song lists | Cloud + local mirror |
| 19 | `creator-studio` | Prompt + pickers + sung reference → candidates → refine loop (7.7); version history | Cloud GPU |
| 20 | `marketplace` | Talent profiles, per-trait terms and prices, promo programs, royalty ledger, payouts, published personas (P12) | Cloud |
| 21 | `accounts` | Identity, organizations, roles, billing | Cloud |
| 22 | `studio` | Web editor for producers: piano roll, score, arrangement review and approval, trait and technique tagging | Cloud (UI) |
| 23 | `venue-node` | Packages the real-time services; sync agent; local web console; standby handover | Venue |

Assumption: "kits" means drum and percussion kits, their grooves, and ensemble presets.
Correct me if you meant something else.

### 8.3 Canonical data formats

| Format | Contents |
|---|---|
| **Score** | Sections, phrase ends, safe transition points, melody (pitch in cents, timing, lyric syllables), harmony (chords + functions), meter and tempo map (including additive meters and cycles), key/mode + tuning profile, lyrics in original script |
| **Arrangement** | References a Score and version. Parts (role, persona, range) and every note (pitch in cents, start, length, velocity, technique, expression curves), plus automation, effect chains per bus and the mix |
| **Performance stream** | Time-stamped events from player to renderer: notes, techniques, expression, effect changes, vocal clip triggers, transport |
| **Style pack** | Tuning, scales, rhythms, forms, ensembles, technique and ornament vocabulary, pronunciation rules, repertoire links, event customs, rules defaults, mix character |
| **Trait / Persona / Master model** | Trait references, weights, constraints, rights bill of materials, preview audio |
| **Instrument / Kit package** | Samples or synth parameters, technique map, range, performer-style defaults, license reference |
| **Voice package** | Model files (encrypted), phoneme sets, supported languages and dialects, consent reference, watermark key |
| **Interchange** | MIDI 1.0 SMF, MIDI 2.0 / MPE (microtones), MusicXML, Scala tuning files, WAV/FLAC stems (48 kHz / 24-bit) |

### 8.4 Command-to-sound timeline (example)

```
t = 0.00 s   Admin taps "Switch → [song], chorus"
t + 0.05 s   Command reaches the player on the venue node (local)
t + 0.10 s   Player picks a boundary (e.g. the end of bar 37, at t + 1.6 s) and asks for a bridge
t + 0.30 s   Target arrangement: cache hit, or generated in ≤ 2 s (the bridge covers the gap)
t + 1.60 s   Bridge starts: fill + pickup, modulation if needed; new vocals render ahead
t + 3.60 s   New song's downbeat
```

### 8.5 Deployment

- **Cloud:** styles, library, songs, ingest, personas, rights, events, creator studio,
  marketplace, accounts, studio, the live-chat relay, and pre-generation. The web apps
  are mobile-first and installable. **Render (the host this user likes) has no GPU
  instances**, so the GPU work (training, Creator Studio, pre-generation) needs a GPU
  provider. Render can still host the web apps and APIs.
- **Venue node [proposed]:** a laptop or mini-PC with a GPU and a pro audio interface.
  It runs the real-time engine, local generation, a local cache of everything the event
  needs, and a local web console. A **hot standby** takes over within about 2 s: a second
  node, or at minimum a tablet with a pre-rendered backup of the program.
- **Control paths:** admin phones reach the cloud relay over cellular data. A backup
  local Wi-Fi hotspot from the venue node works without internet. The operator console
  is always local.

### 8.6 Failsafes

- **There is never dead air.** If generation is late, the band vamps. If nothing is
  ready, a pre-rendered safe track plays.
- The real-time audio path is isolated: no network, no disk waits, no memory allocation.
  A watchdog restarts other parts without stopping the music.
- Every command, render and persona use is logged, for royalties and debugging.

## 9. Non-functional targets **[proposed]**

| Metric | Target |
|---|---|
| Stop (any mode) | Note-offs within 30 ms; tails ring naturally; zero clicks |
| Armed cue fire | ≤ 50 ms, or on the next beat if quantized |
| Chat command understood | ≤ 1.5 s; a local fallback grammar handles basic commands offline |
| Switch to a pre-generated song | Bridge starts at the chosen boundary; new song within 1 bar of it |
| Switch to a never-generated library song | ≤ 5 s to the new downbeat; the bridge covers generation |
| Full symbolic arrangement of a 4-minute song | ≤ 2 s on venue hardware |
| Vocal render lead | Always ≥ 8 s ahead of the playhead |
| Audio | 48 kHz / 24-bit out, 32-bit float inside; stereo + up to 16 stems (P5) |
| Reliability | Whole event with no dropout; 8-hour soak test clean; hot standby ≤ 2 s |
| Offline | A full event runs with the internet unplugged |
| Launch content | 5–10 instruments and 5–10 voice/singing styles, deep rather than wide; the architecture takes any number |

## 10. Talent program and business model **[proposed]**

**Goal:** as many engaged users and talent as possible (the standard AI-era freemium
model), with talent paid fairly every time their work is used.

### 10.1 Talent

- **Opt-in only.** Talent signs a license (never a transfer of ownership), records
  source material, and approves each extracted trait before it goes live.
- **Talent controls each trait's terms:**

| Use type | Default | Talent can set |
|---|---|---|
| Preview in the builder (watermarked, short) | Free | Turn off |
| Promotional / free programs | Off until the talent opts in | Caps: N free events a month, free tier only, specific campaigns |
| Live event use | Paid | Price or share, minimum price, allowed event types, regions, song types, blending allowed |
| Recording or export (e.g. a take-home track) | Paid, higher | Allowed or not, price |
| Commercial use outside events | Off | Negotiated separately |

- **Earnings follow the rights bill of materials.** Each paid use creates a royalty line
  for every contributing talent, weighted by their share of the persona. Talent sees
  live usage, earnings and followers in a dashboard. Payouts go through a payments
  provider with identity checks and tax forms.
- **Revocation** stops new uses at once. Events already booked are honored or refunded,
  per the talent agreement (P13).

### 10.2 Users (engagement engine)

- **Free:** browse talent, build personas and master models, unlimited watermarked
  previews, promo-pool traits, Creator Studio within limits. Event planning takes weeks
  to months, which gives a long engagement window.
- **Paid:** live event license, hardware or venue-node rental, take-home recording,
  premium talent, more Creator Studio generations.
- **Pro:** band companies, DJs, event companies and venues running many events, with
  operator tools and multiple venue nodes (P1).
- **Growth loops:** talent promotes their own profile ("book my voice for your event"),
  users share personas and event previews, creators publish personas and earn (P12),
  and referrals.

### 10.3 Money flow (example; percentages to be decided, P13)

```
Event price ──► platform fee
            ├─► song rights (performance licenses, where due)
            ├─► talent pool ──► split by each persona's rights bill of materials
            └─► creator share (if a published persona was used, P12)
```

## 11. Rights, consent and event rules

- **Voices and traits:** signed consent per person, per trait and per use scope (event
  types, regions, dates, song types, blending allowed or not). Revocable, with royalty
  terms. Every output is watermarked. Minors' voices need a guardian's consent and a
  time-limited license (P8).
- **Songs:** most popular songs belong to living rights holders. Three things need a
  plan (P9): performance licensing, arrangement rights (arrangements are derivative
  works), and using commercial recordings as material for extraction. **We need a
  lawyer; this spec is not legal advice.** See [LEGAL_AND_RIGHTS.md](LEGAL_AND_RIGHTS.md).
- **Samples:** every sample set carries its license. Commercial sample libraries are
  often not licensed for embedding in another product.
- **AI disclosure:** EU AI Act Article 50 has applied since 2 Aug 2026. Synthetic audio
  must carry a machine-readable mark, and deepfake audio must be disclosed. Our
  watermarking covers the machine-readable part.
- **Rules profile per event, enforced as hard filters** (templates and style packs set
  defaults; hosts adjust):
  - allowed voice types (some religious events restrict singing voices); the renderer
    refuses to load a disallowed voice model
  - explicit-lyrics filter; brand-safe mode for corporate events
  - allowed languages
  - song block and allow lists
  - volume caps, optionally checked with a microphone
  - segments that must stay silent

## 12. Proposed phases

**Phase 0: prove the four riskiest parts first** (small prototypes with measurable
pass/fail)

| Prototype | Proves |
|---|---|
| PoC-1 Natural stop and switch | The engine plays an arrangement through sampled instruments with live effects; stop, switch, vamp and cue meet section 9 |
| PoC-2 Singing and personas | One consented voice sings two languages with two accents; timbre from voice A plus vibrato and ornaments from style B |
| PoC-3 Arranger | A full band arrangement of a known song in one style pack in ≤ 2 s that a professional event musician accepts |
| PoC-4 Ingest | One recording → stems → melody, chords and lyrics → editable score; measure the human correction time |

**Phase 1 (MVP):** 1–3 style packs and 1–2 event types (P3); a venue node + standby; 50–100
curated songs; operator console + admin chat; 5–10 instruments with technique libraries;
5–10 voice/style traits; the persona builder; a basic Creator Studio; talent onboarding
with consent and royalty tracking.
**Phase 2:** more style packs (including microtonal traditions), more talent,
interfaces in more languages, customer song requests.
**Phase 3:** following live performers (P2), read-the-room autonomy (P11), persona
marketplace (P12), user voice cloning (P14), multi-venue scale.

## 13. Risks and honest limits

| Risk | Why it matters | Mitigation |
|---|---|---|
| Arrangement quality vs. a top human band | The hardest musical problem | Curated style packs, musicians in the loop, blind listening tests |
| Singing realism, accents, ornaments | Needs studio data per singer; ornaments tied to voice color transfer less cleanly | PoC-2 first; record 1–3 hours of clean singing per talent (to be confirmed) |
| Trait separation | Timbre and style are tangled in real recordings; some blends will sound uncanny | Previews, compatibility checks, curator approval of each trait |
| Breadth vs. depth | "Any culture" is a very large content job | Style packs as data; launch with 1–3 deep packs; community musicians as curators and talent |
| Legal | Copyrights, recordings as source, voice rights, minors, AI disclosure, biometric data | Counsel, the `rights` service, a licensing plan |
| Live reliability | An event can't be re-run | Offline node, hot standby, failsafe tracks, soak tests |
| Data scarcity | Some traditions have little recorded or notated material | Commissioned recordings with tradition musicians |
| Acceptance | Musicians' pushback; some communities may object to AI voices | Consent-first, revenue share for talent, positioning as a new income source for musicians |
| Impersonation through uploads | Users may upload a famous singer as their "own" voice | Registry matching, liveness checks, takedown process, bans |
| Marketplace abuse | Fake talent, royalty fraud, trait ownership disputes | Identity checks, per-trait approval, audit log, disputes process |
| Tool-maker liability | Tennessee's ELVIS Act targets tools whose main purpose is producing someone's voice without authorization | Consent-gated rendering by design, watermarks, logs, counsel review |
| Cost | Venue GPU hardware, cloud GPU, studio sessions, sample licenses, talent fees | Sized in P15 |

## 14. Acceptance tests (how we'll know it works)

| # | Test | Pass |
|---|---|---|
| AT-1 | "Stop now" at 100 random positions | Zero clicks; reverb tail within ±10% of its setting; every voice released |
| AT-2 | 100 random switches | Every new downbeat on the grid; ≥ 80% rated "sounds like a live band" by ≥ 3 professional event musicians in blind tests |
| AT-3 | Latency | Every target in section 9 met on real venue hardware |
| AT-4 | Failsafe | Kill generation mid-song: music continues. Kill the main node: standby takes over in ≤ 2 s |
| AT-5 | Accent | Native listeners rate pronunciation ≥ 4/5 per language and dialect |
| AT-6 | Consent | A persona with any missing, expired or revoked consent refuses to render; every render logged and watermarked |
| AT-7 | Offline | A full program rehearsal with the internet unplugged |
| AT-8 | Soak | 8 hours with no audio dropouts |
| AT-9 | Persona | Listeners identify the intended traits in ≥ 70% of blind A/B trials |
| AT-10 | Creator Studio | From a sung reference plus a prompt, ≥ 70% of test users reach "that's what I meant" within 5 rounds |
| AT-11 | Anti-impersonation | Uploads of registered talent voices by anyone else are blocked in ≥ 99% of test cases |
| AT-12 | Royalties | Every paid use produces ledger lines that add up to 100% of that use's talent pool |
| AT-13 | Tuning | Microtonal packs (maqam, raga, gamelan) play within ±3 cents of their tuning profile |
