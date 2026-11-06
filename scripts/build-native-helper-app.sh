#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'The native helper app bundle requires macOS and Xcode.' >&2
  exit 1
fi

xcrun swift build --package-path native/macos -c release \
  --product MeetingCopilotTranscriber -Xswiftc -warnings-as-errors

bundle="$PWD/native/macos/.build/MeetingCopilotTranscriber.app"
contents="$bundle/Contents"
mkdir -p "$contents/MacOS"
cp native/macos/.build/release/MeetingCopilotTranscriber \
  "$contents/MacOS/MeetingCopilotTranscriber"
cp native/macos/TranscriberApp/Info.plist "$contents/Info.plist"
codesign --force --deep --sign - "$bundle"
/usr/bin/plutil -lint "$contents/Info.plist"
echo "Built native permission-aware helper app: $bundle"
