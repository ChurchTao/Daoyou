#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

IMAGE_TAG="${IMAGE_TAG:-daoyou-hono-bun:local}"
CONTAINER_NAME="${CONTAINER_NAME:-daoyou-hono-bun-local}"
PORT="${PORT:-3000}"
ENV_FILE="${ENV_FILE:-}"
HEALTHCHECK_PATH="${HEALTHCHECK_PATH:-/api/health-check}"

BUILD_ARGS=()
RUN_ARGS=()

if [ -n "${VITE_TURNSTILE_SITE_KEY:-}" ]; then
  BUILD_ARGS+=(--build-arg "VITE_TURNSTILE_SITE_KEY=${VITE_TURNSTILE_SITE_KEY}")
fi

if [ -n "${ENV_FILE}" ]; then
  if [ ! -f "${ENV_FILE}" ]; then
    echo "==> ENV_FILE not found: ${ENV_FILE}" >&2
    exit 1
  fi
  RUN_ARGS+=(--env-file "${ENV_FILE}")
fi

echo "==> Building image: ${IMAGE_TAG}"
docker build "${BUILD_ARGS[@]}" -t "${IMAGE_TAG}" -f Dockerfile .

if docker ps -a --format '{{.Names}}' | awk -v name="${CONTAINER_NAME}" '$0 == name { found=1 } END { exit !found }'; then
  echo "==> Removing existing container: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "==> Running container: ${CONTAINER_NAME} (port ${PORT}:3000)"
if [ -n "${ENV_FILE}" ]; then
  echo "==> Using env file: ${ENV_FILE}"
fi

# 如果端口已被占用，自动清理冲突容器（可通过 AUTO_KILL_PORT_CONFLICT 关闭）
if [ "${AUTO_KILL_PORT_CONFLICT:-1}" = "1" ]; then
  conflict_names="$(
    docker ps --format '{{.Names}} {{.Ports}}' \
      | awk -v p="${PORT}->3000/tcp" 'index($0, p) > 0 { print $1 }' \
      || true
  )"

  if [ -n "${conflict_names}" ]; then
    echo "==> Port conflict detected, removing containers on :${PORT} -> 3000/tcp:"
    while read -r n; do
      if [ -n "$n" ] && [ "$n" != "${CONTAINER_NAME}" ]; then
        echo "    - ${n}"
        docker rm -f "$n" >/dev/null 2>&1 || true
      fi
    done <<< "${conflict_names}"
  fi
fi

docker run -d --name "${CONTAINER_NAME}" "${RUN_ARGS[@]}" -p "${PORT}:3000" "${IMAGE_TAG}" >/dev/null

echo "==> Waiting for server..."
for i in {1..20}; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${HEALTHCHECK_PATH}" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    echo "==> Ready: ${HEALTHCHECK_PATH} returned 200"
    exit 0
  fi
  sleep 0.5
done

echo "==> Server not ready in time."
echo "   ${HEALTHCHECK_PATH} status: $(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:${PORT}${HEALTHCHECK_PATH}" 2>/dev/null || true)"
docker logs "${CONTAINER_NAME}" --tail=200 || true
exit 1
