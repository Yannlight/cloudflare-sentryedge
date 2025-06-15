#!/bin/sh
# Example: Redirect Nginx access logs to SentryEdge using tail and curl
# Replace YOUR_ORG with your actual org name

SENTRYEDGE_URL="https://sentryedge.your-org.workers.dev/logs"
NGINX_LOG="/var/log/nginx/access.log"

tail -F "$NGINX_LOG" | grep -iE 'error|warn' | while read line; do
  curl -s -X POST --data "$line" "$SENTRYEDGE_URL"
done
