# shellcheck shell=bash
# Shared helpers for the install scripts (sourced, not run).
set -euo pipefail

MULTIROOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

need_debian() {
  command -v apt-get >/dev/null || die "This installer expects Raspberry Pi OS / Debian / Ubuntu (apt-get not found)."
  [ "$(id -u)" -ne 0 ] || die "Run as your normal user (not root); the script uses sudo where needed."
  sudo -v || die "sudo is required."
}

# Node.js 20+ (Debian 13 / Raspberry Pi OS trixie ship it; older releases get NodeSource 22.x).
ensure_node() {
  local major=0
  if command -v node >/dev/null; then major="$(node -p 'process.versions.node.split(".")[0]')"; fi
  if [ "$major" -lt 20 ] && apt-cache policy nodejs 2>/dev/null | grep -qE 'Candidate: (2[0-9]|[3-9][0-9])\.'; then
    say "Installing Node.js from the distribution"
    sudo apt-get install -y nodejs npm
    major="$(node -p 'process.versions.node.split(".")[0]')"
  fi
  if [ "$major" -lt 20 ]; then
    say "Installing Node.js 22 from NodeSource"
    sudo apt-get install -y ca-certificates curl gnupg
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  command -v npm >/dev/null || sudo apt-get install -y npm
  NODE_BIN="$(command -v node)"
  say "Node.js $(node -v) at $NODE_BIN"
}

npm_install_workspace() {
  say "Installing JavaScript dependencies ($1)"
  (cd "$MULTIROOM_DIR" && npm ci --omit=dev --no-audit --no-fund --workspace "$1")
}

# Replace @USER@ @DIR@ @NODE@ @HOME@ placeholders in a template.
render() {
  sed -e "s#@USER@#$USER#g" -e "s#@DIR@#$MULTIROOM_DIR#g" -e "s#@NODE@#$NODE_BIN#g" -e "s#@HOME@#$HOME#g" "$1"
}

# yt-dlp (official binary, bundles the YouTube JS solver) + Deno, with daily self-update.
# Sets JS_RUNTIME_ARGS when Node.js has to stand in for Deno.
# shellcheck disable=SC2034 # JS_RUNTIME_ARGS is read by the calling script
install_ytdlp() {
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
}
