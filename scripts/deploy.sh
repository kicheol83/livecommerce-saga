#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml)
HISTORY=.deploy-history
APP_SERVICES=(auth-service inventory-service payment-service order-service live-service delivery-service api-gateway frontend)
HEALTH_URLS=(
  http://auth-service:8085/actuator/health
  http://inventory-service:8083/actuator/health
  http://payment-service:8082/actuator/health
  http://order-service:8081/actuator/health
  http://live-service:8084/actuator/health
  http://delivery-service:8086/actuator/health
  http://api-gateway:8080/actuator/health
  http://frontend:3000/
)

wait_ready() {
  for _ in $(seq 1 60); do
    local pending=""
    for url in "${HEALTH_URLS[@]}"; do
      if ! "${COMPOSE[@]}" exec -T edge wget -qO /dev/null "$url" >/dev/null 2>&1; then
        pending="$url"
        break
      fi
    done
    if [ -z "$pending" ]; then
      return 0
    fi
    sleep 3
  done
  echo "still not healthy: $pending" >&2
  return 1
}

set_env_tag() {
  touch .env
  sed -i '/^APP_TAG=/d' .env
  echo "APP_TAG=$1" >> .env
}

previous="$(grep -E '^APP_TAG=' .env 2>/dev/null | tail -n 1 | cut -d= -f2 || true)"

git fetch --quiet
if git grep -qE '^(<<<<<<<|>>>>>>>)( |$)' '@{u}' -- .; then
  echo "merge conflict markers found in upstream, deploy aborted" >&2
  git grep -lE '^(<<<<<<<|>>>>>>>)( |$)' '@{u}' -- . >&2
  exit 1
fi
git merge --ff-only '@{u}'

sha="$(git rev-parse --short HEAD)"
export APP_TAG="$sha"

"${COMPOSE[@]}" build "${APP_SERVICES[@]}"
"${COMPOSE[@]}" up -d "${APP_SERVICES[@]}"

if ! wait_ready; then
  echo "services are not healthy after 180s on $sha" >&2
  if [ -n "$previous" ]; then
    echo "roll back with: ./scripts/rollback.sh $previous" >&2
  fi
  exit 1
fi

set_env_tag "$sha"
echo "$sha" >> "$HISTORY"
echo "deployed $sha"
