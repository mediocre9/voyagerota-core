#!/usr/bin/env bash
# one time setup of a fresh ubuntu droplet for VoyagerOTA....
# usage: sudo bash setup.sh voyagerota.com
# safe to run again, every step skips what is already done....
set -euo pipefail

DOMAIN="${1:-voyagerota.com}"
APP_USER="voyager"
BASE="/opt/voyagerota"
WEB_ROOT="/var/www/voyagerota"
CORE_REPO="git@github-core:mediocre9/voyagerota-core.git"
WEB_REPO="git@github-web:mediocre9/voyagerota-web.git"
BRANCH="${BRANCH:-unstable}"
NODE_MAJOR=22

step() { printf '\n\033[1;32m== %s\033[0m\n' "$1"; }
note() { printf '\033[0;33m%s\033[0m\n' "$1"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run it with sudo: sudo bash setup.sh $DOMAIN"
  exit 1
fi

step "1/12 packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw nginx mariadb-server redis-server certbot python3-certbot-nginx \
  unattended-upgrades ca-certificates gnupg logrotate
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt $NODE_MAJOR ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
echo "node $(node -v), npm $(npm -v)"

step "2/12 security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

step "3/12 swap (2 GB), a 1 GB droplet needs it while building"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
sysctl -q vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-voyagerota.conf
free -h

step "4/12 firewall: ssh, http, https only"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable
ufw status | head -5

step "5/12 mariadb, small and local only"
cat > /etc/mysql/mariadb.conf.d/99-voyagerota.cnf <<'EOF'
[mysqld]
bind-address = 127.0.0.1
innodb_buffer_pool_size = 128M
max_connections = 40
performance_schema = OFF
EOF
systemctl enable --now mariadb
systemctl restart mariadb

step "6/12 redis, local only and never evicting queue data"
if ! grep -q '# voyagerota' /etc/redis/redis.conf; then
  cat >> /etc/redis/redis.conf <<'EOF'

# voyagerota....
bind 127.0.0.1 ::1
maxmemory 96mb
maxmemory-policy noeviction
appendonly yes
EOF
fi
systemctl enable --now redis-server
systemctl restart redis-server

step "7/12 app user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$BASE" "$WEB_ROOT/releases"
chown -R "$APP_USER:$APP_USER" "$BASE" "$WEB_ROOT"

step "8/12 github deploy keys (read only, one per repo)"
SSH_DIR="/home/$APP_USER/.ssh"
sudo -u "$APP_USER" mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
for repo in core web; do
  key="$SSH_DIR/voyagerota_$repo"
  [[ -f "$key" ]] || sudo -u "$APP_USER" ssh-keygen -t ed25519 -N "" -C "voyagerota-$repo-deploy" -f "$key" >/dev/null
done
cat > "$SSH_DIR/config" <<EOF
Host github-core
  HostName github.com
  User git
  IdentityFile $SSH_DIR/voyagerota_core
  IdentitiesOnly yes
Host github-web
  HostName github.com
  User git
  IdentityFile $SSH_DIR/voyagerota_web
  IdentitiesOnly yes
EOF
chown "$APP_USER:$APP_USER" "$SSH_DIR/config"
chmod 600 "$SSH_DIR/config"
sudo -u "$APP_USER" bash -c "ssh-keyscan -t ed25519 github.com >> $SSH_DIR/known_hosts 2>/dev/null; sort -u -o $SSH_DIR/known_hosts $SSH_DIR/known_hosts"

if [[ ! -d "$BASE/core/.git" || ! -d "$BASE/web/.git" ]]; then
  note "Add these as READ-ONLY deploy keys on GitHub (repo > Settings > Deploy keys > Add deploy key):"
  echo
  echo "voyagerota-core:"; cat "$SSH_DIR/voyagerota_core.pub"; echo
  echo "voyagerota-web:";  cat "$SSH_DIR/voyagerota_web.pub"; echo
  read -rp "Press Enter once both keys are added on GitHub... "
fi

step "9/12 clone the repos ($BRANCH)"
[[ -d "$BASE/core/.git" ]] || sudo -u "$APP_USER" git clone -b "$BRANCH" "$CORE_REPO" "$BASE/core"
[[ -d "$BASE/web/.git" ]] || sudo -u "$APP_USER" git clone -b "$BRANCH" "$WEB_REPO" "$BASE/web"

step "10/12 database, user and settings files"
ENV_FILE="$BASE/core/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  KEEP_SECRET="$(openssl rand -hex 32)"
  mariadb <<EOF
CREATE DATABASE IF NOT EXISTS voyagerota CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'voyagerota'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER 'voyagerota'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON voyagerota.* TO 'voyagerota'@'localhost';
FLUSH PRIVILEGES;
EOF
  sed -e "s|^DB_PASSWORD=GENERATED|DB_PASSWORD=$DB_PASSWORD|" \
      -e "s|^KEEP_LINK_SECRET=GENERATED|KEEP_LINK_SECRET=$KEEP_SECRET|" \
      -e "s|voyagerota\.com|$DOMAIN|g" \
      "$BASE/core/deploy/env.production.example" > "$ENV_FILE"
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  note "Created $ENV_FILE with a generated database password and keep link secret."
fi
WEB_ENV="$BASE/web/.env.app.local"
if [[ ! -f "$WEB_ENV" ]]; then
  echo "VITE_CLERK_PUBLISHABLE_KEY=" > "$WEB_ENV"
  chown "$APP_USER:$APP_USER" "$WEB_ENV"
fi
sudo -u "$APP_USER" mkdir -p "$BASE/core/logs" "$BASE/core/storage/trash"

step "11/12 services, sudo rule, logs, nightly backup"
install -m 644 "$BASE/core/deploy/systemd/voyager-api.service" /etc/systemd/system/
install -m 644 "$BASE/core/deploy/systemd/voyager-workers.service" /etc/systemd/system/
install -m 644 "$BASE/core/deploy/systemd/voyager-crons.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable voyager-api voyager-workers voyager-crons

# the service alert cron may restart only mariadb and redis....
cat > /etc/sudoers.d/voyagerota <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart mysql, /usr/bin/systemctl restart redis, /usr/bin/systemctl restart mariadb, /usr/bin/systemctl restart redis-server
EOF
chmod 440 /etc/sudoers.d/voyagerota
visudo -cf /etc/sudoers.d/voyagerota >/dev/null

cat > /etc/logrotate.d/voyagerota <<EOF
$BASE/core/logs/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/voyagerota.conf
systemctl restart systemd-journald

cat > /etc/cron.d/voyagerota <<EOF
# nightly database backup to r2....
15 3 * * * $APP_USER /bin/bash $BASE/core/deploy/backup.sh >> $BASE/core/logs/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/voyagerota

step "12/12 nginx for $DOMAIN, www, docs, app and api"
install -m 644 "$BASE/core/deploy/nginx/voyagerota-static.conf" /etc/nginx/snippets/voyagerota-static.conf
sed "s/__DOMAIN__/$DOMAIN/g" "$BASE/core/deploy/nginx/voyagerota.conf" > /etc/nginx/sites-available/voyagerota.conf
ln -sf /etc/nginx/sites-available/voyagerota.conf /etc/nginx/sites-enabled/voyagerota.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

cat <<EOF

$(printf '\033[1;32m')Server is set up.$(printf '\033[0m')

Next:
  1. Fill in the empty settings (never paste them anywhere else):
       sudo -u $APP_USER nano $ENV_FILE
       sudo -u $APP_USER nano $WEB_ENV        (Clerk pk_live key)
  2. Make sure DNS for $DOMAIN, www, docs, app and api points at this droplet, then:
       sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d docs.$DOMAIN -d app.$DOMAIN -d api.$DOMAIN
  3. First deploy:
       sudo bash $BASE/core/deploy/deploy.sh
EOF
