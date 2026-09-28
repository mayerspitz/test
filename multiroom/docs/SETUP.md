# Setup guide

Allow about an hour for the hub and 15 minutes per speaker bridge. You don't need to know Linux; every step is a command you copy and paste.

## 0. Try it first (5 minutes, any computer)

You need [Node.js 20+](https://nodejs.org).

```bash
git clone -b claude/upbeat-edison-2k76xq https://github.com/mayerspitz/test.git
cd test/multiroom
npm install
npm run demo
```

Open the address it prints on your phone, which must be on the same Wi-Fi. The demo has six simulated speakers and a generated sample library, so you can try everything: choose music per speaker, drag volumes, look at the queue and upload files. Kids Room shows a speaker that is switched off, and Office shows a bridge that is offline.

> If the repository is private, the Pi needs your GitHub login to clone it: use a [personal access token](https://github.com/settings/tokens) as the password (`git clone https://<you>:<token>@github.com/…`). Alternatively, copy the `multiroom` folder over with `scp -r`.

## 1. The hub

**Hardware:** a Raspberry Pi 5 or any always-on Linux computer (see [HARDWARE.md](HARDWARE.md)).

1. With [Raspberry Pi Imager](https://www.raspberrypi.com/software/), flash **Raspberry Pi OS Lite (64-bit)**. In the settings (the gear icon), set:
   - hostname `audiohub`
   - enable SSH
   - your user and password
   - your Wi-Fi (or plug in Ethernet, which is better)
2. Boot it, then from your computer run `ssh <user>@audiohub.local`.
3. Install:

   ```bash
   sudo apt-get install -y git
   git clone -b claude/upbeat-edison-2k76xq https://github.com/mayerspitz/test.git
   cd test/multiroom
   ./deploy/install-hub.sh
   ```

   This installs Node.js, the app, yt-dlp and Deno (for YouTube Music), a daily yt-dlp auto-update, and a `multiroom-hub` service that starts on boot. At the end it prints **the address to open** and an **access token**. Keep the token; the bridges and your phone need it.

## 2. Move your music in

Each old MP3 player becomes a **collection**.

**From a computer (easiest for big libraries):**

1. Plug an MP3 player into the computer by USB. It shows up as a drive.
2. Open the hub's address in the browser, go to **Library**, and type a collection name such as *Kitchen player*.
3. Click **Add folder** and pick the player's music folder. Folder structure and file order are kept.
4. Repeat for each player.

**From your phone:** Library → **Add songs** works too. Folder upload is limited on phones.

**Copying files directly:** put them in `/srv/multiroom/library/<Collection name>/…` (with `scp`, SFTP, a USB stick or a network share), then tap **Rescan** in the Library tab.

MP3, M4A/AAC, FLAC, OGG/Opus, WAV and WMA all play. Album art comes from the files or from a `cover.jpg` / `folder.jpg` next to them.

## 3. One bridge per speaker

**Hardware:** Raspberry Pi 4 (or 3 A+) + TP-Link UB500, placed within a few metres of the speaker.

1. Flash Raspberry Pi OS Lite (64-bit) as above, with hostname e.g. `bridge-kitchen`. Plug in the UB500. Use Ethernet or **5 GHz** Wi-Fi.
2. Turn off the Pi's built-in Bluetooth, so the USB adapter is the only one (`hci0`) and the built-in radio can't interfere with Wi-Fi:

   ```bash
   echo "dtoverlay=disable-bt" | sudo tee -a /boot/firmware/config.txt
   sudo reboot
   ```

3. Get the code, then pair the speaker. Put the speaker in pairing mode first.

   ```bash
   sudo apt-get install -y git
   git clone -b claude/upbeat-edison-2k76xq https://github.com/mayerspitz/test.git
   cd test/multiroom
   ./deploy/pair-speaker.sh adapters          # should list hci0 (USB)
   ./deploy/pair-speaker.sh scan              # note your speaker's address, e.g. F8:DF:15:12:34:56
   ./deploy/pair-speaker.sh pair F8:DF:15:12:34:56
   ```

4. Install the bridge. Use the hub address and token from step 1:

   ```bash
   ./deploy/install-agent.sh --hub http://audiohub.local:8080 --token <TOKEN> \
       --zone kitchen --name "Kitchen" --speaker F8:DF:15:12:34:56
   ```

   This installs the audio packages, turns off Bluetooth absolute volume, keeps the Bluetooth stream open between songs and turns off Wi-Fi power saving. It also starts the `multiroom-agent@kitchen` service. The speaker appears in the app within seconds.

5. **Set the speaker's own volume once** (e.g. 80–100%) with its buttons, then leave it. From now on, use only the app's slider.

**Driving a speaker from the hub or another Pi with several adapters:** run `install-agent.sh` once per speaker, with a different `--zone`, `--speaker` and `--adapter hci1` / `hci2`. Pair each speaker with its adapter: `./deploy/pair-speaker.sh pair <MAC> hci1`.

## 4. Your phone

Open `http://audiohub.local:8080`. If `.local` names don't work on your phone, use the IP address the installer printed. Enter the token once. Then:

- **iPhone:** Safari → Share → **Add to Home Screen**.
- **Android:** Chrome → ⋮ → **Add to Home screen**.

It then opens full-screen like an app.

**Outside the house:** install [Tailscale](https://tailscale.com) on the hub (`curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`) and on your phone, then use `http://audiohub:8080`. For HTTPS, which also enables offline caching of the app, run `sudo tailscale serve --bg 8080` and open the `https://audiohub.<tailnet>.ts.net` address it shows.

## 5. YouTube Music

In the app, choose **Choose music → YouTube**. You can search, or paste a link from the YouTube Music app (Share → Copy link) for a song, album or playlist.

- The hub fetches the audio with [yt-dlp](https://github.com/yt-dlp/yt-dlp) and streams it to the bridge. The bridges never talk to YouTube themselves.
- **No account is needed.** If you add your account's cookies (`YTDLP_ARGS=--cookies …` in `/etc/multiroom/hub.env`), note that a YouTube Music Premium plan allows only **one stream at a time per account** (a Family plan allows more). Six rooms playing YouTube at once will then conflict, so account-less mode is usually better here.
- yt-dlp works by reading YouTube's website. It is widely used, but it is not an official YouTube API, and it may be against YouTube's terms of service; you decide whether to use it. When YouTube changes something, the daily auto-update usually fixes it within a day or two.
- **Official alternative on iPhone:** the YouTube Music app can AirPlay to speakers. If you want that, ask and we can add `shairport-sync` to each bridge, so every speaker also appears as an AirPlay target with software-only volume.

## Updating

```bash
# on the hub
cd ~/test/multiroom && git pull && npm ci --omit=dev -w hub && sudo systemctl restart multiroom-hub
# on a bridge
cd ~/test/multiroom && git pull && npm ci --omit=dev -w agent && systemctl --user restart 'multiroom-agent@*'
```

## Troubleshooting

| Symptom | What to check |
|---|---|
| Speaker shows **"not paired"** | `./deploy/pair-speaker.sh pair <MAC> <adapter>` with the speaker in pairing mode. |
| **"Speaker is off or out of range"** | Speaker powered? Is it connected to an old phone or MP3 player? Forget it there. Bridges retry automatically; you can also use ⋯ → Reconnect speaker. |
| **Bridge offline** | On the bridge: `journalctl --user -u multiroom-agent@kitchen -f`. Check the hub URL and token in `~/.config/multiroom/agents/kitchen.json`. |
| **Stutter or dropouts** | Use Ethernet or 5 GHz Wi-Fi, the USB adapter on an extension cable, and keep the bridge close to the speaker. |
| **No sound, but "playing"** | `wpctl status` should list a `bluez_output…` sink. `pactl list short sinks` too. Is the speaker's own volume up? |
| **Speaker volume changes with the slider** | The WirePlumber drop-in is missing. Rerun `install-agent.sh`, then `systemctl --user restart wireplumber`. |
| **YouTube search fails** | On the hub: `yt-dlp -U` and `deno --version`, then look at `journalctl -u multiroom-hub -f`. |
| Hub logs | `journalctl -u multiroom-hub -f` |
