#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Native helper process tests require macOS and Xcode 26.' >&2
  exit 1
fi
sh scripts/build-native-helper-app.sh
MEETING_COPILOT_HELPER="$PWD/native/macos/.build/MeetingCopilotTranscriber.app/Contents/MacOS/MeetingCopilotTranscriber" \
  node_modules/.bin/vitest run tests/integration/nativeHelper.test.ts
