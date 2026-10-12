#!/usr/bin/env bash
# Generates every Jotter icon from assets/icon/icon.svg (the tile) and assets/icon/foreground.svg (the same
# glyph without a background, for Android's adaptive icon). Needs inkscape and ImageMagick (convert).
set -euo pipefail
cd "$(dirname "$0")/.."

TILE=assets/icon/icon.svg
FOREGROUND=assets/icon/foreground.svg
RES=apps/mobile/android/app/src/main/res
BLUE='#3B6FD4'
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

render() { inkscape "$1" -o "$2" -w "$3" -h "$3" >/dev/null 2>&1; }

# A copy of the tile without rounded corners, for icons that the system masks itself
sed 's/ rx="112"//' "$TILE" > "$TMP/square.svg"

# Web: the tab icon, and the installed app (maskable, so full bleed)
cp "$TILE" apps/web/public/favicon.svg
render "$TMP/square.svg" apps/web/public/pwa-192.png 192
render "$TMP/square.svg" apps/web/public/pwa-512.png 512

# Docs
render "$TILE" docs/assets/icon.png 256
render "$TILE" docs/public/logo.png 256
for s in 256 128 64 48 32 16; do render "$TILE" "$TMP/ico-$s.png" "$s"; done
convert "$TMP"/ico-{256,128,64,48,32,16}.png docs/assets/icon.ico

# Android: launcher icons per density (legacy 48dp, adaptive foreground 108dp)
for entry in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  density=${entry%%:*}
  factor=${entry##*:}
  legacy=$(awk "BEGIN{print int(48*$factor)}")
  adaptive=$(awk "BEGIN{print int(108*$factor)}")
  dir="$RES/mipmap-$density"
  render "$TILE" "$dir/ic_launcher.png" "$legacy"
  render "$FOREGROUND" "$dir/ic_launcher_foreground.png" "$adaptive"
  # The round icon: the square tile cut to a circle
  render "$TMP/square.svg" "$TMP/round-$density.png" "$legacy"
  convert "$TMP/round-$density.png" \( -size "${legacy}x${legacy}" xc:black -fill white \
    -draw "circle $((legacy / 2)),$((legacy / 2)) $((legacy / 2)),0" \) -alpha off -compose copy_opacity -composite "$dir/ic_launcher_round.png"
done
sed -i "s|<color name=\"ic_launcher_background\">.*</color>|<color name=\"ic_launcher_background\">$BLUE</color>|" "$RES/values/ic_launcher_background.xml"
echo "Icons generated."
