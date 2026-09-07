# Lumexia — oyun kalitesi ve doğrulama raporu

**Tarih:** 7 Eylül 2026  
**Kapsam:** Lumexia_Dev_Game, yerel ve ücretsiz antrenman sürümü.

## Güncel çalışma modu

Bu depo `DEV_MODE=true` ile çalışır. Cüzdan, kredi satın alma, sunucu sıralaması ve ödül işlemleri mevcut geliştirme adaptörlerinde taklit edilmiştir. Yarış akışı bu servisleri çağırmaz; sonuçlar yalnız tarayıcıdaki yerel rekorlara yazılır. Antrenman için ortam değişkeni veya cüzdan gerekmez.

Eski entegrasyon ve sprint belgelerindeki üretim açıklamaları tarihsel kayıtlardır. Bu değişiklik canlı hizmetleri doğrulamaz veya etkinleştirmez. Üretim hizmetlerinin açılması ayrı bir entegrasyon ve kabul çalışması gerektirir; yalnız `DEV_MODE` değerini değiştirmek yeterli değildir.

## Oynanış ve sunum değişiklikleri

- Sürüş, 120 Hz sabit adımlı simülasyonla ilerler. Yumuşak direksiyon, hız geçişleri, nitro, çarpışma ve güçlendirme süreleri aynı oyun saatini kullanır.
- Trafik üretimi kaçış boşluklarını değerlendirir; şerit değişimi önceden sinyal verir. Hızlı geçişlerde çarpışma denetimi hareket yolunu tarar. Yakın geçiş ödülü aynı araçtan bir kez alınır.
- Duraklatma ve sekmenin arka plana alınması simülasyonu dondurur. Klavye ve çoklu dokunma girişleri odak kaybında bırakılır.
- Garaj, yarış göstergeleri, duraklatma penceresi ve sonuç ekranı yenilendi. Classic Run ve Double or Nothing, mod başına yerel rekor tutar; ikinci mod seviye 5'e ulaşınca son skoru ikiye katlar, aksi halde sonuç sıfırdır.
- Yol, sis, gökyüzü, bitki örtüsü, araç ışıkları, hız hissine tepki veren kamera ve sesler birlikte düzenlendi. Sık tekrarlanan çevre nesnelerinde ortak geometri ve instancing kullanılır.
- Oyuncu modeli hazır olmadan yarış zamanı başlamaz. Trafik modelleri yüklenirken görünür yedek araçlar vardır. Garaj ve yarış yükleme hatalarında geri dönüş sunar.
- Otomatik, Performance ve High grafik seçenekleri bulunur. Otomatik mod gerektiğinde çözünürlük ve sahne maliyetini düşürür. Yansımalar yerel ışıklarla üretilir; HDR veya Draco decoder için üçüncü taraf CDN gerekmez.

Hız göstergesi mevcut arcade hız ölçeğini `PACE` olarak adlandırır; fiziksel km/sa ölçümü olarak sunulmaz.

## Kod düzeni

| Dosya | Sorumluluk |
|---|---|
| `src/App.jsx` | Garaj, yarış ve sonuç akışı; Canvas; ses ve yükleme hata sınırı |
| `src/components/RaceScene.jsx` | 3D sahne, araçlar, kamera, ışık ve çevre |
| `src/components/RaceHUD.jsx` | Ayrı durum seçicileriyle yarış göstergeleri ve duraklatma |
| `src/components/RaceControls.jsx` | Klavye, pointer ve çoklu dokunma girişi |
| `src/components/RealLauncherUI.jsx` | Garaj, mod ve grafik seçimi |
| `src/components/GameOverUI.jsx` | Sonuç, tekrar oynama ve yerel rekor |
| `src/store.js` | Oyun oturumu, eylemler ve ses tercihleri |
| `src/utils/gameplay.js` | Saf simülasyon, trafik, çarpışma ve puan kuralları |

## Ek çevre çalışması — 7 Eylül 2026

Yol kenarı, `RoadsideWorld` ile **18 özgün 3D prototipe** geçti: beş bina; meşe, kavak, çam ve çalı için ikişer çeşit; sokak lambası; çit, bank, elektrik dolabı ve ot kümesi. Statik parçalar malzemeye göre birleştirilir, yerleşimde instancing kullanılır. Bina/zemin yüzeyleri koddan üretilir; iki fotoğraf gerçekçiliğindeki yerel PNG doku toplam **5.683.600 bayttır**. Yaprak dokusunda gerçek alfa bulunur. Eski yol kenarı GLTF dosyaları bu çevre bileşeninde kullanılmaz.

Güncel yerel lint/build geçti; 33 test geçti, 17 mock-modu üretim testi atlandı. Stüdyoda 18 model/68.152 prototip üçgeni ve sonlu koordinatlar doğrulandı; 390 × 844 mobil tarayıcı görünümünde yeni çevre kontrol edildi. Bunlar yeni bir GitHub Actions/CI sonucu değildir. Envanter ve sınırlar [ROADSIDE_ASSETS.md](ROADSIDE_ASSETS.md), tam doku istemleri ve dosya özetleri [üretim kaydında](../public/textures/roadside/README.md) bulunur. Aşağıdaki önceki doğrulama ve oyuncu modeli ölçümleri değiştirilmedi. Gerçek telefon FPS, uzun sürüş/ısınma ve bark tekrar dikişi kabulü tamamlanmış sayılmaz.

## Oyuncu modelinin maliyeti

Kaynak `public/models/sport_car.glb` korundu. Garaj ve yarış `public/models/sport_car_compact.glb` kullanır; decoder dosyaları `public/draco/` içinden sunulur. Ara optimize dosya araç çalışma klasöründe tutulur ve `public/` içinde dağıtılmaz.

| Ölçüm | Kaynak | Oyunda kullanılan compact |
|---|---:|---:|
| Dosya boyutu | 18.320.948 bayt | 12.753.108 bayt |
| Üçgen / primitive | 237.482 / 11 | 237.482 / 11 |
| Malzeme | 11 | 9 |
| Gömülü PNG dokuları | 7 × 2048² + 2 × 1024² | 9 × 1024² |
| Tahmini doku belleği | 160 MiB | 48 MiB |

Dosya boyutu **%30,39**, RGBA8 ve tam mip zinciri varsayımına dayalı doku belleği tahmini **%70** azaldı. Bunlar dosya ve model ölçümleridir; gerçek GPU belleği, açılış süresi veya FPS kazanımı ölçülmüş değildir. Kaynak model korunacağı için paket toplam boyutu ile yarışta indirilen model boyutu aynı ölçüm değildir.

Geometri sadeleştirilmedi. Compact model yerel decoder ile çözülerek tüm üçgen köşeleri karşılaştırıldı: en büyük konum farkı **0,000349641 model birimi**, UV farkı **0,000030518**. Normal değerleri kaynakla, PNG baytları yeniden boyutlandırılmış ara kopyayla birebir aynı. Model biriminin fiziksel metre olduğu varsayılmadı.

Kaynakta Khronos doğrulayıcısının bildirdiği 631 birim-normal hatası vardır. Ara kopya bu mevcut hataları korur; compact çözümünde vertex birleştirmeden sonra 589 normal hatası raporlanır. Sıfır alanlı 55 yüz kaynakta da vardır; sıfırdan farklı alanlı yeni bir yüz çökmedi. Bu çalışma modelin hatasız olduğunu iddia etmez.

### Modeli yeniden üretme

Komutlar depo kökünden çalıştırılır. Araçlar komşu `model-tools` klasörüne sabit sürümle kurulur; oyun bağımlılıkları değiştirilmez. [glTF Transform CLI](https://gltf-transform.dev/cli)

```powershell
npm install --prefix ../model-tools --save-exact @gltf-transform/cli@4.5.0
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js resize public/models/sport_car.glb ../model-tools/sport_car_resized.glb --width 1024 --height 1024 --filter lanczos3
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js dedup ../model-tools/sport_car_resized.glb ../model-tools/sport_car_dedup.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js prune ../model-tools/sport_car_dedup.glb ../model-tools/sport_car_optimized.glb --keep-attributes true --keep-indices true --keep-leaves true --keep-solid-textures true
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js draco ../model-tools/sport_car_optimized.glb public/models/sport_car_compact.glb --method sequential --encode-speed 5 --decode-speed 5 --quantize-position 16 --quantize-normal 0 --quantize-texcoord 14 --quantize-color 10 --quantize-generic 16
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js copy public/models/sport_car_compact.glb ../model-tools/sport_car_compact_decoded.glb
node ../model-tools/node_modules/@gltf-transform/cli/bin/cli.js validate ../model-tools/sport_car_compact_decoded.glb
```

Sequential kodlama üçgen sayısını korur; normal nicemlemesi kapalıdır. Son doğrulama komutu yukarıdaki mevcut kaynak kusurlarını raporladığı için başarısız çıkış kodu verebilir. Sayısal karşılaştırma ile kaynak kusurlarını yeni regresyonlardan ayırmak gerekir.

Mevcut varlık atıfları README içinde korundu. Optimizasyon modelin lisansını değiştirmez. Yerel Draco decoder ile Apache 2.0 bildirimi [public/draco/LICENSE](../public/draco/LICENSE) birlikte bulunur.

## Doğrulama kaydı

7 Eylül 2026 yerel geliştirme doğrulamasında **33 test geçti, 17 test atlandı**. Atlanan testler, mevcut mock adaptörlerle uyumlu olmayan üretim cüzdan/fiyat davranışlarını sınar; üretim entegrasyonlarının geçtiği anlamına gelmez. Yeni testler sabit adım, duraklatma, çarpışma, trafik yerleşimi, puan ve geliştirme adaptörü sözleşmelerini kapsar.

Windows'taki kısıtlı çalışma ortamında Vite'ın varsayılan yapılandırma yükleyicisi alt süreç kısıtına takıldı. Üretim paketi `--configLoader native` ile başarıyla oluşturuldu; testler `--configLoader runner` ile çalıştırıldı. Bu ortamda Node 24 kullanıldı.

Normal geliştirme komutları:

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Kurulum betikleri veya yapılandırma alt süreçleri kısıtlı bir ortamda kullanılan alternatifler:

```bash
npm ci --ignore-scripts
npm test -- --configLoader runner
npm run build -- --configLoader native
```

Bu seçenekler normal kurulumun yerine zorunlu tutulmaz. CI yapılandırmasında test ve build işleri vardır; mevcut lint işi `continue-on-error: true` ile çalışır. Yerel sonuçlar canlı dağıtım veya GitHub Actions sonucu olarak sunulmaz.

## Kalan kabul çalışması

- Windows entegre GPU, orta sınıf Android ve iPhone Safari'de 15 dakikalık sürüş; kare süreleri, ısınma, ses ve aynı anda yön + nitro.
- 30/60/120 Hz ekranlar, ekran döndürme, sekme değiştirme ve duraklatma sonrası girişlerin karşılaştırılması.
- Boş önbellek ve yavaş bağlantıda ilk oynanabilir kare; başarısız varlık yükleme ve art arda 20 yeniden başlatmada kaynak kullanımı.
- Yakın kamera ve mobil çözünürlükte optimize modelin görsel kabulü.
- Üretim cüzdan, ödeme, sıralama ve ödül servisleri etkinleştirilmeden önce ayrı bir test ortamında uçtan uca doğrulama.

Bu cihaz oturumları tamamlanmış veya belirli bir FPS garanti edilmiş değildir.

