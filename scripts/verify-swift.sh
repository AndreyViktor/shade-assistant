#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
if [ "$(uname -s)" != "Darwin" ]; then
  echo 'Swift verification requires macOS and the Xcode 26 SDK.' >&2
  exit 1
fi
if [ "$(xcrun swift-format --version)" != "6.3.0" ]; then
  echo 'Expected swift-format 6.3.0; review the toolchain before changing this pin.' >&2
  exit 1
fi
xcrun swift-format lint --strict --recursive --configuration native/macos/.swift-format \
  native/macos/Package.swift native/macos/Sources native/macos/Tests
xcrun swift test --package-path native/macos -Xswiftc -warnings-as-errors
xcrun swift build --package-path native/macos -c release -Xswiftc -warnings-as-errors
