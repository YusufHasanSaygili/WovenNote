# Güvenlik, Performans ve Genel Hata Yönetimi

## Electron güvenliği

- `contextIsolation: true`
- `nodeIntegration: false`
- Güvenli preload API
- Allowlist IPC
- Runtime input validation
- XSS sanitizasyonu
- Güvenli external URL açma
- Dosya yolu traversal koruması

## Performans

- Yüzlerce notla akıcı liste
- Gereksiz render azaltma
- Uzun notlarda editör performansı
- Büyük medya için dosya tabanlı saklama
- AI streaming sırasında UI donmaması
- Arama debounce veya indeksleme

## Hata yönetimi

- Veritabanı açılışı
- Kaydetme
- Silme
- Dosya ekleme
- Dışa aktarma
- İçe aktarma
- AI çağrısı
- Medya açma
- Uygulama başlatma

Tek bir not veya dosya hatası uygulamanın tamamını kapatmamalıdır.

## SLICE-029 sertleştirme tabanı

- IPC allowlist'i tekil olmalı; her kanal main process'te tam bir kez kaydedilmeli ve yalnız preload tarafından tam bir kez çağrılmalıdır. Kaynak tabanlı regresyon testi bu üç kümeyi birebir karşılaştırır.
- Merkezi doğrulanmış IPC handler, Zod şemasından önce payload'ı iteratif olarak sınırlar: en fazla 64 derinlik, 100.000 düğüm ve toplam 8 MiB metin. Döngüsel, aşırı derin, aşırı büyük veya plain object/array dışındaki container'lar service katmanına ulaşmadan reddedilir.
- Renderer kaynakları `electron`, Node.js built-in modülleri veya `better-sqlite3` import edemez; raw `ipcRenderer` ve `dangerouslySetInnerHTML` kullanımı regresyon testinde yasaktır.
- CSP yalnız harici ve aynı kaynaktaki scriptleri kabul eder. Sabit/predictable nonce kaldırılmış, development HMR inline preamble üretmemesi için kapatılmıştır; `unsafe-inline` ve `unsafe-eval` yoktur.
- Editör linkleri yalnız kimlik bilgisi taşımayan HTTP/HTTPS veya CR/LF enjeksiyonu içermeyen e-posta adreslerine izin verir. `target`, `rel` ve `class` değerleri güvenli Tiptap allowlist'i ile sınırlıdır.
- YouTube video blokları yalnız allowlist içindeki YouTube hostlarından doğrulanmış 11 karakterli
  video kimliği kabul eder. Renderer CSP yalnız `https://www.youtube-nocookie.com` frame kaynağına
  izin verir; iframe sandbox uygulanmış ve normal pencere açma/navigasyon sertleştirmesi korunmuştur.
- PDF HTML üretimi not başlığı, metin ve link attribute'larını escape eder. Renderer E2E testi saldırgan biçimli başlığın DOM node'u veya script çalıştırması üretmediğini doğrular.
- Attachment ve backup dosya yolları kontrollü kökün içinde çözülür; traversal, bozuk ZIP girdileri ve yalnız kimlik yerine raw yol gönderen IPC payload'ları reddedilir. Dış uygulamada açma yalnız repository tarafından çözülen attachment kimliği üzerinden yapılır.
- 3.000 notun listelenmesi/aranması 1.500 ms test bütçesi içindedir. 5.000 bloklu yaklaşık 1 MiB not doğrulama ve düz metin çıkarma 2.000 ms bütçesi içindedir. 100 MiB sınırını aşan sparse medya dosyası okunmadan veya kopyalanmadan reddedilir.
- Üretim bağımlılıkları `npm audit --omit=dev --audit-level=high` ile denetlenir; SLICE-029 tamamlanırken bilinen vulnerability bulunmamıştır.

## Tema ve erişilebilirlik sınırları

- Tema tercihi hassas veri değildir ve yalnız renderer `localStorage` alanında tutulur; tema için
  yeni IPC veya main-process yetkisi açılmaz.
- `system` tercihi `matchMedia('(prefers-color-scheme: dark)')` değişiklik aboneliğiyle çözülür ve
  abonelik component kapanırken kaldırılır.
- Modal focus trap yalnız mevcut DOM içindeki allowlist edilmiş odaklanabilir kontrolleri dolaşır;
  renderer dışı yetki veya ham Electron nesnesi kullanmaz.
- Klavye akışı ve focus iadesi component testi ile; koyu tema normal metin kontrastı ve not
  oluşturma/açma/geri dönme akışı Electron E2E testiyle doğrulanır. Bu çalışma tam WCAG
  sertifikasyonu yerine ürünün temel erişilebilirlik tabanını oluşturur.
- Windows'ta `Ctrl + mouse tekerleği` sandbox içindeki preload katmanında yakalanır; pencere zoom'u
  Electron `webFrame` üzerinden her adımda değiştirilir ve varsayılan %50–%300 erişilebilirlik
  sınırlarında tutulur. Renderer'a yeni bir Electron veya Node.js yetkisi verilmez.
