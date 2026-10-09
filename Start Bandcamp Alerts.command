#!/bin/bash
set -euo pipefail
umask 077
BCA_SOURCE="$(cd "$(dirname "$0")" && pwd)"
BCA_DATA="$HOME/Library/Application Support/Bandcamp OBS Alerts"
BCA_VERSION="v22.23.3"
mkdir -p "$BCA_DATA"
bca_error() {
  /usr/bin/osascript -e 'display alert "Bandcamp OBS Alerts could not start" message "Check your internet connection and try again. If this continues, keep this Terminal window open and share the error shown there. This launcher needs macOS 11 or newer." as critical' || true
}
trap bca_error ERR

if /usr/bin/curl --silent --max-time 2 http://127.0.0.1:17864/health | /usr/bin/grep -q '"app":"bandcamp-obs-alerts"'; then
  if [ -f "$BCA_DATA/control-url.txt" ]; then
    /usr/bin/open "$(cat "$BCA_DATA/control-url.txt")"
    echo 'The helper is already running. Its control window has been opened.'
    exit 0
  fi
fi

BCA_MAC_MAJOR="$(/usr/bin/sw_vers -productVersion | /usr/bin/cut -d. -f1)"
if [ "$BCA_MAC_MAJOR" -lt 11 ]; then echo 'macOS 11 or newer is required.'; bca_error; exit 1; fi
BCA_ARCH="$(/usr/bin/uname -m)"
if [ "$BCA_ARCH" = 'arm64' ]; then
  BCA_ARCHIVE='node-v22.23.3-darwin-arm64.tar.gz'
  BCA_HASH='23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53'
else
  BCA_ARCHIVE='node-v22.23.3-darwin-x64.tar.gz'
  BCA_HASH='8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8'
fi
BCA_NODE="$BCA_DATA/runtime/$BCA_VERSION-$BCA_ARCH/node"
if [ ! -x "$BCA_NODE" ]; then
  echo 'Preparing the small local helper. This first download only happens once.'
  BCA_TEMP="$(/usr/bin/mktemp -d "$BCA_DATA/runtime-download.XXXXXX")"
  /usr/bin/curl --fail --location --proto '=https' --tlsv1.2 --retry 2 --connect-timeout 20 --max-time 180 "https://nodejs.org/dist/$BCA_VERSION/$BCA_ARCHIVE" -o "$BCA_TEMP/$BCA_ARCHIVE"
  BCA_ACTUAL="$(/usr/bin/shasum -a 256 "$BCA_TEMP/$BCA_ARCHIVE" | /usr/bin/cut -d' ' -f1)"
  if [ "$BCA_ACTUAL" != "$BCA_HASH" ]; then echo 'The download did not pass its integrity check. Please try again.'; false; fi
  /usr/bin/tar -xzf "$BCA_TEMP/$BCA_ARCHIVE" -C "$BCA_TEMP" "node-$BCA_VERSION-darwin-$BCA_ARCH/bin/node"
  mkdir -p "$(dirname "$BCA_NODE")"
  /bin/mv "$BCA_TEMP/node-$BCA_VERSION-darwin-$BCA_ARCH/bin/node" "$BCA_NODE"
  /bin/chmod 700 "$BCA_NODE"
  /bin/rm -rf "$BCA_TEMP"
fi

BCA_LOCK="$BCA_DATA/launch-lock"
if [ -f "$BCA_LOCK/pid" ]; then
  BCA_PREVIOUS_PID="$(cat "$BCA_LOCK/pid")"
  case "$BCA_PREVIOUS_PID" in
    ''|*[!0-9]*) ;;
    *) if ! /bin/kill -0 "$BCA_PREVIOUS_PID" 2>/dev/null; then /bin/rm -f "$BCA_LOCK/pid"; /bin/rmdir "$BCA_LOCK" 2>/dev/null || true; fi ;;
  esac
fi
if ! /bin/mkdir "$BCA_LOCK" 2>/dev/null; then
  echo 'Another launch is in progress. Please wait a moment and try again.'
  exit 1
fi
echo "$$" > "$BCA_LOCK/pid"
trap '/bin/rm -f "$BCA_LOCK/pid"; /bin/rmdir "$BCA_LOCK" 2>/dev/null || true' EXIT
trap 'exit 1' HUP INT TERM
if [ "$BCA_SOURCE" != "$BCA_DATA/app" ]; then /usr/bin/ditto "$BCA_SOURCE" "$BCA_DATA/app"; fi
BCA_DATA_DIR="$BCA_DATA" /usr/bin/nohup "$BCA_NODE" "$BCA_DATA/app/server.cjs" >> "$BCA_DATA/helper.log" 2>&1 </dev/null &
BCA_HELPER_PID=$!
for BCA_ATTEMPT in {1..40}; do
  if /usr/bin/curl --silent --max-time 1 http://127.0.0.1:17864/health | /usr/bin/grep -q '"app":"bandcamp-obs-alerts"'; then
    /usr/bin/open "$(cat "$BCA_DATA/control-url.txt")"
    echo 'Bandcamp OBS Alerts is running. You can close this Terminal window.'
    echo 'Use the control window to connect Gmail, copy the OBS URL, and send a test alert.'
    exit 0
  fi
  if ! /bin/kill -0 "$BCA_HELPER_PID" 2>/dev/null; then
    echo 'The helper could not start:'
    /usr/bin/tail -n 5 "$BCA_DATA/helper.log"
    false
  fi
  /bin/sleep 0.25
done
echo 'The helper took too long to start. Please try again.'
false
