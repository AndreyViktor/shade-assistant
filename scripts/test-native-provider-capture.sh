#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Native capture testing requires macOS.' >&2
  exit 1
fi
sh scripts/build-native-helper-app.sh
echo 'During the test, speak synthetic pt-BR phrases into the microphone.'
echo 'Before this test, run npm run prepare:native-assets once and wait for ASSETS_PREPARED_NO_CAPTURE_pt-BR.'
echo 'For system audio, run /usr/bin/say -v "Eddy (Português (Brasil))" '
echo '  "Este é um teste sintético do áudio do sistema." in another Terminal.'
echo 'The test reports readiness and counts only; it never prints transcript text.'
MEETING_COPILOT_CAPTURE_TEST=1 \
MEETING_COPILOT_HELPER="$PWD/native/macos/.build/MeetingCopilotTranscriber.app/Contents/MacOS/MeetingCopilotTranscriber" \
  node_modules/.bin/vitest run tests/manual/nativeProviderCapture.test.ts
