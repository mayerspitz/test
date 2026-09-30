# ZoneMix design

How the whole system fits together, from the sensor in the room to the fader on the mixer.
Hardware and prices: [HARDWARE.md](HARDWARE.md). Build order: [ROADMAP.md](ROADMAP.md).
Ready-made alternatives: [ALTERNATIVES.md](ALTERNATIVES.md).

## 1. What it does

At an event the venue is split into **zones**, areas with their own speakers (dance floor, dining left and right, bar, foyer). For each zone and each **scene** (reception, dinner, speeches, dance) you set:

- **How loud** the zone should be, as a target level in dB(A) where people listen.
- **What it plays**: a level per source group (speech mics, vocals, band, playback), with an optional trim per mic or instrument.
- **Limits**: the loudest 1-second level allowed, and optionally an average over 15 or 60 minutes (the kind of limit written into venue rules and some laws).
- **Behaviour**: whether to rise with crowd noise and by how much, whether to duck music when someone speaks, and whether the zone is automatic, limit-only (you set the level; ZoneMix only enforces limits) or manual.

A small sensor in each zone measures what guests actually hear. A controller compares that with the targets and continuously adjusts each zone's mix on the digital mixer. The engineer mixes the sources as usual (channel faders, EQ, effects); ZoneMix looks after the zones.

## 2. The two decisions everything else follows from

### 2.1 Put the sensor where people listen, not on the speaker

A sensor fixed to a speaker hears that speaker's output: 10–20 dB louder than the audience hears, and blind to crowd noise, to other zones' sound spilling in, and to the room filling up with people. So:

- **Control sensor** (one per zone, two for big zones): in the listening area at ear height (1.2–1.7 m), about half to two-thirds of the way into the zone's coverage. At least 2–3 m from any speaker, away from walls, the bar's machines and the kitchen door, and not on a table where someone will talk right into it. Mount it on a mic stand, a pillar or truss clamp, or a table centrepiece.
- **Speaker-mounted piece** (optional, later): useful only as a health check, to tell you a speaker is actually producing sound. The control sensors already catch a dead zone (the "sounds quieter than calibrated" alarm), so this is not needed for v1.

### 2.2 The controller must know what the mixer is sending

A microphone in the room cannot tell music from crowd, or this zone's speakers from the zone next door. A controller that only turns a zone up when the sensor reads low and down when it reads high fails at every event:

- **A louder crowd turns the music down.** The sensor reads higher, so the controller cuts the zone, exactly when guests need more.
- **Neighbouring zones fight.** Turning up the dining zone raises the reading at the bar sensor, the bar turns down, and so on.
- **It pumps with the music.** Quiet songs get pushed up, loud ones get pushed down.

So ZoneMix reads the mixer's channel meters, which tell it exactly what is being played into each zone at every moment, and keeps a **room model**: how loud each sensor hears each zone per dB sent to it, measured by an automatic calibration. With the model it can:

- separate program from crowd noise and learn both continuously (§5.3);
- account for spill between zones and set all the zones together (§5.2);
- hold a steady level over time, following the typical level of the content rather than every loud or quiet bar.

## 3. System overview

```
 sources            DIGITAL MIXER (X32 / M32 / X Air)                 zones
 ───────            ─────────────────────────────────                 ─────
 speech mics ─┐     channels ─► sends (per zone, per group) ─► bus 1 ─► amp/speakers: dance floor
 vocals      ─┼──►  (engineer    set by ZoneMix per scene     ─► bus 2 ─► amp/speakers: dining left
 band        ─┤      mixes as    and ducking                  ─► bus 3 ─► amp/speakers: dining right
 playback/DJ ─┘      usual)                                   ─► bus 4 ─► amp/speakers: bar
                         ▲  meters                   faders   ─► bus 5 ─► amp/speakers: foyer
                         │  (OSC/UDP)                  ▲
                         │                             │ (OSC/UDP)
                 ┌───────┴─────────────────────────────┴───────┐
                 │ ZONEMIX CONTROLLER  (mini PC / Raspberry Pi) │◄── phone/tablet web app
                 │ engine · mixer driver · sensor gateway · log │    (scenes, levels, alarms)
                 └───────▲─────────────────────────────────────┘
                         │ JSON over UDP, 4–10 per second
          ┌──────────────┼──────────────┬──────────────┐
      sensor (dance)  sensor (dining L) sensor (bar)  sensor (foyer) …   one per zone, PoE or Wi-Fi
```

**Mixer routing.** Each zone gets one mono **mix bus** with **post-fader** sends, so the engineer's channel faders still move everything. The bus feeds that zone's amplifier or powered speakers, optionally through speaker processing for EQ and delay (§5.8). ZoneMix owns two things: the channel-to-zone **sends** and the zone **bus faders**. Everything else stays with the engineer. If the controller stops, the mixer keeps the last values: nothing goes silent and nothing jumps.

**Bus budget.** An X32 or M32 has 16 mix buses: zones plus stage monitors. An X Air (XR18/MR18) has 6, so 3–4 zones plus a couple of monitor mixes.

## 4. Configuration

One venue file (JSON; an editor in the web app comes in Phase 1). A complete working example is [config/example-venue.json](../config/example-venue.json). In outline:

| Section | Holds |
|---|---|
| `groups` | Source groups: `speech`, `vocals`, `band`, `playback`, … |
| `channels` | Mixer input number, group, trim in dB, typical level |
| `zones` | Mixer bus, sensor ID, mode (`auto` / `limit-only` / `manual`), gain range, 1 s limit, optional Leq limit, ambient compensation, ducking, speaker and listener positions |
| `scenes` | Per zone: target dB(A) (auto) or bus level (limit-only/manual), plus a mix level per group; fade time |
| `calibration` | The room model: dB at each sensor per 0 dBFS on each zone's bus. Written by the calibration run |
| `control` | Timing and safety constants (sensible defaults) |

The loader checks everything and lists **all** problems in plain English at once, e.g. *"Zone bar: gainRangeDb goes up to 12 dB, but mixer faders stop at +10 dB."*

## 5. How the control works

All of this is in [`src/engine/`](../src/engine), is plain computation (no clocks or sockets), and is covered by the tests and the simulator.

### 5.1 Every 100 ms

1. Read the channel meters (post-fader, dBFS) and the latest sensor readings (dB(A)).
2. **Speech priority.** If a speech mic is above its threshold, zones set to duck lower their music sends (for example 10 dB, 0.5 s attack, 3 s release, 1.5 s hold).
3. **Sends.** Each channel's send to each zone = the scene's level for the channel's group + the channel trim − ducking. Scene changes fade over the scene's fade time.
4. **Program reference.** For each zone, the level its target refers to: the loudest group in its mix at its typical level, or the sum of the groups actually playing if that is higher. A quiet background group playing alone is therefore not pushed up to the target, and an unused mic does not count.
5. **Targets.** Scene target + ambient boost (§5.4), capped by the Leq budget (§5.5) and kept 3 dB under the 1 s limit.
6. **Solve** all auto zones' gains together (§5.2).
7. **Smooth.** Gains move at most 0.5 dB/s up and 2 dB/s down (6 dB/s while a scene change fades in).
8. **Limit.** The safety limiter acts on what the sensor measures (§5.6).
9. **Send changes only.** Bus gains move in steps of at least 0.2 dB, sends of at least 0.1 dB.

### 5.2 Setting all zones together (spill-aware)

With the calibration table `H[sensor][zone]` and gains `g`, the program level at a sensor is a power sum over **all** zones:
`P_s = Σ_z 10^((ref_z + g_z + H[s][z] + drift_s)/10)`.
Writing `p_z = 10^(g_z/10)`, that is linear in `p`, so meeting every zone's target at once is a bounded least-squares problem. Errors are measured relative to each target, so a quiet foyer counts as much as a loud dance floor. Result:

- A dining zone next to a loud dance floor gets less from its own speakers, because it already has sound spilling in.
- If spill alone is over a zone's target, its speakers go to minimum and it reports **"louder than target from sound arriving from Dance floor"**.

### 5.3 Learning the room while the event runs

Every second, for each sensor, ZoneMix compares `q`, what the model predicts from what the mixer sent, with `m`, what the sensor measured. It fits `m ≈ a·q + n` over the last minute:

- **`a`, drift.** The room passes more or less sound than at calibration: people absorb it, a door opens, a speaker gets bumped. ZoneMix corrects up to ±6 dB. Beyond ±12 dB it raises an alarm: speaker off or unplugged, the sensor moved, or another sound system is playing.
- **`n`, ambient noise.** Crowd, bar, kitchen. It is only updated when the fit pins it down, which in practice means quiet passages and the gaps between songs. Otherwise it holds its last value, like the "gap" ambient-noise compensators in installed systems.

In simulation, the drift estimate lands within 0.1 dB of the true 2 dB change, and the noise estimate within about 3 dB.

### 5.4 Ambient compensation

`boost = slope × (noise − threshold)`, between 0 and a maximum. For example, a bar with threshold 60 dB(A), slope 0.6 and maximum +6 dB: a 70 dB(A) crowd lifts it 6 dB, a quiet bar leaves it alone. The maximum matters: if a DJ's own speakers play in the bar, ZoneMix must not escalate against them.

### 5.5 Loudness limits

- **1-second limit** per zone: enforced by the safety limiter.
- **Leq limit** (for example 100 dB(A) over 15 min, as in the WHO Safe Listening standard): a rolling energy budget. ZoneMix computes the highest steady level allowed for the next minute that keeps the window average under the limit, and caps the target there. Limit-only zones (typically the dance floor with the main PA) are held back the same way.
- Every second is logged, so a compliance report per zone can be produced afterwards (Phase 1).

### 5.6 Safety

- **Gain range per zone.** The top of the range is the level found free of feedback when ringing out at soundcheck, minus 3 dB. Auto gain never exceeds it; this is the main protection against feedback when zones rise with open mics.
- **Fast limiter.** If a zone measures over its 1 s limit, it is cut at 6 dB/s and released slowly. It stops cutting once the zone's own speakers are 10 dB under what spills in from elsewhere, since further cuts would not help. The alarm then names the neighbour to turn down.
- **Graceful degradation.**
  - Sensor silent for 3 s: that zone runs on its room model, with an alarm.
  - Mixer unreachable: the mixer keeps its last values (Phase 1 adds the alarm).
  - Controller stops: nothing changes on the mixer.
- **Operator control.** Per-zone mode (auto / limit-only / manual) and scene buttons. Phase 1 adds a big "hold everything" button and advisory mode, where ZoneMix only suggests changes.

### 5.7 Calibration (about 5 minutes at soundcheck, automatic)

1. Everything quiet: measure each sensor's background.
2. For each zone in turn: pink noise into its bus at a known level, while **every** sensor listens.
3. Subtract the background to get the `H` table. It flags a sensor that cannot hear its own zone (wiring) and a sensor that hears another zone louder than its own (placement).

The planning and maths are done ([`calibration.js`](../src/engine/calibration.js)). Running it against a real mixer is Phase 1: pink noise from the mixer's oscillator or a playback channel.

### 5.8 Time alignment

A fill speaker is closer to its listeners than the main PA, so its sound arrives first and pulls the image away from the stage. From the floor plan (speaker and listener positions), ZoneMix suggests each zone's delay: arrival difference + 10 ms. The example venue gives dining 51 ms, bar 89 ms and foyer 104 ms. Delays are set once per venue on the mixer outputs or the speakers' DSP. Phase 4 can measure them acoustically.

## 6. Sensor nodes

| | Choice | Why |
|---|---|---|
| Microphone | TDK ICS-43434 MEMS, I²S | −26 dBFS at 94 dB SPL, 65 dB(A) SNR, 120 dB SPL overload, 60 Hz–20 kHz. Good for 45–110 dB(A) listening areas. |
| Processor | ESP32 (Olimex ESP32-POE-ISO for wired; ESP32-C5 for 5 GHz Wi-Fi) | I²S input; enough CPU for weighting filters and Leq. |
| Power + network | PoE on one Cat6 cable (preferred), or USB power bank + Wi-Fi for small events | At events hundreds of phones crowd 2.4 GHz Wi-Fi, so cable is far more reliable. |
| Firmware | Built from the open-source [esp32-i2s-slm](https://github.com/ikostoski/esp32-i2s-slm) approach | Already does A/C weighting and equalisation for these mics, reportedly ±1 dB(A). |
| Output | 4–10 JSON datagrams per second, UDP broadcast to port 7700 | Zero configuration on one network; losing a packet is harmless. |

Packet: `{"v":1,"id":"s-bar","seq":812,"up":203114,"laeq":71.4,"lceq":78.0,"lzpeak":96.2}`. The gateway ([`src/sensors/gateway.js`](../src/sensors/gateway.js)) drops late and duplicate packets, notices reboots, and counts losses.

**Calibration of the sensor itself.** Once, on the bench, next to a 94 dB SPL calibrator or a class-2 sound level meter with pink noise; the offset is stored in the node. MEMS mics are consistent (±1 dB), so this is quick.

## 7. Controller software

| Part | Status |
|---|---|
| Engine: solver, estimator, targets, limits, ducking, scenes | Built, tested (Phase 0) |
| Venue config loader with plain-English checks | Built, tested |
| Calibration maths and plan | Built, tested |
| Floor-plan delay suggestions | Built, tested |
| X32/M32 + X Air driver (OSC over UDP: faders, sends, keep-alive, meter decoding) | Built, tested against a simulated mixer; **not yet against real hardware** |
| Sensor UDP gateway | Built, tested |
| Venue simulator + wedding-evening scenario | Built |
| Service that wires it all together, meter subscription, mixer-loss detection | Phase 1 |
| Web app (phone-first, installable): zones, live levels, scene buttons, alarms, hold, advisory mode, config editor, calibration wizard | Phase 1 |
| Event log + compliance report | Phase 1 |
| Sensor firmware | Phase 2 |
| More mixers (WING, Allen & Heath, Yamaha), Q-SYS | Phase 4 |

**Stack.** Node.js 22 with no third-party dependencies: installing is a single command, and the web app and controller share one language. It runs **on site**, because venues often have no dependable internet. A cloud copy is only for demos and post-event reports, never in the live control path.

## 8. Network

- One show network, no internet needed.
- The PoE switch carries the controller, the mixer, the sensor nodes (PoE) and a Wi-Fi access point.
- The controller hands out addresses (DHCP), so no router is needed.
- Wi-Fi uses 5 GHz only, for the operator's phone or tablet on its own SSID.
- Fixed addresses for the mixer and controller.

## 9. What v1 does not do (honest limits)

- **Balance within a zone is set, not measured.** One mic in a room cannot tell the guitar from the vocal, so the per-source mix in each zone comes from your scene settings. ZoneMix does adjust each zone's overall level, ducking, noise compensation and limits. Measuring each source's actual contribution is possible later: the sensor streams audio, which is correlated with each channel's known signal (Phase 4, R&D).
- **Tone (EQ) is not corrected automatically** in v1; it needs the same audio streaming. Set each zone's EQ once at soundcheck.
- **Everything is proven in simulation only so far.** No real mixer, sensor or room has been tested yet; that is Phase 1.
