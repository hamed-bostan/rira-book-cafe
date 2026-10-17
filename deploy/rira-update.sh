#!/usr/bin/env bash
# Poll ghcr.io for a new :production image and redeploy if it changed.
# Invoked every ~2 minutes by rira-update.timer.
set -euo pipefail

cd /opt/rira

# Fetch the latest :production manifest. No download if the digest is unchanged.
docker compose pull --quiet

# Recreate the app container ONLY if its image actually changed; else a no-op.
docker compose up -d

# Reclaim disk from superseded image layers.
docker image prune -f >/dev/null 2>&1 || true
