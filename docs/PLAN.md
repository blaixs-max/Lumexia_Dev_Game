# Lumexia Racing Game - Gelistirme Plani

> Son güncelleme: 2026-10-18

## Yayın akışı — 18 Ekim

Modele uygun çarpışma alanları ve NPC sürüşü/gölgeleri aynı yayın paketindedir. Kullanıcı canlı yayını onayladı; hedef mevcut GitHub deposunun `main` dalı ve Vercel'deki `lumexia-dev-game` üretim projesidir. Yerel 130 test, lint ve derleme kabulüne ek olarak GitHub test/lint/derleme kontrolleri ve Vercel'de hedef commit'in READY durumu doğrulanır. Aşağıdaki yerel kabul kayıtları uygulama aşamalarının tarihsel kapsamını korur.

## Güncel çalışma — 18 Ekim NPC sürüşü ve sürekli gölgeler

NPC hareketi yolun kullandığı dünya ölçeğiyle eşleştirildi: HUD hızının dünya karşılığı 0,5 kattır. Eski hareket farkı oyuncu 110, NPC 55 hızındayken NPC'yi çevreye göre sabit gösteriyordu; yeni hareketle NPC aynı çevrede saniyede 27,5 dünya birimi ilerler. İstenen seyir hızı ile takip sırasında uygulanan hız ayrıdır. Öndeki araç ve geçiş koridoru için yavaşlama, hızlanma ve asgari gövde ayrımı uygulanır.

Şerit kararları sırayla alınır; planlama, sinyal ve geçiş boyunca çıkış/hedef şeritleri birlikte rezerve edilir. Rastgele bitişik şerit seçimi, yaklaşan oyuncuya tepki payı, öndeki/arkadaki trafik ve geçiş yolu kontrolünden geçer. Bazı sürücüler şeridini korur; tekrarlayan manevra fırsatları iki sabit trafik akışında kilitlenmeyi engeller. Sinyalin yaklaşımda başlaması sayesinde normal hızdaki geçişler görünür 70–160 dünya birimi alanında tamamlanır. Trafik oluşumu da aynı kuralları kullanır. Çarpışma ve yakın geçişte eski/yeni araçlar dizi sırasına göre değil kalıcı araç kimliğine göre eşleştirilir; önceki modele uygun çarpışma düzeltmesi korunur.

Dar oyuncu gölge hacmi yerine aynı güneşin kademeli gölgeleri kullanılır: Performance 2×1024, High 3×1536; kapsam 320/360 dünya birimidir. Gerçek araç geometrisi güneş/ay yönünü izler. Yakın kademe geçişleri en az 8 dünya biriminde karışır; uzak uçta kademeli sönüm vardır. Oyuncu yaklaşırken oluşan ani gölge sınırı kaldırılır. Kaynak model malzemeleri ve ortak shader kodları yarış kapanırken geri yüklenir; yeni NPC lambası eklenmez.

Ayrı QA sayfası aynı üretim trafik güncellemesini 120 Hz çalıştırır. Canlı seviye trafiği, takip/frenleme, tek şerit değişimi ve uzak gölge yaklaşımı senaryoları vardır; duraklatma, 0,1/1 saniye ilerletme ve sabit rastgele başlangıç desteğiyle gözlenebilir. Oyuncu kazası, ödül ve kalıcı yazma bu sayfada kapalıdır. Bu çalışma yereldir; GitHub/Vercel yayını yapılmadı.

Son kabul: **130 test başarılı, 17 üretim adaptörü testi atlandı**; lint, üretim derlemesi (654 modül) ve QA derlemesi başarılı. 72 simülasyon dakikasında NPC gövde çakışması veya geçiş koridoru kapanması görülmedi; her profil tekrarlayan geçişler içerir. Seviye 1/3/5/8 ortalama yaklaşan trafik 2,46/4,26/7,18/8,62; seviye 5 yaklaşık 2,9 kat yoğunluk verir. Bu yoğunluk örneği z > −20 araçlarını çıkarır ve pickup içermez; gerçek FPS değildir. High gündüz canlı düzeneği 20,18 saniyede 8 tamamlanmış geçiş ve sıfır NPC teması; Performance gece 33,37 saniyede 14 geçiş ve sıfır temas verdi. Uzak/yakın gölge, takip ve normal ana uygulamada Subaru ile sürüş → garaj dönüşü doğrulandı. Kaynak malzemeler ve garaj görünümü korundu. Görsel: [8. seviye trafik](../artifacts/npc-live-level8.png). Fiziksel telefon gölge maliyeti ayrı kabul kalır.

## Güncel düzeltme — 17 Ekim görünmeyen çarpışma

Boş yolda çarpışma bildirimi üzerine görsel model ile fizik sınırı karşılaştırıldı. Modellerin üst sınıra orantılı sığdırılması, o sınırın tamamını kapladıkları anlamına gelmiyordu; eski fizik daha büyük kutuyu ve 0,2 birim dış payı kullanıyordu. Apex ile kamyon arasında 2,489275 birim, oyuncu ile yandaki SUV arasında 0,422766 birim görünür boşluk varken eski çarpışma yeniden üretildi. Arkadaki kamyon da aynı yanlış teması üretebiliyordu. Son kullanıcı oturumunun kaydı olmadığından geçmiş olayın kesin nesnesi belirlenemedi.

Çizim boyutlarını koruyan `VEHICLE_RENDER_LIMITS` ile gerçek sığdırılmış model alanlarını ayıran ortak modül kullanılır. Kilitli yarış aracına göre altı oyuncu alanı ve dört trafik alanı vardır; çarpışma, tamamen geçme ve yakın geçiş aynı 0,03 birim iç toleransı kullanır. Süpürülmüş denetim yüksek hızda korunur. Model yolları trafik çizimi ve bağımsız varlık testi için aynı kaynaktan gelir; GLB/glTF sınır/dönüşüm testi model değişiminde eski alanların sessizce kalmasını önler.

QA düzeneğinde **Traffic layout** dört sabit temas/boşluk örneği sunar; eski/yeni sonuç, görünür boşluk miktarı ve açılabilir zemin çizgileri vardır. Ayrı düzenekte fizik ve kalıcı kayıt devre dışıdır. Normal yarış akışına tanılama arayüzü eklenmez. Kabul görseli: [Boşluğun çarpışma sayılmaması](../artifacts/collision-truck-clearance.png). Bu düzeltme yereldir; GitHub/Vercel yayını yapılmadı.

Son kabul: **111 test başarılı, 17 üretim adaptörü testi atlandı**; lint ve üretim derlemesi (649 modül) başarılı. High gündüz dört senaryonun sonucu, Performance gece yan geçişi ve 30/60/144 FPS simülasyonları doğrulandı. Gerçek yarış çiziminde sayfa/shader/WebGL bağlam hatası yoktu. Ödeme, çevrimiçi skor, yerel sahiplik ve ödül formülleri değişmedi.

## GitHub birleştirme — 17 Ekim

Gölge, seviye trafiği ve mıknatıs/roket modelleri birlikte yayımlanır. Yerelde doğrulanan sürüm GitHub test/lint/derleme kontrollerinden sonra `main` dalına birleştirilir; Vercel'in mevcut Git bağlantısı yayını tetikler. Aşağıdaki yerel kabul kayıtları uygulama aşamalarının tarihsel kapsamını korur.

## Güncel yarış revizyonu — 17 Ekim mıknatıs ve roket

Mıknatıs ve roket, ortak para biçimli rozet/koni yerine iki özgün Three.js modeliyle çizilir. Mıknatıs kırmızı/mavi pahlanmış at nalı, gümüş kutup uçları ve vidalardan oluşur. Rokette inci gövde, turuncu burun ve geriye uzanan kanatlar, bakır detaylar, camgöbeği pencere, motor ağzı ve üç boyutlu egzoz bulunur. Yeni dış varlık veya görsel üretimi yoktur; eski harici dosyaların atıfları README'de tarihsel kaynaklar olarak korunur.

Gerçek yarış bileşeninde hafif yön/düşey salınım okunabilir silueti korur; zemin halkası yolda sabittir. Azaltılmış hareket tercihi bu salınımları kapatır. Mevcut aydınlatma kullanılır, ek gerçek ışık eklenmez. Oluşum, çarpışma, toplama ve etki süreleri aynı kalır. Önceki gölge ve trafik düzeltmeleri bu çalışma içinde korunur.

Tamamlanan yerel kabul: **89 test başarılı, 17 üretim adaptörü testi atlandı**; son lint ve üretim derlemesi (648 modül) başarılı. Gerçek yarış QA düzeneğinde High/Performance gündüz/gece kontrollerinin tamamı 2 mıknatıs / 2 roket / 1 jeton gösterdi; shader, sayfa ve WebGL bağlam hatası yoktu. High gündüz/gece 31 shader programıyla kaldı; Performance 512×512 gölge haritası gözlendi. Sonlu konum/normal denetiminde mıknatıs 1.456 üçgen / 6 model çizimi, roket 3.680 üçgen / 9 model çizimidir; gölgeler ve zemin halkaları bu sayılara dahil değildir. Örnek başına önbelleğe alınan kaynaklar kaldırılırken serbest bırakılır.

Düzenekteki **Pickup layout → Magnet + rocket** seçeneği yakın ve uzaktaki iki nesneyi aynı anda gösterir, tür/adet/konum ölçümlerini sunar ve kalıcı bakiye yazmaz. Görseller: [Performance gündüz](../artifacts/powerups-day.png), [High gece](../artifacts/powerups-night.png). Fiziksel telefon görünürlüğü ve uzun sürüş performansı ayrı kabuldür. Bu revizyon yereldir, bu çalışma kapsamında yayın yapılmadı.

## Önceki yerel yarış revizyonu — 17 Ekim gölge ve trafik

Yarıştaki yuvarlak oyuncu/trafik gölge düzlemleri ve boşta alt aydınlatma kaldırıldı. Araç geometrisi, mevcut tek yönlü güneş/ay ışığıyla PCF yumuşak gölge üretir. Oyuncuyu izleyen ortografik gölge hacmi ±8, near/far 1/80; harita Performance'ta 512×512, High'da 1024×1024'tür. Model tabanı −0,025, asfalt −0,03 konumundadır. Gölge araç biçimine, ışık açısına ve oyuncunun şerit konumuna bağlıdır; ek yönlü ışık yoktur.

Trafiğin hedef oluşma aralığı 1–8. seviyelerde **29 / 22 / 17 / 13 / 10,5 / 9 / 8 / 7 HUD metresi** olur; 8. seviyeden sonra sabitlenir. Güvenli yerleşim bulunamazsa 1,5 m sonra yeniden denenir. Normal/nitro/roket hızlarında kaçış şeridi kontrolü, 65 dünya birimi aynı şerit ayrımı, NPC hız sınırları ve 12 araç üst sınırı korunur.

Yerel kabul: **89 test başarılı, 17 üretim adaptörü testi atlandı**; lint ve üretim derlemesi (646 modül) başarılı. Dört başlangıç değeriyle 60 saniyelik simülasyonda seviye 1 / 3 / 5 sırasıyla **23 / 39 / 61–63** oluşum ve yaklaşık **2,0 / 3,6 / 5,5** ortalama yaklaşan araç verdi. Toplanabilir nesneler kapalıdır ve z > −20 bölgesine ulaşan araçlar çarpışmayı önlemek için çıkarılır; bu, gerçek sürüş FPS veya bellek ölçümü değildir. Geç seviye yoğunluk sınırı, güvenli oluşumlar, engel sonrası yeniden deneme ve 30/60/144 FPS eşitliği test edilir.

Gerçek yarış bileşenlerini kullanan tarayıcı QA düzeneğinde Apex Performance gündüz, Apex High gece/gün batımı ve Subaru High gündüz/viraj kontrol edildi. 512/1024 gölge haritaları gözlendi; gölge yönü, uzaması ve şerit takibi incelendi. Shader, sayfa veya WebGL bağlam hatası yoktu. Bu düzenek ana uygulamanın başlangıç akışından ayrıdır. Kalan kabul: fiziksel telefonda gölge maliyeti, uzun sürüş dengesi, FPS ve bellek ölçümü. Revizyon yereldir; bu çalışma kapsamında yayın yapılmadı. Önceki menü/model kabulünün 85 testlik kaydı aşağıda korunur.

## Güncel arayüz akışı — 17 Ekim yarış modu penceresi

Ana menüde **Yarışa başla** ve **Garaj** iki birincil eylemdir. Mod kartları yalnız başlangıç düğmesiyle açılan, ekran ortasındaki yerel HTML `dialog` penceresinde gösterilir. Classic Run / Double or Nothing simgeleri ve kuralları korunur. Kart seçimi geçicidir; pencere içindeki başlangıç onayı seçili modu yarışa gönderir. Geri dön, kapat, Esc ve dışarı tıklama önceki modu koruyarak menüye döner.

Kabul edilenler: masaüstü, 320×700 ve 844×390 yerleşimi; yatay taşma olmadan ortalanma; iptal ve başlangıç düğmesine odak dönüşü; radyo seçeneklerinde yön tuşları, pencere içinde Tab dolaşımı, arka planın pasifleşmesi ve garaja giriş. 320×700 penceresi 286×516,4 px; 844×390 penceresi 660×347,3 px ve iç kaydırmasızdır. Double or Nothing onayı gerçek HUD'de 5. seviye hedefini açtı; menüye dönüşte son onaylanan seçim korundu. Ardından seçilen Classic Run gerçek yarış ve sonuç ekranına ulaştı. 85 test başarılı, 17 üretim adaptörü testi atlandı; son stil ve klavye düzenlemeleri sonrası lint ve üretim derlemesi başarılı. Fiziksel cihaz kabulü ayrı kalır.

Önceki çalışma ve kabul kayıtları aşağıda korunur.

## Güncel odak — araçlar, garaj, ekipman ve HUD

### 17 Ekim revizyonu — gerçekçi araç modelleri

Oyuncak görünümü veren önceki Kenney gövdeleri gerçek otomobil oranlarına ve kaplamalarına sahip Subaru WRX STI (900), BMW M3 E30 (2.400) ve Nissan Z Proto (4.800 altın) modelleriyle değiştirildi. Garaj altı araç sunmaya devam eder. Önceki `rally`, `street`, `formula` kayıt kimlikleri, fiyatlar ve sürüş dengesi korunur; bu kimliklerle alınmış araçlar, takılı ekipman, aktif seçim ve altın sıfırlanmaz. Nissan'ın kayıt kimliği uyumluluk için `formula` kalır; görünen araç bir spor coupé'dir.

Modeller garajda ve yarışta aynı yerel GLB dosyalarını kullanır. Üç model toplam 11.270.428 bayttır; Subaru 42.128, BMW 52.728, Nissan 24.387 üçgendir. CC BY 4.0 lisansları, sabit kaynak sürümü, değişiklikler ve hash kayıtları `public/models/realistic/` içinde tutulur; ana menü ve garajdaki **Model katkıları** bağlantısı görünür atıf sağlar. Ön üç çeyrek garaj açısı, tek karelik 64 px yansıma haritası ve yalnız araca temas gölgesi eklendi. Yerel farlar korunur; motor ve nitro yeni gövdelere göre yerleştirilir. Mevcut ortak çarpışma boyutları korunur.

Kabul: çevrimdışı geometri/kaynak denetimi başarılı; üç model Khronos doğrulamasında sıfır hata ve sıfır uyarı verdi. 85 test başarılı, 17 üretim testi atlandı; lint ve üretim derlemesi başarılı. Tarayıcıda üç önizleme, eski satın alımın korunması ve yeni Subaru satın alma → motor yükseltme → yenileme → gerçek yarış → altın ödülü akışı doğrulandı. 320 px garajda altı kart iki sütunda, uzun adlar sarılır ve yatay taşma yoktur; katkılar sayfasındaki üç kaynak/yazar/lisans kaydı kontrol edildi. Ekran görüntüleri ve sayısal kayıtlar görev dosyasındadır. Gerçek telefon performansı, uzun sürüş dengesi ve her yükseltme seviyesinin görsel kabulü sonraki aşamadır.

### 17 Ekim arayüz revizyonu — anlaşılır metin ve ortak simgeler

Menü, garaj, yarış HUD'si, duraklatma, sonuç ve yükleme ekranları Türkçe kısa metinlerle yenilendi. Classic Run / Double or Nothing adları korunur; ikinci modun 5. seviyede ×2, aksi halde 0 skor kuralı mobilde de görünür. Skor, toplanan jeton ve harcanabilir altın ayrıldı; yanlış +100 GOLD toplama bildirimi +100 PUAN · 1 JETON oldu. Sürüş ve ekonomi kuralları değişmedi.

Ortak kod tabanlı SVG simge seti, okunaklı etiketler, erişilebilir düğme adları ve menüde açılabilir kontrol yardımı eklendi. Garajın seçili/kilitli araç, parça seviyesi, artış ve maliyet bilgileri açıklandı. 320/390 px dar görünüm ve masaüstü incelendi; 320×700 ile 844×390 çerçevelerinde dokunma tanılaması 42/42 geçti. 80 test, lint ve üretim build başarılı. Terimler ve yöntem [UI_GUIDE.md](UI_GUIDE.md) içindedir.

### 17 Ekim görsel düzenleme — yarış modu sembolleri

Classic Run sonsuz otoyol, Double or Nothing çift ok/kırık halka ile temsil edilir. Kullanıcının alternatif araç onayıyla iki şeffaf PNG yerleşik OpenAI görüntü üretim aracıyla üretildi, `public/modes/` içine alındı ve ana menü kartlarına bağlandı. Masaüstünde 56 px, dar ekranda 44 px görseller; yükleme hatasında mevcut metin simgeleri korunur. Masaüstü/dar tarayıcı görünümü ve mod seçimi doğrulandı; lint/build başarılı. Üretim istemleri aynı klasördeki `generation-record.json` içindedir.

### 17 Ekim görsel düzenleme — atölye garajı

Referans oyun garajı düzeni uygulandı: solda sıcak ışıklı endüstriyel 3D atölye ve büyük araç önizlemesi, oklarla araç gezinme, sağda hız/direksiyon/nitro çubukları, altta kompakt ekipman kartları ve ana menüye dönen Done düğmesi. Dar ekranda alanlar dikey sıralanır. Mevcut yerel sahiplik, satın alma, bakiye ve seçili araca yükseltme kuralları korunur; Done yeni bir ödeme yapmaz, satın alma sırasında kaydedilen seçimle menüye döner.

### 17 Ekim ek çalışması — ana menü ve araç sahipliği

Ana menüde Start Game ve Garage girişleri ayrıldı. Garajda döndürülebilir araç önizlemesi, koleksiyon, satın alma/seçim ve seçili araca özel ekipman atölyesi bulunur. Araç incelemek aktif seçimi değiştirmez. Yarışın duraklatma ve sonuç ekranlarından garaja veya ana menüye dönülebilir.

Yeni kayıtta yalnız LX Sport açıktır; LX GT 1.250, LX Apex 3.000 oyun altınıdır. Satın alma aracı bir kez açar ve seçer; seçili, sahip olunan araca yükseltme takılır. Aynı yerel anahtardaki schema 3 kaydı eski seçili/yükseltilmiş araçları ve bakiyeyi korur. Gerçek ödeme ve çevrimiçi kayıt hâlâ kapsam dışıdır.

Kabul: 80 test başarılı, 17 üretim testi atlandı; lint ve üretim derlemesi başarılı. Masaüstü ve dar tarayıcıda menü/garaj incelendi. Ayrı yerel test kaydında GT satın alma 1.500 → 250, Handling yükseltme 250 → 0 altın verdi; yenileme ve yarış HUD'si GT / HND 1 seçimini korudu. Yarıştan ana menüye dönüş ve yetersiz bakiyeyle kilitli araç önizlemesi doğrulandı. Fiziksel telefon ve uzun sürüş dengesi sonraki kabuldür.

### 17 Ekim ek çalışması — ekipman mağazası ve altın

Ekipman artık altınla satın alınır; her satın alma sonraki seviyeyi seçili araca otomatik takar. Yeni/eski v1 kayıtta başlangıç 1.500 altın; mevcut eski seviyeler korunur. Tamamlanan yarışta `25 × coinsCollected + floor(totalDistance / 10)` altın tek sefer eklenir; yarıda bırakmada ödül yoktur. Kayıt cihazdadır, ödeme/DB sonraki aşamadadır.

Üç Higgsfield görseli ekipman kartları içindir; motor, yol tutuşu ve nitronun araç üzerindeki görsel karşılıkları ayrı hafif Three.js parçalarıdır. Garajda anında, yarışta başlangıçta sabitlenen seviyeye göre görünürler. Fiyatlar motor 300/650/1.100, yol tutuşu 250/550/950, nitro 350/750/1.250 altındır.

Aşağıdaki ücretsiz seviye seçimi açıklaması ilk garaj aşamasının tarihsel kaydıdır; mevcut mağaza satın alma düğmelerini kullanır. Kalan kabul: tüm araçlarda montaj konumlarının gerçek cihazda görsel incelemesi ve kazanç/fiyat dengesinin uzun sürüşte değerlendirilmesi.

Ödeme, çevrimiçi skor saklama ve veritabanı entegrasyonu sonraki aşamaya bırakıldı. Aktif kapsam ücretsiz yerel antrenmandır.

- Üç seçilebilir araç: LX Sport (mevcut oyuncu modeli), LX GT (mevcut sedan modeli), LX Apex (mevcut Ferrari modeli). Bunlar yeni dış varlıklar değil, depodaki modellerin oynanabilir araç seçenekleridir.
- Araç başına motor, yol tutuşu ve nitro: Stock / Stage 1–3. Antrenmanda ücretsiz seçilir; para birimi, satın alma veya kilit açma sistemi yoktur.
- Garaj seçimleri sürümlü yerel kayıtta tutulur. Yarış başında model ve istatistikler sabitlenir; yarış sırasında ekipman değiştirilemez.
- HUD araç adını ve takılı parça seviyelerini gösterir; hız, yön tepkisi ve nitro kapasitesi simülasyona bağlıdır. Bütün oyuncu modelleri mevcut ortak çarpışma boyutlarına normalize edilir.
- Sonraki kabul: gerçek telefonlarda üç araçla görsel/çoklu dokunma testi, denge ayarı ve modele özel far/egzoz yerleşimi. Ekipman görsel gövde parçaları eklemez; bu aşamada sürüş ayarıdır.


## Gündüz–gece döngüsü, virajlar ve tünel — 2026-09-08

Yarış gündüz başlar: 300 saniye gündüz, 45 saniye gün batımı, 180 saniye gece, 45 saniye gün doğumu; 570 saniyelik döngü tekrar eder. Zaman oyunun elapsedTime değerinden türetilir, duraklatmada ilerlemez ve yeni yarışta sıfırlanır. Gökyüzü, sis, ay/yıldızlar, ortam ışığı, sokak lambaları, pencereler ve farlar aynı geçişi kullanır.

1800 render metrelik periyodik rota geniş S virajlarını ve 650. metrede başlayan 150 metrelik tüneli içerir. Render mesafesi önceki dünyadaki gibi totalDistance × 5'tir; HUD mesafesiyle aynı birim değildir. Yol yüzeyleri ve tünelin küçük geometrileri bükülür; araçlar, binalar ve ağaçlar ortak yol konumu/yönüne göre katı olarak yerleştirilir. Çarpışmalar yol koordinatlarında kalır, görünürlük gerçek eğrilmiş model sınırlarıyla hesaplanır. Tünelde farlar gündüz de açılır; giriş ve çıkış ışığı 15 render metresi boyunca yumuşar.

Tünel yedi ek çizim, instanced armatürler ve mevcut iki araç farını kullanır; yeni gerçek ışık, postprocess veya ayrı gölge haritası eklenmez. Görsel kabul ve ölçümler TASK.md içinde tutulur; fiziksel telefon performansı ayrıca doğrulanmalıdır.

## Gece yarışı — 2026-09-07

Varsayılan sürüş geceye taşındı. Üç çizimlik procedural gökyüzü ay ve yıldızları içerir; sokak lambalarının tamamı iki instanced ışık alanı/halo çizimiyle desteklenir. Oyuncunun iki shadowless SpotLight'ı araçla birlikte dönen açık hedeflere bağlıdır. NPC farları gerçek ışık sayısını artırmaz. Sis, camlar, asfalt, şeritler ve yansıtma ortamı gece için birlikte ayarlanmıştır; Performance/High aynı gece dünyasını korur.

Kabul: yerel build/lint ve 46 test geçti (17 mock-modu üretim testi atlandı). 1280×720, 844×390 ve 390×844 görünümleri kontrol edildi. Performance/High gerçek ışık sayısı sabit ve shader artışı 0; son High koşusunda shader/bağlam hatası yok. GPU ortalaması 33,10 ms olmasına karşın teslim edilen kare aralıkları ortalama 168,33 ms ve p95 525,30 ms: bu oturum akıcı FPS kabulü veya fiziksel cihaz garantisi sağlamaz. Aynı oturumdaki eski gündüz referansı da uzun kare aralıkları gösterir; neden tek başına geceye bağlanamaz. Sonuçlar [night-validation.json](night-validation.json) içinde.

Render aracı artık yarışın shader hazırlığını bekler; ışık/program sayısı, görünürlük/odak, WebGL hataları ve mevcutsa asenkron GPU sürelerini kaydeder. Yayın ayrı `codex/night-highway` dalı ve yeni inceleme isteği üzerinden ilerler; önceki mobil PR merge edilmiştir.

## Güncel mobil kontrol düzenlemesi — 2026-09-07

Hız ve nitro göstergeleri karşı kenarlara taşındı. Direksiyon için görünmez sol/sağ ekran yarıları kullanılır; basılı tutma, orta çizgiyi geçme ve bağımsız ikinci parmak nitrosu desteklenir. HUD düğmeleri direksiyonu tetiklemeden çalışır. 844×390 ve 390×844 gerçek yarış görünümleri kontrol edildi; yerel lint/build ve 46 test başarılı, 17 mock-modu üretim testi atlandı. Fiziksel telefonlarda ekran kenarı hareketleri, ekran döndürme ve uzun süre iki parmak kullanımı sonraki kullanıcı kabulüdür. Önceki performans ölçümleri kendi sürümlerinin kaydı olarak korunur.

## Güncel kabul planı — 2026-09-07 performans ve cephe düzeltmeleri

Çevrenin görünür örnekleri sıkıştırılarak GPU'ya gönderilir; bina/ağaç mesafesi ve sis kalite seçeneklerinde aynıdır. Auto yarış sırasında yalnız çözünürlüğü ayarlar. Kamera derinliği, pencere/perde yüzeyleri ve yaprak alfa kapsamı yaklaşırken oluşan görüntü değişimlerini azaltacak biçimde düzenlendi. Yarış modelleri sadeleştirildi, trafik dokusu/shader hazırlığı geri sayım öncesine alındı; duraklatma ve sekme görünürlüğü render döngüsünü durdurur.

1. Tamamlandı: yerel lint/build; 40 başarılı test ve mock modunda atlanan 17 üretim entegrasyon testi. Çevre envanteri 18 prototip/58.540 üçgendir; gerçek sahne yükü görünür örneklerle değişir.
2. Tamamlandı: dondurulmuş `ce213ddb74c93f07fd6a5270e39cc26681e4fa4f` kaynaklarıyla aynı görünür sekmede 1280 × 720/High/DPR 1 karşılaştırması. Ortalama kare süresi 41,95 → 27,43 ms; p95 51,9 → 30,9 ms. Yöntem ve sınırlar [PERFORMANCE_REVIEW.md](PERFORMANCE_REVIEW.md) içindedir; bu koşu 60 FPS'e ulaşmadı.
3. Tamamlandı: normal tarayıcıda yükleme/geri sayım/yarış/çarpışma/sonuç/tekrar akışı; ilk hazırlıkta duraklatma ve geri sayımla devam. Sayfa JavaScript hatası görülmedi; yakın bina ve meşe görüntüsü kontrol edildi.
4. Kalan: gerçek Android/iPhone üzerinde 15 dakikalık sürüş, ısınma, sekme dönüşü ve çoklu dokunma ölçümü; farklı çözünürlüklerde yakın/uzak cephe kabulü.
5. PR kontrolleri ve varsa canlı dağıtım durumu ayrıca doğrulanmalı. Yerel başarılar CI veya cihazda 60 FPS garantisi olarak sunulmaz.

Önceki optimizasyon ve sprint ölçümleri aşağıda tarihsel kapsamlarıyla korunur. Yarış artık `*_runtime.glb`, garaj `sport_car_compact.glb` kullanır; güncel model ölçümleri [model kaydındadır](../public/models/RUNTIME_MODELS.md).

## Önceki çalışma — 2026-09-07 özgün çevre koleksiyonu

Beş bina, dört bitki türünün ikişer çeşidi, sokak lambası ve dört sokak detayıyla **18 prototip** hazırlandı. Yol kenarı artık `RoadsideWorld` üzerinden özgün procedural geometri ve iki yerel üretilmiş doku kullanır. Ayrı varlık stüdyosu tek tek model incelemesi sağlar. Tam envanter, kaynak sözleşmesi, doku istemleri ve yerel çalıştırma adımları [ROADSIDE_ASSETS.md](ROADSIDE_ASSETS.md) içindedir.

**Bu ek çalışmanın kabul sırası:**

1. Tamamlandı: bütünleşik yeni çevrenin 390 × 844 mobil tarayıcı görünümü ve stüdyoda 18 prototip/68.152 üçgen/sonlu koordinat kontrolü.
2. Yerel lint/build tamamlandı; 33 test geçti, 17 mock-modu üretim testi atlandı. Kaynakların aynı PR #1 üzerinden yayımlanması ve PR kontrol sonuçlarının değerlendirilmesi sıradadır.
3. Gerçek telefonlarda uzun sürüş, kare süresi, ısınma ve yaprak/çam geometri maliyetinin ölçümü; bark tekrar dikişinin görsel kabulü.

Hedefli kaynak/geometri ve yukarıdaki yerel bütünleşik kontroller tamamlandı; bu bölüm yeni bir GitHub Actions/CI başarısı veya ölçülmüş telefon FPS sonucu ilan etmez. Oyuncu modelinin aşağıdaki önceki optimizasyon kapsamı değişmedi.

## Önceki çalışma — 2026-09-07 oynanış ve ilk görsel yenileme

`Lumexia_Dev_Game` şu anda **ücretsiz ve yerel antrenman sürümüdür**. `DEV_MODE=true`; cüzdan, fiyat ve backend adaptörleri mock durumundadır. Oyun kredi tüketmez, sunucu sıralamasına skor göndermez veya ödül ödemez. Yerel rekorlar tarayıcıda, oyun modu bazında tutulur. Yalnız bayrağı değiştirmek üretim entegrasyonlarını geri getirmez.

Oynanış, sabit 120 Hz simülasyon, yumuşak direksiyon, hareket boyunca çarpışma kontrolü, trafik aralıkları, nitro ve duraklatmayla yenilendi. Garaj, yarış HUD'si, sonuç ekranı, çevre, kamera, ses ve grafik seçenekleri ayrı bileşenlere taşındı. Oyuncu modelinde üçgenler korunarak indirme boyutu %30,39 azaltıldı; yerel Draco decoder eklendi. Ayrıntılar [kalite raporunda](QUALITY_REVIEW.md).

**Yerel doğrulama:** 33 test geçti, mock modundaki üretim davranışlarına ait 17 test atlandı. Kısıtlı Windows ortamında testler `--configLoader runner`, build `--configLoader native` ile başarıyla çalıştı. Normal ve kısıtlı ortam komutları README'dedir. Test sayısı üretim hizmetleri için başarı iddiası değildir.

### Sonraki kabul çalışmaları

1. Windows entegre GPU, orta sınıf Android ve iPhone Safari'de en az 15 dakika sürüş ve kare süresi ölçümü.
2. Klavye ve çoklu dokunma, yön + nitro, duraklatma, odak kaybı, ekran döndürme ve 30/60/120 Hz karşılaştırması.
3. Boş önbellek/yavaş bağlantı, varlık yükleme hatası ve art arda 20 yeniden başlatmada kaynak kullanımı.
4. Compact oyuncu modelinin yakın kamera ve mobil çözünürlükte görsel kabulü.
5. Üretim cüzdan, ödeme, sıralama ve ödül servisleri için ayrı test ortamında entegrasyon ve kabul planı. Bu çalışma tamamlanana kadar mevcut antrenman kapsamı korunur.

## Tarihsel durum özeti — 2026-05-03

**Arşiv notu:** Aşağıdaki plan ve sprint kayıtları tarihsel bağlamı korumak için bırakılmıştır. “Çalışıyor”, “prod” ve “operasyonel” ifadeleri 3 Mayıs 2026'daki üretim anlatımına aittir; mevcut geliştirme deposunun doğrulanmış durumu değildir. Güncel kapsam ve kalan kabul işleri yukarıdadır.

Proje, **calisir ve oyunabilir** durumda bir 3D yaris oyunu. TOKABU token ile odeme akisi end-to-end calisiyor. Sprint 0-4 + Sprint 4.5 + Sprint 6 + Sprint 7-mini tamamlandi. **Cycle reward payout pipeline operasyonel:** her cycle sonu Edge Function USD + SOL + TOKABU yazar, ekip manuel runbook ile ödeme yapar ve `paid_at` ile işaretler.

**Aktif sprint durumu (2026-05-03):**

| Sprint | Durum | Not |
|--------|-------|-----|
| 0-4 | ✅ Tamam | Otonomluk altyapısı, landing migration, anti-cheat, kod kalitesi |
| 4.5 | ✅ Tamam | Payment self-healing |
| 5 (E2E test) | ❌ İPTAL | Kullanıcı kararı 2026-05-02 |
| 6 (48h cycle + UI) | ✅ KAPALI | Tüm PR'lar prod'da |
| **7-mini (manual payout)** | **✅ KAPALI** | **3 PR (#106, #107, #108) prod'da; pipeline operasyonel** |
| 7 (tam otomatik transfer) | ⏸️ ASKIDA | Treasury Vault + distribute-rewards + retry queue + monitoring (memory: `project_payment_process_pending.md`) |

**Son merge edilen PR'lar (kronolojik):**
- Racing PR #99/#100/#101: Payment self-healing — 2026-05-01
- Racing PR #102: Sprint 6 PR 6.1 — 48h cycle reset (backend + UI legal) — 2026-05-01
- Racing PR #103: Anti-cheat coin density 1/50m → 1/10m relax — 2026-05-01
- Landing PR #17: Sprint 6 PR 6.5 — 48h cycle copy + Cycle Ranking reorder — 2026-05-02 (squash `74ec528`)
- Racing PR #104: docs sync — 2026-05-02 (squash `a249a06`)
- Landing PR #18: Cycle Ranking UI fix (48h window + bonus formula + LMX/SOL) — 2026-05-02 (squash `b0f03f7`)
- Racing PR #105: docs sync (Sprint 5/7 status reset) — 2026-05-02 (squash `87b4134`)
- **Racing PR #106: Sprint 7-mini PR 1 — payment tracking schema (7 yeni kolon + index + cleanup) — 2026-05-03 (squash `6a6ab97`)**
- **Racing PR #107: Sprint 7-mini PR 2 — Edge Function 3-tier price fallback + multi-currency INSERT — 2026-05-03 (squash `0fcd08a`)**
- **Racing PR #108: Sprint 7-mini PR 3 — manual-payout runbook — 2026-05-03 (squash `2f1100a`)**

**Tamamlanmis altyapi:**
- Branch protection her iki repo'da aktif (main'e direkt push yasak, force push yasak, 1 review zorunlu, CI status check)
- CI test gate (`.github/workflows/ci.yml`) — her PR'da `npm test` + `npm run build` zorunlu
- Edge Function recovery: `calculate-daily-rewards` Supabase prod'dan repo'ya geri alindi ve CI deploy hattina baglandi; BNB → USD geçişi + JWT bypass yapıldı
- `verify-payment` Edge Function `PAYMENT_RECEIVER_ADDRESS` env var adını destekliyor (geriye uyumlu)
- `reconcile-payments` Edge Function (orphan TX backfill, 100 imza taraması, idempotent UNIQUE constraint)
- `unverified_payments` tablosu (forensic admin log, service-role only)
- Rate limiting (use-credit 30/dk, verify-payment 10/dk) — uretimde calisiyor
- Bug #4 coins_collected — submit_score imzasi guncel, GameOverUI gonderiyor
- Buffer polyfill, Vitest setup (19 test), price tolerance %7 hizalanmis, 11 ESLint hatasi temizlenmis
- 48h cycle: trigger fonksiyon `cycle_start = CURRENT_DATE - ((CURRENT_DATE - DATE '2026-05-01')::int % 2)` hesabi yapar; archive cron prev-cycle rows'unu temizler; calculate-daily-rewards cycle-end day kontrolü ile self-skip eder
- **Sprint 7-mini payout pipeline:** `reward_pool_distribution` 7 yeni kolon (reward_amount_sol/tokabu, sol/tokabu_price_usd audit snapshots, paid_at/paid_tx_hash/paid_in_token); calculate-daily-rewards 3-tier fiyat fallback (DexScreener → Jupiter → CoinGecko/transactions DB per-wallet); `docs/RUNBOOKS/manual-payout.md` ekip için step-by-step kılavuz

**Landing page (lumexia.net):**
- Tamamen Solana/TOKABU dünyasında (SEO meta + structured-data + UI metinleri + API routes)
- Sprint 6 PR 6.5 ile 48h cycle UI: features-grid "Cycle Reward Distribution" + dashboard-hero "CYCLE RANKING" buton + LeaderboardSection üst seviyede (DashboardHero altında, TransactionsPanel üstünde)
- Realtime subscriptions debounce'lı (Sprint 3b)

**Sprint 6 PR durumu (kapalı):**
- PR 6.1 — 48h cycle backend + legal UI ✅ (#102)
- ~~PR 6.2~~ — `reward_distributions` ALTER → Sprint 7-mini PR #106'ya taşındı (`reward_pool_distribution`'a `paid_at`/`paid_tx_hash` + currency kolonları eklendi)
- ~~PR 6.3~~ — `export-reward-payload` Edge Function → **İPTAL** (calculate-daily-rewards zaten per-wallet ödülü tabloya yazıyor; Dashboard SQL + manual-payout.md runbook yeterli)
- ~~PR 6.4~~ — Racing UI 48h metinleri → **GEREKSİZ** (UI'da "Daily" referansı yok)
- PR 6.5 — Landing 48h UI ✅ (#17)
- PR 6.6 — Toplu docs sync ✅ (#104 + #105 + bu PR)
- Bonus PR — Cycle Ranking UI fix ✅ (#18)

**Sprint 7-mini PR durumu (kapalı, 2026-05-03):**
- ✅ #106 (`6a6ab97`) — Schema: `reward_pool_distribution` 7 yeni kolon + idx_reward_unpaid + 4 eski BNB satırı cleanup
- ✅ #107 (`0fcd08a`) — Edge Function: 3-tier SOL fiyat (DexScreener+Jupiter+CoinGecko) + 2-tier+DB TOKABU (DexScreener+Jupiter+per-wallet transactions fallback) + multi-currency INSERT + observability
- ✅ #108 (`2f1100a`) — `docs/RUNBOOKS/manual-payout.md` (382 satır, 10 bölüm + troubleshooting)

**Açık aksiyonlar (kullanıcı):**
1. **2026-05-05 00:00 UTC** — Cycle 2 sonu **ilk gerçek multi-currency** Edge Function çalışmasını doğrula:
   - Edge Function loglarında `prices` block (sol_usd, tokabu_usd_api, tokabu_used_db_fallback)
   - Dashboard SQL: `SELECT wallet_id, reward_amount, reward_amount_sol, reward_amount_tokabu, sol_price_usd, tokabu_price_usd FROM reward_pool_distribution WHERE reward_date = '2026-05-03';` → 5 currency kolonu non-NULL
2. `reconcile-payments` `dryRun: true` ilk test (PR #99 sonrası açık)
3. `reconcile-payments` cron enable (Dashboard SQL)
4. Google Search Console "Request Indexing" — lumexia.net (Madde 5)
5. Token launch hazırlığı — yeni mint, Supabase Secrets güncelleme, config dosyaları PR'ı (single source of truth: `solana.config.js` + `lib/token-config.ts`)
6. Cycle 2 sonu manual payout dry-run — `docs/RUNBOOKS/manual-payout.md` adım adım uygula, ekibe rehber test edilsin

**Açık tartışmalar (ileride):**
- Ödeme süreci tercihi (manuel/hibrit/otomatik) — Sprint 7 plan açma ön koşulu

**Sprint 4 (Kod Kalitesi) tamamlandı:**
- 4.1 ESLint flat config genişletme + CI lint job (PR #96) ✅
- 4.2 jupiterPrice unit test suite (11 test, toplam 19) + plan iptalleri ✅
- 4.3 README + PROJECT_DOCS + PLAN cilalama ✅
- ~~App.jsx bölme~~ ve ~~RealLauncherUI bölme~~ **iptal** (kullanıcı kararı 2026-05-01; çalışan kod, regression riski yüksek, marjinal kazanç).

**Sprint 3 (Otonom Supabase) tamamlandı:**
- 3a Typed client + canonical env names (landing PR #14) ✅
- 3b Realtime hardening (landing PR #15) ✅
- 3 wrap-up Cross-repo integration doc (racing) ✅

**Sprint 2 (Güvenlik) tamamlandı:**
- 2.5 Function search_path mutable → 9 fonksiyona pinned ✅
- 2.4 Migration discipline → CI/CD otomatik apply ✅
- 2.2a Anti-cheat altyapı → submit-score Edge Function + suspicious_scores tablo ✅
- 2.2b + 2.3 Frontend cutover + banner → GameOverUI submit-score'a geçti, doğru cümle ✅
- 2.1 RLS lockdown → INSERT'ler service-role only, duplicate SELECT'ler temizlendi, SECURITY DEFINER fonksiyonlardan EXECUTE revoke ✅

**Anti-cheat akışı:** Frontend → submit-score Edge Function → validate (hız 60 m/s, coin/m, score/m, zaman drift) → suspicious_scores log (anomali) veya scores INSERT (geçerli, service role).

**Migration discipline:** 14 haneli format + CI auto-apply.

Detaylı yol haritası: `~/.claude/plans/ncelikle-t-m-dosyalar-ve-jiggly-naur.md` (v3)

---

## Faz 0: Kritik Bug Duzeltmeleri (TAMAMLANDI)

- [x] `use-credit/index.ts`: Ethereum regex -> Solana base58 regex
- [x] `store.js` quitGame(): `'menu'` -> `'launcher'`
- [x] `index.html`: kullanilmayan RainbowKit CSS import kaldirildi

Detay icin bkz. `TASK.md`.

---

## Faz 1: Temel Altyapi Iyilestirmeleri (Oncelik: Yuksek)

### 1.1 Test Altyapisi (Kismen Tamamlandi)
- [x] Vitest kurulumu ve yapilandirmasi (v6)
- [x] solanaWallet.js icin birim testleri (8 test, balance error path'leri)
- [ ] Store (game logic) icin birim testleri
- [ ] Carpisma algilama testleri (VEHICLE_DIMENSIONS, COLLISION_PADDING)
- [ ] Skor hesaplama testleri (classic vs D/N)
- [ ] Dusman AI testleri (serit degistirme, spawn algoritmasi)
- [ ] Utility fonksiyonlari (jupiterPrice) testleri
- [ ] CI/CD pipeline'a test entegrasyonu (npm test)

### 1.2 Kod Kalitesi
- [ ] ESLint 11 pre-existing hatasi (formatAddress unused, tokenAmount unused, store.js targetX, main.jsx fast-refresh)
- [ ] Prettier entegrasyonu
- [x] Gereksiz console.log'lari uretimde strip (vite pure_funcs ile, v6)
- [x] Tutarsiz isimlendirmelerin duzeltilmesi (Coal -> generic token, v5)
- [ ] App.jsx bolme (2456 satir -> mantiksal alt dosyalar)

### 1.3 TypeScript Gecisi (Opsiyonel - Buyuk is)
- [ ] tsconfig.json olusturma
- [ ] Tip tanimlari (interfaces) yazma
- [ ] Adim adim .jsx -> .tsx donusumu
- [ ] Store tipleri
- [ ] Component prop tipleri

---

## Faz 2: Oyun Mekanikleri Iyilestirmeleri (Oncelik: Orta)

### 2.1 Oyun Deneyimi
- [ ] Ses dosyalari ekleme (motor sesi, arka plan muzigi)
- [ ] Post-processing efektlerin etkinlestirilmesi (bloom, motion blur)
- [ ] Daha fazla arac modeli ve cesitliligi
- [ ] Hava durumu efektleri (yagmur, gece/gunduz)
- [ ] Farkli harita/pist secenekleri

### 2.2 Kontrol Iyilestirmeleri
- [ ] Gamepad/joystick destegi
- [ ] Mobil gyroscope kontrolu
- [ ] Kontrol hassasiyet ayarlari
- [ ] Dokunmatik kontrol geri bildirimi iyilestirme

### 2.3 Zorluk Dengesi
- [ ] Dusman spawn oranlarinin ince ayari
- [ ] Seviye gecis mesafelerinin dengelenmesi
- [ ] Near miss mesafe esiklerinin test edilmesi
- [ ] Double or Nothing modunun dengelenmesi

---

## Faz 3: Backend ve Guvenlik (Oncelik: Yuksek)

### 3.1 Guvenlik Iyilestirmeleri
- [ ] RLS politikalarinin sikistirilmasi (USING(true) -> wallet bazli kurallar)
- [ ] Skor dogrulama (sunucu tarafli anti-cheat, hiz/mesafe tutarliligi)
- [ ] Rate limiting eklenmesi (skor gonderme, kredi kullanma)
- [ ] Edge Function'larda girdi dogrulama guclendirme
- [ ] GameOverUI'daki "Fair Play Protected" iddiasini gercek dogrulama ile destekle
- [ ] submit_score RPC'ye coins_collected parametresi eklemek ve scores tablosuna yazmak
- [ ] Fiyat toleransini hizala (frontend %5 vs backend %10)

### 3.2 Backend Ozellikleri
- [ ] Skor gonderme Edge Function'u (sunucu tarafli dogrulama)
- [ ] Gunluk odul dagitim sistemi
- [ ] Kullanici profil sayfasi
- [ ] Oyun istatistikleri API'si

### 3.3 Veritabani Optimizasyonlari
- [ ] Sorgu performans analizi
- [ ] Gereksiz indexlerin temizlenmesi
- [ ] Arsivleme stratejisi (eski skorlar)

---

## Faz 4: UI/UX Iyilestirmeleri (Oncelik: Orta)

### 4.1 Launcher Ekrani
- [ ] Yukleme animasyonu iyilestirme
- [ ] Cuzdan baglanti akisi sadellestirme
- [ ] Kredi satin alma deneyimini iyilestirme
- [ ] Token fiyat gosterimi ekleme

### 4.2 Oyun Ici UI
- [ ] Minimap veya mesafe gostergesi
- [ ] Combo animasyonu iyilestirme
- [ ] Level up efekti
- [ ] Daha iyi HUD tasarimi

### 4.3 Oyun Sonu Ekrani
- [ ] Detayli istatistikler
- [ ] Paylasim butonlari
- [ ] Tekrar oynama akisini iyilestirme

---

## Faz 5: Performans Optimizasyonu (Oncelik: Orta)

### 5.1 Rendering
- [ ] LOD (Level of Detail) sistemi
- [ ] Frustum culling iyilestirmesi
- [ ] Texture atlasing
- [ ] Model basitlestirme (dusuk poly versiyonlari)

### 5.2 Bellek Yonetimi
- [ ] Material dispose stratejisi gozden gecirme
- [ ] Texture cache optimizasyonu
- [ ] Garbage collection azaltma

### 5.3 Network
- [ ] API cagrisi caching
- [ ] Offline destek (PWA)
- [ ] Asset preloading stratejisi iyilestirme

---

## Faz 6: Yeni Ozellikler (Oncelik: Dusuk)

### 6.1 Sosyal Ozellikler
- [ ] Gercek zamanli cok oyunculu mod
- [ ] Arkadaslik sistemi
- [ ] Oyun ici sohbet
- [ ] Turnuva sistemi

### 6.2 NFT Entegrasyonu
- [ ] NFT araba skinleri
- [ ] NFT odul sistemi
- [ ] Marketplace entegrasyonu

### 6.3 Ek Oyun Modlari
- [ ] Zaman yarisi modu
- [ ] Hayatta kalma modu
- [ ] Gunluk meydan okuma

---

## Oncelik Sirasi

1. **Test altyapisi** - Guvenilir gelistirme icin kritik
2. **Guvenlik iyilestirmeleri** - Uretimde para islemleri var
3. **Kod kalitesi** - Surekli gelistirme icin onemli
4. **Oyun deneyimi** - Kullanici tutma icin kritik
5. **UI/UX** - Kullanici deneyimi
6. **Performans** - Mobil deneyim icin onemli
7. **Yeni ozellikler** - Buyume icin

---

## Teknik Borc (v6 sonrasi guncel)

| Alan | Aciklama | Oncelik |
|------|----------|---------|
| RLS politikalari | Tum tablolarda USING(true) - herkes her seyi okur/yazar | **Kritik** |
| Sunucu tarafli skor dogrulama yok | Frontend'den hile mumkun, "Fair Play Protected" banner'i yaniltici | **Kritik** |
| Rate limiting yok | submit_score, use-credit, verify-payment limitsiz | Yuksek |
| App.jsx 2456 satir | Tek dosyada cok fazla bilesen | Yuksek |
| Test kapsami sinirli | Sadece solanaWallet test'leri var; store/GameOverUI/Edge Function eksik | Yuksek |
| ESLint 11 pre-existing hata | formatAddress unused, tokenAmount/price unused, fast-refresh | Orta |
| coins_collected kaydedilmiyor (BUG #4) | submit_score imzasinda yok, GameOverUI gondermiyor | Orta |
| Tolerans tutarsizligi | Frontend %5 (solana.config.js) vs backend %10 (verify-payment) | Orta |
| Hardcoded degerler | Oyun sabitleri (hiz, mesafe, spawn oranlari) dosyada gomulu | Orta |
| TypeScript yok | Tip guvenligi eksik | Dusuk |
| Kullanilmayan asset'ler | Car1/scene.gltf, suv.glb, coin.glb preload edilir ama render'da kullanilmaz | Dusuk |
| FontAwesome CDN | Dis bagimllik, bundle'a alinabilir | Dusuk |
| three-vendor 1144 KB | Tek chunk, code-split mumkun | Dusuk |

## Yakin Zamanda Duzeltilenler (v6 - 2026-04-30)

| Alan | Durum |
|------|-------|
| ~~TOKABU bakiye 0 gozukuyor~~ | DUZELTILDI - Buffer polyfill (`src/polyfills.js`), kok neden Vite'in Buffer'i polyfill etmemesi |
| ~~`drop_console: true` her seyi gizliyor~~ | DUZELTILDI - sadece log/debug/info strip, error/warn korundu |
| ~~`getTokenBalance` sessiz 0 dondurur~~ | DUZELTILDI - throw ediliyor, UI'da error state + retry butonu |
| ~~use-credit Edge Function eski Ethereum regex~~ | DUZELTILDI - workflow'a deploy adimi eklendi, redeploy yapildi |
| ~~Test altyapisi yok~~ | EKLENDI - Vitest + 8 regression test |

## Yakin Zamanda Duzeltilenler (v5 - 2026-04-23)

| Alan | Durum |
|------|-------|
| ~~Coal/Oiltown isimlendirme~~ | DUZELTILDI - jenerik isimlere rename (getTokenBalance, transferToken) |
| ~~Post-processing bos composer~~ | DUZELTILDI - PostProcessing component tamamen kaldirildi |
| ~~Helius API key git'te commit'li~~ | DUZELTILDI - env var'a tasindi |
| ~~20241216 migration LMX/BNB default'lari~~ | DUZELTILDI - default NULL + yeni migration |
