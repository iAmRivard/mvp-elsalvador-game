#!/bin/sh

set -eu

SOURCE_DATE="260712"
SOURCE_NAME="el-salvador-${SOURCE_DATE}.osm.pbf"
SOURCE_URL="https://download.geofabrik.de/central-america/${SOURCE_NAME}"
EXPECTED_MD5="f3949ed1a850cd4f672fb3ad40033544"
CACHE_DIR="${ROAD_CACHE_DIR:-.cache/roads}"
DESTINATION="${CACHE_DIR}/${SOURCE_NAME}"

mkdir -p "${CACHE_DIR}"

checksum() {
  if command -v md5sum >/dev/null 2>&1; then
    md5sum "$1" | awk '{print $1}'
  else
    md5 -q "$1"
  fi
}

if [ -f "${DESTINATION}" ] && [ "$(checksum "${DESTINATION}")" = "${EXPECTED_MD5}" ]; then
  printf 'Fuente vial ya verificada: %s\n' "${DESTINATION}"
  exit 0
fi

PARTIAL="${DESTINATION}.part"
rm -f "${PARTIAL}"
curl --fail --location --retry 3 --output "${PARTIAL}" "${SOURCE_URL}"

ACTUAL_MD5="$(checksum "${PARTIAL}")"
if [ "${ACTUAL_MD5}" != "${EXPECTED_MD5}" ]; then
  rm -f "${PARTIAL}"
  printf 'Checksum MD5 inesperado: %s (esperado %s)\n' "${ACTUAL_MD5}" "${EXPECTED_MD5}" >&2
  exit 1
fi

mv "${PARTIAL}" "${DESTINATION}"
printf 'Fuente vial descargada y verificada: %s\n' "${DESTINATION}"
