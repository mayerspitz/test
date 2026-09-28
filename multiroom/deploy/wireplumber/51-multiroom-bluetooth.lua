-- Multiroom speaker bridge — WirePlumber 0.4 (Debian 12 "bookworm")
-- Installed by deploy/install-agent.sh into ~/.config/wireplumber/bluetooth.lua.d/
-- Same settings as 51-multiroom-bluetooth.conf (see the comments there).

bluez_monitor.properties["bluez5.enable-hw-volume"] = false
bluez_monitor.properties["bluez5.enable-sbc-xq"] = true
bluez_monitor.properties["bluez5.roles"] = "[ a2dp_sink a2dp_source ]"
bluez_monitor.properties["with-logind"] = false

table.insert(bluez_monitor.rules, {
  matches = { { { "device.name", "matches", "bluez_card.*" } } },
  apply_properties = { ["bluez5.hw-volume"] = "[ ]" },
})

table.insert(bluez_monitor.rules, {
  matches = { { { "node.name", "matches", "bluez_output.*" } } },
  apply_properties = { ["session.suspend-timeout-seconds"] = 0 },
})
