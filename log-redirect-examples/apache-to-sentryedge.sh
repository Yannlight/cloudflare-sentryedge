#!/bin/sh
# Example: Redirect Apache access logs to SentryEdge using tail and curl
# Replace YOUR_ORG with your actual org name

SENTRYEDGE_URL="https://sentryedge.your-org.workers.dev/logs"
APACHE_LOG="/var/log/apache2/access.log"

tail -F "$APACHE_LOG" | grep -iE 'error|warn' | while read line; do
  curl -s -X POST --data "$line" "$SENTRYEDGE_URL"
done
