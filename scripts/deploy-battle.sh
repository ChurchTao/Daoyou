#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${SCRIPT_DIR}/docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-/root/daoyou/.env.production}"
BATTLE_IMAGE="${BATTLE_IMAGE:-swkzymlyy/daoyou-battle:latest}"
BATTLE_CONTAINER_NAME="${BATTLE_CONTAINER_NAME:-daoyou-battle}"
BATTLE_PORT="${BATTLE_PORT:-3100}"
APP_NETWORK="${APP_NETWORK:-daoyou-runtime}"
MAX_RETRIES="${MAX_RETRIES:-40}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"

export ENV_FILE BATTLE_IMAGE BATTLE_CONTAINER_NAME BATTLE_PORT APP_NETWORK

if [ ! -f "${ENV_FILE}" ]; then
  echo "ENV_FILE not found: ${ENV_FILE}" >&2
  exit 1
fi

echo "Pulling battle image: ${BATTLE_IMAGE}"
docker compose -f "${COMPOSE_FILE}" pull battle

echo "Deploying battle-server..."
docker compose -f "${COMPOSE_FILE}" up -d --no-deps --pull never battle

for ((attempt = 1; attempt <= MAX_RETRIES; attempt += 1)); do
  status="$(
    docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
      "${BATTLE_CONTAINER_NAME}" 2>/dev/null || true
  )"
  if [ "${status}" = "healthy" ] && \
    curl --fail --silent --show-error "http://127.0.0.1:${BATTLE_PORT}/healthz" >/dev/null; then
    echo "battle-server is healthy: ${BATTLE_CONTAINER_NAME}"
    exit 0
  fi
  sleep "${SLEEP_SECONDS}"
done

echo "battle-server failed to become healthy" >&2
docker compose -f "${COMPOSE_FILE}" logs --tail 200 battle >&2 || true
exit 1
