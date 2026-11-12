7# SaveStock — yerel MVP

Bu klasör, bilgisayarınızda çalışan ilk stok ve son kullanma tarihi takip sürümüdür. Uygulama tarayıcıda açılır; API ve PostgreSQL veritabanı bilgisayarınızda çalışır.

## Bu ilk sürümde neler var?

- Ürün kartı ve kategori alanı
- Aynı ürün için birden fazla lot ve SKT
- Lot bazında stok girişleri ve hareket kaydı
- Stok çıkışında önce SKT'si en yakın olan uygun lotu kullanma (FIFO)
- SKT'si geçmiş lotları yeni stok çıkışında kullanmama
- 30 gün içinde SKT'si gelecek lotlar için pano uyarısı
- Ürün kartı, kategori ve barkod alanı; mobil kamerayla barkod okutma
- Telefon ve masaüstü tarayıcıya uyumlu koyu arayüz
- Yönetici ve kullanıcı hesapları, bayi erişimi ve işlem geçmişi
- Yönetici panelinde paket, abonelik, KDV ve tahsilat takibi
- Raporlarda yerel stok uyarıları ve isteğe bağlı OpenAI talep / transfer önerileri
- Bu cihazda şifreli çevrimdışı stok giriş/çıkış/düzeltme sırası ve güvenli eşitleme
- FIFO, yetersiz stok ve SKT geçmiş lotlar için otomatik testler

Kamera barkod okuyucu ilk kullanımda `html5-qrcode` kitaplığını jsDelivr üzerinden yükler; görüntü işleme tarayıcıda yapılır ve barkod numarası ürün formuna aktarılır. Kamera izni için site HTTPS ile açılmalıdır. iPhone'da yerel `http://192.168...` adresi kamerayı açamaz; uygulama HTTPS alan adına yayımlandığında çalışır.

## Visual Studio'da açma

1. Visual Studio Installer'ı açın. Visual Studio'da Python desteği yoksa **Python development / Python geliştirme** iş yükünü ekleyip kurulumu tamamlayın.
2. Visual Studio başlangıç ekranındaki **Bir klasörü açın** seçeneğine tıklayın.
3. Şu klasörü seçin: C:\Users\akcay\Documents\Codex\2026-10-11\referenced-chatgpt-conversation-this-is-an\outputs\SaveStock (bu README dosyasının bulunduğu klasör).
4. Visual Studio'da **View > Terminal** menüsünden terminali açın. Terminal PowerShell ise aşağıdaki kurulum adımlarını bu klasör içinden çalıştırın.
5. İlk çalıştırmada Python yorumlayıcısı ve sanal ortam oluşturun. Kurulum bittikten sonra VS Python ortamı listesinde .venv ortamını seçin.
6. Önce veritabanı geçişini çalıştırın: alembic upgrade head. Ardından uvicorn app.main:app --reload ile sunucuyu başlatın.
7. Tarayıcıda http://127.0.0.1:8000 adresini açın. Kodları Solution Explorer içinden açıp düzenleyebilir; uygulama çalışırken Python dosyalarını kaydettiğinizde sunucu otomatik yeniden başlar.

Microsoft'un Visual Studio yönergeleri de Python klasörünü File > Open > Folder ile açmayı ve Python ortamını Visual Studio'dan seçmeyi anlatır:
[Visual Studio'da klasördeki Python kodunu açma](https://learn.microsoft.com/en-us/visualstudio/python/quickstart-05-python-visual-studio-open-folder?view=visualstudio),
[Python ortamlarını yönetme](https://learn.microsoft.com/en-us/visualstudio/python/managing-python-environments-in-visual-studio?view=vs-2022).

## 1. Gerekenler

- Windows 10/11
- Python 3.11 veya üstü
- PostgreSQL (pgAdmin ile yönetebilirsiniz)
- Visual Studio 2022 veya Visual Studio 2026; Python geliştirme iş yükü

Python yüklemeniz yoksa python.org'dan Windows sürümünü kurun ve kurulumda **Add python.exe to PATH** seçeneğini işaretleyin. PostgreSQL kurulumunda belirlediğiniz parolayı not edin.

## 2. PostgreSQL veritabanını oluşturma

pgAdmin'de PostgreSQL sunucunuza bağlanın. Query Tool'u postgres veritabanında açıp önce uygulama kullanıcısını oluşturun. Parolayı kendinize göre değiştirin:

    CREATE ROLE savestock_app WITH LOGIN PASSWORD 'LocalOnly_ChangeMe_2026';

Sonra veritabanını oluşturun:

    CREATE DATABASE savestock OWNER savestock_app;

CREATE DATABASE komutunu ayrı çalıştırın. Şema değişiklikleri Alembic ile uygulandığından, uygulamayı başlatmadan önce `alembic upgrade head` komutunu çalıştırın.

## 3. Uygulamayı kurma

Visual Studio içindeki terminalde, SaveStock klasörünün açık olduğundan emin olun ve çalıştırın:

    python -m venv .venv
    .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    pip install -r requirements.lock.txt
    Copy-Item .env.example .env

.env dosyasını açın; DATABASE_URL içindeki kullanıcı adı ve parolayı kendi PostgreSQL rolünüzle değiştirin. Yerel geliştirme için SAVESTOCK_ENV=development ve SAVESTOCK_COOKIE_SECURE=false değerlerini koruyun. Yedekleme kullanacaksanız `python -m app.backup generate-key` ile ayrı bir anahtar üretin ve çıktıyı BACKUP_ENCRYPTION_KEY alanına kaydedin. Uygulama imzası için ayrıca `SAVESTOCK_SECRET_KEY` alanına en az 32 karakterlik gizli bir değer girin. Üretimde bu anahtarları farklı, güvenli secret yönetimiyle saklayın.

OpenAI ile rapor önerilerini etkinleştirmek için `.env` dosyasındaki `OPENAI_API_KEY` alanına kendi API anahtarınızı, isterseniz `OPENAI_MODEL` alanına kullanacağınız modeli yazın. Anahtar yalnızca sunucu ortamında saklanır; tarayıcıya gönderilmez ve sohbet/e-posta ya da kaynak koda eklenmemelidir. Değişiklikten sonra uygulamayı yeniden başlatın.

    DATABASE_URL=postgresql+psycopg://savestock_app:LocalOnly_ChangeMe_2026@localhost:5432/savestock

Parolanızda @, :, /, # gibi URI karakterleri varsa bunları URL kodlamasıyla yazmanız gerekir. İlk denemede bu karakterleri içermeyen yerel bir parola seçmek daha kolaydır.

PowerShell sanal ortamı etkinleştirmeyi engellerse şu komutu bir kez çalıştırıp terminali yeniden açın:

    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Şemayı kurun veya güncelleyin:

    alembic upgrade head

Ardından sunucuyu başlatın:

    uvicorn app.main:app --reload

Tarayıcıda şu adreslerden birini açın:

- Uygulama ekranı: http://127.0.0.1:8000
- API sağlık kontrolü: http://127.0.0.1:8000/api/health
- Veritabanı hazır olma kontrolü: http://127.0.0.1:8000/api/health/ready
- API deneme ekranı: http://127.0.0.1:8000/docs

Uygulamayı durdurmak için Visual Studio terminaline odaklanıp Ctrl+C tuşlarına basın.

## Visual Studio'da kodu bulma

- app\main.py: API uçları, stok girişi ve FIFO stok çıkışı
- app\models.py: veritabanı tabloları
- app\schemas.py: API'ye gönderilen alanların doğrulamaları
- app\static\index.html: ekranın içerik ve form alanları
- app\static\styles.css: koyu arayüzün görünümü
- app\static\app.js: ekranın API ile konuşması
- schema.sql: PostgreSQL tablolarının açık SQL şeması
- tests\test_inventory.py: örnek otomatik testler
- migrations\versions: Alembic veritabanı geçişleri
- app\backup.py: şifreli PostgreSQL yedekleme ve geri yükleme komutları
- Dockerfile, docker-compose.yml: container kurulumu

Visual Studio'da dosyayı Solution Explorer'dan açın, düzenleyin ve kaydedin. Python API dosyası değişince --reload sunucuyu yeniden başlatır; HTML/CSS/JavaScript değişikliklerinde tarayıcıyı yenilemeniz yeterlidir.

## Testleri çalıştırma

Yerel testler bellekte SQLite kullanır; gerçek envanteri etkilemez. CI ayrıca PostgreSQL üzerinde aynı testleri ve migration'ları çalıştırır. SaveStock klasöründe sanal ortam açıkken:

    pytest -q

`requirements.txt` sürüm aralıklarını, `requirements.lock.txt` tekrarlanabilir kurulum için çözümlenmiş paketleri tutar; bağımlılık değişikliklerinde ikisini birlikte güncelleyin. Statik analiz için `ruff check --select E4,E7,E9,F app migrations tests` çalıştırın. CI ayrıca PostgreSQL üzerinde migration'ları doğrular, testleri tekrar çalıştırır ve kilitli bağımlılık güvenlik denetimi (`pip-audit`) yapar.

## Migration iş akışı

Uygulama artık açılışta tablo/kolon değiştirmez. Dağıtımdan önce `alembic upgrade head` çalıştırılmalıdır; Docker girişi bu adımı uygulama sunucusundan önce yapar. Yeni bir migration oluşturmak için:

    alembic revision --autogenerate -m "migration açıklaması"

Oluşan dosyayı inceleyip özellikle veri koruma, varsayılan değerler ve PostgreSQL uyumluluğunu doğrulamadan yayınlamayın. Eski kurulumlar için ilk migration mevcut tabloları silmeden eksikleri oluşturur ve PostgreSQL uyarlamasını uygular. Migration öncesi yedek alın; `alembic downgrade` bu başlangıç migration'ında şemayı geri almaz.

## Şifreli yedekleme ve geri yükleme

Yedekleme için PostgreSQL istemci araçları (`pg_dump`, `pg_restore`) gerekir. `BACKUP_ENCRYPTION_KEY` veritabanı parolasından farklı, gizli tutulmalı ve yedeklerden ayrı saklanmalıdır. Şifreli yedek oluşturma:

    python -m app.backup backup

Yedekler `backups/` içine AES-256-GCM ile şifrelenerek yazılır; varsayılan saklama süresi 30 gündür (`BACKUP_RETENTION_DAYS`). Doğrulama:

    python -m app.backup verify backups/savestock-<tarih>.dump.enc

Geri yükleme mevcut veritabanı nesnelerini değiştirir; önce hedef ortamın ve yedeğin doğru olduğunu kontrol edip açık onayla çalıştırın:

    python -m app.backup restore backups/savestock-<tarih>.dump.enc --confirm

Yedek anahtarını kaybederseniz dosyalar açılamaz. Düzenli olarak ayrı bir deneme veritabanına geri yükleme tatbikatı yapın. Otomatik yedekleme zamanlamasını işletim sistemi görev zamanlayıcısı veya barındırma platformunuz üzerinden kurun; yedek dosyalarını uygulama imajına koymayın.

## Docker ile yerel çalıştırma

Docker Desktop kurulu olmalıdır. `.env.example` dosyasını `.env` olarak kopyalayıp `POSTGRES_DB`, `POSTGRES_USER`, güçlü `POSTGRES_PASSWORD`, `SAVESTOCK_SECRET_KEY` ve `BACKUP_ENCRYPTION_KEY` değerlerini ayarlayın. Compose yerel olarak PostgreSQL 15 kullanır; harici veritabanlarında `pg_dump`/`pg_restore` istemci sürümünü sunucuyla uyumlu tutun. Compose parolayı bağlantı URL'sinde kullandığından yerel örnekte özel URI karakterleri içermeyen rastgele bir hex parola tercih edin; üretim sırlarını repoya koymayın. Varsayılan kurulum Caddy'yi başlatmaz ve uygulamayı yalnızca `127.0.0.1` arayüzüne açar:

    docker compose up --build -d

Sağlık durumunu `docker compose ps` ile izleyin. Günlükleri `docker compose logs -f app` ile görüntüleyin; kapatmak için `docker compose down` kullanın. Kalıcı PostgreSQL volume'u silinmediği sürece veritabanını korur. `docker compose down -v` veritabanı volume'unu siler; yedek ve açık onay olmadan çalıştırmayın.

### Caddy ile herkese açık HTTPS

Bu profili, Docker Compose sunucunuzda kullanmak için:

1. `.env` dosyasındaki `SAVESTOCK_DOMAIN` değerini alan adınızla değiştirin. Alan adının DNS A/AAAA kayıtları sunucunun herkese açık adresini göstermeli; sunucunun güvenlik duvarı ve sağlayıcı ağı TCP 80/443 (isteğe bağlı HTTP/3 için UDP 443) trafiğine izin vermelidir. Bu portları başka bir web sunucusu kullanıyorsa önce mevcut proxy yapılandırmasına uyarlayın.
2. `SAVESTOCK_ENV=production`, `SAVESTOCK_COOKIE_SECURE=true` ve `SAVESTOCK_ALLOWED_HOSTS` değerlerini ayarlayın. İzin verilen ana makine listesine `SAVESTOCK_DOMAIN` ile aynı host adını yazın. `SAVESTOCK_SECRET_KEY` ve `BACKUP_ENCRYPTION_KEY` için benzersiz üretim sırları kullanın.
3. `SAVESTOCK_PROXY_SUBNET` ve `SAVESTOCK_PROXY_IP` değerlerinin sunucudaki diğer Docker ağlarıyla çakışmadığını doğrulayın. Proxy IP'sini değiştirirseniz `FORWARDED_ALLOW_IPS` içindeki IP'yi de eşleştirin.
4. Sunucuda çalıştırın:

       docker compose --profile https up --build -d

Caddy, sertifikayı otomatik alır ve yeniler; `/data` ve `/config` volume'ları sertifika durumunu korur. Caddy HTTPS'i sonlandırır; uygulama container'ı yalnızca sunucunun yerel arayüzünde ve özel Docker ağında erişilebilir kalır. DNS henüz yayılmadıysa veya 80/443 erişilemiyorsa sertifika alınamaz; `docker compose logs -f caddy` ile durumu kontrol edin. iPhone'da uygulamayı `https://<SAVESTOCK_DOMAIN>` adresinden açın; kamera izni için tarayıcıya izin verin.

Compose ortamında yedekleme komutlarını container içinden çalıştırın; çıktı, host'taki `backups/` klasörüne yazılır:

    docker compose exec app python -m app.backup backup
    docker compose exec app python -m app.backup verify /backups/savestock-<tarih>.dump.enc

Geri yükleme için aynı `restore ... --confirm` komutu kullanılabilir; bu işlem mevcut PostgreSQL verisini değiştirir.

## Çevrimdışı stok işlemleri

Uygulamayı HTTPS adresinden açıp yükledikten sonra **Profilim > Çevrimdışı erişim** bölümünde en az 8 karakterli ayrı bir çevrimdışı PIN belirleyin. Son ürün, kategori, bayi ve lot görüntüsü ile bekleyen stok işlemleri tarayıcının IndexedDB alanında PBKDF2/AES-GCM ile şifrelenir. PIN sunucuya gönderilmez ve unutulursa bu cihazdaki kayıtlı çevrimdışı işlemler kurtarılamaz.

Çevrimdışı iken stok girişi, FIFO stok çıkışı ve yönetici stok düzeltmesi sıraya alınabilir. Ürün/lot ekleme, stok talepleri, transfer, kullanıcı ve abonelik işlemleri çevrimdışı desteklenmez. Çevrimdışı ekran, en son indirilen görüntüyü kullanır; stok çıkışı eldeki lot/SKT verisine göre yerelde kontrol edilir, fakat sunucuya eşitlenirken yetki, lot ve güncel stok yeniden doğrulanır. Bu nedenle eşitleme sırasında stok veya izin çakışması oluşabilir. Çakışan işlem ve sonrakiler otomatik gönderilmez; mevcut sürümde eşitleme kuyruğunu gözden geçirip açık onayla silerek gerekli işlemi yeniden girmek gerekir.

Her stok işlemi sabit bir `Idempotency-Key` ile gönderilir. Sunucu aynı anahtarla tekrar ulaşan isteği ikinci kez uygulamaz; böylece bağlantı yanıtı kaybolsa bile yeniden deneme mükerrer stok hareketi oluşturmaz. Eşitleme için cihazdaki kasanın PIN ile açılmış olması ve aynı SaveStock hesabıyla giriş yapılması gerekir. Bekleyen işlem varken çıkış, silme onayı ister; çevrimdışı durumdayken sunucu oturumu güvenle kapatılamadığından çıkış bağlantı gelene kadar devre dışıdır. PIN'i hatırlamıyorsanız kuyruğu eşitlemeden kasayı silmek bekleyen işlemleri kalıcı olarak kaybettirir.

## Sağlık, günlük ve bağlantı havuzu

- `/api/health/live` süreç liveness kontrolüdür; `/api/health/ready` veritabanı erişimini sınar.
- JSON günlükleri istek kimliği, yöntem, yol, HTTP durumu ve süreyi içerir; URL sorgusu, gövde, çerez veya parola kaydedilmez.
- Havuz boyutları `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT`, `DB_POOL_RECYCLE` ve `DB_CONNECT_TIMEOUT` ile ayarlanır. Üretimde toplam bağlantı sayısını PostgreSQL'in sınırları ve çalışan kopya sayısıyla birlikte planlayın.
- Kimlik doğrulama giriş denemeleri 15 dakikalık pencerede IP/e-posta birleşimi başına sınırlandırılır; sınırlar veritabanında saklanır ve çoklu worker arasında paylaşılır.

## OpenAI stok önerileri

Raporlar ekranındaki **AI önerilerini al** düğmesi isteğe bağlı olarak OpenAI API'sini çağırır; sayfa açılışında otomatik istek yapılmaz. İstek, yalnızca erişim yetkisi bulunan ürün/bayi adlarını ve toplu mevcut stok, SKT riski, son 30 gün ile önceki 30 gündeki stok çıkış sayılarını içerir. Kullanıcı adları, e-postalar, barkodlar, lot kodları ve hareket notları gönderilmez. Yönetici olmayan hesaplara bayi çapında transfer önerisi üretilmez.

Transfer önerilerinin miktarı sunucuda tekrar doğrulanır; SKT uyarı dönemine giren stok transfer fazlasına katılmaz. OpenAI yanıtı hiçbir zaman transferi kendiliğinden başlatmaz ve her kullanıcı için analiz isteği 60 saniyede birle sınırlandırılır. Stok çıkışları satışla birebir aynı olmayabileceğinden AI çıktısını karar desteği olarak değerlendirin. OpenAI API kullanımı, hesap maliyeti ve sağlayıcının güncel veri işleme koşulları API anahtarının sahibinin sorumluluğundadır.

## SaveStock Control (yerel geliştirici yönetimi)

`savestock_control/` klasörü, SaveStock arayüzünden ve API'sinden ayrı çalışan salt okunur yönetim uygulamasıdır. Ana uygulamanın route veya arayüz dosyalarını değiştirmez; mevcut SaveStock `.env` dosyasındaki veritabanı bağlantısını kullanarak sağlık durumunu ve toplu sayaçları gösterir. SaveStock klasörünün kökünde, sanal ortam etkin ve ana veritabanı yapılandırılmışken ayrı bir terminalde başlatın:

    uvicorn savestock_control.main:app --host 127.0.0.1 --port 8500

Tarayıcıda `http://127.0.0.1:8500` adresini açın. İlk açılışta yalnızca bu bilgisayarda saklanan yerel bir geliştirici hesabı oluşturulur; en az 14 karakterli güçlü bir parola belirleyin. Parola düz metin olarak saklanmaz. Oturum bir saat işlem yapılmadığında kapanır; çıkmak için **Güvenli çıkış** düğmesini kullanın. Control, varsayılan olarak hesabın yapılandırmasını `%LOCALAPPDATA%\SaveStockControl\control.json` dosyasında tutar; farklı bir konum için uygulamayı başlatmadan önce `SAVESTOCK_CONTROL_HOME` ortam değişkenini ayarlayın. Hesap parolasını kurtarma veya uzaktan erişim yoktur.

Uygulama `127.0.0.1` dışına bağlanmayı reddeder. Control, ürün verilerini değiştirmez veya hassas kullanıcı/hareket ayrıntılarını göstermez. Ana SaveStock uygulamasıyla aynı Python bağımlılıklarını ve `.env` veritabanı bağlantısını kullanır; bu nedenle ana veritabanı erişilebilir değilse özet yerine bağlantı hatası gösterir. Durdurmak için terminalde Ctrl+C kullanın.

Güvendiğiniz bir yerel ağdaki telefondan erişim gerekiyorsa Control'u yalnızca o ağın CIDR aralığı ve bilgisayarın Wi-Fi IP'si ile açın; Uvicorn'u `--host 0.0.0.0` ile başlatın, `SAVESTOCK_CONTROL_ALLOWED_NETWORK` ve `SAVESTOCK_CONTROL_ALLOWED_HOSTS` değerlerini ayarlayın ve güvenlik duvarında TCP 8500 için yalnızca bu alt ağdan gelen bağlantılara izin verin. Örnek: `SAVESTOCK_CONTROL_ALLOWED_NETWORK=172.20.10.0/28`, `SAVESTOCK_CONTROL_ALLOWED_HOSTS=172.20.10.9`. İlk geliştirici hesabı yine yalnızca bilgisayardan kurulabilir. Bu yerel HTTP bağlantısı şifrelenmez; güvenilmeyen Wi-Fi ağında kullanmayın. Ağ erişimini kapatmak için iki ortam değişkenini temizleyip Control'u `--host 127.0.0.1` ile yeniden başlatın.

## İlk kullanım

1. Uygulamada **Yeni ürün** bölümünden bir ürün kaydedin.
2. **Stok girişi** formundan lot kodu, son kullanma tarihi ve miktarı girin. Aynı üründe farklı lot kodlarıyla birden fazla SKT tutabilirsiniz.
3. **Stok çıkışı** formundan ürün ve miktarı seçin. Sistem SKT tarihi önce gelen, tarihi geçmemiş lotları sırayla tüketir.
4. **Lot bazında stok** tablosu kalan miktar ve SKT durumunu gösterir. Ürün barkodu ürün kartına kaydedilir ve ürün kataloğunda aranabilir. İlk sürümde varsayılan **Genel** kategorisi hazır gelir; yeni kategoriler /docs ekranında POST /api/categories üzerinden eklenebilir.

## Abonelik satın alma ve PayTR

Sol menüdeki **Abonelik** ekranı yalnızca mağazanın paketini satın almak veya yenilemek içindir. KOBİ Başlangıç aylık 499 TL, KOBİ Plus aylık 999 TL'dir; tutarlara %20 KDV eklenir. 1, 3, 6 ve 12 aylık süreler seçilebilir. Yenileme, mevcut abonelik süresinin sonuna eklenir. Ödeme onayı PayTR'ın imzalı sunucu bildirimiyle gelir; tarayıcıdaki başarı dönüşü tek başına aboneliği etkinleştirmez.

PayTR mağaza hesabınızı aldıktan sonra uygulamanın `.env` dosyasına şu bilgileri ekleyin. Gizli anahtarları sohbet veya ekran görüntüsüyle paylaşmayın:

```env
PAYTR_MERCHANT_ID=PayTR mağaza numaranız
PAYTR_MERCHANT_KEY=PayTR mağaza anahtarınız
PAYTR_MERCHANT_SALT=PayTR mağaza gizli anahtarınız
PAYTR_PUBLIC_URL=https://uygulamanizin-herkese-acik-adresi
PAYTR_TEST_MODE=1
PAYTR_TEST_USER_IP=
```

`PAYTR_PUBLIC_URL`, PayTR'ın erişebileceği gerçek HTTPS adresi olmalıdır; `localhost` ödeme bildirimi alamaz. PayTR Mağaza Paneli'ndeki Bildirim URL alanına `https://uygulamanizin-herkese-acik-adresi/api/billing/paytr/callback` adresini girin. Yerel testte PayTR'ın istediği dış IP'yi `PAYTR_TEST_USER_IP` alanına yazın. Test işlemleri tamamlanınca mağaza canlı moda geçirildiğinde `PAYTR_TEST_MODE=0` yapın. Ayarları kaydettikten sonra uygulamayı yeniden başlatın.

Ödeme formu PayTR'ın iFrame ekranında açılır. Uygulama kart bilgilerini almaz veya saklamaz. PayTR bilgileri henüz eklenmediyse satın alma düğmesi kapalı kalır; bu, yerel kurulumun henüz tahsilat yapmadığını açıkça gösterir.

## Dağıtım sınırları

Docker Compose yerel ve tek sunucu kurulumu için taşınabilir bir temel sağlar; belirli bir bulut sağlayıcısına dağıtım, TLS sertifikası, DNS, dış yedek kopyalama ve yedekleme zamanlaması sağlayıcı/işletim ortamına göre ayrıca yapılandırılmalıdır. Hassas veriler uygulama imajına veya repoya eklenmemelidir.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
