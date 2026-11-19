#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: $0 OUTPUT_DIRECTORY" >&2
  exit 2
fi

output_directory=$1
fixture_directory=$(CDPATH= cd -- "$(dirname -- "$0")/../tests/fixtures/stt-evaluation/pt-BR" && pwd)
mkdir -p "$output_directory"

for reference in "$fixture_directory"/*.txt; do
  name=$(basename "$reference" .txt)
  /usr/bin/say -v Luciana -o "$output_directory/$name.aiff" -f "$reference"
  /usr/bin/say -v Luciana -o "$output_directory/$name.wav" \
    --file-format=WAVE --data-format=LEI16@16000 -f "$reference"
  /usr/bin/say -v Luciana -o "$output_directory/$name.m4a" \
    --file-format=m4af --data-format=alac -f "$reference"
done

echo "Generated synthetic pt-BR AIFF, WAV 16 kHz, and M4A/ALAC files in $output_directory (not for Git)."
