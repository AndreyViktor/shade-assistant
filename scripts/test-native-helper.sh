#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Native helper process tests require macOS and Xcode 26.' >&2
  exit 1
fi
xcrun swift build --package-path native/macos -c release --product MeetingCopilotTranscriber -Xswiftc -warnings-as-errors
MEETING_COPILOT_HELPER="$PWD/native/macos/.build/release/MeetingCopilotTranscriber" \
  node_modules/.bin/vitest run tests/integration/nativeHelper.test.ts
