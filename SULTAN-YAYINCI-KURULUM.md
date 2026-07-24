# Sultan Grill House Yayinci — Kurulum ve Canliya Gecis

Bu klasor, Sultan Grill House Instagram ve Facebook hesaplarina **API uzerinden otomatik paylasim** yapan kucuk bir sunucudur. Esto icin kurdugumuz mantigin ayni temizi. Sunucu kendi kendine calisir, planladigin gun ve saatte postu Instagram ve Facebook'a birakir.

## Nasil calisir (kisa mantik)

1. Bitmis post ve story gorselleri `content/media/` klasorunde durur.
2. Sunucu bu gorselleri kendi adresinden **herkese acik** yayinlar. Instagram ve Facebook gorseli ancak boyle cekebilir (Meta gorseli internetten indiriyor, sart olan bu).
3. `content/schedule.json` icinde hangi gorsel, hangi gun, hangi saat, hangi hesaplara yazilacagi yazar.
4. Sunucu her 5 dakikada bir bakar. Zamani gelen postu Instagram ve Facebook'a **o an** birakir. Instagram'da ileri tarihli zamanlama API'de yok, o yuzden bu sunucu tam saatinde tetikler.
5. Bir panelden (telefon uyumlu) durumu, sirada ne var, ne yayinlandi hepsini gorursun.

> Onemli gercek. Bu paylasimi ben (Claude) buradan canli olarak yaptiramam. Token'i alma, sunucuyu kurma ve gercek yayin tetikleme senin yapacagin islerdir. Ben butun kodu, panoyu ve asagidaki adimlari hazir ettim. Esto'da da guardrail engeli buydu, cozumu bu sunucu modeli oldu.

---

## Bolum 1 — Hesap hazirligi (Meta tarafinda, bir kez)

Su an Instagram var (@sultangrillhouse_sultanahmet), Facebook Sayfasi yok. API'nin calismasi icin uc sey gerekir.

**1) Facebook Sayfasi ac.** facebook.com uzerinden Sultan Grill House icin bir Sayfa olustur. Ad "Sultan Grill House", kategori restoran. Restoranin Google hesabi (sultangrillhouse1@gmail.com) veya senin yonetici hesabinla ac.

**2) Instagram'i Isletme hesabina cevir.** Instagram uygulamasi, Ayarlar, Hesap turu ve araclar, Profesyonel hesaba gec, **Isletme** sec (Creator degil, bu API yolu Isletme ister). Bu adimda seni bir Facebook Sayfasina baglamaya yonlendirir, yeni actigin Sayfayi sec.

**3) Baglantiyi dogrula.** Facebook Sayfasi, Ayarlar, Bagli hesaplar, Instagram. @sultangrillhouse_sultanahmet bagli gorunmeli. Ayrica Sayfa icin "Sayfa Yayinlama Yetkisi" (Page Publishing Authorization) istenebilir, onaylayin.

Bu uc adim tamamlandiginda hesaplar hazir.

---

## Bolum 2 — Meta uygulamasi ve kalici token (bir kez, en kritik adim)

Amac, sifreye veya oturuma bagli olmayan, **hic suresi dolmayan** bir Sayfa erisim token'i uretmek. Yolu System User (sistem kullanicisi).

**1) Meta Business hesabin olsun.** business.facebook.com. Sayfa ve Instagram bu Business portfoyunde olmali (Business Settings, Accounts kismindan ekle veya sahiplen).

**2) Uygulama olustur.** developers.facebook.com, My Apps, Create App, tip **Business**. (Esto icin actigin "Esto Sosyal Medya" uygulamasini da kullanabilirsin, tek uygulama birden cok sayfayi yonetebilir. Yeni ac dersen ad ornek "Sultan Sosyal Medya".) Uygulamaya **Instagram** ve **Facebook Login for Business** urunlerini ekle.

**3) System User uret.** Business Settings, Users, **System Users**, Add. Rol Admin. Ad ornek "sultan-yayinci-bot".

**4) Varliklari ata.** Ayni ekranda System User'a su uc varligi ekle. Facebook Sayfasi (tam kontrol), Instagram hesabi, Uygulama.

**5) Token uret.** System User satirinda **Generate New Token**, uygulamayi sec. Sona erme (expiration) kismini **Never** yap. (Dikkat, ekran varsayilan olarak 60 gun gelir, elle Never sec.)

**6) Izinleri sec.** Su bes izin.
```
pages_show_list
pages_read_engagement
pages_manage_posts
instagram_basic
instagram_content_publish
```

**7) Token'i kopyala.** Bir kez gosterilir, hemen kopyala. Bu token gizlidir, kimseyle paylasma, repoya yazma. Coolify'da gizli degisken olarak duracak.

> Kendi hesabina yayin yaptigin icin App Review (uygulama incelemesi) ve isletme dogrulamasi **gerekmez**. Standard Access yeterli. Ileride bunu cok musterili bir urune cevirirsek o zaman inceleme gerekir.

---

## Bolum 3 — Kimlikleri bul (PAGE_ID ve IG_USER_ID)

Bilgisayarinda bu klasorde bir kez calistir.

1. `.env.example` dosyasini `.env` olarak kopyala.
2. `.env` icine sadece `PAGE_ACCESS_TOKEN=...` satirina token'i yaz.
3. Terminalde
```bash
npm install
npm run get-ids
```
Cikti sana her Sayfanin `PAGE_ID` ve bagli `IG_USER_ID` degerini verir. Sultan Grill House satirindaki iki degeri al.

---

## Bolum 4 — .env doldur

`.env` icini tamamla.
```
PAGE_ID=<get-ids ciktisindan>
IG_USER_ID=<get-ids ciktisindan>
PAGE_ACCESS_TOKEN=<Bolum 2 token>
GRAPH_VERSION=v25.0

LOCK_PAGE_ID=<PAGE_ID ile AYNI>
LOCK_IG_USER_ID=<IG_USER_ID ile AYNI>
LOCK_IG_USERNAME=sultangrillhouse_sultanahmet

PUBLIC_BASE_URL=https://yayin.sultangrillhouse.com   (Coolify domaini, Bolum 5)
DRY_RUN=true
PAUSED=false
TZ=Europe/Istanbul
ADMIN_KEY=<uzun rastgele bir sifre>
PORT=3000
```

`LOCK_*` alanlari bir guvenlik freni. Hedef hesap ID'leri kilitle uyusmazsa sunucu **hicbir sey yayinlamaz**. Esto'daki "yanlis sayfaya yayin" kazasini onlemek icin. Bu yuzden LOCK degerleri PAGE_ID ve IG_USER_ID ile ayni olmali.

Token gercekten calisiyor mu bak.
```bash
npm run check-token
```

---

## Bolum 5 — Coolify'a deploy (mevcut VPS, 72.62.47.198)

Sultan sitesiyle ayni sunucu ve GitHub duzeni.

1. Bu `yayinci/` klasorunu kendi git deposu yap ve GitHub'a gonder (ornek repo adi `craftekibi-ship-it/sultan-yayinci`). `gh repo create --public` harness'ta engelli, o komutu sen calistir, sonra `git push` sorunsuz.
2. Coolify'da yeni bir uygulama olustur, kaynak bu repo, build **Dockerfile**.
3. Bir domain ver, ornek `yayin.sultangrillhouse.com`. DNS'te `A yayin -> 72.62.47.198`. SSL Coolify otomatik verir. Bu adres `PUBLIC_BASE_URL` olacak.
4. Environment Variables kismina `.env` icindeki tum degerleri gir (ozellikle `PAGE_ACCESS_TOKEN` ve `ADMIN_KEY` gizli). `PUBLIC_BASE_URL` bu domain olsun.
5. **Kalici disk** ekle, `/app/data` yoluna (state.json burada durur, redeploy'da kaybolmasin). Gorseller icin `/app/content/media` yolunu da kalici diske baglamak istersen yapabilirsin, ya da gorselleri repoya koyup deploy edersin.
6. Deploy et. `https://yayin.sultangrillhouse.com/health` acildiginda `{ok:true}` gormelisin.

Panele giris. `https://yayin.sultangrillhouse.com/?key=<ADMIN_KEY>`

---

## Bolum 6 — Gorselleri ve plani koy

1. Bitmis post/story gorsellerini `content/media/` icine koy. JPEG, dosya adinda Turkce karakter ve bosluk olmasin. Feed 1080x1350, story 1080x1920.
2. `content/schedule.json` icini gercek postlarla doldur. Her ogenin `media` alani `content/media/` icindeki dosya adiyla birebir ayni olmali.
3. Panelde "Yaklasan" listesinde postlarin dogru gun ve saatte gorunmesini kontrol et.

---

## Bolum 7 — Canliya gecis (guvenli sira)

Asla ilk denemede canli basma. Su sirayi izle.

1. **Deneme modunda listele.** `DRY_RUN=true` iken
```bash
npm run tick -- --list
```
Zamani gelen ve yaklasan postlari, mod ve kilit durumunu yazar. Gercek yayin olmaz.

2. **Deneme canary.** Panelde bir postun yaninda "test yayinla" butonu. `DRY_RUN=true` iken sadece ne yapacagini loglar, paylasim yapmaz. Adimlar dogru mu gor.

3. **Tek gercek test.** Hazir oldugunda `DRY_RUN=false` yap, `LOCK_*` dolu oldugundan emin ol, redeploy et. Panelden **tek bir** postu "test yayinla" ile gercek yayinla. Instagram ve Facebook'ta kontrol et.

4. **Otomatige birak.** Her sey dogruysa artik dokunmana gerek yok. Sunucu her 5 dakikada zamani gelen postu kendisi yayinlar.

### Aciil frenler
- `PAUSED=true` yap ve redeploy et, tum yayin durur.
- `DRY_RUN=true` yap, gercek paylasim durur (deneme moduna doner).
- Token bozulursa (sifre degisimi, izin kaldirma) panelde Token "HATA code 190" gorunur, Bolum 2'den token'i yeniden uret.

---

## Guvenlik ve sinirlar (bilmen iyi olur)

- Instagram gunde en fazla 100 API paylasimina izin verir. Bizim tempoda sorun olmaz, panel kotayi gosterir.
- Instagram gorseli **sadece JPEG** kabul eder, PNG'yi sessizce reddedebilir. Gorselleri JPEG ver.
- Story'de API link/anket/sticker koyamaz, sadece gorsel. Metni gorselin uzerine tasarimda bas.
- Carousel (cok gorselli tek post) 2-10 gorsel, hepsi ayni oranda olmali, tek post sayilir.
- Facebook story API ile pratik degil, story ogeleri Instagram'a gider.

---

## Teknik ek (gelecekteki Claude icin API notu)

Meta Graph API v25.0 (2026 ortasi, dogrulanmis). Host `graph.facebook.com`, Facebook Login yolu, Sayfa token'i.

- FB metin: `POST /{PAGE_ID}/feed` message=, access_token=
- FB foto: `POST /{PAGE_ID}/photos` url=, caption= (message DEGIL), published=true
- FB zamanlama (sadece FB): published=false + scheduled_publish_time=unix SANIYE UTC (10 dk ile 30 gun arasi)
- IG foto: `POST /{IG_USER_ID}/media` image_url=,caption= -> creation_id -> `POST /{IG_USER_ID}/media_publish` creation_id=
- IG carousel: her cocuk is_carousel_item=true, parent media_type=CAROUSEL children=virgullu, caption parent'ta
- IG story: media_type=STORIES image_url= (caption yok sayilir)
- IG native zamanlama YOK, container 24 saatte olur, cron tam saatinde publish eder
- IG_USER_ID: `GET /{PAGE_ID}?fields=instagram_business_account`
- Kalici token: System User, expiration Never
- Sik hata: 9004/2207052 gorsel URL'ye ulasamama (public degil), 190 token
