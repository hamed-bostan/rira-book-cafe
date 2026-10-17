#!/usr/bin/env bash
# One-time VPS setup for Rira (Ubuntu 24.04, run as root from the repo's deploy/ copy):
#   - a `deploy` user in the docker group that owns /opt/rira
#   - /opt/rira with docker-compose.yml, nginx config and a .env.production stub
#   - the rira-update timer that pulls ghcr.io/...:production every 2 minutes
# Idempotent: safe to re-run; it never overwrites an existing .env.production.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR=/opt/rira

command -v docker >/dev/null || { echo "Docker is not installed." >&2; exit 1; }

id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy

mkdir -p "$APP_DIR/nginx/conf.d" "$APP_DIR/certbot/www" "$APP_DIR/certbot/conf"
install -m 644 "$SRC/docker-compose.yml" "$APP_DIR/docker-compose.yml"
install -m 644 "$SRC/nginx/conf.d/rira.conf" "$APP_DIR/nginx/conf.d/rira.conf"
install -m 644 "$SRC/nginx/rira-https.conf.example" "$APP_DIR/nginx/rira-https.conf.example"

if [ ! -f "$APP_DIR/.env.production" ]; then
  db_password="$(openssl rand -hex 24)"
  sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_password|" \
      -e "s|rira:PASSWORD@db|rira:$db_password@db|" \
      -e "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -base64 32)|" \
      "$SRC/.env.production.example" > "$APP_DIR/.env.production"
  chmod 600 "$APP_DIR/.env.production"
  echo "Created $APP_DIR/.env.production — fill in SMS.ir, ADMIN_USER_IDS, etc."
fi
chown -R deploy:deploy "$APP_DIR"

install -m 755 "$SRC/deploy/rira-update.sh" /usr/local/bin/rira-update.sh
install -m 644 "$SRC/deploy/rira-update.service" /etc/systemd/system/rira-update.service
install -m 644 "$SRC/deploy/rira-update.timer" /etc/systemd/system/rira-update.timer
systemctl daemon-reload
systemctl enable --now rira-update.timer

echo "Done. First deploy: sudo -u deploy /usr/local/bin/rira-update.sh"
