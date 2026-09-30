# LiveCommerce Saga

A live commerce platform that runs limited-quantity flash sales during a live broadcast. Orders, payments and inventory are independent Spring Boot microservices kept consistent with **Saga orchestration** and the **transactional outbox** pattern. Payments go through Toss Payments.

[한국어](README.md) | **English**

**Live Demo:** https://live.javohir.dev · UI languages: Korean (default) / English / Uzbek

![LiveCommerce Saga screens](docs/images/hero.png)

<sub>Screens were captured locally with demo data. The distributed tracing screen and all load test figures come from real runs.</sub>

## At a glance

| Area | Result |
| --- | --- |
| 1,000 purchase attempts racing for 100 units | 0 oversold units, 0 mismatches between charges and sold units, 0 HTTP errors (3 repeated runs) |
| Performance work | Sell-out time 1m 27s → about 23s, order creation p95 5.72s → 2.68s |
| Failure recovery | 0 lost events and 0 double charges in Kafka and database outage chaos tests |
| Live broadcast | 500 concurrent viewers, 99.2% of stock updates delivered, 98% fewer viewer count messages |
| Tests | 22 integration tests, 3 chaos tests, 3 k6 load scenarios |

## Key design decisions

- **Hold-then-pay saga**: stock is held for 10 minutes before the buyer pays, so a sold-out item never has to be charged and refunded.
- **Transactional outbox**: state changes and their events are written in one database transaction, and an event is marked published only after the broker acknowledges it. A Kafka outage loses nothing.
- **Idempotency**: Toss confirmation uses an `Idempotency-Key`, payments and stock holds are idempotent per `order_id`, and every order transition is allowed only from its expected previous state under `@Version`.
- **Tamper-proof amounts**: the server computes the amount; a client-submitted amount that differs is rejected with `AMOUNT_MISMATCH` before Toss is ever called.
- **Security boundary**: the gateway verifies JWTs and rewrites identity headers. Refresh tokens rotate on every use, and reuse revokes the whole session family.
- **Courier webhooks**: HMAC signatures, replay protection, duplicate suppression, and a status that never moves backwards when events arrive out of order.
- **Observability**: the outbox stores the W3C `traceparent`, so a saga that crosses Kafka stays a single trace.

## Tech stack

| Area | Technology |
| --- | --- |
| Backend | Kotlin, Spring Boot 3.3, Spring Cloud Gateway, Spring Data JPA, Spring Kafka, WebSocket/STOMP |
| Data | PostgreSQL 16 (one database per service), Apache Kafka 3.9 (KRaft), Flyway |
| Observability | Micrometer Tracing, OpenTelemetry, Jaeger |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Toss Payments SDK |
| Testing | JUnit 5 integration and chaos tests, k6 |

## Architecture

```
Browser ── Next.js ── API Gateway (JWT) ─┬─ auth-service
                                         ├─ order-service (saga orchestrator)
                                         ├─ live-service (STOMP: chat, stock, viewers)
                                         └─ delivery-service (shipments, courier webhooks)

order-service ── REST ──> inventory-service ──(outbox)──> Kafka ──> order-service
order-service ── REST ──> payment-service ──> Toss Payments
                               └────────(outbox)──> Kafka ──> order-service
order-service ──(outbox)──> Kafka ──> delivery-service ──> courier webhooks
inventory-service ──(outbox)──> Kafka ──> live-service ──> viewers' browsers
```

| Service | Port | Responsibility |
| --- | --- | --- |
| `api-gateway` | 8080 | Single entry point, JWT verification, authorization, routing, WebSocket proxy |
| `order-service` | 8081 | Order saga orchestration, order status WebSocket, recovery scheduler |
| `payment-service` | 8082 | Toss Payments confirmation and cancellation |
| `inventory-service` | 8083 | Stock holds, confirmation and release, hold expiry |
| `live-service` | 8084 | Live chat, real-time stock, viewer count |
| `auth-service` | 8085 | Sign-up, login, RS256 JWT, JWKS, refresh tokens, default shipping address |
| `delivery-service` | 8086 | Shipment creation, courier webhook intake, courier simulator |

Each service owns its PostgreSQL database; services read each other's data only through APIs or events.

## Order saga: hold stock, then pay

```
AWAITING_STOCK → AWAITING_PAYMENT → PAYMENT_CONFIRMING → CONFIRMING_STOCK → COMPLETED
       ↓                ↓                  ↓                    ↓
   CANCELLED        CANCELLED          CANCELLED       COMPENSATING → CANCELLED
```

1. The buyer sends `POST /api/orders` with product, quantity and shipping address only, never a price. The order starts in `AWAITING_STOCK`.
2. Inventory holds the stock for 10 minutes (`HELD`) and returns the unit price in `InventoryReserved`. Order-service computes the amount itself and moves to `AWAITING_PAYMENT`. The payment window is 5 minutes and always closes at least 60 seconds before the hold expires.
3. The buyer pays in the Toss window, and the browser posts `paymentKey` and amount to `POST /api/orders/{id}/payment`. An amount that differs from the server's is rejected with `AMOUNT_MISMATCH`.
4. Payment-service calls Toss `/v1/payments/confirm` with an `Idempotency-Key`. The external call runs outside any database transaction; its result is written together with the outbox event in one transaction.
5. Once payment is confirmed, inventory finalizes the hold (`CONFIRMED`) and the order becomes `COMPLETED`. The completion event travels through order-service's own outbox to delivery-service, which starts the shipment.

**Why this order**: in a flash sale, selling out is the normal case, not the exception. Charging first and checking stock later turns every sell-out into a refund, which costs both buyer trust and PG fees. Holding stock first limits refunds to the rare race between hold expiry and payment.

## Screens

### Live broadcast

<img src="docs/images/live-room.png" width="320" alt="Live broadcast screen">

Stock is shown as two rows of knit stitches rather than a plain progress bar. Stitches unravel as units sell, and below 20% the color shifts and a closing-soon label appears. The chat author comes from the token verified at STOMP `CONNECT`, never from client-supplied text.

### Shipping address and payment

<img src="docs/images/checkout-address.png" width="320" alt="Shipping address"> <img src="docs/images/payment-success.png" width="320" alt="Payment completed">

On the first purchase the buyer enters an address, which is saved as the default and the order continues immediately. Addresses are searched with the Daum (Kakao) postcode service. Once stock is held, the Toss Payments widget opens inside the order sheet, and after payment the saga steps update live.

### My orders and delivery tracking

<img src="docs/images/my-orders.png" width="320" alt="My orders">

Every completed order shows the paid → preparing → shipped → in transit → delivered steps, the carrier, the tracking number and the tracking history. Delivery status refreshes live until delivery and then stops polling.

### Operations console

![Operations dashboard](docs/images/admin-dashboard.png)

![Saga inspector](docs/images/saga-inspector.png)

`/admin` is open only to the `ADMIN` role. The dashboard refreshes orders, conversion, revenue, average completion time, stalled orders, orders per minute and per-service outbox health every 5 seconds. The **saga inspector** plots one order's journey across the order, payment and inventory services on a time axis; each dot's color shows whether that event reached Kafka. Operators can retry a stalled step immediately, cancel an unpaid order, and edit stock and price.

### Distributed tracing

![Jaeger trace](docs/images/jaeger-trace.png)

A real trace of one order request flowing gateway → order → inventory → Kafka → order and live. Without load, about 65 ms pass between the stock hold and order-service receiving the event.

## Failure scenarios and recovery

| Failure | System behavior | Verified by |
| --- | --- | --- |
| Kafka is down | The outbox relay marks an event `PUBLISHED` only after the broker acknowledges it; until then it stays `PENDING` and is resent | `chaosTest`: an order created during the outage is paid and `COMPLETED` after Kafka returns |
| Payment database down during confirmation | The order stays in `PAYMENT_CONFIRMING` and the recovery scheduler retries. Toss receives the same `Idempotency-Key`, so there is no double charge | `chaosTest`: one payment recorded and the order `COMPLETED` after recovery |
| Inventory does not respond | The stock hold is retried three times, then the order is cancelled without any charge | `chaosTest`: `inventory step timed out`, zero payments |
| Card declined | The order is cancelled and the held stock is released immediately | `SagaEndToEndTest` |
| Client tampers with the amount | `AMOUNT_MISMATCH` (400); no request ever reaches Toss | `SagaEndToEndTest` |
| Buyer never pays | After the payment window the order is cancelled and stock released. Even if order-service is down, inventory's own sweeper releases expired holds | Recovery scheduler, `HoldExpiryScheduler` |
| Hold expired when payment is confirmed | Inventory returns `InventoryConfirmFailed`; the order goes through `COMPENSATING` and is refunded via Toss | Orchestrator logic |
| The same message arrives twice | Transitions are allowed only from the expected state (`@Version`); payments and stock are idempotent per `order_id` | `IdempotencyTest` |
| A late reply after cancellation | A `PaymentConfirmed` for a cancelled order triggers a refund; an `InventoryReserved` triggers a release | Orchestrator logic |
| Confirming a released hold | The confirmation is rejected and stock is unchanged | `IdempotencyTest` |

## Load testing and performance work

All three scripts in `load-test/k6/` go through the gateway and register real users. Payment uses `fake_approve_*` keys so Toss receives no load; a third-party PG API should never be part of a load test.

| Script | What it checks |
| --- | --- |
| `smoke.js` | One buyer through the whole flow: order → stock hold → payment → completion → shipment → my orders |
| `flash-sale.js` | `BUYERS` purchase attempts race for `STOCK` units; latency and sales outcome are measured |
| `live-viewers.js` | `VIEWERS` STOMP viewers stay connected while purchases change stock; connection success, connect time and stock update delivery are measured |

`flash-sale.js` does more than time requests. When it finishes it checks these invariants through the admin API, and any violation fails the run:

- sold units never exceed sellable stock (no oversell)
- available stock never goes negative
- stock is conserved: `available + held + sold = stock put on sale`
- every sold unit belongs to a completed order
- charges equal completed orders; nobody pays without receiving an item

### Results and what changed

Everything, including five PostgreSQL instances, Kafka and Jaeger, ran on a single laptop, so the numbers describe how the architecture behaves relative to itself rather than production throughput.

The first run proved correctness: with 200 concurrent buyers competing for 100 units, exactly 100 bought, 100 were charged, and 42,448 requests produced zero HTTP errors. Speed was weak, and the numbers pointed at the causes:

| Finding | Cause | Change |
| --- | --- | --- |
| Order creation p95 about 5.8s | Even after selling out, every request queued for the product row's `FOR UPDATE` lock | A lock-free scalar read rejects sold-out requests before locking. It reads a number, not the entity: loading the entity first would make Hibernate return the stale cached instance from the later `FOR UPDATE` and open the door to oversell |
| Stock hold p95 17.8s | One partition and one consumer thread per topic let events pile up | Topics are declared with 6 partitions and order-service consumes with 6 threads. The key is `orderId`, so per-order ordering is preserved |
| Extra delay at every saga step | The outbox relay polled every 500 ms and sent events one by one, waiting for each acknowledgment | Poll every 100 ms, send a batch concurrently, then collect acknowledgments, with `linger.ms=5`. Only the contiguous acknowledged prefix is marked `PUBLISHED`; the rest is resent. Duplicates are possible, loss is not |
| 454,583 viewer count messages for 500 viewers | Every join broadcast the count to every viewer (O(n²)) | The count is broadcast at most once per second, and only when it changed |
| Connection waits in order-service | The default 10 connections could not serve 12 consumer threads plus HTTP traffic | Hikari pool of 30 |

**Method**: for each configuration, one warm-up run is discarded and the median of three runs is reported. On one laptop, run-to-run variation reached ±25%, and the first run after a service restart was several times slower because of JIT compilation and cold connection pools.

| Metric (100 units, 1,000 attempts, 200 VUs) | Before | After (median of 3) |
| --- | --- | --- |
| Invariants | 5/5 pass | 5/5 pass (all three runs) |
| Sold / charged | 100 / 100 | 100 / 100 |
| HTTP errors | 0 / 42,448 | 0 |
| Order creation p95 | 5.72s | 2.68s (−53%) |
| Payment submission p95 | 0.71s | 0.63s |
| Time to stock hold p95 | 17.77s (truncated: k6 stopped waiting at 15s) | 4.80s |
| Time to completion p95 | 33.55s (only 47 of 100 measured) | 11.04s |
| Total sell-out time | 1m 27s | about 23s (−74%) |

The "before" latencies are truncated: in the first run k6 gave up on slow orders after 15–20 seconds, so they never entered the statistics. The real improvement is larger than the table shows.

| Metric (500 viewers) | Before | After |
| --- | --- | --- |
| STOMP connections | 571 / 571 | 500 / 500 |
| Connect p95 | 423 ms | 1.55s (500 viewers joining within 30s) |
| Viewer count messages | 454,583 | **8,151 (−98%)** |
| Stock update delivery | not measured (the test did not restore stock) | **120,000 / about 121,000 (99.2%)** |

### A rejected hypothesis and lessons learned

- **Connection pool hypothesis rejected**: the remaining latency was suspected to come from inventory's small connection pool (Hikari default 10). Measured the same way with `SPRING_DATASOURCE_HIKARI_MAXIMUMPOOLSIZE=30` and no code change, the results were order creation p95 2.77s, stock hold p95 5.41s and completion p95 10.46s, all within run-to-run variation. With no benefit, the setting was not adopted.
- **Consumer metadata after adding partitions**: when topics were first raised to 6 partitions, consumers that had started earlier did not see the new partitions, because consumers refresh topic metadata only every 5 minutes by default (`metadata.max.age.ms`). No event was lost and everything was processed after a restart, but orders stalled in the meantime. The broker default (`KAFKA_NUM_PARTITIONS=6`) now matches, so topics are created correctly whichever service starts first. In production, topics should be provisioned before deployment.
- **Invariant correction**: the oversell invariant started as `sold ≤ STOCK`. A real run failed it with 101 > 100 while the stock conservation invariant passed: one hold left over from a previous run expired during the test and was legitimately sold. The invariant is now `sold ≤ STOCK + units held when the run started`.
- **Trade-off of the fast sold-out path**: if the lock-free read sees zero while another order is releasing stock, that buyer may get a sold-out answer. Released stock becomes available to the next buyer immediately and oversell can never happen, which is the right trade for a flash sale.

**Next opportunity**: most of the remaining latency comes from the synchronous REST call to inventory inside the order creation request and from CPU contention on one machine. Turning the stock hold into an outbox-driven Kafka command would bring order creation down to tens of milliseconds, but it makes the saga's first step asynchronous, an architectural change left out of this scope.

## Service details

### Authentication and API gateway

Access tokens are 15-minute RS256 JWTs (`sub`, `nickname`, `roles`). The gateway and live-service verify them through auth-service's JWKS endpoint, so the private key lives in exactly one service.

Refresh tokens are 32 random bytes rather than JWTs. Only their SHA-256 hash is stored, and the browser carries them solely in an `HttpOnly`, `SameSite=Strict` cookie. Every refresh rotates the token; presenting an already used token is treated as theft and revokes the whole session family. The revocation survives the error response because the transaction is marked `noRollbackFor`. Login also hashes a password for unknown emails, so response timing does not reveal which emails are registered.

Trust boundary: the gateway always strips client-supplied `X-User-Id` and `X-User-Roles` headers and rewrites them from the verified token. Admin APIs are restricted to `ADMIN` at the gateway, and each service re-checks the role header, so bypassing the gateway does not open them. Another user's order returns 404 rather than 403, which avoids revealing that it exists.

A demo admin account is created on first start: `admin@livecommerce.local` / `admin1234!`

### Payments (Toss Payments)

Payment-service calls the real Toss Payments API (confirm `/v1/payments/confirm`, cancel `/v1/payments/{paymentKey}/cancel`) with `Basic base64(secretKey:)` authentication and an `Idempotency-Key` (`confirm-{orderId}`, `cancel-{orderId}`). The default configuration uses Toss's public documentation test keys, so no real money moves. Personal test keys go into `NEXT_PUBLIC_TOSS_CLIENT_KEY` in `frontend/.env.local` and the `PAYMENTS_TOSS_SECRET_KEY` environment variable for payment-service, always as a matching pair. Switching to live keys requires a PG contract and a Korean business registration, and only configuration changes.

Automated tests cannot type card details into the payment window, so with `payments.fake-enabled=true`, a `paymentKey` starting with `fake_` is routed to a test gateway (`fake_approve_*` approves, `fake_decline_*` declines). This must be disabled in production.

### Live broadcast (live-service)

| Channel | Path | Description |
| --- | --- | --- |
| REST | `GET /api/live/session` | Broadcast, product, price, current stock, sale end time, viewer count |
| REST | `GET /api/live/chat` | Last 50 chat messages |
| STOMP | `/ws/live` | WebSocket endpoint |
| STOMP | `/app/live/chat` | Send a chat message |
| STOMP | `/topic/live/chat`, `/topic/live/stock`, `/topic/live/viewers` | Chat, stock and viewer count subscriptions |

Whenever stock changes, inventory writes a `StockChanged` event to its outbox in the same transaction. The key is `productId`, so one product's changes arrive in order, and live-service broadcasts them to every viewer. The displayed price and the charged price both come from inventory's unit price.

### Delivery (delivery-service)

When an order becomes `COMPLETED`, order-service writes `OrderCompleted` to its outbox in the same transaction as the state change, and delivery-service creates a shipment with a tracking number. The shipping address is snapshotted onto the order at purchase time, so later profile edits never affect past orders.

Statuses: `PREPARING` → `SHIPPED` → `IN_TRANSIT` → `OUT_FOR_DELIVERY` → `DELIVERED`

The courier posts status changes to `POST /api/deliveries/webhooks/courier`.

| Problem | Solution |
| --- | --- |
| Forged requests | `X-Courier-Signature: sha256=HMAC(secret, timestamp.body)`, compared in constant time with `MessageDigest.isEqual` |
| Replay of a captured request | Rejected when `X-Courier-Timestamp` is older than 5 minutes |
| Courier resends an event | `event_id` is unique; a repeat returns `DUPLICATE` and is not processed |
| Events arrive out of order | A late, older event is recorded in the history (`RECORDED_OUT_OF_ORDER`) but never moves the status backwards |
| Concurrent webhooks for one shipment | The shipment row is locked with `SELECT ... FOR UPDATE` |

The webhook is open at the gateway without a JWT and protected by its signature. For the demo, a courier simulator keeps its own state in a separate table like an external company would, and sends each step as a signed HTTP request to the same webhook.

### Admin API

| Path | Service | Purpose |
| --- | --- | --- |
| `GET /api/admin/orders?status=&page=&size=` | order | Order list with status filter |
| `GET /api/admin/orders/summary` | order | Counts per status, revenue, 24h conversion, stalled orders, average completion time, orders per minute |
| `POST /api/admin/orders/{id}/retry` | order | Retry a stalled saga step now |
| `POST /api/admin/orders/{id}/cancel` | order | Cancel an unpaid order (stock released immediately) |
| `GET /api/admin/payments/orders/{id}` | payment | Payment method, approval time, decline code |
| `GET /api/admin/payments/summary` | payment | Payment counts, confirmed and refunded amounts |
| `GET /api/admin/inventory/products`, `PUT .../products/{id}` | inventory | Available, held and sold quantities; edit stock and price |
| `GET /api/admin/inventory/reservations/{orderId}` | inventory | An order's stock hold and its expiry |
| `GET /api/admin/{payments,inventory}/outbox?aggregateId=` | payment, inventory | Outbox events for an order, the saga's event log |
| `GET /api/admin/{payments,inventory}/outbox/health` | payment, inventory | Pending events, age of the oldest, recent errors |

Statistics are computed with `JdbcTemplate` and PostgreSQL `FILTER` and `date_trunc` instead of JPA, aggregating in a single query without loading entities into memory.

### Frontend

`frontend/` is a mobile-first client built with Next.js 14 (App Router), TypeScript and Tailwind. The interface is in Korean.

- REST calls are proxied to the gateway through Next.js rewrites, so there is no CORS and the refresh cookie stays on the same origin.
- The access token lives only in memory, never in localStorage. A page reload restores the session silently from the refresh cookie, tokens renew before expiry, and concurrent 401 responses collapse into a single refresh.
- Order status arrives over WebSocket with a 3-second fallback poll. Status only moves forward, so a late, older message never rolls the screen back.
- The saga steps (stock held → payment → payment approved → order completed) are shown to the buyer, and a failure explains where it stopped and whether a refund was issued automatically.
- Even when React StrictMode runs effects twice, rendering and tearing down the Toss widget are serialized, so two payment UIs never collide.
- Pretendard and `word-break: keep-all` keep Korean line breaks clean; `prefers-reduced-motion` and `aria-live` announcements are supported.
- The video stream itself (RTMP/HLS) is out of scope and replaced by a simulated stage. Setting `NEXT_PUBLIC_LIVE_VIDEO_URL` plays that video instead.

## Running locally

Requirements: JDK 21, Docker, Node.js 18.17+. Gradle comes with the repository wrapper (`gradlew`).

```powershell
.\gradlew assemble
powershell -ExecutionPolicy Bypass -File scripts\start-services.ps1
```

The script starts five PostgreSQL instances, Kafka and Jaeger, launches each service in its own named window, and waits until every port is ready. Stop with `scripts\stop-services.ps1` (add `-Infrastructure` to stop the containers too); it stops only this project's services and leaves other Java processes such as IDEs alone. To run everything in Docker, use `docker compose up --build`.

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The operations console is at http://localhost:3000/admin and Jaeger at http://localhost:16686.

### Tests

```powershell
.\gradlew :integration-test:test
.\gradlew :integration-test:chaosTest
```

Integration tests send real HTTP requests to the running stack and verify results directly in each service's database. They cover the happy path, stock shortage compensation, idempotency, authentication and authorization, the admin API, delivery and courier webhook security. Chaos tests actually stop and restart Kafka and databases.

```powershell
winget install k6 --source winget
cd load-test\k6
k6 run smoke.js
k6 run -e STOCK=100 -e BUYERS=1000 -e VUS=200 -e USERS=200 flash-sale.js
k6 run -e VIEWERS=500 live-viewers.js
```

### Sample requests

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType "application/json" -Body '{"email":"admin@livecommerce.local","password":"admin1234!"}'
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$body = '{"productId":"11111111-1111-1111-1111-111111111111","quantity":1,"shippingAddress":{"recipientName":"Kim Knit","phone":"010-1234-5678","zipCode":"04799","address1":"113 Seongsui-ro, Seongdong-gu, Seoul","address2":"3F"}}'
$order = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/orders -Headers $headers -ContentType "application/json" -Body $body
Start-Sleep -Seconds 2
$payable = Invoke-RestMethod -Uri "http://localhost:8080/api/orders/$($order.orderId)" -Headers $headers
$payment = @{ paymentKey = "fake_approve_demo"; amount = $payable.amount } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/orders/$($order.orderId)/payment" -Headers $headers -ContentType "application/json" -Body $payment
```

## Production deployment

The live demo runs on a single VPS with Docker Compose.

```bash
cp .env.prod.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

- `Dockerfile.prod` runs the Gradle build once and produces a separate runtime image per service. Every JVM runs as a non-root user and sizes its heap from the container memory limit.
- The only container reachable from outside is `edge` (Caddy): `/api/*` and `/ws/*` go to the API Gateway, everything else to Next.js. PostgreSQL, Kafka, Jaeger and the service ports are never published.
- In production the admin account (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), the database passwords and the courier webhook signing secret must be set in `.env`; the containers refuse to start without them. The refresh-token cookie is marked `Secure`.
- The fake payment path for load tests (`fake_` keys) is disabled in production by default (`PAYMENTS_FAKE_ENABLED=false`).
- Trace sampling is lowered to 20% to keep memory usage in check.

## Known limitations

- Load test figures come from running every component together on one laptop.
- live-service keeps chat history and the viewer count in memory, so it runs as a single instance. Scaling out would move them to Redis and give each instance its own consumer group.
- The JWT signing key is regenerated on every start. Refresh tokens hide this from users, but production should load the key from KMS or Vault.
- Payments run on test keys, and the broadcast video is a simulated stage.

## Project structure

```
livecommerce-saga/
├── common/             Event contracts, shipping address rules
├── api-gateway/        JWT verification, routing, WebSocket proxy
├── auth-service/       Users, tokens, JWKS, default shipping address
├── order-service/      Saga orchestrator, order WebSocket, outbox
├── payment-service/    Toss Payments confirmation and cancellation, outbox
├── inventory-service/  Stock holds, confirmation and release, expiry sweeper, outbox
├── live-service/       STOMP chat, stock and viewer count
├── delivery-service/   Shipments, courier webhooks, courier simulator
├── integration-test/   Integration and chaos tests
├── load-test/k6/       Load test scripts and measured results
├── frontend/           Next.js client
└── scripts/            Scripts to start and stop the local stack
```
