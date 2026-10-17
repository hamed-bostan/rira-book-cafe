#!/usr/bin/env bash
# Poll ghcr.io for a new :production image and redeploy if it changed.
# Invoked every ~2 minutes by rira-update.timer.
set -euo pipefail

cd /opt/rira

# One deploy at a time: a manual run racing the timer makes both try to create
# the same containers. A second run just exits.
exec 9>/tmp/rira-update.lock
flock -n 9 || { echo "Another rira update is running; skipping."; exit 0; }

# Fetch the latest :production manifest. No download if the digest is unchanged.
docker compose pull --quiet

# Recreate the app container ONLY if its image actually changed; else a no-op.
docker compose up -d

# Reclaim disk from superseded image layers.
docker image prune -f >/dev/null 2>&1 || true
