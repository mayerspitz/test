#!/usr/bin/env bash
# Sets up the HOME PI for cloud mode: music library on the SSD, all Bluetooth speakers,
# YouTube fetching, and the link to the cloud app. Run once on the Pi:
#   ./deploy/install-home.sh --cloud https://home-audio-kx2w.onrender.com --password 'YOUR-PASSWORD' [--data /srv/multiroom]
# Then add speakers with ./deploy/home-speaker.sh (see docs/SETUP_CLOUD.md).
source "$(dirname "$0")/lib.sh"

CLOUD="" PASSWORD="" DATA_DIR=/srv/multiroom JS_RUNTIME_ARGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --cloud) CLOUD="${2%/}"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --data) DATA_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) die "Unknown option $1" ;;
  esac
done
[ -n "$CLOUD" ] && [ -n "$PASSWORD" ] || die "Required: --cloud URL --password PASSWORD   (see --help)"

need_debian
say "Installing audio, Bluetooth and system packages"
sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip mpv pipewire pipewire-pulse wireplumber libspa-0.2-bluetooth pulseaudio-utils bluez
ensure_node
say "Installing JavaScript dependencies"
(cd "$MULTIROOM_DIR" && npm ci --omit=dev --no-audit --no-fund --workspace hub --workspace agent)
install_ytdlp

say "Music library folder: $DATA_DIR  (put this on the SSD — see docs/SETUP_CLOUD.md)"
if ! findmnt -T "$DATA_DIR" >/dev/null 2>&1 || [ "$(findmnt -n -o TARGET -T "${DATA_DIR%/*}" 2>/dev/null)" = "/" ]; then
  warn "$DATA_DIR is on the microSD card, not the SSD. Mount the SSD first if you want the music on it."
fi
sudo mkdir -p "$DATA_DIR/library"
sudo chown -R "$USER": "$DATA_DIR" 2>/dev/null || true  # exFAT drives are already owned via mount options

say "Enabling Bluetooth"
sudo systemctl enable --now bluetooth
NEW_GROUPS=0
id -nG "$USER" | tr ' ' '\n' | grep -qx bluetooth || NEW_GROUPS=1
sudo usermod -aG bluetooth,audio "$USER"
sudo loginctl enable-linger "$USER"
[ "$NEW_GROUPS" = 0 ] || sudo systemctl restart "user@$(id -u).service"

say "Configuring WirePlumber (no Bluetooth absolute volume, A2DP only, no suspend)"
WP_VER="$(wireplumber --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | tail -1 || true)"
if [[ "$WP_VER" == 0.4.* ]]; then
  mkdir -p "$HOME/.config/wireplumber/bluetooth.lua.d"
  cp "$MULTIROOM_DIR/deploy/wireplumber/51-multiroom-bluetooth.lua" "$HOME/.config/wireplumber/bluetooth.lua.d/"
else
  mkdir -p "$HOME/.config/wireplumber/wireplumber.conf.d"
  cp "$MULTIROOM_DIR/deploy/wireplumber/51-multiroom-bluetooth.conf" "$HOME/.config/wireplumber/wireplumber.conf.d/"
fi

if command -v nmcli >/dev/null; then
  while IFS=: read -r conn type; do
    [ "$type" = "802-11-wireless" ] && sudo nmcli connection modify "$conn" 802-11-wireless.powersave 2 && say "Wi-Fi power saving off for '$conn'"
  done < <(nmcli -t -f NAME,TYPE connection show --active)
fi

CFG="$HOME/.config/multiroom/home.json"
mkdir -p "$(dirname "$CFG")"
say "Writing $CFG"
node -e '
const fs = require("fs");
const [file, cloud, token, dataDir, js] = process.argv.slice(1);
const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { speakers: [] };
Object.assign(cfg, { cloud, token, dataDir });
if (js) cfg.ytdlpArgs = js.split(" ");
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
' "$CFG" "$CLOUD" "$PASSWORD" "$DATA_DIR" "$JS_RUNTIME_ARGS"

say "Installing the service multiroom-home"
mkdir -p "$HOME/.config/systemd/user"
render "$MULTIROOM_DIR/deploy/systemd/multiroom-home.service" > "$HOME/.config/systemd/user/multiroom-home.service"
XDG_RUNTIME_DIR="/run/user/$(id -u)"
export XDG_RUNTIME_DIR
systemctl --user daemon-reload
systemctl --user enable pipewire pipewire-pulse wireplumber >/dev/null 2>&1 || true
systemctl --user restart pipewire pipewire-pulse wireplumber
systemctl --user enable --now multiroom-home
systemctl --user restart multiroom-home

cat <<DONE

  Home Pi installed and connecting to $CLOUD
    Check it any time: ./deploy/doctor.sh   (or in the app: Settings → Run system check)
    Music folder: $DATA_DIR/library   (or upload from the app)
    Logs:         journalctl --user -u multiroom-home -f
  Next: pair and add each speaker, e.g.
    ./deploy/pair-speaker.sh adapters
    ./deploy/pair-speaker.sh pair F8:DF:15:12:34:56 <adapter address>
    ./deploy/home-speaker.sh add --id kitchen --name "Kitchen" --speaker F8:DF:15:12:34:56 --adapter <adapter address>
DONE
