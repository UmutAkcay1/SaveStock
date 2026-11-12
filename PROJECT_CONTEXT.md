# SaveStock — Devam Notu

Son güncelleme: 11 Ekim 2026

## Proje ve çalışma ortamı

- Proje: `outputs/SaveStock`
- Yerel stok yönetimi uygulaması; FastAPI/Python API, PostgreSQL veritabanı ve HTML/CSS/JavaScript arayüzü, PWA olarak telefona eklenebiliyor.
- PostgreSQL veritabanı adı `.env` içinde `savestock`; bağlantı yerel bilgisayarda. `.env` parolası bu nota veya yedek ZIP'lerine yazılmamalı.
- Kullanıcı Türkçe, sade ve adım adım anlatımı tercih ediyor; özellikle Visual Studio/PowerShell ve iPhone'da kullanımı konusunda somut yönlendirme istiyor.
- Proje klasörü Git deposu değil; bu nedenle Git commit alınmadı.

## Kullanıcının ürün hedefleri ve kararları

- Koyu temalı, ekli SaveStock tasarım örneklerine yakın, mobilde düzgün çalışan stok takip uygulaması.
- Kullanıcı tek bir giriş ekranı kullanmalı; e-posta ile bulunan rol admin veya kullanıcı olmalı. “Bayi yöneticisi” rolü istenmiyor.
- Normal kullanıcı yalnızca kendi bayisinin verisini görmeli; kullanıcı arayüzünde bayi yönetimi bölümü gösterilmemeli.
- Yönetici tüm bayileri, bayilerin ürün/stok miktarlarını ve SKT durumlarını görmeli; bayi satırına tıklayarak o bayinin ürünlerini ve ürün aramasını açabilmeli.
- Örnek bayiler: Meram, Selçuklu, Karatay ve Merkez Depo. Genel Bakış normal kullanıcı için kendi bayisine ait verileri göstermeli.
- Kullanıcı profili, oturum açma/kapatma saatleri ve yapılan işlemlerin kaydı önemli; yönetici tüm kullanıcıların aktivite kayıtlarını görebilmeli.
- Stok giriş/çıkış, bayi arası transfer/talep akışında ürün miktarı görünür olmalı.
- Ödeme ekranı sadece paket satın alma ve abonelik yenileme için; süre seçenekleri 1, 3, 6 ve 12 ay. Kullanıcı iyzico ve PayTR seçeneklerini istedi.
- iPhone 13 Pro'da kullanım hedefleniyor. Mobil menü, soldan açılan hamburger çekmecesi ve kamera çentiği/safe-area uyumu önemli.

## Mevcut barkod okuyucu durumu

- Ürün formuna barkod alanı ve “Tara” düğmesi eklendi.
- Barkod tarayıcı ilk kullanımda `html5-qrcode` 2.3.8 kitaplığını jsDelivr'den indiriyor; EAN/UPC, Code 128/39, ITF ve QR türlerini destekliyor.
- Okunan kod forma aktarılıyor; stok kodu boşsa barkod en fazla 64 karakter olduğunda stok kodu da dolduruluyor. Ürün adı/kategori/birim kullanıcı tarafından girilmeli; barkoddan harici katalogla otomatik ürün bilgisi çekilmiyor.
- Barkod alanı ürün listesinde gösteriliyor, aramada kullanılıyor ve CSV dışa aktarımına dahil.
- Uygulama açılışındaki PostgreSQL uyarlaması `products.barcode` alanını ve benzersiz indeksi mevcut verileri silmeden ekliyor.
- iPhone Safari kamera erişimi HTTPS gerektiriyor. Şu anki yerel `http://192.168.1.118:8000` adresinde kamera çalışmaz; HTTPS erişimi hazırlanmalı. HTTPS kurulana kadar barkod numarası elle girilebilir.

## Son yedekler

- Kod + PostgreSQL dökümünü içeren tam yedek: `outputs/SaveStock-tam-yedek-2026-10-11.zip`
- Kod yedeği: `outputs/SaveStock-yedek-2026-10-11.zip`
- Ayrı, `pg_restore --list` ile okunabilirliği doğrulanmış veritabanı dökümü: `outputs/SaveStock-veritabani-yedek-2026-10-11.dump`
- ZIP'ler `.env`, `.venv`, `.vs`, `__pycache__` ve `.pyc` içermiyor. Canlı veritabanı dökümü ayrı `veritabani/` klasöründe.

## Sonraki somut adım

- iPhone'da kamera okuyucunun çalışması için uygulamaya HTTPS adresi sağlamak; bunu yaparken yerel veritabanını ve uygulama erişimini korumak.
