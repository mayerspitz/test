# ZoneMix roadmap

Each phase ends with something you can see working. Build only as far as the answers in [OPEN_ITEMS.md](OPEN_ITEMS.md) justify.

## Phase 0: design and core engine ✅ (done, 30 Sep 2026)

- The whole-system design ([DESIGN.md](DESIGN.md)), hardware lists ([HARDWARE.md](HARDWARE.md)) and ready-made alternatives ([ALTERNATIVES.md](ALTERNATIVES.md)).
- The control engine:
  - sets all zones together, allowing for spill between them;
  - learns room drift and crowd noise;
  - ambient compensation;
  - speech ducking;
  - scene fades;
  - safety limiter and 15/60-minute budget;
  - plain-English alarms.
- X32/M32 and X Air network driver, sensor receiver, calibration maths, delay suggestions from the floor plan.
- A venue simulator and a 24-minute wedding-evening scenario. Auto zones hold their target to about 0.5 dB on average (90% of the time within 1.1 dB) while the room fills, the crowd gets louder, speeches interrupt and the band creeps 7 dB louder.
- 52 automated tests.

**Not yet proven:** anything on real hardware.

## Phase 1: working controller on a real mixer

1. **Controller service.**
   - Engine + mixer driver + sensor receiver, running every 100 ms.
   - Subscribes to mixer meters.
   - Detects a lost mixer.
   - Logs every second.
   - Starts with one command, and self-checks on start (mixer reachable? sensors heard? config valid?), explaining any problem in plain English.
2. **Mixer-input sensors.** Wired measurement mics on spare mixer inputs count as sensors (pilot kit, HARDWARE §2).
3. **Web app** (phone-first, installable to the home screen):
   - zone tiles with live level vs target;
   - scene buttons;
   - per-zone auto / limit-only / manual;
   - alarms;
   - a big "hold everything" button;
   - **advisory mode**, where ZoneMix shows what it would change but does not touch the mixer.
4. **Calibration wizard.** Pink noise per zone, the table written into the venue file, and warnings shown.
5. **Config editor** in the web app: zones, scenes and mixes, without editing JSON.
6. **Compliance report.** Leq per zone per 15 and 60 minutes, as CSV or a page.
7. **Online demo** of the web app driven by the simulator, so you can try it on your phone before any hardware.

**Exit test:** on a bench with your mixer and two rooms (or two speakers far apart), ZoneMix holds each room at its target while you play music and make noise, and the alarms fire when you unplug a speaker or a sensor.

## Phase 2: ZoneMix sensor nodes

- **Firmware:** I²S capture, dB(A)/dB(C) Leq, UDP broadcast, setup page, network updates.
- **Hardware:** PoE board + ICS-43434, 3D-printed enclosure, stand/clamp mount.
- **Sensor calibration procedure.** Check against a class-2 meter: within ±1 dB(A) from 45 to 110 dB(A).

**Exit test:** five nodes powered from one PoE switch, reporting for 8 hours without dropping out.

## Phase 3: pilot event

- Soundcheck: ring out, set gain ranges, run calibration.
- First half in advisory mode, second half automatic.
- Keep the logs. Tune defaults from the real data: speeds, ambient slopes, duck depths.
- Write down what the engineer overrode, and why.

**Exit test:** the engineer would rather have it on than off.

## Phase 4: advanced

- **Sensors that stream audio** (or network mics), enabling:
  - each source's real level per zone, by correlating the room sound with each channel;
  - automatic per-zone EQ;
  - measured delays;
  - feedback detection with an automatic notch or pull-down.
- **More mixers:** Behringer WING, Allen & Heath (SQ/dLive), Yamaha (TF/CL/QL/DM3), and Q-SYS as a zone processor.
- **Multi-venue presets** and a cloud archive of event reports.

## Phase 5: product (only if you want to sell it)

- Custom sensor PCB.
- CE/FCC testing.
- Injection-moulded enclosure.
- Installer app.
- Support and documentation.
