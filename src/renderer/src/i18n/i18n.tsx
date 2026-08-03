/* eslint-disable react-refresh/only-export-components -- This module owns the language context and its pure persistence helpers. */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const LANGUAGE_STORAGE_KEY = 'wovennote.language.v1'
const LEGACY_LANGUAGE_STORAGE_KEY = ['note', 'gpt.language.v1'].join('')

export type AppLanguage = 'tr' | 'en'
type TranslationParameters = Readonly<Record<string, string | number>>

const ENGLISH_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  'AI ayarları': 'AI settings',
  'AI henüz yapılandırılmadı': 'AI is not configured yet',
  'AI ile konuş': 'Chat with AI',
  'AI sohbet mesajları': 'AI chat messages',
  'Alt metin': 'Alt text',
  'Ana gezinme': 'Main navigation',
  'Ana menü': 'Main menu',
  'Arama alanını temizle': 'Clear search field',
  'Arama metni girin': 'Enter search text',
  'Arama sonuçları': 'Search results',
  'Aramayla eşleşen not yok': 'No notes match your search',
  'Aramayı kapat': 'Close search',
  'Aramayı temizle': 'Clear search',
  'Aramayı tekrar dene': 'Retry search',
  Arşiv: 'Archive',
  'Arşiv boş': 'Archive is empty',
  'Arşiv ve çöp kutusunda arama kapalı': 'Search is disabled in Archive and Trash',
  Arşivle: 'Archive',
  'Arşivlediğiniz notlar burada görünür.': 'Notes you archive appear here.',
  'Arşivden çıkar': 'Unarchive',
  'Bağlantı adresi': 'Link address',
  'Bağlantı düzenleyici': 'Link editor',
  'Bağlantı ekle': 'Insert link',
  'Bağlantıyı kaldır': 'Remove link',
  'Başka bir başlık, içerik veya etiket ifadesi deneyin.':
    'Try another title, content, or tag phrase.',
  'Biçimlendirme işaretlerini göster': 'Show formatting marks',
  'Bildirimi kapat': 'Dismiss notification',
  'Bu not hakkında ne öğrenmek istersin?': 'What would you like to learn about this note?',
  'Bu not henüz içerik içermiyor.': 'This note does not contain any content yet.',
  'Bul (Ctrl+F)': 'Find (Ctrl+F)',
  'Çalışma alanı': 'Workspace',
  'Çöp kutusu': 'Trash',
  'Çöp kutusu boş': 'Trash is empty',
  'Çöp kutusuna taşı': 'Move to trash',
  'Çöp kutusuna taşıdığınız notlar burada görünür.': 'Notes you move to trash appear here.',
  Çoğalt: 'Duplicate',
  'Değişiklikler bekliyor': 'Changes pending',
  'Dosya eki bulunamadı': 'Attachment not found',
  'Dosya eki yükleniyor…': 'Loading attachment…',
  'Dosya seçiliyor…': 'Selecting file…',
  'Dosya taşınmış veya kullanılamıyor olabilir.': 'The file may have been moved or unavailable.',
  'Dosya taşınmış veya silinmiş olabilir.': 'The file may have been moved or deleted.',
  'Dış uygulamada aç': 'Open in external app',
  'Dışa aktar': 'Export',
  Düzenleme: 'Editing',
  Düzenleyici: 'Editor',
  Ekle: 'Insert',
  'Etiketleri yönet': 'Manage tags',
  Favori: 'Favorite',
  'Favoriden çıkar': 'Remove from favorites',
  Favoriler: 'Favorites',
  'Favoriye ekle': 'Add to favorites',
  'Favori not yok': 'No favorite notes',
  'Fikirlerini ve projelerini yerel olarak saklamak için yeni bir not aç.':
    'Create a note to keep your ideas and projects locally.',
  Geçmiş: 'History',
  'Geri al': 'Undo',
  'Geri al (Ctrl+Z)': 'Undo (Ctrl+Z)',
  'Geri yükle': 'Restore',
  'Girintiyi azalt': 'Decrease indent',
  'Girintiyi artır': 'Increase indent',
  'Görsel boyutu': 'Image size',
  'Görsel hizalama': 'Image alignment',
  'Görsel veya GIF ekle': 'Insert image or GIF',
  Resim: 'Image',
  'Resim ekle': 'Add image',
  'Görsel seçiliyor…': 'Selecting image…',
  'Görsel yüklenemedi': 'Image could not be loaded',
  'Görseli büyüt': 'Enlarge image',
  'Görseli küçült': 'Shrink image',
  'Görseli kısaca açıklayın': 'Briefly describe the image',
  'Grid görünümü': 'Grid view',
  Hazır: 'Ready',
  'İlk notunu oluştur': 'Create your first note',
  İngilizce: 'English',
  İptal: 'Cancel',
  'Kalıcı sil': 'Delete permanently',
  'Kart menüsünden bir notun durumunu değiştirebilirsiniz.':
    'You can change a note status from its card menu.',
  'Kartı sürükle': 'Drag card',
  Kaydedildi: 'Saved',
  'Kaydediliyor…': 'Saving…',
  'Kaydetme hatası': 'Save error',
  'Kod bloğu': 'Code block',
  Koyu: 'Dark',
  'Liste görünümü': 'List view',
  'Madde işaretleri': 'Bullets',
  'Madde listesi': 'Bulleted list',
  'Menüyü daralt': 'Collapse menu',
  'Menüyü genişlet': 'Expand menu',
  'Metadata okunuyor.': 'Reading metadata.',
  Not: 'Note',
  'Not başlığı': 'Note title',
  'Not detayı': 'Note details',
  'Not editörü': 'Note editor',
  'Not etiketleri': 'Note tags',
  'Not görünümü': 'Note view',
  'Not içinde ara': 'Search within note',
  'Not panosu': 'Note board',
  'Notlarda ara': 'Search notes',
  'Notlarda aranıyor…': 'Searching notes…',
  Notlar: 'Notes',
  'Notlar yükleniyor…': 'Loading notes…',
  'Nota özel alan': 'Note-specific area',
  'Nota özel sohbet': 'Note-specific chat',
  Numaralandırma: 'Numbering',
  'Numaralı liste': 'Numbered list',
  Orta: 'Center',
  Ortala: 'Center',
  'PDF veya dosya eki ekle': 'Insert PDF or file attachment',
  Pano: 'Board',
  'Panel oranı': 'Panel ratio',
  'Panoya dön': 'Back to board',
  Paragraf: 'Paragraph',
  Sağ: 'Right',
  'Sağa hizala': 'Align right',
  Sabitle: 'Pin',
  'Sabitlemeyi kaldır': 'Unpin',
  Sabitlenenler: 'Pinned',
  Sabitlenmiş: 'Pinned',
  'Sabitlenmiş not yok': 'No pinned notes',
  'Satır aralığı': 'Line spacing',
  'Seçilen dosya bu medya komutuyla uyumlu değil.':
    'The selected file is not compatible with this media command.',
  'Silinme {{time}}': 'Deleted {{time}}',
  Sistem: 'System',
  Sol: 'Left',
  'Sola hizala': 'Align left',
  'Son kayıt {{time}}': 'Last saved {{time}}',
  'Son düzenleme {{time}}': 'Last edited {{time}}',
  'Sonraki eşleşme': 'Next match',
  'Sonuç yok': 'No results',
  'Sürüm geçmişi': 'Version history',
  'Şimdi kaydet': 'Save now',
  'Tam genişlik': 'Full width',
  'Tekrar dene': 'Try again',
  Tema: 'Theme',
  'Temel bloklar': 'Basic blocks',
  'Tüm notlar': 'All notes',
  'Tüm notlara dön': 'Back to all notes',
  Türkçe: 'Turkish',
  Uygula: 'Apply',
  'Video ekle': 'Insert video',
  'Video seçiliyor…': 'Selecting video…',
  'Yatay ayırıcı': 'Horizontal rule',
  'Yatay ayırıcı ekle': 'Insert horizontal rule',
  'Yazı tipi': 'Font',
  'Yazı tipi araçları': 'Font tools',
  Yedek: 'Backup',
  'Yeni Not': 'New Note',
  'Yeni not oluştur': 'Create new note',
  'Yerel çalışma alanı': 'Local workspace',
  Yinele: 'Redo',
  'Yinele (Ctrl+Y)': 'Redo (Ctrl+Y)',
  'Yapılacaklar listesi': 'Task list',
  'Yükleniyor…': 'Loading…',
  'Yeniden adlandır': 'Rename',
  'Önceki eşleşme': 'Previous match',
  Açık: 'Light',
  'Açılıyor…': 'Opening…',
  Dil: 'Language',
  'Başlık, içerik ve etikette ara…': 'Search titles, content, and tags…',
  '{{count}} not': '{{count}} notes',
  '{{title}} notunu aç': 'Open {{title}}',
  '{{title}} işlemleri': 'Actions for {{title}}',
  'Altı çizili': 'Underline',
  'İki yana yasla': 'Justify',
  İtalik: 'Italic',
  Kalın: 'Bold',
  Kırmızı: 'Red',
  Mavi: 'Blue',
  'Metin rengi': 'Text color',
  Mor: 'Purple',
  Punto: 'Font size',
  'Puntoyu büyüt': 'Increase font size',
  'Puntoyu küçült': 'Decrease font size',
  Sarı: 'Yellow',
  Siyah: 'Black',
  Turuncu: 'Orange',
  Vurgu: 'Highlight',
  'Vurgu rengi': 'Highlight color',
  Yeşil: 'Green',
  varsayılan: 'default',
  bayt: 'bytes',
  Görsel: 'Image',
  'Görseli sola hizala': 'Align image left',
  'Görseli ortaya hizala': 'Center image',
  'Görseli sağa hizala': 'Align image right',
  'Dosya artık güvenli saklama alanında bulunamıyor.':
    'The file is no longer available in secure storage.',
  Tablo: 'Table',
  'Tablo araçları': 'Table tools',
  'Tabloyu sil': 'Delete table',
  'Satır ekle': 'Add row',
  'Satırı sil': 'Delete row',
  'Sütun ekle': 'Add column',
  'Sütunu sil': 'Delete column',
  '3 × 3 tablo ekle': 'Insert 3 × 3 table',
  'Geri alınamaz işlem': 'Irreversible action',
  'Kritik işlem': 'Critical action',
  Kaydet: 'Save',
  'Kalıcı olarak sil': 'Delete permanently',
  'Kalıcı olarak siliniyor…': 'Deleting permanently…',
  'Not başlığı boş bırakılamaz.': 'Note title cannot be empty.',
  'Not işlemi': 'Note action',
  'Not kalıcı olarak silinsin mi?': 'Delete note permanently?',
  'Not çöp kutusuna taşınsın mı?': 'Move note to trash?',
  'Notu oluştur': 'Create note',
  'Notu yeniden adlandır': 'Rename note',
  'Notunu panoda bulabilmek için kısa bir başlık ver.':
    'Give your note a short title so you can find it on the board.',
  'Oluşturuluyor…': 'Creating…',
  'Taşınıyor…': 'Moving…',
  'Yeni başlık kaydedildiğinde panodaki kart hemen güncellenir.':
    'The card on the board updates as soon as the new title is saved.',
  'Yeni çalışma alanı': 'New workspace',
  'Örneğin: Ürün fikirleri': 'For example: Product ideas',
  'AI ayarlarını kaydet': 'Save AI settings',
  'AI ayarları yükleniyor…': 'Loading AI settings…',
  'AI yapılandırması': 'AI configuration',
  'Anahtarı sil': 'Delete key',
  Ayarlar: 'Settings',
  'Bağlantı test ediliyor…': 'Testing connection…',
  'Bağlantıyı test et': 'Test connection',
  'Değiştirmek için yeni anahtarı girin': 'Enter a new key to replace it',
  Dengeli: 'Balanced',
  'Güvenli bağlantı': 'Secure connection',
  'GPT-5.6 Luna — Ekonomik': 'GPT-5.6 Luna — Economical',
  'GPT-5.6 Sol — En yüksek kalite': 'GPT-5.6 Sol — Highest quality',
  'GPT-5.6 Terra — Dengeli': 'GPT-5.6 Terra — Balanced',
  'Kayıtlı anahtar': 'Saved key',
  'Kayıtlı anahtar yok': 'No saved key',
  Kesin: 'Precise',
  'Kullanım bilgisini AI yanıtlarında göster': 'Show usage information in AI responses',
  'Maksimum yanıt uzunluğu': 'Maximum response length',
  Model: 'Model',
  'Model ve yanıt ayarları': 'Model and response settings',
  'Not panosuna dön': 'Back to note board',
  'OpenAI API anahtarı': 'OpenAI API key',
  'Yeni API anahtarı': 'New API key',
  'Yanıt tercihleri': 'Response preferences',
  Yapılandırıldı: 'Configured',
  Yapılandırılmadı: 'Not configured',
  Yaratıcı: 'Creative',
  'Yaratıcılık düzeyi': 'Creativity level',
  'İsteğe bağlı sistem talimatı': 'Optional system instruction',
  'Örneğin: Yanıtları kısa ve Türkçe ver.': 'For example: Keep responses short and in English.',
  "AI'a sor": 'Ask AI',
  'AI paneli hazırlanıyor…': 'Preparing AI panel…',
  'AI sohbetini kullanmak için AI ayarlarında güvenli bir API anahtarı kaydedin.':
    'Save a secure API key in AI settings to use AI chat.',
  'AI yanıtı eylemleri': 'AI response actions',
  'Bu not hakkında sor…': 'Ask about this note…',
  'Ekleniyor…': 'Adding…',
  Gönder: 'Send',
  'Gönderilecek bağlam:': 'Context to send:',
  'İsteği iptal et': 'Cancel request',
  'Kopyalanıyor…': 'Copying…',
  'Nota ekle': 'Add to note',
  Sen: 'You',
  'Uzun not bağlamı 40.000 karakterle sınırlandı.':
    'Long note context was limited to 40,000 characters.',
  'Yanıtı kopyala': 'Copy response',
  'Özet, öncelikler, eksik görevler veya yeniden yazım isteyebilirsin.':
    'You can ask for a summary, priorities, missing tasks, or a rewrite.',
  'Başlıkları, listeleri ve temel metin biçimlerini korur.':
    'Preserves headings, lists, and basic text formatting.',
  'Biçimlendirmesiz, okunabilir metin oluşturur.': 'Creates readable plain text.',
  'Dışa aktarma biçimleri': 'Export formats',
  'Dışa aktarma iptal edildi.': 'Export cancelled.',
  'Düz metin (.txt)': 'Plain text (.txt)',
  Kapat: 'Close',
  'PDF belgesi (.pdf)': 'PDF document (.pdf)',
  'Sayfalara bölünmüş, yazdırılabilir bir belge oluşturur.':
    'Creates a paginated, printable document.',
  'Sürümlü ve doğrulanabilir WovenNote not verisi oluşturur.':
    'Creates versioned, verifiable WovenNote note data.',
  'Tek not dışa aktarma': 'Single note export',
  'Notu dışa aktar': 'Export note',
  '{{fileName}} başarıyla kaydedildi.': '{{fileName}} was saved successfully.',
  'Video yüklenemedi': 'Video could not be loaded',
  'Dosya taşınmış, silinmiş veya oynatılamıyor olabilir.':
    'The file may have been moved, deleted, or cannot be played.',
  'Yerel video': 'Local video',
  'API anahtarı ve diğer secret değerler dahil edilmez.':
    'The API key and other secret values are not included.',
  'Dosyayı değiştir': 'Choose another file',
  'Dosya önce doğrulanır; hiçbir veri hemen değiştirilmez.':
    'The file is validated first; no data is changed immediately.',
  'Gelenle değiştir': 'Replace with incoming',
  'Geri yüklemeyi başlat': 'Start restore',
  'Geri yükleniyor…': 'Restoring…',
  'Mevcut olanı koru': 'Keep existing',
  'Notlar, etiketler, sohbetler, sürümler ve medya tek bir sürümlü pakette saklanır.':
    'Notes, tags, chats, versions, and media are stored in one versioned package.',
  'Tam yedek oluştur': 'Create full backup',
  'Yedek özeti': 'Backup summary',
  'Yedekle ve geri yükle': 'Backup and restore',
  'Yedekten geri yükle': 'Restore from backup',
  'Yerel veri yönetimi': 'Local data management',
  'İkisini de sakla': 'Keep both',
  'Çakışmalarda ne yapılsın?': 'How should conflicts be handled?',
  'Etiket ekle': 'Add tag',
  'Etiket rengi': 'Tag color',
  'Etiketleri kaydet': 'Save tags',
  'Etiketler ({{count}} seçili)': 'Tags ({{count}} selected)',
  'Henüz etiket yok. Aşağıdan ilk etiketi oluşturun.':
    'There are no tags yet. Create the first tag below.',
  'Not organizasyonu': 'Note organization',
  Renk: 'Color',
  'Yeni etiket': 'New tag',
  'Örneğin: Araştırma': 'For example: Research',
  'Anlamlı içerik değişikliklerinden sonra sürümler burada görünür.':
    'Versions appear here after meaningful content changes.',
  'Bir checkpoint seçerek içeriğini önizleyin.': 'Select a checkpoint to preview its content.',
  'Bu sürüm boş bir belge içeriyor.': 'This version contains an empty document.',
  'Bu sürüme geri dön': 'Restore this version',
  'Bu sürüme geri dönülsün mü?': 'Restore this version?',
  'Geri yükleme onayı': 'Restore confirmation',
  'Geri yükleme öncesi': 'Before restore',
  'Geri yüklemeyi onayla': 'Confirm restore',
  'Henüz checkpoint yok': 'No checkpoints yet',
  'İçerik önizlemesi': 'Content preview',
  'Mevcut içerik önce geri alınabilir bir checkpoint olarak korunacak.':
    'The current content will first be preserved as a recoverable checkpoint.',
  'Not geçmişi': 'Note history',
  'Otomatik checkpoint': 'Automatic checkpoint',
  Sürümler: 'Versions',
  'Sürümler yükleniyor…': 'Loading versions…',
  'Sürüm önizlemesi': 'Version preview',
  Vazgeç: 'Go back',
  '“{{title}}” aktif panodan kaldırılacak. Daha sonra çöp kutusundan geri alınabilir.':
    '“{{title}}” will be removed from the active board. You can restore it from Trash later.',
  '“{{title}}” için bir dosya biçimi seçin.': 'Choose a file format for “{{title}}”.',
  '“{{title}}” için birden fazla etiket seçebilirsiniz.':
    'You can select multiple tags for “{{title}}”.',
  '“{{title}}” oluşturuldu.': '“{{title}}” was created.',
  '“{{title}}” ve artık başka bir notun kullanmadığı dosya ekleri kalıcı olarak silinir. Bu işlem geri alınamaz.':
    '“{{title}}” and attachments no longer used by another note will be permanently deleted. This cannot be undone.',
  '{{count}} kimlik çakışması': '{{count}} ID conflicts',
  '{{count}} medya': '{{count}} media files',
  '{{count}} not yedekten geri yüklendi.': '{{count}} notes were restored from backup.',
  '{{count}} sohbet mesajı': '{{count}} chat messages',
  '{{fileName}} kaydedildi ({{notes}} not, {{attachments}} medya).':
    '{{fileName}} was saved ({{notes}} notes, {{attachments}} media files).',
  '{{imported}} not geri yüklendi; {{skipped}} not atlandı.':
    '{{imported}} notes were restored; {{skipped}} notes were skipped.',
  'Açık not bulunamadı.': 'The open note could not be found.',
  'AI ayarları kaydedildi.': 'AI settings were saved.',
  'AI ayarları kaydedilemedi. Lütfen tekrar deneyin.':
    'AI settings could not be saved. Please try again.',
  'AI ayarları yüklenemedi. Lütfen tekrar deneyin.':
    'AI settings could not be loaded. Please try again.',
  'AI isteği iptal edilemedi.': 'The AI request could not be cancelled.',
  'AI isteği tamamlanamadı.': 'The AI request could not be completed.',
  'AI sohbeti yüklenemedi.': 'AI chat could not be loaded.',
  'AI yanıtı açık notun sonuna eklendi.': 'The AI response was added to the open note.',
  'AI yanıtı kopyalanamadı.': 'The AI response could not be copied.',
  'AI yanıtı kullanılamadı.': 'The AI response could not be used.',
  'AI yanıtı panoya kopyalandı.': 'The AI response was copied to the clipboard.',
  'Aktif AI isteği bulunamadı.': 'No active AI request was found.',
  Alıntı: 'Quote',
  'Anahtar yalnızca main process’e gönderilir ve işletim sistemi korumalı depoda şifrelenir; uygulama yedeklerine eklenmez.':
    'The key is sent only to the main process and encrypted in operating-system-protected storage; it is not included in application backups.',
  'API anahtarı güvenli depodan silindi.': 'The API key was deleted from secure storage.',
  'Bağlantı testi tamamlanamadı.': 'The connection test could not be completed.',
  'Çakışan mevcut notu ve ilişkili verilerini yedektekiyle değiştirir.':
    'Replaces the conflicting existing note and its related data with the backup copy.',
  'Dosya dış uygulamada açılamadı.': 'The file could not be opened in an external app.',
  'Dosya editöre eklenemedi. Lütfen tekrar deneyin.':
    'The file could not be inserted into the editor. Please try again.',
  'Dosya eklenemedi. Lütfen tekrar deneyin.':
    'The attachment could not be added. Please try again.',
  'Editör araçları': 'Editor tools',
  'Editör hazırlanıyor…': 'Preparing the editor…',
  'Ekle ve araçlar': 'Insert and tools',
  'Etiket adı boş bırakılamaz.': 'Tag name cannot be empty.',
  'Etiket oluşturulamadı. Lütfen tekrar deneyin.':
    'The tag could not be created. Please try again.',
  'Etiketler kaydedilemedi. Lütfen tekrar deneyin.': 'Tags could not be saved. Please try again.',
  'Geçerli bir HTTP, HTTPS veya e-posta bağlantısı girin.':
    'Enter a valid HTTP, HTTPS, or email link.',
  'Gelen çakışan nota yeni bir kimlik verir.': 'Assigns a new ID to the conflicting incoming note.',
  'Geri yükleme tek transaction içinde yapılır. İşlem sırasında uygulamayı kapatmayın.':
    'Restore runs in a single transaction. Do not close the application during the operation.',
  'Görsel eklenemedi. Lütfen tekrar deneyin.': 'The image could not be added. Please try again.',
  'Görünüm tercihi kaydedilemedi.': 'The view preference could not be saved.',
  'İşletim sistemi güvenli anahtar saklama özelliği kullanılamıyor. Anahtar düz metin olarak kaydedilmeyecek.':
    'Secure operating-system key storage is unavailable. The key will not be saved as plain text.',
  'Kart düzeni kaydedilemedi.': 'The card layout could not be saved.',
  'Kayıtlı API anahtarı silinsin mi?': 'Delete the saved API key?',
  'Kimliği çakışan gelen notları atlar.': 'Skips incoming notes with conflicting IDs.',
  'Not açılamadı. Lütfen tekrar deneyin.': 'The note could not be opened. Please try again.',
  'Not arşivden çıkarılamadı. Lütfen tekrar deneyin.':
    'The note could not be unarchived. Please try again.',
  'Not arşivden çıkarıldı.': 'The note was unarchived.',
  'Not arşivlendi.': 'The note was archived.',
  'Not arşivlenemedi. Lütfen tekrar deneyin.': 'The note could not be archived. Please try again.',
  'Not başlığı güncellendi.': 'The note title was updated.',
  'Not çoğaltılamadı. Lütfen tekrar deneyin.':
    'The note could not be duplicated. Please try again.',
  'Not çoğaltıldı.': 'The note was duplicated.',
  'Not çöp kutusuna taşınamadı. Lütfen tekrar deneyin.':
    'The note could not be moved to Trash. Please try again.',
  'Not çöp kutusuna taşındı.': 'The note was moved to Trash.',
  'Not dışa aktarılamadı. Hedef klasörü ve izinleri kontrol edin.':
    'The note could not be exported. Check the destination folder and permissions.',
  'Not durumu güncellenemedi. Lütfen tekrar deneyin.':
    'The note status could not be updated. Please try again.',
  'Not etiketleri güncellendi.': 'The note tags were updated.',
  'Not favorilerden çıkarıldı.': 'The note was removed from favorites.',
  'Not favorilere eklendi.': 'The note was added to favorites.',
  'Not geri yüklendi.': 'The note was restored.',
  'Not geri yüklenemedi. Lütfen tekrar deneyin.':
    'The note could not be restored. Please try again.',
  'Not kalıcı olarak silindi.': 'The note was permanently deleted.',
  'Not kalıcı olarak silinemedi. Lütfen tekrar deneyin.':
    'The note could not be permanently deleted. Please try again.',
  'Not kaydedilemedi. Lütfen tekrar deneyin.': 'The note could not be saved. Please try again.',
  'Not kaydedilemediği için AI isteği gönderilmedi.':
    'The AI request was not sent because the note could not be saved.',
  'Not oluşturulamadı. Lütfen tekrar deneyin.': 'The note could not be created. Please try again.',
  'Not sabitlendi.': 'The note was pinned.',
  'Not sürümü geri yüklenemedi. Lütfen tekrar deneyin.':
    'The note version could not be restored. Please try again.',
  'Not yeniden adlandırılamadı. Lütfen tekrar deneyin.':
    'The note could not be renamed. Please try again.',
  'Notlar yüklenemedi. Lütfen tekrar deneyin.': 'Notes could not be loaded. Please try again.',
  'Notlarda arama yapılamadı. Lütfen tekrar deneyin.':
    'Notes could not be searched. Please try again.',
  'Notun sabitlemesi kaldırıldı.': 'The note was unpinned.',
  'Panel oranı kaydedilemedi. Lütfen tekrar deneyin.':
    'The panel ratio could not be saved. Please try again.',
  'Sürüm geçmişi yüklenemedi. Lütfen tekrar deneyin.':
    'Version history could not be loaded. Please try again.',
  'Tam yedek oluşturulamadı. Lütfen tekrar deneyin.':
    'The full backup could not be created. Please try again.',
  'Tema tercihi kaydedilemedi.': 'The theme preference could not be saved.',
  'Yanıt hazırlanıyor…': 'Preparing response…',
  'Yedek dosyası doğrulanamadı.': 'The backup file could not be validated.',
  'Yedek geri yüklenemedi. Yapılan değişiklikler geri alındı.':
    'The backup could not be restored. All changes were rolled back.',
  'Yedek oluşturma iptal edildi.': 'Backup creation was cancelled.',
  'Yedek seçimi iptal edildi.': 'Backup selection was cancelled.',
  'PDF veya dosya ekle': 'Add PDF or file',
  'YouTube bağlantıları oynatılabilir video olarak eklenir.':
    'YouTube links are inserted as playable videos.',
  'YouTube video bağlantısı geçersiz.': 'The YouTube video link is invalid.',
  'YouTube videosu': 'YouTube video',
  'YouTube videosu editöre eklenemedi.': 'The YouTube video could not be added to the editor.',
  'Video hizalama': 'Video alignment',
  'Videoyu sola hizala': 'Align video left',
  'Videoyu ortaya hizala': 'Center video',
  'Videoyu sağa hizala': 'Align video right',
})

interface I18nContextValue {
  readonly language: AppLanguage
  readonly locale: 'tr-TR' | 'en-US'
  readonly setLanguage: (language: AppLanguage) => boolean
  readonly t: (message: string, parameters?: TranslationParameters) => string
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'tr' || value === 'en'
}

export function loadLanguagePreference(storage: Pick<Storage, 'getItem'>): AppLanguage {
  try {
    const stored =
      storage.getItem(LANGUAGE_STORAGE_KEY) ?? storage.getItem(LEGACY_LANGUAGE_STORAGE_KEY)
    return isAppLanguage(stored) ? stored : 'tr'
  } catch {
    return 'tr'
  }
}

export function saveLanguagePreference(
  storage: Pick<Storage, 'setItem'>,
  language: AppLanguage,
): boolean {
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language)
    return true
  } catch {
    return false
  }
}

export function translate(
  language: AppLanguage,
  message: string,
  parameters: TranslationParameters = {},
): string {
  const template = language === 'en' ? (ENGLISH_MESSAGES[message] ?? message) : message
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = parameters[key]
    return value === undefined ? match : String(value)
  })
}

const defaultContext: I18nContextValue = {
  language: 'tr',
  locale: 'tr-TR',
  setLanguage: () => false,
  t: (message, parameters) => translate('tr', message, parameters),
}

const I18nContext = createContext<I18nContextValue>(defaultContext)

export function I18nProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const [language, setLanguageState] = useState(() => loadLanguagePreference(window.localStorage))

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      locale: language === 'tr' ? 'tr-TR' : 'en-US',
      setLanguage: (nextLanguage) => {
        setLanguageState(nextLanguage)
        return saveLanguagePreference(window.localStorage, nextLanguage)
      },
      t: (message, parameters) => translate(language, message, parameters),
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
