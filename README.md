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
.\gradlew assemble
docker compose up -d postgres-order postgres-payment postgres-inventory postgres-auth kafka jaeger
& "$env:JAVA_HOME\bin\java.exe" -jar auth-service\build\libs\auth-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar api-gateway\build\libs\api-gateway-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar order-service\build\libs\order-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar payment-service\build\libs\payment-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar inventory-service\build\libs\inventory-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar live-service\build\libs\live-service-0.1.0.jar
```

Har bir servis alohida PowerShell oynasida ishga tushiriladi. Tashqi mijozlar uchun yagona kirish nuqtasi — gateway (`http://localhost:8080`).

## To'liq Docker orqali ishga tushirish

```powershell
docker compose up --build
```

## Avtomatlashtirilgan testlar

Testlar ishlab turgan stackka (yuqoridagi "Lokal ishga tushirish" bo'limi) real HTTP so'rovlar yuboradi va natijani to'g'ridan-to'g'ri bazalardan tekshiradi. Har bir testdan oldin demo stok 100 taga tiklanadi.

```powershell
.\gradlew :integration-test:test
.\gradlew :integration-test:chaosTest
```

`test` baxtli yo'l, stok yetishmaganda compensation, takroriy so'rovlarga idempotentlik, live-service'ning stok ma'lumoti va gateway orqali to'liq autentifikatsiya oqimini tekshiradi. `chaosTest` esa Kafka va bazalarni haqiqatan to'xtatib, qayta ishga tushiradi (bir necha daqiqa davom etadi).

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

## Autentifikatsiya va API Gateway

| Komponent | Vazifasi |
| --- | --- |
| `auth-service` (8085) | Ro'yxatdan o'tish, login, token yangilash, logout, `/api/auth/me`, `/.well-known/jwks.json` |
| `api-gateway` (8080) | Yagona kirish nuqtasi: JWT tekshiruvi, rollar, marshrutlash, WebSocket proksi |

Access token RS256 bilan imzolangan 15 daqiqalik JWT (`sub`, `nickname`, `roles`). Gateway va live-service uni `auth-service`ning JWKS endpoint'i orqali tekshiradi, shuning uchun maxfiy kalit faqat bitta servisda turadi.

Refresh token esa JWT emas, 32 baytli tasodifiy qator. Bazada faqat uning SHA-256 xeshi saqlanadi, brauzerda esa `HttpOnly`, `SameSite=Strict` cookie'da yuradi. Har bir yangilashda token almashtiriladi (rotation). Allaqachon ishlatilgan token qayta kelsa, bu o'g'irlik belgisi deb hisoblanadi va shu sessiyaning butun "oilasi" bekor qilinadi. Bu bekor qilish xato qaytarilganda ham saqlanib qolishi uchun tranzaksiya `noRollbackFor` bilan belgilangan. Login paytida mavjud bo'lmagan email uchun ham parol xeshi hisoblanadi, shuning uchun javob vaqtiga qarab qaysi email ro'yxatdan o'tganini aniqlab bo'lmaydi.

Ishonch chegarasi: gateway mijozdan kelgan `X-User-Id`/`X-User-Roles` sarlavhalarini har doim o'chirib tashlaydi va ularni faqat tekshirilgan tokendan qayta yozadi. Ichki servislar shu sarlavhalarga ishonadi, shuning uchun production'da ular faqat ichki tarmoqda ochiq bo'lishi kerak. Order-service buyurtmani faqat egasiga yoki adminga ko'rsatadi. Begona foydalanuvchiga 403 emas, 404 qaytariladi, shunda buyurtma mavjudligi ham oshkor bo'lmaydi.

Chatda muallif nomi mijoz yuborgan matndan emas, STOMP `CONNECT` paytida tekshirilgan tokendan olinadi. Tokensiz ulanganlar efirni tomosha qila oladi, lekin yoza olmaydi.

Demo admin hisobi birinchi ishga tushirishda avtomatik yaratiladi: `admin@livecommerce.local` / `admin1234!`.

Cheklov: imzolash kaliti har ishga tushishda yangidan yaratiladi. Bu access token'larni bekor qiladi, lekin refresh token'lar bazada saqlangani uchun foydalanuvchi sezmasdan yangi token oladi. Production'da kalit tashqi saqlovdan (KMS yoki Vault) yuklanishi kerak.

## Frontend

`frontend/` — Next.js 14 (App Router), TypeScript va Tailwind asosidagi mobile-first live efir ekrani. Interfeys koreys tilida.

```powershell
cd frontend
npm install
npm run dev
```

Brauzerda http://localhost:3000 ni oching. Node.js 18.17+ kerak, backend servislari va gateway ham ishlab turishi kerak. Manzillarni o'zgartirish uchun `.env.example`ni `.env.local` nomi bilan nusxalang.

Aloqa tuzilishi: REST so'rovlar Next.js rewrites orqali gateway'ga proxy qilinadi, shuning uchun brauzerda CORS muammosi bo'lmaydi va refresh cookie xuddi shu domen ichida qoladi. Real vaqt kanallari ham gateway orqali o'tadi: chat, stok va tomoshabinlar soni uchun STOMP, buyurtma holati uchun WebSocket. Access token localStorage'da emas, faqat xotirada saqlanadi. Sahifa yangilanganda sessiya refresh cookie orqali jimgina tiklanadi, token muddati tugashidan oldin esa avtomatik yangilanadi. Bir vaqtda kelgan bir nechta 401 javob bitta refresh so'roviga birlashtiriladi. Ikkala ulanish ham uzilganda exponential backoff bilan qayta ulanadi. Buyurtma holati uchun WebSocket'ga qo'shimcha ravishda har 3 soniyada zaxira so'rov yuboriladi, shuning uchun ulanish yo'qolsa ham natija ko'rinadi. Holatlar faqat oldinga siljiydi: kech kelgan eski xabar ekrandagi holatni orqaga qaytarmaydi.

Dizayn qarorlari:

- Stok paneli oddiy progress bar emas, ikki qator trikotaj ko'zlaridan iborat. Sotilgan sari ko'zlar "so'kiladi", stok 20% dan kamayganda rangi o'zgaradi va "마감 임박" yozuvi chiqadi.
- Saga bosqichlari foydalanuvchiga ochiq ko'rsatiladi: 주문 접수 → 결제 승인 → 재고 확보 → 주문 완료. Muvaffaqiyatsiz bo'lsa, qaysi bosqichda to'xtagani va to'lov avtomatik qaytarilgani tushuntiriladi.
- Shrift sifatida Pretendard ishlatilgan, koreys matni so'z o'rtasidan bo'linmasligi uchun `word-break: keep-all` qo'llangan. Harakatni kamaytirish sozlamasi (`prefers-reduced-motion`) hurmat qilinadi, jonli yangilanishlar ekran o'quvchilar uchun `aria-live` orqali e'lon qilinadi.
- Video oqimining o'zi (RTMP/HLS) loyiha doirasidan tashqarida. Efir sahnasi simulyatsiya qilinadi. `NEXT_PUBLIC_LIVE_VIDEO_URL` berilsa, o'sha video ko'rsatiladi.

## Distributed tracing

Uchala servis Micrometer Tracing (OpenTelemetry bridge) orqali span'larni OTLP bilan Jaeger'ga yuboradi. REST chaqiruvlari va Kafka listener'lari avtomatik instrumentlangan. Outbox relay alohida `@Scheduled` oqimda ishlagani uchun trace konteksti odatda shu yerda uzilib qoladi. Buning oldini olish uchun har bir outbox yozuvi W3C `traceparent` qiymatini o'zi bilan saqlaydi, relay esa uni Kafka header'iga qayta qo'yadi. Natijada bitta buyurtma Order → Payment → Kafka → Order → Inventory → Kafka → Order zanjiri bo'ylab Jaeger'da bitta uzluksiz trace bo'lib ko'rinadi.

```powershell
docker compose up -d jaeger
```

Jaeger UI: http://localhost:16686 — Service: `order-service`, so'ng "Find Traces".

## Test uchun namuna so'rov

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType "application/json" -Body '{"email":"admin@livecommerce.local","password":"admin1234!"}'
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$order = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/orders -Headers $headers -ContentType "application/json" -Body '{"productId":"11111111-1111-1111-1111-111111111111","quantity":1,"amount":39000}'
Invoke-RestMethod -Uri "http://localhost:8080/api/orders/$($order.orderId)" -Headers $headers
```

Buyurtma holatini real vaqtda kuzatish uchun WebSocket'ga ulaning: `ws://localhost:8080/ws/orders?orderId=<qaytgan orderId>`

## Loyihaning holati

Saga + Outbox oqimi, idempotentlik, timeout asosidagi tiklanish, distributed tracing, chaos testlari, live efir servisi, frontend, autentifikatsiya va API Gateway tayyor. Keyingi bosqichlar: Toss Payments integratsiyasi, admin paneli, yetkazib berish kuzatuvi, k6 yuklama testi.
