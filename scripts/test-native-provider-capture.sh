#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Native capture testing requires macOS.' >&2
  exit 1
fi
sh scripts/build-native-helper-app.sh
echo 'Before this test, run npm run prepare:native-assets once and wait for ASSETS_PREPARED_NO_CAPTURE_pt-BR.'
echo 'Use audible speakers (not headphones), keep the room quiet, and authorize microphone plus Screen & System Audio Recording when macOS asks.'
echo 'The test plays one fixed synthetic phrase with /usr/bin/say and reports counts only; it never prints recognized transcript text.'
MEETING_COPILOT_CAPTURE_TEST=1 \
MEETING_COPILOT_HELPER="$PWD/native/macos/.build/MeetingCopilotTranscriber.app/Contents/MacOS/MeetingCopilotTranscriber" \
  node_modules/.bin/vitest run tests/manual/nativeProviderCapture.test.ts
