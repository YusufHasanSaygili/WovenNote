# UX ve Tasarım Referansları

## Yerleşim yaklaşımı

Ana ekran düzeni şu ilkeleri izler:

- Büyük pano
- Grid içinde not kartları
- Farklı boyutlarda kartlar
- Kart başlığı ve kısa içerik önizlemesi

Not detay düzeni şu ilkeleri izler:

- Sol tarafta dar AI sohbet paneli
- Sağ tarafta geniş not editörü
- İki panel arasında ayarlanabilir ayırıcı

## Tasarım hedefleri

- Modern masaüstü üretkenlik uygulaması
- Ferah boşluk kullanımı
- Yumuşak gölgeler ve dengeli radius
- Tutarlı SVG ikonlar
- Uygulama markasında yuvarlatılmış siyah not sayfası ve dalgalı yazı çizgileri
- Açık, koyu ve sistem teması
- Kalıcı Türkçe ve İngilizce arayüz seçimi
- Minimum pencere boyutunda bozulmayan yapı
- Klavye ile erişilebilir modal ve menüler
- Gereksiz animasyonlardan kaçınma

SLICE-025 tema ve erişilebilirlik uygulaması:

- Tema seçimi `Açık`, `Koyu` ve `Sistem` değerlerinden oluşur. Tercih renderer `localStorage`
  alanındaki sürümlü anahtarda saklanır; çözülmüş renk değil tercih saklandığı için `Sistem` modu
  işletim sistemi `prefers-color-scheme` değişimini uygulama açıkken canlı izler.
- Uygulama arka planı, yüzeyler, kartlar, modallar, editör toolbar'ı, AI sohbeti, durum renkleri,
  sınırlar ve metinler ortak CSS tema tokenlarına bağlanır. Koyu tema yalnız renkleri değiştirir;
  referanslardan türetilen yerleşim geometrisi korunur.
- Normal metin ve ana arka plan kontrastı her iki temada en az 4.5:1 hedefiyle test edilir. Durum
  yalnız renkle anlatılmaz; metin, ikon etiketi veya durum adı da bulunur.
- Tüm modal ve `alertdialog` bileşenleri ortak focus trap kullanır: ilk kontrol odaklanır, Tab ve
  Shift+Tab modal içinde döner, Escape güvenli durumda kapatır ve kapanınca odak tetikleyiciye döner.
- Focus görünümü tüm düğme, giriş ve seçim kontrollerinde yüksek kontrastlı dış çizgi ve çevre
  halkası kullanır. `prefers-reduced-motion` etkinse animasyon ve geçişler en aza indirilir.

## Ana ekran

- Üst bar
- Daraltılabilir sol menü
- Grid veya liste görünümü
- Sürüklenebilir ve boyutlandırılabilir kartlar
- Arama, filtreleme ve yeni not oluşturma
- Kart işlem menüsü
- Dil menüsü (`Türkçe` / `English`); tercih renderer `localStorage` alanında saklanır

## Not detay ekranı

- Üstte geri dön, başlık, kaydetme durumu ve işlemler
- Solda nota özel AI sohbeti
- Sağda blok editörü
- Panel oranı başlangıçta yaklaşık 30/70
- Sürüklenebilir panel ayırıcı
- Kullanıcı tercihini kalıcı saklama
