#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${SCRIPT_DIR}/docker-compose.production.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-daoyou}"
ENV_FILE="${ENV_FILE:-/root/daoyou/.env.production}"
APP_IMAGE="${APP_IMAGE:-swkzymlyy/daoyou-app:latest}"
APP_NETWORK="${APP_NETWORK:-daoyou-runtime}"

BLUE_PORT="${BLUE_PORT:-3000}"
GREEN_PORT="${GREEN_PORT:-3001}"
BLUE_CONTAINER="${BLUE_CONTAINER:-daoyou-app-blue}"
GREEN_CONTAINER="${GREEN_CONTAINER:-daoyou-app-green}"
OPENRESTY_CONTAINER="${OPENRESTY_CONTAINER:-1Panel-openresty-PkPz}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/opt/1panel/www/sites/hk.daoyou.org/upstream/daoyou_backend.conf}"
HEALTH_PATH="${HEALTH_PATH:-/api/health-check}"
MAX_RETRIES="${MAX_RETRIES:-40}"
SLEEP_SECONDS="${SLEEP_SECONDS:-3}"
OLD_CONTAINER_GRACE_SECONDS="${OLD_CONTAINER_GRACE_SECONDS:-30}"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-/tmp/daoyou-app-blue-green.lock}"

export COMPOSE_FILE COMPOSE_PROJECT_NAME ENV_FILE APP_IMAGE APP_NETWORK
export BLUE_PORT GREEN_PORT BLUE_CONTAINER GREEN_CONTAINER

exec 9>"${DEPLOY_LOCK_FILE}"
if ! flock -n 9; then
  echo "Another app deployment is already running" >&2
  exit 1
fi

for command in docker curl flock sed cmp; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Required command not found: ${command}" >&2
    exit 1
  fi
done

if [ "${EUID}" -eq 0 ]; then
  PRIVILEGED=()
elif command -v sudo >/dev/null 2>&1; then
  PRIVILEGED=(sudo)
else
  echo "Run as root or install sudo to update OpenResty configuration" >&2
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "ENV_FILE not found: ${ENV_FILE}" >&2
  exit 1
fi
if [ ! -f "${UPSTREAM_CONF}" ]; then
  echo "OpenResty upstream config not found: ${UPSTREAM_CONF}" >&2
  exit 1
fi

compose() {
  docker compose -f "${COMPOSE_FILE}" -p "${COMPOSE_PROJECT_NAME}" "$@"
}

container_is_healthy() {
  local container="$1"
  [ "$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "${container}" 2>/dev/null || true)" = "healthy" ]
}

upstream_port() {
  sed -nE 's/^[[:space:]]*server[[:space:]]+127\.0\.0\.1:([0-9]+);.*$/\1/p' "${UPSTREAM_CONF}" | head -n 1
}

stop_and_remove_service() {
  local service="$1"
  compose --profile "${service#app-}" stop "${service}" >/dev/null 2>&1 || true
  compose --profile "${service#app-}" rm -sf "${service}" >/dev/null 2>&1 || true
}

service_container() {
  local service="$1"
  if [ "${service}" = "app-blue" ]; then
    printf '%s\n' "${BLUE_CONTAINER}"
  else
    printf '%s\n' "${GREEN_CONTAINER}"
  fi
}

service_port() {
  local service="$1"
  if [ "${service}" = "app-blue" ]; then
    printf '%s\n' "${BLUE_PORT}"
  else
    printf '%s\n' "${GREEN_PORT}"
  fi
}

active_service=""
current_port="$(upstream_port)"
if [ "${current_port}" = "${BLUE_PORT}" ] && container_is_healthy "${BLUE_CONTAINER}"; then
  active_service="app-blue"
elif [ "${current_port}" = "${GREEN_PORT}" ] && container_is_healthy "${GREEN_CONTAINER}"; then
  active_service="app-green"
fi

if [ "${active_service}" = "app-blue" ]; then
  target_service="app-green"
elif [ "${active_service}" = "app-green" ]; then
  target_service="app-blue"
else
  target_service="app-blue"
fi

target_container="$(service_container "${target_service}")"
target_port="$(service_port "${target_service}")"
target_profile="${target_service#app-}"
active_container=""
if [ -n "${active_service}" ]; then
  active_container="$(service_container "${active_service}")"
fi

echo "Active service: ${active_service:-none}"
echo "Target service: ${target_service} (${target_container}, 127.0.0.1:${target_port})"

compose --profile "${target_profile}" pull "${target_service}"
stop_and_remove_service "${target_service}"
compose --profile "${target_profile}" up -d --no-deps --force-recreate "${target_service}"

healthy=0
for ((attempt = 1; attempt <= MAX_RETRIES; attempt += 1)); do
  if container_is_healthy "${target_container}" && \
    curl --fail --silent --show-error "http://127.0.0.1:${target_port}${HEALTH_PATH}" >/dev/null; then
    healthy=1
    break
  fi
  sleep "${SLEEP_SECONDS}"
done

if [ "${healthy}" -ne 1 ]; then
  echo "New app service failed to become healthy" >&2
  compose --profile "${target_profile}" logs --tail 200 "${target_service}" >&2 || true
  stop_and_remove_service "${target_service}"
  exit 1
fi

backup="${UPSTREAM_CONF}.bak"
temporary="$(mktemp)"
trap 'rm -f "${temporary}"' EXIT

sed -E \
  "s/server[[:space:]]+127\.0\.0\.1:[0-9]+;/server 127.0.0.1:${target_port};/" \
  "${UPSTREAM_CONF}" >"${temporary}"

if cmp -s "${UPSTREAM_CONF}" "${temporary}"; then
  if [ "${current_port}" != "${target_port}" ]; then
    echo "No matching upstream server line found in ${UPSTREAM_CONF}" >&2
    stop_and_remove_service "${target_service}"
    exit 1
  fi

  echo "Upstream already points to ${target_service} on port ${target_port}"

  if ! "${PRIVILEGED[@]}" docker exec "${OPENRESTY_CONTAINER}" nginx -t; then
    echo "OpenResty configuration validation failed" >&2
    exit 1
  fi

  if ! "${PRIVILEGED[@]}" docker exec "${OPENRESTY_CONTAINER}" nginx -s reload; then
    echo "OpenResty reload failed" >&2
    exit 1
  fi

  echo "Traffic already points to ${target_service} on port ${target_port}"
  echo "App blue-green deployment completed"
  exit 0
fi

"${PRIVILEGED[@]}" cp "${UPSTREAM_CONF}" "${backup}"
"${PRIVILEGED[@]}" cp "${temporary}" "${UPSTREAM_CONF}"

if ! "${PRIVILEGED[@]}" docker exec "${OPENRESTY_CONTAINER}" nginx -t; then
  "${PRIVILEGED[@]}" cp "${backup}" "${UPSTREAM_CONF}"
  stop_and_remove_service "${target_service}"
  echo "OpenResty configuration validation failed; upstream restored" >&2
  exit 1
fi

if ! "${PRIVILEGED[@]}" docker exec "${OPENRESTY_CONTAINER}" nginx -s reload; then
  "${PRIVILEGED[@]}" cp "${backup}" "${UPSTREAM_CONF}"
  "${PRIVILEGED[@]}" docker exec "${OPENRESTY_CONTAINER}" nginx -s reload || true
  stop_and_remove_service "${target_service}"
  echo "OpenResty reload failed; upstream restored" >&2
  exit 1
fi

echo "Traffic switched to ${target_service} on port ${target_port}"

if [ -n "${active_container}" ]; then
  echo "Draining old service for ${OLD_CONTAINER_GRACE_SECONDS}s: ${active_container}"
  sleep "${OLD_CONTAINER_GRACE_SECONDS}"
  compose --profile "${active_service#app-}" stop "${active_service}" >/dev/null 2>&1 || true
fi

echo "App blue-green deployment completed"
