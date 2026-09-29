# Legal and rights map

**This is not legal advice.** It maps the legal areas this product touches, what we will
build to handle each one, and what a lawyer must decide. Use it to brief counsel in each
launch country (P3). Sources and their verification status are in
[history/RESEARCH_NOTES.md](history/RESEARCH_NOTES.md).

## 1. The areas at a glance

| # | Area | Why it applies | What we build | Counsel decides |
|---|---|---|---|---|
| L1 | **Voice and likeness (right of publicity)** | We clone and blend real people's voices and named styles | Consent registry, per-trait scopes, refusal to render without consent, watermarks, logs | Talent agreement wording per country; whether named *style* traits (not timbre) need a license everywhere |
| L2 | **Tool-maker liability** | Tennessee's ELVIS Act (2024) covers simulated voices and targets tools whose primary purpose is producing a person's voice without authorization | Consent-gated rendering by design; anti-impersonation matching; takedowns | Whether our design and marketing keep us clear, state by state |
| L3 | **Biometric data** | Voiceprints used to identify people (our registry matching, liveness checks) are biometric data under GDPR and some US state laws | Explicit consent before any voiceprint processing; retention and deletion policy; data minimization | Which laws apply per launch market; consent wording; retention periods |
| L4 | **Song copyright** (compositions and lyrics) | Most popular songs belong to living rights holders; our arrangements are derivative works | Rights status on every catalog entry; a public-domain and commissioned catalog first | Arrangement rights; whether a stored AI arrangement needs publisher permission |
| L5 | **Public performance licensing** | Songs played at events | Per-event license check and fee line in pricing | Who holds the license: venue, host or us as "performer". ASCAP says the business that benefits holds it. BMI treats ballrooms rented for private events as non-public. Israel's ACUM has a per-event "family events" tariff |
| L6 | **Sound recordings as source material** | Extracting stems and transcriptions from commercial recordings | Extraction only from material we have rights to, or that users upload with warranties for their own event | Whether any extraction from commercial recordings is allowed per country. The major labels sued Suno and Udio in 2024; some later settled with licenses |
| L7 | **Performers' rights in our own recordings** | We record talent to build their models | Session agreements with every recording | Neighboring-rights terms per country |
| L8 | **AI transparency** | EU AI Act Article 50 has applied since 2 Aug 2026: synthetic audio needs a machine-readable mark, and deepfakes must be disclosed | Watermark on every output; "AI performance" labels in the app, receipts and exports | Whether hosts must tell guests at a live event; other countries' labeling rules |
| L9 | **Minors** | Children's voices (kids' choirs); child users | Guardian consent, time-limited licenses, age gates | Age thresholds per country (e.g. COPPA in the US) |
| L10 | **Platform and user uploads** | Users upload recordings, samples and references | Upload rules, anti-impersonation checks, notice-and-takedown workflow, repeat-offender bans | Safe-harbor setup (e.g. a DMCA agent in the US); EU Digital Services Act duties |
| L11 | **Marketplace payments and tax** | Talent and creators earn money | A payments provider that handles identity checks, payouts and tax forms | Tax reporting per country, VAT on digital sales, platform reporting rules |
| L12 | **Existing talent contracts** | Talent may have exclusive label deals or union terms covering AI | Warranties in the talent agreement; a check at onboarding | Union AI terms (e.g. SAG-AFTRA in the US); label exclusivity |
| L13 | **Deceased performers** | Estates may want to license a late singer's voice | Estate consent flow | Post-mortem publicity rights per state or country |
| L14 | **Trademarks** | Product name; talent names in marketing | Name search before branding (P18) | Clearance |

## 2. Talent agreement: key terms (outline for counsel)

1. **Identity:** verified identity of the talent (and guardian, for minors).
2. **Grant:** a non-exclusive **license** of specific listed traits (timbre, vibrato,
   named ornaments…). Never a transfer of ownership.
3. **Scope matrix per trait:** use types (preview, promo, live event, recording/export,
   commercial), event types, regions, duration, whether blending is allowed, and whether
   the talent is named or anonymous.
4. **Money:** revenue share or price, minimums, caps on free and promo use, reporting,
   payout schedule, audit rights.
5. **Approval:** the talent approves each trait before it goes live, and can listen to
   example blends.
6. **Content limits:** things the talent's voice may never be used for (the talent picks
   categories, e.g. political, explicit, particular religious contexts).
7. **Revocation:** notice period, what happens to events already booked, and a deadline
   for removal from the shared trait models. Removing one voice from a jointly trained
   model may require retraining, so the timeline must be realistic.
8. **Warranties:** the talent has the right to grant this (no conflicting exclusive
   deals); union status disclosed.
9. **Data:** how recordings are stored and secured, biometric consent, deletion on exit.
10. **Watermarking and monitoring:** the talent can see every use of their traits.
11. **After death:** whether the license continues and who controls it.
12. **Disputes and governing law.**

## 3. User terms: essentials

- Upload only what you have the rights to. **Never upload someone else's voice as your
  own.** Uploads are style references unless you complete the own-voice opt-in (P14).
- Persona use follows each contributor's terms, and the app enforces them.
- The event license covers stated uses only. Exports and recordings are separate.
- Hosts accept any disclosure duties at their event (L8), and the app provides the
  wording.
- Indemnity, takedown process, account bans for impersonation.

## 4. Next steps

1. Pick the launch countries (P3). Law differs a lot by country.
2. Brief an entertainment and IP lawyer in each launch country with this document.
3. Answer L4–L6 before bulk ingestion of any commercial catalog.
4. Answer L1–L3 before recording or cloning the first talent.
