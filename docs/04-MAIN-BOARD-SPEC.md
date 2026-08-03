# Ana Pano Gereksinimleri

## Kart içeriği

- Başlık
- Düz metin önizleme
- Son düzenlenme tarihi
- Etiketler
- Sabitlenmiş ve favori durumları
- Renk
- Üç nokta menüsü

## Kart işlemleri

- Aç
- Yeniden adlandır
- Çoğalt
- Sabitle
- Favoriye ekle
- Arşivle
- Çöp kutusuna taşı
- Renk değiştir
- Etiket yönet

## Kart yerleşimi

- Grid yerleşimi
- Sürükle-bırak ile konum değişimi
- Köşeden modüler boyutlandırma
- Örnek boyutlar: 3x4, 4x3, 6x2
- Minimum genişlikte bir satıra en fazla 4, maksimum genişlikte bir satıra 2 kart sığar.
- Minimum ve maksimum grid sınırları
- Çakışma çözümü
- Konum ve boyutların kalıcı saklanması
- Pencere boyutu değişince kullanılabilir reflow

## Üst bar

- Logo veya uygulama adı
- Arama
- Yeni not
- Grid/liste görünümü
- Tema
- Ayarlar

## Yan menü

- Tüm notlar
- Sabitlenenler
- Son kullanılanlar
- Favoriler
- Arşiv
- Çöp kutusu
- Etiketler
- Ayarlar

## Arama

SLICE-021 başlık ve tam düz metin `searchText` alanında arama yapar. SLICE-022, etiketler oluşturulduktan sonra aynı arama akışını etiket adlarını kapsayacak şekilde genişletir. Destekleniyorsa AI sohbet geçmişi daha sonra kapsama alınabilir. Sonuçlar debounce ile anlık filtrelenir.

SLICE-021'de debounce süresi 250 ms'dir. Arama sonucu yoksa pano, normal "ilk not" boş
durumundan farklı bir mesaj ve aramayı temizleme eylemi gösterir. Arama hatası mevcut tüm-notlar
listesini bozmaz ve yeniden deneme sunar.

SLICE-022'de kart menüsü sabitleme, favori durumu ve çoklu etiket yönetimini gerçek IPC
işlemleriyle günceller. Kart üzerinde sabit/favori durum ikonları ve renkli etiket rozetleri
gösterilir. Yan menüdeki Sabitlenenler ve Favoriler filtreleri yerel listeyi anında süzer; arama
aktifken de seçili organizasyon filtresi korunur. Bu durumların tamamı SQLite'ta saklanır.
