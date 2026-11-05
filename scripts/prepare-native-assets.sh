#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Native speech assets require macOS.' >&2
  exit 1
fi

sh scripts/build-audio-poc.sh
"$PWD/native/macos/.build/MeetingCopilotAudioPOC.app/Contents/MacOS/MeetingCopilotAudioPOC" \
  --prepare-assets --locale pt-BR
