#!/usr/bin/env bash
# deploys core and web together, rolls back by itself if the api doesn't come up....
# usage: sudo bash deploy.sh                 latest of the branch (unstable)
#        sudo bash deploy.sh <ref>           a tag or commit, the same ref in both repos
#        sudo bash deploy.sh <core>:<web>    different refs for core and web
#        sudo bash deploy.sh --rollback      the previous good deploy
set -Eeuo pipefail

APP_USER="voyager"
BASE="/opt/voyagerota"
WEB_ROOT="/var/www/voyagerota"
BRANCH="${BRANCH:-unstable}"
STATE="$BASE/deploys.log"
SERVICES=(voyager-workers voyager-crons voyager-api)
KEEP_RELEASES=5

step() { printf '\n\033[1;32m== %s\033[0m\n' "$1"; }
fail() { printf '\033[1;31m%s\033[0m\n' "$1"; }
as_app() { sudo -u "$APP_USER" -H bash -c "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run it with sudo: sudo bash deploy.sh"
  exit 1
fi

ARG="${1:-}"
# a deploy is a pair of refs, core:web, the log keeps the pair so rollbacks match....
if [[ "$ARG" == "--rollback" ]]; then
  ARG="$(tail -n 2 "$STATE" 2>/dev/null | head -n 1 | awk '{print $2":"$3}')"
  [[ "$ARG" != ":" && -n "$ARG" ]] || { fail "No previous deploy to roll back to."; exit 1; }
  ROLLING_BACK=true
  echo "Rolling back to $ARG"
fi
ROLLING_BACK="${ROLLING_BACK:-false}"
CORE_REF="${ARG%%:*}"
WEB_REF="${ARG#*:}"
CORE_REF="${CORE_REF:-origin/$BRANCH}"
WEB_REF="${WEB_REF:-$CORE_REF}"

PREVIOUS="$(tail -n 1 "$STATE" 2>/dev/null | awk '{print $2":"$3}' || true)"

# a failure before the services restart puts the code back, so a later crash restart
# never loads a half deployed version....
SWITCHED=false
restore_checkout() {
  [[ "$SWITCHED" == true || -z "$PREVIOUS" || "$PREVIOUS" == ":" ]] && return
  fail "Deploy failed, putting the code back to ${PREVIOUS%%:*}"
  as_app "cd $BASE/core && git checkout -q --detach ${PREVIOUS%%:*} && npm ci --no-audit --no-fund --silent" || true
  as_app "cd $BASE/web && git checkout -q --detach ${PREVIOUS#*:}" || true
}
trap restore_checkout ERR

step "fetch core $CORE_REF, web $WEB_REF"
as_app "cd $BASE/core && git fetch --tags --prune origin"
as_app "cd $BASE/web && git fetch --tags --prune origin"
CORE_SHA="$(as_app "cd $BASE/core && git rev-parse --verify '$CORE_REF^{commit}'")"
if ! WEB_SHA="$(as_app "cd $BASE/web && git rev-parse --verify '$WEB_REF^{commit}'" 2>/dev/null)"; then
  echo "web has no $WEB_REF, using origin/$BRANCH"
  WEB_SHA="$(as_app "cd $BASE/web && git rev-parse --verify 'origin/$BRANCH^{commit}'")"
fi
as_app "cd $BASE/core && git checkout -q --detach $CORE_SHA"
as_app "cd $BASE/web && git checkout -q --detach $WEB_SHA"
echo "core $CORE_SHA"
echo "web  $WEB_SHA"

step "install core"
as_app "cd $BASE/core && npm ci --no-audit --no-fund"

step "build web (landing, docs, app)"
as_app "cd $BASE/web && npm ci --no-audit --no-fund && npm run build:sites"
RELEASE="$WEB_ROOT/releases/$(date +%Y%m%d%H%M%S)-${WEB_SHA:0:7}"
as_app "mkdir -p $RELEASE && cp -r $BASE/web/dist-landing $RELEASE/landing && cp -r $BASE/web/dist-docs $RELEASE/docs && cp -r $BASE/web/dist-app $RELEASE/app"

SWITCHED=true
trap - ERR
step "restart services"
for service in "${SERVICES[@]}"; do
  systemctl restart "$service"
  sleep 2
done

step "health check"
healthy=false
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then healthy=true; break; fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  fail "The api didn't answer /health. Recent api logs:"
  journalctl -u voyager-api -n 30 --no-pager || true
  if [[ -n "$PREVIOUS" && "$PREVIOUS" != ":" && "$ROLLING_BACK" != true ]]; then
    fail "Rolling back to $PREVIOUS"
    ROLLING_BACK=true exec bash "$0" "$PREVIOUS"
  fi
  exit 1
fi

# the sites switch over in one step, visitors never see a half copied build....
ln -sfn "$RELEASE" "$WEB_ROOT/current.new"
mv -Tf "$WEB_ROOT/current.new" "$WEB_ROOT/current"
nginx -t >/dev/null 2>&1 && systemctl reload nginx

ls -1dt "$WEB_ROOT"/releases/* 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
echo "$(date -Is) $CORE_SHA $WEB_SHA" >> "$STATE"
chown "$APP_USER:$APP_USER" "$STATE"

for service in "${SERVICES[@]}"; do
  printf '%-16s %s\n' "$service" "$(systemctl is-active "$service")"
done
step "deployed core ${CORE_SHA:0:7}, web ${WEB_SHA:0:7}"
