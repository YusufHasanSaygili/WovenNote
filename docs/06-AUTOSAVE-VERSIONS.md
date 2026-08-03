# Otomatik Kaydetme ve Sürüm Geçmişi

## Otomatik kaydetme

- Her tuşta veritabanına yazılmaz.
- Debounce uygulanır.
- Başlık, içerik ve düzen değişiklikleri kaydedilir.
- Kaydetme sırasında tekrar eden istekler birleştirilir.
- Son değişiklik kaybolmamalıdır.
- Uygulama kapanırken bekleyen değişiklikler mümkünse flush edilir.
- Kaydetme hatası kullanıcıya anlaşılır biçimde gösterilir.

## Durumlar

- `idle`
- `dirty`
- `saving`
- `saved`
- `error`

## Sürüm geçmişi

- Her küçük tuşta sürüm oluşturulmaz.
- Anlamlı zaman aralığı veya değişiklik büyüklüğü kullanılır.
- Kullanıcı sürüm tarihini ve önizlemesini görebilir.
- Eski sürüme dönmeden önce mevcut içerik ayrı sürüm olarak korunur.
- Geri yükleme işlemi onay ister.

SLICE-024 uygulaması:

- Checkpoint kararı renderer zamanlamasına bırakılmaz; main process kaydetme sırasında mevcut ve
  gelecek sürümlü editör zarflarını karşılaştırır.
- İlk gerçek içerik değişiminden önce bir temel checkpoint oluşturulur. Sonraki küçük kaydetmeler,
  son checkpoint üzerinden 10 dakika geçmedikçe yeni sürüm üretmez. Düz metin uzunluğu farkı 500
  karakter veya daha fazlaysa zaman aralığı beklenmeden checkpoint alınır.
- Aynı `contentJson` art arda checkpoint edilmez. Böylece debounce dışından gelen yinelenen
  kaydetme çağrıları da sürüm patlaması oluşturmaz.
- Sürüm geçmişi ekranı checkpoint tarihini, sebebini ve en fazla 240 karakterlik düz metin
  önizlemesini gösterir. Ham HTML çalıştırılmaz.
- Geri yükleme `RESTORE_VERSION` IPC onayı ve arayüzde ayrı bir onay adımı gerektirir. Seçilen
  sürüm uygulanmadan önce mevcut `contentJson`, `restore` sebebiyle yeni bir checkpoint olarak
  saklanır; böylece geri yükleme öncesi içerik tekrar seçilebilir.
- Gerçek zamanlı diff ve otomatik sürüm budama politikası bu slice kapsamı dışındadır.
