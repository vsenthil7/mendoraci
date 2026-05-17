#!/bin/sh
# MendoraCI bootstrap step 2 (runs AFTER 01-create-app-role.sql).
# Sets the mendoraci_app role password from $POSTGRES_APP_PASSWORD.
set -e

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" \
     -c "ALTER ROLE mendoraci_app WITH PASSWORD '$POSTGRES_APP_PASSWORD';"

echo "[02-finalize-app-role] mendoraci_app password set from env"
