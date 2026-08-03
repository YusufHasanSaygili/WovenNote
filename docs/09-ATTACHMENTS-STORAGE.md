# Dosya ve Medya Yönetimi

## Destek

- Görsel
- GIF
- Video
- Genel dosya eki
- JPG/JPEG/JPE/JFIF görseli
- PDF dosya eki

## Saklama

- Büyük dosyalar base64 olarak SQLite içine yazılmaz.
- Uygulamanın kullanıcı veri dizininde kontrollü klasöre kopyalanır.
- Veritabanında göreli yol ve metadata saklanır.
- Editör medya node'larında doğrudan veya göreli dosya yolu saklanmaz; yalnızca `attachmentId` bulunur.
- Renderer `attachmentId` değerini kullanır; gerçek göreli yol yalnızca main process tarafından çözülür.
- Dosya adları sanitize edilir.
- Çakışmayı önlemek için benzersiz saklama adı kullanılır.

## Kullanıcı deneyimi

- Dosya seçici
- Editöre sürükle-bırak
- Yükleme durumu
- Hata durumu
- Boyut sınırı uyarısı
- Medya hizalama ve yeniden boyutlandırma
- Dosya bulunamadığında bozuk yol göstergesi
- PDF, renderer içinde çalıştırılmadan güvenli dosya kartı olarak gösterilir ve dış okuyucuda açılır.
- Resim, video ve PDF/genel dosya seçicileri ayrı MIME kategorileridir. PDF/dosya seçicisi resim veya
  video kabul etmez; yanlış kategori main process doğrulamasında anlaşılır bir hatayla reddedilir.
- **Resim ekle** dosya seçicisi `.jpg`, `.jpeg`, `.jpe` ve `.jfif` uzantılarını doğrudan
  gösterir. Seçilen dosya dialog, IPC, imza doğrulaması ve kontrollü kopyalama zincirinden geçer;
  yeniden açılışta kaynak dosyaya değil uygulamanın güvenli attachment kopyasına dayanır.

## Silme

Not çöp kutusuna taşındığında fiziksel dosya hemen silinmez. Kalıcı silme veya çöp temizleme sırasında artık kullanılmayan ekler güvenli biçimde temizlenir.

SLICE-023'te kalıcı silme, not ve attachment metadata değişikliklerini tek SQLite transaction'ında
tamamlar. Aynı `attachmentId` başka bir notun editör belgesinde bulunuyorsa attachment kaydı o nota
devredilir ve fiziksel dosya korunur. Yalnız devredilmeyen kayıtların göreli yolları, path traversal
kontrolünden geçtikten sonra uygulamanın kontrollü attachment kökü içinde silinir. Dosya kilitli veya
zaten eksikse not silme geri alınmaz; güvenli tarafta kalmak için erişilemeyen fiziksel yetim dosya
yerinde bırakılır ve uygulama dışındaki hiçbir yol denenmez.
