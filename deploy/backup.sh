#!/usr/bin/env bash
# nightly database dump to the r2 backups bucket, old ones are removed after BACKUP_KEEP_DAYS....
# run by cron as the voyager user, or by hand: sudo -u voyager bash backup.sh
set -euo pipefail

CORE="${CORE:-/opt/voyagerota/core}"
ENV_FILE="${ENV_FILE:-$CORE/.env}"
# a missing setting reads as empty instead of stopping the script....
env_get() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n 1 | cut -d= -f2-; }
storage() { (cd "$CORE" && node --env-file="$ENV_FILE" --import tsx src/scripts/backup.storage.ts "$@"); }

DB_NAME="$(env_get DB_NAME)"
DB_USER="$(env_get DB_USERNAME)"
KEEP_DAYS="$(env_get BACKUP_KEEP_DAYS)"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [[ -z "$(env_get BACKUP_R2_BUCKET)" || -z "$(env_get BACKUP_R2_ACCESS_KEY_ID)" ]]; then
  echo "$(date -Is) backup skipped: BACKUP_R2_* settings are empty in $ENV_FILE"
  exit 1
fi

FILE="voyagerota-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

MYSQL_PWD="$(env_get DB_PASSWORD)" mariadb-dump --single-transaction --quick --routines \
  -u "$DB_USER" "$DB_NAME" | gzip -9 > "$TMP/$FILE"

storage upload "$TMP/$FILE"
storage prune "$KEEP_DAYS"

echo "$(date -Is) backup ok: $FILE ($(du -h "$TMP/$FILE" | cut -f1))"
