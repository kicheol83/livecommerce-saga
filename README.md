# LiveCommerce Saga

Jonli efirda flash-sale qiladigan live commerce platformasi. Order, Payment va Inventory mustaqil Spring Boot mikroservislari orchestration-based Saga va transactional outbox orqali bog'langan. To'lov Toss Payments bilan amalga oshiriladi.

## Arxitektura

```
Browser ── Next.js ── API Gateway (JWT) ─┬─ auth-service
                                         ├─ order-service (Saga orchestrator)
                                         └─ live-service (STOMP: chat, stok, tomoshabinlar)

order-service ── REST ──> inventory-service ──(outbox)──> Kafka ──> order-service
order-service ── REST ──> payment-service ──> Toss Payments
                               └────────(outbox)──> Kafka ──> order-service
```

### Saga tartibi: avval stokni ushlab qolish, keyin to'lov

```
AWAITING_STOCK → AWAITING_PAYMENT → PAYMENT_CONFIRMING → CONFIRMING_STOCK → COMPLETED
       ↓                ↓                  ↓                    ↓
   CANCELLED        CANCELLED          CANCELLED       COMPENSATING → CANCELLED
```

1. Xaridor `POST /api/orders` yuboradi. Unda faqat mahsulot va miqdor bo'ladi, narx yo'q. Buyurtma `AWAITING_STOCK` holatida yaratiladi.
2. Inventory stokni 10 daqiqaga ushlab qoladi (`HELD`) va `InventoryReserved` hodisasida birlik narxini qaytaradi. Order-service summani o'zi hisoblaydi va buyurtmani `AWAITING_PAYMENT` holatiga o'tkazadi. To'lov oynasi 5 daqiqa, lekin stok ushlanish muddati tugashidan kamida 60 soniya oldin yopiladi.
3. Xaridor Toss oynasida to'laydi. Brauzer `paymentKey` va summani `POST /api/orders/{id}/payment`ga yuboradi. Summa server hisoblaganiga mos kelmasa, so'rov `AMOUNT_MISMATCH` bilan rad etiladi.
4. Payment-service Toss'ning `/v1/payments/confirm` API'sini `Idempotency-Key` bilan chaqiradi. Tashqi HTTP chaqiruv DB tranzaksiyasidan tashqarida bajariladi, natija esa outbox hodisasi bilan birga bitta tranzaksiyada yoziladi.
5. To'lov tasdiqlangach, inventory ushlangan stokni yakuniy band qiladi (`CONFIRMED`) va buyurtma `COMPLETED` bo'ladi.

Nega shu tartib: flash-sale'da mahsulot tugab qolishi odatiy holat. Agar avval pul yechilsa, keyin "stok qolmadi" deyilsa, har bunday holatda qaytarish (refund) kerak bo'ladi — bu mijoz uchun ham, PG komissiyasi uchun ham qimmat. Stokni avval ushlab qolish qaytarishni faqat kam uchraydigan poyga holatlariga qoldiradi.

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
| Kafka ishlamay qoladi | Outbox relay hodisani faqat broker tasdiqlagandan keyin `PUBLISHED` deb belgilaydi. Ungacha hodisa `PENDING` holatida kutib turadi va qayta yuboriladi | `chaosTest`: Kafka o'chiq paytda yaratilgan buyurtma u qaytgach to'lanadi va `COMPLETED` bo'ladi |
| Payment bazasi tasdiqlash paytida yo'q | Buyurtma `PAYMENT_CONFIRMING` holatida qoladi, recovery scheduler tasdiqlashni qayta yuboradi. Toss'ga bir xil `Idempotency-Key` bilan boradi, shuning uchun pul ikki marta yechilmaydi | `chaosTest`: baza qaytgach bitta to'lov yoziladi va buyurtma `COMPLETED` bo'ladi |
| Inventory javob bermaydi | Stokni ushlash 3 marta qayta uriniladi, keyin buyurtma pul yechilmasdan bekor qilinadi | `chaosTest`: `inventory step timed out`, to'lovlar soni 0 |
| Karta rad etiladi | Buyurtma bekor qilinadi, ushlangan stok darhol qaytariladi | `SagaEndToEndTest` |
| Mijoz summani o'zgartiradi | `AMOUNT_MISMATCH` (400), Toss'ga so'rov umuman ketmaydi | `SagaEndToEndTest` |
| Xaridor to'lamay ketadi | To'lov oynasi tugagach buyurtma bekor qilinadi va stok qaytariladi. Order-service ishlamay qolsa ham, inventory'ning o'z tozalagichi muddati o'tgan ushlashlarni qaytaradi | Recovery scheduler va `HoldExpiryScheduler` |
| To'lov tasdiqlangan paytda stok muddati tugagan | Inventory `InventoryConfirmFailed` qaytaradi, buyurtma `COMPENSATING` holatiga o'tadi, to'lov Toss orqali qaytariladi | Orkestrator mantiqi |
| Bir xil xabar ikki marta keladi | Har bir holat o'tishi faqat kutilgan holatdan ruxsat etiladi (`@Version` bilan himoyalangan), payment va inventory `order_id` bo'yicha idempotent | `IdempotencyTest` |
| Bekor qilingandan keyin kech javob keladi | Bekor qilingan buyurtma uchun kelgan `PaymentConfirmed` to'lovni qaytaradi, `InventoryReserved` esa stokni bo'shatadi | Orkestrator mantiqi |
| Qaytarilgan ushlashni tasdiqlashga urinish | Tasdiqlash rad etiladi, stok o'zgarmaydi | `IdempotencyTest` |

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

## To'lov (Toss Payments)

Payment-service Toss Payments'ning haqiqiy API'si bilan ishlaydi: tasdiqlash `/v1/payments/confirm`, qaytarish `/v1/payments/{paymentKey}/cancel`. Autentifikatsiya `Basic base64(secretKey:)`. Har bir chaqiruv `Idempotency-Key` bilan yuboriladi (`confirm-{orderId}`, `cancel-{orderId}`). Standart konfiguratsiyada Toss'ning ochiq hujjat test kaliti ishlatiladi — haqiqiy pul yechilmaydi. O'z test kalitingizdan foydalanish uchun `PAYMENTS_TOSS_SECRET_KEY` muhit o'zgaruvchisini bering. Live kalitga o'tish uchun esa Toss bilan PG shartnomasi (va 사업자등록) kerak — bu faqat konfiguratsiya o'zgarishi, kod o'zgarmaydi.

Avtomatik testlar Toss oynasida karta ma'lumotini kirita olmaydi. Shuning uchun `payments.fake-enabled=true` bo'lganda `fake_` bilan boshlanadigan `paymentKey`'lar Toss'ga emas, test shlyuziga yo'naltiriladi: `fake_approve_*` tasdiqlanadi, `fake_decline_*` rad etiladi. Production'da bu sozlama o'chirilishi shart.

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
- To'lov: stok ushlangach buyurtma paneli ichida Toss Payments widget'i ochiladi, qolgan vaqt jonli sanaladi. To'lov bosqichida panel tasodifiy bosish bilan yopilmaydi — faqat aniq "주문 취소" tugmasi orqali, bu esa stokni darhol qaytaradi. Toss `successUrl`ga qaytgach, `/payments/success` sahifasi tasdiqlashni serverga yuboradi va Saga bosqichlarini shu yerda jonli ko'rsatadi. `/payments/fail` esa qayta to'lash (buyurtma live ekranda qayta ochiladi) yoki bekor qilishni taklif qiladi. React StrictMode effektni ikki marta ishga tushirsa ham, Toss widget'ini chizish va o'chirish ketma-ket navbatda bajariladi, shuning uchun ikkita to'lov UI bir-biriga to'qnashmaydi.
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
$order = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/orders -Headers $headers -ContentType "application/json" -Body '{"productId":"11111111-1111-1111-1111-111111111111","quantity":1}'
Start-Sleep -Seconds 2
$payable = Invoke-RestMethod -Uri "http://localhost:8080/api/orders/$($order.orderId)" -Headers $headers
$payment = @{ paymentKey = "fake_approve_demo"; amount = $payable.amount } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/orders/$($order.orderId)/payment" -Headers $headers -ContentType "application/json" -Body $payment
```

Buyurtma holatini real vaqtda kuzatish uchun WebSocket'ga ulaning: `ws://localhost:8080/ws/orders?orderId=<qaytgan orderId>`

## Loyihaning holati

Saga + Outbox oqimi, idempotentlik, timeout asosidagi tiklanish, distributed tracing, chaos testlari, live efir servisi, frontend, autentifikatsiya va API Gateway tayyor. Toss Payments integratsiyasi (backend va frontend) hamda stokni avval ushlab qoladigan Saga tayyor. Keyingi bosqichlar: admin paneli, yetkazib berish kuzatuvi, k6 yuklama testi.
