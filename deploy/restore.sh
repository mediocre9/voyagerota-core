#!/usr/bin/env bash
# restores a database dump from the r2 backups bucket....
# usage: sudo bash restore.sh              lists the backups
#        sudo bash restore.sh latest       restores the newest one
#        sudo bash restore.sh <file name>  restores that one
set -euo pipefail

CORE="${CORE:-/opt/voyagerota/core}"
ENV_FILE="${ENV_FILE:-$CORE/.env}"
env_get() { { grep -E "^$1=" "$ENV_FILE" || true; } | tail -n 1 | cut -d= -f2-; }
storage() { (cd "$CORE" && node --env-file="$ENV_FILE" --import tsx src/scripts/backup.storage.ts "$@"); }

DB_NAME="$(env_get DB_NAME)"
DB_USER="$(env_get DB_USERNAME)"

if [[ $# -eq 0 ]]; then
  storage list
  exit 0
fi

FILE="$1"
[[ "$FILE" == "latest" ]] && FILE="$(storage latest)"
[[ -n "$FILE" ]] || { echo "No backups found."; exit 1; }

echo "This replaces the database '$DB_NAME' with $FILE."
read -rp "Type the database name to continue: " answer
[[ "$answer" == "$DB_NAME" ]] || { echo "Cancelled."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
storage download "$FILE" "$TMP/$FILE"

# nothing writes while the dump goes in....
systemctl stop voyager-api voyager-workers voyager-crons 2>/dev/null || true
gunzip -c "$TMP/$FILE" | MYSQL_PWD="$(env_get DB_PASSWORD)" mariadb -u "$DB_USER" "$DB_NAME"
systemctl start voyager-workers voyager-crons voyager-api 2>/dev/null || true

echo "Restored $FILE."
