#!/bin/sh
curl -X POST https://sentryedge-worker.datargo.workers.dev/logs \
  -H "Content-Type: application/json" \
  -d '{"service": "backend", "level": "error", "message": "Something went wrong"}'
  