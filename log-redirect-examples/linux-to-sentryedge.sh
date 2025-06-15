#!/bin/sh
# Example: Redirect Linux syslog to SentryEdge using tail and curl
# Replace YOUR_ORG with your actual org name

SENTRYEDGE_URL="https://sentryedge.your-org.workers.dev/logs"
SYSLOG="/var/log/syslog"

tail -F "$SYSLOG" | grep -iE 'error|warn' | while read line; do
  curl -s -X POST --data "$line" "$SENTRYEDGE_URL"
done
