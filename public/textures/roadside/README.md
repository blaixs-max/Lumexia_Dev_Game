# Yol kenarı dokuları — üretim ve kaynak kaydı

**Tarih:** 7 Eylül 2026  
**Araç:** Codex yerleşik `image_gen.imagegen` (`image_gen__imagegen`)  
**Yöntem:** İki yeni görsel doğrudan üretildi; PNG çıktıları yeniden boyutlandırma veya piksel düzenlemesi uygulanmadan bu klasöre kopyalandı. Özel makine yolları bu kayıttan çıkarıldı.

İstemlerde 1024 × 1024 kompozisyon istenir; üretilen dosyaların gerçek boyutu 1254 × 1254 pikseldir. Toplam dosya boyutu 5.683.600 bayttır. Bu dosyalar önceden indirilmiş bir çevre GLTF paketinden alınmadı. Kullanılan geometri, bu çalışma için koddan üretilen doğa prototiplerine aittir.

## oak-leaves.png

- Dosya: [oak-leaves.png](oak-leaves.png)
- Boyut: 1254 × 1254 piksel
- Dosya boyutu: 2.082.296 bayt
- Alfa: Gerçek şeffaflık. Tamamen şeffaf piksel: 751.910; alfa değeri en az 128 olan piksel: 676.108.
- SHA-256: `265fcf5ea63f6a0910553202475816cce4b4901a72eaba1833179c345da8cdbf`

### Tam üretim istemi

```text
Use case: photorealistic-natural. Asset type: square vegetation card diffuse texture for a realistic 3D driving game. Generate one photorealistic cutout of a single naturally branching small spray of oak foliage with approximately 25 to 30 small oak leaves on a few thin woody twigs, frontally viewed. Muted natural summer green, varied leaf orientations and sizes, believable oak lobes, detailed veins and organic imperfections. Diffuse neutral flat lighting with no strong directional light and no strong baked shadows, sharp detail throughout, realistic photographic material. The foliage fills most of the square with a narrow genuinely transparent margin all around, irregular natural silhouette, and small genuinely transparent holes between the leaves. Background MUST be actual transparent alpha, not white, black or a checkerboard printed into the image. This is one coherent leaf cluster, not a full tree, not a dense solid ball, not a collection of separate items. No text, no watermark, no border. 1024 x 1024 square composition, production texture ready.
```

## bark.png

- Dosya: [bark.png](bark.png)
- Boyut: 1254 × 1254 piksel
- Dosya boyutu: 3.601.304 bayt
- Alfa: Opak.
- SHA-256: `41516125cd70dd5e6a681b666d443fdb908d04bee07869640d6b91dc0cfbda5c`

### Tam üretim istemi

```text
Use case: photorealistic-natural. Asset type: seamless repeating oak bark diffuse/albedo texture for realistic 3D tree trunks in a driving game. Generate a square close-up photorealistic texture covering the image edge to edge with only mature oak bark. Natural muted gray-brown bark, fine believable longitudinal ridges, shallow irregular fissures, detailed organic roughness at a consistent scale. Flat neutral diffuse lighting, evenly exposed, no directional lighting, no strong baked shadows, no bright spots, no depth-of-field blur, no perspective distortion. Seamless tile in both horizontal and vertical directions with matching opposite edges and no visible repetition seam. No branches, no leaves, no moss clumps, no surrounding scene, no objects, no lettering, no watermark or border. 1024 x 1024 square composition, opaque background, production-ready tiling material.
```

## Kullanım ve kabul sınırları

`src/components/RoadsideWorld.jsx` bu yerel dosyaları `src/environment/nature.js` fabrikasına sağlar. Yaprak malzemesinde alfa testi ve çift taraflı çizim, kabukta tekrarlama kullanılır. Doku talepleri oyunla aynı kaynaktan yapılır; üçüncü taraf bir görsel CDN gerekmez.

Üretim kaydında iki özgün çıktı görsel olarak incelendi: yapraklarda fotoğraf ayrıntısı, dallanmış siluet ve gerçek şeffaf boşluklar; kabukta gri-kahverengi doğal çizgiler görüldü. Bark dokusunun karşılıklı kenarlarının matematiksel olarak aynı olduğu doğrulanmadı. İstemdeki seamless/production-ready ifadeleri üretim talebidir; kusursuz dikiş veya cihaz performansı sertifikası değildir.

Bu iki PNG, ayrı normal/roughness veya fiziksel ölçüm haritaları içeren taranmış bir PBR paketi değildir. Sahnedeki tekrar dikişi, yaprak kenarı, renk uyumu ve mipmap davranışı görsel kabul kapsamındadır. Gerçek Android/iPhone FPS, ısınma ve uzun sürüş bu üretim kaydıyla doğrulanmış sayılmaz.

Tam koleksiyon, prototip ölçümleri ve yerel stüdyo için [ROADSIDE_ASSETS.md](../../../docs/ROADSIDE_ASSETS.md) belgesine bakın.
