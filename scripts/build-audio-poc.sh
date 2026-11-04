#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
xcrun swift build --package-path native/macos -c release --product MeetingCopilotAudioPOC -Xswiftc -warnings-as-errors
poc_bundle="$PWD/native/macos/.build/MeetingCopilotAudioPOC.app"
mkdir -p "$poc_bundle/Contents/MacOS"
cp native/macos/POC/Info.plist "$poc_bundle/Contents/Info.plist"
cp native/macos/.build/release/MeetingCopilotAudioPOC "$poc_bundle/Contents/MacOS/MeetingCopilotAudioPOC"
/usr/bin/plutil -lint "$poc_bundle/Contents/Info.plist"
/usr/bin/codesign --force --sign - --identifier local.meetingcopilot.audio-poc "$poc_bundle"
/usr/bin/codesign --verify --strict "$poc_bundle"
printf 'Built (not launched): %s\n' "$poc_bundle"
