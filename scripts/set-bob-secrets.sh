#!/usr/bin/env bash
# MendoraCI - Bob AI credential setter (bash)
# Usage: bash scripts/set-bob-secrets.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo
echo "MendoraCI - Set IBM Bob AI credentials (.env.bob)"
echo "Repo: $(pwd)"
echo

read -p  "BOB_API_URL (e.g. https://us-south.ml.cloud.ibm.com): " BOB_API_URL
read -rsp "BOB_API_KEY: " BOB_API_KEY; echo
read -p  "BOB_PROJECT_ID  (blank if using deployment_id): " BOB_PROJECT_ID
read -p  "BOB_DEPLOYMENT_ID (blank if using project_id):   " BOB_DEPLOYMENT_ID
read -p  "BOB_MODEL_ID (default ibm/granite-13b-instruct-v2): " BOB_MODEL_ID
: "${BOB_MODEL_ID:=ibm/granite-13b-instruct-v2}"

[ -z "$BOB_API_URL" ] && { echo "BOB_API_URL required"; exit 1; }
[ -z "$BOB_API_KEY" ] && { echo "BOB_API_KEY required"; exit 1; }
if [ -z "$BOB_PROJECT_ID" ] && [ -z "$BOB_DEPLOYMENT_ID" ]; then
  echo "At least one of BOB_PROJECT_ID or BOB_DEPLOYMENT_ID required"; exit 1
fi

cat > .env.bob <<EOF
BOB_API_URL=$BOB_API_URL
BOB_API_KEY=$BOB_API_KEY
BOB_PROJECT_ID=$BOB_PROJECT_ID
BOB_DEPLOYMENT_ID=$BOB_DEPLOYMENT_ID
BOB_MODEL_ID=$BOB_MODEL_ID
USE_MOCK_BOB=false
BOB_MAX_INPUT_TOKENS=8000
BOB_MAX_OUTPUT_TOKENS=2000
EOF
echo "Wrote .env.bob (gitignored)"

if [ -f .env ]; then
  if grep -q "^USE_MOCK_BOB=" .env; then
    sed -i.bak 's/^USE_MOCK_BOB=.*/USE_MOCK_BOB=false/' .env && rm -f .env.bak
  else
    printf '\nUSE_MOCK_BOB=false\n' >> .env
  fi
  echo "Flipped USE_MOCK_BOB=false in .env"
fi

echo "Restarting api container..."
docker compose up -d --force-recreate api
echo "Done. Verify: docker compose exec api env | grep BOB_"
