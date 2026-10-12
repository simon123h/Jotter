# Jotter icon

`icon.svg` is the icon (the tile with its four cards); `foreground.svg` is the same glyph without a background, for
Android's adaptive icon (the system crops the outer third of that canvas, so the glyph is kept inside the middle).

Do not edit the generated files by hand. After changing an SVG, run `scripts/generate-icons.sh` (needs `inkscape` and
ImageMagick). It writes the web favicon and PWA icons, the docs logo, and the Android launcher icons.
