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

## Avtomatlashtirilgan testlar

Testlar ishlab turgan stackka real HTTP so'rovlar yuboradi va natijani to'g'ridan-to'g'ri bazalardan tekshiradi. Har bir testdan oldin demo stok 100 taga tiklanadi.

```powershell
.\gradlew assemble
docker compose up -d postgres-order postgres-payment postgres-inventory kafka jaeger
& "$env:JAVA_HOME\bin\java.exe" -jar order-service\build\libs\order-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar payment-service\build\libs\payment-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar inventory-service\build\libs\inventory-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar live-service\build\libs\live-service-0.1.0.jar
.\gradlew :integration-test:test
.\gradlew :integration-test:chaosTest
```

`test` baxtli yo'l, stok yetishmaganda compensation, takroriy so'rovlarga idempotentlik va live-service'ning stok ma'lumotini tekshiradi. `chaosTest` esa Kafka va bazalarni haqiqatan to'xtatib, qayta ishga tushiradi (bir necha daqiqa davom etadi).

## Nima buziladi va qanday tiklanadi

| Nosozlik | Tizimning xatti-harakati | Isbot |
| --- | --- | --- |
| Kafka ishlamay qoladi | Outbox relay hodisani faqat broker tasdiqlagandan keyin `PUBLISHED` deb belgilaydi; ungacha hodisa `PENDING` holatida qoladi va qayta yuboriladi, urinishlar soni va oxirgi xato saqlanadi | `chaosTest`: Kafka to'xtatilgan paytda yaratilgan buyurtma u qaytgach `COMPLETED` bo'ladi |
| Payment bazasi vaqtincha yo'q | Tashqi chaqiruvlarda timeout bor; buyurtma `AWAITING_PAYMENT` holatida qoladi va recovery scheduler bosqichni qayta yuboradi | `chaosTest`: baza qaytgach buyurtma `COMPLETED` bo'ladi |
| Inventory javob bermaydi | 3 marta qayta urinishdan so'ng buyurtma `COMPENSATING` holatiga o'tadi, to'lov bekor qilinadi, buyurtma `CANCELLED` bo'ladi | `chaosTest`: `inventory step timed out` sababi bilan bekor qilinadi |
| Bir xil xabar ikki marta keladi | Har bir holat o'tishi faqat kutilgan holatdan ruxsat etiladi (`@Version` bilan himoyalangan), payment va inventory `order_id` bo'yicha idempotent | `IdempotencyTest` |
| Bekor qilingandan keyin kech javob keladi | Bekor qilingan buyurtma uchun kelgan `PaymentReserved` to'lovni bekor qiladi, `InventoryReserved` esa zaxirani qaytaradi | Orkestrator mantiqi |
| Ikkita parallel release | Reservation qatori `SELECT ... FOR UPDATE` bilan qulflanadi, stok ikki marta qaytarilmaydi | `IdempotencyTest` |

## Live efir servisi

`live-service` (port 8084) efir sessiyasini, chatni, tomoshabinlar sonini va real vaqtdagi stokni boshqaradi. U ma'lumotlar bazasiga ega emas: sessiya konfiguratsiyadan olinadi, stok esa inventory'dan keladi.

| Kanal | Manzil | Tavsif |
| --- | --- | --- |
| REST | `GET /api/live/session` | Efir, mahsulot, narx, joriy stok, chegirma tugash vaqti, tomoshabinlar soni |
| REST | `GET /api/live/chat` | Oxirgi 50 ta chat xabari |
| STOMP | `ws://localhost:8084/ws/live` | WebSocket endpoint |
| STOMP | `/app/live/chat` | Chat xabarini yuborish |
| STOMP | `/topic/live/chat`, `/topic/live/stock`, `/topic/live/viewers` | Chat, stok va tomoshabinlar soni obunalari |

Stok har o'zgarganda (band qilish yoki qaytarish) inventory `StockChanged` hodisasini xuddi shu tranzaksiya ichida outbox'ga yozadi. Hodisa kaliti `productId`, shuning uchun Kafka bitta mahsulotning o'zgarishlarini tartib bilan yetkazadi. live-service hodisani `stock-events` topic'idan o'qib, barcha tomoshabinlarga STOMP orqali yuboradi.

Cheklov: chat tarixi va tomoshabinlar soni xotirada saqlanadi, shuning uchun live-service hozircha bitta instansiyada ishlaydi. Gorizontal masshtablash uchun ularni Redis'ga o'tkazish va har bir instansiyaga alohida Kafka consumer group berish kerak bo'ladi.

## Distributed tracing

Uchala servis Micrometer Tracing (OpenTelemetry bridge) orqali span'larni OTLP bilan Jaeger'ga yuboradi. REST chaqiruvlari va Kafka listener'lari avtomatik instrumentlangan. Outbox relay alohida `@Scheduled` oqimda ishlagani uchun trace konteksti odatda shu yerda uzilib qoladi. Buning oldini olish uchun har bir outbox yozuvi W3C `traceparent` qiymatini o'zi bilan saqlaydi, relay esa uni Kafka header'iga qayta qo'yadi. Natijada bitta buyurtma Order → Payment → Kafka → Order → Inventory → Kafka → Order zanjiri bo'ylab Jaeger'da bitta uzluksiz trace bo'lib ko'rinadi.

```powershell
docker compose up -d jaeger
```

Jaeger UI: http://localhost:16686 — Service: `order-service`, so'ng "Find Traces".

## Test uchun namuna so'rov

```powershell
curl.exe -X POST http://localhost:8081/api/orders `
  -H "Content-Type: application/json" `
  -d '{\"memberId\":\"22222222-2222-2222-2222-222222222222\",\"productId\":\"11111111-1111-1111-1111-111111111111\",\"quantity\":1,\"amount\":39000}'
```

Buyurtma holatini real vaqtda kuzatish uchun WebSocket'ga ulaning: `ws://localhost:8081/ws/orders?orderId=<qaytgan orderId>`

## Loyihaning holati

Saga + Outbox oqimi, idempotentlik, timeout asosidagi tiklanish, distributed tracing, chaos testlari va live efir servisi tayyor. Keyingi bosqichlar: frontend (live efir ekrani va Saga holat paneli), k6 yuklama testi.
