#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_TAG="${IMAGE_TAG:-swkzymlyy/daoyou-hono:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-daoyou-hono}"
PORT="${PORT:-3000}"
ENV_FILE="${ENV_FILE:-/opt/daoyou/.env.production}"
HEALTHCHECK_PATH="${HEALTHCHECK_PATH:-/api/health-check}"
AUTO_PULL_IMAGE="${AUTO_PULL_IMAGE:-1}"
RESTART_POLICY="${RESTART_POLICY:-unless-stopped}"
AUTO_KILL_PORT_CONFLICT="${AUTO_KILL_PORT_CONFLICT:-0}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
WAIT_INTERVAL_SECONDS="${WAIT_INTERVAL_SECONDS:-1}"
LOG_TAIL_LINES="${LOG_TAIL_LINES:-200}"

RUN_ARGS=(--restart "${RESTART_POLICY}")

if [ ! -f "${ENV_FILE}" ]; then
  echo "==> ENV_FILE not found: ${ENV_FILE}" >&2
  echo "   Create the runtime env file first, or override ENV_FILE=/path/to/file" >&2
  exit 1
fi

RUN_ARGS+=(--env-file "${ENV_FILE}")

if [ "${AUTO_PULL_IMAGE}" = "1" ]; then
  echo "==> Pulling image: ${IMAGE_TAG}"
  docker pull "${IMAGE_TAG}"
elif ! docker image inspect "${IMAGE_TAG}" >/dev/null 2>&1; then
  echo "==> Image not found locally: ${IMAGE_TAG}" >&2
  echo "   Either run docker pull first, or set AUTO_PULL_IMAGE=1" >&2
  exit 1
fi

if docker ps -a --format '{{.Names}}' | awk -v name="${CONTAINER_NAME}" '$0 == name { found=1 } END { exit !found }'; then
  echo "==> Removing existing container: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

conflict_names="$(
  docker ps --format '{{.Names}} {{.Ports}}' \
    | awk -v p="${PORT}->3000/tcp" 'index($0, p) > 0 { print $1 }' \
    || true
)"

if [ -n "${conflict_names}" ]; then
  if [ "${AUTO_KILL_PORT_CONFLICT}" = "1" ]; then
    echo "==> Port conflict detected, removing containers on :${PORT} -> 3000/tcp:"
    while read -r n; do
      if [ -n "$n" ] && [ "$n" != "${CONTAINER_NAME}" ]; then
        echo "    - ${n}"
        docker rm -f "$n" >/dev/null 2>&1 || true
      fi
    done <<< "${conflict_names}"
  else
    echo "==> Port ${PORT} is already occupied by:" >&2
    while read -r n; do
      if [ -n "$n" ]; then
        echo "    - ${n}" >&2
      fi
    done <<< "${conflict_names}"
    echo "   Stop those containers first, or set AUTO_KILL_PORT_CONFLICT=1" >&2
    exit 1
  fi
fi

echo "==> Running container: ${CONTAINER_NAME} (port ${PORT}:3000)"
echo "==> Image: ${IMAGE_TAG}"
echo "==> Using env file: ${ENV_FILE}"
echo "==> Restart policy: ${RESTART_POLICY}"

docker run -d --name "${CONTAINER_NAME}" "${RUN_ARGS[@]}" -p "${PORT}:3000" "${IMAGE_TAG}" >/dev/null

echo "==> Waiting for server..."
for ((i = 1; i <= MAX_ATTEMPTS; i += 1)); do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${HEALTHCHECK_PATH}" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    echo "==> Ready: ${HEALTHCHECK_PATH} returned 200"
    exit 0
  fi
  sleep "${WAIT_INTERVAL_SECONDS}"
done

echo "==> Server not ready in time."
echo "   ${HEALTHCHECK_PATH} status: $(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${HEALTHCHECK_PATH}" 2>/dev/null || true)"
docker logs "${CONTAINER_NAME}" --tail="${LOG_TAIL_LINES}" || true
exit 1
