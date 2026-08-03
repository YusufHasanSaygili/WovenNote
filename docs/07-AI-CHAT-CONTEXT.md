# AI Sohbeti ve Bağlam Yönetimi

## Temel davranış

AI paneli açık notla ilişkilidir. Varsayılan bağlam:

- Not başlığı
- Not içeriği
- Gerekli son sohbet mesajları
- Kullanıcının güncel sorusu

Bütün uygulama verisi gönderilmez.

Renderer AI isteğinde yalnızca `noteId`, kullanıcı mesajı ve tek kullanımlık `requestId` gönderir.
Başlık veya not içeriği IPC payload'ından kabul edilmez. Main process, `noteId` ile aktif notu
repository'den yükler ve bağlamı burada oluşturur. Gönderimden hemen önce bekleyen editör kaydı
flush edilir; kaydetme başarısızsa AI isteği gönderilmez.

Bir istek bağlamı şu sınırlarla hazırlanır:

- yalnızca istenen aktif notun başlığı ve düz metin içeriği,
- aynı nota bağlı en son 12 tamamlanmış sohbet mesajı,
- her geçmiş mesaj için en fazla 4.000 karakter,
- not içeriği için en fazla 40.000 karakter,
- kullanıcının güncel sorusu.

Not sınırı aşarsa bağlam açık bir kesilme işareti taşır ve UI kullanıcıya kapsamın 40.000
karakterle sınırlandığını bildirir.

## AI örnek görevleri

- Özetleme
- Eksik görev bulma
- Önceliklendirme
- Yazım düzeltme
- Profesyonel yeniden yazma
- Liste veya tablo oluşturma
- Çeviri
- Çelişki analizi
- Ölçü veya alışveriş listesi çıkarma

## Yanıt işlemleri

- Panoya kopyala
- Yeni blok olarak nota ekle
- Seçili metnin yerine önizleme ile uygula
- Yeni not oluştur
- Yeniden oluştur

SLICE-019 davranışı:

- Yalnızca `complete` durumundaki asistan yanıtlarında açık kullanıcı eylemleri gösterilir.
- Renderer ana sürece yanıt metnini veya not içeriğini göndermez; yalnızca `noteId` ve
  `messageId` gönderir. Ana süreç mesajın tamamlanmış bir asistan yanıtı olduğunu ve ilgili nota
  ait olduğunu yeniden doğrular.
- "Nota ekle" için güvenli varsayılan konum açık notun sonudur. İşlemden önce bekleyen yerel
  değişiklikler kaydedilir; seçili metni değiştirme bu slice kapsamında değildir.
- "Yeni not oluştur" kaynak başlıktan türetilmiş bir başlıkla ayrı ve dolu bir not oluşturur;
  açık notu otomatik olarak değiştirmez.
- Başarı ve hata geri bildirimi erişilebilir canlı durum alanında sunulur. Otomatik geri alma,
  çok kullanıcılı/değişiklik çakışması semantiği gerektirdiği için bu slice'a eklenmez.

SLICE-020 seçili metin altyapısı:

- Seçim balonunda özetle, düzelt, yeniden yaz, kısalt, uzat, profesyonelleştir, listeye
  dönüştür, çevir ve açıkla işlemleri bulunur. Çevir işlemi Türkçe metni İngilizceye, diğer
  dilleri Türkçeye çevirir.
- Seçim en fazla 8.000 karakterdir. Bekleyen editör değişiklikleri önce kaydedilir; main process
  seçili metnin kaydedilmiş açık notta bulunduğunu doğrular ve OpenAI'ye yalnızca seçili metni
  gönderir.
- Sonuç özgün ve önerilen metni yan yana gösteren bir önizlemede sunulur. İptal ve hata notu
  değiştirmez; yeniden oluşturma yeni bir `requestId` ile yeni istek yapar.
- Kabul sırasında Tiptap aralığının hâlâ aynı metni içerdiği yeniden doğrulanır. Aralık veya içerik
  değişmişse sonuç uygulanmaz; kullanıcıdan yeniden seçim yapması istenir.
- Kabul edilen düz metin güvenli text node olarak, liste sonucu ise güvenli Tiptap liste node'ları
  olarak eklenir. AI çıktısı HTML olarak yorumlanmaz.

Güncel ürün arayüzünde seçili metin balonundaki `AI işlemi` seçim kutusu gösterilmez. Kullanıcıya
açık AI etkileşimi nota özel sohbet panelinden sunulur; inline IPC/service altyapısı geriye dönük
belge ve güvenlik testleri için korunur.

## Güvenlik ve gizlilik

- Gönderilecek not açıkça gösterilir.
- API anahtarı renderer kodunda bulunmaz.
- Notlar kullanıcı eylemi olmadan API'ye gönderilmez.
- Loglara not içeriği veya API anahtarı yazılmaz.
- Hata durumunda uygulama çökmez.
- OpenAI Responses API çağrısı `store: false` ile main process içinde yapılır.
- UI kullanıcı mesajını hemen gösterir ve yanıt beklerken akıcı bir yüklenme durumu sunar.
- Her aktif istek main process'te bir `AbortController` ile izlenir. Kullanıcının iptal komutu
  yalnızca allowlist edilmiş `requestId` üzerinden çalışır.
- Tamamlanan, hatalı ve iptal edilen yanıtlar notun sohbet oturumuna terminal durumlarıyla
  kaydedilir. Uygulama kapanırken yarım kalan `pending` mesajlar sonraki açılışta `cancelled`
  durumuna çevrilir.

## Uzun notlar

Uzun içeriklerde token sınırı dikkate alınmalı; uygun bölüm seçimi veya parçalama yapılmalıdır. Sessizce kritik içeriği atmak yerine kullanıcıya kapsam açıklanmalıdır.
