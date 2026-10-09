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

current="$(grep -E '^APP_TAG=' .env 2>/dev/null | tail -n 1 | cut -d= -f2 || true)"
previous="$(awk -v cur="${current:-}" '{ line[NR] = $0; if ($0 == cur) last = NR } END { for (i = last - 1; i > 0; i--) if (line[i] != cur) { print line[i]; exit } }' "$HISTORY" 2>/dev/null || true)"
target="${1:-$previous}"

if [ -z "$target" ]; then
  echo "no previous version in $HISTORY; pass a tag: ./scripts/rollback.sh <sha>" >&2
  exit 1
fi

for service in "${APP_SERVICES[@]}"; do
  if ! docker image inspect "livecommerce-$service:$target" >/dev/null 2>&1; then
    echo "image livecommerce-$service:$target not found" >&2
    exit 1
  fi
done

export APP_TAG="$target"
"${COMPOSE[@]}" up -d --no-deps --force-recreate "${APP_SERVICES[@]}"

for _ in $(seq 1 60); do
  pending=""
  for url in "${HEALTH_URLS[@]}"; do
    if ! "${COMPOSE[@]}" exec -T edge wget -qO /dev/null "$url" >/dev/null 2>&1; then
      pending="$url"
      break
    fi
  done
  if [ -z "$pending" ]; then
    sed -i '/^APP_TAG=/d' .env
    echo "APP_TAG=$target" >> .env
    echo "rolled back from ${current:-unknown} to $target"
    exit 0
  fi
  sleep 3
done

echo "services are not healthy after 180s on $target: $pending" >&2
exit 1
