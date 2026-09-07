# Lumexia — render performansı incelemesi

**Tarih:** 7 Eylül 2026  
**Kapsam:** Yerel Windows tarayıcısında kontrollü önce/sonra render karşılaştırması. Oyun ücretsiz antrenman modundadır.

## Değişiklik ve ölçüm durumu

Yol kenarında görünmez örneklerin çizime gönderilmesi kaldırıldı; GPU matris aktarımı görünür önekle sınırlandırıldı. Kamera/görünürlük sırası ve derinlik aralığı düzenlendi. Yarış araçları ile çam geometrisi sadeleştirildi, çevrenin dinamik gölge çizimi kapatıldı. Auto yalnız çözünürlüğü değiştirir; sis ve ana çevre yerleşimi yarış sırasında sabittir. Dokular/shader programları geri sayımdan önce hazırlanır; duraklatma ve sekme görünürlüğü sürekli render döngüsünü durdurur.

Yerel lint/build geçti; **40 test geçti, 17 üretim entegrasyon testi mock modunda atlandı**. Aynı görünür tarayıcı sekmesinde High/DPR 1 karşılaştırmasında ortalama kare süresi **41,95 → 27,43 ms (%34,61 azalma)**, p95 **51,9 → 30,9 ms (%40,46 azalma)** oldu. Bu koşuda belirgin iyileşme var; **60 FPS'e ulaşılmadı**. Gerçek telefon performansı veya yeni bir CI başarısı iddia edilmez.

## Yöntem

| Koşul | Değer |
|---|---|
| Önceki kaynak | `ce213ddb74c93f07fd6a5270e39cc26681e4fa4f` aşamasında dondurulmuş `src/` kopyası |
| Kaynak seçimi | Önce: komşu `../performance-baseline/src`; sonra: mevcut `src` |
| Araç | Aynı [benchmark sahnesi](../tools/performance-benchmark.jsx), Vite üretim paketi |
| Görüntü alanı / DPR | 1280 × 720 CSS piksel / 1 |
| Donanım ortamı | Windows, Intel UHD Graphics, ANGLE; tam renderer kimliği her sonuç JSON'unda |
| Kalite | Kaydedilen nihai çift `high`; sabit DPR 1, Auto çözünürlük uyarlaması kapalı |
| Süre | 8 saniye hazırlık, ardından 24 saniye örnekleme |
| İçerik | 8 trafik aracı, 8 coin, yarış HUD'si ve çevre |
| Hareket | Tekrarlanabilir zaman tabanlı mesafe, trafik ve direksiyon; sabit 220 arcade hız değeri |
| Fizik | `updateGame` devre dışı; çarpışma/puan simülasyonu yerine doğrudan belirlenmiş sahne durumu |
| Sunucu | Yerel HTTP; `Cache-Control: no-store`; model/dokular mevcut `public/` dizininden |

Kare süreleri `performance.now()` ile ardışık render döngüleri arasında ölçülür. Bu, CPU/GPU/zamanlama etkilerini birlikte içeren duvar saati aralığıdır; GPU timer query ölçümü değildir. Ortalama, medyan, p95/p99 ve 25/50 ms üzerindeki kare sayıları kaydedilir. Uzun görev sayısı ve en uzun görev, tarayıcı `PerformanceObserver` desteği varsa toplanır.

`gl.info.render` sayaçları örnekleme karelerindeki ortalama üçgen ve çizim sayısını verir. Bunlar ana render geçişinin sayaçları olarak değerlendirilmelidir; gölge ve diğer geçişlerin tamamını kapsamayabilir. `geometryCount`/`textureCount` nesne sayılarıdır; GPU bayt ölçümü değildir. Tam prototip envanteri veya model üçgen sayısı ile ekrandaki toplam yük aynı ölçüm değildir.

Benchmark fizik maliyetini, normal oturumların yükleme akışını, ilk trafik doğumunu, ağ gecikmesini veya 15 dakikalık ısınmayı ölçmez. Geri sayım öncesi hazırlık ve arka plan render durdurma ayrıca normal oyun akışında doğrulanmalıdır. Normal oyunun Auto modu DPR'yi gerektiğinde 0,65'e kadar düşürebilir; buradaki sabit High/DPR 1 ölçümü bu uyarlamayı içermez. Gerçek Android/iPhone kabulü tamamlanmış sayılmaz.

## Yeniden çalıştırma

Node 24 ve oyunun kurulu bağımlılıkları kullanıldı. Komutlar depo kökünden çalıştırılır. Önceki `src/` ağacını yukarıdaki committen ayrı `../performance-baseline/src` dizinine çıkarın; mevcut kaynak ağacının üstüne yazmayın. Bu yerel kopya benchmark girdisidir, dağıtım varlığı değildir. Her iki paketin kullandığı eski/yeni model dosyaları `public/` altında bulunmalıdır.

PowerShell'de iki paketi oluşturun:

```powershell
$env:LUMEXIA_BASELINE = '1'
try {
  npm exec -- vite build --config tools/performance-benchmark.config.js --configLoader native
} finally {
  Remove-Item Env:LUMEXIA_BASELINE -ErrorAction SilentlyContinue
}
npm exec -- vite build --config tools/performance-benchmark.config.js --configLoader native
```

Yapılandırma önceki paketi `../performance-before`, sonraki paketi `../performance-after` dizinine yazar. `--configLoader native`, bu kısıtlı Windows ortamında kullanılan seçenektir. Ayrı terminallerde sunucuları başlatın:

```bash
node tools/performance-server.cjs before
```

```bash
node tools/performance-server.cjs after
```

| Çift | Önce | Sonra |
|---|---|---|
| High | [5176 / high / DPR 1](http://127.0.0.1:5176/?quality=high&dpr=1) | [5177 / high / DPR 1](http://127.0.0.1:5177/?quality=high&dpr=1) |
| Performance | [5176 / performance / DPR 1](http://127.0.0.1:5176/?quality=performance&dpr=1) | [5177 / performance / DPR 1](http://127.0.0.1:5177/?quality=performance&dpr=1) |

Tarayıcının içerik alanını 1280 × 720 yapın; sonuç JSON'undaki `viewport` ve `dpr` değerleriyle doğrulayın. Her koşuyu görünür sekmede, aynı güç ayarı ve diğer ağır işler kapalıyken çalıştırın. **Start** düğmesine basın; yaklaşık 32 saniye sonra sonuç oluşur ve o Canvas talep üzerine çizime geçer. **Reload** ile yeni koşu başlatılır. Karşılaştırma sırasında aynı anda başka bir hareketli benchmark/oyun Canvas'ı çalıştırmayın.

Tam sonuç, sayfadaki `#metrics` elemanının `data-result` alanına JSON olarak yazılır. Tarayıcı geliştirici konsolundan okunabilir:

```js
JSON.parse(document.querySelector('#metrics').dataset.result)
```

Sonuçlarla birlikte tam renderer kimliği, kalite, viewport, DPR, örneklenen kare sayısı ve kullanılan kaynak sürümünü saklayın. Aynı çiftin tekrarlarını ayrı kayıtlar olarak koruyun; yalnız en hızlı koşuyu seçmeyin. Hazırlık süresi büyük ilk-yükleme etkilerini dışlar, sürücü veya işletim sistemi kaynaklı değişkenliği ortadan kaldırmaz.

Benchmark dışında normal uygulamada yükleme, geri sayım, yarış, çarpışma/sonuç ve tekrar akışı kontrol edildi. İlk hazırlıkta `P` ile duraklatma saati 00:00'da tuttu; devam sonrası geri sayım 3'ten başladı. Yakın bina/meşe görüntüsü kontrolünde sayfa JavaScript hatası görülmedi. Bu kısa kontrol, uzun sürüş veya arka plan GPU tüketimi ölçümü değildir.

## Nihai ölçüm kaydı

Her iki son koşu aynı görünür Codex uygulama içi tarayıcı sekmesinde, 1280 × 720/DPR 1/High olarak çalıştırıldı. Renderer: **ANGLE, Intel UHD Graphics (0xA78B), D3D11**. Sekme görünürlüğü eşleşmeyen önceki denemeler bu karşılaştırmaya alınmadı. Aşağıdaki değerler tek eşleşmiş koşu çiftidir; tekrarlar arasında güven aralığı hesaplanmadı.

| Ölçüm | High önce | High sonra | Değişim |
|---|---:|---:|---:|
| Örneklenen kare | 572 | 875 | Aynı 24 saniyelik aralık |
| Ortalama kare süresi (ms) | 41,9484 | 27,4314 | −%34,61 |
| Medyan (ms) | 41,3 | 27,3 | |
| p95 (ms) | 51,9 | 30,9 | −%40,46 |
| p99 (ms) | 66,0 | 36,1 | |
| 50 ms üzeri kare | 35 | 0 | |
| Ortalama ana geçiş üçgeni | 1.878.484 | 1.204.266 | −%35,89 |
| Ortalama ana geçiş çizimi | 280 | 213 | −%23,93 |

`1000 / ortalama kare süresi` karşılığı yaklaşık **23,8 → 36,5 FPS**'tir; bu son koşu 16,67 ms/60 FPS bütçesine ulaşmaz. Sonraki koşuda 774 kare 25 ms'yi aştı; uzun görev gözlemcisi 0 olay kaydetti. 196 geometri ve 53 doku nesnesi raporlandı; bunlar bellek baytı veya önce/sonra bellek kazanımı değildir. Kaydedilen sayısal alanlar [performance-results.json](performance-results.json) içindedir. Nihai Performance kalite çifti bu kayda dahil edilmedi.

Model maliyetleri ve kayıplı sadeleştirme sınırları [RUNTIME_MODELS.md](../public/models/RUNTIME_MODELS.md), çevre envanteri [ROADSIDE_ASSETS.md](ROADSIDE_ASSETS.md), genel kabul kapsamı [QUALITY_REVIEW.md](QUALITY_REVIEW.md) içindedir.
