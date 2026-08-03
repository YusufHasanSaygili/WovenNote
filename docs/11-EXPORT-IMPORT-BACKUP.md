# Dışa Aktarma, İçe Aktarma ve Yedek

## Tek not dışa aktarma

- Markdown
- TXT
- PDF
- JSON

SLICE-026 ile Markdown, TXT ve JSON dışa aktarma uygulanmıştır:

- Renderer dosya sistemi yolu alamaz veya gönderemez; yalnızca not kimliği ve allowlist edilmiş biçim gönderir.
- Main process güvenli işletim sistemi kaydetme penceresini açar ve UTF-8 dosyayı yazar.
- Kullanıcının kaydetme penceresini iptal etmesi hata değildir ve ayrı bir `cancelled` sonucu üretir.
- Markdown temel metin biçimlerini ve belge yapısını; TXT okunabilir düz metni korur.
- Medya, Markdown/TXT içinde yerel dosya yolu yerine `attachmentId` referansı olarak temsil edilir.
- JSON dosyası `format: "wovennote-note"` ve `exportVersion: 1` alanlarıyla sürümlenir; içerdiği editör zarfı ayrıca kendi `documentVersion` alanını korur.
- JSON şeması `NoteExportFileSchema` ile strict olarak doğrulanabilir; türetilmiş `preview`/`searchText` alanları ve secret veriler dosyaya yazılmaz.
- Dosya adı Windows için geçersiz ve rezerve adlara karşı güvenli hale getirilir; dosya uzantısı seçilen biçime göre main process tarafından garanti edilir.

Tek-not JSON v1 üst düzey yapısı:

```json
{
  "format": "wovennote-note",
  "exportVersion": 1,
  "exportedAt": "2026-07-28T12:00:00.000Z",
  "note": {
    "id": "...",
    "title": "...",
    "document": {
      "documentVersion": 1,
      "editor": "tiptap",
      "content": {}
    }
  }
}
```

Not nesnesi ayrıca renk, grid, favori/sabitleme, oluşturulma-güncellenme zamanları ve etiketleri taşır. Bu sürüm tek not export formatıdır; tam yedek formatı değildir.

SLICE-027 ile PDF dışa aktarma uygulanmıştır:

- PDF, ek bir PDF bağımlılığı yerine Electron/Chromium `printToPDF` ile görünmez, sandbox etkin ve Node entegrasyonu kapalı bir pencerede üretilir.
- Yazdırma HTML'i script içermez; kendi kısıtlı CSP'si yalnızca inline baskı stiline ve gömülü `data:` görsellerine izin verir.
- Paragraf, H1/H2/H3, alıntı, kod, listeler, görev listeleri, tablo ve görsel desteklenir.
- A4 sayfa kuralları, tekrar eden tablo başlığı ve `break-inside` kuralları uzun notları okunabilir sayfalara böler.
- Görseller yalnızca kontrollü attachment deposundan çözülür, PDF içine data URL olarak gömülür ve `height: auto`/`object-fit: contain` ile oranını korur. Eksik, bozuk veya 25 MB üzerindeki görsel PDF'i bozmadan açıklayıcı bir yer tutucuya dönüşür.
- Video dosyasını PDF içine gömme kapsam dışıdır; belgede video eki bulunduğu metin olarak belirtilir.
- Chromium çıktısı `%PDF-` başlığı ve `%%EOF` sonlandırıcısı bakımından doğrulanmadan hedef dosyaya yazılmaz.
- Kaydetme penceresi iptali diğer biçimlerde olduğu gibi normal `cancelled` sonucudur; renderer dosya yolu görmez.

## Tam yedek

- Notlar
- Etiketler
- Grid düzeni
- Hassas olmayan ayarlar
- Ek metadata
- Sohbet geçmişleri
- Sürüm geçmişi
- Gerekli medya dosyaları

API anahtarı, şifrelenmiş kopyası veya başka herhangi bir secret hiçbir tek-not export'una ya da tam yedeğe dahil edilmez. Yedekten geri yükleme sonrasında kullanıcı gerekiyorsa API anahtarını yeniden girer.

## İçe aktarma

Çakışmada kullanıcıya seçenek:

- Mevcut olanı koru
- Gelenle değiştir
- İkisini de sakla

İçe aktarma transactional olmalı; yarıda hata olursa bozuk yarım veri bırakmamalıdır. Yedek formatında sürüm numarası bulunmalıdır.

SLICE-028 ile sürümlü tam yedek ve geri yükleme uygulanmıştır:

- `.wovennote-backup` ZIP paketi strict `manifest.json`, `backupVersion: 1`, veritabanı şema sürümü ve `media/` girdilerini içerir.
- Manifest; notları, etiketleri, yerleşimi, attachment metadata'sını, sohbetleri, not sürümlerini ve allowlist edilmiş hassas olmayan ayarları taşır.
- Her medya girdisinin boyutu ve SHA-256 özeti doğrulanır. Fazladan, eksik, yinelenen, traversal içeren veya güvenli boyut sınırını aşan arşiv girdileri reddedilir.
- Renderer dosya yolu alamaz; main process işletim sistemi dosya penceresini açar ve doğrulanan yedeği süreli, tek kullanımlık bir import token'ı ile temsil eder.
- `keep-existing`, `replace` ve `keep-both` stratejileri notlar ile ilişkili attachment, etiket, sohbet ve sürüm kayıtlarına birlikte uygulanır. Yeni medya kimlikleri editör belgeleri ve sürüm geçmişi içinde yeniden eşlenir.
- Import veritabanı transaction'ı ve kontrollü staging dizini kullanır. Hata halinde veritabanı rollback edilir, kurulan medya dosyaları silinir ve yarım kayıt bırakılmaz.
- API anahtarı ayrı şifreli secret deposunda kalır. Yalnız `ai-preferences-v1` ve `note-detail-layout` gibi allowlist edilmiş hassas olmayan ayarlar yedeğe alınabilir.
