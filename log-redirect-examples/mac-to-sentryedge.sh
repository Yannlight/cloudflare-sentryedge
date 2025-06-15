#!/bin/sh
# Example: Redirect macOS system logs to SentryEdge using log stream and curl
# Replace YOUR_ORG with your actual org name

SENTRYEDGE_URL="https://sentryedge.your-org.workers.dev/logs"
# Only forward logs whose message contains 'error' or 'warn' (case-insensitive)
log stream --style syslog --predicate 'eventMessage CONTAINS[c] "error" OR eventMessage CONTAINS[c] "warn"' | while read -r line; do
  echo $line
  curl -s -X POST --data "$line" "$SENTRYEDGE_URL"
done
