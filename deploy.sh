#!/bin/zsh
# deploy.sh - Build Next.js UI, copy static files to Worker, and deploy Worker with Wrangler

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
set -e

# Paths
UI_DIR="$(pwd)/ui"
WORKER_DIR="$(pwd)/worker"
UI_OUT_DIR="$UI_DIR/out"

# Detect OS for cross-platform compatibility (macOS vs Linux)
UNAME_OUT="$(uname -s)"
case "$UNAME_OUT" in
    Linux*)     SED_INPLACE=(sed -i); BASE64_CMD="base64 -w 0";;
    Darwin*)    SED_INPLACE=(sed -i ''); BASE64_CMD="base64";;
    *)          SED_INPLACE=(sed -i); BASE64_CMD="base64";;
esac

# 0. Ensure Cloudflare Wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "${YELLOW}🔧 [0/3] Installing Cloudflare Wrangler CLI...${NC}"
  npm install -g wrangler
fi

# 0.1 Ensure user is logged in to Cloudflare Wrangler
if ! wrangler whoami &> /dev/null; then
  echo "${YELLOW}🔑 [0.1/3] Logging in to Cloudflare Wrangler...${NC}"
  wrangler login
fi

# 0.2 Ensure D1 database exists (create if not already present)
if ! wrangler d1 list | grep 'sentryedge'; then
  echo "${YELLOW}🗄️ [0.2/3] Creating D1 database 'sentryedge'...${NC}"
  D1_CREATE_OUTPUT=$(wrangler d1 create sentryedge)
  # Extract the database_id (should be a 32+ char hex string)
  D1_ID=$(wrangler d1 list | grep 'sentryedge' | grep -Eo '[a-f0-9-]{32,}')
  if [ -n "$D1_ID" ]; then
    echo "${YELLOW}🗄️ [0.2/3] Updating worker/wrangler.toml with new database_id: $D1_ID${NC}"
    "${SED_INPLACE[@]}" "s|^database_id = \".*\"|database_id = \"$D1_ID\"|" "$WORKER_DIR/wrangler.toml"
  else
    echo "${YELLOW}🛑 [0.2/3] Could not extract database_id from wrangler d1 create output!${NC}"
  fi
else
  echo "${YELLOW}🗄️ [0.2/3] D1 database 'sentryedge' already exists.${NC}"
  # Get the database_id from wrangler d1 list (parse the correct column)
  D1_ID=$(wrangler d1 list | grep 'sentryedge' | grep -Eo '[a-f0-9-]{32,}')
  if [ -n "$D1_ID" ]; then
    echo "${YELLOW}🗄️ [0.2/3] Updating worker/wrangler.toml with existing database_id: $D1_ID${NC}"
    "${SED_INPLACE[@]}" "s|^database_id = \".*\"|database_id = \"$D1_ID\"|" "$WORKER_DIR/wrangler.toml"
  else
    echo "${YELLOW}🛑 [0.2/3] Could not extract database_id from wrangler d1 list output!${NC}"
  fi
fi

# 1. Build Next.js UI (static export)
echo "${CYAN}🛠️ [1/3] Building Next.js UI...${NC}"

cd "$UI_DIR"
npm install
npm run build

# 2. Copy static files to Worker public dir
echo "${CYAN}📁 [2/3] Copying static UI to Worker public directory...${NC}"
mkdir -p "$WORKER_DIR/public"
rsync -a --delete "$UI_OUT_DIR"/ "$WORKER_DIR/public"/

# 3. Deploy Worker with Wrangler
echo "${CYAN}🚀 [3/3] Deploying Worker with Wrangler...${NC}"

cd "$WORKER_DIR"

echo "${CYAN}📦 Applying D1 migrations...${NC}"
wrangler d1 migrations apply sentryedge # local
wrangler d1 migrations apply sentryedge --remote # remote

echo "${CYAN}🔧 Installing Worker dependencies...${NC}"
npm install
DEPLOY_OUTPUT=$(wrangler deploy)
# Try to extract the deployed URL from the output (look for the first https://...workers.dev or custom domain)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -n1)
if [ -z "$DEPLOY_URL" ]; then
  # Try to find a custom domain if present
  DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -Eo 'https://[a-zA-Z0-9./_-]+' | head -n1)
fi

# Print friendly summary with endpoints
echo "\n${GREEN}✅ Deployment complete!${NC}"
echo ""
if [ -n "$DEPLOY_URL" ]; then
  echo "${CYAN}🔗 Your log ingestion endpoint:${NC}   ${YELLOW}${DEPLOY_URL}/logs${NC}"
  echo "${CYAN}🔎 Log Analyst UI:${NC}                ${YELLOW}${DEPLOY_URL}/${NC}"
else
  echo "${YELLOW}⚠️ Could not automatically determine the deployed URL. Please check the Wrangler output above.${NC}"
fi
echo ""
echo "${GREEN}🎉 All done!${NC}"

# Only offer to POST example data if we created the database in this run
if [ "$D1_CREATE_OUTPUT" != "" ]; then
  if [ -n "$DEPLOY_URL" ]; then
    echo ""
    read "?Would you like to POST example Apache and Linux log data to your new endpoint now? (y/n)" REPLY
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
      echo "${CYAN}⏳ Sending example logs to ${DEPLOY_URL}/logs ...${NC}"
      # Example Apache log
      APACHE_LOG='127.0.0.1 - frank [10/Oct/2020:13:55:36 +0000] "GET /apache_pb.gif HTTP/1.0" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08 [en] (Win98; I ;Nav)"'
      # Example Linux syslog
      LINUX_LOG='Jun 15 12:34:56 myhost myservice: Something happened'
      # Send Apache log as base64 via raw_b64 (cross-platform)
      APACHE_LOG_B64=$(printf '%s' "$APACHE_LOG" | $BASE64_CMD)
      curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"raw_b64\": \"$APACHE_LOG_B64\"}" \
        "$DEPLOY_URL/logs" && echo "${GREEN}✔️ Apache log sent (base64)${NC}"
      # Send Linux log as base64 via raw_b64 (cross-platform)
      LINUX_LOG_B64=$(printf '%s' "$LINUX_LOG" | $BASE64_CMD)
      curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"raw_b64\": \"$LINUX_LOG_B64\"}" \
        "$DEPLOY_URL/logs" && echo "${GREEN}✔️ Linux syslog sent (base64)${NC}"
      echo "${GREEN}✅ Example logs posted!${NC}"
    else
      echo "${YELLOW}Skipping example log ingestion.${NC}"
    fi
  fi
fi
