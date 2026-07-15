#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
MAP="$ROOT/public/maps/el-salvador.pmtiles"
STYLE="$ROOT/public/map-assets/styles/el-salvador.json"
GLYPH="$ROOT/public/map-assets/fonts/Noto Sans Regular/0-255.pbf"
GLYPH_EXTENDED="$ROOT/public/map-assets/fonts/Noto Sans Regular/256-511.pbf"

for file in "$MAP" "$STYLE" "$GLYPH" "$GLYPH_EXTENDED"; do
  test -s "$file" || {
    echo "Error: falta el recurso cartográfico $file" >&2
    exit 1
  }
done

node -e '
  const style = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
  if (Object.hasOwn(style, "sprite")) throw new Error("El estilo no debe declarar un sprite sin consumidores");
  const serializedLayers = JSON.stringify(style.layers ?? []);
  for (const property of ["icon-image", "fill-pattern", "line-pattern", "background-pattern"]) {
    if (serializedLayers.includes(`"${property}"`)) throw new Error(`El estilo usa ${property}; revisa la política de sprites`);
  }
' "$STYLE"

if head -n 1 "$MAP" | grep -q "git-lfs.github.com/spec"; then
  echo "Error: el PMTiles es un puntero de Git LFS, no el archivo real." >&2
  exit 1
fi

dd if="$MAP" bs=1 count=7 2>/dev/null | grep -q '^PMTiles$' || {
  echo "Error: el archivo no contiene una cabecera PMTiles válida." >&2
  exit 1
}

if test -s "$ROOT/data/checksums.txt"; then
  (cd "$ROOT" && tr -d '\r' < data/checksums.txt | sha256sum -c -)
fi

if command -v pmtiles >/dev/null 2>&1; then
  pmtiles verify "$MAP"
fi

echo "Mapa válido: $(du -h "$MAP" | cut -f1)"
