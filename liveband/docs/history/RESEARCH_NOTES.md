# Research notes

Facts checked against sources on 2026-09-29.

**Status key:**
- **VERIFIED:** the source page itself was read.
- **PARTLY:** some detail rests on search snippets, not the page.
- **UNCONFIRMED:** search results only.

**Network limit:** the sandbox proxy reached only github.com and
raw.githubusercontent.com. Official sites (midi.org, juce.com, render.com, EU sites, the
Tennessee legislature, RIAA, ASCAP, BMI, ACUM, ACE Studio, Dreamtonics) were blocked. So
every PARTLY row outside GitHub still needs someone to open the page directly.

## Audio and ML components

| # | Fact | Source | Status | What it changes |
|---|---|---|---|---|
| R1 | **Demucs** (source separation): MIT license. `htdemucs` gives 4 stems (drums, bass, vocals, other); `htdemucs_6s` adds guitar and piano, and the README says piano "is not working great". The Meta repo was **archived Jan 1, 2025** ("not maintained anymore"). The author's fork (adefossez/demucs) says it is "officially maintained" but gets no new features; it tagged v4.1.0 on Jul 11, 2026 | github.com/facebookresearch/demucs ; github.com/adefossez/demucs | VERIFIED | `ingest` should treat source separation as a replaceable component and not bet on Demucs long-term |
| R2 | **Basic Pitch** (Spotify): Apache-2.0, polyphonic, instrument-agnostic, outputs MIDI "complete with pitch bends" | github.com/spotify/basic-pitch | VERIFIED | Good first choice for transcription in `ingest`; pitch bends help with ornaments |
| R3 | **MT3** (Google Magenta): multi-instrument transcription on T5X; Apache-2.0 | github.com/magenta/mt3 | VERIFIED (maintenance status not checked) | Option for full-band transcription |
| R4 | **DiffSinger** (OpenVPI): Apache-2.0. No real-time or streaming claim in the README or docs; deployment is via OpenUtau and the in-development DiffScope | github.com/openvpi/DiffSinger | VERIFIED | Supports D3: render vocals ahead, don't stream them |
| R5 | **DiffSinger model split:** the acoustic model (timbre) and the variance model (durations, pitch curve, energy, breathiness, voicing, tension) are separate. A multi-speaker acoustic model can "use different speakers in the same model, or mix their timbre and style". `infer.py --spk` takes a "mixture of speakers". Variance models support multi-speaker too | github.com/openvpi/DiffSinger/blob/main/docs/BestPractices.md ; .../scripts/infer.py | VERIFIED | Persona builder is feasible, **but only across speakers trained into the same model** (my inference, not documented) → shared trait models (SPEC 7.6) |
| R6 | **OpenUtau:** documents "voice color curves" (changing gradually between one voicebank's vocal modes). Speaker mixing in OpenUtau is not confirmed | github.com/openutau/OpenUtau/wiki/DiffSinger-support | PARTLY | Not needed; we'd use our own inference |
| R7 | **ACE Studio** has "Voice Blending" (combine voice seeds with a ratio per voice, savable presets) and VoiceMix. **Synthesizer V Studio 2 Pro** can assign different vocal modes to pitch, timbre and pronunciation within one voice, and Unison layers up to 16 voices. No cross-voice timbre blending was found for Synthesizer V | docs.acestudio.ai/ai-vocal-synth/creating-ai-vocals/voice-blending ; dreamtonics.com/synthesizerv/ | PARTLY | Shows the market already accepts voice blending |
| R8 | **Whisper** lists Hebrew (`he`) and Yiddish (`yi`) among 99 languages. The README says accuracy "varies widely" by language | github.com/openai/whisper/blob/main/whisper/tokenizer.py | VERIFIED | Lyrics transcription in `ingest` will need human correction for smaller languages |
| R9 | **MPE:** each note gets its own channel, so pitch bend works per note (default range 48 semitones). Adopted Jan 28, 2018; v1.1 in 2022. **MIDI 2.0** has per-note pitch features | midi.org/mpe-midi-polyphonic-expression | PARTLY (snippets; MIDI 2.0 details unconfirmed) | External microtonal export (D6) |
| R10 | **MTS-ESP** (ODDSound): a free C/C++ library for microtuning plugins; one master sets tuning for all clients. **0BSD license**, so commercial use is fine. It needs the libMTS dynamic library, and ODDSound provides bundleable installers. There is a free master plugin, MTS-ESP Mini | github.com/ODDSound/MTS-ESP | VERIFIED | Microtonal tuning across hosted instruments in `renderer` |
| R11 | **JUCE:** the repo LICENSE points to the JUCE 9 EULA, dual AGPLv3 + commercial. Tiers per snippets: Starter free up to $20k revenue a year, Indie up to $300k, Pro unlimited | github.com/juce-framework/JUCE/blob/master/LICENSE.md ; juce.com/get-juce | PARTLY (tier limits from snippets) | Candidate framework for the real-time engine (P16) |

## Hosting

| # | Fact | Source | Status | What it changes |
|---|---|---|---|---|
| R12 | **Render has no GPU instances.** Render's own articles point GPU inference to providers like RunPod or Replicate | render.com/pricing | PARTLY (Render-authored snippets) | Web apps and APIs can go on Render. GPU work needs another provider (SPEC 8.5) |

## Law and licensing (not legal advice)

| # | Fact | Source | Status |
|---|---|---|---|
| R13 | **Tennessee ELVIS Act:** adds "voice", real or simulated, to the state's right of publicity; creates liability for distributing a tool whose primary purpose is producing someone's voice or likeness without authorization. Signed Mar 21, 2024; effective Jul 1, 2024; Public Chapter 588 | publications.tnsosfiles.com/acts/113/pub/pc0588.pdf ; tn.gov governor news, 2024-03-21 | PARTLY (statute text blocked) |
| R14 | **EU AI Act Article 50** applies from **2 Aug 2026**. 50(2): providers must mark synthetic audio in a machine-readable, detectable way. 50(4): deployers must disclose deepfake audio. Systems already on the market before 2 Aug 2026 reportedly have until 2 Dec 2026 for 50(2) | digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act | PARTLY (grace period and artistic-work wording unconfirmed) |
| R15 | **Performance licensing:** ASCAP says the business that benefits holds the license, and it can't be shifted to hired musicians. BMI treats hotel ballrooms rented to third parties for private events as non-public areas. **ACUM** (Israel) tariff T008 "Family Events" covers weddings, bar mitzvahs and henna celebrations: 351 NIS incl. VAT per event, arranged up to 72 hours ahead; the hall owner, the DJ or singer, and the organizer are all responsible | ascap.com/help/ascap-licensing ; bmi.com/licensing/entry/hotels_motels ; acum.org.il/en/tariff-public-performance/parties/ | PARTLY (snippets) |
| R16 | **Suno and Udio lawsuits:** on Jun 24, 2024, UMG, Sony and Warner sued Suno (D. Mass.) and Udio (S.D.N.Y.), coordinated by the RIAA. Reported later: UMG settled with Udio and licensed it (late Oct 2025); WMG settled with Udio and with Suno (Nov 2025); Sony and UMG filed further suits in 2026. Sources conflict on whether Sony settled with Udio | variety.com (2024-06-24 article); riaa.com blocked | PARTLY (press only; 2025–26 details unconfirmed) |

## Market

| # | Fact | Source | Status |
|---|---|---|---|
| R17 | Existing Jewish simcha music products are style/beat packs and MIDI files for arranger keyboards, not AI: Jewish Beats USA, MZF Productions, Kosher Music Organization, Yamaha's "Traditional Jewish Favorites", MIDIdb's Jewish section. Kept from v0.3 as an example of the per-culture "style pack" market | jewishbeatsusa.com ; mzfproductions.com ; koshermusic.org ; shop.usa.yamaha.com ; mididb.com/jewish/ | UNCONFIRMED |

## Background knowledge not yet checked against a source

- The music-theory taxonomy in SPEC section 5 (tunings, rhythms, instruments). Needs a
  review by musicians from each tradition.
- Data needed per singer for a high-quality voice model ("1–3 hours of clean singing").
- GDPR and Illinois BIPA treating voiceprints as biometric data.
- Post-mortem publicity rights in NY, CA and TN.
