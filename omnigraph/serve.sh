#!/bin/bash
# Serves the Clanky memory graph on localhost. Data and tokens live outside the repo, in ~/Clanky/Data.
# First-time setup and schema changes: see omnigraph/README.md. Run at login: omnigraph/install-agent.sh
set -euo pipefail
DATA="$HOME/Clanky/Data/omnigraph"
TOKENS="$HOME/Clanky/Data/omnigraph.tokens.json"
# A crashed server keeps its cluster lock. This server is the only writer on this Mac, so with none running the
# lock is stale: release that exact id so a restart (launchd KeepAlive) can serve again.
if ! pgrep -x omnigraph-server >/dev/null; then
  LOCK="$(omnigraph cluster status --target "$DATA" --json 2>/dev/null | sed -n 's/.*"lock_id": *"\([^"]*\)".*/\1/p')"
  [ -n "$LOCK" ] && omnigraph cluster force-unlock "$LOCK" --target "$DATA" >/dev/null
fi
# omnigraph-server 0.15.0 overflows the default 2 MB worker stack on its first MCP mutate.
export RUST_MIN_STACK=16777216
export OMNIGRAPH_SERVER_BEARER_TOKENS_JSON="$(cat "$TOKENS")"
exec omnigraph-server --cluster "file://$DATA" --bind 127.0.0.1:7811
