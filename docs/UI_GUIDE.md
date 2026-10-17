# Arayüz metinleri ve simgeler

17 Ekim 2026. Menü, garaj, HUD, duraklatma, sonuç ve yükleme ekranları Türkçedir. Classic Run, Double or Nothing ve araç model adları özel ad olarak korunur. Sayılar Türkçe biçimlenir.

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

## Yerel doğrulama

80 test başarılı, 17 üretim adaptörü testi atlandı; ESLint ve üretim derlemesi başarılı. 320 ve 390 px genişlikte gerçek arayüz, ayrıca 1280 px masaüstü görünümü incelendi. `tools/mobile-controls-check.html` gerçek HUD/kontrol bileşenleriyle 320×700 ve 844×390 tarayıcı çerçevelerinde 42/42 sentetik kontrolü geçti. Çerçeve aracı `artifacts/ui-review.html` içindedir. Bunlar fiziksel telefon, yerel pointer yakalama veya FPS kabulü değildir.

Gerçek Double or Nothing akışında duraklatma/devam ve sonuçtan garaja dönüş kontrol edildi. 392 m / 4 jeton sonunda skor hedef öncesi 0 oldu; +139 altın ayrı gösterildi ve garaja taşındı. Ana menü, HUD, duraklatma ve sonuç görüntüleri `artifacts/ui-*-revised.png` dosyalarıdır.
