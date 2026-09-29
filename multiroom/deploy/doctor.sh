#!/usr/bin/env bash
# Home Audio system check for the home Pi. Prints ✓ / ! / ✗ with what to do.
#   ./deploy/doctor.sh            (also runs from the app: Settings → Run system check)
set -uo pipefail
CFG="${HOME_AUDIO_CONFIG:-$HOME/.config/multiroom/home.json}"
FAIL=0 WARN=0
ok()   { printf '✓ %s\n' "$*"; }
warn() { printf '! %s\n' "$*"; WARN=$((WARN + 1)); }
bad()  { printf '✗ %s\n' "$*"; FAIL=$((FAIL + 1)); }
have() { command -v "$1" >/dev/null 2>&1; }
cfg()  { node -e 'try{const c=require(process.argv[1]);const v=c[process.argv[2]];console.log(Array.isArray(v)?v.length:(v??""))}catch{console.log("")}' "$CFG" "$1" 2>/dev/null; }
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

echo "Home Audio system check — $(date '+%Y-%m-%d %H:%M')"

# Software
if have node && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then ok "Node.js $(node -v)"; else bad "Node.js 20+ missing — run the installer again"; fi
for t in mpv pactl busctl bluetoothctl; do have "$t" && ok "$t installed" || bad "$t missing — run the installer again"; done
if have yt-dlp; then ok "yt-dlp $(yt-dlp --version 2>/dev/null)"; else warn "yt-dlp missing — YouTube Music won't work (run the installer again)"; fi
have deno && ok "Deno $(deno --version 2>/dev/null | head -1 | awk '{print $2}') (for YouTube)" || warn "Deno missing — YouTube may fail (run the installer again)"
[ -f "$CFG" ] && ok "Config found ($CFG)" || bad "No config at $CFG — run the installer"

# Music drive
DATA="$(cfg dataDir)"; DATA="${DATA:-/srv/multiroom}"
if mountpoint -q "$DATA"; then
  ok "Music drive mounted at $DATA ($(df -h --output=avail "$DATA" | tail -1 | tr -d ' ') free)"
elif grep -qs " $DATA " /etc/fstab; then
  bad "Music drive for $DATA is set up but NOT mounted — is the SSD plugged in? Then: sudo mount $DATA"
else
  warn "No separate music drive: music is on the microSD ($(df -h --output=avail / | tail -1 | tr -d ' ') free). Plug in the SSD and run the installer again."
fi

# Power (under-voltage makes USB and Bluetooth flaky)
if have vcgencmd; then
  T="$(vcgencmd get_throttled 2>/dev/null | cut -d= -f2)"
  if [ "$T" = "0x0" ]; then ok "Power supply OK"; else warn "Power problems reported ($T) — use the official 27 W supply for the Pi 5"; fi
fi

# Bluetooth adapters and hub
if have lsusb; then
  N="$(lsusb | grep -ciE '2357:0604|0bda:8771|0b05:190e|0bda:a728')"
  [ "$N" -gt 0 ] && ok "$N USB Bluetooth adapter(s) plugged in" || bad "No USB Bluetooth adapter found — plug the UB500s into the powered hub"
  if lsusb -v 2>/dev/null | grep -q "TT per port"; then ok "USB hub has a translator per port (good for many adapters)"
  elif lsusb -v 2>/dev/null | grep -q "Single TT"; then warn "USB hub is single-TT: fine for a few speakers; with many playing at once, split the adapters over two hubs"
  fi
fi
HCI="$(busctl --system --list tree org.bluez 2>/dev/null | grep -cE '^/org/bluez/hci[0-9]+$')"
[ "${HCI:-0}" -gt 0 ] && ok "$HCI Bluetooth adapter(s) active" || bad "Bluetooth isn't running — try: sudo systemctl restart bluetooth"
SPK="$(cfg speakers)"; ok "${SPK:-0} speaker(s) set up (add more in the app: Settings → Add a speaker)"

# Audio
for u in pipewire wireplumber pipewire-pulse; do
  systemctl --user is-active --quiet "$u" 2>/dev/null && ok "$u running" || bad "$u not running — try: systemctl --user restart $u"
done
if [ -f "$HOME/.config/wireplumber/wireplumber.conf.d/51-multiroom-bluetooth.conf" ] || [ -f "$HOME/.config/wireplumber/bluetooth.lua.d/51-multiroom-bluetooth.lua" ]; then
  ok "Speaker volume protection installed (no Bluetooth absolute volume)"
else
  bad "Speaker volume protection missing — run the installer again"
fi
[ "$(loginctl show-user "$USER" -p Linger --value 2>/dev/null)" = yes ] && ok "Starts at boot without login" || bad "Not set to start at boot — run: sudo loginctl enable-linger $USER"
systemctl --user is-active --quiet multiroom-home 2>/dev/null && ok "Home Audio service running" || bad "Home Audio service not running — see: journalctl --user -u multiroom-home -n 50"

# Network
if have iw; then
  FREQ="$(iw dev 2>/dev/null | awk '/Interface/ {i=$2} END {print i}' | xargs -r -I{} iw dev {} link 2>/dev/null | awk '/freq/ {print int($2)}')"
  if [ -n "$FREQ" ]; then
    [ "$FREQ" -ge 5000 ] && ok "Wi-Fi on 5 GHz ($FREQ MHz)" || warn "Wi-Fi is on 2.4 GHz ($FREQ MHz) — it competes with Bluetooth; join the 5 GHz network"
  fi
fi
CLOUD="$(cfg cloud)"; PW="$(cfg token)"
if [ -n "$CLOUD" ]; then
  H="$(curl -fsS --max-time 90 "$CLOUD/api/health" 2>/dev/null)"
  if [ -n "$H" ]; then
    ok "App reachable at $CLOUD"
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -H "Authorization: Bearer $PW" "$CLOUD/api/zones")"
    [ "$CODE" = 200 ] && ok "Password accepted by the app" || bad "The app rejected the password (HTTP $CODE) — run the installer again with the right password"
    echo "$H" | grep -q '"online":true' && ok "This Pi is connected to the app" || warn "The app doesn't see this Pi yet (wait a minute after a restart)"
  else
    bad "Can't reach the app at $CLOUD — check the internet connection (the free app can take ~1 minute to wake up)"
  fi
fi
if have yt-dlp; then
  if timeout 60 yt-dlp --no-warnings --flat-playlist -J "ytsearch1:test" >/dev/null 2>&1; then ok "YouTube search works"; else warn "YouTube search failed right now — usually fixed by the daily auto-update (or run: sudo yt-dlp -U)"; fi
fi

echo
if [ "$FAIL" -gt 0 ]; then echo "$FAIL problem(s), $WARN warning(s)."; elif [ "$WARN" -gt 0 ]; then echo "Working, with $WARN warning(s)."; else echo "Everything looks good."; fi
exit "$FAIL"
