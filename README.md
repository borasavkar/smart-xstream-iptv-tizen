# Smart Xtream — Samsung Tizen TV

`C:\Android Studio Projects\SmartXtream` (Android / Kotlin) uygulamasının **Samsung Tizen TV** için klonu.
Tizen TV uygulamaları web tabanlıdır → **Vanilla TypeScript** ile yeniden yazılıyor.

> **Bu aşama: AVPlay Oynatıcı Kanıtı (PoC).**
> Amaç: TV'de gerçek bir Xtream **canlı/TS/HLS** yayınının `webapis.avplay` ile oynadığını kanıtlamak.
> Bu kanıtlanınca tüm arayüz (giriş, kategoriler, film/dizi, öneri motoru, deneme) bunun üstüne kurulacak.

---

## Gereksinimler

| Araç | Ne için | Durum |
|------|---------|-------|
| Node.js 18+ | Derleme | ✅ kurulu (v26) |
| Tizen Studio | `.wgt` paketleme + Samsung sertifikası | ⚠️ sende kurulu olmalı |
| Samsung TV (Geliştirici Modu) **veya** TV Emülatörü | Gerçek AVPlay testi | gerekli |

---

## Komutlar

```bash
npm install        # bağımlılıklar (esbuild + typescript) — bir kez
npm run build      # TypeScript tip kontrolü + bundle  → dist/
npm run serve      # dist/'i http://localhost:8080 'de yayınla (tarayıcı testi)
npm run icon       # placeholder ikonu yeniden üret
```

### Tarayıcıda hızlı test (sınırlı)
`npm run build && npm run serve` → tarayıcıda `http://localhost:8080`.
Tarayıcıda AVPlay yoktur → **HTML5 `<video>` fallback** devreye girer.
- ✅ Çalışır: arayüz, kumanda-okları navigasyonu, **HLS/MP4** oynatma (örn. "Örnek HLS doldur" butonu).
- ❌ Çalışmaz: Xtream **canlı `.ts`** yayınları (bunlar AVPlay + gerçek TV ister).

---

## TV'ye yükleme (gerçek AVPlay testi)

### 1) Samsung TV'yi Geliştirici Moduna al
`Apps` aç → kumandadan **1 2 3 4 5** → *Developer mode* **ON** → **bilgisayarının IP**'sini gir → TV'yi yeniden başlat.

### 2) `tizen` / `sdb` CLI'ı bul (PATH'te değilse)
Tizen Studio kuruluysa genelde şuradadır:
```
<TizenStudio>\tools\ide\bin\tizen.bat
<TizenStudio>\tools\sdb.exe
```
Bu klasörleri PATH'e ekle ya da tam yolla çağır.

### 3) Sertifika (bir kez)
Tizen Studio → **Tools ▸ Certificate Manager** → **Samsung** sertifikası oluştur
(TV'yi DUID ile ekler). Profil adını not et (örn. `SmartXtreamCert`).

### 4) Paketle, bağlan, yükle, çalıştır
```bash
npm run build

# dist/ klasörünü .wgt olarak paketle (sertifika profilinle imzala)
tizen package -t wgt -s SmartXtreamCert -- dist

# TV'ye bağlan (TV IP'sini Developer mode ekranında gördün)
sdb connect 192.168.1.XX
sdb devices                       # cihaz göründü mü?

# yükle ve çalıştır
tizen install -n SmartXtream.wgt -- dist
tizen run -p SmrtXtrm01.SmartXtream -t <device-name>
```
> Alternatif: Tizen Studio GUI ile `dist` klasörünü "Tizen Project" olarak import edip
> **Run As ▸ Tizen Web Application** da diyebilirsin. VS Code "Tizen TV" eklentisi de paketleyebilir.

---

## ✅ Bu PoC'ta neyi doğruluyoruz

1. Uygulama TV'de açılıyor, kumanda **ok tuşlarıyla** alanlar arasında geziliyor (yeşil neon odak halkası).
2. **"Örnek HLS doldur" → ▶ Oynat** → bilinen HLS yayını tam ekran oynuyor (AVPlay'in kendisi çalışıyor mu?).
3. **Xtream alanları** (sunucu/kullanıcı/şifre/Stream ID, tip=live, uzantı=ts) → ▶ Oynat → **kendi canlı yayının** açılıyor.
4. Sağdaki **günlük panelinde** AVPlay durumları (`open → prepare → playing`) ve hata kodları görünüyor.
5. **Return** tuşu yayını durduruyor / uygulamadan çıkıyor.

Stream ID'yi panelinden ya da `player_api.php?...&action=get_live_streams` çıktısından alabilirsin.

---

## Proje yapısı

```
smart-xtream-tizen-claude/
├── config.xml              # Tizen TV manifest (privileges, app id)
├── icon.png                # placeholder ikon (mağaza öncesi değiştir)
├── build.mjs               # esbuild bundle + statik kopyalama → dist/
├── serve.mjs               # tarayıcı testi için mini sunucu
├── scripts/make-icon.mjs   # bağımlılıksız PNG ikon üretici
└── src/
    ├── index.html          # giriş HTML (webapis.js + bundle)
    ├── styles.css          # TV-optimize tema (1920×1080, overscan-güvenli)
    ├── main.ts             # PoC akışı (form + oynatıcı + kumanda)
    ├── types/tizen.d.ts    # webapis/avplay + tizen tip tanımları
    ├── core/xtream.ts      # Xtream stream-URL kurucu (Android'den birebir)
    ├── player/AVPlayer.ts  # AVPlay sarmalayıcı (+ tarayıcı için HTML5 fallback)
    └── input/remote.ts     # kumanda tuş kodları + spatial navigation
```
`xtream.ts`, `AVPlayer.ts`, `remote.ts` ve `tizen.d.ts` tam uygulamada da **yeniden kullanılacak**.

---

## Sonraki adımlar (tam klon yol haritası)

- [x] **Aşama 0 — AVPlay PoC** — artık ana ekrandan 🔧 ile erişilen `playertest` ekranı
- [x] **Aşama 1 — Çekirdek + Giriş:** Xtream API istemcisi (`fetch`, mock-aware), profil yönetimi (localStorage), demo/mock mod, i18n (TR), ekran yönlendirici + spatial navigation, intro/profil/ana ekran. *(Tarayıcıda demo modda uçtan uca doğrulandı.)*
- [x] **Arayüz teması:** Android `colors.xml` paleti + `layout-land` TV sidebar düzeni + öneri rafları (RecommendationEngine birebir port). *(Tarayıcıda doğrulandı.)*
- [x] **Aşama 2 — Gezinme + oynatma:** Canlı kategori→kanal→oynat, Film/Dizi grid + arama + kategori çipleri, film detay + "Hemen İzle", dizi detay + sezon/bölüm, gerçek oynatıcı ekranı (AVPlay). *(Üç akış da demo modda uçtan uca doğrulandı.)*
- [x] **Aşama 4 — Akıllı katman:** RecommendationEngine + favoriler (♥) + izleme geçmişi + "İzlemeye Devam Et" rafı + kişiselleşen öneriler + kaldığın yerden devam. *(Tarayıcıda doğrulandı.)*
- [x] **Aşama 3 — Oynatıcı UI (gelişmiş):** çözünürlük + anlık hız HUD'u (imza özellik), modern kontrol çubuğu + ilerleme çubuğu, **basılı tutunca hızlanan ileri/geri sarma**, ses/altyazı/kalite parça menüleri (AVPlay), **stilli altyazı** (boyut/arka plan), canlı kanal değiştirme (⏮/⏭ + Yukarı/Aşağı), now-playing EPG, kaldığın yerden devam. *(Sahne küçük-resimleri atlandı — kaynak yok.)*
- [x] **Ayarlar + tercihler:** tercih edilen ses/altyazı dili (+altyazı kapalı), altyazı stili, video kalitesi (4K→480p) — içerik bu tercihlerle açılır. Profil silme onaylı (kaza ile silinmez). *(Tarayıcıda doğrulandı; AVPlay parça listesi/hız/.ts oynatma gerçek TV'de.)*
- [x] **Aşama 5 — Para kazanma:** 7 gün cihaz-bazlı deneme (Firebase Firestore REST + anon auth, fail-open), deneme bitince paywall, 3 plan, satın alma → premium. Samsung Checkout iskeleti hazır. *(Mock'la uçtan uca doğrulandı.)*
      - ⚙️ **Üretim için yapılacak:** Firebase'de **Anonymous Auth**'u aç; gerekirse Web API key oluştur (`src/config/app-config.ts`); Firestore kuralları `trials/{deviceId}` için auth'lu erişime izin versin; Samsung Seller Office'te 3 ürünü tanımlayıp `config`'e ID'leri ve `samsungCheckout.appId`'yi gir.
- [x] **Aşama 6a — Çoklu dil:** 11 dil (TR + EN/DE/FR/ES/IT/PT/NL/PL/RU/AR), arayüz dil seçici (⚙ Ayarlar), sistem dili otomatik algılama, Arapça RTL, İngilizce'ye akıllı fallback. *(EN + AR tarayıcıda doğrulandı.)*
- [ ] **Aşama 6b — Cila + mağaza hazırlığı:** app id `dist`→`SmartXtream`, gerçek ikon, Lottie, ayarlar genişletme, Seller Office materyalleri
- [ ] **Aşama 7 — Yayın:** Samsung Seller Office sertifikasyon
