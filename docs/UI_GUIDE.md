# Arayüz metinleri ve simgeler

17 Ekim 2026. Menü, garaj, HUD, duraklatma, sonuç ve yükleme ekranları Türkçedir. Classic Run, Double or Nothing ve araç model adları özel ad olarak korunur. Sayılar Türkçe biçimlenir.

## Ana menü ve mod seçimi

Ana menüde iki birincil eylem vardır: **Yarışa başla** ve **Garaj**. Mod kartları ana ekrandan kaldırılmıştır. **Yarışa başla**, ekran ortasında yerel HTML `dialog` penceresini açar; açılması veya Classic Run / Double or Nothing kartına basılması yarışı başlatmaz. Pencere içindeki **Yarışa başla** onayı, seçili modu yarış başlangıcına gönderir. Mevcut mod görselleri ve skor kuralları korunur.

Penceredeki seçim geçicidir. **Geri dön**, kapat düğmesi, Esc veya pencere dışına tıklama son onaylanan modu değiştirmeden ana menüye döndürür. Pencere açıldığında seçili radyo seçeneği odaklanır; yön tuşları mod değiştirir, Tab odağı pencere içinde dolaştırır. İptal sonrası odak ana menüdeki başlangıç düğmesine döner. Arka plandaki kontroller pencere açıkken etkileşim almaz.

Tarayıcıda masaüstü, 320×700 ve 844×390 görünümleri kontrol edildi. 320×700 çerçevesinde pencere 286×516,4 px ve üst konumu 91,8 px; 844×390 çerçevesinde 660×347,3 px ve üst konumu 21,55 px ölçüldü. İki görünümde de yatay taşma yoktur; yatay görünümde pencerenin içeriği kaydırma gerektirmeden sığar. İptal, Esc, dışarı tıklama, Tab dolaşımı ve garaja giriş doğrulandı. Bunlar fiziksel cihaz kabulü değildir.

Pencereden onaylanan Double or Nothing gerçek yarış HUD'sinde **HEDEF: SEVİYE 5**, duraklatma ekranında doğru mod adıyla görüntülendi. Ana menüye dönüp pencere yeniden açıldığında Double or Nothing seçili kaldı. Classic Run seçilip onaylanan ikinci gerçek yarış 87 m / 1 jeton sonunda Classic Run · SUBARU WRX STI sonuç ekranına ulaştı. Son kontrollerde 85 test başarılı, 17 üretim adaptörü testi atlandı; lint ve üretim derlemesi başarılı.

## Terimler ve simgeler

| Terim | Oyuncuya anlatılan değer |
|---|---|
| Skor / puan | Yarış puanı; harcanan para değildir. |
| Jeton | Yarışta toplanan nesne. Toplama bildirimi +100 puan ve 1 jetondur. |
| Altın | Garajda araç ve ekipman için harcanır. Tamamlanan yarışta her jeton 25 altın, her 10 metre 1 altın verir. |
| Normal hız / oyun hızı | Mevcut arcade hız ölçeği; km/sa değildir. |
| Nitro kapasitesi | Aracın toplam nitro rezervi, birim olarak gösterilir. |
| Nitro % | Yarıştaki rezervin doluluk oranıdır. |
| Yarış için seçili | Sonraki yarışta kullanılacak araç. İncelemek seçimi değiştirmez. |
| Seviye 2 yap | Seçili araca ikinci ekipman seviyesi satın alınıp hemen takılır; düğmede altın maliyeti görünür. |

Classic Run açıklaması sonsuz sürüş ve yüksek skoru vurgular. Double or Nothing açıklaması her ekran genişliğinde 5. seviyede skorun iki katına çıktığını, hedefe ulaşmadan sonuç skorunun sıfır olduğunu belirtir. Sonuç ekranı altın kazancının bu kuraldan etkilenmediğini ayrıca söyler.

`src/components/UIIcon.jsx` ortak SVG simgelerini içerir. Motor, direksiyon, nitro tüpü, jeton/altın, hız, kupa, mesafe, süre, garaj, ses, duraklatma ve gezinme işaretleri aynı çizgi diliyle hazırlanmıştır. Simgeler dekoratiftir; etiketler ve yalnız simgeli düğmelerin erişilebilir adları anlamı taşır. Büyük mod simgeleri ve ekipman görselleri mevcut üretilmiş varlıkları kullanır. Küçük kontroller için ek raster üretimi gerekmez.

Ana menüde açılabilir **Nasıl oynanır?** bölümü klavye veya dokunma yönergelerini gösterir. Birincil eylem açık yeşil; altın maliyetleri altın rengi; yetersiz bakiye, kilitli araç ve azami seviye metinle açıklanır. Duraklatma penceresi kısa ekranlarda kaydırılabilir.

## Önceki arayüz doğrulaması

80 test başarılı, 17 üretim adaptörü testi atlandı; ESLint ve üretim derlemesi başarılı. 320 ve 390 px genişlikte gerçek arayüz, ayrıca 1280 px masaüstü görünümü incelendi. `tools/mobile-controls-check.html` gerçek HUD/kontrol bileşenleriyle 320×700 ve 844×390 tarayıcı çerçevelerinde 42/42 sentetik kontrolü geçti. Çerçeve aracı `artifacts/ui-review.html` içindedir. Bunlar fiziksel telefon, yerel pointer yakalama veya FPS kabulü değildir.

Gerçek Double or Nothing akışında duraklatma/devam ve sonuçtan garaja dönüş kontrol edildi. 392 m / 4 jeton sonunda skor hedef öncesi 0 oldu; +139 altın ayrı gösterildi ve garaja taşındı. Ana menü, HUD, duraklatma ve sonuç görüntüleri `artifacts/ui-*-revised.png` dosyalarıdır.
