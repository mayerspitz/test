# Research notes

Checked 2026-09-30.

- **V**: the primary source or its code was read.
- **S**: seen only in a search-engine snippet of the cited page, because the sandbox's proxy blocked most non-GitHub sites. Confirm S items before relying on them.

## Mixer control

**Main sources**
- [X32PDF] Patrick-Gilles Maillot, *Unofficial X32/M32 OSC Remote Protocol* v4.06-09. GitHub copy: https://github.com/JoueBien/X32-OSC-Workbench/blob/master/x32%20osc%20guide/UNOFFICIAL_X32_OSC_REMOTE_PROTOCOL.pdf
- [PM] https://github.com/pmaillot/X32-Behringer

**X32 / M32**
- **V** UDP port 10023. Replies go to the sender's address. [X32PDF p.7]
- **V** Addresses, all float 0..1 [X32PDF pp.27–35; PM X32Channel.h, X32Bus.h]:
  - channel fader: `/ch/NN/mix/fader`;
  - channel on: `/ch/NN/mix/on` (int);
  - channel-to-bus send: `/ch/NN/mix/BB/level` (161 steps);
  - bus fader: `/bus/BB/mix/fader`;
  - matrix fader: `/mtx/NN/mix/fader`;
  - main: `/main/st/mix/fader`.
- **V** `/xremote` subscribes to updates for 10 s. Renew about every 9 s. At most 4 clients. [X32PDF p.10; PM X32Automix.c]
- **V** Meters:
  - Request: `/meters ,siii "/meters/N" …`. Updates every 50 ms for 10 s.
  - The blob holds a little-endian int32 count, then little-endian float32 values; linear, 1.0 = 0 dBFS.
  - `/meters/1`: 32 channels + gate GR + dynamics GR.
  - `/meters/2`: 16 buses, 6 matrices, LR, M/C, and more. [X32PDF pp.17–18]
- **V** Fader law, four segments:
  - f ≥ 0.5 → 40f − 30;
  - f ≥ 0.25 → 80f − 50;
  - f ≥ 0.0625 → 160f − 70;
  - otherwise 480f − 90 (−∞ at f = 0).
  - Faders have 1024 steps, sends 161. [X32PDF p.133]
- **V** Built-in Dugan-style automix on channels 1–8: `/ch/NN/automix/group`, `/ch/NN/automix/weight`. [X32PDF p.27]

**X Air (XR12/16/18, MR18)**
- **V** UDP port 10024.
- **V** Addresses:
  - `/ch/01/mix/fader`;
  - sends `/ch/01/mix/01…10/level`;
  - bus fader `/bus/1/mix/fader` (bus number not zero-padded);
  - `/lr/mix/fader`;
  - no matrix.
- **V** Same fader law. [PM XAirSetScene*.c; https://github.com/onyx-and-iris/xair-api-python]
- **V** Meters are little-endian int16 in 1/256 dB, not floats. [PM issue #8; https://github.com/notameadow/xair-osc]

**Other mixers**
- **V** Behringer WING:
  - OSC on UDP 2223; native protocol on TCP 2222;
  - one OSC subscription at a time;
  - faders take dB directly (`/ch/1/fdr`, `/bus/1/fdr`).
  - [WING Remote Protocols V3.1.0, GitHub copy: https://github.com/tubeslave/AUTO-MIXER-Tubeslave]
- **S** Allen & Heath:
  - SQ and Qu: MIDI over TCP 51325;
  - dLive: TCP 51328.
  - [allen-heath.com protocol documents]
- **V** Yamaha TF/CL/QL: RCP text over TCP 49280 (community documentation). https://github.com/BrenekH/yamaha-rcp-docs
- **S** Yamaha DM3: official OSC on UDP 49900.
- **V** Soundcraft Ui24R: undocumented WebSocket. https://github.com/fmalcher/soundcraft-ui

## Sensors

**Microphones**
- **S** ICS-43434: −26 dBFS at 94 dB SPL, SNR 65 dB(A), overload 120 dB SPL, 60 Hz–20 kHz, 24-bit I²S. https://cdn-shop.adafruit.com/product-files/6049/6049_DS-000069-ICS-43434-v1.2.pdf
- **S** INMP441: SNR 61 dB(A), flat to 15 kHz; widely called obsolete.
- **V** Open-source ESP32 sound level meter with correction EQ for these mics; claims ±1 dB(A). https://github.com/ikostoski/esp32-i2s-slm
- **S** Adafruit ICS-43434 breakout #6049: $8.95.

**Boards**
- **V** Olimex ESP32-POE-ISO: IEEE 802.3 PoE, isolated. Free GPIOs: 4, 5, 13, 16 (WROOM only), 32, 33, 36 (input only). 2 W for external loads. https://github.com/OLIMEX/ESP32-POE-ISO
- **S** Olimex ESP32-POE-ISO costs about $29 (Digi-Key).
- **V** ESP32-C5: I²S, Wi-Fi 6, 5 GHz. [esp-idf soc_caps.h]
- **S** ESP32-C5-DevKitC-1: about $15.

## Prices

All **S**; US retail, Sept 2026.

- **Mixers**
  - X32 Compact $1,649;
  - X32 Rack $989;
  - XR18 $509;
  - M32R Live about $3,300;
  - WING Rack from about $1,285.
- **Controller**
  - Raspberry Pi 5 8 GB about $200 after the 2026 memory-driven price rises (https://www.raspberrypi.com/news/more-memory-driven-price-rises/);
  - N100 mini PC 16/512 GB $290–400.
- **Measurement mics**
  - ECM8000 $25.90;
  - EMM-6 $70–125;
  - UMIK-1 $79–140.
- **Calibrators**
  - generic SC-05 class 2 about $155;
  - Extech 407766 $370–520.
- **Network**
  - TL-SG1008P $99, but only 4 PoE ports;
  - TL-SG1210P has 8 PoE+ ports, 63 W (price not found);
  - U6+ $129;
  - EAP650 $80–142.

## Ready-made alternatives

All **S** unless marked.

**Ambient noise compensation**
- Q-SYS Ambient Compensator (continuous and gated; any mic input). https://help.qsys.com/Content/Schematic_Library/ambient_compensator_continuous_2.htm
  - Core Nano about $2,190;
  - Core 8 Flex about $1,800.
  - Lua scripting on the Core. QRC control API on TCP 1710.
- Biamp Tesira ANC ("automatic adjustment of zone level based on the ambient noise level"); TesiraFORTÉ AI about $2,988. https://tesira-help.biamp.com/Component_Objects/Audio/Input_Output/ANC_Input.htm
- BSS Soundweb London: gap and non-gap ANC; BLU-100 about $3,600.
- Symetrix "SPL Computer", including a gap-sensing version; Radius NX 12x8 $4,164–4,757.
- AtlasIED Atmosphere AZM4/AZM8 (4/8 zones) with the X-ANS network noise sensor; AZM8 about $2,307. https://www.atlasied.com/x-ans
- Yamaha MRX7-D: gap-type ANC and a Dugan automixer component.
- Bose ControlSpace ESP: "AutoVolume" with an ANC sense mic.

**Event tools**
- 10EaZy: IEC-compliant SPL monitoring; the engineer adjusts by hand.
- Meyer Galileo GALAXY and d&b DS100: processing and spatial rendering; no closed-loop level control found.
- Formula Sound Sentry: single-zone noise limiter.

**Built-in automixers**
- **V** X32 (channels 1–8);
- **V** WING;
- Yamaha CL/QL (8/16 ch), TF (8 ch, V3.5+), DM3 (8 ch, V3.0+);
- Allen & Heath SQ/dLive AMM.

**Not found:** any product using sensors spread through a venue to adjust per-zone live mixes. Not finding one does not prove none exists.

## Sound limits (examples)

All **S**.

- **WHO Global Standard for Safe Listening Venues and Events** (2022): at most 100 dB LAeq over 15 min. https://www.who.int/publications/i/item/9789240043114
- **Switzerland (V-NISSG, SR 814.711)**
  - Hourly LAeq categories: 93, 96 and 100 dB(A).
  - Above 93: free earplugs and audience warning.
  - At 100 for more than 3 h: a quiet zone is required.
  - LAFmax at most 125 dB(A).
- **EU Directive 2003/10/EC and UK Noise at Work Regulations 2005** (staff exposure)
  - Action values 80 and 85 dB(A) LEX,8h; limit 87.
  - Peak values 135, 137 and 140 dB(C).
