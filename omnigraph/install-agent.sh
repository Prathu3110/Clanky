#!/bin/bash
# Installs a LaunchAgent that runs serve.sh at login and restarts it if it stops. Run again after moving the repo.
# Remove: launchctl bootout gui/$(id -u)/com.prathu3110.clanky.memory && rm ~/Library/LaunchAgents/com.prathu3110.clanky.memory.plist
set -euo pipefail
LABEL=com.prathu3110.clanky.memory
SERVE="$(cd "$(dirname "$0")" && pwd)/serve.sh"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Clanky/Data/logs/omnigraph.log"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$SERVE</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <!-- the repo is on an external disk that may mount after login: retry every 10 s until it's there -->
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed $LABEL; log: $LOG"
