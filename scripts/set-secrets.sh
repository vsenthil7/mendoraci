#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"
[ -f "$ENV_FILE" ] || cp "$REPO_ROOT/.env.example" "$ENV_FILE"
gen() { head -c 48 /dev/urandom | base64 | tr -d '=\n' | tr '+/' '-_' | head -c "${1:-32}"; }
sedi() { if [[ "$OSTYPE" == "darwin"* ]]; then sed -i '' "$@"; else sed -i "$@"; fi; }
PG=$(gen 24); S3=$(gen 24); JWT=$(gen 48); HMAC=$(gen 48)
sedi "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG|" "$ENV_FILE"
sedi "s|^S3_SECRET_KEY=.*|S3_SECRET_KEY=$S3|" "$ENV_FILE"
sedi "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" "$ENV_FILE"
sedi "s|^HMAC_TENANT_SEED=.*|HMAC_TENANT_SEED=$HMAC|" "$ENV_FILE"
sedi "s|^DATABASE_URL=postgresql://[^@]*@|DATABASE_URL=postgresql://mendoraci_app:$PG@|" "$ENV_FILE"
echo
read -r -s -p "BOB_API_KEY (Enter to skip => mock Bob): " BK; echo
if [ -n "$BK" ]; then
  read -r -p "BOB_API_URL: " BU
  read -r -p "BOB_MODEL_ID (default bob-default): " BM; BM=${BM:-bob-default}
  sedi "s|^BOB_API_KEY=.*|BOB_API_KEY=$BK|" "$ENV_FILE"
  sedi "s|^BOB_API_URL=.*|BOB_API_URL=$BU|" "$ENV_FILE"
  sedi "s|^BOB_MODEL_ID=.*|BOB_MODEL_ID=$BM|" "$ENV_FILE"
  sedi "s|^USE_MOCK_BOB=.*|USE_MOCK_BOB=false|" "$ENV_FILE"
fi
read -r -s -p "ANTHROPIC_API_KEY (Enter to skip): " AK; echo
[ -z "$AK" ] || sedi "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$AK|" "$ENV_FILE"
echo ".env populated. Next: docker compose up --build"
