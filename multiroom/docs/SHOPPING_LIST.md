# What to order (Amazon US, September 2026)

This is for the chosen design: **one central Raspberry Pi**, **one USB Bluetooth adapter per speaker** on a powered hub, music on a **500 GB SSD**, and the Pi on 5 GHz Wi-Fi.

Order the **pilot** first (3 adapters). Then add adapters, up to 10, once the 3 farthest speakers play reliably.

Prices are typical, not checked live on Amazon. Search each name; the model numbers pin down the exact item.

| # | Item | Search Amazon for | Qty | ≈ Each |
|---|---|---|---|---|
| 1 | **Raspberry Pi 5, 4 GB** (your choice) | `Raspberry Pi 5 4GB SC1112` | 1 | $110 |
| 2 | Official 27 W USB-C power supply for Pi 5 | `Raspberry Pi 27W USB-C Power Supply SC1153` | 1 | $13 |
| 3 | Official Pi 5 case (built-in fan) | `Raspberry Pi 5 Case SC1159` | 1 | $11 |
| 4 | microSD 32 GB A2 (for the operating system) | `SanDisk Extreme 32GB microSD A2` | 1 | $12 |
| 5 | **500 GB portable SSD** (the music) | `Samsung T7 500GB MU-PC500T` | 1 | $80 |
| 6 | **Powered USB hub, 10 ports**, own 12 V adapter | `Plugable USB3-HUB10C2` (alternative: `Sabrent HB-BU10`) | 1 | $65 |
| 7 | **Bluetooth adapter**, TP-Link UB500 (Realtek RTL8761B) | `TP-Link UB500 Bluetooth adapter` | **3** (pilot), then up to 10 | $13 |
| 8 | Short USB extension cables, 1 ft, 10-pack (spaces the adapters apart) | `USB 3.0 extension cable 1ft 10 pack` | 1 | $15 |

| 9 | microSD card reader for your computer (to set up the card once) | `SanDisk MobileMate USB 3.0 microSD reader` | 1 | $10 |
| 10 | *Optional, for an outdoor or hard-to-reach speaker:* 16 ft **active** USB extension (puts one Bluetooth adapter by a window/wall facing that speaker) | `Cable Matters active USB 2.0 extension 16 ft` | 0–1 | $15 |

**Pilot total ≈ $360** (≈ $375 with the outdoor cable). **Every extra speaker: one more UB500 (≈ $13).** Up to 10 on this hub.

**Range (your house, 20 × 50 ft per floor, Pi in the middle):** far end of the same floor ≈ 25–27 ft (8 m), which is fine. Far end of the other floor ≈ 29 ft (9 m) through the floor, usually fine, and the pilot confirms it. Outdoors adds an exterior wall, which is what item 10 is for. Wi-Fi extenders don't help here, because the speakers use Bluetooth, not Wi-Fi.

### Notes

- **A. Pi 5 vs Pi 4.** The handoff chose a Pi 4 4 GB, but after 2026's price rises it costs about $100, while a Pi 5 4 GB is about $110. The Pi 5 is much faster, and its two USB 3 ports sit on **separate controllers**: the SSD gets one, the Bluetooth hub the other. That matters with 10 adapters. The software and install steps are the same for both. If you'd rather stay with a Pi 4, order `Raspberry Pi 4 Model B 4GB SC0194` with the `Raspberry Pi 15W USB-C power supply SC0218` and a case with a fan.
- **B. Check the adapters on arrival.** Every TP-Link UB500 revision so far, including the one sold as "Bluetooth 5.4", uses the same Realtek chip, which Linux supports out of the box. On the Pi, `lsusb` must show `2357:0604` for each one; return any that don't. Proven alternatives with the same chip family: ASUS USB-BT500, UGREEN CM390, EDUP EP-B3536.
- **C. The hub.** Ten adapters share the hub's USB 2 path. Hubs with one translator per port ("multi-TT") handle that best. Plugable documents the chips in its hub, but I couldn't confirm it's multi-TT. The pilot checks this: `lsusb -v | grep -i "TT"` should show "per-port TT". If the pilot shows dropouts with many adapters, the fix is a second hub on the Pi's other USB port.
- **D. Samsung T7 on a Pi.** It sometimes disconnects over the fast USB (UAS) mode. The guide includes the one-line fix (`usb-storage.quirks=04e8:4001:u`), and it's only needed if you see disconnects.
- **E. Also needed (you have them):** a phone, strong 5 GHz Wi-Fi (use the main network, not the guest one), the speakers, and a computer for the one-time setup.

### Plugging it together
Plug these into the Pi:
- the **SSD** into one blue USB 3 port
- the **hub** into the other blue port
- each **adapter** into the hub on its own 1 ft extension, spread apart (not touching each other or the SSD)

Put the Pi near the middle of the house, ideally close to the stairwell. Then follow [SETUP_CLOUD.md](SETUP_CLOUD.md).
