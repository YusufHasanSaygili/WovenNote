# Veri Modeli ve Migration Kuralları

## Notes

- id
- title
- preview
- searchText
- contentJson
- color
- gridX
- gridY
- gridWidth
- gridHeight
- isPinned
- isFavorite
- isArchived
- deletedAt
- lastOpenedAt
- createdAt
- updatedAt

`contentJson`, sürümlü editör zarfının JSON string karşılığını saklar:

```json
{
  "documentVersion": 1,
  "editor": "tiptap",
  "content": {}
}
```

`documentVersion`, uygulamanın editör şema migration'larını yönetir. Tiptap içeriği `content` alanında bulunur. Medya node'ları doğrudan veya göreli dosya yolu değil yalnızca `attachmentId` taşır. Gerçek `relativePath` yalnızca Attachments tablosunda ve main process erişiminde kalır.

`preview`, kartlarda gösterilen kısa metindir. `searchText`, notun aranabilir tam düz metin karşılığıdır. `lastOpenedAt`, Son Kullanılanlar görünümünün sıralamasını sağlar.

## Tags

- id
- name
- color
- createdAt

## NoteTags

- noteId
- tagId

SLICE-022 ile eklenen migration sürümü 5, `Tags` ve `NoteTags` tablolarını oluşturur. Etiket adı
`wovennote_search_fold` ile Türkçe büyük/küçük harf ve boşluk farklarından bağımsız benzersizdir;
renk izin verilen sabit paletten IPC sözleşmesinde doğrulanır. `NoteTags` bileşik birincil anahtarı
aynı etiketin aynı nota iki kez atanmasını engeller. Her iki yabancı anahtar da `ON DELETE CASCADE`
kullanır. Bir nota en fazla 20 farklı etiket atanabilir ve atama işlemi tek transaction'da yapılır.

## Attachments

- id
- noteId
- blockId
- originalFileName
- storedFileName
- relativePath
- mimeType
- fileSize
- width
- height
- createdAt

## ChatSessions

- id
- noteId
- title
- createdAt
- updatedAt

SLICE-018 ile eklenen migration sürümü 4, sohbet oturumlarını nota `ON DELETE CASCADE` yabancı
anahtarıyla bağlar ve `noteId, updatedAt` üzerinde indeksler. İlk sohbet gönderiminde nota ait bir
oturum oluşturulur; sonraki mesajlar son oturumda devam eder.

## ChatMessages

- id
- sessionId
- role
- content
- status
- createdAt

`role` yalnızca `user` veya `assistant`; `status` yalnızca `pending`, `complete`, `error` veya
`cancelled` olabilir. Mesajlar `sessionId, createdAt` sırasını destekleyen indeksle okunur.

## NoteVersions

- id
- noteId
- contentJson
- reason
- createdAt

`NoteVersions.contentJson`, `Notes.contentJson` ile aynı sürümlü editör zarfını saklar.

SLICE-024 ile eklenen migration sürümü 6, `NoteVersions` tablosunu nota `ON DELETE CASCADE`
yabancı anahtarıyla bağlar ve `noteId, createdAt DESC, id DESC` sıralaması için indeksler.
`reason` yalnız `autosave` veya `restore` olabilir. Sürüm önizlemesi ayrı ve eskiyebilecek bir alan
olarak saklanmaz; main process doğrulanmış `contentJson` zarfından talep sırasında güvenli düz metin
üretir.

## Settings

- key
- valueJson
- updatedAt

## Migration kuralları

- Veritabanı şeması migration ile yönetilmelidir.
- Uygulama açılışında bekleyen migration'lar güvenli biçimde uygulanmalıdır.
- Migration başarısız olursa veri kaybı yaratacak otomatik sıfırlama yapılmamalıdır.
- Testlerde geçici ve izole veritabanı kullanılmalıdır.
- SQL sorguları parametreli olmalıdır.
- Tarihler tek formatta saklanmalıdır.
- Veritabanı migration'ları ile editör belge migration'ları ayrı sürümlenmelidir.
