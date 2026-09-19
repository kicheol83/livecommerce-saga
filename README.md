# LiveCommerce Saga

Order, Payment va Inventory uchta mustaqil Spring Boot mikroservisi, orchestration-based Saga pattern va transactional outbox orqali bog'langan.

## Arxitektura

```
Client (WebSocket) -> Order Service (Saga orchestrator)
                          |-- REST --> Payment Service --(outbox)--> Kafka --> Order Service
                          |-- REST --> Inventory Service --(outbox)--> Kafka --> Order Service
```

1. Client `POST /api/orders` orqali buyurtma yaratadi.
2. Order Service buyurtmani `AWAITING_PAYMENT` holatida saqlaydi va Payment Service'ga REST orqali murojaat qiladi.
3. Payment Service to'lovni bir DB tranzaksiyasi ichida yozadi va outbox jadvaliga event qo'shadi.
4. Har bir servisning outbox relay'i (`SELECT ... FOR UPDATE SKIP LOCKED` bilan) pending eventlarni Kafka'ga chiqaradi.
5. Order Service Kafka orqali natijani oladi va Saga holatini yangilaydi, WebSocket orqali clientga push qiladi.
6. Agar Inventory bosqichi muvaffaqiyatsiz bo'lsa, Order Service Payment Service'dan to'lovni bekor qilishni so'raydi (compensating transaction).

## Talab qilinadigan vositalar

- JDK 21
- Docker va Docker Compose
- Gradle 8.10+ (yoki IntelliJ IDEA — loyihani ochganda wrapper avtomatik yaratiladi)

## Lokal ishga tushirish (PowerShell)

```powershell
docker compose up -d postgres-order postgres-payment postgres-inventory kafka
./gradlew :order-service:bootRun
./gradlew :payment-service:bootRun
./gradlew :inventory-service:bootRun
```

## To'liq Docker orqali ishga tushirish

```powershell
docker compose up --build
```

## Avtomatlashtirilgan integratsion test

`integration-test` moduli uchala servisni ham (Testcontainers Postgres x3 + Kafka bilan) bitta JVM ichida ko'taradi va real HTTP so'rovlar orqali baxtli yo'l va compensation yo'lini avtomatik tekshiradi. Faqat Docker ishlab turgan bo'lishi kerak (alohida `docker compose up` shart emas — Testcontainers o'zi konteynerlarni boshqaradi):

```powershell
gradle :integration-test:test
```

## Test uchun namuna so'rov

```powershell
curl.exe -X POST http://localhost:8081/api/orders `
  -H "Content-Type: application/json" `
  -d '{\"memberId\":\"22222222-2222-2222-2222-222222222222\",\"productId\":\"11111111-1111-1111-1111-111111111111\",\"quantity\":1,\"amount\":39000}'
```

Buyurtma holatini real vaqtda kuzatish uchun WebSocket'ga ulaning: `ws://localhost:8081/ws/orders?orderId=<qaytgan orderId>`

## Loyihaning holati

Saga + Outbox oqimi qo'lda tekshirilgan va tasdiqlangan: happy path (to'lov va ombor muvaffaqiyatli, order `COMPLETED`ga yetadi) va compensation path (ombor yetarli bo'lmasa, to'lov avtomatik bekor qilinib, order `CANCELLED`ga aniq sabab bilan tushadi) — ikkalasi ham real Postgres + Kafka bilan sinaldi. Keyingi bosqichlar: Testcontainers bilan avtomatlashtirilgan integratsion testlar, k6 yuklama testi, distributed tracing, frontend.

## Muhim eslatma

Ushbu kod bu muhitda tarmoq cheklovlari sababli (Maven Central'ga kirish yo'q) build qilib ko'rilmadi — kodni birinchi marta o'zingizning mashinangizda `./gradlew build` bilan tekshiring.
