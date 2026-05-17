#!/bin/sh
# Guard: refuse to start postgres if POSTGRES_APP_PASSWORD is missing.
# Without it 02-finalize-app-role.sh would silently set an empty password.
set -e

if [ -z "$POSTGRES_APP_PASSWORD" ]; then
  echo "[00-guard] FATAL: POSTGRES_APP_PASSWORD env var not set"
  exit 1
fi

echo "[00-guard] POSTGRES_APP_PASSWORD present (len=${#POSTGRES_APP_PASSWORD})"
