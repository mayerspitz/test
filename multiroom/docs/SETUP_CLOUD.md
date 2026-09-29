# Setup: cloud app + one home Pi (the chosen design)

```
Phone ──https──► https://home-audio-kx2w.onrender.com        (Render, free plan: web app, speakers, queues, login)
                     ▲   /demo/ = the demo
                     │ Wi-Fi, outgoing connection only (no router setup)
                 Home Pi ── USB hub ── 1 Bluetooth adapter per speaker ──► up to 10 speakers
                 └ 500 GB SSD: all the music
```

- **The cloud** (Render free plan) runs the web app, the password login, and every speaker's queue and volume.
- **The home Pi** keeps the music on its SSD and drives the speakers. It also fetches YouTube audio over your home internet, because YouTube blocks cloud servers.
- **How they talk:** the Pi opens the connection to the cloud, so there is nothing to set up on your router. The cloud asks the Pi for library pages, uploads and previews over that connection.
- **Free plan, handled:**
  - The Pi keeps a backup of all speakers and queues, and restores it when the free service restarts with an empty disk.
  - The Pi pings the app every 10 minutes so it doesn't fall asleep.
  - Changes may take a minute after a restart, which you said is fine.
- **Any Bluetooth speaker works.** Only standard Bluetooth audio (A2DP) is used, and the speaker's own volume is never changed.

## 1. The cloud app (already done)

The service is on Render (see `render.yaml`). Its only setting is `MULTIROOM_TOKEN`, which is the app password.

## 2. The home Pi: the automatic way (recommended)

1. **Flash the microSD card** on your computer with [Raspberry Pi Imager](https://www.raspberrypi.com/software/): choose *Raspberry Pi 5* → *Raspberry Pi OS Lite (64-bit)*. In "Edit settings", set:
   - hostname `audiohome`
   - a username and password
   - your **5 GHz** Wi-Fi (not the guest network)
   - on the Services tab, turn SSH on
2. **Plug everything in:** the SSD, the hub with the Bluetooth adapters on their short cables, then power. Wait 2 minutes.
3. **Open a terminal on your computer** (Windows: PowerShell; Mac: Terminal), run `ssh <username>@audiohome.local`, then paste **one line**:
   ```bash
   curl -fsSL https://home-audio-kx2w.onrender.com/install.sh | bash
   ```
   It asks for the app password once, then does everything below by itself and restarts the Pi (about 10–15 minutes):
   - finds and mounts the SSD; a new SSD is used as-is and nothing is erased
   - applies the Samsung T7 and Bluetooth settings
   - installs everything and connects to the app
4. **Add speakers in the app:** Settings → **Add a speaker** → put the speaker in pairing mode → Search → tap it → name it. Repeat for each speaker. No commands needed.

**Updating later:** run the same one line again.

**Loading your ~100 GB of music:** in the app use Library → Add folder. For the first big copy it's faster to plug the SSD into your computer before step 2, copy each MP3 player's folder into a `library` folder on the SSD (e.g. `library/Kitchen player/…`), then plug it into the Pi. The app finds the songs automatically.

## 2b. The home Pi: step by step (what the installer does)

**Parts:** see [SHOPPING_LIST.md](SHOPPING_LIST.md). In short:
- Raspberry Pi 5 (4 GB), or a Pi 4 4 GB, with its power supply and a case with a fan
- 32 GB microSD card
- 500 GB SSD
- a 10-port powered USB hub
- one TP-Link UB500 per speaker, each on a short USB extension cable

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager. In its settings, set the hostname `audiohome`, turn on SSH, and enter your Wi-Fi (**5 GHz**).
2. Connect the SSD to one **blue USB 3 port** and the Bluetooth hub to the other (on a Pi 4, use a black USB 2 port for the hub), with the adapters spread out on their extension cables away from the SSD. Mount the SSD:
   ```bash
   lsblk -f                                   # find the SSD, e.g. /dev/sda1, note its UUID
   sudo mkfs.ext4 -L music /dev/sda1          # only if it's new/empty — this erases it
   sudo mkdir -p /srv/multiroom
   echo 'LABEL=music /srv/multiroom ext4 defaults,noatime,nofail 0 2' | sudo tee -a /etc/fstab
   sudo mount -a
   ```
   Samsung T7 only, if the SSD ever drops out: add ` usb-storage.quirks=04e8:4001:u` to the end of the single line in `/boot/firmware/cmdline.txt`, then reboot.
3. Turn off the Pi's built-in Bluetooth, so that only the USB adapters are used:
   ```bash
   echo "dtoverlay=disable-bt" | sudo tee -a /boot/firmware/config.txt && sudo reboot
   ```
4. Install. Use your app address and password:
   ```bash
   sudo apt-get install -y git
   git clone -b claude/upbeat-edison-2k76xq https://github.com/mayerspitz/test.git
   cd test/multiroom
   ./deploy/install-home.sh --cloud https://home-audio-kx2w.onrender.com --password '<password>' --data /srv/multiroom
   ```
5. For each speaker, put it in pairing mode, pair it with **its own adapter**, and add it:
   ```bash
   ./deploy/pair-speaker.sh adapters                           # lists every USB adapter with its address
   ./deploy/pair-speaker.sh pair F8:DF:15:12:34:56 00:1A:7D:DA:71:01
   ./deploy/home-speaker.sh add --id kitchen --name "Kitchen" --speaker F8:DF:15:12:34:56 --adapter 00:1A:7D:DA:71:01
   ```
   Use the adapter's **address**, not `hci0`/`hci1`: with 10 identical adapters, Linux may renumber them after a reboot.
6. Set each speaker's own volume once, then use only the app.

## 3. Music

- **From the app:** Library → Add songs / Add folder. Files go through the cloud straight onto the Pi's SSD.
- **Directly on the Pi** (fastest for the first big copy): copy the MP3 players' folders into `/srv/multiroom/library/<Collection name>/`, then tap **Rescan** in the app.

## Logs and troubleshooting

- **On the Pi:** `journalctl --user -u multiroom-home -f`
- **In the app:** a yellow "Home Pi offline" banner means the Pi can't reach the cloud. Check the Pi's Wi-Fi and power.
- For Bluetooth problems, see the troubleshooting table in [SETUP.md](SETUP.md).
