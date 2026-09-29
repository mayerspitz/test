# SUPERSEDED: v0.3 spec (Jewish weddings). Kept as a worked example of one style pack + one event template. Current spec: ../SPEC.md

# Kol Simcha: Product and System Specification

**Version:** 0.3 draft, 2026-09-29
**Status:** DRAFT. Waiting on the answers to P1–P20 in [OPEN_ITEMS.md](../OPEN_ITEMS.md).
Legal map: [LEGAL_AND_RIGHTS.md](../LEGAL_AND_RIGHTS.md). Sources: [history/RESEARCH_NOTES.md](RESEARCH_NOTES.md).
Anything marked **[proposed]** is a recommendation, not yet a decision.
"Kol Simcha" is a working name (see P18).

---

## 1. Vision

Kol Simcha is an AI wedding band and choir for Jewish weddings. It plays the whole
wedding, from the kabbalas panim to the last dance, in the right style for each
community. That includes the right accents, scales, rhythms, instruments, ornaments and
repertoire. It reacts to live commands the way a great live bandleader would: it stops
with a natural ring-out, switches songs mid-phrase with a real musical bridge, vamps
until the kallah reaches the chuppah, and hits "Mazal Tov" on the beat the glass breaks.

Families design their own **dream band**. For each voice or instrument they pick traits
from many singers and musicians: one singer's voice color, another's vibrato, a third's
krechts, one violinist's tone, another's slides. The system combines these into
**personas**, and combines the personas into a **master model** (the ensemble) for the
wedding. Families can also design personas **from scratch** by describing what they want,
picking pitches and techniques, and singing or humming examples, then refining until it
sounds right (the Creator Studio). Real people's voices and styles are used only with
their signed consent, and **talent earns money every time their traits are used**.

## 2. Glossary

| Term | Meaning here |
|---|---|
| Chosson / Kallah | Groom / bride |
| Kabbalas panim, Tish | Pre-ceremony receptions (kallah's reception; chosson's table with singing) |
| Badeken | The chosson veils the kallah |
| Chuppah | Ceremony. Includes the processional walk-ins, the circling and the breaking of the glass |
| Mitzvah tantz | Late-night Hasidic dance with the kallah, with the badchan calling relatives |
| Badchan | Wedding jester and MC who sings rhymes, often in Yiddish |
| Henna (Hina) | Pre-wedding celebration in many Sephardi and Mizrahi communities |
| Steiger / nusach | Ashkenazi prayer modes, e.g. Ahava Rabbah (freygish), Mi Sheberach, Adonai Malach, Magen Avot |
| Maqam / dastgah / makam | Arabic / Persian / Turkish modal systems. Many use microtones (intervals smaller than a semitone) |
| Krechts, dreydlekh, kvetsh | Ashkenazi and klezmer ornaments: a sob or catch, a trill or turn, a "squeeze" of the tone |
| Articulation / technique | How a note is played or sung (slide, vibrato, pizzicato, trill, falsetto flip…) |
| Trait | One separable quality of a voice or player: timbre, vibrato, ornament set, phrasing, accent… |
| Persona | A virtual singer or player assembled from traits (section 7) |
| Master model / Ensemble | The full virtual band + choir + mix style for one event, built from personas |
| Arrangement | Every part, note, articulation, effect and mix move for one song version |
| Stem | Audio of one part or group (drums, bass, horns, lead vocal, choir…) |
| Tail | The sound that continues after a note or the music stops (release, reverb, delay) |
| Vamp | Repeat a passage until a cue arrives |
| Venue node | The on-site computer that runs the live engine at the event |
| SVS | Singing voice synthesis |
| MPE / MIDI 2.0 | MIDI standards with per-note pitch, used to carry microtones |

## 3. Users and roles

| Role | Who | What they do |
|---|---|---|
| Event admin | Couple, parents, planner, MC | Plan the program before the event. Build personas and the master model. Give live commands through chat and quick buttons, within their permissions |
| Operator | On-site tech or "virtual bandleader" (P1) | Runs the live console. Has final say over admins. Handles failsafes |
| Producer / curator | Our musicians and arrangers | Ingest and correct songs. Build style templates. Approve arrangements, samples and trait models |
| Talent | Singers and instrumentalists | Opt in. Record source material. Set prices and free/promo allowances per trait. Approve or refuse each trait and each use. See usage and earnings. Revoke consent |
| Creator | Any user who builds personas or arrangements | Builds from scratch in the Creator Studio. May publish to the marketplace (P13) |
| Organisation owner | Band company, hall or platform (P1) | Manages accounts, events, billing and hardware |
| Platform admin | Us | Operations, moderation, rights disputes |

## 4. The wedding program the system must support

Each segment has its own musical character. The **program** (run-of-show) is planned
before the event and fully pre-generated (D9), so live commands mostly hit a warm cache.

| # | Segment | Music character | Special live needs |
|---|---|---|---|
| 1 | Henna (Sephardi/Mizrahi, optional separate event) | Traditional, percussion-heavy, community-specific | Processions, costume changes |
| 2 | Kabbalas panim (kallah) | Soft background: piano, violin, light vocals | Low volume, long continuous play |
| 3 | Chosson's tish | Mostly guests singing; sometimes slow nigunim | Accompany or stay silent; follow the room (P2) |
| 4 | Badeken | March or dance into the room, then an emotional slow song | Instant start on cue |
| 5 | Chuppah processional | Slow, choir-heavy. A chosen song per walk-in (grandparents, parents, chosson, kallah) | **Vamp until the person arrives, then end at the next cadence.** Walk-in lengths vary |
| 6 | Circling (7 times) | Continues or changes song | Seamless segue |
| 7 | Brachos under the chuppah | Silence, or a soft pad (per community) | Clean stop with a natural tail |
| 8 | Breaking of the glass | "Mazal Tov" / "Od Yishama" burst | **Pre-armed cue fires on the next beat, under 50 ms.** A button, not chat |
| 9 | Yichud / cocktail hour | Background | Long, low-attention playlist |
| 10 | Grand entrance | Big upbeat entrance song | Armed cue |
| 11 | First dance set (30–60 min) | Continuous medley with an energy arc, rising tempo and key lifts | Auto-continue. Admins say "more energy", "slower", "go Mizrahi", "go Hasidic" |
| 12 | Dinner | Background, low volume | Volume and style limits |
| 13 | Second dance set | Like segment 11 | Same |
| 14 | Mitzvah tantz (Hasidic) | Specific slow nigun, repeated per relative | Vamp per call, driven by the (human) badchan |
| 15 | Benching / sheva brachos | Sheva brachos melodies, or silence | Community-dependent |

Other simchas (vort, sheva brachos, bar mitzvah) reuse the same engine with different
program templates. They come later.

## 5. Communities, styles and sound

This is a starting taxonomy. It **must be checked with musicians from each
community** before anything ships. MVP scope is P3.

| Family | Communities (examples) | Languages and pronunciation | Scale system | Signature instruments | Rhythms (examples) | Vocal traits |
|---|---|---|---|---|---|---|
| Hasidic | Satmar, Bobov, Vizhnitz, Belz, Ger, Skver, Chabad, Breslov, Modzitz… (each has its own nigunim) | Yiddish; Ashkenazi Hebrew (Polish/Galician/Hungarian vowels) | 12-tone; Jewish modes (freygish, Mi Sheberach, minor) | Keyboard orchestra, horns, strings, clarinet, drums, bass | Hasidic dance 2/4, march, slow nigun, waltz | Tenor with krechts, dreydlekh, falsetto flips; boys' and men's choirs |
| Litvish / Yeshivish | US, Israel, UK yeshiva world | Ashkenazi Hebrew (Litvish vs American-Yeshivish vowels), English | 12-tone, Jewish modes | Same as Hasidic, more pop and orchestral | Hora, freilach, pop-rock | Men's choir |
| Modern Orthodox / Dati Leumi | US, Israel | Israeli Hebrew, English | 12-tone | Pop-rock band, strings | Israeli pop, Carlebach, hora | Female voice rules vary (P9) |
| Klezmer / Yiddish heritage | Traditional and secular | Yiddish dialects | Freygish, altered Dorian, etc. | Clarinet, violin, accordion, tsimbl (cimbalom), bass, drums | Freylekhs, bulgar, hora (zhok), sher, khosidl, doina (free rhythm) | Krekhts, kvetsh, dreydlekh |
| Moroccan | Morocco, Israel, France, Canada | Moroccan Judeo-Arabic, Moroccan Hebrew, French | Arabic maqam (with microtones) | Oud, violin (upright, "kamanja"), darbuka, bendir, qanun | 6/8 chaabi, Andalusian forms | Melisma; bakashot style |
| Yemenite | Israel | Yemenite Hebrew (distinct consonants), Yemenite Judeo-Arabic | Local modal practice | Voice and percussion (pan/tin drum, darbuka) | Yemenite step | Diwan / Shabazi style |
| Syrian (Halabi, Shami) | Brooklyn, Deal, Israel, Latin America | Hebrew (Syrian), Judeo-Arabic | Arabic maqam (pizmonim follow maqam practice) | Oud, qanun, violin, ney, riq, darbuka | Maqsum, baladi, masmoudi, etc. | Classical Arab ornamentation |
| Iraqi (Bavli) | Israel, UK, US | Judeo-Arabic, Iraqi Hebrew | Iraqi maqam | Santur, joza, oud, percussion | Chalghi forms | Iraqi maqam vocal |
| Persian | LA, NY, Israel | Persian, Persian Hebrew | Dastgah (koron/sori microtones) | Tar, setar, santur, kamancheh, tombak, daf; Persian pop band | 6/8 "shesh-o-hasht" | Tahrir (yodel-like ornament) |
| Bukharian | Queens, Israel | Bukhori (Judeo-Tajik), Russian | Shashmaqam | Doira, tar, dutar, accordion, keyboard | Central Asian dance rhythms | Shashmaqam vocal |
| Mountain Jews, Georgian | Israel, Russia, US | Juhuri, Georgian, Russian | 12-tone plus local practice | Accordion, doli/drum, keyboard | Lezginka | |
| Kurdish | Israel | Neo-Aramaic, Kurdish | Modal | Zurna, dohol | Circle dances | |
| Tunisian, Libyan, Djerban | Israel, France | Judeo-Arabic, French | Maqam (Tunisian malouf) | Mezoued (bagpipe), darbuka, oud, violin | Stambali-influenced, 6/8 | |
| Turkish, Greek, Balkan (Ladino) | Israel, Turkey, US | Judeo-Spanish (Ladino), Turkish | Turkish makam (53-comma theory) | Oud, kanun, violin, clarinet | 9/8, 7/8 | Ladino romanza style |
| Ethiopian (Beta Israel) | Israel | Amharic, Ge'ez | Qenet pentatonic modes (tezeta, bati, ambassel, anchihoye) | Kebero, masenqo, krar | Eskista 6/8 | Ethiopian melisma |
| Indian (Bene Israel, Cochin) | Israel, India | Marathi, Malayalam | Local | Local | Local | |
| Israeli mainstream | Israel, diaspora | Israeli Hebrew | 12-tone and maqam pop | Pop band, Mizrahi pop band | Mizrahi-pop "hafla" sets | Mizrahi-pop ornamentation |

**Consequences for the system**

- **Pitch is stored in cents, not only as MIDI note numbers** (D6). Maqam, dastgah and
  makam intervals vary by region, so each style carries a **tuning profile**. For
  example, a Syrian Sikah third is not an Egyptian one.
- **Lyrics are stored in their original script, with vowels** (vocalized Hebrew with
  niqqud, Yiddish, Ladino, Judeo-Arabic). Pronunciation is derived per tradition by rules,
  for example kamatz as "o" or "a", holam as "oy", "ey" or "o", and tav without dagesh as
  "s" or "t". **The same song can be sung in any pronunciation by any voice.**
- Each style carries its own groove library, ornament vocabulary, typical ensemble,
  harmony rules and mix character.

## 6. Live behaviour: "play like a real band"

This is the heart of the product. Every command maps to a musically correct action,
never an audio cut.

### 6.1 Command vocabulary

Chat, voice and buttons all turn into these structured commands. The chat service uses
an AI model to understand free text in English, Hebrew, Yiddish or a mix, and maps song
names across spellings and scripts ("Od Yishama" = "Od Yishoma" = "עוד ישמע").

| Command | Parameters |
|---|---|
| `PLAY` / `QUEUE` | song, section or segment, key, tempo, style, persona or master model, at-boundary |
| `SWITCH` | target song or section, at-boundary, transition type (optional) |
| `STOP` | mode (6.2) |
| `FADE` | seconds |
| `PAUSE` / `RESUME` | resume at: same bar / phrase start / section start |
| `VAMP` / `HOLD` | loop the current bar, phrase or section until `RELEASE` |
| `END` | mode: at cadence, end of phrase, end of section, "button" ending |
| `TEMPO` | ±bpm or ±%, ramp length |
| `KEY` | ±semitones or a target key; modulation style |
| `ENERGY` | up / down (density, drums, horns, choir, tempo within limits) |
| `LAYER` | mute / solo / bring in: drums, choir, horns, strings, lead vocal… |
| `MODE` | a cappella choir only / instrumental only / full band |
| `STYLE` / `PERSONA` | switch style, or swap a persona, at the next boundary |
| `VOLUME` | master or per layer, capped by event limits |
| `CUE` | arm / fire a pre-built cue (glass break, entrance, "Siman Tov") |
| `PROGRAM` | next segment / go to segment / skip / repeat |
| `SFX` | fire a musical sound effect (riser, drum roll, impact) |
| `UNDO` | revert the last change, if it hasn't played yet |

### 6.2 Stop and end modes

| Mode | What you hear |
|---|---|
| **Stop now** (your example) | No new notes. Held notes get note-offs and release naturally. A piano's sustain pedal lifts, cymbals keep ringing, and the current sung syllable ends with a short natural release. Reverb and delay keep processing, so **the hall hears the natural decay**. No clicks, no cut. |
| Stop on beat | The same, quantized to the next beat |
| Button ending | The band hits one final accented chord on the next downbeat, then stops as above |
| End at cadence | Finish at the next natural phrase ending, with a proper final chord |
| Fermata / freeze | Hold the current chord, then release on command |
| Fade | Smooth fade over N seconds, then stop as above |

### 6.3 Switching and transitions

When a switch comes in, the **Conductor** knows the current song, section, bar, beat,
tempo, key, groove and energy, and the target's. It picks a **boundary** and asks the
**Transition planner** for a **bridge**:

- **Boundaries:** now (next beat), next bar, next phrase (usually 4 or 8 bars),
  end of section, end of song. **[proposed]** The default is the next phrase, and "now"
  is always available.
- **Bridge types:** a direct hit on the downbeat; a drum fill into the new song; a
  pickup or anacrusis; a pivot-chord or direct modulation (including the classic
  half-step lift in dance sets); a tempo ramp; a break (drums drop out, choir pickup);
  a crossfade (last resort only).
- **The bridge buys time.** If the target song was never generated, the band vamps or
  plays a fill on the current groove while the new arrangement is generated. It never
  goes silent and never waits.

### 6.4 Segments, loops and vamps

"Play only the chorus of X", "Repeat the B part", "Loop this until I say", "Play that
melody from the kallah's entrance". Every song is stored with sections, phrase ends and
**safe transition points**, so any segment can be entered or left musically.

### 6.5 Autonomy

**[proposed]** By default, the AI carries out commands and the planned program, and
keeps dance sets flowing (it picks the next song in the medley within the admins'
lists). A "read the room" mode that senses crowd energy through a microphone or camera
is optional (P12).

## 7. Personas and the master model

Added from your second message. **Build a dream band by combining traits from many
singers and musicians.**

### 7.1 Hierarchy

```
Trait        one separable quality (e.g. "Singer B's vibrato", "Violinist D's slides")
  └ Persona  one virtual singer or player = base sound + chosen traits (with weights)
      └ Master model   the ensemble for an event = personas for every part
                       + choir + arrangement style + mix style
          └ Event profile   master model + community rules + program
```

### 7.2 Voice traits (examples; each one is a selectable, previewable building block)

| Trait type | Examples |
|---|---|
| Timbre (voice color, identity) | Singer A's voice. Blending two timbres is possible if both singers consent (feasibility: see research notes) |
| Range and tessitura | Comfortable range; how high the voice goes before it strains; falsetto range |
| Vibrato | Rate, depth, onset delay, shape; straight-tone habits |
| Ornaments | Krechts (sob), dreydlekh (trills/turns), melisma and runs, scoops, falls, grace notes, tahrir, Arabic-style ornaments |
| Register behavior | Falsetto flips, belting, head/chest mix |
| Color effects | Breathiness, rasp or grit, growl, vocal fry, nasality |
| Phrasing and timing | Rubato, singing behind or ahead of the beat, breath placement |
| Dynamics and emotion | Intensity arcs, tenderness vs power |
| Pronunciation / accent | Any tradition from section 5, independent of the voice |

### 7.3 Instrument traits

| Trait type | Examples |
|---|---|
| Sound source | A sampled instrument (e.g. a specific violin), a modeled or synth sound, or a user-imported sample set |
| Articulations and techniques | See 7.4. Which ones this player uses, and how often |
| Ornament style | Density and choice of trills, slides, kvetsh, krekhts; Mizrahi quarter-tone inflections |
| Timing feel | Swing, push or pull, rubato |
| Tone chain | Instrument-level tone (bow pressure, mute type, amp or mic character) |

### 7.4 Technique library (the "violin pitches and squeezes")

Every instrument gets a catalog of named techniques with audio examples, stored as
recorded samples, modeled behavior, or both. Examples:

| Instrument | Techniques |
|---|---|
| Violin | Legato, portamento / glissando (slides), vibrato types, trills, mordents, turns, grace notes, pizzicato, spiccato, staccato, tremolo, harmonics, double stops, sul ponticello, sul tasto, accents; klezmer **krekhts** and **kvetsh** ("squeeze"); Mizrahi slides and quarter-tone bends |
| Clarinet | Krekhts, glissando, bends, trills, flutter-tongue, growl, "laughing" (tshok) |
| Trumpet / trombone | Shakes, falls, doits, rips, growls, mutes (straight, cup, harmon, plunger), flutter |
| Saxophone | Subtone, growl, bends, altissimo, falls |
| Oud / qanun / santur / tar | Tremolo, mandal (quarter-tone lever changes on qanun), slides, ornaments per maqam |
| Darbuka / riq / tombak | Doum, tek, ka, slaps, snaps, finger rolls, jingle work |
| Voice | Everything in 7.2 |

"Your 'squeezes' are most likely the klezmer *kvetsh*" is an assumption. Curators
name, record and tag the techniques. The catalog grows over time and is not hard-coded.

### 7.5 Rules for personas **[proposed]**

1. **Rights bill of materials.** Every persona and master model carries a list of every
   contributing person, which trait of theirs is used, their consent reference and
   their royalty share. Rendering is refused if any consent is missing, expired,
   revoked or out of scope.
2. **Timbre always needs consent**, whatever the blend weight. A persona that is 95%
   one singer's timbre is that singer.
3. **Named style traits need consent too** ("Singer B's krechts"). Unnamed, generic style
   archetypes ("Hasidic tenor krechts, heavy") need none.
4. **Compatibility checks with previews.** For example, the system warns when a persona
   is pushed outside its timbre owner's natural range and would sound artificial.
5. Personas are saved per account. Sharing or selling them is P13.
6. **No back-door cloning.** Every uploaded or recorded voice is checked against the
   registry of talent voices. A match to someone other than the uploader is blocked.
   Any new synthetic timbre must pass a similarity check against every registered voice.
7. **A user's own voice is a style reference by default.** From a user's recording the
   system takes pitch, timing, ornaments and dynamics, not their timbre. Cloning a user's
   own timbre is a separate opt-in with identity and liveness checks, because voiceprints
   are biometric data in some jurisdictions (P20).

### 7.6 Technical consequence: shared trait models

Verified in DiffSinger, a leading open-source singing synthesizer: the timbre model
(acoustic) and the expression model (variance: pitch curve, timing, energy, breathiness,
tension) are **separate models**, and speakers can be mixed, but **only within one jointly
trained multi-speaker model**. So:

- All consented talent is trained into **shared multi-speaker trait models** (timbre and
  expression), so traits from different people can be combined. Adding a new talent means
  fine-tuning those shared models. That is a pipeline job, not a runtime job.
- Singing is rendered ahead of time, not streamed live (DiffSinger makes no real-time
  claim), which matches D3.
- Commercial tools already blend voices (ACE Studio "Voice Blending"; Synthesizer V
  assigns pitch, timbre and pronunciation modes separately within one voice). This is
  proof the idea is viable, not a component choice.

### 7.7 Creator Studio: build from scratch

For users who want something no existing talent offers. The studio turns *intent* into a
persona, an instrument part or an arrangement, then iterates until the user is happy.

**Inputs (any mix):**

| Input | Example |
|---|---|
| Text prompt | "Warm Hasidic tenor, soft krechts on long notes, little vibrato, bright top" |
| Pickers and sliders | Range, vibrato rate and depth, ornament density, breathiness, accent, technique list |
| **Sing or hum it** | The user records "like this": a phrase, a sob, a slide, a run. The system extracts the pitch curve, timing, ornaments and dynamics as the target |
| Reference audio | "The violin slide at 1:12 of this recording." Used for **style only**, never to copy an identifiable voice |
| Existing traits | Start from a talent persona and push it somewhere new |

**Loop:** the studio generates 2–4 candidates → the user listens and compares (A/B) →
tweaks by chat ("more sob, less vibrato"), sliders, or by singing it again → the studio
refines → repeat. Every version is kept and can be reverted. When locked, the result is
saved as a persona, instrument persona or arrangement part, with its rights bill of
materials.

**The same flow works for instruments** ("a violin that slides into notes like this")
and **for music** (hum an intro or melody, and the arranger orchestrates it in the chosen
style).

**Limits:** "from scratch" still needs a base timbre. It comes from a consented blend pool
of talent (no one person dominant, similarity-checked) or from voice-design models trained
only on consented data. Quality depends on PoC-2.

## 8. Architecture

### 8.1 Core design decisions **[proposed]**

- **D1 Notes first, sound live.** The generator produces the *notes*: a complete
  multitrack arrangement with every note, articulation, effect and mix move, in about
  2 seconds. The venue engine turns the notes into sound **live**. Your idea of "every
  key rendered with its effects" is what a sampler does, so the engine is a sampler
  and synth host with live effects.
- **D2 Effects run live, after the instruments.** That gives the natural stop for free:
  stop sending notes, and reverb, delay, releases and ringing cymbals decay naturally.
- **D3 Vocals are rendered a few seconds ahead.** Neural singing is not instant. Vocals
  are rendered phrase by phrase ahead of the playhead, then pass through the same live
  effects. Stop = a natural release of the current syllable plus the live reverb tail.
- **D4 The whole event runs offline on a venue node.** The cloud is for preparation
  (library, ingestion, training, planning). The event runs on an on-site computer with
  a GPU, with a hot standby (P4).
- **D5 Separate services, no network hops in the audio path.** Every service is its own
  package with its own contract, tests and version. Non-real-time services deploy as
  network services. The real-time ones (player, renderer, effects, instrument and kit
  runtimes) are libraries linked into one venue-engine process (P6).

Rejected alternatives:
- **End-to-end audio generation** (text-to-song models that output mixed audio): no
  per-note control, no natural mid-phrase switching, weak stems, and training-data
  rights problems.
- **Pre-rendered WAV stems per song:** a stop would cut the tails unless they were
  modeled separately, switches would need crossfades, and live key or tempo changes
  degrade the audio.

### 8.2 Service map

| # | Service | Owns | Plane |
|---|---|---|---|
| 1 | `theory` (scales and notes) | Scales, Jewish modes, maqam/dastgah/makam, tuning profiles in cents, chord and harmony rules per style, key and tempo math | Library, used everywhere |
| 2 | `library` (songs library) | Catalog: titles in every script and spelling, composer, community, segment fit, language, rights status, search | Cloud + local mirror |
| 3 | `songs` (scores) | Canonical song data: melody, harmony, form, sections, safe transition points, vocalized lyrics, versions | Cloud + local mirror |
| 4 | `ingest` (extraction) | Audio, MIDI, MusicXML, sheet music or keyboard styles → stems → transcription → human correction → canonical score and arrangement | Cloud (offline) |
| 5 | `midi` | MIDI 1.0/2.0, MPE, SMF import/export, MusicXML bridge, live MIDI devices (controllers, foot pedals, keyboards) | Library + venue |
| 6 | `instruments` | Instrument definitions, technique catalog (7.4), sample and synth assets, **sample import from any common format** (auto pitch, velocity and loop mapping), performer-style models | Cloud build + venue runtime |
| 7 | `kits` | Drum and percussion kits, groove and pattern libraries per style, ensemble presets | Cloud build + venue runtime |
| 8 | `personas` | Traits, personas, master models, rights bill of materials, compatibility checks, similarity checks against the voice registry, previews; trains talent into the shared trait models (7.6) | Cloud + local mirror |
| 9 | `arranger` | Generates full arrangements from score + style + master model + context. Medleys, intros, endings, fills. Humanized performance | Venue GPU (+ cloud for pre-generation) |
| 10 | `transitions` | Bridges between any two musical states (6.3) | Venue |
| 11 | `singing` | Solo voice and choir synthesis from personas; pronunciation per tradition; ornaments; renders ahead of the playhead | Venue GPU (+ cloud) |
| 12 | `rights` | Consent records, scopes, expiry, revocation, royalties, audit log, audio watermarking; also song and sample licenses | Cloud + signed local cache |
| 13 | `effects` | Effect chains and live DSP (reverb, delay, EQ, dynamics, modulation, vocal effects), musical sound effects, hall compensation, volume limiter | Venue real-time |
| 14 | `renderer` | Real-time audio engine: note events → samplers and synths → effects → stems | Venue real-time |
| 15 | `player` (conductor) | Transport, timeline, cue queue, boundaries, vamps, stop and end modes, failsafe, output routing | Venue real-time |
| 16 | `live-chat` | AI chat and command service, quick buttons, permissions, conflict rules, command log | Cloud relay + local |
| 17 | `events` | Events, program (run-of-show), community profile, rules, preferences, song lists | Cloud + local mirror |
| 18 | `accounts` | Identity, organisations, roles, billing | Cloud |
| 19 | `studio` | Web editor for producers: piano roll, score, arrangement review and approval, trait tagging | Cloud (UI) |
| 20 | `venue-node` | Packaging of the real-time services, sync agent, local web console, standby handover | Venue |
| 21 | `creator-studio` | Prompt + pickers + sung reference → candidates → refine loop (7.7); version history | Cloud GPU |
| 22 | `marketplace` | Talent profiles, per-trait terms and prices, promo programs, royalty ledger, payouts, published personas (P13) | Cloud |

Assumption: "kits" means drum and percussion kits, their grooves, and ensemble presets.
Correct me if you meant something else.

### 8.3 Canonical data formats

| Format | Contents |
|---|---|
| **Score** | Sections, phrase ends, safe transition points, melody (pitch in cents, timing, lyric syllables), harmony (chord symbols + functions), meter and tempo map, key and mode + tuning profile, vocalized lyrics per language |
| **Arrangement** | References Score and version. Parts (role, persona, range), every note (pitch in cents, start, length, velocity, technique, expression curves), automation, effect chains per bus, mix |
| **Performance stream** | Time-stamped events from player to renderer: notes, techniques, expression, effect changes, vocal clip triggers, transport |
| **Trait / Persona / Master model** | Trait references, weights, constraints, rights bill of materials, preview audio |
| **Instrument / Kit package** | Samples or synth parameters, technique map, range, performer-style defaults, license reference |
| **Voice package** | Model files (encrypted), phoneme sets, supported traditions, consent reference, watermark key |
| **Interchange** | MIDI 1.0 SMF, MIDI 2.0 / MPE (microtones), MusicXML, Scala tuning files, WAV/FLAC stems (48 kHz / 24-bit) |

### 8.4 Command-to-sound timeline (example)

```
t = 0.00 s   Admin taps "Switch → Od Yishama, chorus"
t + 0.05 s   Command reaches the player on the venue node (local)
t + 0.10 s   Player picks a boundary (e.g. end of bar 37, at t + 1.6 s) and asks for a bridge
t + 0.30 s   Target arrangement: cache hit, or generated in ≤ 2 s (the bridge covers the gap)
t + 1.60 s   Bridge starts: drum fill + pickup, modulation if needed; new vocals render ahead
t + 3.60 s   New song's downbeat
```

### 8.5 Deployment

- **Cloud:** library, songs, ingest, personas, rights, events, accounts, studio,
  live-chat relay, and pre-generation. The web apps are mobile-first and installable
  (the user prefers web apps on Android). GPU work needs a GPU host (see research notes).
- **Venue node [proposed]:** a laptop or mini-PC with a GPU and a pro audio interface.
  It runs the real-time engine, local generation, the local cache of everything the
  event needs, and a local web console. A **hot standby** (a second node, or at minimum
  a tablet with a pre-rendered backup of the program) takes over within about 2 s.
- **Control paths:** admin phones reach the cloud relay over cellular data. A backup
  local Wi-Fi hotspot from the venue node also works with no internet. The operator
  console is always local.

### 8.6 Failsafes

- **There is never dead air.** If generation is late, the band vamps. If nothing is
  ready, a pre-rendered safe track plays.
- The audio thread is isolated: no network, no disk waits and no memory allocation in
  the real-time path. A watchdog restarts non-real-time parts without stopping the music.
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
| Audio | 48 kHz, 24-bit output, 32-bit float internally; stereo + up to 16 stems (P5) |
| Reliability | Whole event with no dropout; 8-hour soak test clean; hot standby ≤ 2 s |
| Offline | A full event runs with the internet unplugged |
| Launch content | 5–10 instruments and 5–10 voice/singing styles at launch, deep rather than wide; architecture open to any number |

## 10. Talent program and business model **[proposed]**

**Goal:** the most engaged users and talent possible (the standard AI-era freemium
model), with talent paid fairly every time their work is used.

### 10.1 Talent

- **Opt-in only.** Talent signs a license (never a transfer of ownership), records
  source material, and approves each extracted trait before it goes live.
- **Talent controls each trait's terms:**

| Use type | Default | Talent can set |
|---|---|---|
| Preview in the builder (watermarked, short) | Free | Can turn off |
| Promotional / free programs | Off until the talent opts in | Caps: e.g. N free events a month, free tier only, specific campaigns |
| Live wedding use | Paid | Price or share, minimum price, allowed communities, regions, song types, blending allowed |
| Recording or export (e.g. a take-home wedding track) | Paid, higher | Allowed or not, price |
| Commercial use outside events | Off | Negotiated separately |

- **Earnings follow the rights bill of materials.** Each paid use creates a royalty
  line for every contributing talent, weighted by their share of the persona. Talent
  sees live usage, earnings and followers in a dashboard. Payouts go through a payments
  provider with identity checks and tax forms.
- **Revocation** stops new uses right away. Events already booked are honored or
  refunded, per the talent agreement (P19).

### 10.2 Users (engagement engine)

- **Free:** browse talent, build personas and master models, unlimited watermarked
  previews, promo-pool traits, Creator Studio with limits. Couples plan for months, so
  this is the long engagement window.
- **Paid:** a live event license (per event), hardware or rental for the venue node, a
  take-home recording, premium talent, more Creator Studio generations.
- **Pro tier:** band companies and halls run many events, with operator tools and
  multiple venue nodes (P1).
- **Growth loops:** talent promotes their own profile ("book my voice for your wedding");
  users share personas and wedding previews; creators publish personas and earn (P13);
  referrals.

### 10.3 Money flow (example; percentages to be decided, P19)

```
Event price ──► platform fee
            ├─► song rights (performance licenses, where due)
            ├─► talent pool ──► split by each persona's rights bill of materials
            └─► creator share (if a published persona was used, P13)
```

## 11. Rights, consent and community rules

- **Voices and traits:** signed consent per person, per trait, per use scope (events,
  regions, dates, song types, blending allowed or not). Revocable. Royalty terms. Every
  output watermarked. Minors (e.g. boys' choir voices) need guardian consent and a
  time-limited license (P8).
- **Songs:** many wedding songs belong to living composers. Performance licensing,
  arrangement (derivative work) rights, and the use of commercial recordings for
  extraction all need a plan (P10). **We need a lawyer; this spec is not legal advice.**
- **Samples:** every sample set carries its license. Commercial sample libraries are
  often not licensed for embedding in another product (P10).
- **AI disclosure:** the EU AI Act's Article 50 has applied since 2 Aug 2026. Synthetic
  audio must carry a machine-readable mark, and deepfake audio must be disclosed. Our
  watermarking covers the machine-readable part. See [LEGAL_AND_RIGHTS.md](../LEGAL_AND_RIGHTS.md).
- **Community rules profile per event, enforced as hard filters:**
  - No female voices (kol isha) for Orthodox events. The renderer cannot load a female
    voice model into such an event.
  - Language limits (e.g. Yiddish and Hebrew only).
  - Song blacklists and whitelists (e.g. no secular melodies).
  - Volume caps (optionally measured with a microphone).
  - Segment rules (e.g. silence during the brachos).

## 12. Proposed phases

**Phase 0: prove the four riskiest parts first (small prototypes, each with a measurable pass/fail)**

| Prototype | Proves |
|---|---|
| PoC-1 Natural stop and switch | The engine plays an arrangement through sampled instruments with live effects; stop, switch, vamp and cue meet the targets in section 9 |
| PoC-2 Singing and personas | One consented voice sings Hebrew and Yiddish in two pronunciations; timbre from voice A plus vibrato and krechts from style B |
| PoC-3 Arranger | A full band arrangement of a known song in one style in ≤ 2 s that a professional wedding musician accepts |
| PoC-4 Ingest | One recording → stems → melody, chords and lyrics → editable score; measure the human correction time |

**Phase 1 (MVP):** one community family (P3), one venue node + standby, the full
program in section 4, 50–100 curated songs, operator console + admin chat, 5–10
instruments with their technique libraries, 5–10 voice/style traits, a persona builder,
a basic Creator Studio (prompt + sing-it reference), talent onboarding with consent and
royalty tracking, and a men's choir.
**Phase 2:** a second community family (e.g. Sephardi/Mizrahi, microtonal), more talent,
Hebrew and Yiddish interfaces, customer song requests.
**Phase 3:** following live musicians (P2), read-the-room autonomy (P12), a persona
marketplace (P13), cloning a user's own voice (P20), multi-venue scale.

## 13. Risks and honest limits

| Risk | Why it matters | Mitigation |
|---|---|---|
| Arrangement quality vs. a top human band | This is the hardest musical problem | Curated style templates, musicians in the loop, blind listening tests |
| Singing realism, accents, ornaments | Needs per-singer studio data; ornaments that depend on voice color transfer less cleanly between singers | PoC-2 first; record 1–3 hours of clean singing per talent (to be confirmed) |
| Trait separation | Timbre and style are tangled together in real recordings; some blends will sound uncanny | Previews, compatibility checks, curator approval of each trait |
| Legal | Copyrights, recordings as source data, voice rights, minors, AI disclosure | Counsel, the `rights` service, a licensing plan |
| Live reliability | A wedding can't be re-run | Offline node, hot standby, failsafe tracks, soak tests |
| Data scarcity | Smaller communities have little recorded or notated material | Commissioned recordings with community musicians |
| Community acceptance | Some communities may object to AI voices of real singers; musicians may push back | Consent-first, revenue share with talent, rabbinic input per community |
| Cost | Venue GPU hardware, cloud GPU, studio sessions, sample licenses, talent fees | Sized in P14 |
| Impersonation through uploads | Users may upload a famous singer's voice as their "own" | Registry matching, liveness checks, takedown process, ban policy |
| Marketplace abuse | Fake talent, royalty fraud, disputes over who owns a trait | Talent identity checks, approval of each trait, audit log, dispute process |
| Tool-maker liability | Tennessee's ELVIS Act targets tools whose main purpose is producing someone's voice without authorization | Consent-gated rendering by design, watermarks, logs, counsel review |

## 14. Acceptance tests (how we'll know it works)

| # | Test | Pass |
|---|---|---|
| AT-1 | "Stop now" at 100 random positions | Zero clicks; reverb tail length within ±10% of the effect's setting; every voice released |
| AT-2 | 100 random switches | Every new downbeat on the grid; ≥ 80% rated "sounds like a live band" by ≥ 3 professional wedding musicians in blind tests |
| AT-3 | Latency | Every target in section 9 met on real venue hardware |
| AT-4 | Failsafe | Kill generation mid-song: music continues. Kill the main node: standby takes over ≤ 2 s |
| AT-5 | Accent | Native listeners from each community rate pronunciation ≥ 4/5 |
| AT-6 | Consent | A persona with any missing, expired or revoked consent refuses to render; every render logged and watermarked |
| AT-7 | Offline | A full program rehearsal with the internet unplugged |
| AT-8 | Soak | 8 hours with no audio dropouts |
| AT-9 | Persona | Listeners identify the intended traits (e.g. "B's vibrato") in ≥ 70% of blind A/B trials |
| AT-10 | Creator Studio | From a sung reference plus a prompt, ≥ 70% of test users reach "that's what I meant" within 5 iterations |
| AT-11 | Anti-impersonation | Uploads of registered talent voices by anyone else are blocked in ≥ 99% of test cases |
| AT-12 | Royalties | Every paid use produces ledger lines that add up to 100% of the talent pool for that use |
