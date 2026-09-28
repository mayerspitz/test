#!/usr/bin/env bash
# Installs a SPEAKER BRIDGE: mpv + PipeWire + Bluetooth, and the multiroom agent for one speaker.
# Run on the small computer next to the speaker (or on the hub, once per USB Bluetooth adapter):
#   ./deploy/install-agent.sh --hub http://192.168.1.10:8080 --token SECRET \
#       --zone kitchen --name "Kitchen" --speaker AA:BB:CC:DD:EE:FF [--adapter hci0 | --adapter 00:1A:7D:DA:71:01]
# Pair the speaker first (or after) with: ./deploy/pair-speaker.sh pair AA:BB:CC:DD:EE:FF hci0
source "$(dirname "$0")/lib.sh"

HUB="" TOKEN="" ZONE="" NAME="" SPEAKER="" ADAPTER=hci0
while [ $# -gt 0 ]; do
  case "$1" in
    --hub) HUB="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --zone) ZONE="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --speaker) SPEAKER="$(echo "$2" | tr 'a-f' 'A-F')"; shift 2 ;;
    --adapter) ADAPTER="$2"; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) die "Unknown option $1" ;;
  esac
done
[ -n "$HUB" ] && [ -n "$ZONE" ] || die "Required: --hub URL --zone id   (see --help)"
[[ "$ZONE" =~ ^[a-z0-9][a-z0-9_-]{0,39}$ ]] || die "--zone must be lowercase letters/digits/-/_ (e.g. kitchen)"
[ -z "$SPEAKER" ] || [[ "$SPEAKER" =~ ^([0-9A-F]{2}:){5}[0-9A-F]{2}$ ]] || die "--speaker must look like AA:BB:CC:DD:EE:FF"
NAME="${NAME:-$ZONE}"

need_debian
say "Installing audio and Bluetooth packages"
sudo apt-get update
sudo apt-get install -y mpv pipewire pipewire-pulse wireplumber libspa-0.2-bluetooth pulseaudio-utils bluez
ensure_node
npm_install_workspace agent

say "Enabling Bluetooth"
sudo systemctl enable --now bluetooth
NEW_GROUPS=0
id -nG "$USER" | tr ' ' '\n' | grep -qx bluetooth || NEW_GROUPS=1
sudo usermod -aG bluetooth,audio "$USER"
# Keep the user's PipeWire/WirePlumber running at boot without anyone logging in.
sudo loginctl enable-linger "$USER"
# A running user manager doesn't see new group membership until it restarts.
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
say "WirePlumber ${WP_VER:-unknown} configured"

# Wi-Fi power saving causes audio dropouts on Raspberry Pis.
if command -v nmcli >/dev/null; then
  while IFS=: read -r conn type; do
    [ "$type" = "802-11-wireless" ] && sudo nmcli connection modify "$conn" 802-11-wireless.powersave 2 && say "Wi-Fi power saving off for '$conn'"
  done < <(nmcli -t -f NAME,TYPE connection show --active)
fi

say "Writing bridge config for '$NAME'"
mkdir -p "$HOME/.config/multiroom/agents"
CFG="$HOME/.config/multiroom/agents/$ZONE.json"
node -e '
const [hub, token, id, name, speaker, adapter, file] = process.argv.slice(1);
const cfg = { hub, token, zone: { id, name }, player: { type: "mpv", audioDevice: "auto", extraArgs: [] } };
if (speaker) cfg.bluetooth = { speaker, adapter, autoReconnect: true, pauseWhenDisconnected: true, lockSinkVolume: true };
require("fs").writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
' "$HUB" "$TOKEN" "$ZONE" "$NAME" "$SPEAKER" "$ADAPTER" "$CFG"

say "Installing the user service multiroom-agent@$ZONE"
mkdir -p "$HOME/.config/systemd/user"
render "$MULTIROOM_DIR/deploy/systemd/multiroom-agent@.service" > "$HOME/.config/systemd/user/multiroom-agent@.service"
XDG_RUNTIME_DIR="/run/user/$(id -u)"
export XDG_RUNTIME_DIR
systemctl --user daemon-reload
systemctl --user enable pipewire pipewire-pulse wireplumber >/dev/null 2>&1 || true
systemctl --user restart pipewire pipewire-pulse wireplumber
systemctl --user enable --now "multiroom-agent@$ZONE"
systemctl --user restart "multiroom-agent@$ZONE"

cat <<DONE

  Bridge '$NAME' installed.
    Config:  $CFG
    Logs:    journalctl --user -u multiroom-agent@$ZONE -f
    Status:  the speaker appears in the app within a few seconds.
DONE
if [ -n "$SPEAKER" ]; then
  AD_NAME="$ADAPTER"
  if [[ "$ADAPTER" == *:* ]]; then
    for dev in /sys/class/bluetooth/hci*; do
      n="$(basename "$dev")"; [[ "$n" == *:* ]] && continue
      busctl --system get-property org.bluez "/org/bluez/$n" org.bluez.Adapter1 Address 2>/dev/null | grep -qi "$ADAPTER" && AD_NAME="$n"
    done
  fi
  if busctl --system get-property org.bluez "/org/bluez/$AD_NAME/dev_${SPEAKER//:/_}" org.bluez.Device1 Paired 2>/dev/null | grep -q true; then
    echo "    Speaker $SPEAKER is paired with $ADAPTER."
  else
    echo "    Speaker $SPEAKER is NOT paired yet. Put it in pairing mode, then run:"
    echo "      ./deploy/pair-speaker.sh pair $SPEAKER $ADAPTER"
  fi
fi
echo "    (Log out and back in once so the new 'bluetooth' group membership applies to your shell.)"
