#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
CACHE_DIR=${MAP_CACHE_DIR:-"$ROOT/.cache/maps"}
SOURCE_URL=${MAP_SOURCE_URL:-"https://download.geofabrik.de/central-america/el-salvador-latest.osm.pbf"}
OUTPUT="$CACHE_DIR/el-salvador-latest.osm.pbf"

mkdir -p "$CACHE_DIR"

echo "Descargando extracto OSM de El Salvador…"
curl --fail --location --retry 3 --output "$OUTPUT.part" "$SOURCE_URL"
mv "$OUTPUT.part" "$OUTPUT"

test -s "$OUTPUT" || {
  echo "Error: la fuente descargada está vacía." >&2
  exit 1
}

echo "Fuente guardada en $OUTPUT"
du -h "$OUTPUT"
