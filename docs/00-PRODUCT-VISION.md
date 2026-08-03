# Ürün Vizyonu ve Kapsam

## Ürün adı

Çalışma adı: **WovenNote**

## Amaç

WovenNote, kullanıcıların farklı konu ve projeleri kart tabanlı bir ana ekranda yönetebildiği, her not için gelişmiş blok editörü ve nota özel yapay zekâ sohbeti sağlayan Windows masaüstü uygulamasıdır.

## Ana kullanıcı akışı

1. Kullanıcı ana ekranda not kartlarını görür.
2. Yeni not oluşturur veya mevcut karta tıklar.
3. Not detay ekranında sağ taraftaki editörde içerik oluşturur.
4. Sol taraftaki AI panelinden açık not hakkında soru sorar.
5. AI yanıtını önizleyerek nota ekler veya seçili metnin yerine uygular.
6. Tüm içerik otomatik olarak yerel veritabanına kaydedilir.

## Temel ilkeler

- Local-first çalışır.
- AI olmadan tüm temel not özellikleri kullanılabilir.
- AI yalnızca gerekli not içeriğini gönderir.
- Kullanıcı verisi varsayılan olarak yerel kalır.
- UI modern, ferah ve profesyoneldir.
- Kartlar yapışkan not hissi verir ancak çocukça görünmez.
- Özellikler küçük vertical slice görevleriyle geliştirilir.

## İlk sürüm kapsamı

- Not CRUD
- Kart tabanlı ana ekran
- Kart konumlandırma ve boyutlandırma
- Not detay ekranı
- Blok tabanlı editör
- Medya blokları
- Otomatik kaydetme
- Nota özel AI sohbeti
- AI yanıtını nota ekleme
- Arama, etiket, favori, arşiv ve çöp kutusu
- Dışa aktarma, yedekleme ve geri yükleme
- Açık, koyu ve sistem teması
- Windows build

## Kapsam dışı ilk sürüm

- Çok kullanıcılı gerçek zamanlı ortak çalışma
- Mobil uygulama
- Bulut senkronizasyonu
- Kullanıcı hesabı sistemi
- Takvim entegrasyonu
- Genel internet araması
- Notların izinsiz sunucuya gönderilmesi
