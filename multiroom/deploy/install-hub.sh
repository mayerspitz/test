#!/usr/bin/env bash
# Installs the multiroom HUB: web app, API, music library, YouTube Music (yt-dlp + Deno).
# Run on the always-on computer (Raspberry Pi 4/5, mini PC, old laptop…):
#   ./deploy/install-hub.sh [--port 8080] [--data /srv/multiroom] [--token SECRET] [--no-youtube]
source "$(dirname "$0")/lib.sh"

PORT=8080
DATA_DIR=/srv/multiroom
TOKEN=""
YOUTUBE=1
JS_RUNTIME_ARGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --data) DATA_DIR="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --no-youtube) YOUTUBE=0; shift ;;
    -h|--help) sed -n '2,4p' "$0"; exit 0 ;;
    *) die "Unknown option $1" ;;
  esac
done

need_debian
say "Installing system packages"
sudo apt-get update
sudo apt-get install -y ca-certificates curl unzip
ensure_node
npm_install_workspace hub

if [ "$YOUTUBE" = 1 ]; then
  # Official yt-dlp release binaries bundle the YouTube JS challenge solver (yt-dlp-ejs);
  # Deno is the JavaScript runtime yt-dlp uses for it. Distro packages are too old.
  case "$(uname -m)" in
    x86_64) YTDLP_ASSET=yt-dlp_linux ;;
    aarch64|arm64) YTDLP_ASSET=yt-dlp_linux_aarch64 ;;
    armv7l) YTDLP_ASSET=yt-dlp_linux_armv7l ;;
    *) YTDLP_ASSET=yt-dlp ;; # zipimport build, needs python3
  esac
  say "Installing yt-dlp ($YTDLP_ASSET)"
  [ "$YTDLP_ASSET" = yt-dlp ] && sudo apt-get install -y python3
  sudo curl -fL --retry 3 -o /usr/local/bin/yt-dlp "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$YTDLP_ASSET"
  sudo chmod 755 /usr/local/bin/yt-dlp
  # yt-dlp needs a JavaScript runtime for YouTube: Deno (preferred) or Node.js 22+.
  case "$(uname -m)" in
    x86_64) DENO_ASSET=deno-x86_64-unknown-linux-gnu.zip ;;
    aarch64|arm64) DENO_ASSET=deno-aarch64-unknown-linux-gnu.zip ;;
    *) DENO_ASSET="" ;;
  esac
  JS_RUNTIME_ARGS=""
  if command -v deno >/dev/null; then
    say "Deno $(deno --version | head -1) already installed"
  elif [ -n "$DENO_ASSET" ]; then
    say "Installing Deno (JavaScript runtime yt-dlp uses for YouTube)"
    tmp="$(mktemp -d)"
    curl -fL --retry 3 -o "$tmp/deno.zip" "https://github.com/denoland/deno/releases/latest/download/$DENO_ASSET"
    unzip -o -q "$tmp/deno.zip" -d "$tmp"
    sudo install -m 755 "$tmp/deno" /usr/local/bin/deno
    rm -rf "$tmp"
  elif [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ]; then
    JS_RUNTIME_ARGS="--js-runtimes node"
    warn "No Deno build for $(uname -m); yt-dlp will use Node.js instead."
  else
    warn "No JavaScript runtime for yt-dlp on $(uname -m): use a 64-bit OS for YouTube Music."
  fi
  # YouTube changes often; keep yt-dlp current automatically.
  printf '#!/bin/sh\n/usr/local/bin/yt-dlp -U >/dev/null 2>&1 || true\n' | sudo tee /etc/cron.daily/multiroom-yt-dlp >/dev/null
  sudo chmod 755 /etc/cron.daily/multiroom-yt-dlp
  yt-dlp --version
fi

say "Preparing data folder $DATA_DIR"
sudo mkdir -p "$DATA_DIR/library"
sudo chown -R "$USER": "$DATA_DIR"

sudo mkdir -p /etc/multiroom
if [ ! -f /etc/multiroom/hub.env ]; then
  [ -n "$TOKEN" ] || TOKEN="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  sudo tee /etc/multiroom/hub.env >/dev/null <<ENV
# Multiroom hub settings. Restart after changes: sudo systemctl restart multiroom-hub
PORT=$PORT
MULTIROOM_DATA_DIR=$DATA_DIR
MULTIROOM_TOKEN=$TOKEN
# Extra yt-dlp arguments, e.g. to use your YouTube Music account cookies:
#   YTDLP_ARGS=--cookies /srv/multiroom/youtube-cookies.txt
YTDLP_ARGS=${JS_RUNTIME_ARGS:-}
ENV
  sudo chmod 640 /etc/multiroom/hub.env
  sudo chown root:"$USER" /etc/multiroom/hub.env
else
  say "Keeping existing /etc/multiroom/hub.env"
  TOKEN="$(sed -n 's/^MULTIROOM_TOKEN=//p' /etc/multiroom/hub.env)"
  PORT="$(sed -n 's/^PORT=//p' /etc/multiroom/hub.env)"
fi

say "Installing the systemd service"
render "$MULTIROOM_DIR/deploy/systemd/multiroom-hub.service" | sudo tee /etc/systemd/system/multiroom-hub.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now multiroom-hub
sudo systemctl restart multiroom-hub

IP="$(hostname -I | awk '{print $1}')"
cat <<DONE

  Hub installed.
    Open on your phone:  http://$IP:$PORT        (or http://$(hostname).local:$PORT)
    Access token:        $TOKEN
    Music folder:        $DATA_DIR/library   (one sub-folder per collection)
    Logs:                journalctl -u multiroom-hub -f

  Next, on each speaker bridge:
    ./deploy/install-agent.sh --hub http://$IP:$PORT --token $TOKEN --zone kitchen --name "Kitchen" --speaker AA:BB:CC:DD:EE:FF
DONE
