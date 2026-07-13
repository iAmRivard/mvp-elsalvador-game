#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
OUTPUT="$ROOT/public/maps/el-salvador.pmtiles"
BUILD_DATE=${PROTOMAPS_BUILD_DATE:-20260710}
BASEMAP_URL=${PROTOMAPS_BASEMAP_URL:-"https://build.protomaps.com/${BUILD_DATE}.pmtiles"}
BBOX=${EL_SALVADOR_BBOX:-"-90.20,13.00,-87.65,14.55"}
MAX_ZOOM=${MAP_MAX_ZOOM:-15}

command -v pmtiles >/dev/null 2>&1 || {
  echo "Error: instala la CLI pmtiles antes de reconstruir el mapa." >&2
  echo "Consulta scripts/maps/README.md para instrucciones." >&2
  exit 1
}

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT.part"

echo "Extrayendo El Salvador desde el basemap $BUILD_DATE…"
pmtiles extract "$BASEMAP_URL" "$OUTPUT.part" --bbox="$BBOX" --maxzoom="$MAX_ZOOM"
mv "$OUTPUT.part" "$OUTPUT"

"$ROOT/scripts/maps/validate-map.sh"
"$ROOT/scripts/maps/generate-checksum.sh"

echo "Mapa generado el $(date -u +%Y-%m-%dT%H:%M:%SZ)"
du -h "$OUTPUT"
