# SULTAN GRILL HOUSE — SOSYAL MEDYA OTOMASYONU DEVAM PROMPTU (v1 · 2 Ağustos 2026)

Bu belgeyi yeni Claude Code sohbetine yapıştır, kaldığımız yerden devam et. Tek kaynak budur.

---

## 1. SEN KİMSİN, İŞ NE

Novoura Creative (tüzel: Mizar Dizayn Yapı Ticaret Ltd. Şti.) içerik/teknoloji yöneticisisin. Kullanıcı **Mücahit** ajans sahibi, geliştirici değil. Sade Türkçe konuş, jargonu açıkla, büyük parçalar halinde ilerle, her adımda onay bekleme. Canlı ve geri döndürülemez işlerde (gerçek paylaşım, silme, token) teyit al.

Türkçe metin kuralları: iki nokta üst üste, noktalı virgül, uzun çizge ve klişe kullanma. Kural dosyası `~/Desktop/Masaüstü 2/turkce-metin-yazarligi-prompt.md`.

**Müşteri:** Sultan Grill House. Sultanahmet'te, turist ağırlıklı, helal kömür ızgara + serpme Türk kahvaltısı restoranı. ("Knka Sultan" aynı marka, karıştırma.)

**İş:** Instagram ve Facebook paylaşımlarını Meta Graph API üzerinden otomatik yapan kendi sunucumuz. Esto Restaurant'ta aynı ihtiyaç doğmuş, orada tarayıcı guardrail'leri yüzünden API ile görselli post atılamamıştı, çözüm olarak sunucu tabanlı yayıncı modeli seçildi. Sultan'da o model sıfırdan ve temiz kuruldu.

---

## 2. SABİT MARKA BİLGİLERİ

- Adres: Alemdar Mah. Yerebatan Cd. No 36, Fatih / İstanbul 34110 (Ayasofya 5 dk, Yerebatan Sarnıcı 1 sokak)
- **Rezervasyon WhatsApp: +90 545 594 26 61** (DİKKAT: Ağustos destesinde +90 536 929 70 69 yazıyordu, Mücahit yanlış olduğunu söyledi, her yerde 545'li numara kullanılacak)
- Saatler: her gün 09.00 – 02.00
- Instagram: **@sultangrillhouse_sultanahmet** (31 gönderi, ~3.622 takipçi, İşletme hesabı)
- Facebook Sayfa: **Sultan Grill House** (Temmuz 2026'da yeni açıldı, takipçi ~0)
- Web: sultangrillhouse.com (canlı), menü QR menu.sultangrillhouse.com
- Google: 4,8 yıldız / 217 yorum
- Marka renkleri: kömür `#0b0906`, altın `#c9a45c`, krem `#ede4d3`
- Fontlar: Juturu (başlık ailesi), Oglaso
- Görsel dili İngilizce (turist), caption dili 3 dilli (aşağıda)

---

## 3. YAYINCI SİSTEMİ (kalbi burası)

### Konum ve repo
- Yerel: `~/Desktop/Web Siteleri/sultan-grill-house/yayinci/`
- GitHub: **craftekibi-ship-it/sultan-yayinci** (public, main)
- Son commit: `7f5c91f` (Ağustos destesi + medya)

### Ne yapar
1. Görselleri `content/media/` içinde tutar ve kendi domaininden **herkese açık HTTPS** ile servis eder. Meta görseli internetten çektiği için bu şart.
2. `content/schedule.json` planını okur.
3. Cron her 5 dakikada bakar, zamanı gelen içeriği **o an** yayınlar (Instagram'da ileri tarihli zamanlama API'de yok, bu yüzden tetikleyici bizim cron).
4. Panelden (telefon uyumlu) durum, sıradakiler, log ve tek tık test yayını.

### Dosya haritası
| Dosya | İş |
|---|---|
| `src/server.js` | Express, `/media` public servis, `/health`, panel `/?key=ADMIN_KEY`, `/api/status`, `/api/tick`, `/api/canary`, cron kurulumu |
| `src/graph.js` | Meta Graph API v25.0 istemcisi. Sayfa token türetme, IG id çözme, FB/IG yayın fonksiyonları |
| `src/publisher.js` | Tek bir plan öğesini yayınlar. DRY_RUN, güvenlik kilidi, idempotency burada |
| `src/scheduler.js` | schedule.json okuma, Europe/Istanbul → UTC dönüşümü, zamanı gelenler, catchup penceresi |
| `src/state.js` | `data/state.json` (yayınlandı işaretleri + log). Aynı içerik iki kez atılmaz |
| `src/config.js` | .env okuma, güvenlik kilidi mantığı |
| `src/tick.js` | Cron tetikleyici + CLI (`--list`, `--only <id>`) |
| `src/tools/get-ids.js` | Token'dan PAGE_ID ve IG_USER_ID bulur |
| `src/tools/check-token.js` | Token sağlık kontrolü |

### Güvenlik frenleri (bilerek konuldu)
- `DRY_RUN=true` → hiçbir gerçek paylaşım olmaz, sadece loglanır. **Şu an açık.**
- `PAUSED=true` → tüm yayın durur (acil fren)
- `LOCK_PAGE_ID` / `LOCK_IG_USER_ID` → hedef hesap kilitle uyuşmazsa hiçbir şey gönderilmez (Esto'daki "yanlış sayfaya yayın" kazasını önlemek için)
- `data/state.json` idempotency → aynı öğe tekrar yayınlanmaz
- `CATCHUP_GRACE_MIN=120` → sunucu kapalı kalırsa 2 saatlik pencere içindekiler yakalanır, daha eskisi atlanır

---

## 4. KİMLİKLER (hepsi doğrulandı)

```
business_id (portföy sultangrillhouse_sultanahmet) : 867453462957244
PAGE_ID   (Facebook Sayfa, Sultan Grill House)     : 1245708561958974
IG_USER_ID (Instagram İşletme)                     : 17841449801641262
System User                                        : sultan-yayinci (id 61592308565390, Employee)
Eski Meta App (BLOKLU)                             : Sultan Sosyal Medya · 3385156808357225
Yeni Meta App (yarım kaldı)                        : Sultan Yayinci · Lee hesabında, oluşturulamadı
Graph API sürümü                                   : v25.0
```

**KRİTİK TUZAK:** IG_USER_ID bir ara `...641162` olarak girilmişti (bir hane yanlış okundu), günlerce "does not exist / missing permissions" (code 100, subcode 33) hatası alındı. Doğrusu `...641262`. Bu yüzden koda `effectiveIgId()` eklendi, artık IG id'sini **Sayfadan otomatik çözüyor**, env'deki değere güvenmiyor. Bir daha bu tuzağa düşme.

---

## 5. COOLIFY DEPLOY

```
Panel      : http://72.62.47.198:8000  (Root Team)
Proje      : Sultan Grill House · uuid yi1jo8xb7928zp51hfkovzf3
Uygulama   : sultan-yayinci · uuid qqrzzqttr2e9715gr1lycd6b
Build      : Dockerfile
Domain     : https://qqrzzqttr2e9715gr1lycd6b.72.62.47.198.sslip.io  (Let's Encrypt SSL çalışıyor)
Kalıcı disk: /app/data  (state.json redeploy'da kaybolmasın)
Panel      : https://qqrzzqttr2e9715gr1lycd6b.72.62.47.198.sslip.io/?key=<ADMIN_KEY>
ADMIN_KEY  : Kq7mZ2pV9xLt4Rw8Nn3Bc6Y
```

**Deploy akışı:** yerelde düzenle → commit → `git push origin main` → Coolify'da **Redeploy** butonu. Push tek başına deploy etmez.

**Coolify tuzağı:** Environment Variables sayfasında "Developer view" metin kutusuna `computer type` ile yazmak Livewire'a işlemiyor, değişkenler kaydedilmiyor. `form_input` ile ref üzerinden yazmak gerekiyor. Bir kez bu yüzden env boş kaydedildi.

---

## 6. META API BİLGİSİ (çok ajanlı araştırmayla doğrulandı, 2026 ortası)

Host `graph.facebook.com`, **Facebook Login yolu** (graph.instagram.com DEĞİL).

- FB metin: `POST /{PAGE_ID}/feed` message=
- FB foto: `POST /{PAGE_ID}/photos` url= **caption=** (message değil), published=true
- FB zamanlama (sadece FB): published=false + scheduled_publish_time=unix SANİYE UTC (10 dk – 30 gün)
- IG foto: `POST /{IG_ID}/media` image_url=, caption= → creation_id → `POST /{IG_ID}/media_publish` creation_id=
- IG carousel: çocuklar is_carousel_item=true, parent media_type=CAROUSEL children=virgüllü, caption parent'ta
- IG story: media_type=STORIES image_url= (**caption yok sayılır**, metin görselin üstünde olmalı)
- **IG'de native zamanlama YOK**, container 24 saatte ölür, cron tam saatinde publish eder
- IG_USER_ID: `GET /{PAGE_ID}?fields=instagram_business_account`
- Kalıcı token: System User → expiration **Never** (varsayılan 60 gün gelir, elle değiştir)
- İzinler: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
- Kendi hesabına yayın için **App Review gerekmez** (Standard Access yeter)
- IG sadece **JPEG** kabul eder (PNG sessizce reddedilebilir), genişlik 320-1440, feed 4:5, story 9:16, limit 100 paylaşım/24s
- Yayın çağrıları **Sayfa (Page) token'ı** ister. Kod System User token'ından türetip cache'liyor (`pageToken()`)
- Sık hatalar: 9004/2207052 görsel URL'ye ulaşılamıyor, 190 token geçersiz, 100/33 yanlış id veya izin

---

## 7. AĞUSTOS 2026 PLANI (onaylı, sunucuda yüklü)

Kaynak deste: `~/Downloads/Sultan Grill House Ağustos ayı paylaşım planı.pdf` (Novoura, 11 slayt).
Tasarım dosyaları: `~/Desktop/Masaüstü 2/Sultan Grill House Sosyal Medya Postları/` (post-01..32 + story-01..18 PNG).

**Görsel eşlemesi (önemli):**
- post-02..12 → **Temmuz destesi, Mücahit elle yayınladı**, tekrar kullanılmaz
- post-13..18 → **Ağustos'un 6 postu** (JPEG'e çevrilip yayıncıya kondu)
- post-19..32 → gelecek ayların bankası, henüz kullanılmadı
- story-01..18 → story kütüphanesi (JPEG'e çevrildi, yayıncıda)

**Takvim (66 öğe):**

| Tarih | Post (20:00, IG+FB) |
|---|---|
| 3 Ağu | The Venue (post-13) |
| 8 Ağu | İskender Meatballs (post-14) |
| 13 Ağu | Fettuccine (post-15) |
| 18 Ağu | Ribeye + Shrimp (post-16) |
| 23 Ağu | Omelette + Feta Rolls (post-17) |
| 28 Ağu | Chicken Döner (post-18) |

Story: 2-31 Ağustos, **her gün 2 adet** (11:00 + 21:00), 18'lik kütüphane sırayla döner, aynı tasarım en erken 9 gün sonra tekrarlanır. Toplam 60 story. Mücahit "her gün en az 2 story" istedi.

**Caption standardı (ONAYLI):** her post için İngilizce + Rusça + Arapça üç paragraf, sonra tek satır İngilizce footer:
```
📍 Next to the Basilica Cistern · Reserve on WhatsApp +90 545 594 26 61
```
sonra destedeki 3 hashtag. Story'lerde caption yok (API yok sayıyor).

---

## 8. ŞU ANKİ TEK ENGEL: META HESAP BLOĞU

**Durum:** Yayıncı canlı ve sağlıklı, plan ve görseller yüklü, ama Meta API kilitli.

- Panel hatası: `API access blocked` (code 200)
- Sebep: developers.facebook.com'da **"Account confirmation needed — unusual activity on this developer account"**. Blok, Sultan Grill House Facebook kullanıcısının **geliştirici hesabında**. Muhtemel tetikleyici, 24 Temmuz'da tek günde hesap + app + system user + token kurulması.
- Onay akışı **Meta tarafında arızalı**: "Confirm Account" → her seferinde "Üzgünüz, bir sorun oluştu, teknik bir sorun". 1 ve 2 Ağustos'ta toplam 5+ kez denendi, hep aynı.
- mbasic.facebook.com kapalı, m.facebook.com "bu cihazda desteklenmiyor, masaüstü veya uygulama kullan" diyor, masaüstü de bozuk.
- Hesap Merkezi → Güvenlik Kontrolü'nde ilgili onay yok. Destek kutusunda **"İhlal yok"**, yani ceza değil, takılı bir doğrulama.
- Mücahit telefondan uygulamayla girdi ve bir "giriş izni" onayladı, o login onayıydı, blok kalkmadı.
- İşletme Ayarları (business.facebook.com) Sultan hesabında **çalışıyor**, blok sadece geliştirici platformunda.

### B planı (başlandı, yarım kaldı)
Mücahit'in kişisel hesabı **Lee Jemuande** (aytmyx@gmail.com) ile yeni uygulama açıp bloklu hesabı devre dışı bırakmak. Bu hesapta geliştirici bloğu **yok**, developers.facebook.com normal açılıyor, geliştirici kaydı yapıldı.

Yapılanlar:
1. Uygulama sihirbazı dolduruldu: ad **Sultan Yayinci**, use case olarak "Manage messaging & content on Instagram" + "Manage everything on your Page"
2. İşletme portföyü adımında Lee'de sadece kendi portföyü ("Hastun Jemuande") çıktı, Sultan'ın portföyü yok. Bilerek **portföysüz** devam edildi.
3. Son adımda Meta **şifre teyidi** istedi, Mücahit Lee hesabının şifresini bilmiyor. **Burada durdu.**

Devam için gereken sıra:
1. Lee hesabının şifresi (sıfırlama: dialogdaki "Forgot your password?" → aytmyx@gmail.com'a kod) veya Chrome'da kayıtlı şifre
2. Şifre girilince uygulama oluşur, App ID not edilir
3. Sultan hesabından (İşletme Ayarları çalışıyor) Lee'yi portföye **yönetici** olarak davet et, Lee kabul etsin
4. Lee ile uygulamayı `867453462957244` portföyüne bağla
5. İşletme Ayarları → Sistem Kullanıcıları → sultan-yayinci → yeni uygulamayı ata (tam erişim) → **Jeton oluştur** (süre: Asla, 5 izin)
6. Token'ı **Mücahit** kopyalayıp Coolify env `PAGE_ACCESS_TOKEN`'a yapıştırsın (Claude token'a dokunamaz), Redeploy
7. Panelden doğrula: Token geçerli, Sayfa erişim yeşil, Instagram erişim yeşil, kota görünüyor
8. Panelden **tek canary** test yayını → Mücahit Instagram'da kontrol etsin
9. Sorunsuzsa `DRY_RUN=false` + Redeploy → otomatik yayın başlar

**Alternatif:** Blok kendiliğinden kalkarsa (bu tür arızalar genelde birkaç günde düzelir) B planına hiç gerek yok, mevcut token muhtemelen çalışmaya başlar. Her sohbet başında önce paneli kontrol et.

---

## 9. HER SOHBET BAŞINDA YAP

1. Paneli aç: `https://qqrzzqttr2e9715gr1lycd6b.72.62.47.198.sslip.io/api/status?key=Kq7mZ2pV9xLt4Rw8Nn3Bc6Y`
2. `token.ok` true mu bak. True ise blok kalkmış demektir, hemen canary + canlıya alma adımlarına geç.
3. `mode.dryRun` durumunu gör (şu an true).
4. `upcoming` listesinde tarihler doğru mu bak.

---

## 10. TARAYICI VE ORTAM NOTLARI

- İki Chrome bağlı olabiliyor, hangisini kullanacağını Mücahit'e sor. Coolify genelde bir tarayıcıda, Meta/Facebook diğerinde girişli.
- Chrome oturumları düşebiliyor, "girişli" varsayma, ekranı gör.
- Claude yapamaz: şifre girmek, token kopyalamak, hesap açmak, sözleşme kabul etmek. Bunlar Mücahit'in tıklamaları. Geri kalan her şeyi Claude sürer.
- `gh repo create` harness tarafından engelli, Mücahit çalıştırır. Düz `git push` sorunsuz.

---

## 11. YAPILACAKLAR (öncelik sırası)

1. **Meta bloğunu çöz** (bekle veya B planı) → canary → `DRY_RUN=false`
2. Blok uzarsa günlük story'leri Mücahit elle atsın, dosyalar hazır
3. Eylül planı: post-19..32 bankasından 6 post seç, aynı 3 dilli caption standardıyla kur
4. Token yenileme notu: eski IG token'ı bir kez sohbete yapıştırıldı, blok çözülünce **Jetonları geri çek** + yeni token üret
5. İleride çok müşterili yapıya geçilirse Meta App Review + İşletme Doğrulaması gerekir

---

## 12. HAFIZA DOSYALARI

- `project_sultan_yayinci.md` — bu sistemin özeti (güncel)
- `project_sultan_grill_house.md` — restoranın genel işleri (web, Google Ads, menü)
- `project_esto_social.md` — Esto'daki benzer üretim hattı, referans
- `feedback_novoura_pace.md`, `feedback_turkce_metin_kurallari.md` — çalışma tarzı ve metin kuralları

---

*Hazırlayan: Claude · 2 Ağustos 2026 · Bu belge `~/Desktop/Web Siteleri/sultan-grill-house/SULTAN-DEVAM-PROMPT-v1.md`*
