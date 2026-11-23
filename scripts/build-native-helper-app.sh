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
/usr/bin/plutil -lint "$contents/Info.plist"
helper_identifier=$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$contents/Info.plist"
)
if [ "$helper_identifier" != 'local.meetingcopilot.transcriber' ]; then
  echo 'Unexpected native helper bundle identifier.' >&2
  exit 1
fi

# The development helper is one native executable, so sign that bundle directly.
# --deep signing can conceal a malformed nested-code layout and is reserved neither
# for this bundle nor for the future distribution pipeline.
/usr/bin/codesign --force --sign - --identifier "$helper_identifier" \
  --options runtime --timestamp=none "$bundle"
/usr/bin/codesign --verify --strict --verbose=2 "$bundle"

# Direct distribution does not App Sandbox this capture helper. TCC is declared in
# Info.plist; no privilege-granting entitlement belongs in the development signature.
helper_entitlements=$(
  /usr/bin/codesign -d --entitlements - "$bundle" 2>/dev/null
)
if [ -n "$helper_entitlements" ]; then
  echo 'Unexpected native helper signing entitlements.' >&2
  exit 1
fi

echo "HELPER_SECURITY_BASELINE_OK identifier=$helper_identifier signature=adhoc-runtime entitlements=none"
echo "Built native permission-aware helper app: $bundle"
