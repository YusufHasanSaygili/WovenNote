# Arama, Etiketler ve Not Yaşam Döngüsü

## Arama

- Başlık
- Tam düz metin `searchText` alanı
- Etiket adı
- Uygun olduğunda sohbet geçmişi
- Debounce
- Büyük listelerde performans

SLICE-021 uygulaması:

- Üst bardaki arama 250 ms debounce sonrası allowlist edilmiş `notes:search` IPC kanalını çağırır.
- Main process, parametreli SQLite sorgusuyla yalnız aktif notların `title`, tam `searchText` ve
  ilişkili etiket adlarını tarar; sonuç sayısı tek sorguda 500 ile sınırlıdır.
- `wovennote_search_fold` deterministik SQLite fonksiyonu `tr-TR` büyük/küçük harf dönüşümü uygular;
  böylece `İ/İ`, `I/ı` gibi Türkçe eşleşmeler platformdan bağımsızdır.
- Arama temizlendiğinde renderer önceden yüklenmiş tüm-notlar listesini anında geri gösterir. Arama
  için ayrı yükleniyor, hata ve sonuç-yok durumları bulunur.
- Etiket adı eşleşmesi `Tags`/`NoteTags` ilişkisi üzerinden aynı Türkçe normalizasyonuyla yapılır.

## Organizasyon

- Etiket oluşturma
- Etiket rengi
- Nota birden fazla etiket
- Sabitleme
- Favori
- Son kullanılanlar

SLICE-022 uygulaması:

- Etiket adı 1–40 karakterdir; harf veya rakamla başlar, yalnız harf, rakam, boşluk, `_` ve `-`
  kabul eder. Ardışık boşluklar tek boşluğa indirilir ve normalleştirilmiş ad benzersizdir.
- Renk, ürünün izin verdiği altı renkli sabit paletten seçilir.
- Bir nota en fazla 20 benzersiz etiket tek transaction ile atanır; geçersiz bir etiket tüm işlemi
  geri alır.
- Sabitleme ve favori durumu kart menüsünden değiştirilir. Kart rozetleri durumu gösterir;
  Sabitlenenler ve Favoriler yan menü filtreleri gerçek not alanlarını kullanır.
- Etiket, sabitleme ve favori durumları SQLite'ta saklanır ve uygulama yeniden açıldığında korunur.

## Yaşam döngüsü

- Aktif
- Arşivlenmiş
- Çöp kutusunda
- Kalıcı silinmiş

Silme önce çöp kutusuna taşır. Çöp kutusundan geri yükleme ve kalıcı silme desteklenir. Kritik işlemler onay ister.

SLICE-023 uygulaması:

- Arşivleme notu aktif, sabitlenenler, favoriler ve arama sonuçlarından kaldırır; Arşiv ekranı
  yalnız `isArchived = 1` ve silinmemiş notları listeler. Arşivden çıkarma notu aktif panoya döndürür.
- Çöp kutusuna taşıma yalnız `deletedAt` değerini yazar ve notu arşivden de çıkarır; fiziksel ek
  dosyaları bu aşamada tutulur. Geri yükleme `deletedAt` değerini temizleyip notu aktif panoya alır.
- Kalıcı silme yalnız çöp kutusundaki bir not için ve tipli IPC sözleşmesindeki
  `PERMANENT_DELETE` onayıyla çalışır. Arayüz ayrıca geri alınamaz işlem için ayrı bir
  `alertdialog` gösterir.
- Kalıcı silme transaction'ı, silinecek notun attachment kimliklerini diğer notların sürümlü
  `contentJson` belgelerinde tarar. Paylaşılan attachment kaydı hayatta kalan nota devredilir;
  yalnız hiçbir notun kullanmadığı göreli dosya yolları kontrollü depolama kökünde temizlenir.
- Otomatik süreli çöp temizliği yapılmaz.
