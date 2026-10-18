# Lumexia Racing Game - Gorev Takip

> Son güncelleme: 2026-10-19

## 2026-10-19: Sabit kalite sürümünün yayını

Kullanıcı bu sürümün yayımlanmasını istedi. Hedef mevcut `blaixs-max/Lumexia_Dev_Game` deposunun `main` dalı ve Vercel `lumexia-dev-game` projesindeki [canlı oyun](https://lumexia-dev-game.vercel.app/). Yerel 169 test / 17 atlanan üretim adaptörü testi, lint ve 659 modüllük derleme kabulü korunur. GitHub PR test/lint/derleme kontrollerinden sonra birleştirme, mevcut Vercel Git bağlantısını tetikler; yayın commit'i ve READY durumu ile canlı menü/yarış ayrıca doğrulanır.

## 2026-10-18–19: Sabit görüntü kalitesi ve kayıpsız çizim optimizasyonu

- [x] FPS örneklemesi ve yarış sırasında DPR düşürme bağlantısı kaldırıldı. Çözünürlük ve ayrıntı profili yarış başında seçilir, seviye/FPS değişiminden etkilenmez.
- [x] Grafik menüsünde eski Otomatik seçeneği Standart olarak gösterilir; kayıtlı `auto` tercihi korunur. Performans/Yüksek elle seçilebilir ve yarış boyunca sabittir.
- [x] Gölge malzemeleri bütün sahneyi her karede taramak yerine yeni nesne/malzeme eklenirken hazırlanır. Gerçek kamera/güneş değişimleri tam olarak uygulanır; harita boyutları, kademe kapsamı ve geçişleri korunur.
- [x] NPC gövdeleri aynı geometri, malzeme, doku ve dönüşümlerle toplu çizilir. Ana görünüm ve her gölge kamerası kendi görünür örneklerini kullanır; görünmeyen araçları fazladan çizerek üçgen maliyeti artırılmaz. Farlar/fren/sinyal ve fizik kimlikleri korunur.
- [x] Aynı 12 araç, 1280×720/DPR 1, High gündüz/gece ve Performance gece karşılaştırıldı. Gündüz toplam çizimler 1268 → 977, toplam üçgenler 4.650.642 olarak aynı; GPU medyanı 50,03 → 48,52 ms. Bu cihazda teslim edilen FPS 18,07 → 18,13; belirgin FPS artışı iddiası yok. Ham tekrarlar ve gece profilleri saklandı.
- [x] Ana indeks sıralaması bütün kaynak niteliklerini ve yönlü üçgenleri korur. Uygun opak gölgeler ham konum bitleriyle hazırlanır; 16 gerçek Ferrari primitive'inin indeks/konum eşdeğerliği ayrıca denetlendi. Encoder başarısızlığı/uyumsuz veya aşırı bağlantılı geometri için kaynak yol korunur; hazırlık bir defa yükleme sırasında yaklaşık 169 ms.
- [x] Standart ile gerçek yarışta 25 saniye boyunca 1280×720 sabit; duraklat → garaj ve Subaru/Motor 1 korundu. Final kodla 8. seviye gece düzeneği 20 saniyede 12 etkin NPC / 9 tamamlanan şerit değişimi / 0 temas / açık geçiş koridoru verdi. Gece ortam yoğunluğu 0,16; 3×1536 harita, DPR 1 ve sıfır shader/sayfa/bağlam hatası. [Canlı trafik kaydı](../artifacts/fixed-quality-live-night.json).
- [x] **169 test başarılı, 17 üretim adaptörü testi atlandı; lint ve üretim derlemesi (659 modül) başarılı.** Sabit gündüz piksellerinin %99,966'sı, gece %99,985'i birebir eşleşti; [görüntü kaydı](../artifacts/fixed-quality-image-parity.json). Fiziksel telefon FPS kabulü yapılmadı.
- [x] Son geometri/far koduyla normal uygulama: Standart → Classic Run → 33 saniye / 367 m / 13 jeton → sonuç → garaj; 361 altın doğru eklendi, Subaru/Motor 1 korundu ve tarayıcı hata kaydı boş. [Son uygulama kontrolü](../artifacts/fixed-quality-final-app.json).

Yukarıdaki sonuçlar yayın öncesi yerel kabul kaydıdır. Yayın akışı üst bölümde, ölçüm yöntemi ve sınırlar [PERFORMANCE_REVIEW.md](PERFORMANCE_REVIEW.md) içindedir.

## 2026-10-18: GitHub ve Vercel yayın paketi

Kullanıcının yayın isteği, modele uygun çarpışma alanları ile NPC hareketi, takip/frenleme, güvenli şerit değişimi ve sürekli gölgeleri birlikte kapsar. Hedef mevcut `blaixs-max/Lumexia_Dev_Game` deposunun `main` dalı ve `lumexia-dev-game.vercel.app` canlı ortamıdır. Paket, 130 başarılı test / 17 atlanan üretim adaptörü testi, lint ve 654 modüllük üretim derlemesiyle yerelde doğrulandı. GitHub PR kontrollerinden sonra birleştirme mevcut Vercel Git bağlantısının yayınını tetikler; yayın durumu ve commit eşleşmesi ayrıca kontrol edilir. Aşağıdaki yerel uygulama notları önceki kabul aşamalarının kapsamını korur.

## 2026-10-18: NPC hareketi, trafik etkileşimi ve uzak gölgeler

- [x] NPC/yol ölçeği düzeltildi: oyuncu 110 ve NPC 55 örneğinde eski çevreye göre hız 0, yeni hız 27,5 dünya birimi/saniye. Göreli trafik hareketi de yol ile aynı 0,5 katsayısını kullanır.
- [x] İstenen hız ve takip hızı ayrıldı; NPC'ler öndeki araç için yavaşlar, gövdeler arası asgari mesafeyi korur. Sinyal, yumuşak bitişik şerit geçişi, sırayla alınan şerit rezervasyonları ve son geçiş koridorunun korunması ortak trafik modülündedir.
- [x] Eski/yeni NPC eşleştirmesi sabit kimlikle yapılır; oluşma veya silinme dizi sırasını değiştirse de çarpışma/bonus denetimleri başka araca bağlanmaz. Önceki model boyutu düzeltmesi korunur.
- [x] Gerçek geometriden kademeli güneş gölgesi: Performance 2×1024 / 320 birim, High 3×1536 / 360 birim. Kademe sınırlarında en az 8 birim yumuşak karışım ve uzak sönüm; gölge aynı ışık yönünü izler. NPC yönelmesi şerit eğrisine göre yumuşar; yavaşlayan NPC'nin fren lambası belirginleşir.
- [x] Ayrı QA düzeneğine canlı trafik, sabit seviye/başlangıç, takip, şerit değişimi ve gölge yaklaşımı örnekleri eklendi. Görünür ölçümlerde gerçek/istenen hız, sinyal/geçiş sayıları, NPC temasları, gövde boşlukları, geçiş koridoru ve kademe bilgileri bulunur; kalıcı bakiye yazılmaz.
- [x] Sinyal öncesinde planlanan manevra da iki şeridi rezerve eder; görünür sinyal rastgele 145–180 dünya birimi yaklaşımında, etkin boost için daha erken başlar. 36×120 saniye = **72 simülasyon dakikası**: seviye 1/8/80, dört başlangıç ve hız 110/225/235; her 120 Hz adımda bağımsız gövde çakışması, yerel koridor ve 1,15 saniyelik varış kümelerinde üç şerit duvarı denetlenir. Her profilde en az dört tamamlanmış geçiş; normal hızda en az dört geçiş 70–160 dünya birimi görünür yaklaşımında tamamlanır. Yoğun trafik 30/60/144 FPS sonuçları eşittir.
- [x] 60 saniyelik yoğunluk örneklerinde seviye 1/3/5/8 ortalama yaklaşan araç sayısı **2,46 / 4,26 / 7,18 / 8,62**; seviye 5, seviye 1'in yaklaşık 2,9 katıdır. Ölçüm, kazayla bitmemesi için z > −20'ye gelen araçları çıkarır ve pickup içermez; FPS ölçümü değildir. Normal hızda 8. seviye 120 saniyede 56–70, boost altında 177–191 güvenli geçiş tamamlar. Toplam araç sınırı 12'dir; 8. seviyeden sonra oluşum eğrisi sabitlenir.
- [x] Son tam kabul: **130 test başarılı, 17 üretim adaptörü testi atlandı**; lint, 654 modüllük üretim derlemesi ve 642 modüllük ayrı QA derlemesi başarılı. Önceki model boyutu regresyonları dahil.
- [x] Gerçek yarış sahnesinde High gündüz, 8. seviye / seed 2026: 20,18 saniyede 10 etkin NPC, 8 tamamlanmış ve 2 devam eden geçiş, asgari gözlenen gövde boşluğu 4,2525, sıfır NPC teması; geçiş koridoru açık. Performance gece 33,37 saniyede 14 geçiş / sıfır temas / açık koridor verdi. İkisinde 43 shader programı, sıfır shader/sayfa/WebGL bağlam hatası. Görseller: [yoğun trafik](../artifacts/npc-live-level8.png), [Performance gece](../artifacts/npc-live-performance-night.png); [tarayıcı ölçümleri](../artifacts/npc-browser-qa.json).
- [x] Aynı NPC, yaklaşık z = −82 ve −21 konumlarında gölgesini korur; High gündüz/gece açıları kontrol edildi. Takip örneğinde 73 istenen hız 45,35'e düşer ve 5,41 birim gövde boşluğu korunur. Duraklatılmış QA, üretim fiziğini 0,1/1 saniye sabit adımlarla ilerletebilir. Görseller: [uzak gölge](../artifacts/npc-shadow-far.png), [yakın gölge](../artifacts/npc-shadow-near.png), [takip/frenleme](../artifacts/npc-following-braking.png).
- [x] QA dışında normal ana uygulama: Performans → Classic Run → Subaru Motor 1 ile gerçek sürüş (282 m / 4 jeton) → duraklat → garaj. Garaj önizlemesi doğru çizildi; seçili Subaru/Motor 1 ve 304 altın korundu. Görsel: [gerçek yarış](../artifacts/npc-production-race.png).

Bu çalışma yereldir; GitHub/Vercel yayını yapılmadı. Fiziksel telefonlarda gölge maliyeti ayrıca ölçülmelidir.

## 2026-10-17: Boş yolda görünmeyen çarpışma incelemesi

- [x] Yeniden üretilen neden: modeller bir üst sınıra orantılı sığdırılırken çarpışma, görünür gövde yerine üst sınırın tamamını ve dışa doğru 0,2 birim payı kullanıyordu. Apex görünür uzunluğu 3,615425 iken eski oyuncu kutusu 5,5; kamyon görünür uzunluğu 5,406025 iken eski kutusu 8,3 idi. Merkezler 7 birim ayrıyken 2,489275 birim görünür boşluk olmasına rağmen eski sistem önde/arkada çarpışma sayıyordu. Yandaki SUV örneğinde 0,422766 birim boşluk da eski sistemde çarpışmaydı.
- [x] Görüntü boyutları korunarak çizim sınırları ve ölçülmüş çarpışma alanları ayrıldı. Altı oyuncu aracı yarış başında kilitlenen `runCar` kimliğine, dört trafik modeli kendi gövdesine göre kontrol edilir. Süpürülmüş çarpışma korunur; temas, tamamen geçme ve yakın geçiş aynı alanları ve 0,03 birim içe toleransı kullanır.
- [x] Gerçek GLB/glTF dosyalarının POSITION sınırları ve sahne dönüşümleriyle on modelin alanını bağımsız doğrulayan testler; önde/arkada boşluk, yan geçiş, gerçek temas, yarış aracı/seçili araç ayrımı ve 30/60/144 FPS hızlandırılmış geçiş/çarpışma regresyonları.
- [x] QA düzeneğinde dört sabit senaryo, eski/yeni karşılaştırması ve isteğe bağlı zemin sınırları. Fizik çalıştırılmaz ve kalıcı bakiye yazılmaz; gerçek yarış sahnesi çizilir. High gündüz öndeki/arkadaki kamyon ve yandaki SUV boşlukları CLEAR, gerçek örtüşme COLLISION verdi. Shader, sayfa ve WebGL bağlam hatası görülmedi. Görsel: [Kamyonla görünür boşluk](../artifacts/collision-truck-clearance.png).
- [x] Performance gece yan geçişi de CLEAR verdi; sayfa, shader ve WebGL bağlam hatası yoktu. Son doğrulama: **111 test başarılı, 17 üretim adaptörü testi atlandı**; lint ve üretim derlemesi (649 modül) başarılı. Gerçek temasın oyunu bitirmesi ve geçişin devam etmesi mağaza/ödül kuralları değiştirilmeden simülasyon testlerinde doğrulandı.
- [ ] Kullanıcının son yarışındaki kesin nesne/konum: o oturumun çarpışma kaydı yok; bulunan hata yeniden üretildi, geçmiş olayın tek nedeni olduğu kanıtlanamaz.

Yerel düzeltmedir; bu çalışma kapsamında GitHub/Vercel yayını yapılmadı.

## 2026-10-17: GitHub birleştirme kapsamı

Kullanıcının GitHub birleştirme isteği, araç biçimine uygun gölgeyi, seviyeye göre trafik artışını ve yeni mıknatıs/roket modellerini birlikte kapsar. Yerel kabul 89 başarılı test, 17 atlanan üretim adaptörü testi, lint ve 648 modüllük üretim derlemesidir. Birleştirme öncesi GitHub CI test, lint ve derlemeyi tekrar doğrular; mevcut Vercel bağlantısı `main` değişikliğinde yayın oluşturur. Aşağıdaki yerel uygulama notları önceki aşamaların kabul kayıtlarıdır.

## 2026-10-17: Üç boyutlu mıknatıs ve roket

- [x] Ortak para biçimli rozet ve koni yerine iki ayrı, özgün Three.js modeli: pahlanmış kırmızı/mavi at nalı mıknatıs, gümüş kutup uçları ve bağlantı vidaları; inci gövdeli, turuncu burun/kanatlı roket, bakır detaylar, camgöbeği pencere, motor ağzı ve hacimli egzoz.
- [x] Modeller kodla oluşturulur; yeni dış varlık, görsel üretimi veya harici lisans eklenmedi. Önceki Google Poly mıknatıs/roket dosyalarının atıfları korunur ve README'de tarihsel varlık olarak ayrılır.
- [x] Yarışın gerçek toplanabilir nesne çiziminde kullanılır. Hafif yön salınımı görünür yüzü korur; düşey salınım nesneye uygulanır, zemin işaretçisi yolda sabit kalır. Azaltılmış hareket tercihi salınımları kapatır. Ek gerçek ışık yoktur; oluşum, çarpışma, toplama ve etki süreleri değişmedi.
- [x] Ayrı QA düzeneğine **Pickup layout → Magnet + rocket** seçeneği eklendi. Yakın mıknatıs/roket x = −4,5/+4,5, z = −12; uzak çift z = −45; ortada jeton z = −25. Araç/kalite/ışık kontrolleri ve önceki gölge tanılaması korunur; nesne tür/adet/konumları görünür ölçümlerdedir. Kalıcı bakiye yazılmaz.
- [x] Son koşuda **89 test başarılı, 17 üretim adaptörü testi atlandı**; lint ve üretim derlemesi (648 modül) başarılı.
- [x] High ve Performance seçeneklerinde gündüz ve gece gerçek yarış bileşenleriyle 2 mıknatıs / 2 roket / 1 jeton gösterildi; shader, sayfa veya WebGL bağlam hatası yoktu. High gündüz/gece 31 shader programıyla kaldı; Performance 512×512 gölge haritası gözlendi. Görseller: [Performance gündüz](../artifacts/powerups-day.png), [High gece](../artifacts/powerups-night.png).
- [x] Geometri denetimi: mıknatıs 1.456 üçgen / 6 model çizimi; roket 3.680 üçgen / 9 model çizimi. Konumlar ve normaller sonlu; gölge geçişleri/zemin halkaları çizim sayılarına dahil değildir. Kaynaklar örnek başına önbelleğe alınır ve kaldırılırken serbest bırakılır.
- [ ] Fiziksel telefonlarda görünürlük ve uzun sürüş performansı.

Bu revizyon yereldir; bu çalışma kapsamında yayın yapılmadı. Önceki gölge/trafik değişiklikleri korunur; aşağıdaki test ve kabul sayıları ilgili önceki revizyonun tarihsel kaydıdır.

## 2026-10-17: Araç biçimine uygun yarış gölgesi ve seviye trafiği

- [x] Yarışta oyuncu ve trafik altındaki yuvarlak `ContactPatch` düzlemleri ve boşta alt aydınlatma kaldırıldı. Gölge, araç geometrisinden mevcut tek yönlü güneş/ay ışığıyla üretilir; ışık açısı ve oyuncunun şerit konumunu izler.
- [x] Bütün grafik seçeneklerinde PCF yumuşak gölge; Performance 512×512, High 1024×1024 harita. Oyuncuyu izleyen dar ortografik hacim ±8, near/far 1/80; model tabanı −0,025, asfalt −0,03 konumundadır. Ek yönlü ışık eklenmedi.
- [x] Önceki 29 m aralığından seviye başına yalnız 1,4 m azalan trafik oluşumu daha belirgin ilerlemeye dönüştürüldü. 1–8. seviye hedef aralıkları **29 / 22 / 17 / 13 / 10,5 / 9 / 8 / 7 m**; 8. seviyeden sonra sabit.
- [x] Güvenli yer bulunamazsa bütün oluşma aralığını atlamak yerine 1,5 m sonra yeniden denenir. Mevcut normal/nitro/roket hızlarında kaçış şeridi rezervasyonu, aynı şeritte en az 65 dünya birimi ayrım, sınırlı NPC hızları ve toplam 12 araç üst sınırı korunur.
- [x] Dört farklı başlangıç değeriyle 60 saniyelik deterministik simülasyon: seviye 1 **23**, seviye 3 **39**, seviye 5 **61–63** araç oluşumu; ortalama yaklaşan araç sayısı yaklaşık **2,0 / 3,6 / 5,5**. Seviye 8 **82–85** oluşum / yaklaşık **7,4** yaklaşan araç; seviye 80 yoğunluk sınırını korur. Ölçüm çarpışmayla bitmesin diye z > −20 bölgesine gelen araçlar çıkarılır ve toplanabilir nesneler kapatılır; bunlar gerçek sürüş FPS/bellek ölçümü değildir.
- [x] Dört yeni test: seviyeler arasında ölçülen artış ve her oluşumun güvenli yerleşimi, geç seviye yoğunluk sınırı, 30/60/144 FPS eşitliği, engel kalktıktan sonra yeniden oluşma. Toplam **89 test başarılı, 17 üretim adaptörü testi atlandı**; lint ve üretim derlemesi (646 modül) başarılı.
- [x] Tarayıcıdaki QA düzeneğinde gerçek yarış bileşenleri: Apex Performance gündüz (512 harita), Apex High gece/gün batımı (1024 harita), ışık yönü/gölge uzaması ve sol şeridi izleme kontrol edildi. Subaru High gündüzde virajın render istasyonu 350 / HUD 70 m konumunda, 80 oyuncu gölge üreten mesh ve 1024 haritayla gösterildi. Shader, sayfa ve WebGL bağlam hatası görülmedi. Görsel: [Performance gölgesi](../artifacts/physical-shadow-performance.png). Bu düzenek ayrı bir ana uygulama başlangıç testi değildir.
- [ ] Fiziksel telefonlarda gölge maliyeti, uzun sürüş dengesi, FPS ve bellek kabulü.
- [x] Normal ana uygulamada Performans → Yarışa başla → Classic Run onayı → Subaru ile gerçek sürüş → sonuç akışı tamamlandı (99 m, 1 jeton). Bu kontrol QA düzeneğinden ayrıdır. Performans karşılaştırma aracı da üretimle aynı yumuşak gölge seçeneğini kullanır.

Bu revizyon yereldir; bu çalışma kapsamında yayın yapılmadı. Önceki 85 testlik menü/model kabulü ve diğer kayıtlar aşağıda tarihsel kapsamlarıyla korunur.

## 2026-10-17: Sade ana menü ve yarış modu penceresi

- [x] Ana menüde iki birincil eylem: **Yarışa başla** ve **Garaj**; ana ekrandaki mod kartları kaldırıldı.
- [x] Başlangıç düğmesi ortalanmış yerel HTML `dialog` açar. Mevcut Classic Run / Double or Nothing görselleri, adları ve Türkçe kuralları pencerede korunur.
- [x] Mod seçimi pencere içinde geçicidir; yalnız pencerenin **Yarışa başla** onayı seçili modu yarış başlangıcına gönderir. Geri dön, kapat, Esc ve dışarı tıklama önceki modu değiştirmez.
- [x] Seçili radyo seçeneğine ilk odak, yön tuşuyla seçim, Tab ile pencere içinde odak dolaşımı, iptal sonrası başlangıç düğmesine dönüş ve pasif arka plan.
- [x] Tarayıcıda açma/seçme/iptal, Esc, dışarı tıklama, odak geri dönüşü ve garaj akışı doğrulandı. 320×700: pencere 286×516,4 px, üst konumu 91,8 px; 844×390: 660×347,3 px, üst konumu 21,55 px. Yatay taşma yok; yatay görünümde pencere içi kaydırma gerekmiyor.
- [x] Pencereden onaylanan Double or Nothing gerçek HUD'de **HEDEF: SEVİYE 5**, duraklatmada doğru mod adıyla gösterildi; menüye dönüp pencere açılınca Double or Nothing seçili kaldı. Classic Run seçilip onaylanan ikinci gerçek yarış, 87 m / 1 jeton sonunda Classic Run · SUBARU WRX STI sonuç ekranına ulaştı.
- [x] 85 test başarılı, 17 üretim adaptörü testi atlandı; son Tab ve yatay ekran düzenlemeleri sonrası lint ve üretim derlemesi başarılı. Radyo seçeneklerinin klavye kullanımı ve Tab sınır dolaşımı doğrulandı; 844×390 penceresinde clientHeight / scrollHeight 346 px, iç kaydırma yok.

Önceki çalışma ve kabul kayıtları aşağıda tarihsel kapsamlarıyla korunur.

## 2026-10-17: Yerel garaj, araç seçimi, ekipman ve HUD

### Revizyon: üç gerçekçi araç modeli

- [x] Kenney gövdeleri yerine Subaru WRX STI (900), BMW M3 E30 (2.400) ve Nissan Z Proto (4.800 altın) katalog adları, sınıfları ve Türkçe açıklamaları.
- [x] Eski `rally` / `street` / `formula` kimlikleri, schema 3, fiyatlar ve sürüş ayarları korunur; mevcut sahiplik, ekipman ve altına dokunulmaz.
- [x] Önceden alınmış üç aracı ve farklı yükseltmelerini aynı bakiye ile seçip yarışta kullanma regresyon testi eklendi; odaklı garaj paketi 22/22 başarılı.
- [x] Ana menü ve garaj ortak alt bilgisinde erişilebilir **Model katkıları** bağlantısı.
- [x] Üç bağımsız GLB toplam 11.270.428 bayt: Subaru 669.112 bayt / 42.128 üçgen / 80 primitive; BMW 9.952.100 / 52.728 / 30; Nissan 649.216 / 24.387 / 14. Dokular yerel dosyalara gömülüdür.
- [x] CC BY 4.0 kaynak/lisans/değişiklik ve SHA-256 kayıtları sabit kaynak sürümüyle eklendi. Özel çevrimdışı denetim geometriyi, Meshopt çözümlemesini, indisleri ve yerel kaynakları doğruladı; Khronos her modelde 0 hata / 0 uyarı verdi.
- [x] Yarışta ön yön -Z; garajda ön üç çeyrek açı, tek karelik 64 px yansıma haritası ve yalnız araç için temas gölgesi. Yerel farlar korunur. Kompakt motor (0,72), Subaru kanadı altında küçük arka nitro, BMW'de enine tek tüp ve Nissan'da arkaya eğimli tüpler için montajlar düzenlendi.
- [x] 85 test başarılı, 17 üretim testi atlandı; lint ve üretim derlemesi başarılı. Üç gerçekçi önizleme tarayıcıda hatasız gösterildi.
- [x] Masaüstü ve 320 px dar garaj kontrolü: belge/kaydırma genişliği 320 px, altı araç kartı iki sütunda (kart başına 121,6 px), uzun Subaru adı iki satıra sığar; örtüşme veya yatay taşma yok. Katkılar sayfası açıldı; üç yazar, özgün kaynak ve CC BY bağlantısı doğrulandı.
- [x] Mevcut ayrı `127.0.0.2` kaydı model değişiminden sonra Subaru seçimi, 4 altın, Yol tutuşu 1 / Nitro 1 ekipmanını korudu.
- [x] Yeni `127.0.0.3` kaydında Subaru alımı 1.500 → 600, motor yükseltme 600 → 300 altın; yenileme seçimi ve Motor 1'i korudu. Gerçek yarış HUD'si 112 oyun hızı / Motor 1 gösterdi. Tamamlanan 40 m yarış +4 altın verdi; bakiye 304 oldu. İkinci gerçek sürüş 76 m / 1 jeton / 253 puanda görüntülendi.
- [x] Kabul görselleri: [Nissan garajı](../artifacts/realistic-nissan-garage.png), [Subaru yarışta](../artifacts/realistic-subaru-race.png).
- [ ] Fiziksel telefon performansı, uzun sürüş dengesi ve tüm seviye montajlarının cihazda kabulü.

Önceki Kenney denemesi oyuncak görünümü nedeniyle bu revizyonla değiştirildi; modelleri, dönüştürme/denetim betikleri ve görselleri çalışma alanı dışında arşivlendi. O turun 84 testlik doğrulaması tarihsel kayıttır; yukarıdaki kabul yeni modeller içindir.

### Ek çalışma: anlaşılır Türkçe arayüz ve simge sistemi

- [x] Menü, garaj, HUD, duraklatma, sonuç, yükleme ve hata metinleri Türkçe; mod adları korunarak kurallar açıklandı.
- [x] Ortak `UIIcon` SVG seti, görünür etiketler ve erişilebilir düğme adları; mevcut mod/ekipman görselleri korundu.
- [x] Skor, jeton ve altın ayrımı; +100 GOLD yerine +100 PUAN · 1 JETON bildirimi; hız/nitro birimleri açıklandı.
- [x] Garajda sahiplik, aktif seçim, seviye, kazanım ve altın maliyeti; daha okunaklı yazılar ve dar ekran sarılması.
- [x] Açılabilir kontrol yardımı; kısa ekranda kaydırılabilen duraklatma penceresi; güncel Türkçe etiketlerden bağımsız tanılama seçicileri.
- [x] 320/390 px dar arayüz kontrolü; 320×700 ve 844×390 çerçevelerinde gerçek HUD/kontrol bileşenleriyle 42 başarılı sentetik kontrol, sıfır hata. Fiziksel telefon testi değildir.
- [x] 80 test başarılı, 17 üretim testi atlandı; lint ve üretim derlemesi başarılı. Terim ve simge rehberi: `docs/UI_GUIDE.md`.

### Tamamlandı: yarış modu sembolleri

- [x] Classic Run için sonsuz otoyol; Double or Nothing için çift ok ve kırık halka sembol tasarımları hazırlandı.
- [x] Kullanıcının alternatif araç onayıyla yerleşik OpenAI görüntü üretimi kullanıldı; iki şeffaf PNG `public/modes/` içine kaydedildi. İstemler ve kaynak bilgisi `generation-record.json` içindedir.
- [x] Ana menü kartlarında `/modes/classic-run.png` ve `/modes/double-or-nothing.png` gösterilir; yükleme başarısızsa mevcut ∞ / 2× simgeleri korunur.
- [x] 1280 px görünümde 56 px, 668 px dar görünümde 44 px boyutta iki görsel de yüklendi. Classic / Double or Nothing seçimi doğrulandı; yatay taşma yok. ESLint ve üretim build başarılı. Ekran görüntüsü: `artifacts/main-menu-mode-symbols.png`.

### Ek çalışma: referans düzeninde atölye garajı

- [x] Büyük araç önizlemesi, oklarla dönen araç listesi ve araç adı plakası.
- [x] Garaj için sıcak ışıklı endüstriyel 3D oda, kepenk, zemin, kolonlar ve atölye detayları; ana menü vitrini ayrı görünümünü korur.
- [x] Sağda açıklamalı sürüş hızı, boost, direksiyon ve nitro kapasitesi çubukları; altta kompakt ekipman görselleri/seviyeleri/altın düğmeleri.
- [x] İncelenen araç, sahiplik ve aktif seçim ayrımı; kilitli araçta satın alma ve yükseltme koşulları; Done ile ana menüye dönüş.
- [x] Masaüstü ve dar ekran yerleşimi, oklarla listenin başına dönüş, araç seçimi ve yetersiz bakiye durumu tarayıcıda kontrol edildi.
- [x] 80 test başarılı, 17 üretim testi atlandı; ESLint ve üretim build başarılı. Fiziksel telefon testi yapılmadı.

### Ek çalışma: ana menü, ayrı garaj ve ücretli araçlar

- [x] Start Game ve Garage düğmeleri, seçili araç vitrini ve yarış modu seçimiyle ayrı ana menü; ortak bakiye, ses ve grafik ayarları.
- [x] Döndürülebilir araç önizlemesi ve koleksiyon/atölye alanlarıyla ayrı, dar ekrana uyarlanan garaj.
- [x] Başlangıçta Sport sahipliği; GT 1.250 ve Apex 3.000 oyun altını. Tek sefer satın alma, otomatik seçim, yetersiz bakiye ve sahip olunan araç seçimi.
- [x] İncelenen araçla aktif aracın ayrılması; yükseltmeleri yalnız seçili ve sahip olunan araca uygulama.
- [x] Schema 3 sahiplik kaydı; önceki seçili/yükseltilmiş araçları, seviyeleri ve bakiyeyi koruyan geçiş.
- [x] Duraklatma ve sonuç ekranlarında Garage / Main Menu hedefleri.
- [x] 80 test geçti, 17 üretim testi atlandı; lint ve üretim build başarılı.
- [x] Masaüstü ve dar tarayıcı görünümü incelendi. Ayrı localhost kaydında GT satın almayla 1.500 → 250, Handling satın almayla 250 → 0 altın; yenilemede kayıt ve yarış HUD'sinde GT / ENG 0 / HND 1 / NOS 0 doğrulandı. Duraklatmadan ana menüye dönüldü, tarayıcı hata kaydı boştu. Kullanıcının mevcut Apex / 158 altın kaydı korundu; GT önizlemesinde satın alma ve yükseltme engeli doğrulandı. Görseller: `artifacts/main-menu.png`, `artifacts/garage-menu.png`.

### Ek çalışma: Higgsfield ekipman kartları, takılı parçalar ve altın

- [x] Higgsfield `gpt_image_2_5` ile üç 1024×1024 ekipman görseli; yerel `public/equipment/` dosyaları ve generation-record.json üretim kaydı.
- [x] Serbest seviye menüleri yerine sonraki seviyeyi altınla satın alan Upgrade düğmeleri, takılı seviye, kazanç önizlemesi, maksimum seviye ve yetersiz bakiye durumu.
- [x] 1.500 başlangıç altını, araç başına kademeli fiyatlar, eski v1 seviyelerini koruyan sürümlü kayıt, otomatik takma.
- [x] Yarış bitişinde coin başına 25 + her 10 metreye 1 altın; tekrarlanan callback/render ödülü çoğaltmaz. Sonuç ekranı kazancı ve toplam bakiyeyi gösterir.
- [x] Garajda ve yarışta seviyeye bağlı hafif intake, fren/jant/yan parça ve nitro tankı geometrisi. Kart resimleri gerçek 3D mesh değildir.
- [x] 73 test geçti, 17 üretim testi atlandı; ESLint ve üretim build başarılı. Testler bakiye düşümü, yetersiz altın, tavan seviye, kayıt geçişi ve tek seferlik yarış ödülünü kapsar.
- [x] Dar tarayıcı görünümünde üç yerel PNG yüklendi (naturalWidth 1024); Handling satın almada 1.500 → 1.250, Engine satın almada 1.250 → 150 altın ve maksimum/yetersiz bakiye düğmeleri doğrulandı. Yenileme seviyeyi/bakiyeyi korudu. Gerçek yarış 88 m/0 coin sonunda +8 altın, 158 toplam gösterdi; garaja aynı bakiye döndü. Apex arka güvertesindeki parçalar görsel kontrol sonrası yükseltildi. Fiziksel telefon kabulü yapılmadı.

Önceki ücretsiz seviye seçimi maddeleri aşağıda ilk garaj aşamasının kaydı olarak korunur.

- [x] Üç mevcut modeli oynanabilir araç seçeneği olarak bağla; garaj ve yarış aynı seçimi kullanır.
- [x] Araç başına Stock–Stage 3 motor, yol tutuşu ve nitro ayarı; build sheet üzerinde güncel değerler.
- [x] Seçimi ve parça seviyelerini `lumexia.garage.v1` yerel kaydında sakla; bozuk/engelli depolamayı güvenle ele al.
- [x] Yarış başında sabit build; yükseltmeleri hızlanma, direksiyon, nitro kapasitesi/yenilenmesi ve trafik boşluğu hesabına bağla.
- [x] HUD ve sonuç ekranına araç kimliği, HUD'ye parça seviyeleri ekle.
- [x] 66 test geçti, 17 eski üretim testi atlandı; ESLint ve üretim derlemesi başarılı. Büyük vendor paketi uyarısı sürüyor.
- [x] 600×668 dar tarayıcı görünümünde Apex yükseltmeleri, sayfa yenilemede kayıt, yarış/sonuç/garaja dönüş ve GT sürüşü kontrol edildi. GT 105, yükseltilmiş Apex 124 PACE gösterdi. Yeni HUD araç/parça bilgisi hız panelinin üzerine taşındı; garajda yatay taşma yok. Kontrol anında tarayıcı hata kaydı boştu. Fiziksel telefon testi değildir.
- [ ] Fiziksel telefonlarda uzun sürüş ve üç aracın denge/görsel kabulü.


## 2026-09-08: Zaman döngüsü ve değişken yol

- [x] Kullanıcının seçimi: 5 dakika gündüz, 45 saniye gün batımı, 3 dakika gece, 45 saniye gün doğumu; duraklatma/yeni yarış ile tutarlı döngü.
- [x] Gökyüzü, sis, ay/yıldız, güneş/ay ışığı, sokak lambaları, pencere ve araç farlarının birlikte yumuşak değişmesi.
- [x] Geniş S virajları: yol, bariyer, kaldırım, çevre, trafik, oyuncu, ödüller ve kamera aynı rota koordinatlarını kullanır.
- [x] 150 render metre kemerli tünel, beton girişler, toprak örtüsü ve instanced tavan armatürleri; tünel içinde gündüz de farlar açılır.
- [x] Eğrilmiş model sınırlarına göre görünürlük; tünel çevresinde ağaç/bina/direk çakışmalarını önleyen rota maskesi.
- [x] Döngü sınırları, geometrinin tekrar deformasyonu, rota sarımı, tünel geçişleri ve virajlı görünürlük testleri; 62 test geçti, 17 mock modu üretim entegrasyon testi atlandı. ESLint başarılı.
- [x] Son üretim derlemesi başarılı. 1280×720 masaüstü, 844×390 yatay ve 390×844 dikey görünümde gündüz, gün batımı, gece tüneli, gün doğumu ve gündüze dönüş incelendi; HUD aracı kapatmıyor. Ayrı tanılama sahnesinde hızlandırılmış altı tam zaman döngüsü ve tekrarlanan rota/tünel geçişleri sonrasında shader programları 31/31 sabit, 5 gerçek ışık ve 1 gölge kaynağı sabit; shader/sayfa/bağlam kaybı hatası 0. Bu masaüstü tarayıcı kontrolü, gerçek telefon performans veya çoklu dokunma kabulü değildir.

## 2026-09-07: Gece otoyolu

- [x] Gece yarışı varsayılan oldu: lacivert gökyüzü, sabit yıldızlar ve krater detaylı ay; sis ve çevre ışığı aynı gece paletini kullanır.
- [x] 36 sokak lambasının lensleri yanar; yol/kaldırım üzerinde yumuşak sıcak ışık alanları ve küçük lens haleleri iki instanced çizimde işlenir. Direk başına gerçek ışık veya gölge haritası eklenmedi.
- [x] Oyuncunun araç dönüşüne bağlı iki gerçek farı öndeki asfaltı ve trafiği aydınlatır. Trafik araçları ışıklı far yüzeyleri, yumuşak yol izleri ve mevcut kırmızı stopları kullanır; seçili bina pencereleri sıcak ışık verir.
- [x] Far ışık sayısı sabittir. Yeni trafik farı shader'ı geri sayımdan önce hazırlanır; uzak ışık izleri sis içinde alfa ile kaybolur. Performance gölgesizdir, High tek 1024 px ay gölge haritası kullanır.
- [x] Yerel üretim build, ESLint ve 46 test başarılı; mock modundaki 17 üretim adaptörü testi atlandı.
- [x] 1280×720 masaüstü, 844×390 yatay ve 390×844 dikey mobil görünüm kontrol edildi: ay/yıldızlar, lamba alanları ve farlar görünür; hız/nitro aracı kapatmıyor. Hazırlık, geri sayım, yarış, duraklatma ve tekrar açıldı; tarayıcı hata kaydı temiz.
- [x] Performance/High render tekrarlarında gerçek ışık sayısı değişmedi; shader programı artışı 0 (29/30 program). High son tanılamada bağlam kaybı veya shader hatası yok; iki far ve tek ay gölgesi korunur. GPU ortalama 33,10 ms, p95 50,47 ms; teslim edilen kareler ortalama 168,33 ms, p95 525,30 ms olduğundan akıcı FPS kabulü yapılmadı. Ayrıntılar [night-validation.json](night-validation.json).

Gece değişikliği, önceki mobil PR'ın merge edildiği `890ee579` üzerine ayrı `codex/night-highway` dalında hazırlanır. Aynı oturumdaki eski gündüz referansında da 1008 ms kare aralıkları görüldü; bu koşullar karşılaştırmalı FPS iddiası için yeterli değildir. Fiziksel telefon uzun sürüş/ısınma testi bu bilgisayardaki tarayıcı ölçümünden ayrıdır.

## 2026-09-07: Mobil göstergeler ve ekran üzerinden direksiyon

- [x] Hız göstergesi sol kenara, nitro göstergesi sağ kenara taşındı; dikey ve yatay mobilde aracın orta görüş alanı açıldı.
- [x] Küçük ok düğmeleri yerine ekranın sol/sağ yarısını kaplayan saydam dokunma alanları eklendi. Basılı tutma direksiyon verir; parmak orta çizgiyi geçince yön değişir, bırakılınca durur.
- [x] Nitro ikinci parmakla bağımsız çalışır; ses/duraklatma düğmeleri dokunma alanlarının üstündedir. İptal, odak kaybı, duraklatma ve boyut değişiminde girişler bırakılır.
- [x] Garaj ve geri sayım kontrol açıklamaları güncellendi. Altı sınır/ölçek regresyon testiyle toplam 46 test geçti; 17 üretim adaptörü testi mock modunda atlandı. Yerel lint ve üretim build başarılı.
- [x] 844×390 yatay ve 390×844 dikey tarayıcı görünümünde gerçek yarış sahnesi kontrol edildi; hız/nitro aracın üzerine gelmiyor.
- [x] Gerçek HUD/kontrol bileşenleri ve CSS ile tarayıcı kontrol ekranı: dikey ve yatay görünümde 42'şer kontrol başarılı; 1280×720 masaüstünde 26 başarılı, gizli dokunma alanlarına ait iki kontrol kapsam dışında. Native hit-test ve sentetik pointer/klavye olayları ayrı kaydedilir.

Tarayıcı boyutu ve sentetik dokunma testleri, fiziksel telefondaki çoklu dokunma veya tarayıcı kenar hareketlerinin doğrulandığı anlamına gelmez.

Tekrar kontrol: `npx vite build --config tools/mobile-controls-check.config.js --configLoader native`, ardından `npx vite preview --config tools/mobile-controls-check.config.js --configLoader native`. `http://127.0.0.1:5178/tools/mobile-controls-check.html` üzerindeki **Run checks** düğmesi gerçek CSS hit-test sonuçlarını ve durum günlüğünü gösterir. Bu ayrı tanılama giriş noktası normal oyun paketine dahil edilmez.

---

## 2026-09-07: Güncel ek çalışma — kare süreleri ve cephe kararlılığı

- [x] Yol kenarında yalnız görünür örnekleri `mesh.count` ile gönderme; tüm modelin sınır küresiyle görünürlük denetimi, tekrar kullanılan matrisler ve dinamik GPU tamponları.
- [x] Bina/ağaç görünürlüğünü bütün kalite seçeneklerinde ortak tutma: sis 260–600 m, çevre elemesi 620 m. Auto yalnız render çözünürlüğünü düşürür; yarış sırasında dünya yerleşimi değişmez.
- [x] Kamera derinlik aralığı 0,5–750 m; pencere, perde ve kapılarda üst üste binen yüzeyleri ayıran geometri; yaprak alfa eşiği ve MSAA kapsamı.
- [x] Yarış için daha düşük maliyetli oyuncu/Ferrari modelleri; bütün trafik modellerinin dokularını ve shader programlarını geri sayımdan önce hazırlama.
- [x] Duraklatılan yarışta sürekli çizimi, arka plandaki yarış ve garajda render döngüsünü durdurma.
- [x] Çam başına 17.584 → 12.184 üçgen; güncel 18 çevre prototipinde toplam 58.540 üçgen. Bunlar model ölçümleridir, FPS sonucu değildir.
- [x] Görünürlük sınırı ve dünya sarımı için yedi ek test. Yerel lint/build geçti; **40 test geçti, 17 üretim entegrasyon testi mock modunda atlandı**.
- [x] Tekrarlanabilir önce/sonra render ölçüm aracı ve [performans inceleme kaydı](PERFORMANCE_REVIEW.md).
- [x] Eşleşmiş High/DPR 1 render ölçümü: ortalama kare süresi 41,95 → 27,43 ms; p95 51,9 → 30,9 ms. Bu koşu 60 FPS'e ulaşmadı.
- [x] Normal tarayıcı akışı: yükleme → geri sayım → yarış → çarpışma/sonuç → tekrar; hazırlıkta duraklatma/geri sayımla devam. Sayfa JavaScript hatası görülmedi; yakın bina ve meşe görüntüsü kontrol edildi.
- [ ] Gerçek Android/iPhone üzerinde uzun sürüş ve ısınma kabulü.

Kaynak değişiklikleri yerel olarak doğrulandı. Bu kayıt yeni bir CI başarısı, canlı dağıtım veya 60 FPS garantisi değildir. Güncel ayrıntılar [kalite raporunda](QUALITY_REVIEW.md); aşağıdaki aynı tarihli bölümler önceki çalışmaların ölçümlerini korur.

---

## Önceki çalışma — 2026-09-07: Özgün yol kenarı varlıkları ve inceleme stüdyosu

**Tamamlanan kaynak çalışması:**

- [x] Beş özgün bina; metre ölçeği, pencere/çatı/balkon ayrıntıları ve koddan üretilen yüzey dokuları.
- [x] Meşe, kavak, çam ve çalı için ikişer çeşit; bir sokak lambası.
- [x] Çit, bank, elektrik dolabı ve 30 yapraklı ot kümesiyle toplam 18 prototip.
- [x] Yerleşik görsel üretim aracıyla iki yerel PNG; toplam 5.683.600 bayt, 1.254² gerçek çıktı, yaprakta alfa.
- [x] `RoadsideWorld` içinde ortak geometri, instancing, çevre yerleşimi, kaldırım ve zemin bağlantıları; eski yol kenarı GLTF yüklemelerinin yerine yeni çevre.
- [x] Ayrı 3D varlık stüdyosu ve özel makine yolları çıkarılmış tam doku istemleri.
- [x] [Varlık envanteri ve kabul sınırları](ROADSIDE_ASSETS.md).

**Yerel doğrulama:** Güncel lint ve build geçti; 33 test geçti, mock modundaki 17 üretim testi atlandı. Stüdyo DOM kaydında 18 model, sonlu koordinatlar ve toplam 68.152 prototip üçgeni doğrulandı; 390 × 844 mobil tarayıcı görünümünde yeni çevre kontrol edildi. Stüdyo ana/varlık yolları 200, bilinmeyen yol 404, yol aşımı 403 döndürdü. Bu yerel kayıt yeni bir GitHub Actions/CI başarısı değildir. Aşağıdaki önceki oyuncu modeli ölçümleri kendi kapsamlarıyla korunur.

**Kalan kabul:** PR kontrolleri; gerçek Android/iPhone FPS, ısınma ve uzun sürüş ölçümleri. Kaynak değişiklikleri aynı PR #1 içinde yayımlanmak üzere hazırlanmıştır; bu kayıt canlıya dağıtım onayı değildir.

---

## Önceki çalışma — 2026-09-07: Geliştirme sürümünde oynanış ve görsel yenileme

**Güncel kapsam:** Bu depo `DEV_MODE=true` ile ücretsiz, yerel antrenman oyunudur. Cüzdan, fiyat ve backend adaptörleri mock durumundadır. Yarış kredi tüketmez, sunucu skoru göndermez ve ödül ödemez. Önceki kayıtlardaki üretim ve dağıtım iddiaları ait oldukları tarihin geçmiş kaydıdır; mevcut geliştirme sürümünün doğrulanmış özelliği değildir.

**Tamamlanan çalışma:**

- [x] Sabit 120 Hz simülasyon; yumuşak direksiyon, nitro ve hareket boyunca çarpışma kontrolü.
- [x] Kaçış boşluğunu değerlendiren trafik, sinyalli şerit değişimi ve araç başına tek yakın-geçiş ödülü.
- [x] Duraklatma, sekme/odak kaybında giriş bırakma ve çoklu dokunma kontrolü.
- [x] Yeni 3D garaj, yarış HUD'si, duraklatma ve sonuç ekranı; mod başına yerel rekorlar.
- [x] Kamera, ışık, çevre, ses ve grafik seçenekleri; yükleme ve sahne hatası geri dönüşleri.
- [x] `sport_car_compact.glb`: 237.482 üçgen korunarak model dosyasında %30,39 azalma; yerel Draco decoder ve lisansı.
- [x] Ayrı oyun, sahne, HUD ve kontrol bileşenleri; saf oynanış kuralları ve geliştirme adaptörü testleri.
- [x] README, kalite raporu ve güncel çalışma modu belgelerinin eşitlenmesi.

**Doğrulama:** 33 test geçti, 17 üretim cüzdan/fiyat testi mock geliştirme modunda atlandı. Kısıtlı Windows ortamında testler `npm test -- --configLoader runner`, üretim paketi `npm run build -- --configLoader native` ile doğrulandı. Normal ortam komutları ve isteğe bağlı `npm ci --ignore-scripts` kurulumu [kalite raporunda](QUALITY_REVIEW.md) açıklanır. Bu sonuç canlı servis, cihaz FPS veya üretim dağıtım doğrulaması değildir.

**Kalan kabul:** Windows, Android ve iPhone üzerinde uzun sürüş; yavaş bağlantı ve tekrar başlatma ölçümleri; optimize modelin cihazlarda görsel kabulü. Üretim servisleri ancak ayrı entegrasyon doğrulamasından sonra ele alınmalı. Mevcut ayrıntılar: [QUALITY_REVIEW.md](QUALITY_REVIEW.md).

---

## Tarihsel kayıtlar

Aşağıdaki kayıtlar korunmuştur. Özellikle “prod”, “operasyonel” ve “canlı” ifadeleri o tarihlerdeki çalışmaları anlatır; bugünkü `Lumexia_Dev_Game` antrenman sürümünün durum bildirimi değildir.

## 2026-05-03: Sprint 7-mini KAPALI — manual-payout pipeline operational (3 PR)

**Bağlam:** 2026-05-02'de Sprint 7 (tam otomatik transfer) askıya alınmıştı. Aynı gün ödeme süreci tartışıldı; kullanıcı "kazananlar history tablosunda kayıt edilsin + manuel copy/paste ile transfer edilsin" yaklaşımını seçti. Mevcut `reward_pool_distribution` tablosu zaten cycle bazlı per-wallet ödülü tutuyordu (Sprint 1.7b sonrası USD cinsinden); eksik olan tek şey **paid_at/paid_tx_hash idempotency tracking** + **multi-currency (SOL+TOKABU) eşdeğer kayıt**. Sprint 7 bu kapsamda **mini** olarak yeniden çerçevelendi.

### PR #106 (squash merge `6a6ab97`) — Schema migration

**Migration:** `supabase/migrations/20260503100000_reward_payment_tracking.sql`

`reward_pool_distribution` tablosuna 7 yeni kolon:

| Kolon | Filled by |
|-------|-----------|
| `reward_amount_sol` | Edge Function (cycle-end converted) |
| `reward_amount_tokabu` | Edge Function (cycle-end converted) |
| `sol_price_usd` | Edge Function (audit snapshot) |
| `tokabu_price_usd` | Edge Function (audit snapshot) |
| `paid_at` | **Ops team manual SQL** |
| `paid_tx_hash` | **Ops team manual SQL** |
| `paid_in_token` | **Ops team manual SQL** ('SOL' / 'TOKABU' CHECK) |

Ek olarak:
- Partial index `idx_reward_unpaid (reward_date, wallet_id) WHERE paid_at IS NULL` → "this cycle's unpaid winners" sorgusu hızlanır
- `DELETE FROM reward_pool_distribution WHERE reward_date < '2026-05-01'` → 4 eski BNB-dönemi test satırı temizlendi (kullanıcı onayı 2026-05-03)
- COMMENT ON TABLE/COLUMN — yeni semantik

**Risk:** DÜŞÜK (additive + bounded delete). CI auto-apply via `deploy-migrations.yml`.

### PR #107 (squash merge `0fcd08a`) — Edge Function multi-currency + price fallback

**`supabase/functions/calculate-daily-rewards/index.ts`** yeniden yazıldı (+235/-35 net). Yeni özellikler:

**Price discovery (3-tier SOL, 2-tier+DB TOKABU):**

| Asset | Tier 1 | Tier 2 | Tier 3 | NULL fallback |
|-------|--------|--------|--------|---------------|
| **SOL/USD** | DexScreener (highest-liquidity pair) | Jupiter v6 | CoinGecko `/simple/price` | NULL |
| **TOKABU/USD** | DexScreener | Jupiter v6 | **transactions table per-wallet** (kullanıcı önerisi) | NULL |

**TOKABU DB fallback:** Her top-100 wallet için `transactions` tablosunda en son başarılı tx → `amount/token_amount` implicit fiyat. Wallet'ın kendi geçmişi yoksa global son tx fallback. Hâlâ yoksa NULL (USD reward yine de yazılır, ekip manuel UPDATE).

**Defensive design:**
- Per-source 8s `AbortController` timeout
- Liquidity-weighted DexScreener pair selection (manipülasyon koruması)
- `transactions.user_id` FK'sini `users.wallet_address`'e batch JOIN ile çözer
- Herhangi bir source fail → o currency NULL, USD canonical her zaman yazılır

**INSERT şekli:** Mevcut USD + 4 yeni currency/price kolonu (NULL toleranslı).

**Response observability:** 200 body'de `prices: { sol_usd, tokabu_usd_api, tokabu_used_db_fallback, tokabu_db_fallback_hits, tokabu_db_global_fallback }` — cron run health monitoring için.

**Risk:** ORTA (yeni external dependency CoinGecko + DB fallback path). 2026-05-05 00:00 UTC ilk gerçek çalışma.

### PR #108 (squash merge `2f1100a`) — Manual payout runbook

**Yeni dosya:** `docs/RUNBOOKS/manual-payout.md` (382 satır, 10 bölüm + troubleshooting):

1. Prerequisites + cycle schedule reference
2. Edge Function ran verification (logs + recovery `curl`)
3. Pull unpaid winners (SQL + CSV export)
4. Choose payout token (TOKABU vs SOL trade-offs)
5. Transfer rewards (Phantom batch UI + Node.js CLI script template `@solana/web3.js` + `@solana/spl-token`)
6. Mark winners as paid (single-row + batch CTE templates)
7. Verify nothing left behind
8. Audit log (Solscan link generator)
9. Troubleshooting (wrong amount, UPDATE didn't match, fallback price spread, re-run wiping paid_at)
10. Schema reference

**Risk:** SIFIR — markdown only.

### Sprint 7-mini durumu — KAPALI

| PR | Commit | İçerik |
|----|--------|--------|
| #106 | `6a6ab97` | Schema migration |
| #107 | `0fcd08a` | Edge Function 3-tier fallback + multi-currency INSERT |
| #108 | `2f1100a` | Manual payout runbook |

**Sonuç:** Cycle reward payout pipeline operasyonel. Her cycle sonu (2026-05-05 başlayarak):
1. `calculate-daily-rewards` USD + SOL + TOKABU yazıyor
2. Ops team `docs/RUNBOOKS/manual-payout.md`'ı takip ediyor
3. Solscan TX hash + paid_in_token + paid_at audit izi tutuluyor

**Sprint 7 (tam otomatik transfer) hâlâ ASKIDA** — treasury Vault, distribute-rewards Edge Function, retry queue, monitoring webhook. Memory: `project_payment_process_pending.md`.

**Açık aksiyon (kullanıcı):**
- 2026-05-05 00:00 UTC — Cycle 2 sonu ilk gerçek multi-currency Edge Function çalışmasını doğrula (Dashboard logs + SQL)

---

## 2026-05-02: Sprint 5/7 status reset + Cycle Ranking UI fix (Landing PR #18)

**Bağlam:** Sprint 6 PR 6.5 sonrası landing leaderboard UI'nın prod `calculate-daily-rewards` Edge Function ile uyumsuz olduğu fark edildi. Aynı oturumda Sprint 5 ve Sprint 7 statülerine de karar verildi.

### Sprint 5 (E2E test mimarisi) — İPTAL (kullanıcı kararı 2026-05-02)

E2E test sprint'i şu aşamada başlatılmayacak. `project_test_sprint_plan.md` memory'sinde detaylı plan referans olarak korunuyor; kullanıcı yeniden açmak istediğinde plan elimde.

### Sprint 7 (transfer otomasyonu) — ASKIDA (kullanıcı kararı 2026-05-02)

Reward distribution otomasyonu, treasury wallet, Vault private key, `distribute-rewards` Edge Function — hiçbiri başlatılmıyor. Memory: `project_payment_process_pending.md` (askıdaki iş kalemleri + mevcut durum kayıtlı). Açık aksiyon: kullanıcı "ödeme süreci"ni netleştirdiğinde Sprint 7 detaylı plan açılır.

### PR 6.3 (export-reward-payload Edge Function) — İPTAL

Gereksiz çıktı: `calculate-daily-rewards` zaten her cycle sonu `reward_pool_distribution` tablosuna per-wallet ödülü USD cinsinden yazıyor (idempotent DELETE/INSERT). Ekip ihtiyaç duyarsa Dashboard SQL ile çekebilir; ayrı Edge Function gerekmez.

### Landing PR #18 — Cycle Ranking UI fix (squash merge `b0f03f7`)

`leaderboard-section.tsx` prod Edge Function ile birebir hizalandı. 3 düzeltme:

| Sorun | Eski | Yeni |
|-------|------|------|
| **Window** | `today T00:00 → T23:59` (24h) | 48h cycle window (anchor 2026-05-01, even-day offset) — Edge Function ile aynı |
| **Bonus formula** | `gamesPlayed / 100` (1 game = +1%, hatalı) | `gamesPlayed >= 2 ? gamesPlayed : 0` (1 game = +0%, 2 = +2%, 3 = +3%) — Edge Function ile aynı |
| **Reward kolonu** | "X.XXXX LMX" (sadece) | Ana satır "X.XX LMX" + alt satır "≈ Y.YYYY SOL" (canlı `/api/ticker` CoinGecko 5dk cache) |

İlk fetch + realtime refetch path'i aynı düzeltildi. `+%` boost badge ve best_score line-through gösterimi `games_played >= 2` koşuluna gated. Desktop + mobile her ikisi.

**Toplam:** +77 / -14 satır, tek dosya. Build ✓, admin override ile squash merge.

**Risk:** ORTA-DÜŞÜK — UI-only client-side compute, DB / Edge Function / realtime subscription dokunulmadı.

**Açık aksiyon (kullanıcı):** PR #18'i prod'da gerçek wallet'la test et — 1 oyunlu racer'da `+%` badge yok mu, 2 oyunluda `+2%` boost var mı, reward kolonunda "LMX / SOL" stack render düzgün mü.

**v0.app uyarısı:** `components/leaderboard-section.tsx`'e v0.app prompt'unda dokunma — yoksa bu fix ezilir.

---

## 2026-05-02: Sprint 6 PR 6.5 - Landing 48h cycle copy + Cycle Ranking section reorder

**Bağlam:** Sprint 6 PR 6.1 (48h cycle backend, racing repo PR #102) prod'a indikten sonra landing repo (`v0-lumexia-landing-page-V0`) UI'sının da 48h cycle yansıtması gerekiyordu. Önceki chat'te (2026-05-01) landing repo `claude/landing-cycle-text-cleanup` branch'inde Pool Value + Pool Reset hero panelleri eklendi, app/page.tsx LeaderboardSection üst seviyeye taşındı, features-grid metinleri güncellendi — ancak commit edilmeden chat resim limiti dolduğu için sonlandırıldı. 2026-05-02 chat'inde devam edildi.

**Bu chat'te yapılan değişiklikler:**

1. **Türkçe → İngilizce (`48a2b32`):** dashboard-hero.tsx'teki "Sonraki Dağıtıma Kalan Süre" → "Time until next distribution".
2. **İlk push (`48a2b32`):** 3 dosya, +211/-77 satır — Pool panels + section reorder + features metinleri commit edildi, PR #17 açıldı.
3. **Hero kompaktlama (`9e9db83`):** Kullanıcı 1. resim referansı verdi (lumexia.net canlı tasarımı); Pool panellerinin boyutu küçültüldü (min-h 760/600 → 560/440, icon/font/padding daraltıldı).
4. **Pool panel revert (`89dc0d7`):** Kullanıcı kararı 2026-05-02: Pool Value + Pool Reset panelleri **tamamen kaldırıldı** (racing-car artwork'u kapatıyordu). Hero baseline (origin/main) yapısına döndü, sadece "DAILY RANKING" → "CYCLE RANKING" buton metni korundu.

**Final PR #17 (squash merge `74ec528`, admin override):**

| Dosya | Değişiklik |
|-------|-----------|
| `app/page.tsx` | LeaderboardSection üstte, TransactionsPanel altta (4 satır) |
| `components/dashboard-hero.tsx` | "DAILY RANKING" → "CYCLE RANKING" (mobile + desktop, 4 satır) |
| `components/features-grid.tsx` | "Daily Reward Distribution" → "Cycle Reward Distribution" + 48h cycle copy (6 satır) |

**Toplam:** +8 / -6 satır. Pool panel kodu commit history'de duruyor (`48a2b32` ↔ `9e9db83`), ileride başka PR'da geri eklenebilir.

**Açık aksiyon (kullanıcı):** v0.app prompt'unda landing 3 dosyaya dokunma (memory: `feedback_v0_sync_risk.md`).

**Risk:** DÜŞÜK — sadece 8/6 satır, hero baseline yapısı korundu, layout/stil değişikliği yok.

**PR 6.4 (Racing UI 48h metinleri) gereksiz çıktı:** Racing repo'sunda kullanıcıya görünen "Daily/today" zaman metinleri yok (PR 6.1'de legal agreement zaten "48-hour cycle" yapılmıştı; leaderboard görüntüleme zaten landing'de). PR 6.4 yol haritasından kapatıldı.

---

## 2026-05-01: Sprint 4.5 follow-up - Anti-cheat coin density relax (PR #103)

**Sorun:** Sprint 2.2a'da kurulan submit-score Edge Function anti-cheat kuralı `coins <= floor(distance / 50)` şeklinde idi — yani 50m'de bir coin maks. Gerçek oyuncular bu eşiği geçince score `score_rejected` ile reddediliyordu.

**Çözüm:** `coins <= floor(distance / 10)` — 10m'de bir coin (5x daha gevşek). Hâlâ açıkça abuse'leri yakalar (örn. 100m'de 50 coin kabul edilmez), ama meşru gameplay için yeterli.

**Etki:** Kullanıcı prod'da test etti, sorun yok ✓ (2026-05-02 doğrulaması).

**Risk:** DÜŞÜK — sadece eşik değişikliği, validate logic aynı.

---

## 2026-05-01: Sprint 6 PR 6.1 - 48 saat cycle reset (backend + UI legal)

**Bağlam:** Kullanıcı 7-maddelik notepad'inden 4. madde: "Oyun reset süresi 48 saat olucak". Mevcut sistem her gece 00:00 UTC'de daily archive + reward calc çalıştırıyordu (24h cycle). Kullanıcı bunu 48h yapmak istedi.

**Tasarım kararları:**
- **Anchor:** `2026-05-01` (deploy günü). Tüm cycle'lar buradan even-day farkıyla başlar.
- **Cycle hesabı:** `cycle_start(D) = D - ((D - 2026-05-01) % 2)`. Her tarih için içinde bulunduğu cycle'ın başlangıç günü.
- **Schema migration YOK:** `daily_leaderboard.play_date` kolonu aynı kalır, sadece içeriği "today" yerine "cycle_start" olur. UNIQUE (wallet_address, play_date) → 1 wallet × 1 cycle = 1 satır.
- **Cron schedule değişmez:** `0 0 * * *` (daily). Fonksiyonlar self-skip eder. `*/2` cron'un ay-boundary problemi (Mayıs 31 + Haziran 1 = 24h gap) bertaraf.
- **Race condition fix:** `calculate-daily-rewards` Edge Function `daily_leaderboard` boş bulursa `daily_leaderboard_history` fallback yapar. Archive cron'u (jobid=1) ile calc cron'u (jobid=3) ikisi de 00:00'da fire ettiği için sırada belirsizlik vardı; bu fallback timing'e bağımlılığı bitirir.

**Migration `20260501160000_cycle_48h.sql`:**
- `update_daily_leaderboard()` trigger: `today := CURRENT_DATE` → `cycle_start := CURRENT_DATE - ((CURRENT_DATE - DATE '2026-05-01')::int % 2)`. Her score INSERT'te play_date olarak cycle_start yazılır. Top 100 cleanup `play_date = cycle_start` üzerinde çalışır (önceki cycle rows'una dokunmaz).
- `archive_daily_leaderboard()`: tüm rows yerine `play_date < current_cycle_start` rows'u archive. Daily çalışsa bile sadece bitmiş cycle'ı temizler. ON CONFLICT DO NOTHING idempotent.

**Edge Function `calculate-daily-rewards/index.ts`:**
- Cycle-end day kontrolü: `daysSinceAnchor > 0 && daysSinceAnchor % 2 === 0`. Değilse 200 + skip mesajı (anchor günü = day 0 da skip).
- "Today" filtresi → previous cycle window: `gte(prevCycleStart) lt(cycleStart)` (48h aralık).
- `daily_leaderboard` query'sine `eq('play_date', prevCycleStartIso)` eklendi. Boş dönerse `daily_leaderboard_history` fallback.
- `reward_pool_distribution.reward_date` artık cycle_start (yarın değil, cycle'ın başladığı gün).

**UI metin değişikliği (RealLauncherUI.jsx legal agreement):**
- "Reward Pool for the daily cycle" → "Reward Pool for the 48-hour cycle"
- "distributed daily to the top 100" → "distributed every 48 hours to the top 100"
- "end of the daily cycle" → "end of the 48-hour cycle"

**Risk: ORTA-YÜKSEK:**
- Trigger fonksiyon değişiyor (her score INSERT'inde çalışan kod yolu)
- Archive fonksiyon değişiyor (daily çalışan)
- Edge Function logic tamamen yeniden yazıldı
- Mitigasyon: idempotent migration (CREATE OR REPLACE), schema unchanged, geriye dönük data etkilenmez (sadece ileri write semantiği), history fallback timing race'ine karşı koruma, cycle-end skip mantığı non-cycle days'te side-effect yok

**Bu PR'da YOK (sonraki PR'lar):**
- Landing repo: pool USD + SOL ikili display, 48h timer, FAQ + structured-data updates → ayrı PR (Sprint 6 PR 6.5, landing repo'da açılacak)
- `daily_leaderboard` ve `reward_pool_distribution` tablo isimleri rename edilmedi — schema migration + landing types regen + tüm referanslar değişir, gereksiz risk. Mantık 48h, isim "daily" kalır (pratik misnomer).

**Verification stratejisi (post-deploy):**
- Migration apply → daily_leaderboard'a manuel score insert → play_date = 2026-05-01 mi kontrol
- `SELECT archive_daily_leaderboard()` manuel → "No expired cycles to archive (intra-cycle day)" döner mi
- `calculate-daily-rewards` curl → `daysSinceAnchor=0` için "Not a cycle-end day" skip döner mi
- Yarın (2026-05-02): aynı testler, hâlâ Cycle 1 içinde olmalı
- 2026-05-03 00:00: cron tetikler, archive expired Cycle 1 rows'unu süpürür, calc Cycle 1 için reward hesaplar

---

## 2026-05-01: Sprint 4.5 - Payment self-healing (kritik bug fix + auto-reconciliation)

**Bağlam:** Kullanıcı prod'da "Transaction is not a TOKABU token transfer" hatası bildirdi. Kök sebep: `verify-payment` Edge Function'ın varsayılan fallback değerleri eski OILTOWN token'ı (mint `Aakms...pump`, symbol `OILTOWN`). Supabase Secrets gerçek değerleri set ediyordu ama eğer secret yanlış/eksik kalırsa kullanıcılar TOKABU gönderip credit alamadan kalır (sessiz veri kaybı).

Kullanıcı talebi: "TOKABU gitmiş ama credit almamış" senaryosuna **otomatik ve kalıcı** çözüm.

**1. `verify-payment` hardening:**
- Fallback değerleri OILTOWN → TOKABU (mint `H8xQ...pump`, symbol `TOKABU`). Secret bozulsa dahi doğru token için doğrulama yapar.
- `isTokenTransfer = false` dalına detaylı `console.warn` (configured mint + receiver) — gelecek bug teşhisi için.

**2. Yeni: `reconcile-payments` Edge Function:**
- Receiver cüzdanın (`T6Ekv...mGg`) son `SIGNATURE_LIMIT=100` Solana TX'ini Helius RPC üzerinden scan eder.
- Her TOKABU transfer için: DB'de `transactions.transaction_hash` UNIQUE constraint ile idempotent kontrol → yoksa validate et (sender bul, fiyat çek, paket eşleştir, user auto-create), credit ekle.
- Edge case'ler (`unknown_user` artık olmaz çünkü auto-create var; `amount_mismatch`, `price_unavailable`, `no_sender_found`) `unverified_payments` tablosuna log'lanır → admin manuel inceler.
- `dryRun: true` flag'i ile DB'ye yazmadan sadece log'a "ne yapardı" yazar — ilk deploy sonrası test için.
- Auth: sadece `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` ile çağrılabilir (cron + admin curl).
- Tunables: `SIGNATURE_LIMIT=100`, `SCAN_WINDOW_DAYS=30`, `PRICE_TOLERANCE=0.07`, `PACKAGE_USD=[1,5,10]`.

**3. Yeni migration `20260501120000_unverified_payments.sql`:**
- `unverified_payments` tablosu: `transaction_hash UNIQUE`, sender/receiver/mint/amount, `reason`, `resolved` boolean + `resolved_tx_id` admin tracking için.
- 2 index: sender_wallet, partial unresolved.
- RLS enabled, no policies → service_role only (forensic erişim Dashboard üzerinden).

**Self-healing akış:**
```
[Kullanıcı TOKABU gönderir]
   ↓
[verify-payment çalışır] ──başarılı──> credit verilir
   │
   └──başarısız──> [reconcile-payments cron her 15 dk]
                     ↓
                   [orphan TX tespit] ──valid──> credit verilir + user auto-create
                                       └──invalid──> unverified_payments → admin
```

**Risk: ORTA** — yeni Edge Function + tablo + Helius RPC dependency, ancak:
- DRY_RUN flag ile ilk live test güvenli
- Idempotent (UNIQUE constraint) — yanlışlıkla çift credit imkansız
- 7% paket eşleşme tolerance — sahte/yanlış miktar TX'leri unverified_payments'a düşer
- Sender/receiver/mint validation — yanlış token sessizce kabul edilmez

**Post-merge plan:**
1. CI deploy: Edge Function + migration otomatik prod'a iner.
2. `PAYMENT_TOKEN_MINT`, `TOKEN_SYMBOL`, `TOKEN_DECIMALS`, `PAYMENT_RECEIVER_ADDRESS` secret'ları zaten set edildi (kullanıcı bu PR öncesi yaptı).
3. Manuel `dryRun: true` curl → log'larda "newlyCredited" sayısı kontrol edilir.
4. Tatmin olunca `dryRun: false` ile gerçek backfill (geçmiş 30 gün orphan TX'leri varsa otomatik credit edilir).
5. pg_cron her 15 dk çağırması Dashboard SQL Editor üzerinden enable edilir (PR description'da SQL var).

**CI gate:** `npm test` 20/20 ✓, `npm run build` ✓, `npm run lint` ✓.

---

## 2026-05-01: Sprint 4.3 - Dokümantasyon temizliği

Sprint 0-4 boyunca her PR'da yaptığımız docs sync sayesinde docs çoğunlukla güncel kaldı. Sprint 4.3 küçük cilalama:

**`README.md`** — Vite template default'undan Lumexia'ya özelleştirildi:
- Proje özeti, tech stack
- `npm install / dev / test / build / lint / preview` komutları
- `.env.local` örneği + INTEGRATION.md referansı
- Docs index (PROJECT_DOCS, PLAN, TASK, INTEGRATION, CLAUDE.md)
- Üç CI workflow tablosu

**`PROJECT_DOCS.md` (v6 → v7):**
- "Genel Bakis" altına Sprint 0-4 altyapı özeti eklendi (branch protection, workflow'lar, Edge Function sayısı, RLS durumu, test sayısı, Landing repo TS senkronu)
- Landing repo + INTEGRATION.md referansı
- Supabase project ID açıkça belirtildi

**`PLAN.md`** — versiyon ve durum güncellemesi (Sprint 4 tamamlandı işareti).

**Risk:** SIFIR — sadece dokümantasyon. Sprint 4 (kod kalitesi) burada kapanır; sıradaki büyük adım Sprint 5 (E2E test mimarisi).

---

## 2026-05-01: Sprint 4.2 - Test kapsamı + plan iptalleri

**Yeni dosya:** `src/utils/jupiterPrice.test.js` — 11 test:

- **formatPrice** (4 test): 4 fiyat aralığında format kontrolü (≥1, [0.01,1), [0.0001,0.01), <0.0001)
- **getTokenPrice** (5 test): DexScreener happy path (highest-liquidity pair), Jupiter fallback (boş pairs + DexScreener throw), her iki kaynak fail throw, cache hit
- **calculateTokenAmount** (2 test): usdAmount/price hesabı + sıfır price throw
- **getTokenPriceWithRetry** (1 test): first-attempt success

**Test sayısı:** 8 → 19. RealLauncherUI'nin kredi satın alma akışında kullanılan fiyat hesabı kanıt altında.

**Plan iptalleri (kullanıcı kararı 2026-05-01):**
- ❌ App.jsx 2434 satır bölme — iptal
- ❌ RealLauncherUI 1642 satır bölme — iptal

Sebep: çalışan kod, regression riski yüksek, marjinal okunabilirlik kazancı. Memory'de `feedback_no_large_file_refactor.md` ile kalıcılaştırıldı.

**Sprint 4 yeni kapsamı:**
- 4.1 ESLint + CI lint job ✅ (PR #96)
- 4.2 Test kapsamı + plan iptalleri (bu PR)
- 4.3 (yeni numara) Dokümantasyon temizliği

**Risk:** ÇOK DÜŞÜK — yalnızca yeni test dosyası + docs/PLAN güncellemesi. Mevcut kod hiç dokunulmaz.

---

## 2026-05-01: Sprint 4.1 - ESLint config genişletme + CI lint job

**Bağlam düzeltmesi:** Sprint 0.5 keşfinde Explore agent yanlışlıkla "eslint.config.js YOK" demişti. Aslında dosya **vardı ve çalışıyordu** (commit `ae55434` "11 ESLint hatası temizlendi" iş bunu kullanıyordu). Sprint 0.2'de CI gate'e lint dahil edilmemesi sadece konservatif bir tercihti.

**Bu PR'da yapılan:**

**`eslint.config.js`** ignore listesi genişletildi:
- Eski: `['dist']` (sadece)
- Yeni: `['dist', 'node_modules', '.claude', '.netlify', 'supabase/functions']`
- `supabase/functions` Deno + TS, ayrı toolchain — bunu ignore etmek lint'in gereksiz Deno hataları üretmesini engeller
- `.claude` Claude Code metadata, lint dışı
- `.netlify` deploy artifacts

**CI workflow:** `.github/workflows/ci.yml`'a `lint` job eklendi
- `continue-on-error: true` ile başlatıldı (ilk rollout için soft-fail)
- 1-2 PR sonra `continue-on-error: false` ile required check yapılır

**Etki:** Sprint 4 sonrası refactor'larda eslint hatalı kod yakalar. App.jsx ve RealLauncherUI bölme öncesi guard kurulur.

**Risk:** DÜŞÜK — config genişletme ve soft-fail job. Mevcut kod etkilenmez.

---

## 2026-05-01: Sprint 3 - Otonom Supabase bağlantısı (3 PR)

Landing repo'daki Supabase entegrasyonu sertleştirildi + cross-repo entegrasyon dokümante edildi.

**3a — Typed Supabase client + canonical env names (landing PR #14):**
- `lib/database.types.ts` (yeni, auto-generated via Supabase MCP) — 9 tablo + 2 view + 7 fonksiyon tipleri
- `lib/supabase.ts` — `createBrowserClient<Database>` ile type-safe; legacy `NEXT_PUBLIC_LEADERBOARD_SUPABASE_*` fallback'ı kaldırıldı; canonical pair: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 5 tip alias: DailyLeaderboardEntry, Transaction, Score, User, RewardPoolDistribution
- Bonus keşif: `alltime_leaderboard` ve `daily_team_scores` view'ları (PROJECT_DOCS'ta yoktu)

**3b — Realtime hardening (landing PR #15):**
- `lib/pool-context.tsx` event `*` → `INSERT` (scores write-once); 1sn debounce
- `components/transactions-panel.tsx` 1sn debounce eklendi (event zaten INSERT idi, Sprint 1.6'dan)
- Etki: burst INSERT senaryolarında (verify-payment retry, anti-cheat reject) gereksiz refetch'ler tek çağrıda toplanır

**3 wrap-up — Cross-repo integration doc (racing PR — bu PR):**
- `docs/INTEGRATION.md` (yeni) — iki repo'nun Supabase noktasında nasıl buluştuğunu özetler:
  - Tablo bazlı r/w sorumlulukları
  - Edge Function caller'ları + auth modu
  - Env var adları (Vite vs Next, secrets, CI)
  - Realtime channel'lar + filter + debounce
  - TS tip refresh recipe
  - Migration discipline
  - Cross-repo smoke walk

**Risk:** DÜŞÜK — type-only + subscription filter daraltma + yeni doc. Davranış değişikliği yok.

---

## 2026-05-01: Sprint 2.1 follow-up - REVOKE EXECUTE FROM PUBLIC

**Migration:** `supabase/migrations/20260501000003_revoke_public_execute.sql`

**Sorun:** Sprint 2.1 PR #93'te 5 SECURITY DEFINER fonksiyondan `REVOKE EXECUTE ... FROM anon, authenticated` yaptık. Ama Postgres default grant'i `EXECUTE TO PUBLIC` ve PUBLIC anon/authenticated'i kapsıyor. Targeted revoke no-op oldu; advisor uyarıları düşmedi.

**Çözüm:** `REVOKE EXECUTE FROM PUBLIC` ile aynı 5 fonksiyon kapatıldı. `service_role` kendi explicit grant'i var, etkilenmez (ayrıca RLS bypass eder).

**Etkilenen fonksiyonlar:** submit_score, update_daily_leaderboard, archive_daily_leaderboard, check_rate_limit, cleanup_rate_limits.

**Bonus:** `suspicious_scores` tablosuna açıklayıcı COMMENT eklendi (rate_limits gibi).

**Doğrulama:** Migration apply sonrası advisor `anon_security_definer_function_executable` ve `authenticated_security_definer_function_executable` 0'a düşmeli.

---

## 2026-05-01: Sprint 2.1 - RLS lockdown (INSERT, duplicate SELECT, EXECUTE revoke)

**Migration:** `supabase/migrations/20260501000002_rls_lockdown.sql`

3 bölümlü güvenlik sertleştirmesi:

**1. INSERT policy lockdown:**
- `public.scores` "Anyone can insert scores" DROP — Sprint 2.2b sonrası frontend submit-score Edge Function üzerinden gönderiyor (service role); anon doğrudan INSERT yapamamalı
- `public.users` "Anyone can insert users" DROP — verify-payment Edge Function service role ile user yaratıyor

**2. Duplicate SELECT policy temizliği:**
6 tablodan duplicate policy'ler kaldırıldı (her birinde 3 → 1 SELECT policy):
- daily_leaderboard, daily_leaderboard_history, reward_pool_distribution
- scores, transactions, users

"Allow public read" tutuldu (anon SELECT erişimi sürüyor — landing page leaderboard, transactions panel vs. çalışmaya devam eder).

**3. SECURITY DEFINER EXECUTE revoke:**
5 fonksiyon anon ve authenticated için revoke edildi:
- `submit_score` (Edge Function service role kullanır)
- `check_rate_limit` (Edge Function'lar service role)
- `update_daily_leaderboard` (trigger, role bypass)
- `archive_daily_leaderboard` (pg_cron postgres role)
- `cleanup_rate_limits` (service role admin only)

**4. rate_limits tablosuna açıklayıcı COMMENT:**
RLS aktif, policy yok = tasarım gereği service-role-only. Advisor `rls_enabled_no_policy` INFO uyarısı bu komutla belgeleniyor.

**Etki (advisor warning'leri):**
- ✅ `rls_policy_always_true` (scores, users) → kaybolur
- ✅ `anon_security_definer_function_executable` (5 fonksiyon) → kaybolur
- ✅ `authenticated_security_definer_function_executable` (4 fonksiyon) → kaybolur
- ✅ `multiple_permissive_policies` (6 tablo × 5 role = 30 uyarı) → kaybolur

**Risk:** YÜKSEK — RLS değişiklikleri canlıyı etkileyebilir. Mitigation: tüm Edge Function'lar service_role kullanır (RLS bypass), pg_cron postgres role ile çalışır.

---

## 2026-05-01: Sprint 2.2b + 2.3 - Frontend cutover + banner cümle düzeltme

**Frontend:** `src/components/GameOverUI.jsx`

**Değişiklik:** Skor gönderme akışı Sprint 2.2a'da kurulan `submit-score` Edge Function üzerinden geçiyor.

- Eski: `supabase.rpc('submit_score', {...})` doğrudan RPC, anti-cheat yok
- Yeni: `supabase.functions.invoke('submit-score', { body: {...} })`, anti-cheat doğrulaması + suspicious_scores log

**Kaldırılan kod:** `isMissingCoinsParam` legacy retry akışı (migration applied, gereksiz).

**Yeni hata yönetimi:**
- `score_rejected` (422) → "Score rejected — flagged for review", retry yapma
- `rate_limited` (429) → "Too many submissions. Try again in a minute.", retry yapma
- `invalid_wallet` (400) → "Wallet not recognised. Reconnect and try again.", retry yapma
- Transient hata (network, 5xx, RPC fail) → 3 retry linear backoff

**Banner cümle:**
- Eski: "Fair Play Protected — All scores are verified on-chain. Cheaters will be detected." (yanıltıcı)
- Yeni: "Anti-Cheat Protected — Scores are validated server-side before being recorded." (doğru)

**Risk:** ORTA-YÜKSEK — canlı skor akışı yeni Edge Function'a geçiyor. Anti-cheat kuralları konservatif ama hatalı false positive olursa gerçek skorlar reddedilir. Forensic suspicious_scores log'u var.

**Açık aksiyon:** Sprint 2.1 (RLS + RPC EXECUTE revoke) sırada — frontend Edge Function dışında submit_score RPC'sini de doğrudan çağıramayacak.

---

## 2026-05-01: Sprint 2.2a - Anti-cheat altyapısı (Edge Function + suspicious_scores)

**Sorun:** `submit_score` RPC sadece INSERT yapıyor; tutarlılık kontrolü yok. Oyuncu browser console'dan `supabase.rpc('submit_score', {...})` çağırıp keyfi skor gönderebilir. GameOverUI'daki "Fair Play Protected" banner yanıltıcıydı.

**Çözüm (altyapı kısmı):**

**1. Yeni migration:** `supabase/migrations/20260501000001_suspicious_scores_table.sql`
- `public.suspicious_scores` tablosu (forensic log)
- Sütunlar: wallet, score, distance, duration, coins, near_miss_count, game_mode, reasons[], payload(jsonb)
- RLS aktif, policy yok → service_role only

**2. Yeni Edge Function:** `supabase/functions/submit-score/index.ts`
- POST endpoint, frontend'in `submit_score` RPC çağrısının yerine geçer
- Anti-cheat kuralları:
  - `wallet` base58 doğrulama
  - `duration >= 10` saniye
  - `distance <= 60 m/s × duration` (200 km/h tolerans)
  - `coins <= floor(distance / 50)`
  - `score <= distance × 200`
  - `clientStartTime` drift `<= 5sn`
- Anomali → suspicious_scores INSERT → 422
- Geçer → service role ile `submit_score` RPC → 200
- Rate limit: wallet başına 6/dk

**3. CI workflow:** `.github/workflows/deploy-edge-functions.yml` → submit-score deploy adımı eklendi

**Bu PR sonrası:** Edge Function deploy olur ama frontend hâlâ doğrudan RPC kullanır → davranış değişmez. Sprint 2.2b'de frontend Edge Function'a geçirilir.

**Risk:** ORTA — yeni Edge Function ve tablo, prod davranışı değişmiyor (frontend henüz çağırmıyor).

---

## 2026-05-01: Sprint 2.4 follow-up - Stub migrations + repair listesi genişletme

**Sorun:** PR #89 sonrası `deploy-migrations` workflow ilk kez çalıştığında `supabase db push` adımı şu hatayla fail etti:

> Remote migration versions not found in local migrations directory.
> 20251207161419, 20251207161705

Supabase'de daha önce manuel oluşturulmuş 2 migration (`reward_pool_distribution` tablosu ve `setup_daily_rewards_cron`) yerel git history'de yoktu. CLI yerel ↔ remote inconsistency olarak gördü.

**Çözüm:**

1. **2 stub dosyası eklendi:**
   - `20251207161419_create_reward_pool_distribution_table.sql`
   - `20251207161705_setup_daily_rewards_cron.sql`
   - İçerik: SQL yorumları (zaten apply edilmiş, body boş, repair bunları "applied" işaretliyor)

2. **Workflow repair listesi:** 5 → 7 versiyon (yeni 2 stub eklendi)

**Etki:** Yerel ile remote eşit, `db push` no-op çalışır. Bundan sonra yeni migration'lar disiplinli akışta apply olur.

**Açık not:** İdeal çözüm `supabase db pull` ile gerçek SQL içeriklerini çekmekti, ama CI'da pull yapmak istemiyoruz (yön sorunu). Stub yaklaşımı pragmatik. Gerçek SQL içeriklerini görmek için Supabase Dashboard → Database → Migrations.

---

## 2026-05-01: Sprint 2.4 - Migration discipline (tam CI/CD)

**Sorun:** Yerel `supabase/migrations/` altında 5 SQL dosyası vardı (8 haneli timestamp), Supabase migration tablosunda sadece 2 kayıt (14 haneli timestamp). Yerel migration'lar zaten uygulanmıştı (manuel Dashboard üzerinden) ama disiplinsiz halde — `supabase db reset` yapılırsa rate_limits/coins_collected/search_path sertleştirmesi vb. kaybolurdu.

**Çözüm:**

**1. Yerel dosyaları 14 haneli formata rename:**
- `20241216_add_token_fields.sql` → `20241216000000_*`
- `20260423_fix_token_symbol_defaults.sql` → `20260423000000_*`
- `20260430_rate_limits.sql` → `20260430000000_*`
- `20260430_submit_score_coins_collected.sql` → `20260430000001_*` (saatlik fark, aynı tarihten)
- `20260501_function_search_path.sql` → `20260501000000_*`

**2. CI workflow:** `.github/workflows/deploy-migrations.yml`
- Trigger: push to main + paths `supabase/migrations/**`
- Steps: setup-cli → link → **repair (first-run idempotent)** → `supabase db push`
- Repair adımı: 5 mevcut migration'ı `--status applied` ile işaretler, SQL'i tekrar çalıştırmaz
- Push adımı: yeni eklenen migration'ları otomatik apply eder

**3. GitHub Secret:** `SUPABASE_DB_PASSWORD` eklendi (kullanıcı tarafından, reset edilmiş şifre).

**Etki:** Bundan sonra yeni migration dosyası eklendiğinde, PR merge edilince otomatik prod'a uygulanır. Sprint 2.5'in manuel Dashboard adımı son olur.

**Risk:** ORTA — CI artık prod DB'ye yazabilir. Branch protection (1 review zorunlu) ve CI test gate koruyucu.

---

## 2026-05-01: Sprint 2.5 - Function search_path mutable sertleştirme

**Migration:** `supabase/migrations/20260501_function_search_path.sql`

**Sorun:** Supabase advisor 9 fonksiyonun `search_path` ayarının "mutable" olduğunu işaretliyordu. SECURITY DEFINER fonksiyonlarda search_path injection riski: saldırgan kendi schema'sını öne alıp fonksiyon body'sindeki unqualified `now()`, tablo referansı vb. çağrılarını yakalayabilir.

**Etkilenen fonksiyonlar:**
- `update_updated_at_column` (trigger)
- `distribute_daily_team_bonus`
- `update_team_selection`
- `archive_daily_leaderboard`
- `update_daily_leaderboard`
- `submit_score`
- `check_rate_limit`
- `cleanup_rate_limits`
- `end_the_day`

**Çözüm:** Migration DO bloğu dinamik olarak `pg_proc`'tan imzaları çözer ve her birine `ALTER FUNCTION ... SET search_path = public, pg_temp` uygular. Body değişmiyor, sadece metadata.

**Risk:** DÜŞÜK — davranış aynı kalır, reversible (`RESET search_path`).

**Açık aksiyon:** Migration prod'a kullanıcı tarafından uygulanmalı (Supabase Dashboard SQL Editor ya da `supabase db push`). Sprint 2.4'te migration discipline kurulduktan sonra otomatikleşir.

---

## 2026-05-01: Sprint 1.8 - PAYMENT_RECEIVER env var ad tutarlılığı

**Edge Function:** `supabase/functions/verify-payment/index.ts`
**Sorun:** Supabase Custom Secrets'ta `PAYMENT_RECEIVER_ADDRESS` adıyla tanımlı (2025-12-11) ama Edge Function `PAYMENT_RECEIVER` arıyordu. Edge Function default değere düşüyordu (canlı receiver `T6EkvAVdHPRr6Ngub1vk7VTzqtgw2KoGJwA8RCJmmGg` ile uyumlu — kazara çalışıyordu).

**Çözüm (geriye uyumlu fallback chain):**
```ts
const PAYMENT_RECEIVER =
  Deno.env.get('PAYMENT_RECEIVER_ADDRESS')   // güncel secret adı
  ?? Deno.env.get('PAYMENT_RECEIVER')        // legacy
  ?? 'T6Ekv...';                              // hardcoded fallback
```

**Etkilenen yerler (read-only, dokunulmadı):** Aynı dosyada `PAYMENT_RECEIVER` constant'ı 3 yerde karşılaştırma için kullanılıyor (satır 192, 504, 532) — sadece env okuma genişletildi.

**Etki:** Edge Function v18 olarak deploy olur. Receiver değişikliği artık sadece Secret güncelleyerek yapılabilir.

---

## 2026-05-01: Sprint 1 (Landing Migration) - 6 PR Tamamlandı

Landing page (`v0-lumexia-landing-page-V0`) tamamen BSC/$LMX → Solana/TOKABU'ya geçirildi:

| PR | Sprint | İçerik |
|----|--------|--------|
| #8  | 1.1 | `lib/token-config.ts` — tek doğruluk kaynağı |
| #9  | 1.2 | SEO meta tags + structured-data (organizationSchema, videoGameSchema, faqSchema) |
| #10 | 1.3 | UI metinleri (faq-section, footer, strategy-section): MetaMask → Phantom, PancakeSwap → Jupiter, BNB → SOL, $LMX → $TOKABU |
| #11 | 1.4 | dashboard-hero CONTRACT_ADDRESS placeholder fix (gerçek TOKABU mint), token-stats BSC adresi temizlendi |
| #12 | 1.5 | API routes (`/api/dex`, `/api/ticker`) BSC → Solana, ticker mapping |
| #13 | 1.6 | pool-context BNB → USD, transactions-panel sample data → canlı Supabase verisi |

**Sonuç:** lumexia.net SEO, UI, API, ve canlı veri tamamen Solana/TOKABU dünyasında. Google bir sonraki crawl'da düzeltilmiş içeriği indeksleyecek.

---

## 2026-05-01: Sprint 1.7b - calculate-daily-rewards USD geçişi + 401 fix

**Edge Function:** `supabase/functions/calculate-daily-rewards/index.ts`
- `GAME_TO_BNB = 0.0015` → `GAME_TO_USD = 1.0` (verify-payment ile birim hizalama, $1 USD per game)
- `totalPoolBNB`/`netPoolBNB` → `totalPoolUSD`/`netPoolUSD`
- `unitValue` USD/share cinsinden
- `reward_pool_distribution.reward_amount` artık USD cinsinden yazılıyor

**Deploy workflow:** `.github/workflows/deploy-edge-functions.yml`
- `Deploy calculate-daily-rewards` adımına `--no-verify-jwt` flag eklendi
- pg_cron `pg_net.http_post()` ile çağırıyor; JWT yok → 401 dönüyordu, artık geçecek
- Yorum eklendi: gelecekte `X-Cron-Secret` header kontrolü ile güçlendirme planlanıyor (Sprint 4)

**Etkilenen tablo (write):** `reward_pool_distribution` — yarınki cron'dan sonra USD kayıtlar düşmeli
**Davranis dogrulamasi:** Edge Function logs'ta cron çağrısı 401 yerine 200 dönmeli; yeni kayıtlar `reward_amount` alanı USD cinsinden (örn. 0.5 = $0.50)

**Açık not:** `reward_pool_distribution` tablosunda eski 4 BNB değerli kayıt kalıyor — temizlik isterseniz manuel SQL: `DELETE FROM reward_pool_distribution WHERE reward_date < CURRENT_DATE`

---

## 2026-04-30: Sprint 1.7a - calculate-daily-rewards Edge Function repo'ya kurtarıldı

**Sorun:** `calculate-daily-rewards` 4 ay önce manuel Supabase Dashboard üzerinden deploy edilmiş, repo'da yoktu. Eğer prod'dan silinirse git'te yedek yoktu.

**Çözüm:** `supabase/functions/calculate-daily-rewards/index.ts` prod'daki içeriğin birebir kopyası olarak repo'ya eklendi. `.github/workflows/deploy-edge-functions.yml`'a `Deploy calculate-daily-rewards` adımı eklendi. Içerik aynı, davranış değişmedi.

**PR:** #85 (merged)

---

## 2026-04-30: Sprint 0 - Otonomluk altyapısı

**Branch protection (her iki repo):**
- `main`'e doğrudan push yasak (sadece PR ile)
- Force push yasak, branch silme yasak
- 1 onay zorunlu, stale review dismiss
- Required conversation resolution
- Racing'de status check zorunlu: `test` ve `build`

**CI test gate** (`.github/workflows/ci.yml`):
- Her PR'da `npm test` + `npm run build` paralel job'lar
- Test geçmeden merge mümkün değil
- Lint job dahil değil — `eslint.config.js` eksik (Sprint 4.3'te düzeltilecek)

**Memory altyapısı:** Hafızaya 6 dosya eklendi — prod safety, ekosistem, repo URL'leri, v0.app sync riski, Supabase MCP read-only, docs sync kuralı.

**PR:** #84 (merged)

---

## Ertelenmis / Not Dusulenler (Gelecekte Cozulmek Uzere)

### BUG #4: `coins_collected` submit_score RPC'ye gonderilmiyor (ERTELENDI)
**Dosya:** `src/components/GameOverUI.jsx:50`, `supabase-functions.sql:23` (submit_score)
**Durum:** Ileriki faz icin not dusuldu, simdi dokunulmayacak
**Ozet:**
- `scores.coins_collected` sutunu DB'de var, DEFAULT 0
- `submit_score(p_wallet, p_score, p_duration, p_distance)` imzasinda parametre yok
- GameOverUI bu degeri gondermiyor → tum kayitlarda 0
**Cozumde Yapilacak:**
- `submit_score` imzasina `p_coins INTEGER DEFAULT 0` ekle
- INSERT ifadesine `coins_collected` ekle
- GameOverUI'den toplanan coin sayisini gecir
- Migration: `CREATE OR REPLACE FUNCTION submit_score(...)` ile guncelle

---

## Tamamlanan Gorevler

---

### 2026-04-30: TOKABU Balance Bug Full Fix + CI Redeploy (v6)

**Bulgu zinciri (smoking gun: SOL gosteriliyor, TOKABU=0):**
1. Eski `vite.config.js` -> `drop_console: true` tum console.* call'larini strip ediyordu
2. Eski `getTokenBalance` outer catch RPC hatasini yutup 0 donduruyordu
3. **Vite default'ta Buffer polyfill yok** -> `globalThis.Buffer === undefined`
4. `@solana/spl-token` getAccount deserializer Buffer.from / Buffer.alloc kullaniyor (bundle'da 42 + 14 referans)
5. SOL `connection.getBalance` Buffer kullanmiyordu, calisiyordu - asimetri ipucu
6. `Buffer.from()` cagrisi `ReferenceError: Buffer is not defined` firlatiyordu, sessizce 0 donduruluyordu

**Cozumler (3 commit):**

**Commit `28b4c8b` - surface balance fetch errors:**
- `vite.config.js`: `drop_console: true` -> `pure_funcs: ['console.log', 'console.debug', 'console.info']`. error/warn korundu.
- `src/utils/solanaWallet.js`:
  - `getTokenProgramId`: 3x retry, basarisizlikta throw (sessiz fallback yok)
  - `getTokenBalance`: outer catch kaldirildi; sadece TokenAccountNotFoundError 0 doner, gerisi throw
- `src/components/RealLauncherUI.jsx`:
  - `tokenBalanceError` + `balanceRefreshKey` state
  - Fail durumunda son balance korunur, turuncu border + ↻ retry butonu

**Commit `66d2a43` - Vitest setup + 8 regression test:**
- `vitest@4.1.5` devDep eklendi
- `src/utils/solanaWallet.test.js`: happy path, TokenAccountNotFoundError, RPC error throw, deserialization throw, getTokenProgramId 3x retry, TOKEN_CONFIG sanity
- `npm test` / `npm run test:watch` script'leri

**Commit `d9d4899` - Buffer polyfill (asil bug):**
- `src/polyfills.js` (yeni): `import { Buffer as NodeBuffer } from 'buffer'; if (typeof globalThis.Buffer === 'undefined') globalThis.Buffer = NodeBuffer;`
- `src/main.jsx`: ilk import `./polyfills.js`
- `buffer@6.0.3` zaten transitive dep, yeni paket yok

**Commit `59baf7e` - CI redeploy use-credit:**
- `.github/workflows/deploy-edge-functions.yml`: `Deploy use-credit` step eklendi
- Path filter'a workflow dosyasinin kendisi de eklendi (yoksa workflow degisiklikleri tetiklemiyor)
- PR #77'deki use-credit Solana regex fix'i ilk kez deploy oldu (eskiden Ethereum regex hala canliydi -> tum cuzdanlar "Invalid wallet" aliyordu -> "Failed to start game")

**Etkilenen testler (Playwright + curl probe):**
- ✅ Production browser'da `globalThis.Buffer === function`
- ✅ Helius RPC'den TOKABU balance 3494.123463 doniyor
- ✅ use-credit Solana adresine "User not found" (404) doner (eskiden 400 "Invalid wallet")
- ✅ Vitest 8/8 gecti

**Acik aksiyon (kullaniciya):** YOK - tum stack senkron, oyun oynanabilir.

---

### 2026-04-23: Tokenize Rename + Helius Env + Migration Fix + PostProcessing Kaldirma (v5)

**Hata 6 - Coal/Oiltown jenerik isimlendirme (Secenek A):**
- `getCoalBalance` → `getTokenBalance`
- `transferCoalToken` → `transferToken`
- `getCoalPrice` → `getTokenPrice`
- `calculateCoalAmount` → `calculateTokenAmount`
- `COAL_TOKEN_MINT` → `PAYMENT_TOKEN_MINT` (backend env var)
- Frontend state: `coalBalance` → `tokenBalance`, `coalPrice` → `tokenPrice`, `requiredCoal` → `requiredTokens`
- `AGREEMENT_TEXT` dinamik: `buildAgreementText(TOKEN_CONFIG.symbol)`
- UI metinleri: "OILTOWN" → `${TOKEN_CONFIG.symbol}`, "OIL" abbreviation kaldirildi
- Backend `verify-payment/index.ts` env var destekli (PAYMENT_TOKEN_MINT, TOKEN_SYMBOL, TOKEN_DECIMALS, PAYMENT_RECEIVER)
- Etkilenen dosyalar: `solana.config.js`, `solanaWallet.js`, `jupiterPrice.js`, `RealLauncherUI.jsx`, `verify-payment/index.ts`

**Hata 7 - coins_collected:** Ertelendi, yukarida ayri bolumde not dusuldu

**Hata 8 - Migration:**
- `20241216_add_token_fields.sql`: LMX default'u ve BNB UPDATE'i kaldirildi, default NULL yapildi
- Yeni `20260423_fix_token_symbol_defaults.sql`: Existing DB'deki LMX/BNB kayitlari NULL'a cevrilir

**Hata 11 - Helius API Key:**
- Frontend: `src/solana.config.js` -> `import.meta.env.VITE_HELIUS_API_KEY` (yoksa public RPC'lere duser)
- Backend: `verify-payment/index.ts` -> `Deno.env.get('HELIUS_API_KEY')`
- `.env.example` guncellendi, Edge Function secrets dokumante edildi
- **ACIK AKSIYON:** Eski commit'li key Helius dashboard'dan revoke edilmeli, yeni key olusturulmali, Netlify/Supabase env vars'a eklenmeli

**Hata 14 - PostProcessing component kaldirildi:**
- `src/components/PostProcessing.jsx` silindi
- `App.jsx`'ten import + `<PostProcessing>` cagrisi kaldirildi
- `package.json`'dan `@react-three/postprocessing` dependency cikarildi
- `vite.config.js` three-vendor chunk'tan cikarildi

**Hata 15:** Kullanici talebi uzerine dokunulmadi

**Deploy Notlari:**
- Frontend: `npm install` (postprocessing cikti), `npm run build`, Netlify env vars ekle (VITE_HELIUS_API_KEY)
- Backend: `supabase functions deploy verify-payment`, `supabase secrets set HELIUS_API_KEY=...` (ve opsiyonel PAYMENT_TOKEN_MINT, TOKEN_SYMBOL, TOKEN_DECIMALS, PAYMENT_RECEIVER)
- DB: `supabase db push` ile `20260423_fix_token_symbol_defaults.sql` calistir
- Helius: Eski key'i revoke et, yeni key uret, domain-restricted (lumexia.net) olarak ayarla

---

### 2026-04-16: Dokumantasyon Tutarlilik Gecisi

- [x] PROJECT_DOCS.md'den tamamlanmis Faz 0 bug'lari "KRITIK HATALAR"dan kaldirildi
- [x] PostProcessing aciklamasi duzeltildi (null yerine bos EffectComposer)
- [x] Token fiyat API oncelik siralamasi aciklandi (frontend DexScreener ilk, backend Jupiter ilk)
- [x] Fiyat tolerans tutarsizligi belgelendi (frontend %5, backend %10)
- [x] StreetLights lamba sayisi yorumu 14'e cikarildi (App.jsx:1250 7x2=14)
- [x] store.js:106 yorum kucuk/buyuk harf tutarsizligi giderildi ('gameOver' -> 'gameover')
- [x] Kullanilmayan asset'ler (Car1/scene.gltf, suv.glb, coin.glb) dokumante edildi
- [x] Eski LMX/BNB migration'i dokumante edildi
- [x] GameOverUI submit_score imzasi duzeltildi (coins_collected gonderilmiyor not'u)
- [x] OILTOWN mint ve odeme alici adresleri dokumantasyona eklendi
- [x] PLAN.md teknik borc tablosu guncellendi

### 2026-02-06: Kritik Bug Duzeltmeleri (Faz 0)

#### Bug #1: use-credit Ethereum Dogrulama - DUZELTILDI
- [x] `isValidEthAddress` -> `isValidSolanaAddress` olarak degistirildi
- [x] Regex: `/^0x[a-fA-F0-9]{40}$/` -> `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
- [x] Fonksiyon adi ve cagri noktasi guncellendi
- [x] Build basarili

#### Bug #2: quitGame() 'menu' State - DUZELTILDI
- [x] `store.js:273` - `'menu'` -> `'launcher'` olarak degistirildi
- [x] Build basarili

#### Bug #3: RainbowKit CSS Import - DUZELTILDI
- [x] `index.html` - RainbowKit CSS import satiri kaldirildi
- [x] Build basarili

### 2026-02-06: Proje Kesfetme ve Dokumantasyon (v2)

#### Incelenen Dosyalar (Tamami)
- [x] `src/App.jsx` - 2464 satir tamami okundu (tum bilesenler dokumante edildi)
- [x] `src/store.js` - 796 satir tamami okundu (tum state degiskenleri ve action'lar)
- [x] `src/main.jsx` - Giris noktasi ve Solana wallet provider kurulumu
- [x] `src/solana.config.js` - Token mint, RPC endpoints, odeme yapilandirmasi
- [x] `src/components/GameOverUI.jsx` - D/N skor mantigi, retry mekanizmasi, anti-cheat banner
- [x] `src/components/AdvancedParticles.jsx` - Nitro parcacik fizigi, GPU instancing
- [x] `src/components/PostProcessing.jsx` - Devre disi (null dondurur)
- [x] `src/components/PhysicsWorld.jsx` - Rapier3D yapilandirmasi
- [x] `src/components/RealLauncherUI.jsx` - Cuzdan baglanti, kredi satin alma, yasal metinler
- [x] `src/utils/supabaseClient.js` - DB islemleri
- [x] `src/utils/solanaWallet.js` - Token transfer ve bakiye
- [x] `src/utils/jupiterPrice.js` - Fiyat API entegrasyonu
- [x] `supabase/functions/verify-payment/index.ts` - Odeme dogrulama akisi
- [x] `supabase/functions/use-credit/index.ts` - Kredi dusme (KRITIK BUG tespit edildi)
- [x] `supabase-schema.sql` - Veritabani semasi
- [x] `supabase-functions.sql` - Stored procedure'ler ve trigger'lar
- [x] `vite.config.js` - Build yapilandirmasi
- [x] `netlify.toml` - Deploy yapilandirmasi
- [x] `package.json` - Bagimliliklar
- [x] `index.html` - HTML giris noktasi

#### Olusturulan Dokumanlar
- [x] `docs/PROJECT_DOCS.md` (v2) - Kapsamli proje dokumantasyonu
  - Tum state degiskenleri ve action'lar
  - Dusman AI serit degistirme mantigi
  - Spawn algoritmasi detaylari
  - Canvas ve kamera ayarlari
  - HUD elemanlari ve responsive olcekler
  - Carpisma sistemi (AABB boyutlari ve esikleri)
  - Edge Function islem akislari
  - Veritabani sema detaylari (her sutun)
  - RLS politika analizi
  - 15 bilinen hata/eksiklik
- [x] `docs/PLAN.md` (v2) - Guncellenmis gelistirme plani
  - FAZ 0 eklendi: Acil kritik bug duzeltmeleri
  - Teknik borc tablosu guncellendi
- [x] `docs/TASK.md` (v2) - Bu dosya

---

## Tespit Edilen Kritik Buglar (ARSIV - Tamami Duzeltildi)

### BUG #1: use-credit Edge Function - Ethereum Adresi Dogrulama (DUZELTILDI)
**Dosya:** `supabase/functions/use-credit/index.ts`
**Cozum:** `isValidEthAddress` -> `isValidSolanaAddress` (regex: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`)

### BUG #2: quitGame() 'menu' State (DUZELTILDI)
**Dosya:** `src/store.js`
**Cozum:** `quitGame()` icinde `'menu'` -> `'launcher'`

### BUG #3: RainbowKit CSS Import (DUZELTILDI)
**Dosya:** `index.html`
**Cozum:** BNB Chain doneminden kalma CSS import satiri kaldirildi.

---

## Tespit Edilen Guvenlik Riskleri

### RISK #1: RLS Politikalari Tamamen Acik
**Ciddiyet:** YUKSEK
**Tablolar:** users, transactions, scores, daily_leaderboard, daily_leaderboard_history
**Sorun:** Tum tablolarda `USING(true)` - herhangi bir kullanici her seyi okuyabilir/yazabilir
**Etki:** Sahte skor ekleme, baska kullanicilarin verilerini goruntuleme

### RISK #2: Sunucu Tarafli Skor Dogrulama Yok
**Ciddiyet:** YUKSEK
**Sorun:** Frontend skor hesaplar ve dogrudan `submit_score` RPC'ye gonderir. Hicbir dogrulama yok.
**Etki:** Kullanici tarayici konsolundan istedigi skoru gonderebilir
**Not:** GameOverUI'daki "Fair Play Protected - All scores are verified on-chain" mesaji YANILTICI

### RISK #3: Edge Function Bypass
**Ciddiyet:** ORTA
**Sorun:** RLS politikalari gevsek oldugu icin frontend, use-credit Edge Function'i yerine dogrudan DB'ye yazabilir
**Etki:** Kredi dusme guvenligi azalir, anti-cheat dogrulama yapilamaz

---

## Dokumantasyon Tamamlanma Durumu

| Dosya/Alan | Tamamlanma | Notlar |
|------------|------------|--------|
| store.js (tum state + action'lar) | %100 | Tum degiskenler, oyun dongusu, AI |
| App.jsx (tum bilesenler) | %95 | Tum 20+ bilesen dokumante edildi |
| GameOverUI.jsx | %100 | D/N mantigi, retry, anti-cheat |
| AdvancedParticles.jsx | %100 | Fizik, GPU instancing |
| PostProcessing.jsx | %100 | Bos EffectComposer render ettigi belgelendi |
| PhysicsWorld.jsx | %100 | Tum parametre |
| RealLauncherUI.jsx | %70 | 1615 satir / ~59KB, ana ozellikler belgelendi |
| verify-payment/index.ts | %100 | Tam islem akisi |
| use-credit/index.ts | %100 | Solana regex duzeltilmis hali |
| supabase-functions.sql | %100 | Tum fonksiyonlar ve trigger'lar |
| supabase-schema.sql | %95 | Tum tablolar, RLS analizi |
| Oyun mekanikleri | %100 | Carpisma, spawn, AI, skor, seviye |
| Canvas/rendering | %100 | DPR, shader warmup, optimizasyonlar |
| HUD/UI | %100 | Tum elemanlar ve responsive olcekler |
| Ses sistemi | %100 | AudioSystem class, frekanslar |

**Genel Tamamlanma: ~%97**
Eksik: RealLauncherUI'nin detayli UI bilesenleri (~59KB dosya, cok buyuk)

---

## Sonraki Adimlar (Oncelik Sirasina Gore - v6 sonrasi)

1. ~~Bug #1-3 (Faz 0)~~ TAMAMLANDI + MERGED
2. ~~Coal/Oiltown isimlendirme jenerik tokenize~~ TAMAMLANDI (v5)
3. ~~Test altyapisi kur~~ TAMAMLANDI (v6) - Vitest + 8 test mevcut
4. ~~Buffer polyfill / TOKABU balance bug~~ TAMAMLANDI (v6)
5. ~~use-credit Edge Function redeploy~~ TAMAMLANDI (v6)
6. **GUVENLIK - YUKSEK: RLS politikalarini sikistir** - wallet bazli erisim kurallari (USING(true) -> wallet match)
7. **GUVENLIK - YUKSEK: Sunucu tarafli skor dogrulama** - anti-cheat Edge Function (frontend skor gondermesi serbest, GameOverUI banner yaniltici)
8. **GUVENLIK - ORTA: Rate limiting** - submit_score, use-credit, verify-payment
9. **BUG #4 (ertelenmis): coins_collected** - submit_score imzasi + GameOverUI gecisi
10. **TUTARLILIK: Frontend %5 vs backend %10 fiyat tolerans** - tek degere hizala
11. **REFACTOR: App.jsx bolme** - 2456 satir -> mantiksal alt dosyalar
12. **KOD KALITESI: ESLint** - 11 pre-existing hata var (formatAddress unused, tokenAmount unused vs)
13. **TEST GENISLET** - store.js, GameOverUI, Edge Function entegrasyon testleri
14. **TYPESCRIPT** - opsiyonel, kademeli .jsx -> .tsx
