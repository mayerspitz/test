#!/usr/bin/env bash
# Fully automatic home-Pi setup (run by the one-line installer the app serves at /install.sh):
# finds and mounts the SSD, applies the Bluetooth + SSD fixes, installs everything, reboots.
#   ./deploy/auto-setup.sh --cloud https://<app> --password '<password>'
source "$(dirname "$0")/lib.sh"

CLOUD="" PASSWORD="" DATA=/srv/multiroom REBOOT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --cloud) CLOUD="${2%/}"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --data) DATA="$2"; shift 2 ;;
    *) die "Unknown option $1" ;;
  esac
done
[ -n "$CLOUD" ] && [ -n "$PASSWORD" ] || die "Required: --cloud URL --password PASSWORD"
need_debian
sudo apt-get update
sudo apt-get install -y parted exfatprogs usbutils

# 1. The music SSD: the biggest USB disk that isn't the system disk. Existing exFAT/NTFS/ext4
#    drives are used as they are (nothing erased); a blank drive is formatted after asking.
ROOTDISK="$(lsblk -no PKNAME "$(findmnt -no SOURCE /)" 2>/dev/null | head -1)"
SSD="$(lsblk -dbno NAME,TRAN,SIZE,TYPE | awk -v r="$ROOTDISK" '$2=="usb" && $4=="disk" && $1!=r {print $3, $1}' | sort -nr | awk 'NR==1 {print $2}')"
if mountpoint -q "$DATA"; then
  say "Music drive already mounted at $DATA"
elif [ -n "$SSD" ]; then
  part() { lsblk -lno NAME,TYPE "/dev/$SSD" | awk '$2=="part" {print $1; exit}'; }
  DEV="/dev/$(part)"
  [ "$DEV" = "/dev/" ] && DEV="/dev/$SSD"
  FSTYPE="$(lsblk -no FSTYPE "$DEV" | head -1)"
  if [ -z "$FSTYPE" ]; then
    warn "The USB drive /dev/$SSD ($(lsblk -dno SIZE "/dev/$SSD")) is blank."
    read -rp "Format it for music? This erases it. [y/N] " answer </dev/tty
    [ "$answer" = y ] || [ "$answer" = Y ] || die "Stopped without touching the drive."
    sudo parted -s "/dev/$SSD" mklabel gpt mkpart music ext4 0% 100%
    sleep 2
    DEV="/dev/$(part)"
    sudo mkfs.ext4 -F -L music "$DEV"
    FSTYPE=ext4
  fi
  UUID="$(sudo blkid -s UUID -o value "$DEV")"
  case "$FSTYPE" in
    ext4) OPTS="defaults,noatime,nofail"; PASS=2 ;;
    exfat|vfat) OPTS="defaults,noatime,nofail,uid=$(id -u),gid=$(id -g),umask=022"; PASS=0 ;;
    ntfs) FSTYPE=ntfs3; OPTS="defaults,noatime,nofail,uid=$(id -u),gid=$(id -g)"; PASS=0 ;;
    *) die "The SSD uses $FSTYPE, which isn't supported — reformat it as exFAT on a computer." ;;
  esac
  sudo mkdir -p "$DATA"
  grep -q "UUID=$UUID" /etc/fstab || echo "UUID=$UUID $DATA $FSTYPE $OPTS 0 $PASS" | sudo tee -a /etc/fstab >/dev/null
  sudo systemctl daemon-reload
  sudo mount "$DATA"
  say "Music drive ($FSTYPE, $(lsblk -dno SIZE "/dev/$SSD")) mounted at $DATA"
else
  warn "No USB SSD found: music goes on the microSD card for now. Plug the SSD in and run the installer again to move to it."
fi

BOOT=/boot/firmware
[ -d "$BOOT" ] || BOOT=/boot
# 2. Samsung T7: its fast USB mode (UAS) can drop out on a Pi — use the stable mode.
if lsusb | grep -qi '04e8:4001' && ! grep -q '04e8:4001' "$BOOT/cmdline.txt"; then
  sudo sed -i '1 s/$/ usb-storage.quirks=04e8:4001:u/' "$BOOT/cmdline.txt"
  say "Applied the Samsung T7 stability setting"
  REBOOT=1
fi
# 3. Speakers use the USB Bluetooth adapters only: turn the built-in radio off.
if ! grep -q '^dtoverlay=disable-bt' "$BOOT/config.txt"; then
  echo 'dtoverlay=disable-bt' | sudo tee -a "$BOOT/config.txt" >/dev/null
  say "Built-in Bluetooth turned off (USB adapters are used instead)"
  REBOOT=1
fi

# 4. Everything else: audio, Bluetooth, YouTube, the Home Audio service.
"$(dirname "$0")/install-home.sh" --cloud "$CLOUD" --password "$PASSWORD" --data "$DATA"

cat <<DONE

  All set. Next, in the app ($CLOUD): Settings → Add a speaker.
DONE
if [ "$REBOOT" = 1 ]; then
  say "Restarting the Pi in 10 seconds to apply the Bluetooth/SSD settings…"
  sleep 10
  sudo reboot
fi
