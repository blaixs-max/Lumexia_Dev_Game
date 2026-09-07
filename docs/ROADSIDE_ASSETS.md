# Lumexia — özgün yol kenarı varlıkları

**Tarih:** 7 Eylül 2026  
**Kapsam:** Yerel antrenman oyununun çevresi ve ayrı varlık inceleme stüdyosu.

## İçerik ve kaynak

Yeni koleksiyonda **18 özgün 3D prototip** bulunur: 5 bina, dört bitki türünün ikişer çeşidi, 1 sokak lambası ve 4 sokak detayı. Geometri Three.js ile bu çalışma için koddan üretildi. Bina ve zemin yüzeyleri deterministik CanvasTexture üretimi kullanır; bitki örtüsünün iki fotoğraf gerçekçiliğindeki dokusu yerleşik `image_gen.imagegen` aracıyla üretildi.

`RaceScene`, yol kenarı için artık `RoadsideWorld` bileşenini kullanır. Bu çevre akışı önceki bina, ağaç ve çiftlik GLTF dosyalarını yüklemez. Önceki dosyaların depoda bulunması veya atıflarının korunması, yeni çevrenin onları kullandığı anlamına gelmez. Oyuncu ve trafik araçları bu varlık çalışmasının dışında kalır; oyuncu modelinin önceki ölçümleri değişmedi.

| Grup / prototip | Adet | Bir prototipte üçgen | Malzeme çizimi |
|---|---:|---:|---:|
| `townhouse` — sıvalı, tuğla kaideli iki katlı ev | 1 | 1.636 | 11 |
| `villa` — teraslı modern konut | 1 | 1.498 | 10 |
| `apartment` — balkonlu altı katlı apartman | 1 | 10.222 | 11 |
| `office` — on katlı cam cepheli ofis | 1 | 6.084 | 8 |
| `warehouse` — tuğla atölye ve yükleme kapıları | 1 | 1.830 | 11 |
| `oak`, `oak2` — geniş taçlı meşe | 2 | 2.326 | 2 |
| `poplar`, `poplar2` — dar taçlı kavak | 2 | 2.374 | 2 |
| `pine`, `pine2` — iğne yaprak geometrili çam | 2 | 17.584 | 2 |
| `shrubs`, `shrubs2` — alçak çalı grubu | 2 | 208 | 2 |
| `streetlamp` — galvanizli LED sokak lambası | 1 | 812 | 3 |
| `fence` — 3 m genişliğinde, 0,9 m yüksekliğinde çit | 1 | 324 | 2 |
| `bench` — 1,8 m ahşap çıtalı park bankı | 1 | 336 | 2 |
| `utilityBox` — yaklaşık 1 m elektrik dolabı | 1 | 276 | 3 |
| `grasses` — 30 eğri yapraklı ot kümesi | 1 | 150 | 1 |

Sayılar mevcut deterministik kaynak üretiminin ölçümleridir. Yeni bir seed veya model değişikliği sayıları değiştirebilir. “Malzeme çizimi” bir prototipin malzemeye göre birleştirilmiş mesh sayısıdır; bütün yarış sahnesinin toplam draw call sayısı değildir. Gölge geçişleri, örnek sayısı ve yaprakların kapladığı ekran alanı ayrıca maliyet oluşturur.

## Geometri ve malzeme tasarımı

Binalar metre ölçeğinde ve tabanları `y=0` olacak şekilde üretildi; ön cephe yerel `+Z`, genişlik `X` eksenindedir. Pencere çerçeveleri ve denizlikler, kiremit/arduvaz çatı, baca, yağmur oluğu, balkon korkuluğu, çatı harpuştası ve HVAC parçaları cephelerin düz kutu gibi görünmesini azaltır. Camlar koyu, gökyüzü yansımalı ve perdeli tonlar arasında değişir; pencereler tek tip parlak ışık kaynağı değildir.

Tuğla, sıva, beton ve çatı malzemelerinin renk, bump ve roughness dokuları kod içinde üretilir. Dünya ölçeğine göre UV izdüşümü, büyük bir duvarda tuğlaların devleşmesini önler. Malzemeler prototipler arasında paylaşılır ve statik geometri `mergeGeometries` ile malzemeye göre birleştirilir.

Doğa koleksiyonu dallanmış gövdeler, yaprak kartları, farklı taç siluetleri ve çam iğneleri kullanır. Yapraklarda alfa testi bulunur; ağacın çevresinde opak kare bir arka plan çizilmez. Otlar, dokusuz ve çift taraflı eğri geometrilerden oluşur; koyu zeytin ile saman rengi arasındaki tonlar vertex renkleriyle verilir.

Sokak detayları ek doku indirmez. Bankta ayrı oturma/sırt çıtaları ve metal ayaklar; dolapta kapı, menteşe, havalandırma ve beton kaide; çitte ince parmaklıklar ve bağlantı kulakları vardır.

## Dosyalar ve çalışma sözleşmesi

| Kaynak | Sorumluluk |
|---|---|
| [`src/environment/architecture.js`](../src/environment/architecture.js) | Beş bina; `buildArchitectureAssets()` |
| [`src/environment/nature.js`](../src/environment/nature.js) | Sekiz bitki çeşidi ve lamba; `buildNatureAssets({ leafTexture, barkTexture })` |
| [`src/environment/street-details.js`](../src/environment/street-details.js) | Dört sokak detayı; `buildStreetDetailsAssets()` |
| [`src/environment/landscape.js`](../src/environment/landscape.js) | Zemin, kaldırım, yumuşak temas gölgesi, bariyer profili ve yerleşim |
| [`src/components/RoadsideWorld.jsx`](../src/components/RoadsideWorld.jsx) | Yerel doku yükleme, instancing, mesafeye göre görünürlük ve kaynak temizliği |
| [`tools/asset-studio.html`](../tools/asset-studio.html) | Prototiplerin ayrı 3D incelemesi ve anlık render göstergeleri |
| [`tools/asset-studio-server.cjs`](../tools/asset-studio-server.cjs) | Stüdyonun yerel HTTP sunucusu |

Fabrikalar her model için `THREE.Group` döndürür. Boyut, üçgen ve çizim sayıları `group.userData` içinde bulunur. Mimari ve sokak detayı fabrikalarının dönüşünde ayrıca numaralandırılmayan, tekrar çağrılması güvenli `dispose()` vardır. Paylaşılan kaynaklar ancak bütün örnekler kaldırıldıktan sonra temizlenmelidir. `RoadsideWorld` geometri, malzeme ve dokuları tekil kümelerle temizler.

Yerleşimler seed tabanlıdır; render sırasında rastgele bir dünya yeniden oluşturulmaz. Aynı geometri/malzeme çok sayıda nesnede instancing ile paylaşılır. Performance ayarı yerleşim yoğunluğunu ve görünür mesafeyi azaltır. Bu düzenleme ölçülmüş telefon FPS artışı olarak sunulmaz.

## İki üretilmiş doku

| Dosya | Gerçek boyut | Bayt | Alfa |
|---|---|---:|---|
| [`oak-leaves.png`](../public/textures/roadside/oak-leaves.png) | 1.254 × 1.254 | 2.082.296 | Gerçek şeffaflık; 751.910 piksel tamamen şeffaf |
| [`bark.png`](../public/textures/roadside/bark.png) | 1.254 × 1.254 | 3.601.304 | Opak |
| **Toplam** | **2 PNG** | **5.683.600** | |

PNG'ler araç çıktısından piksel düzenlemesi veya yeniden boyutlandırma uygulanmadan kopyalandı. İstemlerde 1024 × 1024 kompozisyon talep edilmesine rağmen gerçek çıktı boyutu yukarıdaki gibidir. Kullanılan aracın adı, tam istemler, dosya özetleri ve görsel kabul sınırları [doku üretim kaydında](../public/textures/roadside/README.md) bulunur. Özel makine dosya yolları bu kayda dahil edilmedi.

## Yerel inceleme

Depo kökünden oyunu başlatın:

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Oyun: [127.0.0.1:5173](http://127.0.0.1:5173/). Kısıtlı Windows ortamı için aynı komuta `--configLoader native` eklenebilir.

İkinci terminalde varlık stüdyosu:

```bash
node tools/asset-studio-server.cjs
```

Stüdyo: [127.0.0.1:5174](http://127.0.0.1:5174/). Açılır listeden tek bir varlık seçilebilir; sürükleme kamerayı döndürür, tekerlek yaklaştırır. Otomatik döndürme ve kamera sıfırlama düğmeleri bulunur. Stüdyonun FPS göstergesi yalnız o stüdyo oturumunu ölçer; oyunun veya gerçek telefonun performans ölçümü yerine geçmez.

Oyunda `A/D` ya da sol/sağ okları basılı tutarak direksiyon, `Space` ile nitro, `Esc/P` ile duraklatma ve `M` ile ses kontrolü yapılır. Küçük ekranlarda yön ve nitro düğmeleri kullanılır.

## Doğrulama sınırları

- Mimari ve sokak detayı modüllerinde hedefli ESLint ve fabrika/geometri kontrolleri geçti. Sonlu koordinatlar, prototip ölçüleri ve üçgen/mesh sayıları kontrol edildi; doğa envanteri de fabrikadan ölçüldü.
- Güncel yerel lint ve üretim build kontrolleri geçti; 33 test geçti, mock modundaki 17 üretim testi atlandı. Varlık stüdyosu DOM kaydında 18 model, sonlu koordinatlar ve toplam 68.152 prototip üçgeni doğrulandı. 390 × 844 mobil tarayıcı görünümünde yeni çevre görüntülendi. Bu kayıt yerel doğrulamadır; yeni bir GitHub Actions/CI başarısı veya gerçek telefon testi değildir.
- Stüdyonun ana sayfası ve varlık yolları HTTP 200, bilinmeyen yol 404 ve yol aşımı denemesi 403 ile doğrulandı. Model görselleri stüdyoda ve bütünleşik yarışta incelendi.
- Kabuk dokusu tekrar edilebilir bir yüzey olarak istendi; karşılıklı kenarların matematiksel olarak aynı olduğu doğrulanmadı. Sahnedeki tekrar dikişi ve uzaktan yaprak kenarları görsel kabul konusudur.
- Gerçek Android/iPhone üzerinde uzun sürüş, ısınma, kare süreleri ve FPS henüz ölçülmedi. Özellikle çam iğnelerinin geometri maliyeti ve şeffaf yaprakların ekran alanı cihazda değerlendirilmelidir.
- Bu varlık çalışması ücretsiz yerel antrenman kapsamındadır. Üretim cüzdanı, sıralama, ödeme veya canlı dağıtım sonucu içermez.
