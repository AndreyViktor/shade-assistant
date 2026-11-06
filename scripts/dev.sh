#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

if [ "$(uname -s)" = "Darwin" ]; then
  sh scripts/build-native-helper-app.sh
fi

exec node_modules/.bin/electron-vite dev "$@"
