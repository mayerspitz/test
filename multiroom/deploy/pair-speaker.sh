#!/usr/bin/env bash
# Pair a Bluetooth speaker with a specific adapter of this bridge.
#   ./deploy/pair-speaker.sh adapters                     list Bluetooth adapters (hci0, hci1, … and their addresses)
#   (wherever [hci0] appears you can also give the adapter's address — best with many identical USB adapters)
#   ./deploy/pair-speaker.sh scan [hci0]                  find nearby devices (speaker in pairing mode)
#   ./deploy/pair-speaker.sh pair AA:BB:CC:DD:EE:FF [hci0]  pair + trust + connect
#   ./deploy/pair-speaker.sh remove AA:BB:CC:DD:EE:FF [hci0]
# Tip: switch off Bluetooth on the old MP3 player / phones the speaker used before,
# otherwise the speaker may keep reconnecting to them instead of the bridge.
set -euo pipefail

cmd="${1:-}"
# Adapters can be named hciN or by their own address (stable across reboots).
adapter_addr() {
  if [[ "$1" =~ ^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$ ]]; then echo "$1" | tr 'a-f' 'A-F'; return; fi
  busctl --system get-property org.bluez "/org/bluez/$1" org.bluez.Adapter1 Address 2>/dev/null | sed -E 's/^s "(.*)"$/\1/' ||
    { echo "Adapter $1 not found. Run: $0 adapters" >&2; exit 1; }
}
adapter_name() {
  if [[ ! "$1" =~ : ]]; then echo "$1"; return; fi
  local want; want="$(adapter_addr "$1")"
  for dev in /sys/class/bluetooth/hci*; do
    local n; n="$(basename "$dev")"; [[ "$n" == *:* ]] && continue
    [ "$(adapter_addr "$n")" = "$want" ] && { echo "$n"; return; }
  done
  echo "Adapter $1 not found. Run: $0 adapters" >&2; exit 1
}
# Feed commands to bluetoothctl; "sleep:N" pauses N seconds between commands.
btctl() {
  { for c in "$@"; do if [[ "$c" == sleep:* ]]; then sleep "${c#sleep:}"; else echo "$c"; fi; done; echo quit; } | bluetoothctl
}

case "$cmd" in
  adapters)
    for dev in /sys/class/bluetooth/hci*; do
      [ -e "$dev" ] || { echo "No Bluetooth adapters found."; exit 1; }
      name="$(basename "$dev")"
      [[ "$name" == *:* ]] && continue # connection entries such as hci0:11
      bus="$(readlink -f "$dev/device" | grep -q usb && echo USB || echo built-in)"
      echo "$name  $(adapter_addr "$name")  ($bus)"
    done
    ;;
  scan)
    A="$(adapter_addr "${2:-hci0}")"
    echo "Scanning for 20 s on ${2:-hci0} ($A) — put the speaker in pairing mode now…"
    btctl "select $A" "power on" "scan on" sleep:20 "scan off" "devices" | grep -E '^Device ' | sort -u
    ;;
  pair)
    MAC="$(echo "${2:?MAC address required}" | tr 'a-f' 'A-F')"
    AD="$(adapter_name "${3:-hci0}")"
    A="$(adapter_addr "$AD")"
    echo "Pairing $MAC with $AD ($A). The speaker must be in pairing mode…"
    btctl "select $A" "power on" "agent NoInputNoOutput" "default-agent" "scan on" sleep:10 \
      "pair $MAC" sleep:10 "trust $MAC" "connect $MAC" sleep:8 "scan off" >/dev/null
    path="/org/bluez/$AD/dev_${MAC//:/_}"
    paired="$(busctl --system get-property org.bluez "$path" org.bluez.Device1 Paired 2>/dev/null || echo 'b false')"
    connected="$(busctl --system get-property org.bluez "$path" org.bluez.Device1 Connected 2>/dev/null || echo 'b false')"
    echo "Paired: ${paired#b }   Connected: ${connected#b }"
    [ "$paired" = "b true" ] || { echo "Pairing failed — make sure the speaker is in pairing mode and try again."; exit 1; }
    ;;
  remove)
    MAC="$(echo "${2:?MAC address required}" | tr 'a-f' 'A-F')"
    A="$(adapter_addr "${3:-hci0}")"
    btctl "select $A" "remove $MAC"
    ;;
  *)
    sed -n '2,8p' "$0"
    exit 1
    ;;
esac
