# Test, Kalite ve Release Kuralları

## Test katmanları

- Unit
- React component
- Repository/veritabanı integration
- IPC contract
- E2E veya Electron smoke
- Hata senaryoları

## Her slice sonunda

- Lint
- Type-check
- Build
- İlgili unit/component/integration test
- Kabul kriteri kontrolü

## Temel E2E akışı

1. Uygulama açılır.
2. Not oluşturulur.
3. Kart görünür.
4. Not açılır.
5. İçerik yazılır.
6. Otomatik kaydedilir.
7. Medya eklenir.
8. AI sorusu gönderilir.
9. Yanıt nota eklenir.
10. Uygulama yeniden açılır.
11. Veri korunur.

## Release kontrolü

- Windows x64 NSIS installer oluşturma
- Temiz makine kurulum testi
- README doğruluğu
- `.gitignore`
- Gizli bilgi taraması
- Migration testi
- Yedek geri yükleme testi
- Tüm testlerin başarıyla geçmesi
- Bilinen sınırlamaların yazılması

## Kurulu paket smoke testi

SLICE-030 ile `tests/release/installed-app-smoke.mjs` eklenmiştir. Test yalnız final installer'dan izole bir dizine kurulmuş `WovenNote.exe` ve ayrı, boş bir kullanıcı profili üzerinde çalıştırılır. Renderer süreç sınırını ve güvenli `BrowserWindow` tercihlerini denetler; gerçek SQLite veritabanında not oluşturma/listeleme turu yapar. Test kurulumundan sonra uygulama kendi uninstaller'ı ile kaldırılır ve yalnız doğrulanmış geçici profil temizlenir.

Installer ve blockmap `release/` altında üretilir ve repoya eklenmez. Release raporu artefaktın boyutunu, SHA-256 özetini ve Authenticode durumunu kaydeder. Gerçek ücretli OpenAI çağrısı otomatik kabulün parçası değildir; AI testleri mock transport kullanır ve kullanıcı anahtarıyla yapılacak bağlantı denemesi manuel listede tutulur.
