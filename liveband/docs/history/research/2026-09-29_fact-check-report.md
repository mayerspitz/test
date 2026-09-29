# Fact-check report, 2026-09-29 (raw)

This is the verbatim output of the research helper agent that checked facts for the
spec. The condensed and cross-referenced version is in
[../RESEARCH_NOTES.md](../RESEARCH_NOTES.md). The brief it was given is below, so the
check can be repeated or extended.

## Brief given to the helper (verbatim)

> I'm drafting a product spec for an AI system that plays live music at Jewish weddings (generates multitrack arrangements, synthesizes instruments and singing voices incl. consented clones of real singers, transcribes existing songs). I need a short list of facts VERIFIED against primary sources (official docs, GitHub repos, statute text, official org pages). Use WebSearch/WebFetch. Do not write any files. Today is 2026-09-29.
>
> For each item, return: the verified fact in 1–2 sentences, the best primary-source URL, and a status: VERIFIED (you saw it on the source), PARTLY (some detail unconfirmed — say which), or UNCONFIRMED (couldn't reach/find). Be strict; don't mark VERIFIED from memory.
>
> 1. Demucs / HTDemucs (Meta, github facebookresearch/demucs): open-source music source separation; which stems (4 / 6-source model); license; is the repo still maintained or archived?
> 2. Spotify Basic Pitch (github spotify/basic-pitch): polyphonic audio-to-MIDI; license; does it output pitch bends?
> 3. Google Magenta MT3: multi-instrument transcription; license.
> 4. DiffSinger (github openvpi/DiffSinger): open-source singing voice synthesis; license; any real-time/streaming capability claims.
> 5. MIDI 2.0 per-note pitch and MPE (MIDI Polyphonic Expression) — MIDI Association pages: does each support microtonal/per-note pitch? Year MPE was adopted.
> 6. MTS-ESP (ODDSound) microtuning: what it is, licensing (free SDK?).
> 7. Tennessee ELVIS Act (2024): what it protects regarding voice/AI; effective date.
> 8. EU AI Act Article 50: transparency obligations for AI-generated/deepfake audio; when Article 50 applies.
> 9. JUCE framework current licensing (JUCE 8: AGPLv3 + commercial tiers; any free "Starter" tier and revenue limit).
> 10. OpenAI Whisper: are Hebrew and Yiddish in its supported language list?
> 11. Render.com: does Render offer GPU instances? (check official docs/pricing)
> 12. US public performance licensing: ASCAP/BMI position on music at weddings/private events in rented venues (whose responsibility — venue vs performer). Also Israel's ACUM for events. Keep it brief; flag it needs a lawyer.
> 13. RIAA/major-label lawsuits against Suno and Udio (June 2024) and any later settlements or licensing deals (2025–2026) — dates and parties.
> 14. Any existing products specifically for AI or automated Jewish wedding/simcha music (e.g., Jewish keyboard style packs for Korg Pa / Yamaha Genos, Jewish MIDI file vendors). Just list 2–5 real examples with URLs if found.
>
> Return a compact markdown table or list, under 900 words total. Note anything blocked by the network proxy.

Follow-up sent while it was running (verbatim):

> Two extra items to verify, same format (fact, primary URL, VERIFIED/PARTLY/UNCONFIRMED), added to your existing list:
> 15. DiffSinger / OpenUtau: does a multi-speaker DiffSinger voicebank support mixing/blending speakers (speaker-mix / timbre interpolation), and are the acoustic model (timbre) and variance model (pitch curve, duration, energy, breathiness, etc.) separate models? This matters for a "persona builder" that takes timbre from singer A and vibrato/ornament style from singer B.
> 16. Any commercial singing-synthesis product that exposes voice blending/mixing of multiple voices (e.g., Synthesizer V "voice mixing"/cross-lingual, ACE Studio voice blending) — official pages only.
> Keep the total answer under ~1100 words.

Note: the brief was written while the project was still scoped to Jewish weddings. The
facts apply unchanged to the current any-culture, any-event scope.

## Report (verbatim)

## Verified facts for the product spec (checked 2026-09-29)

**Network limits:** The egress proxy only let me reach github.com and raw.githubusercontent.com. It blocked midi.org, oddsound.com, juce.com, render.com, eur-lex, artificialintelligenceact.eu, digital-strategy.ec.europa.eu, tnsosfiles.com, capitol.tn.gov, riaa.com, wikipedia, ACE Studio docs, Dreamtonics docs and the vendor sites. ASCAP, BMI and ACUM also failed on direct fetch. Any item marked PARTLY that doesn't come from GitHub relies on search-result snippets, not on the page itself.

| # | Fact | Primary URL | Status |
|---|---|---|---|
| 1 | **Demucs.** MIT license. `htdemucs` gives 4 stems: drums, bass, vocals, other. `htdemucs_6s` adds guitar and piano; the README says piano "is not working great." facebookresearch/demucs was **archived Jan 1, 2025** and its README says it is "not maintained anymore." The author's fork calls itself "officially maintained" but also says "not actively working… no new feature." The fork tagged v4.1.0 on Jul 11, 2026. | github.com/facebookresearch/demucs ; github.com/adefossez/demucs | VERIFIED |
| 2 | **Basic Pitch.** Apache-2.0. Polyphonic and works with any instrument. Outputs "a MIDI file, complete with pitch bends." | github.com/spotify/basic-pitch | VERIFIED |
| 3 | **MT3.** A multi-instrument transcription model built on T5X, with a piano model and a multi-instrument model. Apache-2.0 (LICENSE file seen). | github.com/magenta/mt3 | VERIFIED. Maintenance status is not confirmed (the GitHub API was blocked). |
| 4 | **DiffSinger (OpenVPI).** Apache-2.0. Neither the README nor the docs (GettingStarted, BestPractices, ConfigurationSchemas) claim real-time or streaming output. Deployment points to OpenUtau, and to DiffScope, which is still in development. Plan for offline or pre-rendered vocals. | github.com/openvpi/DiffSinger | VERIFIED (I read the README and those three docs) |
| 5 | **MPE and MIDI 2.0.** MPE puts each note on its own channel, so pitch bend applies per note (default range 48 semitones). It was ratified Jan 28, 2018, with v1.1 in 2022. MIDI 2.0 has per-note pitch features (Note On pitch attribute, per-note pitch bend). | midi.org/mpe-midi-polyphonic-expression | PARTLY. midi.org was blocked, so this is from snippets. The MIDI 2.0 per-note and microtonal details are unconfirmed. |
| 6 | **MTS-ESP.** A free C/C++ library that adds microtuning to plugins: one master plugin sets the tuning for all connected client plugins. License is 0BSD ("use… for any purpose with or without fee"), so commercial use is fine. A master plugin needs the libMTS dynamic library, and ODDSound provides installers you can bundle. A client falls back to a local tuning table and can take MTS SysEx. ODDSound also offers a free master plugin, MTS-ESP Mini. | github.com/ODDSound/MTS-ESP | VERIFIED |
| 7 | **Tennessee ELVIS Act.** Adds "voice," real or simulated, to Tennessee's right-of-publicity law. It also creates liability for distributing a tool whose primary purpose is producing someone's voice or likeness without authorization. Signed Mar 21, 2024; effective Jul 1, 2024; Public Chapter 588. | publications.tnsosfiles.com/acts/113/pub/pc0588.pdf ; tn.gov/governor/news/2024/3/21/photos--gov--lee-signs-elvis-act-into-law.html | PARTLY. The statute text was blocked. The effective date and chapter number come from secondary snippets. |
| 8 | **EU AI Act Art. 50.** Applies from **2 Aug 2026**. 50(2): providers must mark synthetic audio in a machine-readable, detectable way. 50(4): deployers must disclose deepfake audio. The Commission's page says systems already on the market before 2 Aug 2026 get until **2 Dec 2026** for 50(2) only. | digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act | PARTLY. Snippets only. The grace-period wording and the reduced disclosure for artistic works are unconfirmed. |
| 9 | **JUCE.** The repo's LICENSE.md now points to the **JUCE 9** EULA, dual-licensed AGPLv3 plus commercial. Tiers per snippets: Starter is free up to $20k a year in revenue or funding, Indie up to $300k, Pro has no limit. A JUCE forum post says JUCE 9 has "no pricing or EULA changes." | github.com/juce-framework/JUCE/blob/master/LICENSE.md ; juce.com/get-juce | PARTLY. Dual license and JUCE 9 are verified; the tier limits come from snippets. |
| 10 | **Whisper.** The tokenizer's language list includes `"he": "hebrew"` and `"yi": "yiddish"` (99 languages). The README says accuracy "varies widely" by language; I didn't check Yiddish accuracy. | github.com/openai/whisper/blob/main/whisper/tokenizer.py | VERIFIED |
| 11 | **Render.** No GPU instances. Render's own articles advise sending GPU inference to providers like RunPod or Replicate. | render.com/pricing | PARTLY. render.com was blocked; this comes from Render-authored article snippets. |
| 12 | **Performance licensing.** ASCAP: the business that benefits gets the license, and that duty can't be shifted to hired musicians. BMI (hotels): ballrooms rented by a third party for private events count as non-public areas. **ACUM:** tariff T008 "Family Events" covers weddings, bar mitzvahs and hennas; 351 NIS incl. VAT per event, arranged up to 72 hours ahead. It holds the hall owner, the DJ or singer, and the organizer responsible. **Needs a lawyer** on whether a private wedding is a "public performance" at all, and on how an AI performer is treated. | ascap.com/help/ascap-licensing ; bmi.com/licensing/entry/hotels_motels ; acum.org.il/en/tariff-public-performance/parties/ | PARTLY (snippets only) |
| 13 | **Suno and Udio lawsuits.** Jun 24, 2024: UMG, Sony and Warner sued Suno in D. Mass. and Udio in S.D.N.Y., coordinated by the RIAA. UMG settled with Udio and signed a license (late Oct 2025). WMG settled with Udio (Nov 2025, dismissal ~Nov 25) and with Suno (Nov 2025; Suno also bought Songkick). Sony has not settled with Udio and filed a second suit in 2026 over about 30,117 recordings. UMG and Sony filed a second suit against Suno in 2026 over its v6 model (60,202 recordings). | riaa.com (blocked); variety.com/2024/music/news/record-labels-sue-ai-music-services-suno-and-udio-copyright-infringement-1236045366/ | PARTLY. Secondary press only, and the exact 2025–26 dates are unconfirmed. One snippet claimed Sony settled with Udio; several others contradict it. |
| 14 | **Existing Jewish simcha music products.** None of these is AI-based. Jewish Beats USA sells Korg Pa and Yamaha simcha beats. MZF Productions sells Jewish Yamaha beats, including freilach. Kosher Music Organization sells "Hora Beats for Yamaha Keyboards." The Yamaha shop lists "Traditional Jewish Favorites" as a download. MIDIdb has Jewish MIDI files. | jewishbeatsusa.com ; mzfproductions.com ; koshermusic.org/products/hora-beats-for-yamaha-keyboards ; shop.usa.yamaha.com/en/p/downloadables/traditional-jewish-favorites-7 ; mididb.com/jewish/ | UNCONFIRMED. These are search results only; every site was blocked. |
| 15 | **DiffSinger model split and speaker mixing.** The acoustic model (timbre) and the variance model are **separate**. The acoustic model turns phonemes, durations and F0 into a mel spectrogram, and a multi-speaker one can "use different speakers in the same model, or mix their timbre and style." The variance model predicts durations, the pitch curve, and energy, breathiness, voicing and tension, and "support[s] multi-speaker settings like acoustic models do." `infer.py --spk` accepts a "Speaker name or mixture of speakers." | github.com/openvpi/DiffSinger/blob/main/docs/BestPractices.md ; .../scripts/infer.py ; github.com/openutau/OpenUtau/wiki/DiffSinger-support | VERIFIED for DiffSinger. One inference, not documented: a persona built from A's timbre and B's pitch/ornament style is possible if both singers are in the same trained multi-speaker models. Speakers can't be mixed across separately trained models. OpenUtau's page confirms only "voice color curves" (gradual changes between a voicebank's vocal modes); speaker mixing in OpenUtau is unconfirmed. |
| 16 | **Commercial singing tools with voice blending.** ACE Studio's "Voice Blending" combines several voice seeds from the same model version, with a ratio fader per voice and savable presets; it also has VoiceMix. Synthesizer V Studio 2 Pro can assign separate vocal modes to pitch, timbre and pronunciation *within one voice*, and its Unison feature layers up to 16 voices. I found no blending of timbre across different Synthesizer V voices. | docs.acestudio.ai/ai-vocal-synth/creating-ai-vocals/voice-blending ; dreamtonics.com/synthesizerv/ | PARTLY (snippets only; both doc sites were blocked) |

To confirm the PARTLY and UNCONFIRMED rows, someone needs to open those pages directly or allow those domains on the proxy.
