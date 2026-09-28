#!/usr/bin/env bash
# Add, remove or list the speakers the home Pi drives (cloud mode).
#   ./deploy/home-speaker.sh list
#   ./deploy/home-speaker.sh add --id kitchen --name "Kitchen" --speaker F8:DF:15:12:34:56 --adapter 00:1A:7D:DA:71:01
#   ./deploy/home-speaker.sh remove --id kitchen
# --adapter is best given as the USB adapter's own address (./deploy/pair-speaker.sh adapters),
# so speakers stay on the right adapter even if Linux renumbers them after a reboot.
set -euo pipefail
CFG="$HOME/.config/multiroom/home.json"
[ -f "$CFG" ] || { echo "No $CFG yet — run deploy/install-home.sh first." >&2; exit 1; }
cmd="${1:-}"; shift || true
ID="" NAME="" SPEAKER="" ADAPTER=hci0
while [ $# -gt 0 ]; do
  case "$1" in
    --id) ID="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --speaker) SPEAKER="$2"; shift 2 ;;
    --adapter) ADAPTER="$2"; shift 2 ;;
    *) echo "Unknown option $1" >&2; exit 1 ;;
  esac
done
node -e '
const fs = require("fs");
const [file, cmd, id, name, speaker, adapter] = process.argv.slice(1);
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
cfg.speakers ??= [];
const mac = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
if (cmd === "list") {
  if (!cfg.speakers.length) console.log("No speakers yet.");
  for (const s of cfg.speakers) console.log(`${s.zone.id.padEnd(16)} ${s.zone.name.padEnd(20)} speaker ${s.bluetooth?.speaker ?? "-"}  adapter ${s.bluetooth?.adapter ?? "-"}`);
  process.exit(0);
}
if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) { console.error("--id must be lowercase letters/digits/-/_ (e.g. kitchen)"); process.exit(1); }
if (cmd === "remove") {
  cfg.speakers = cfg.speakers.filter((s) => s.zone.id !== id);
} else if (cmd === "add") {
  if (!mac.test(speaker)) { console.error("--speaker must look like AA:BB:CC:DD:EE:FF"); process.exit(1); }
  const entry = { zone: { id, name: name || id }, bluetooth: { speaker: speaker.toUpperCase(), adapter: mac.test(adapter) ? adapter.toUpperCase() : adapter }, player: { type: "mpv" } };
  cfg.speakers = [...cfg.speakers.filter((s) => s.zone.id !== id), entry];
} else { console.error("Use: list | add | remove"); process.exit(1); }
fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
console.log(`${cmd === "add" ? "Added" : "Removed"} ${id}.`);
' "$CFG" "$cmd" "$ID" "$NAME" "$SPEAKER" "$ADAPTER"
if [ "$cmd" != list ]; then
  XDG_RUNTIME_DIR="/run/user/$(id -u)"
  export XDG_RUNTIME_DIR
  systemctl --user restart multiroom-home && echo "Restarted multiroom-home — the speaker list in the app updates in a few seconds."
fi
