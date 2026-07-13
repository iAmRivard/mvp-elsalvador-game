#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
MAP="$ROOT/public/maps/el-salvador.pmtiles"
STYLE="$ROOT/public/map-assets/styles/el-salvador.json"
GLYPH="$ROOT/public/map-assets/fonts/Noto Sans Regular/0-255.pbf"
GLYPH_EXTENDED="$ROOT/public/map-assets/fonts/Noto Sans Regular/256-511.pbf"
SPRITE_JSON="$ROOT/public/map-assets/sprites/basemap.json"
SPRITE_PNG="$ROOT/public/map-assets/sprites/basemap.png"

for file in "$MAP" "$STYLE" "$GLYPH" "$GLYPH_EXTENDED" "$SPRITE_JSON" "$SPRITE_PNG"; do
  test -s "$file" || {
    echo "Error: falta el recurso cartográfico $file" >&2
    exit 1
  }
done

if head -n 1 "$MAP" | grep -q "git-lfs.github.com/spec"; then
  echo "Error: el PMTiles es un puntero de Git LFS, no el archivo real." >&2
  exit 1
fi

dd if="$MAP" bs=1 count=7 2>/dev/null | grep -q '^PMTiles$' || {
  echo "Error: el archivo no contiene una cabecera PMTiles válida." >&2
  exit 1
}

if test -s "$ROOT/data/checksums.txt"; then
  (cd "$ROOT" && sha256sum -c data/checksums.txt)
fi

if command -v pmtiles >/dev/null 2>&1; then
  pmtiles verify "$MAP"
fi

echo "Mapa válido: $(du -h "$MAP" | cut -f1)"
