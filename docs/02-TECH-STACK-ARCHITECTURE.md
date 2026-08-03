# Teknoloji Yığını ve Mimari

## Kesin teknoloji yığını

- Electron
- `electron-vite`
- `electron-builder`
- React 19
- TypeScript strict
- `better-sqlite3`
- Zod
- Tiptap OSS
- Zustand
- `react-grid-layout`
- `react-resizable-panels`
- Node.js main process
- Güvenli preload bridge
- OpenAI API
- Vitest
- React Testing Library
- Playwright Electron
- ESLint
- Prettier

İlk sürüm yalnızca Windows x64 hedefler ve NSIS installer olarak paketlenir. Electron ve diğer bağımlılıkların kullanılan sürümleri lockfile ile sabitlenmelidir.

`better-sqlite3` yalnızca main process içinde çalışır. Zod, IPC giriş ve çıkışlarını runtime'da doğrulamak için kullanılır. Zustand yalnızca renderer içindeki geçici UI state'ini yönetir; SQLite kalıcı gerçek kaynak olmaya devam eder.

## Editör

Blok tabanlı editör için Tiptap OSS kullanılacaktır. Editör headless olarak entegre edilir; medya blokları, sürükle-bırak, tablo, task list, seçili metin komutları ve JSON serileştirme uygulamaya özel uzantılar ve açık kaynak Tiptap uzantılarıyla gerçekleştirilir.

Editör JSON'u sürümlü uygulama zarfı içinde saklanır. Medya node'ları dosya yolu taşımaz; yalnızca `attachmentId` ile main-process attachment servisine referans verir.

## Katmanlar

```text
src/
  main/
    main.ts
    preload.ts
    ipc/
    database/
    repositories/
    services/
  renderer/
    app/
    pages/
    components/
    editor/
    hooks/
    stores/
    services/
    styles/
  shared/
    schemas/
    types/
    constants/
```

## Süreç sınırları

- Renderer doğrudan SQLite veya dosya sistemi kullanmaz.
- Main process veritabanı, dosya sistemi ve güvenli sır saklama işlemlerini yapar.
- Preload yalnızca allowlist edilmiş tipli API sunar.
- IPC giriş ve çıkışları Zod şemalarıyla runtime'da doğrulanır.
- Renderer'da Node.js entegrasyonu kapalıdır.
- Renderer sandbox içinde ve context isolation açık çalışır.
- Renderer'a raw `ipcRenderer` verilmez.

## State yönetimi

Küçük ve öngörülebilir bir store kullanılabilir. Sunucu state benzeri karmaşıklık eklenmemelidir. Veritabanı gerçek kaynak olarak kalmalıdır.

## Veri serileştirme

Not içeriği sürümlü Tiptap JSON zarfı olarak saklanmalıdır. Liste ekranı için kısa `preview`, tam içerik araması için ayrı `searchText` alanı tutulur. Her başarılı içerik kaydında `contentJson`, `preview` ve `searchText` aynı işlem içinde tutarlı biçimde güncellenir.
