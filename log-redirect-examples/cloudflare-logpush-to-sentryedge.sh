#!/bin/zsh
# cloudflare-logpush-to-sentryedge.sh
# Example: Send a Cloudflare Zero Trust Logpush log to SentryEdge endpoint

ENDPOINT="$1"
if [ -z "$ENDPOINT" ]; then
  echo "Usage: $0 <SentryEdge endpoint URL>"
  exit 1
fi

# Example Cloudflare Zero Trust Logpush log (JSON)
LOG='{"Event":{"RayID":"6f8c1b2e9b1c1a2b","EdgeStartTimestamp":1681234567890,"ClientIP":"203.0.113.42","ClientRequestMethod":"GET","ClientRequestURI":"/index.html","ClientRequestHost":"example.cloudflareaccess.com","ClientRequestProtocol":"HTTP/1.1","ClientRequestUserAgent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)","ClientRequestReferer":"https://referrer.site/","ClientRequestHeaders":{"cf-connecting-ip":"203.0.113.42","cf-ray":"6f8c1b2e9b1c1a2b"},"EdgeResponseStatus":200,"EdgeColoCode":"SFO","SecurityLevel":"high","WAFAction":"allow","WAFRuleID":"12345","WAFRuleMessage":"SQL Injection Attempt"}}'

curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"raw\": $LOG}" \
  "$ENDPOINT/logs"
