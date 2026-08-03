# AI Ayarları ve Hata Senaryoları

## Ayarlar

- API anahtarı
- Bağlantı testi
- Model seçimi
- Maksimum yanıt uzunluğu
- Yaratıcılık düzeyi
- İsteğe bağlı sistem talimatı
- Kullanım bilgisi gösterimi

## Anahtar saklama

- Kaynak koda yazılmaz.
- `.env` gerçek kullanıcı anahtarı için zorunlu çözüm değildir.
- Masaüstü uygulamasında işletim sistemi güvenli saklama çözümü tercih edilir.
- Anahtar varsayılan olarak maskelenir.
- Loglara hiçbir zaman yazılmaz.
- Windows ilk sürümünde Electron `safeStorage` kullanılır; anahtar işletim sistemi korumalı olarak
  şifrelenip `userData/secrets/openai-api-key.bin` içinde SQLite'tan ayrı saklanır.
- `safeStorage` kullanılamıyorsa düz metin veya zayıf şifreleme fallback'i yapılmaz ve anahtar
  kaydetme devre dışı bırakılır.
- Renderer anahtarı okuyamaz. Preload yalnızca kaydetme, silme, yapılandırılma durumu ve bağlantı
  testi komutlarını sunar; maskeli gösterim gerçek anahtar parçası içermeyen sabit
  `••••••••••••` değeridir.
- Şifreli secret dosyası da dahil olmak üzere API anahtarı hiçbir dışa aktarma veya yedeğe dahil
  edilmez.

## Model ve yanıt tercihleri

- Varsayılan model: `gpt-5.6-terra`
- Seçenekler: `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
- Maksimum yanıt uzunluğu, yaratıcılık düzeyi, isteğe bağlı sistem talimatı ve kullanım bilgisi
  gösterimi `Settings` tablosunda hassas olmayan tercihler olarak saklanır.

Model seçenekleri OpenAI'nin güncel model ailesindeki kalite, denge ve ekonomik kullanım rollerini
temsil eder. Bağlantı testi kaydedilmiş anahtarla main process içinde
`GET /v1/models/{model}` çağrısını yapar; anahtarı renderer'a geri göndermez ve 10 saniyede zaman
aşımına uğrar.

Model rol açıklamaları (`En yüksek kalite`, `Dengeli`, `Ekonomik`) uygulamanın seçili diline göre
Türkçe veya İngilizce gösterilir; model kimlikleri dilden bağımsız kalır.

## Yönetilecek hatalar

- Anahtar yok
- Geçersiz anahtar
- İnternet yok
- Rate limit
- Kredi yok
- Timeout
- Sunucu hatası
- İstek iptali
- Bozuk yanıt
- Seçili metnin kaydedilmiş notla eşleşmemesi
- Önizleme açıkken seçili aralığın değişmesi

Her hata kullanıcı dostu mesaja çevrilmeli ve teknik detay geliştirici loguna hassas veri içermeden yazılmalıdır.

Bağlantı testi 401/403 yanıtlarını geçersiz veya yetkisiz anahtar, 404 yanıtını model erişimi,
429 yanıtını rate limit ya da `insufficient_quota`, 5xx yanıtlarını sunucu hatası olarak ayırır.
Başarılı yanıtta model kimliği ayrıca doğrulanır; bozuk yanıt başarı sayılmaz.
