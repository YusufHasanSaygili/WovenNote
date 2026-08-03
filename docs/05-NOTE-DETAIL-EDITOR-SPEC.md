# Not Detayı ve Editör Gereksinimleri

## Yerleşim

- Sol AI paneli
- Sağ blok editörü
- Sürüklenebilir ayırıcı
- Panel genişliğini ayarlarda saklama
- Not kartına tıklayınca doğru notu açma
- Geri dönüşte pano durumunu koruma

## Üst bar

- Geri dön
- Düzenlenebilir başlık
- Kaydediliyor / Kaydedildi / Hata durumu
- Son kaydetme zamanı
- Favori
- Sabitleme
- Dışa aktarma
- İşlem menüsü

SLICE-027 itibarıyla üst bardaki **Dışa aktar** işlemi önce bekleyen otomatik kaydı flush eder, ardından erişilebilir biçim seçme penceresinden Markdown, TXT, sürümlü WovenNote JSON veya PDF üretir. Başarı, kullanıcı iptali ve yazma hatası birbirinden ayrılan görünür durumlarla gösterilir. Kaydetme hedefi yalnızca main process içindeki işletim sistemi penceresinden seçilir; renderer ham dosya yolu görmez. PDF görünümü A4 sayfalama, tablolar ve oranı korunan gömülü görseller için ayrı baskı stilleri kullanır.

## Desteklenen bloklar

- Paragraf
- H1/H2/H3
- Madde listesi
- Numaralı liste
- Yapılacaklar listesi
- Alıntı
- Kod
- Ayırıcı
- Bağlantı
- Tablo
- Görsel
- GIF
- Video
- YouTube videosu
- Dosya eki

JPG/JPEG/JPE/JFIF görseller görsel bloğu olarak eklenir. PDF dosyaları güvenli dosya eki kartı
olarak saklanır ve yalnız attachment kimliği üzerinden işletim sisteminin PDF okuyucusunda açılır.
Standart YouTube `watch`, `youtu.be`, `shorts`, `live` ve `embed` bağlantıları **Bağlantı ekle**
alanında algılanır; belgeye yalnız doğrulanmış 11 karakterli video kimliği yazılır ve bağlantı
oynatılabilir, sandbox uygulanmış bir YouTube bloğuna dönüştürülür. Diğer HTTP/HTTPS adresleri
normal metin bağlantısı olarak kalır.

## Editör davranışı

- Bloklar sürüklenebilir.
- Medya iki paragraf arasına yerleştirilebilir.
- Medya yeniden boyutlandırılabilir.
- Hizalama seçenekleri bulunur.
- Yerel ve YouTube video blokları Sol, Orta ve Sağ kontrolleriyle hizalanır. Video blok tutamacı
  aynı satır içinde yatay sürüklendiğinde bırakılan yatay bölgeye hizalanır; klavye kullanıcıları
  `Alt+Sol` ve `Alt+Sağ` ile aynı işlemi yapabilir. Seçim editör JSON'unda kalıcıdır.
- Uzun notlar akıcı şekilde kaydırılır.
- Seçili metin balonunda yalnız temel biçimlendirme bulunur; ayrı `AI işlemi` seçimi gösterilmez.
- Araç çubuğundaki **Resim ekle**, **Video ekle** ve **PDF veya dosya ekle** komutları ayrı MIME
  kategorileri kullanır. Resimler veya videolar PDF/dosya komutundan eklenemez.
- JPG/JPEG/JPE/JFIF desteği yalnız **Resim ekle** komutunda diğer görsel biçimleriyle birlikte sunulur.
- Klavye kısayolları çalışır.
- İçerik JSON olarak serileştirilir.

## Editör belge zarfı

Editör içeriği aşağıdaki sürümlü zarfla saklanır:

```json
{
  "documentVersion": 1,
  "editor": "tiptap",
  "content": {}
}
```

- `documentVersion` uygulamanın editör içerik migration sürümüdür.
- `editor` ilk sürümde sabit olarak `tiptap` değeridir.
- `content` Tiptap JSON dokümanıdır.
- Görsel, GIF, video ve dosya eki node'ları dosya yolu taşımaz; yalnızca `attachmentId` saklar.
- `attachmentId`, güvenli main-process attachment servisi tarafından çözülür.

## Kaydetme geçişi

- SLICE-009 ve SLICE-010 sırasında üst bardaki gerçek Kaydet işlemi başlık, editör zarfı ve türetilmiş `preview` ile `searchText` alanlarını tek işlemde kalıcılaştırır.
- SLICE-011 bu manuel akışı debounce otomatik kaydetmeye dönüştürür.
- SLICE-011 sonrasında `Ctrl+S`, bekleyen değişiklikleri hemen flush eden erişilebilir bir kısayol olarak kalır.
