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
