#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
MAP="$ROOT/public/maps/el-salvador.pmtiles"
CHECKSUMS="$ROOT/data/checksums.txt"

test -s "$MAP" || {
  echo "Error: no existe $MAP" >&2
  exit 1
}

mkdir -p "$ROOT/data"
(cd "$ROOT" && sha256sum public/maps/el-salvador.pmtiles) > "$CHECKSUMS"
echo "Checksum actualizado en $CHECKSUMS"
