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
docker compose up -d postgres-order postgres-payment postgres-inventory postgres-auth postgres-delivery kafka jaeger
& "$env:JAVA_HOME\bin\java.exe" -jar auth-service\build\libs\auth-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar api-gateway\build\libs\api-gateway-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar order-service\build\libs\order-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar payment-service\build\libs\payment-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar inventory-service\build\libs\inventory-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar live-service\build\libs\live-service-0.1.0.jar
& "$env:JAVA_HOME\bin\java.exe" -jar delivery-service\build\libs\delivery-service-0.1.0.jar
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

`test` baxtli yo'l, stok yetishmaganda compensation, takroriy so'rovlarga idempotentlik, live-service'ning stok ma'lumoti, gateway orqali autentifikatsiya, admin API, yetkazib berish va kuryer webhook xavfsizligini tekshiradi. `chaosTest` esa Kafka va bazalarni haqiqatan to'xtatib, qayta ishga tushiradi (bir necha daqiqa davom etadi).

## Yuklama testi (k6)

`load-test/k6/` papkasida uchta skript bor. Ularning barchasi gateway (`http://localhost:8080`) orqali ishlaydi va haqiqiy foydalanuvchilarni ro'yxatdan o'tkazadi. To'lov bosqichida `fake_approve_*` kalitlari ishlatiladi, shuning uchun Toss'ga yuklama berilmaydi — uchinchi tomon API'sini yuklama testiga qo'shmaslik shart.

```powershell
winget install k6 --source winget
cd load-test\k6
k6 run smoke.js
k6 run --summary-export ..\results\flash-sale.json flash-sale.js
k6 run -e STOCK=100 -e BUYERS=1000 -e VUS=200 -e USERS=200 --summary-export ..\results\flash-sale-1000.json flash-sale.js
k6 run -e VIEWERS=500 --summary-export ..\results\live-viewers.json live-viewers.js
```

| Skript | Nimani tekshiradi |
| --- | --- |
| `smoke.js` | Bitta xaridor bilan butun oqim: buyurtma → stok ushlash → to'lov → yakun → yetkazib berish → "내 주문". Katta testdan oldin stack ishlayotganini tasdiqlaydi |
| `flash-sale.js` | `BUYERS` ta xarid urinishi `STOCK` dona uchun bir vaqtda kurashadi. Tezlik (`time_to_stock_hold`, `time_to_completion`, endpoint p95) va sotuv natijasi (`orders_completed`, `orders_sold_out`) o'lchanadi |
| `live-viewers.js` | `VIEWERS` ta tomoshabin STOMP orqali ulanadi, bu vaqtda xaridlar stokni o'zgartirib turadi. Ulanish muvaffaqiyati, ulanish vaqti va stok yangilanishlarining yetkazilishi o'lchanadi |

`flash-sale.js` faqat tezlikni o'lchamaydi. Test oxirida u admin API orqali quyidagi invariantlarni tekshiradi, birortasi buzilsa test muvaffaqiyatsiz tugaydi:

- sotilgan birliklar soni sotuvga qo'yilgan stokdan oshmaydi (oversell yo'q);
- mavjud stok hech qachon manfiy bo'lmaydi;
- stok saqlanadi: `mavjud + ushlangan + sotilgan = sotuvga qo'yilgan`;
- har bir sotilgan birlik yakunlangan buyurtmaga tegishli;
- yechilgan to'lovlar soni yakunlangan buyurtmalar soniga teng, ya'ni tovarsiz hech kimdan pul olinmagan.

`live-viewers.js` natijasini o'qish: `stock_updates_received / stock_changes_emitted` nisbati har bir stok o'zgarishi paytida onlayn bo'lgan tomoshabinlar soniga yaqin bo'lishi kerak. Nisbat sezilarli darajada kam bo'lsa, ba'zi tomoshabinlarga yangilanish yetib bormagan bo'ladi.

### Natijalar va optimizatsiya

Barcha servislar, beshta PostgreSQL, Kafka va Jaeger bitta Windows noutbukda ishlaganda o'lchandi. Shuning uchun raqamlar production quvvatini emas, arxitekturaning bitta mashinadagi xatti-harakatini ko'rsatadi.

Birinchi o'lchov to'g'rilikni isbotladi: 200 ta parallel xaridor 100 dona uchun kurashganda aynan 100 tasi sotib oldi, 100 ta to'lov yechildi, 42 448 so'rovda birorta HTTP xato bo'lmadi va beshala invariant o'tdi. Lekin tezlik zaif edi va raqamlar sababini ko'rsatdi:

| Topilma | Sabab | O'zgarish |
| --- | --- | --- |
| `create_order` p95 ≈ 5.8 s | Stok tugagandan keyin ham har bir so'rov mahsulot qatoridagi `FOR UPDATE` qulfi uchun navbat kutgan | Qulfdan oldin qulfsiz skalyar o'qish: stok yetmasa, darhol rad etiladi. Oldindan tekshirish entity emas, faqat raqam o'qiydi — aks holda Hibernate keyingi `FOR UPDATE`da keshdagi eski entity'ni qaytarib, oversell'ga yo'l ochgan bo'lardi |
| Stok ushlanishi p95 17.8 s (1000 urinish) | Har bir topic'da 1 partition va bitta consumer oqimi — hodisalar navbatga to'plangan | Topic'lar 6 partition bilan e'lon qilinadi, order-service ularni 6 oqimda o'qiydi. Kalit — `orderId`, shuning uchun bitta buyurtma hodisalarining tartibi saqlanadi |
| Har bir Saga qadamida qo'shimcha kechikish | Outbox relay 500 ms'da bir marta tekshirgan va hodisalarni birma-bir, har birining tasdig'ini kutib yuborgan | 100 ms'da tekshirish, paketni parallel yuborish, keyin tasdiqlarni kutish, `linger.ms=5`. Faqat ketma-ket muvaffaqiyatli prefiks `PUBLISHED` bo'ladi, qolgani qayta yuboriladi — takror bo'lishi mumkin, yo'qolish emas |
| 500 tomoshabinda 454 583 ta "tomoshabinlar soni" xabari | Har bir ulanish soni yangilanishini barcha tomoshabinlarga yuborgan — O(n²) | Soni sekundiga ko'pi bilan bir marta va faqat o'zgarganda yuboriladi |
| Order-service'da ulanish kutish | Standart 10 ta DB ulanishi 12 ta consumer oqimi va HTTP so'rovlar uchun yetmagan | Hikari pool 30 |

Partition sonini oshirishdan olingan saboq: topic'lar birinchi marta 6 partition'ga kengaytirilganda, oldinroq ishga tushgan consumer'lar yangi partition'larni ko'rmadi. Kafka consumer'i topic ma'lumotini standart holatda 5 daqiqada bir marta yangilaydi (`metadata.max.age.ms`). Natijada Saga hodisalarining taxminan 5/6 qismi o'qilmay kutib qoldi. Hodisalar yo'qolmadi — consumer'lar qayta ishga tushirilgach hammasi qayta ishlandi — lekin bu vaqtincha qotib qolgan buyurtmalarga olib keldi. Endi broker'ning standart partition soni (`KAFKA_NUM_PARTITIONS=6`) ham 6 ga o'rnatilgan, shuning uchun qaysi servis birinchi ishga tushishidan qat'i nazar, topic darhol to'g'ri partition soni bilan yaratiladi. Production'da esa topic'lar deploy'dan oldin infratuzilma darajasida yaratiladi va partition soni ishlab turgan tizimda consumer'lar qayta ulanishi rejalashtirilgan holda o'zgartiriladi.

Tez rad etishning ongli kelishuvi: agar qulfsiz o'qish "0" ko'rgan paytda boshqa buyurtma stokni qaytarayotgan bo'lsa, xaridor "sold out" javobini olishi mumkin. Qaytarilgan stok keyingi xaridorlarga darhol ochiq bo'ladi va ortiqcha sotuv hech qachon yuz bermaydi — flash-sale uchun bu to'g'ri tanlov.

O'lchov usulidagi o'zgarish: birinchi o'lchovda k6 xaridorni 15–20 soniyadan keyin "tashlab ketgan" deb hisoblagan va holatni har 250 ms'da so'ragan. Shu sababli ba'zi yakunlangan buyurtmalar k6'da hisobga olinmagan va polling'ning o'zi yuk bo'lgan. Keyingi o'lchovlarda kutish 60/90 soniya, polling esa 500 ms. Bu "keyin" natijalarini biroz yaxshilaydi, shuning uchun jadvalda bu ham qayd etilgan.

| Ko'rsatkich (100 dona, 1000 urinish, 200 VU) | Oldin | Keyin |
| --- | --- | --- |
| Invariantlar | ✓ 5/5 | _(to'ldiriladi)_ |
| Sotildi / to'landi | 100 / 100 | _(to'ldiriladi)_ |
| HTTP xatolar | 0 / 42 448 | _(to'ldiriladi)_ |
| `create_order` p95 | 5.72 s | _(to'ldiriladi)_ |
| Stok ushlanguncha p95 | 17.77 s (k6 15 s dan keyin kutmagan, kesilgan qiymat) | _(to'ldiriladi)_ |
| Yakunlanguncha p95 | 33.55 s (100 tadan faqat 47 tasi o'lchangan) | _(to'ldiriladi)_ |

| Ko'rsatkich (500 tomoshabin) | Oldin | Keyin |
| --- | --- | --- |
| STOMP ulanishi | 571 / 571 | 500 / 500 |
| Ulanish p95 | 423 ms | 1.55 s (500 ulanish 30 soniyada ochiladi) |
| "Tomoshabinlar soni" xabarlari | 454 583 | **8 151 (−98%)** |
| Stok yangilanishi yetkazilishi | o'lchanmadi (test stokni tiklamagan) | **120 000 / ~121 000 (99.2%)** |

Kesilgan o'lchov bo'yicha eslatma: birinchi o'lchovda k6 buyurtmani 15–20 soniyadan keyin kutmay qo'ygan, shuning uchun sekin buyurtmalar kechikish statistikasiga kirmagan. Tuzatilgan k6 bilan qilingan keyingi o'lchovlar barcha buyurtmalarni hisoblaydi. Shu sababli flash-sale kechikishlari "oldin" va "keyin" ustunlari orasida to'g'ridan-to'g'ri taqqoslanmaydi.

Testni ishonchli qilish bo'yicha eslatma: oversell invarianti dastlab `sotilgan ≤ STOCK` edi. Real stack'dagi o'lchovda u 101 > 100 deb yiqildi, stokning saqlanishi invarianti esa o'tdi: test boshida oldingi yugurishdan qolgan 1 dona ushlangan stok bor edi, u test davomida bo'shab, qonuniy sotildi. Invariant `sotilgan ≤ STOCK + testdan oldin ushlangan` deb tuzatildi.

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

## Yetkazib berish (delivery-service)

Buyurtma `COMPLETED` holatiga o'tganda order-service `OrderCompleted` hodisasini **o'z outbox'i orqali**, holat o'zgarishi bilan bitta tranzaksiyada yozadi. `delivery-service` (port 8086, o'z bazasi bilan) bu hodisadan yetkazib berishni yaratadi: kuzatuv raqami beriladi va jo'natma kuryerga topshiriladi. Yetkazib berish manzili buyurtma berilgan paytda buyurtmaga "surat" (snapshot) sifatida ko'chiriladi, shuning uchun profil keyinroq o'zgarsa ham eski buyurtmalarga ta'sir qilmaydi.

Holatlar: `PREPARING` (상품 준비 중) → `SHIPPED` (배송 시작) → `IN_TRANSIT` (간선 이동) → `OUT_FOR_DELIVERY` (배송 출발) → `DELIVERED` (배송 완료).

Kuryer holat o'zgarishlarini `POST /api/deliveries/webhooks/courier` webhook'i orqali yuboradi. Qabul qiluvchi haqiqiy kuryer integratsiyasida uchraydigan muammolarni hisobga oladi:

| Muammo | Yechim |
| --- | --- |
| Soxta so'rov | `X-Courier-Signature: sha256=HMAC(secret, timestamp.body)`, `MessageDigest.isEqual` bilan vaqtga bog'liq bo'lmagan taqqoslash |
| Ushlab qolingan so'rovni qayta yuborish | `X-Courier-Timestamp` 5 daqiqadan eski bo'lsa, rad etiladi |
| Kuryer bir hodisani qayta yuboradi | `event_id` unikal, takror `DUPLICATE` deb qaytariladi va qayta ishlanmaydi |
| Hodisalar tartibsiz keladi | Kech kelgan eski hodisa tarixga yoziladi (`RECORDED_OUT_OF_ORDER`), lekin holatni orqaga qaytarmaydi |
| Bir jo'natma uchun parallel webhook'lar | Yetkazib berish qatori `SELECT ... FOR UPDATE` bilan qulflanadi |

Webhook gateway'da JWT'siz ochiq (kuryerda foydalanuvchi tokeni yo'q), uni imzo himoya qiladi. Demo uchun kuryer simulyatori bor: u tashqi kompaniya kabi o'z holatini alohida jadvalda saqlaydi va har bir qadamni imzolangan HTTP so'rov bilan xuddi shu webhook endpoint'iga yuboradi. Hodisa identifikatori barqaror (`kuzatuv raqami + qadam`), shuning uchun qayta yuborilgan hodisa ham takror sifatida taniladi. Qadamlar orasidagi vaqt `courier.step-seconds` bilan sozlanadi.

## Admin API

Barcha admin yo'llari gateway'da faqat `ADMIN` roli uchun ochiq. Bundan tashqari, har bir servis `X-User-Roles` sarlavhasini o'zi ham qayta tekshiradi, shuning uchun gateway chetlab o'tilsa ham admin API yopiq qoladi. Har bir servis faqat o'z ma'lumotini beradi — alohida "admin servis" yoki servislararo JOIN yo'q.

| Yo'l | Servis | Vazifasi |
| --- | --- | --- |
| `GET /api/admin/orders?status=&page=&size=` | order | Buyurtmalar ro'yxati, holat bo'yicha filtr |
| `GET /api/admin/orders/summary` | order | Holatlar bo'yicha soni, tushum, 24 soatlik konversiya, qotib qolgan buyurtmalar, o'rtacha yakunlanish vaqti, daqiqalik grafik |
| `POST /api/admin/orders/{id}/retry` | order | Qotib qolgan Saga bosqichini kutmasdan qayta ishga tushirish |
| `POST /api/admin/orders/{id}/cancel` | order | To'lanmagan buyurtmani bekor qilish (stok darhol qaytariladi) |
| `GET /api/admin/payments/orders/{id}` | payment | Buyurtmaning to'lov yozuvi: usul, tasdiq vaqti, rad etish kodi |
| `GET /api/admin/payments/summary` | payment | To'lovlar soni, tasdiqlangan va qaytarilgan summalar |
| `GET /api/admin/inventory/products`, `PUT .../products/{id}` | inventory | Stok, ushlab turilgan va sotilgan miqdor; stok va narxni tahrirlash |
| `GET /api/admin/inventory/reservations/{orderId}` | inventory | Buyurtmaning stok ushlash yozuvi va muddati |
| `GET /api/admin/{payments,inventory}/outbox?aggregateId=` | payment, inventory | Buyurtmaga tegishli outbox hodisalari — Saga'ning hodisalar jurnali |
| `GET /api/admin/{payments,inventory}/outbox/health` | payment, inventory | Kutayotgan hodisalar soni, eng eskisining yoshi, so'nggi xatolar |

Statistika so'rovlari JPA orqali emas, to'g'ridan-to'g'ri SQL (`JdbcTemplate`, `FILTER`, `date_trunc`) bilan yozilgan: bu agregatlarni bitta so'rovda hisoblaydi va entity'larni xotiraga yuklamaydi.

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
- Yetkazib berish manzili: birinchi xaridda "구매하기" bosilganda manzil paneli ochiladi. Kiritilgan manzil standart manzil sifatida saqlanadi va buyurtma shu zahoti davom etadi, keyingi xaridlarda bu qadam bo'lmaydi. Manzil Daum(Kakao) "우편번호 찾기" bilan qidiriladi, skript yuklanmasa, qo'lda kiritish mumkin.
- "내 주문" (`/me`): standart manzil va buyurtmalar tarixi. Yakunlangan har bir buyurtmada 결제 완료 → 상품 준비 중 → 배송 시작 → 배송 중 → 배송 완료 bosqichlari, kuryer, kuzatuv raqami va "배송 조회" tarixi ko'rinadi. Yetkazib berish holati yetkazilguncha jonli yangilanadi, keyin so'rov to'xtaydi.
- Admin paneli (`/admin`, faqat `ADMIN` roli): dashboard'da 24 soatlik buyurtmalar, konversiya, tushum, o'rtacha yakunlanish vaqti, qotib qolgan buyurtmalar, daqiqalik grafik va har bir servisning outbox holati ko'rsatiladi. Ma'lumotlar 5 soniyada yangilanadi, brauzer yorlig'i yashirin bo'lsa so'rov yuborilmaydi. "Saga inspektori" tanlangan buyurtmani uchta yo'lakda (주문 / 결제 / 재고) vaqt masshtabida ko'rsatadi. Nuqtaning rangi hodisa Kafka'ga yetkazilganini bildiradi, yetkazilmagan hodisaning sababi esa shu yerning o'zida yoziladi. Operator qotib qolgan bosqichni qayta ishga tushirishi, to'lanmagan buyurtmani bekor qilishi, stok va narxni tahrirlashi mumkin.
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

Saga + Outbox oqimi, idempotentlik, timeout asosidagi tiklanish, distributed tracing, chaos testlari, live efir servisi, frontend, autentifikatsiya va API Gateway tayyor. Toss Payments integratsiyasi (backend va frontend) hamda stokni avval ushlab qoladigan Saga tayyor. Admin API, admin paneli, yetkazib berish kuzatuvi, "내 주문" sahifasi va k6 yuklama testlari tayyor. Qolgan ish: yuklama natijalarini o'lchab jadvalga yozish va yakuniy tozalash.
