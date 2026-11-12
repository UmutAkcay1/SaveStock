const toast = document.getElementById("toast");
const PAGE_INFO = {
  overview: ["Genel Bakış", "ENVANTER / GENEL BAKIŞ", "Stok ve SKT durumunuzu tek ekranda izleyin."],
  "product-add": ["Ürün Ekle", "ENVANTER / ÜRÜN EKLE", "Yeni bir ürün kartını hızlıca oluşturun."],
  dealers: ["Bayiler", "ENVANTER / BAYİLER", "Erişiminiz olan bayilerin stok ve son kullanma tarihlerini görüntüleyin."],
  "dealer-insight": ["Bayi Detayı", "ENVANTER / BAYİ DETAYI", "Erişilebilir bayi ve depoların stok ve SKT bilgilerini inceleyin."],
  "stock-requests": ["Stok Talepleri", "ENVANTER / STOK TALEPLERİ", "Ürün ihtiyaçlarını bildirin ve taleplerin durumunu izleyin."],
  "request-insight": ["Talep Detayı", "ENVANTER / TALEP DETAYI", "Seçtiğiniz durumdaki stok taleplerini ve sonuçlarını inceleyin."],
  products: ["Ürünler", "ENVANTER / ÜRÜNLER", "Ürün kataloğunuzu ve mevcut stok miktarlarını yönetin."],
  "product-insight": ["Ürün Durumu", "ENVANTER / ÜRÜN DURUMU", "Seçtiğiniz stok durumundaki ürünleri ve miktarlarını inceleyin."],
  movements: ["Stok Hareketleri", "ENVANTER / STOK HAREKETLERİ", "Giriş, çıkış ve sayım düzeltmelerini; işlemi yapan hesapla birlikte inceleyin."],
  "movement-insight": ["Hareket Detayı", "ENVANTER / HAREKET DETAYI", "Seçtiğiniz hareket türündeki kayıtları ve miktarlarını inceleyin."],
  expiry: ["SKT Takibi", "ENVANTER / SKT TAKİBİ", "Lotların son kullanma tarihlerini ve kalan sürelerini takip edin."],
  "expiry-insight": ["SKT Lot Detayı", "ENVANTER / SKT LOT DETAYI", "Seçtiğiniz tarih aralığındaki lotları, kalan süreleri ve miktarlarını inceleyin."],
  categories: ["Kategoriler", "ENVANTER / KATEGORİLER", "Ürünlerinizi kategorilere ayırarak düzenleyin."],
  "category-insight": ["Kategori Detayı", "ENVANTER / KATEGORİ DETAYI", "Kategori ve ürün dağılımınızı arayın, ayrıntılı olarak inceleyin."],
  reports: ["Raporlar", "ENVANTER / RAPORLAR", "Stok ve son kullanma tarihi özetlerini inceleyin."],
  profile: ["Profilim", "HESAP / PROFİLİM", "Hesap bilgilerinizi ve işlem geçmişinizi yönetin."],
  users: ["Kullanıcılar", "SİSTEM / KULLANICILAR", "Hesapları ve erişim izinlerini yönetin."],
  "user-insight": ["Hesap Detayı", "SİSTEM / HESAP DETAYI", "Seçtiğiniz hesap grubunu ve erişim bilgilerini inceleyin."],
  billing: ["Abonelik", "HESAP / ABONELİK", "Mağazanızın aboneliğini satın alın veya yenileyin."],
  settings: ["Ayarlar", "SİSTEM / AYARLAR", "Yerel uygulama tercihlerinizi düzenleyin."]
};
let toastTimer;
let deferredInstallPrompt = null;
let productCatalog = [];
let productSortKey = "name";
let productSortDirection = 1;
let productPage = 1;
const PRODUCT_PAGE_SIZE = 50;
let activeProductInsight = null;
let productInsightPage = 1;
const PRODUCT_INSIGHT_PAGE_SIZE = 25;
let activeMovementInsight = null;
let movementInsightPage = 1;
const MOVEMENT_INSIGHT_PAGE_SIZE = 25;
let batchPage = 1;
const BATCH_PAGE_SIZE = 50;
const selectedProductIds = new Set();
let editingProductId = null;
let categories = [];
let activeCategoryInsight = null;
let categoryInsightPage = 1;
const CATEGORY_INSIGHT_PAGE_SIZE = 25;
let dealers = [];
let dealerOverview = {dealers: [], stocks: [], expiring: []};
let activeDealerInsight = null;
let dealerInsightPage = 1;
const DEALER_INSIGHT_PAGE_SIZE = 25;
let stockRequests = [];
let activeRequestInsight = null;
let requestInsightPage = 1;
const REQUEST_INSIGHT_PAGE_SIZE = 25;
let batches = [];
let movements = [];
let overviewMovements = null;
let users = [];
let activeUserInsight = null;
let userInsightPage = 1;
const USER_INSIGHT_PAGE_SIZE = 25;
let billingData = null;
let selectedBillingPlan = "starter";
let selectedBillingTerm = 1;
let currentUser = null;
let offlineMode = false;
let pendingOnlineUser = null;
let offlineSyncPromise = null;
let offlineState = null;
let offlineBannerNotice = null;
let selectedDealerId = null;
let currentPage = null;
const previousPages = [];
let dealerStockQuery = "";
let barcodeScanner = null;
let barcodeScannerLoading = null;
let barcodeScannerGeneration = 0;
let barcodeScanHandled = false;
let expiryWarningDays = Number(localStorage.getItem("savestock-expiry-warning-days") || 30);
let lowStockThreshold = Math.max(1, Number(localStorage.getItem("savestock-low-stock-threshold") || 5));
let activeExpiryFilter = "all";
let activeExpiryInsight = null;
let expiryInsightPage = 1;
const EXPIRY_INSIGHT_PAGE_SIZE = 25;
let currentTheme = localStorage.getItem("savestock-theme") === "light" ? "light" : "dark";

function applyTheme(theme) {
  currentTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = currentTheme;
  localStorage.setItem("savestock-theme", currentTheme);
  document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === currentTheme));
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character];
  });
}
function showToast(message, isError) {
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 3500);
}
function loadBarcodeScannerLibrary() {
  if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) return Promise.resolve();
  if (barcodeScannerLoading) return barcodeScannerLoading;
  barcodeScannerLoading = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.crossOrigin = "anonymous";
    script.onload = function () {
      if (window.Html5Qrcode && window.Html5QrcodeSupportedFormats) resolve();
      else reject(new Error("Barkod okuyucu başlatılamadı."));
    };
    script.onerror = function () { reject(new Error("Barkod okuyucu indirilemedi. İnternet bağlantınızı kontrol edin.")); };
    document.head.appendChild(script);
  }).catch(function (error) {
    barcodeScannerLoading = null;
    throw error;
  });
  return barcodeScannerLoading;
}
async function stopBarcodeScanner() {
  const scanner = barcodeScanner;
  barcodeScanner = null;
  if (scanner) {
    try { await scanner.stop(); } catch (_) {}
    try { await scanner.clear(); } catch (_) {}
  }
  const reader = document.getElementById("barcode-reader");
  if (reader) reader.replaceChildren();
}
async function closeBarcodeScanner() {
  barcodeScannerGeneration += 1;
  const dialog = document.getElementById("barcode-scanner-dialog");
  if (dialog.open) dialog.close();
  await stopBarcodeScanner();
}
async function startBarcodeScanner() {
  const dialog = document.getElementById("barcode-scanner-dialog");
  if (dialog.open) return;
  const status = document.getElementById("barcode-scanner-status");
  const help = document.getElementById("barcode-scanner-help");
  const generation = ++barcodeScannerGeneration;
  barcodeScanHandled = false;
  status.classList.remove("error");
  status.textContent = "Kamera hazırlanıyor…";
  help.textContent = "Ürün barkodunu çerçeveye hizalayın.";
  dialog.showModal();

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    help.textContent = "iPhone’da kamera kullanımı için uygulama HTTPS adresinden açılmalı.";
    status.textContent = "Bu yerel HTTP adresinde kamera açılamıyor. HTTPS bağlantısı kurulduğunda tekrar deneyin; barkod alanına numarayı elle de girebilirsiniz.";
    status.classList.add("error");
    return;
  }

  try {
    await loadBarcodeScannerLibrary();
    if (generation !== barcodeScannerGeneration || !dialog.open) return;
    const formats = window.Html5QrcodeSupportedFormats;
    const scanner = new window.Html5Qrcode("barcode-reader", {
      verbose: false,
      formatsToSupport: [formats.EAN_13, formats.EAN_8, formats.UPC_A, formats.UPC_E, formats.CODE_128, formats.CODE_39, formats.ITF, formats.QR_CODE]
    });
    barcodeScanner = scanner;
    status.textContent = "Arka kamera açılıyor…";
    const width = Math.max(220, Math.min(340, Math.floor(window.innerWidth - 76)));
    await scanner.start(
      {facingMode: "environment"},
      {fps: 10, qrbox: {width: width, height: 150}, aspectRatio: 1.333, disableFlip: true, useBarCodeDetectorIfSupported: false},
      async function (decodedText) {
        if (barcodeScanHandled || generation !== barcodeScannerGeneration) return;
        barcodeScanHandled = true;
        const barcode = String(decodedText || "").trim();
        const existing = productCatalog.find(function (product) { return product.barcode === barcode; });
        await closeBarcodeScanner();
        const barcodeInput = document.getElementById("product-barcode");
        barcodeInput.value = barcode;
        if (existing) {
          showToast("Bu barkod zaten “" + existing.name + "” ürününe kayıtlı.", true);
          return;
        }
        const form = document.getElementById("product-form");
        if (!form.elements.sku.value.trim() && barcode.length <= 64) form.elements.sku.value = barcode;
        showToast("Barkod okundu. Ürün bilgilerini tamamlayın.");
        if (!form.elements.name.value.trim()) form.elements.name.focus();
      },
      function () {}
    );
    if (generation !== barcodeScannerGeneration || !dialog.open) {
      try { await scanner.stop(); } catch (_) {}
      try { await scanner.clear(); } catch (_) {}
      if (barcodeScanner === scanner) barcodeScanner = null;
      return;
    }
    status.textContent = "Barkod kameranın görüntüsünde net görünecek şekilde hizalayın.";
  } catch (error) {
    if (generation !== barcodeScannerGeneration || !dialog.open) return;
    await stopBarcodeScanner();
    help.textContent = "Kamera açılamadı.";
    if (error && error.name === "NotAllowedError") {
      status.textContent = "Kamera izni verilmedi. Safari ayarlarından bu site için Kamera erişimine izin verin.";
    } else if (error && error.name === "NotFoundError") {
      status.textContent = "Bu cihazda kullanılabilir kamera bulunamadı.";
    } else if (error && error.name === "NotReadableError") {
      status.textContent = "Kamera başka bir uygulama tarafından kullanılıyor. Diğer kamera uygulamalarını kapatıp yeniden deneyin.";
    } else {
      status.textContent = (error && error.message) || "Kamera açılamadı. Barkod numarasını elle girebilirsiniz.";
    }
    status.classList.add("error");
  }
}
async function api(path, options) {
  const response = await fetch(path, Object.assign({headers: {"Content-Type": "application/json"}}, options || {}));
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    if (response.status === 401 && currentUser) {
      currentUser = null;
      showLogin();
    }
    const detail = Array.isArray(data.detail)
      ? data.detail.map(function (item) { return item.msg || "Geçersiz değer."; }).join(" ")
      : (data.detail || "İşlem tamamlanamadı.");
    const error = new Error(detail);
    error.status = response.status;
    error.fieldErrors = Array.isArray(data.detail) ? data.detail.reduce(function (result, item) {
      const field = item.loc && item.loc[item.loc.length - 1];
      if (field && field !== "body") result[field] = item.msg || "Geçersiz değer.";
      return result;
    }, {}) : {};
    throw error;
  }
  return data;
}

function isNetworkError(error) {
  return !navigator.onLine || error instanceof TypeError;
}

function offlineSnapshot() {
  return {
    categories: categories,
    dealers: dealers,
    products: productCatalog,
    batches: batches
  };
}

function setOfflineAuthMessage(message) {
  document.getElementById("offline-unlock-description").textContent = message;
}

async function continueOnlineAuth(user) {
  if (await window.SaveStockOfflineStore.hasVault() && !window.SaveStockOfflineStore.isUnlocked()) {
    pendingOnlineUser = user;
    setAuthPanel("offline-unlock-panel");
    setOfflineAuthMessage("Hesabınız doğrulandı. Bu cihazdaki bekleyen işlemleri güvenli biçimde açmak için çevrimdışı PIN'inizi girin.");
    return;
  }
  if (window.SaveStockOfflineStore.isUnlocked()) {
    const saved = window.SaveStockOfflineStore.state();
    if (saved && String(saved.user.id) !== String(user.id)) {
      if (saved.queue.length) {
        pendingOnlineUser = null;
        setAuthPanel("login-panel");
        showAuthMessage("Bu cihazdaki bekleyen işlemler başka bir hesaba ait. Bu işlemleri eşitlemek için önce kasa sahibi hesapla giriş yapın.");
        return;
      }
      await window.SaveStockOfflineStore.clear();
      offlineState = null;
    }
  }
  pendingOnlineUser = null;
  enterApp(user);
}

async function enterOfflineApp(state) {
  if (!state || !state.user || !state.cache) throw new Error("Çevrimdışı kayıtlar eksik.");
  offlineMode = true;
  offlineState = state;
  updateUserIdentity(state.user);
  categories = state.cache.categories || [];
  dealers = state.cache.dealers || [];
  productCatalog = state.cache.products || [];
  batches = state.cache.batches || [];
  movements = [];
  overviewMovements = [];
  users = [];
  stockRequests = [];
  billingData = null;
  dealerOverview = {dealers: [], stocks: [], expiring: []};
  document.getElementById("auth-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;
  document.getElementById("data-load-error").hidden = true;
  document.querySelectorAll("[data-admin-only]").forEach(function (element) {
    element.hidden = state.user.role !== "admin";
  });
  updateDealerSelects();
  updateCategorySelects();
  updateProductSelects();
  applyOfflineProjection(state.queue);
  setPage("overview");
  renderAll();
  updateOfflineBanner();
  await renderOfflineSettings();
}

async function openOfflineUnlock() {
  pendingOnlineUser = null;
  setAuthPanel("offline-unlock-panel");
  setOfflineAuthMessage("Bu cihazdaki stok verileri şifreli. Çevrimdışı PIN'inizi girin.");
}

async function renderOfflineSettings() {
  const configured = await window.SaveStockOfflineStore.hasVault();
  const form = document.getElementById("offline-pin-form");
  const clearButton = document.getElementById("offline-clear-button");
  const status = document.getElementById("offline-settings-status");
  if (offlineMode) {
    form.hidden = true;
    clearButton.hidden = true;
    status.textContent = "Çevrimdışı kullanım açık. Veriler ve bekleyen işlemler bu cihazda şifreli saklanır.";
  } else if (configured && window.SaveStockOfflineStore.isUnlocked()) {
    form.hidden = true;
    clearButton.hidden = false;
    status.textContent = "Bu cihaz için çevrimdışı erişim etkin. En son sunucudan alınan veriler korunuyor.";
  } else if (configured) {
    form.hidden = true;
    clearButton.hidden = true;
    status.textContent = "Bu cihaz için çevrimdışı erişim ayarlı. Sonraki açılışta PIN istenir.";
  } else {
    form.hidden = false;
    clearButton.hidden = true;
    status.textContent = "Çevrimdışı erişim henüz etkin değil.";
  }
}

function updateOfflineBanner(message) {
  const banner = document.getElementById("offline-sync-banner");
  if (!banner) return;
  if (message) offlineBannerNotice = message;
  const state = window.SaveStockOfflineStore.isUnlocked() ? window.SaveStockOfflineStore.state() : offlineState;
  const queue = state && Array.isArray(state.queue) ? state.queue : [];
  const needsBanner = offlineMode || queue.length > 0;
  banner.hidden = !needsBanner;
  document.querySelectorAll(".side-nav [data-page]").forEach(function (item) {
    const adminOnly = item.hasAttribute("data-admin-only") && (!currentUser || currentUser.role !== "admin");
    const offlineRestricted = offlineMode && !["overview", "products", "product-insight", "movements", "movement-insight", "expiry", "expiry-insight"].includes(item.dataset.page);
    item.hidden = adminOnly || offlineRestricted;
  });
  document.getElementById("profile-shortcut").hidden = offlineMode;
  document.querySelectorAll("[data-page='product-add']").forEach(function (item) { item.hidden = offlineMode; });
  if (!needsBanner) {
    offlineBannerNotice = null;
    document.getElementById("offline-sync-message").textContent = "";
    return;
  }

  const conflicts = queue.filter(function (item) { return item.status === "conflict"; }).length;
  document.getElementById("offline-sync-title").textContent = offlineMode ? "Çevrimdışı çalışma" : "Eşitleme bekliyor";
  document.getElementById("offline-sync-message").textContent = offlineBannerNotice || (offlineMode
    ? (queue.length ? "İşlemler bu cihazda şifreli olarak sırada. Bağlantı gelince eşitleyin." : "Son indirilen ürün ve lot verileri görüntüleniyor.")
    : queue.length + " işlem sunucuya gönderilmeyi bekliyor.");
  const list = document.getElementById("offline-queue-list");
  list.replaceChildren();
  queue.forEach(function (item) {
    const line = document.createElement("li");
    const type = {inbound: "Stok girişi", outbound: "Stok çıkışı", adjustment: "Stok düzeltmesi"}[item.kind] || "Stok işlemi";
    const payload = item.payload || {};
    const product = productCatalog.find(function (entry) { return Number(entry.id) === Number(payload.product_id); });
    const dealer = dealers.find(function (entry) { return Number(entry.id) === Number(payload.dealer_id); });
    const details = [product ? product.name : "Ürün #" + (payload.product_id || "?")];
    if (dealer) details.push(dealer.name);
    if (payload.batch_code) details.push("Lot " + payload.batch_code);
    const quantity = item.kind === "adjustment" ? payload.target_quantity : payload.quantity;
    if (quantity !== undefined && quantity !== null && quantity !== "") {
      details.push((item.kind === "adjustment" ? "Sayım " : "Miktar ") +
        Number(quantity).toLocaleString("tr-TR") + (product && product.unit ? " " + product.unit : ""));
    }
    line.textContent = type + " · " + details.join(" · ") + " · " +
      (item.status === "conflict" ? "Çakışma: " + (item.error || "inceleme gerekli") : "eşitleme bekliyor");
    list.appendChild(line);
  });
  const syncButton = document.getElementById("offline-sync-button");
  syncButton.hidden = queue.length === 0 || !navigator.onLine || !window.SaveStockOfflineStore.isUnlocked() || !currentUser;
  syncButton.disabled = conflicts > 0 || queue.some(function (item) { return item.status === "sending"; });
  document.getElementById("offline-login-button").hidden = !(offlineMode && navigator.onLine && !currentUser);
  document.getElementById("offline-discard-button").hidden = queue.length === 0 || !window.SaveStockOfflineStore.isUnlocked();
}

function setupInstallableApp() {
  const installButton = document.getElementById("install-app-button");
  if (!installButton) return;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  if (isIOS && !isStandalone) installButton.hidden = false;
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("/service-worker.js").catch(function () {});
  }
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });
  window.addEventListener("appinstalled", function () {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    showToast("SaveStock uygulaması yüklendi.");
  });
  installButton.addEventListener("click", async function () {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice && choice.outcome === "accepted") installButton.hidden = true;
      return;
    }
    if (isIOS) {
      showToast("Safari’de Paylaş düğmesine dokunun, ardından Ana Ekrana Ekle’yi seçin.");
      return;
    }
    showToast("Uygulamayı yüklemek için tarayıcınızın menüsündeki Uygulamayı yükle seçeneğini kullanın.");
  });
}

function setAuthPanel(panelId) {
  document.getElementById("auth-screen").hidden = false;
  document.getElementById("app-shell").hidden = true;
  ["login-panel", "setup-panel", "offline-unlock-panel"].forEach(function (id) {
    document.getElementById(id).hidden = id !== panelId;
  });
  document.getElementById("auth-message").hidden = true;
  document.getElementById("auth-message").textContent = "";
}

function showLogin() {
  currentPage = null;
  previousPages.length = 0;
  setAuthPanel("login-panel");
}

function showAuthMessage(message) {
  const element = document.getElementById("auth-message");
  element.textContent = message;
  element.hidden = false;
}

function requireOnlineLogin(message) {
  offlineMode = false;
  currentUser = null;
  pendingOnlineUser = null;
  showLogin();
  showAuthMessage(message);
}

function showDataLoadError(error) {
  const banner = document.getElementById("data-load-error");
  document.getElementById("data-load-error-message").textContent =
    "Veriler yüklenemedi: " + (error && error.message ? error.message : "Sunucuya bağlanılamadı.");
  banner.hidden = false;
  document.getElementById("retry-data-load").disabled = false;
  document.getElementById("retry-data-load").textContent = "Yeniden dene";
}

function initials(fullName) {
  return String(fullName || "SS").trim().split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toLocaleUpperCase("tr-TR");
}

function updateUserIdentity(user) {
  currentUser = user;
  const isAdmin = user.role === "admin";
  const roleName = isAdmin ? "Yönetici" : "Kullanıcı";
  const avatar = initials(user.full_name);
  document.getElementById("top-user-name").textContent = user.full_name;
  document.getElementById("top-user-role").textContent = roleName;
  document.getElementById("top-avatar").textContent = avatar;
  const profileAvatar = document.getElementById("profile-avatar");
  if (profileAvatar) profileAvatar.textContent = avatar;
}

function enterApp(user) {
  offlineMode = false;
  updateUserIdentity(user);
  currentPage = null;
  previousPages.length = 0;
  const isAdmin = user.role === "admin";
  document.querySelectorAll("[data-admin-only]").forEach(function (element) { element.hidden = !isAdmin; });
  document.getElementById("auth-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;
  setPage("overview");
  refreshAll().then(function () {
    const state = window.SaveStockOfflineStore.isUnlocked() ? window.SaveStockOfflineStore.state() : null;
    if (state && state.queue.length && navigator.onLine) syncOfflineTransactions();
  }).catch(function (error) {
    showDataLoadError(error);
    showToast("Veriler yüklenemedi. " + error.message, true);
  });
}

async function initializeAuth() {
  try {
    const status = await api("/api/auth/status");
    if (status.authenticated) {
      await continueOnlineAuth(status.user);
    } else if (!status.initialized) {
      setAuthPanel("setup-panel");
    } else {
      showLogin();
    }
  } catch (error) {
    try {
      if (isNetworkError(error) && await window.SaveStockOfflineStore.hasVault()) {
        await openOfflineUnlock();
        return;
      }
    } catch (storageError) {
      showLogin();
      showAuthMessage("Çevrimdışı kasa okunamadı: " + storageError.message);
      return;
    }
    showLogin();
    showAuthMessage("Sunucuya bağlanılamadı. Uygulama sunucusunun çalıştığını kontrol edin.");
  }
}

function wireAuthEvents() {
  document.getElementById("login-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api("/api/auth/login", {method: "POST", body: JSON.stringify(payload)});
      form.reset();
      await continueOnlineAuth(result.user);
    } catch (error) { showAuthMessage(error.message); }
  });
  document.getElementById("setup-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.password !== values.password_confirm) { showAuthMessage("Girdiğiniz şifreler aynı değil."); return; }
    const payload = {full_name: values.full_name, email: values.email, password: values.password};
    try {
      const result = await api("/api/auth/setup", {method: "POST", body: JSON.stringify(payload)});
      form.reset();
      await continueOnlineAuth(result.user);
    } catch (error) { showAuthMessage(error.message); }
  });
  document.getElementById("offline-unlock-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const pin = new FormData(form).get("pin");
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Kasa açılıyor…";
    try {
      const state = await window.SaveStockOfflineStore.unlock(pin);
      form.reset();
      if (pendingOnlineUser) {
        const user = pendingOnlineUser;
        if (String(state.user.id) !== String(user.id)) {
          if (state.queue.length) {
            window.SaveStockOfflineStore.lock();
            pendingOnlineUser = null;
            setAuthPanel("login-panel");
            showAuthMessage("Çevrimdışı kasada başka bir hesaba ait bekleyen işlemler var. Önce o hesapla giriş yapın.");
            return;
          }
          await window.SaveStockOfflineStore.clear();
          offlineState = null;
        }
        pendingOnlineUser = null;
        enterApp(user);
      } else {
        await enterOfflineApp(state);
      }
    } catch (error) {
      showAuthMessage(error.message);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });
  document.getElementById("logout-button").addEventListener("click", async function () {
    if (!navigator.onLine) {
      showToast("Çevrimdışı durumda güvenli çıkış yapılamaz. Bağlantı gelince tekrar deneyin.", true);
      return;
    }
    const state = window.SaveStockOfflineStore.isUnlocked() ? window.SaveStockOfflineStore.state() : null;
    if (state && state.queue.length && !window.confirm(
      state.queue.length + " işlem henüz eşitlenmedi. Çıkış yaparsanız bu cihazdaki çevrimdışı veriler ve bekleyen işlemler silinir. Devam edilsin mi?"
    )) return;
    try { await api("/api/auth/logout", {method: "POST", body: "{}"}); }
    catch (error) {
      if (error.status !== 401) { showToast(error.message, true); return; }
    }
    try { await window.SaveStockOfflineStore.clear(); }
    catch (error) { showToast(error.message, true); return; }
    offlineState = null;
    offlineMode = false;
    offlineBannerNotice = null;
    currentUser = null;
    showLogin();
  });
}
function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function formatDate(value) {
  if (!value) return "—";
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
  return new Intl.DateTimeFormat("tr-TR", {day: "2-digit", month: "2-digit", year: "numeric"}).format(date);
}
function formatDateTime(value) {
  return new Intl.DateTimeFormat("tr-TR", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"}).format(new Date(value));
}
function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(value || 0));
}
function daysUntil(value) {
  const expiry = new Date(value + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / 86400000);
}
function batchStatus(batch) {
  const days = daysUntil(batch.expiry_date);
  if (days < 0) return "expired";
  if (days <= expiryWarningDays) return "near";
  if (days <= 90) return "mid";
  return "long";
}
function isLowStock(product) {
  const quantity = Number(product.total_quantity || 0);
  return quantity >= 0 && quantity <= lowStockThreshold;
}
function isCriticalStock(product) {
  return isLowStock(product);
}
const PRODUCT_INSIGHTS = {
  total: {
    title: "Tüm ürünler",
    description: "Ürün kataloğunuzdaki tüm kayıtlı ürünler. Her ürünün kategori, stok kodu ve mevcut miktarını inceleyin.",
    color: "blue",
    countLabel: "Kayıtlı ürün"
  },
  stocked: {
    title: "Stokta olan ürünler",
    description: "Mevcut stok miktarı sıfırdan fazla olan ürünler. Listedeki miktarlar ürünün kayıtlı birimiyle gösterilir.",
    color: "green",
    countLabel: "Stoklu ürün"
  },
  critical: {
    title: "Kritik stoktaki ürünler",
    description: "Stok miktarı kritik stok eşiğinde veya altında kalan ürünler. Stokta olmayanlar da bu uyarı grubuna dahildir.",
    color: "amber",
    countLabel: "Kritik ürün"
  },
  empty: {
    title: "Stokta olmayan ürünler",
    description: "Mevcut stok miktarı sıfır olan ve stok girişi bekleyen ürünler.",
    color: "red",
    countLabel: "Stoksuz ürün"
  }
};
function matchesProductInsight(product, key) {
  const quantity = Number(product.total_quantity || 0);
  if (key === "stocked") return quantity > 0;
  if (key === "critical") return isCriticalStock(product);
  if (key === "empty") return quantity === 0;
  return true;
}
function renderProductInsight() {
  if (!activeProductInsight) return;
  const insight = PRODUCT_INSIGHTS[activeProductInsight];
  if (!insight) return;
  const products = productCatalog.filter(function (product) {
    return matchesProductInsight(product, activeProductInsight);
  });
  const query = document.getElementById("product-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = products.filter(function (product) {
    return [product.name, product.sku, product.barcode, product.category_name]
      .join(" ").toLocaleLowerCase("tr-TR").includes(query);
  }).sort(function (a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "tr", {sensitivity: "base", numeric: true});
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_INSIGHT_PAGE_SIZE));
  productInsightPage = Math.min(productInsightPage, totalPages);
  const pageProducts = filtered.slice((productInsightPage - 1) * PRODUCT_INSIGHT_PAGE_SIZE, productInsightPage * PRODUCT_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-product-insight="' + activeProductInsight + '"] .metric-icon');
  const icon = document.getElementById("product-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.replaceChildren();
  if (iconSource) icon.appendChild(iconSource.querySelector("svg").cloneNode(true));
  document.getElementById("product-insight-title").textContent = insight.title;
  document.getElementById("product-insight-description").textContent = activeProductInsight === "critical"
    ? "Stok miktarı kritik eşik olan " + lowStockThreshold.toLocaleString("tr-TR") + " birim veya altında kalan ürünler. Stokta olmayanlar da bu uyarı grubuna dahildir."
    : insight.description;
  document.getElementById("product-insight-count").textContent = products.length.toLocaleString("tr-TR");
  document.getElementById("product-insight-count-label").textContent = insight.countLabel;
  document.getElementById("product-insight-list-title").textContent = insight.title + " listesi";
  document.getElementById("product-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + products.length.toLocaleString("tr-TR") + " ürün" :
      products.length.toLocaleString("tr-TR") + " ürün";
  const list = document.getElementById("product-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (products.length ? "Aramanızla eşleşen ürün bulunamadı." : "Bu durumda listelenecek ürün bulunmuyor.") + "</p>";
  } else {
    list.innerHTML = pageProducts.map(function (product) {
      const quantity = Number(product.total_quantity || 0);
      const low = isLowStock(product);
      const status = quantity === 0 ? "Stokta yok" : (low ? "Kritik stok" : "Stokta");
      const statusClass = quantity === 0 ? "expired" : (low ? "near" : "ok");
      return '<article class="product-insight-item" role="listitem">' +
        '<div class="product-insight-item-copy"><strong>' + escapeHtml(product.name) + '</strong><small>' +
        escapeHtml(product.sku) + " · " + escapeHtml(product.category_name || "Kategorisiz") + '</small></div>' +
        '<span class="badge ' + statusClass + '">' + status + '</span>' +
        '<div class="product-insight-quantity"><span>Mevcut stok</span><strong>' +
        quantity.toLocaleString("tr-TR") + " " + escapeHtml(product.unit) + "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("product-insight-pagination");
  pagination.hidden = filtered.length <= PRODUCT_INSIGHT_PAGE_SIZE;
  document.getElementById("product-insight-page-label").textContent =
    productInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " ürün";
  document.getElementById("product-insight-previous").disabled = productInsightPage <= 1;
  document.getElementById("product-insight-next").disabled = productInsightPage >= totalPages;
}
function statusLabel(status) {
  return {expired: "SKT geçti", near: "Yaklaşıyor", mid: "30–90 gün", long: "90+ gün"}[status] || "Normal";
}
function closeNotificationPanel(restoreFocus) {
  const panel = document.getElementById("notification-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.getElementById("notification-button").setAttribute("aria-expanded", "false");
  if (restoreFocus) document.getElementById("notification-button").focus();
}
function setPage(page, options) {
  if (!PAGE_INFO[page]) return;
  if (offlineMode && !["overview", "products", "product-insight", "movements", "movement-insight", "expiry", "expiry-insight"].includes(page)) {
    showToast("Çevrimdışı modda yalnızca önbellekteki stok ekranları kullanılabilir.", true);
    return;
  }
  if (["users", "user-insight", "dealers", "dealer-insight"].includes(page) && (!currentUser || currentUser.role !== "admin")) {
    showToast("Bu ekran için yönetici yetkisi gerekiyor.", true);
    return;
  }
  const trackHistory = !options || options.trackHistory !== false;
  if (currentPage && currentPage !== page && trackHistory) previousPages.push(currentPage);
  currentPage = page;
  document.querySelectorAll(".page").forEach(function (section) { section.classList.toggle("active", section.id === "page-" + page); });
  document.querySelectorAll(".nav-item").forEach(function (item) { item.classList.toggle("active", item.dataset.page === page); });
  document.getElementById("page-title").textContent = PAGE_INFO[page][0];
  document.getElementById("page-breadcrumb").textContent = PAGE_INFO[page][1];
  const overviewDealer = page === "overview" ? getOverviewContext().dealer : null;
  document.getElementById("page-subtitle").textContent = overviewDealer
    ? overviewDealer.name + " · stok ve SKT özeti"
    : PAGE_INFO[page][2];
  window.scrollTo({top: 0, behavior: "smooth"});
}
function returnToPreviousPage() {
  const page = previousPages.pop();
  if (!page) return false;
  setPage(page, {trackHistory: false});
  return true;
}
function wireSwipeBackGesture() {
  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let startPoint = null;
  const isBlockedTarget = function (target) {
    if (!(target instanceof Element)) return true;
    if (target.closest("input, textarea, select, button, a, iframe, [contenteditable='true'], .table-wrap, .tabs, .sidebar")) return true;
    return Boolean(
      document.querySelector("#notification-panel:not([hidden]), #billing-checkout-panel:not([hidden]), dialog[open], .sidebar.is-open")
    );
  };

  document.addEventListener("pointerdown", function (event) {
    if (!mobileQuery.matches || event.pointerType !== "touch" || !event.isPrimary
      || event.clientX > 32 || !previousPages.length || !currentUser
      || document.getElementById("app-shell").hidden || isBlockedTarget(event.target)) {
      startPoint = null;
      return;
    }
    startPoint = {x: event.clientX, y: event.clientY};
  }, {passive: true});

  document.addEventListener("pointerup", function (event) {
    if (!startPoint || event.pointerType !== "touch") {
      startPoint = null;
      return;
    }
    const deltaX = event.clientX - startPoint.x;
    const deltaY = Math.abs(event.clientY - startPoint.y);
    startPoint = null;
    if (deltaX >= 80 && deltaY <= 70 && deltaX > deltaY * 1.5) returnToPreviousPage();
  }, {passive: true});

  document.addEventListener("pointercancel", function () {
    startPoint = null;
  }, {passive: true});
}
function updateCategorySelects() {
  const options = categories.map(function (category) { return '<option value="' + category.id + '">' + escapeHtml(category.name) + "</option>"; }).join("");
  const productSelect = document.getElementById("category-select");
  const selectedId = productSelect.value;
  productSelect.innerHTML = options || '<option value="">Kategori yok</option>';
  if (selectedId && categories.some(function (item) { return String(item.id) === selectedId; })) productSelect.value = selectedId;
  const filter = document.getElementById("product-category-filter");
  const selectedFilter = filter.value;
  filter.innerHTML = '<option value="">Tüm kategoriler</option>' + options;
  if (selectedFilter && categories.some(function (item) { return String(item.id) === selectedFilter; })) filter.value = selectedFilter;
  const editCategory = document.getElementById("product-edit-category");
  if (editCategory) {
    const selectedEdit = editCategory.value;
    editCategory.innerHTML = '<option value="">Kategorisiz</option>' + options;
    if (selectedEdit && categories.some(function (item) { return String(item.id) === selectedEdit; })) editCategory.value = selectedEdit;
  }
}
function updateProductSelects() {
  const options = productCatalog.map(function (product) { return '<option value="' + product.id + '">' + escapeHtml(product.sku + " · " + product.name) + "</option>"; }).join("");
  document.querySelectorAll(".product-select").forEach(function (select) {
    const selected = select.value;
    select.innerHTML = options || '<option value="">Önce ürün ekleyin</option>';
    if (selected && productCatalog.some(function (product) { return String(product.id) === selected; })) select.value = selected;
  });
  renderRequestProductStock();
}
function renderRequestProductStock() {
  const target = document.getElementById("request-product-stock");
  if (!target) return;
  const productSelect = document.querySelector('#stock-request-form [name="product_id"]');
  const product = productCatalog.find(function (item) { return productSelect && String(item.id) === productSelect.value; });
  if (!product) {
    target.textContent = "Ürün seçildiğinde mevcut miktar burada görünür.";
    return;
  }
  const dealerId = currentUser && currentUser.role === "admin"
    ? document.getElementById("request-dealer-select").value
    : (currentUser && currentUser.dealer_id ? String(currentUser.dealer_id) : "");
  if (!dealerId) {
    target.textContent = "Mevcut miktarı görmek için talep sahibi bayiyi seçin.";
    return;
  }
  const productBatches = batches.filter(function (batch) {
    return String(batch.product_id) === String(product.id) && String(batch.dealer_id) === String(dealerId);
  });
  const total = productBatches.reduce(function (sum, batch) { return sum + Number(batch.quantity_on_hand || 0); }, 0);
  const expired = productBatches.filter(function (batch) { return daysUntil(batch.expiry_date) < 0; })
    .reduce(function (sum, batch) { return sum + Number(batch.quantity_on_hand || 0); }, 0);
  const usable = Math.max(0, total - expired);
  target.innerHTML = '<span>Mevcut stok</span><strong>' + total.toLocaleString("tr-TR") + " " + escapeHtml(product.unit) + '</strong><small>Kullanılabilir: ' + usable.toLocaleString("tr-TR") + " " + escapeHtml(product.unit) + " · SKT’si geçmiş: " + expired.toLocaleString("tr-TR") + " " + escapeHtml(product.unit) + "</small>";
}
function renderProducts() {
  const query = document.getElementById("product-search").value.trim().toLocaleLowerCase("tr-TR");
  const categoryId = document.getElementById("product-category-filter").value;
  const stockFilter = document.getElementById("product-stock-filter").value;
  const filtered = productCatalog.filter(function (product) {
    const searchable = [product.sku, product.barcode, product.name, product.category_name].join(" ").toLocaleLowerCase("tr-TR");
    const quantity = Number(product.total_quantity || 0);
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "in_stock" && quantity > 0) ||
      (stockFilter === "low_stock" && isLowStock(product)) ||
      (stockFilter === "no_stock" && quantity === 0);
    return searchable.includes(query) && (!categoryId || String(product.category_id) === categoryId) && matchesStock;
  }).sort(function (a, b) {
    const left = a[productSortKey], right = b[productSortKey];
    const compare = productSortKey === "total_quantity"
      ? Number(left || 0) - Number(right || 0)
      : String(left || "").localeCompare(String(right || ""), "tr", {sensitivity: "base", numeric: true});
    return compare * productSortDirection || Number(a.id) - Number(b.id);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PRODUCT_PAGE_SIZE));
  productPage = Math.min(productPage, totalPages);
  const pageProducts = filtered.slice((productPage - 1) * PRODUCT_PAGE_SIZE, productPage * PRODUCT_PAGE_SIZE);
  const body = document.getElementById("product-rows");
  if (!filtered.length) {
    body.innerHTML = '<tr><td class="empty" colspan="8">' + (productCatalog.length ? "Filtrelerle eşleşen ürün bulunamadı. Arama veya filtreleri temizleyin." : "Henüz ürün yok. Sağdaki formdan ilk ürünü ekleyin.") + "</td></tr>";
  } else {
    body.innerHTML = pageProducts.map(function (product) {
      const quantity = Number(product.total_quantity || 0);
      const low = isLowStock(product);
      const selected = selectedProductIds.has(String(product.id));
      const status = quantity === 0 ? "Stokta yok" : (low ? "Kritik stok" : "Stokta");
      const statusClass = quantity === 0 ? "expired" : (low ? "near" : "ok");
      return '<tr data-product-id="' + Number(product.id) + '" aria-selected="' + selected + '">' +
        '<td class="product-select-cell" data-label="Seç"><label class="product-select-target"><input class="product-row-select" type="checkbox" aria-label="' + escapeHtml(product.name) + ' ürününü seç"' + (selected ? " checked" : "") + "></label></td>" +
        '<td class="product-cell" data-label="Ürün"><strong>' + escapeHtml(product.name) + "</strong></td>" +
        '<td data-label="Stok kodu"><span class="sku-label">' + escapeHtml(product.sku) + "</span></td>" +
        '<td data-label="Barkod"><span class="sku-label">' + escapeHtml(product.barcode || "—") + "</span></td>" +
        '<td data-label="Kategori">' + escapeHtml(product.category_name || "Kategorisiz") + "</td>" +
        '<td class="qty" data-label="Mevcut stok">' + quantity.toLocaleString("tr-TR") + " " + escapeHtml(product.unit) + "</td>" +
        '<td data-label="Durum"><span class="badge ' + statusClass + '">' + status + "</span></td>" +
        '<td class="product-actions-cell" data-label="İşlem"><details class="product-quick-actions">' +
          '<summary aria-label="' + escapeHtml(product.name) + ' ürünü için hızlı işlemler">Hızlı işlem</summary>' +
          '<div><button type="button" data-product-stock="inbound" data-product-id="' + Number(product.id) + '">Stok girişi</button>' +
          '<button type="button" data-product-stock="outbound" data-product-id="' + Number(product.id) + '">Stok çıkışı</button></div></details>' +
          (currentUser && currentUser.role === "admin"
            && !offlineMode
            ? '<button class="button button-quiet product-edit-button" type="button" data-edit-product="' + Number(product.id) + '" aria-label="' + escapeHtml(product.name) + ' ürününü düzenle">Düzenle</button>'
            : "") + "</td></tr>";
    }).join("");
  }
  document.querySelectorAll("[data-product-sort]").forEach(function (button) {
    const active = button.dataset.productSort === productSortKey;
    const th = button.closest("th");
    th.setAttribute("aria-sort", active ? (productSortDirection === 1 ? "ascending" : "descending") : "none");
    button.querySelector("span").textContent = active ? (productSortDirection === 1 ? "↑" : "↓") : "";
  });
  const selectAll = document.getElementById("select-all-products");
  const visibleSelected = pageProducts.filter(function (product) { return selectedProductIds.has(String(product.id)); }).length;
  selectAll.checked = pageProducts.length > 0 && visibleSelected === pageProducts.length;
  selectAll.indeterminate = visibleSelected > 0 && visibleSelected < pageProducts.length;
  const pagination = document.getElementById("product-pagination");
  pagination.hidden = filtered.length <= PRODUCT_PAGE_SIZE;
  document.getElementById("product-page-label").textContent = productPage + " / " + totalPages + " · " + filtered.length + " ürün";
  document.getElementById("product-page-previous").disabled = productPage <= 1;
  document.getElementById("product-page-next").disabled = productPage >= totalPages;
  const bulkActions = document.getElementById("product-bulk-actions");
  bulkActions.hidden = selectedProductIds.size === 0;
  document.getElementById("selected-product-count").textContent = selectedProductIds.size + " ürün seçildi";
  const activeFilters = Number(Boolean(query)) + Number(Boolean(categoryId)) + Number(stockFilter !== "all");
  document.getElementById("product-filter-summary").textContent =
    (activeFilters ? activeFilters + " filtre etkin" : "Tüm ürünler") + " · " + filtered.length + " sonuç";
  document.getElementById("product-total-count").textContent = productCatalog.length;
  document.getElementById("product-stocked-count").textContent = productCatalog.filter(function (item) { return Number(item.total_quantity || 0) > 0; }).length;
  document.getElementById("product-low-count").textContent = productCatalog.filter(isLowStock).length;
  document.getElementById("product-empty-count").textContent = productCatalog.filter(function (item) { return Number(item.total_quantity || 0) === 0; }).length;
}
function visibleProductIds() {
  return Array.from(document.querySelectorAll("#product-rows tr[data-product-id]")).map(function (row) { return row.dataset.productId; });
}
function clearProductFormErrors(form) {
  form.querySelectorAll(".field-error").forEach(function (element) { element.hidden = true; element.textContent = ""; });
  form.querySelectorAll("[aria-invalid='true']").forEach(function (field) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
  const summary = form.querySelector(".form-error") || document.getElementById(form.id === "product-edit-form" ? "product-edit-error" : "product-form-error");
  if (summary) { summary.hidden = true; summary.textContent = ""; }
}
function showProductFormError(form, error) {
  const fieldErrors = Object.assign({}, error.fieldErrors || {});
  if (!Object.keys(fieldErrors).length) {
    const message = String(error.message || "").toLocaleLowerCase("tr-TR");
    const field = message.includes("stok kodu") ? "sku"
      : message.includes("barkod") ? "barcode"
        : message.includes("kategori") ? "category_id" : null;
    if (field) fieldErrors[field] = error.message;
  }
  Object.keys(fieldErrors).forEach(function (name) {
    const field = Array.from(form.elements).find(function (item) { return item.name === name; });
    const message = Array.from(form.querySelectorAll("[data-error-for]")).find(function (item) { return item.dataset.errorFor === name; });
    if (!field || !message) return;
    if (form.id === "product-form" && ["barcode", "category_id", "unit"].includes(name)) {
      const optionalFields = form.querySelector(".product-add-options");
      if (optionalFields) optionalFields.open = true;
    }
    message.textContent = fieldErrors[name];
    message.hidden = false;
    message.id = form.id + "-error-" + name;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", message.id);
  });
  const summary = form.querySelector(".form-error") || document.getElementById(form.id === "product-edit-form" ? "product-edit-error" : "product-form-error");
  if (summary && !Object.keys(fieldErrors).length) {
    summary.textContent = error.message;
    summary.hidden = false;
  }
}
function openProductEditor(productId) {
  if (!currentUser || currentUser.role !== "admin") return;
  const product = productCatalog.find(function (item) { return String(item.id) === String(productId); });
  if (!product) { showToast("Düzenlenecek ürün bulunamadı. Listeyi yenileyin.", true); return; }
  editingProductId = product.id;
  const form = document.getElementById("product-edit-form");
  clearProductFormErrors(form);
  form.elements.sku.value = product.sku || "";
  form.elements.barcode.value = product.barcode || "";
  form.elements.name.value = product.name || "";
  form.elements.category_id.value = product.category_id == null ? "" : String(product.category_id);
  form.elements.unit.value = product.unit || "adet";
  document.getElementById("product-edit-dialog").showModal();
  form.elements.name.focus();
}
function renderBatches() {
  const query = document.getElementById("batch-search").value.trim().toLocaleLowerCase("tr-TR");
  const eligible = batches.filter(function (batch) {
    const searchable = [batch.dealer_name, batch.product_name, batch.sku, batch.batch_code].join(" ").toLocaleLowerCase("tr-TR");
    const status = batchStatus(batch);
    return searchable.includes(query) && (activeExpiryFilter === "all" || status === activeExpiryFilter);
  });
  const totalPages = Math.max(1, Math.ceil(eligible.length / BATCH_PAGE_SIZE));
  batchPage = Math.min(batchPage, totalPages);
  const pageBatches = eligible.slice((batchPage - 1) * BATCH_PAGE_SIZE, batchPage * BATCH_PAGE_SIZE);
  const body = document.getElementById("batch-rows");
  if (!eligible.length) {
    body.innerHTML = '<tr><td class="empty" colspan="8">' + (batches.length ? "Bu filtrede lot bulunamadı." : "Henüz lot yok. Stok girişi yaparak başlayın.") + "</td></tr>";
  } else {
    body.innerHTML = pageBatches.map(function (batch) {
      const status = batchStatus(batch), days = daysUntil(batch.expiry_date);
      const remaining = days < 0 ? Math.abs(days) + " gün geçti" : days + " gün";
      return "<tr><td>" + escapeHtml(batch.dealer_name || "Merkez Depo") + '</td><td class="product-cell"><strong>' + escapeHtml(batch.product_name) + "</strong></td>" +
        '<td><span class="sku-label">' + escapeHtml(batch.sku) + "</span></td><td>" + escapeHtml(batch.batch_code) + "</td>" +
        "<td>" + formatDate(batch.expiry_date) + '</td><td><span class="badge ' + status + '">' + remaining + "</span></td>" +
        '<td class="qty">' + batch.quantity_on_hand.toLocaleString("tr-TR") + " " + escapeHtml(batch.unit) + '</td><td><span class="badge ' + status + '">' + statusLabel(status) + "</span></td></tr>";
    }).join("");
  }
  const pagination = document.getElementById("batch-pagination");
  pagination.hidden = eligible.length <= BATCH_PAGE_SIZE;
  document.getElementById("batch-page-label").textContent = batchPage + " / " + totalPages + " · " + eligible.length + " lot";
  document.getElementById("batch-page-previous").disabled = batchPage <= 1;
  document.getElementById("batch-page-next").disabled = batchPage >= totalPages;
}
const EXPIRY_INSIGHTS = {
  expired: {
    title: "SKT'si geçmiş lotlar",
    description: "Son kullanma tarihi geçmiş lotlar. Bu ürünleri kontrol edin ve stok durumunuza göre gerekli işlemi yapın.",
    color: "red",
    empty: "SKT'si geçmiş lot bulunmuyor."
  },
  near: {
    title: "Uyarı dönemindeki lotlar",
    color: "amber",
    empty: "Uyarı döneminde lot bulunmuyor."
  },
  mid: {
    title: "30–90 gün içinde SKT'si dolacak lotlar",
    description: "Son kullanma tarihine 31 ile 90 gün kalan lotlar.",
    color: "blue",
    empty: "Bu tarih aralığında lot bulunmuyor."
  },
  long: {
    title: "SKT'sine 90 günden fazla kalan lotlar",
    description: "Son kullanma tarihine 90 günden fazla kalan lotlar.",
    color: "green",
    empty: "Bu durumda lot bulunmuyor."
  }
};
function renderExpiryInsight() {
  if (!activeExpiryInsight) return;
  const insight = EXPIRY_INSIGHTS[activeExpiryInsight];
  if (!insight) return;
  const matchingBatches = batches.filter(function (batch) {
    return batchStatus(batch) === activeExpiryInsight;
  }).sort(function (a, b) {
    return String(a.expiry_date).localeCompare(String(b.expiry_date)) ||
      String(a.product_name).localeCompare(String(b.product_name), "tr", {sensitivity: "base"});
  });
  const query = document.getElementById("expiry-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = matchingBatches.filter(function (batch) {
    return [batch.dealer_name, batch.product_name, batch.sku, batch.batch_code]
      .join(" ").toLocaleLowerCase("tr-TR").includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / EXPIRY_INSIGHT_PAGE_SIZE));
  expiryInsightPage = Math.min(expiryInsightPage, totalPages);
  const pageBatches = filtered.slice((expiryInsightPage - 1) * EXPIRY_INSIGHT_PAGE_SIZE, expiryInsightPage * EXPIRY_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-expiry-insight="' + activeExpiryInsight + '"] .metric-icon');
  const icon = document.getElementById("expiry-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.textContent = iconSource ? iconSource.textContent.trim() : "";
  document.getElementById("expiry-insight-title").textContent = insight.title;
  document.getElementById("expiry-insight-description").textContent = activeExpiryInsight === "near"
    ? "Son kullanma tarihine " + expiryWarningDays.toLocaleString("tr-TR") + " gün veya daha az kalan, ancak tarihi henüz geçmemiş lotlar."
    : insight.description;
  document.getElementById("expiry-insight-count").textContent = matchingBatches.length.toLocaleString("tr-TR");
  document.getElementById("expiry-insight-list-title").textContent = insight.title;
  document.getElementById("expiry-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + matchingBatches.length.toLocaleString("tr-TR") + " lot" :
      matchingBatches.length.toLocaleString("tr-TR") + " lot";
  const list = document.getElementById("expiry-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (matchingBatches.length ? "Aramanızla eşleşen lot bulunamadı." : insight.empty) + "</p>";
  } else {
    list.innerHTML = pageBatches.map(function (batch) {
      const days = daysUntil(batch.expiry_date);
      const remaining = days < 0 ? Math.abs(days).toLocaleString("tr-TR") + " gün geçti" :
        days === 0 ? "Bugün" : days.toLocaleString("tr-TR") + " gün kaldı";
      const status = batchStatus(batch);
      return '<article class="product-insight-item expiry-insight-item" role="listitem">' +
        '<div class="product-insight-item-copy"><strong>' + escapeHtml(batch.product_name) + '</strong><small>' +
        "Stok kodu " + escapeHtml(batch.sku || "—") + " · Lot " + escapeHtml(batch.batch_code || "—") + '</small><small>' +
        escapeHtml(batch.dealer_name || "Merkez Depo") + " · SKT " + formatDate(batch.expiry_date) + '</small></div>' +
        '<span class="badge ' + status + '">' + escapeHtml(statusLabel(status)) + '</span>' +
        '<div class="product-insight-quantity"><span>' + remaining + '</span><strong>' +
        Number(batch.quantity_on_hand || 0).toLocaleString("tr-TR") + " " + escapeHtml(batch.unit) + "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("expiry-insight-pagination");
  pagination.hidden = filtered.length <= EXPIRY_INSIGHT_PAGE_SIZE;
  document.getElementById("expiry-insight-page-label").textContent =
    expiryInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " lot";
  document.getElementById("expiry-insight-previous").disabled = expiryInsightPage <= 1;
  document.getElementById("expiry-insight-next").disabled = expiryInsightPage >= totalPages;
}
function updateDealerSelects() {
  const isAdmin = currentUser && currentUser.role === "admin";
  const allowedForStock = isAdmin
    ? dealers
    : (currentUser && currentUser.dealer_id
      ? dealers.filter(function (dealer) { return String(dealer.id) === String(currentUser.dealer_id); })
      : []);
  document.querySelectorAll(".dealer-select").forEach(function (select) {
    const selected = select.value;
    select.innerHTML = allowedForStock.length
      ? allowedForStock.map(function (dealer) { return '<option value="' + dealer.id + '">' + escapeHtml(dealer.name) + "</option>"; }).join("")
      : '<option value="">Bayi hesabı tanımlı değil</option>';
    if (allowedForStock.some(function (dealer) { return String(dealer.id) === selected; })) select.value = selected;
    else if (currentUser && currentUser.dealer_id && allowedForStock.length) select.value = String(currentUser.dealer_id);
    select.required = allowedForStock.length > 0;
  });
  const userDealer = document.getElementById("user-dealer");
  const selectedDealer = userDealer.value;
  userDealer.innerHTML = '<option value="">Bayi seçin</option>' + dealers.map(function (dealer) {
    return '<option value="' + dealer.id + '">' + escapeHtml(dealer.name) + " bayisi</option>";
  }).join("");
  if (dealers.some(function (dealer) { return String(dealer.id) === selectedDealer; })) userDealer.value = selectedDealer;
  const isAdminAccount = document.getElementById("user-role").value === "admin";
  userDealer.disabled = isAdminAccount;
  userDealer.required = !isAdminAccount;
  document.getElementById("user-dealer-label").hidden = isAdminAccount;
  const requestDealer = document.getElementById("request-dealer-select");
  if (requestDealer) {
    const selectedRequestDealer = requestDealer.value;
    const activeDealers = dealers.filter(function (dealer) { return dealer.is_active !== false; });
    requestDealer.innerHTML = '<option value="">Bayi seçin</option>' + activeDealers.map(function (dealer) {
      return '<option value="' + dealer.id + '">' + escapeHtml(dealer.name) + " bayisi</option>";
    }).join("");
    if (activeDealers.some(function (dealer) { return String(dealer.id) === selectedRequestDealer; })) requestDealer.value = selectedRequestDealer;
  }
}
function renderDealerOverview() {
  const branchSummaries = dealerOverview.dealers || [];
  const stockRows = dealerOverview.stocks || [];
  const expiringRows = dealerOverview.expiring || [];
  document.getElementById("dealer-count").textContent = branchSummaries.length;
  document.getElementById("dealer-total-units").textContent = branchSummaries.reduce(function (sum, dealer) { return sum + dealer.total_units; }, 0).toLocaleString("tr-TR");
  document.getElementById("dealer-near-expiry").textContent = branchSummaries.reduce(function (sum, dealer) { return sum + dealer.near_expiry_batches; }, 0);
  document.getElementById("dealer-expired").textContent = branchSummaries.reduce(function (sum, dealer) { return sum + dealer.expired_batches; }, 0);

  const summaryBody = document.getElementById("dealer-summary-rows");
  summaryBody.innerHTML = branchSummaries.length ? branchSummaries.map(function (dealer) {
    const selected = String(selectedDealerId) === String(dealer.id);
    return '<tr class="dealer-selectable-row' + (selected ? ' selected' : '') + '" data-dealer-view="' + dealer.id + '"><td class="product-cell"><strong>' + escapeHtml(dealer.name) + "</strong></td><td>" + dealer.products_in_stock.toLocaleString("tr-TR") +
      '</td><td class="qty">' + dealer.total_units.toLocaleString("tr-TR") + '</td><td><span class="badge ' + (dealer.near_expiry_batches ? "near" : "ok") + '">' + dealer.near_expiry_batches +
      '</span></td><td><span class="badge ' + (dealer.expired_batches ? "expired" : "ok") + '">' + dealer.expired_batches + '</span></td><td><button class="button button-quiet dealer-view-button" type="button" data-dealer-view="' + dealer.id + '">Ürünleri gör</button></td></tr>';
  }).join("") : '<tr><td class="empty" colspan="6">Henüz bayi yok. Yönetici yeni bayi ekleyebilir.</td></tr>';

  const stockBody = document.getElementById("dealer-stock-rows");
  const selectedDealer = dealers.find(function (dealer) { return String(dealer.id) === String(selectedDealerId); });
  const dealerStockRows = selectedDealer ? stockRows.filter(function (item) { return String(item.dealer_id) === String(selectedDealer.id); }) : stockRows;
  const visibleStockRows = dealerStockRows.filter(function (item) {
    const searchable = [item.product_name, item.sku].join(" ").toLocaleLowerCase("tr-TR");
    return searchable.includes(dealerStockQuery);
  });
  const visibleExpiryRows = selectedDealer ? expiringRows.filter(function (item) { return String(item.dealer_id) === String(selectedDealer.id); }) : expiringRows;
  document.getElementById("dealer-stock-title").textContent = selectedDealer ? selectedDealer.name + " · ürünleri" : "Bayi bazında ürün stokları";
  document.getElementById("dealer-stock-description").textContent = selectedDealer ? "Bu bayideki ürünler ve mevcut miktarlar." : "Ürünlerin hangi bayide ne kadar bulunduğu.";
  document.getElementById("dealer-expiry-title").textContent = selectedDealer ? selectedDealer.name + " · SKT takibi" : "Yaklaşan ve geçmiş SKT'ler";
  document.getElementById("dealer-expiry-description").textContent = selectedDealer ? "Bu bayideki lotların yaklaşan ve geçmiş SKT bilgileri." : "Lotlar bayi adıyla birlikte listelenir.";
  document.getElementById("dealer-show-all").hidden = !selectedDealer;
  stockBody.innerHTML = visibleStockRows.length ? visibleStockRows.map(function (item) {
    return '<tr><td>' + escapeHtml(item.dealer_name) + '</td><td class="product-cell"><strong>' + escapeHtml(item.product_name) + '</strong></td><td><span class="sku-label">' + escapeHtml(item.sku) +
      '</span></td><td class="qty">' + item.quantity.toLocaleString("tr-TR") + '</td><td>' + escapeHtml(item.unit) + "</td></tr>";
  }).join("") : '<tr><td class="empty" colspan="5">' + (dealerStockQuery ? "Aramanızla eşleşen ürün bulunamadı." : selectedDealer ? "Bu bayide kayıtlı stok yok." : "Henüz bayilerde kayıtlı stok yok.") + "</td></tr>";

  const expiryBody = document.getElementById("dealer-expiry-rows");
  expiryBody.innerHTML = visibleExpiryRows.length ? visibleExpiryRows.map(function (item) {
    const days = daysUntil(item.expiry_date);
    const remaining = days < 0 ? Math.abs(days) + " gün geçti" : days + " gün kaldı";
    const statusLabelText = item.status === "expired" ? "SKT'si geçti" : "30 gün içinde";
    return '<tr><td>' + escapeHtml(item.dealer_name) + '</td><td class="product-cell"><strong>' + escapeHtml(item.product_name) + "</strong></td><td>" + escapeHtml(item.batch_code) +
      "</td><td>" + formatDate(item.expiry_date) + '</td><td><span class="badge ' + item.status + '">' + remaining + '</span></td><td class="qty">' + item.quantity_on_hand.toLocaleString("tr-TR") +
      " " + escapeHtml(item.unit) + '</td><td><span class="badge ' + item.status + '">' + statusLabelText + "</span></td></tr>";
  }).join("") : '<tr><td class="empty" colspan="7">' + (selectedDealer ? "Bu bayide önümüzdeki 30 günde SKT’si yaklaşan ya da geçmiş lot yok." : "Önümüzdeki 30 günde SKT’si yaklaşan ya da geçmiş lot yok.") + "</td></tr>";
}
const DEALER_INSIGHTS = {
  dealers: {
    title: "Erişilebilen bayi ve depolar",
    description: "Hesabınızın görüntüleme yetkisi olan bayi ve depolar; ürün çeşidi, toplam stok ve SKT uyarılarıyla listelenir.",
    color: "blue",
    countLabel: "Bayi / depo"
  },
  stock: {
    title: "Bayi bazında toplam stok",
    description: "Erişilebilir tüm bayilerdeki ürün stokları. Her satır, bir bayide bulunan bir ürünün toplam miktarını gösterir.",
    color: "green",
    countLabel: "Toplam birim"
  },
  near: {
    title: "Yaklaşan SKT'li bayi lotları",
    description: "Erişilebilir bayilerde miktarı bulunan ve son kullanma tarihi önümüzdeki 30 gün içinde olan lotlar.",
    color: "amber",
    countLabel: "Lot kaydı"
  },
  expired: {
    title: "SKT'si geçmiş bayi lotları",
    description: "Erişilebilir bayilerde miktarı bulunan ve son kullanma tarihi geçmiş lotlar.",
    color: "red",
    countLabel: "Lot kaydı"
  }
};
function renderDealerInsight() {
  if (!activeDealerInsight) return;
  const insight = DEALER_INSIGHTS[activeDealerInsight];
  if (!insight) return;
  const summaries = dealerOverview.dealers || [];
  const stocks = dealerOverview.stocks || [];
  const expiring = dealerOverview.expiring || [];
  let rows;
  let count;
  if (activeDealerInsight === "dealers") {
    rows = summaries;
    count = summaries.length;
  } else if (activeDealerInsight === "stock") {
    rows = stocks;
    count = summaries.reduce(function (sum, dealer) { return sum + Number(dealer.total_units || 0); }, 0);
  } else {
    rows = expiring.filter(function (item) { return item.status === activeDealerInsight; });
    count = rows.length;
  }
  const query = document.getElementById("dealer-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = rows.filter(function (item) {
    const searchable = activeDealerInsight === "dealers"
      ? [item.name].join(" ")
      : activeDealerInsight === "stock"
        ? [item.dealer_name, item.product_name, item.sku].join(" ")
        : [item.dealer_name, item.product_name, item.sku, item.batch_code].join(" ");
    return searchable.toLocaleLowerCase("tr-TR").includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / DEALER_INSIGHT_PAGE_SIZE));
  dealerInsightPage = Math.min(dealerInsightPage, totalPages);
  const pageRows = filtered.slice((dealerInsightPage - 1) * DEALER_INSIGHT_PAGE_SIZE, dealerInsightPage * DEALER_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-dealer-insight="' + activeDealerInsight + '"] .metric-icon');
  const icon = document.getElementById("dealer-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.replaceChildren();
  if (iconSource) icon.appendChild(iconSource.querySelector("svg").cloneNode(true));
  document.getElementById("dealer-insight-title").textContent = insight.title;
  document.getElementById("dealer-insight-description").textContent = insight.description;
  document.getElementById("dealer-insight-count").textContent = count.toLocaleString("tr-TR");
  document.getElementById("dealer-insight-count-label").textContent = insight.countLabel;
  document.getElementById("dealer-insight-list-title").textContent = insight.title;
  document.getElementById("dealer-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + rows.length.toLocaleString("tr-TR") + " kayıt" :
      rows.length.toLocaleString("tr-TR") + (activeDealerInsight === "dealers" ? " bayi / depo" : " kayıt");
  const list = document.getElementById("dealer-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (rows.length ? "Aramanızla eşleşen kayıt bulunamadı." : "Bu durumda listelenecek kayıt bulunmuyor.") + "</p>";
  } else {
    list.innerHTML = pageRows.map(function (item) {
      if (activeDealerInsight === "dealers") {
        return '<article class="product-insight-item dealer-insight-item" role="listitem">' +
          '<div class="product-insight-item-copy"><strong>' + escapeHtml(item.name) + '</strong><small>' +
          Number(item.products_in_stock || 0).toLocaleString("tr-TR") + " ürün çeşidi · " +
          Number(item.near_expiry_batches || 0).toLocaleString("tr-TR") + " yaklaşan SKT · " +
          Number(item.expired_batches || 0).toLocaleString("tr-TR") + " geçmiş SKT</small></div>" +
          '<span class="badge ' + (Number(item.expired_batches || 0) ? "expired" : "ok") + '">' +
          (Number(item.expired_batches || 0) ? "SKT kontrolü" : "Bayi erişimi") + '</span>' +
          '<div class="product-insight-quantity"><span>Toplam stok</span><strong>' +
          Number(item.total_units || 0).toLocaleString("tr-TR") + " birim</strong></div></article>";
      }
      if (activeDealerInsight === "stock") {
        return '<article class="product-insight-item dealer-insight-item" role="listitem">' +
          '<div class="product-insight-item-copy"><strong>' + escapeHtml(item.product_name) + '</strong><small>' +
          escapeHtml(item.sku || "Stok kodu yok") + " · " + escapeHtml(item.dealer_name) + '</small></div>' +
          '<span class="badge ok">Stokta</span>' +
          '<div class="product-insight-quantity"><span>Mevcut stok</span><strong>' +
          Number(item.quantity || 0).toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong></div></article>";
      }
      const days = daysUntil(item.expiry_date);
      const remaining = days < 0 ? Math.abs(days).toLocaleString("tr-TR") + " gün geçti" :
        days === 0 ? "Bugün" : days.toLocaleString("tr-TR") + " gün kaldı";
      return '<article class="product-insight-item dealer-insight-item" role="listitem">' +
        '<div class="product-insight-item-copy"><strong>' + escapeHtml(item.product_name) + '</strong><small>' +
        escapeHtml(item.dealer_name) + " · Lot " + escapeHtml(item.batch_code || "—") + '</small><small>' +
        "SKT " + formatDate(item.expiry_date) + '</small></div>' +
        '<span class="badge ' + (activeDealerInsight === "expired" ? "expired" : "near") + '">' +
        (activeDealerInsight === "expired" ? "SKT'si geçti" : "Yaklaşıyor") + '</span>' +
        '<div class="product-insight-quantity"><span>' + remaining + '</span><strong>' +
        Number(item.quantity_on_hand || 0).toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("dealer-insight-pagination");
  pagination.hidden = filtered.length <= DEALER_INSIGHT_PAGE_SIZE;
  document.getElementById("dealer-insight-page-label").textContent =
    dealerInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " kayıt";
  document.getElementById("dealer-insight-previous").disabled = dealerInsightPage <= 1;
  document.getElementById("dealer-insight-next").disabled = dealerInsightPage >= totalPages;
}

function stockRequestStatus(status) {
  return {
    pending: ["Bekliyor", "near"],
    fulfilled: ["Karşılandı", "ok"],
    partially_fulfilled: ["Kısmen karşılandı", "mid"],
    rejected: ["Reddedildi", "out"]
  }[status] || ["Bilinmiyor", "mid"];
}
function renderStockRequests() {
  const isAdmin = currentUser && currentUser.role === "admin";
  const pending = stockRequests.filter(function (item) { return item.status === "pending"; }).length;
  const fulfilled = stockRequests.filter(function (item) { return ["fulfilled", "partially_fulfilled"].includes(item.status); }).length;
  const rejected = stockRequests.filter(function (item) { return item.status === "rejected"; }).length;
  document.getElementById("request-pending-count").textContent = pending.toLocaleString("tr-TR");
  document.getElementById("request-fulfilled-count").textContent = fulfilled.toLocaleString("tr-TR");
  document.getElementById("request-rejected-count").textContent = rejected.toLocaleString("tr-TR");
  document.getElementById("stock-request-list-title").textContent = isAdmin ? "Bayi talepleri" : "Taleplerim";
  document.getElementById("stock-request-list-description").textContent = isAdmin
    ? "İhtiyaçları uygun kaynaktan karşılayın veya gerekçeyle reddedin."
    : "Talep durumu ve karşılanan miktar burada görünür.";
  const ownDealer = dealers.find(function (dealer) { return currentUser && String(dealer.id) === String(currentUser.dealer_id); });
  document.getElementById("request-own-dealer").hidden = isAdmin;
  document.getElementById("request-own-dealer").textContent = ownDealer
    ? "Talep bayisi: " + ownDealer.name
    : "Hesabınıza bağlı bayi bulunamadı.";
  document.getElementById("request-help-text").textContent = isAdmin
    ? "Kaynak bayi önerisini kullanılabilir stok miktarına göre yaptık; transfer miktarını siz belirleyin."
    : "Kaynak bayiyi yönetici belirler. Diğer bayilerin stok bilgileri hesabınıza gösterilmez.";
  const target = document.getElementById("stock-request-list");
  if (!stockRequests.length) {
    target.innerHTML = '<div class="empty">' + (isAdmin ? "Henüz stok talebi yok." : "Henüz stok talebi oluşturmadınız.") + "</div>";
    renderRequestInsight();
    return;
  }
  target.innerHTML = stockRequests.map(function (item) {
    const status = stockRequestStatus(item.status);
    const sources = item.sources || [];
    const recommended = sources.find(function (source) { return String(source.dealer_id) === String(item.recommended_source_id); }) || sources[0];
    const sourceOptions = sources.map(function (source) {
      return '<option value="' + source.dealer_id + '" data-available="' + source.available_quantity + '" ' + (recommended && source.dealer_id === recommended.dealer_id ? "selected" : "") + '>' + escapeHtml(source.dealer_name) + " · " + source.available_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</option>";
    }).join("");
    let actionArea = "";
    if (isAdmin && item.status === "pending") {
      const initialQuantity = recommended ? Math.min(item.requested_quantity, recommended.available_quantity) : 0;
      actionArea = '<div class="request-admin-area">' +
        (recommended ? '<p class="request-recommendation">Önerilen kaynak: <strong>' + escapeHtml(recommended.dealer_name) + "</strong> · " + recommended.available_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + " kullanılabilir</p>" : '<p class="request-recommendation request-no-source">Bu ürün için başka bayilerde kullanılabilir stok yok.</p>') +
        '<div class="request-admin-controls"><label>Kaynak bayi<select data-request-source ' + (sources.length ? "required" : "disabled") + '><option value="">Kaynak bayi seçin</option>' + sourceOptions + '</select></label>' +
        '<label>Transfer miktarı<input data-request-quantity type="number" min="1" max="' + Math.min(item.requested_quantity, recommended ? recommended.available_quantity : item.requested_quantity) + '" value="' + initialQuantity + '" ' + (sources.length ? "required" : "disabled") + '></label></div>' +
        '<label class="request-resolution-label">Yönetici notu <span class="optional-label">(isteğe bağlı)</span><input data-request-note maxlength="240" placeholder="Kısaca açıklayın"></label>' +
        '<div class="request-admin-buttons"><button class="button button-primary" type="button" data-request-action="fulfill" data-request-id="' + item.id + '" ' + (sources.length ? "" : "disabled") + '>Onayla ve transfer et</button><button class="button button-quiet request-reject-button" type="button" data-request-action="reject" data-request-id="' + item.id + '">Reddet</button></div></div>';
    }
    let resultLine = "";
    if (item.status === "fulfilled" || item.status === "partially_fulfilled") {
      resultLine = '<p class="request-result">Karşılanan: <strong>' + item.fulfilled_quantity.toLocaleString("tr-TR") + " / " + item.requested_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong></p>";
      if (isAdmin && item.source_dealer_name) resultLine += '<p class="request-result">Kaynak: <strong>' + escapeHtml(item.source_dealer_name) + "</strong></p>";
    }
    if (item.status === "rejected" && isAdmin && item.resolution_note) {
      resultLine = '<p class="request-result">Yönetici notu: ' + escapeHtml(item.resolution_note) + "</p>";
    }
    return '<article class="request-card" data-request-card="' + item.id + '" data-request-limit="' + item.requested_quantity + '"><div class="request-card-top"><div><h4>' + escapeHtml(item.product_name) + '</h4><span class="request-sku">' + escapeHtml(item.sku) + '</span></div><span class="badge ' + status[1] + '">' + status[0] + '</span></div>' +
      '<div class="request-meta"><span>' + (isAdmin ? "Talep eden bayi: <strong>" + escapeHtml(item.dealer_name) + "</strong>" : "Talep miktarı: <strong>" + item.requested_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong>") + '</span>' +
      (isAdmin ? '<span>İsteyen: <strong>' + escapeHtml(item.requested_by) + '</strong></span>' : "") +
      '<span>Tarih: <strong>' + formatDateTime(item.created_at) + '</strong></span>' +
      (isAdmin ? '<span>İstenen: <strong>' + item.requested_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + '</strong></span>' : "") +
      (item.fulfilled_quantity ? '<span>Karşılanan: <strong>' + item.fulfilled_quantity.toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + '</strong></span>' : "") + '</div>' +
      (item.note ? '<p class="request-note">' + escapeHtml(item.note) + '</p>' : "") + resultLine + actionArea + '</article>';
  }).join("");
  renderRequestInsight();
}
const REQUEST_INSIGHTS = {
  pending: {
    title: "Bekleyen stok talepleri",
    description: "Yönetici incelemesi ve sonuçlandırması beklenen ürün talepleri.",
    color: "amber",
    empty: "Bekleyen stok talebi yok."
  },
  fulfilled: {
    title: "Karşılanan stok talepleri",
    description: "Tamamen veya kısmen karşılanmış ürün talepleri. Karşılanan miktar ve kaynak bilgisi kayıtlıysa burada gösterilir.",
    color: "green",
    empty: "Karşılanan stok talebi yok."
  },
  rejected: {
    title: "Reddedilen stok talepleri",
    description: "Sonuçlandırılarak reddedilmiş ürün talepleri ve varsa yönetici açıklamaları.",
    color: "red",
    empty: "Reddedilen stok talebi yok."
  }
};
function renderRequestInsight() {
  if (!activeRequestInsight) return;
  const insight = REQUEST_INSIGHTS[activeRequestInsight];
  if (!insight) return;
  const matchingRequests = stockRequests.filter(function (item) {
    if (activeRequestInsight === "pending") return item.status === "pending";
    if (activeRequestInsight === "fulfilled") return ["fulfilled", "partially_fulfilled"].includes(item.status);
    return item.status === "rejected";
  });
  const isAdmin = currentUser && currentUser.role === "admin";
  const query = document.getElementById("request-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = matchingRequests.filter(function (item) {
    const searchable = [item.product_name, item.sku, item.dealer_name, item.requested_by, item.note, item.resolution_note, item.source_dealer_name].join(" ");
    return searchable.toLocaleLowerCase("tr-TR").includes(query);
  }).sort(function (a, b) {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / REQUEST_INSIGHT_PAGE_SIZE));
  requestInsightPage = Math.min(requestInsightPage, totalPages);
  const pageRequests = filtered.slice((requestInsightPage - 1) * REQUEST_INSIGHT_PAGE_SIZE, requestInsightPage * REQUEST_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-request-insight="' + activeRequestInsight + '"] .metric-icon');
  const icon = document.getElementById("request-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.replaceChildren();
  if (iconSource) icon.appendChild(iconSource.querySelector("svg").cloneNode(true));
  document.getElementById("request-insight-title").textContent = insight.title;
  document.getElementById("request-insight-description").textContent = insight.description;
  document.getElementById("request-insight-count").textContent = matchingRequests.length.toLocaleString("tr-TR");
  document.getElementById("request-insight-list-title").textContent = insight.title;
  document.getElementById("request-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + matchingRequests.length.toLocaleString("tr-TR") + " talep" :
      matchingRequests.length.toLocaleString("tr-TR") + " talep";
  const list = document.getElementById("request-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (matchingRequests.length ? "Aramanızla eşleşen talep bulunamadı." : insight.empty) + "</p>";
  } else {
    list.innerHTML = pageRequests.map(function (item) {
      const status = stockRequestStatus(item.status);
      let details = '<span>İstenen: <strong>' + Number(item.requested_quantity || 0).toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong></span>";
      if (activeRequestInsight === "fulfilled") {
        details += '<span>Karşılanan: <strong>' + Number(item.fulfilled_quantity || 0).toLocaleString("tr-TR") + " / " +
          Number(item.requested_quantity || 0).toLocaleString("tr-TR") + " " + escapeHtml(item.unit) + "</strong></span>";
        if (item.source_dealer_name) details += '<span>Kaynak: <strong>' + escapeHtml(item.source_dealer_name) + "</strong></span>";
      }
      if (activeRequestInsight === "rejected" && isAdmin && item.resolution_note) {
        details += '<span>Yönetici notu: <strong>' + escapeHtml(item.resolution_note) + "</strong></span>";
      }
      if (item.note) details += '<span>Açıklama: <strong>' + escapeHtml(item.note) + "</strong></span>";
      const requester = isAdmin
        ? '<span>Talep eden: <strong>' + escapeHtml(item.dealer_name) + (item.requested_by ? " · " + escapeHtml(item.requested_by) : "") + "</strong></span>"
        : "";
      return '<article class="request-card request-insight-card" role="listitem"><div class="request-card-top"><div><h4>' +
        escapeHtml(item.product_name) + '</h4><span class="request-sku">' + escapeHtml(item.sku || "Stok kodu yok") +
        '</span></div><span class="badge ' + status[1] + '">' + status[0] + '</span></div><div class="request-meta">' +
        requester + details + '<span>Tarih: <strong>' + formatDateTime(item.created_at) + "</strong></span></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("request-insight-pagination");
  pagination.hidden = filtered.length <= REQUEST_INSIGHT_PAGE_SIZE;
  document.getElementById("request-insight-page-label").textContent =
    requestInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " talep";
  document.getElementById("request-insight-previous").disabled = requestInsightPage <= 1;
  document.getElementById("request-insight-next").disabled = requestInsightPage >= totalPages;
}
async function loadStockRequests() {
  if (!currentUser) return;
  stockRequests = await api("/api/stock-requests");
  renderStockRequests();
}
function renderMovements() {
  const query = document.getElementById("movement-search").value.trim().toLocaleLowerCase("tr-TR");
  const type = document.getElementById("movement-type-filter").value;
  const from = document.getElementById("movement-from").value, to = document.getElementById("movement-to").value;
  const filtered = movements.filter(function (movement) {
    const searchable = [movement.dealer_name, movement.product_name, movement.batch_code, movement.note, movement.performed_by].join(" ").toLocaleLowerCase("tr-TR");
    const date = localDateKey(new Date(movement.created_at));
    return searchable.includes(query) && (type === "all" || movement.movement_type === type) && (!from || date >= from) && (!to || date <= to);
  });
  const body = document.getElementById("movement-rows");
  if (!filtered.length) {
    body.innerHTML = '<tr><td class="empty" colspan="8">' + (movements.length ? "Filtrelerle eşleşen hareket bulunamadı." : "Henüz stok hareketi yok.") + "</td></tr>";
    return;
  }
  body.innerHTML = filtered.map(function (movement) {
    const incoming = movement.movement_type === "IN";
    const movementLabel = movement.is_adjustment ? (incoming ? "Düzeltme +" : "Düzeltme −") : (incoming ? "↓ Giriş" : "↑ Çıkış");
    return "<tr><td>" + formatDateTime(movement.created_at) + "</td><td>" + escapeHtml(movement.dealer_name || "Merkez Depo") + "</td>" +
      '<td><span class="badge ' + (movement.is_adjustment ? "near" : (incoming ? "ok" : "out")) + '">' + movementLabel + "</span></td>" +
      '<td class="product-cell"><strong>' + escapeHtml(movement.product_name) + "</strong></td><td>" + escapeHtml(movement.batch_code) + "</td>" +
      '<td class="qty ' + (incoming ? "positive" : "negative") + '">' + (incoming ? "+" : "−") + movement.quantity.toLocaleString("tr-TR") + "</td>" +
      "<td>" + escapeHtml(movement.note || "—") + "</td><td>" + escapeHtml(movement.performed_by || "Önceki kayıt") +
      (movement.performed_by_role ? " · " + (movement.performed_by_role === "admin" ? "Yönetici" : "Kullanıcı") : "") + "</td></tr>";
  }).join("");
}
const MOVEMENT_INSIGHTS = {
  inbound: {
    title: "Stok girişleri",
    description: "Yüklenen son stok giriş hareketleri ve giriş türündeki sayım düzeltmeleri. Miktarlar hareket kayıtlarındaki değerlerin toplamıdır.",
    color: "green",
    quantityLabel: "Toplam giriş miktarı"
  },
  outbound: {
    title: "Stok çıkışları",
    description: "Yüklenen son stok çıkış hareketleri ve çıkış türündeki sayım düzeltmeleri. Miktarlar hareket kayıtlarındaki değerlerin toplamıdır.",
    color: "red",
    quantityLabel: "Toplam çıkış miktarı"
  },
  all: {
    title: "Tüm hareket kayıtları",
    description: "Uygulamada yüklenmiş en son stok giriş, çıkış ve sayım düzeltmesi kayıtları. Miktarlar hareket türüne göre işaretli gösterilir.",
    color: "blue",
    quantityLabel: "Toplam hareket miktarı"
  }
};
function renderMovementInsight() {
  if (!activeMovementInsight) return;
  const insight = MOVEMENT_INSIGHTS[activeMovementInsight];
  if (!insight) return;
  const filteredByType = movements.filter(function (movement) {
    return activeMovementInsight === "all" ||
      (activeMovementInsight === "inbound" && movement.movement_type === "IN") ||
      (activeMovementInsight === "outbound" && movement.movement_type === "OUT");
  });
  const query = document.getElementById("movement-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = filteredByType.filter(function (movement) {
    return [
      movement.dealer_name, movement.product_name, movement.batch_code, movement.note,
      movement.performed_by, movement.performed_by_role, movement.is_adjustment ? "düzeltme sayım" : ""
    ].join(" ").toLocaleLowerCase("tr-TR").includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / MOVEMENT_INSIGHT_PAGE_SIZE));
  movementInsightPage = Math.min(movementInsightPage, totalPages);
  const pageMovements = filtered.slice((movementInsightPage - 1) * MOVEMENT_INSIGHT_PAGE_SIZE, movementInsightPage * MOVEMENT_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-movement-insight="' + activeMovementInsight + '"] .metric-icon');
  const icon = document.getElementById("movement-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.textContent = iconSource ? iconSource.textContent.trim() : "";
  document.getElementById("movement-insight-title").textContent = insight.title;
  document.getElementById("movement-insight-description").textContent = insight.description;
  const totalQuantity = filteredByType.reduce(function (sum, movement) {
    return sum + Number(movement.quantity || 0);
  }, 0);
  document.getElementById("movement-insight-quantity").textContent = totalQuantity.toLocaleString("tr-TR");
  document.getElementById("movement-insight-quantity-label").textContent = insight.quantityLabel;
  document.getElementById("movement-insight-list-title").textContent = insight.title + " listesi";
  document.getElementById("movement-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + filteredByType.length.toLocaleString("tr-TR") + " kayıt" :
      filteredByType.length.toLocaleString("tr-TR") + " kayıt";
  const list = document.getElementById("movement-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (filteredByType.length ? "Aramanızla eşleşen hareket bulunamadı." : "Bu türde listelenecek hareket kaydı bulunmuyor.") + "</p>";
  } else {
    list.innerHTML = pageMovements.map(function (movement) {
      const incoming = movement.movement_type === "IN";
      const label = movement.is_adjustment ? (incoming ? "Düzeltme +" : "Düzeltme −") : (incoming ? "Stok girişi" : "Stok çıkışı");
      const badgeClass = movement.is_adjustment ? "near" : (incoming ? "ok" : "out");
      const product = productCatalog.find(function (item) { return String(item.id) === String(movement.product_id); });
      const unit = product ? product.unit : "birim";
      const quantity = Number(movement.quantity || 0);
      return '<article class="product-insight-item movement-insight-item" role="listitem">' +
        '<div class="product-insight-item-copy"><strong>' + escapeHtml(movement.product_name || "Ürün") + '</strong><small>' +
        "Lot " + escapeHtml(movement.batch_code || "—") + " · " + escapeHtml(movement.dealer_name || "Merkez Depo") + '</small><small>' +
        formatDateTime(movement.created_at) + " · " + escapeHtml(movement.performed_by || "Önceki kayıt") +
        (movement.note ? " · " + escapeHtml(movement.note) : "") + '</small></div>' +
        '<span class="badge ' + badgeClass + '">' + label + '</span>' +
        '<div class="product-insight-quantity ' + (incoming ? "positive" : "negative") + '"><span>Hareket miktarı</span><strong>' +
        (incoming ? "+" : "−") + quantity.toLocaleString("tr-TR") + " " + escapeHtml(unit) + "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("movement-insight-pagination");
  pagination.hidden = filtered.length <= MOVEMENT_INSIGHT_PAGE_SIZE;
  document.getElementById("movement-insight-page-label").textContent =
    movementInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " kayıt";
  document.getElementById("movement-insight-previous").disabled = movementInsightPage <= 1;
  document.getElementById("movement-insight-next").disabled = movementInsightPage >= totalPages;
}
function renderCategories() {
  const query = document.getElementById("category-search").value.trim().toLocaleLowerCase("tr-TR");
  const visible = categories.filter(function (category) { return category.name.toLocaleLowerCase("tr-TR").includes(query); });
  const body = document.getElementById("category-rows");
  body.innerHTML = visible.length ? visible.map(function (category) {
    const items = productCatalog.filter(function (product) { return product.category_id === category.id; });
    const total = items.reduce(function (sum, product) { return sum + product.total_quantity; }, 0);
    return '<tr><td class="product-cell"><strong>' + escapeHtml(category.name) + "</strong></td><td>" + items.length + '</td><td class="qty">' + total.toLocaleString("tr-TR") + "</td></tr>";
  }).join("") : '<tr><td class="empty" colspan="3">Kategori bulunamadı.</td></tr>';
  const categorized = productCatalog.filter(function (product) { return product.category_id != null; }).length;
  document.getElementById("category-count").textContent = categories.length;
  document.getElementById("categorized-count").textContent = categorized;
  document.getElementById("uncategorized-count").textContent = productCatalog.length - categorized;
  renderCategoryInsight();
}
const CATEGORY_INSIGHTS = {
  categories: {
    title: "Tüm kategoriler",
    description: "Kayıtlı kategoriler, her birine bağlı ürün sayısı ve toplam stok miktarı.",
    color: "blue",
    countLabel: "Kategori",
    listTitle: "Kategori listesi",
    empty: "Henüz kayıtlı kategori yok."
  },
  categorized: {
    title: "Kategorili ürünler",
    description: "Bir kategoriye bağlı ürünler; kategori adı, stok kodu ve mevcut miktarlarıyla listelenir.",
    color: "green",
    countLabel: "Ürün",
    listTitle: "Kategorili ürün listesi",
    empty: "Kategoriye bağlı ürün yok."
  },
  uncategorized: {
    title: "Kategorisiz ürünler",
    description: "Henüz kategori atanmamış ürünler. Ürünleri düzenlemek için kategori belirleyebilirsiniz.",
    color: "amber",
    countLabel: "Ürün",
    listTitle: "Kategorisiz ürün listesi",
    empty: "Kategorisiz ürün yok."
  }
};
function renderCategoryInsight() {
  if (!activeCategoryInsight) return;
  const insight = CATEGORY_INSIGHTS[activeCategoryInsight];
  if (!insight) return;
  const categoryEntries = categories.map(function (category) {
    const items = productCatalog.filter(function (product) {
      return String(product.category_id) === String(category.id);
    });
    return {category: category, products: items};
  });
  const products = productCatalog.filter(function (product) {
    return activeCategoryInsight === "categorized" ? product.category_id != null : product.category_id == null;
  });
  const entries = activeCategoryInsight === "categories" ? categoryEntries : products;
  const query = document.getElementById("category-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = entries.filter(function (entry) {
    if (activeCategoryInsight === "categories") {
      return [entry.category.name].concat(entry.products.map(function (product) {
        return [product.name, product.sku, product.barcode].join(" ");
      })).join(" ").toLocaleLowerCase("tr-TR").includes(query);
    }
    const category = categories.find(function (item) { return String(item.id) === String(entry.category_id); });
    return [entry.name, entry.sku, entry.barcode, entry.category_name || (category && category.name)]
      .join(" ").toLocaleLowerCase("tr-TR").includes(query);
  }).sort(function (a, b) {
    const left = activeCategoryInsight === "categories" ? a.category.name : a.name;
    const right = activeCategoryInsight === "categories" ? b.category.name : b.name;
    return String(left || "").localeCompare(String(right || ""), "tr", {sensitivity: "base", numeric: true});
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / CATEGORY_INSIGHT_PAGE_SIZE));
  categoryInsightPage = Math.min(categoryInsightPage, totalPages);
  const pageEntries = filtered.slice((categoryInsightPage - 1) * CATEGORY_INSIGHT_PAGE_SIZE, categoryInsightPage * CATEGORY_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-category-insight="' + activeCategoryInsight + '"] .metric-icon');
  const icon = document.getElementById("category-insight-icon");
  icon.className = "metric-icon product-insight-icon " + insight.color;
  icon.replaceChildren();
  if (iconSource) icon.appendChild(iconSource.querySelector("svg").cloneNode(true));
  document.getElementById("category-insight-title").textContent = insight.title;
  document.getElementById("category-insight-description").textContent = insight.description;
  document.getElementById("category-insight-count").textContent = entries.length.toLocaleString("tr-TR");
  document.getElementById("category-insight-count-label").textContent = insight.countLabel;
  document.getElementById("category-insight-list-title").textContent = insight.listTitle;
  document.getElementById("category-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + entries.length.toLocaleString("tr-TR") + " kayıt" :
      entries.length.toLocaleString("tr-TR") + (activeCategoryInsight === "categories" ? " kategori" : " ürün");
  const list = document.getElementById("category-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (entries.length ? "Aramanızla eşleşen kayıt bulunamadı." : insight.empty) + "</p>";
  } else {
    list.innerHTML = pageEntries.map(function (entry) {
      if (activeCategoryInsight === "categories") {
        const category = entry.category;
        const totalStock = entry.products.reduce(function (sum, product) {
          return sum + Number(product.total_quantity || 0);
        }, 0);
        return '<article class="product-insight-item category-insight-item" role="listitem"><div class="product-insight-item-copy"><strong>' +
          escapeHtml(category.name) + '</strong><small>' + entry.products.length.toLocaleString("tr-TR") +
          ' bağlı ürün</small></div><span class="badge ok">Kategori</span><div class="product-insight-quantity"><span>Toplam stok</span><strong>' +
          totalStock.toLocaleString("tr-TR") + " birim</strong></div></article>";
      }
      const category = categories.find(function (item) { return String(item.id) === String(entry.category_id); });
      const categoryName = entry.category_name || (category && category.name) || "Kategori adı yok";
      return '<article class="product-insight-item category-insight-item" role="listitem"><div class="product-insight-item-copy"><strong>' +
        escapeHtml(entry.name) + '</strong><small>' + escapeHtml(entry.sku || "Stok kodu yok") + " · " +
        escapeHtml(categoryName) + '</small></div><span class="badge ' +
        (activeCategoryInsight === "categorized" ? "ok" : "near") + '">' +
        (activeCategoryInsight === "categorized" ? "Kategorili" : "Kategorisiz") +
        '</span><div class="product-insight-quantity"><span>Mevcut stok</span><strong>' +
        Number(entry.total_quantity || 0).toLocaleString("tr-TR") + " " + escapeHtml(entry.unit) +
        "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("category-insight-pagination");
  pagination.hidden = filtered.length <= CATEGORY_INSIGHT_PAGE_SIZE;
  document.getElementById("category-insight-page-label").textContent =
    categoryInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " kayıt";
  document.getElementById("category-insight-previous").disabled = categoryInsightPage <= 1;
  document.getElementById("category-insight-next").disabled = categoryInsightPage >= totalPages;
}
async function loadUsers() {
  if (!currentUser || currentUser.role !== "admin") return;
  users = await api("/api/users");
  const active = users.filter(function (user) { return user.is_active; }).length;
  document.getElementById("user-total-count").textContent = users.length;
  document.getElementById("user-admin-count").textContent = users.filter(function (user) { return user.role === "admin"; }).length;
  document.getElementById("user-active-count").textContent = active;
  renderUserInsight();
  const body = document.getElementById("user-rows");
  body.innerHTML = users.length ? users.map(function (user) {
    const status = user.is_active ? "Aktif" : "Kapalı";
    const roleName = user.role === "admin" ? "Yönetici" : "Kullanıcı";
    const dealer = dealers.find(function (item) { return String(item.id) === String(user.dealer_id); });
    const dealerName = dealer ? dealer.name : "Genel erişim";
    const isSelf = currentUser.id === user.id;
    const action = isSelf ? "Bu hesap" : '<button class="user-action-button ' + (user.is_active ? "danger" : "") + '" type="button" data-user-toggle="' + user.id + '" data-next-active="' + (!user.is_active) + '">' + (user.is_active ? "Erişimi kapat" : "Etkinleştir") + "</button>";
    return '<tr><td class="product-cell"><strong>' + escapeHtml(user.full_name) + "</strong></td><td>" + escapeHtml(user.email) +
      '</td><td>' + roleName + "</td><td>" + escapeHtml(dealerName) + "</td><td>" + formatDate(user.created_at) +
      "</td><td>" + (user.last_login_at ? formatDateTime(user.last_login_at) : "Henüz giriş yapılmadı") +
      "</td><td>" + (user.last_logout_at ? formatDateTime(user.last_logout_at) : "Henüz çıkış yapılmadı") +
      '</td><td><span class="badge ' + (user.is_active ? "ok" : "expired") + '">' + status + "</span></td><td>" + action + "</td></tr>";
  }).join("") : '<tr><td class="empty" colspan="9">Henüz kullanıcı hesabı yok.</td></tr>';
}
const USER_INSIGHTS = {
  all: {
    title: "Tüm hesaplar",
    description: "Yönetici ve kullanıcı hesapları ile bayi erişimlerini görüntüleyin.",
    listTitle: "Tüm kullanıcı hesapları",
    empty: "Henüz kullanıcı hesabı yok."
  },
  admins: {
    title: "Yönetici hesapları",
    description: "Sistem yönetim yetkisi bulunan hesapları ve erişim durumlarını inceleyin.",
    listTitle: "Yönetici listesi",
    empty: "Yönetici hesabı bulunmuyor."
  },
  active: {
    title: "Aktif kullanıcılar",
    description: "Şu anda giriş yapma izni açık olan hesapları görüntüleyin.",
    listTitle: "Giriş yapabilen hesaplar",
    empty: "Aktif kullanıcı hesabı bulunmuyor."
  }
};
function renderUserInsight() {
  if (!activeUserInsight) return;
  const insight = USER_INSIGHTS[activeUserInsight];
  if (!insight) return;
  const entries = users.filter(function (user) {
    if (activeUserInsight === "admins") return user.role === "admin";
    if (activeUserInsight === "active") return user.is_active;
    return true;
  });
  const query = document.getElementById("user-insight-search").value.trim().toLocaleLowerCase("tr-TR");
  const filtered = entries.filter(function (user) {
    const dealer = dealers.find(function (item) { return String(item.id) === String(user.dealer_id); });
    const dealerName = dealer ? dealer.name : "Genel erişim";
    return [user.full_name, user.email, user.role === "admin" ? "Yönetici" : "Kullanıcı", dealerName]
      .join(" ").toLocaleLowerCase("tr-TR").includes(query);
  }).sort(function (a, b) {
    return String(a.full_name || "").localeCompare(String(b.full_name || ""), "tr", {sensitivity: "base"});
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / USER_INSIGHT_PAGE_SIZE));
  userInsightPage = Math.min(userInsightPage, totalPages);
  const pageEntries = filtered.slice((userInsightPage - 1) * USER_INSIGHT_PAGE_SIZE, userInsightPage * USER_INSIGHT_PAGE_SIZE);
  const iconSource = document.querySelector('[data-user-insight="' + activeUserInsight + '"] .metric-icon');
  const icon = document.getElementById("user-insight-icon");
  icon.className = "metric-icon product-insight-icon " +
    (activeUserInsight === "admins" ? "purple" : activeUserInsight === "active" ? "green" : "blue");
  icon.replaceChildren();
  if (iconSource) icon.appendChild(iconSource.querySelector("svg").cloneNode(true));
  document.getElementById("user-insight-title").textContent = insight.title;
  document.getElementById("user-insight-description").textContent = insight.description;
  document.getElementById("user-insight-count").textContent = entries.length.toLocaleString("tr-TR");
  document.getElementById("user-insight-count-label").textContent = "Hesap";
  document.getElementById("user-insight-list-title").textContent = insight.listTitle;
  document.getElementById("user-insight-list-summary").textContent =
    query ? filtered.length.toLocaleString("tr-TR") + " eşleşme · toplam " + entries.length.toLocaleString("tr-TR") + " hesap" :
      entries.length.toLocaleString("tr-TR") + " hesap";
  const list = document.getElementById("user-insight-list");
  if (!filtered.length) {
    list.innerHTML = '<p class="empty product-insight-empty">' +
      (entries.length ? "Aramanızla eşleşen hesap bulunamadı." : insight.empty) + "</p>";
  } else {
    list.innerHTML = pageEntries.map(function (user) {
      const dealer = dealers.find(function (item) { return String(item.id) === String(user.dealer_id); });
      const roleName = user.role === "admin" ? "Yönetici" : "Kullanıcı";
      return '<article class="product-insight-item user-insight-item" role="listitem"><div class="product-insight-item-copy"><strong>' +
        escapeHtml(user.full_name) + '</strong><small>' + escapeHtml(user.email) + " · " +
        escapeHtml(dealer ? dealer.name : "Genel erişim") + '</small><small>Son giriş: ' +
        (user.last_login_at ? formatDateTime(user.last_login_at) : "Henüz giriş yapılmadı") +
        ' · Son çıkış: ' + (user.last_logout_at ? formatDateTime(user.last_logout_at) : "Henüz çıkış yapılmadı") +
        '</small></div><span class="badge ' +
        (user.role === "admin" ? "mid" : "ok") + '">' + roleName + '</span><div class="product-insight-quantity"><span>Hesap durumu</span><strong class="' +
        (user.is_active ? "user-insight-active" : "user-insight-inactive") + '">' +
        (user.is_active ? "Aktif" : "Kapalı") + "</strong></div></article>";
    }).join("");
  }
  const pagination = document.getElementById("user-insight-pagination");
  pagination.hidden = filtered.length <= USER_INSIGHT_PAGE_SIZE;
  document.getElementById("user-insight-page-label").textContent =
    userInsightPage + " / " + totalPages + " · " + filtered.length.toLocaleString("tr-TR") + " hesap";
  document.getElementById("user-insight-previous").disabled = userInsightPage <= 1;
  document.getElementById("user-insight-next").disabled = userInsightPage >= totalPages;
}
function activityLabel(eventType) {
  return {
    LOGIN: "Giriş yaptı", LOGOUT: "Çıkış yaptı", PROFILE_UPDATE: "Profil güncellendi",
    PASSWORD_CHANGE: "Şifre değiştirildi", PRODUCT_CREATE: "Ürün oluşturuldu",
    PRODUCT_UPDATE: "Ürün güncellendi",
    CATEGORY_CREATE: "Kategori oluşturuldu", USER_CREATE: "Hesap oluşturuldu",
    USER_ACTIVATE: "Hesap etkinleştirildi", USER_DEACTIVATE: "Hesap kapatıldı",
    DEALER_CREATE: "Bayi oluşturuldu",
    STOCK_REQUEST_CREATE: "Stok talebi oluşturuldu", STOCK_REQUEST_FULFILL: "Stok talebi karşılandı",
    STOCK_REQUEST_REJECT: "Stok talebi reddedildi",
    BILLING_SUBSCRIPTION_CREATE: "Abonelik oluşturuldu", BILLING_PAYMENT_PAID: "Ödeme tahsil edildi",
    BILLING_PERIOD_CREATE: "Yeni ödeme dönemi oluşturuldu",
    STOCK_IN: "Stok girişi", STOCK_OUT: "Stok çıkışı", STOCK_ADJUSTMENT: "Stok düzeltmesi"
  }[eventType] || "İşlem";
}
function renderOwnActivities(activities) {
  const body = document.getElementById("own-activity-rows");
  body.innerHTML = activities.length ? activities.map(function (item) {
    return "<tr><td>" + formatDateTime(item.created_at) + "</td><td>" + activityLabel(item.event_type) + "</td><td>" + escapeHtml(item.description) + "</td></tr>";
  }).join("") : '<tr><td class="empty" colspan="3">Henüz kaydedilmiş işlem yok.</td></tr>';
}
async function loadProfile() {
  if (!currentUser) return;
  const results = await Promise.all([api("/api/profile"), api("/api/profile/activities")]);
  const profile = results[0];
  updateUserIdentity(profile);
  document.getElementById("profile-full-name").value = profile.full_name;
  document.getElementById("profile-email").value = profile.email;
  document.getElementById("profile-role").value = profile.role === "admin" ? "Yönetici" : "Kullanıcı";
  const profileDealer = dealers.find(function (item) { return String(item.id) === String(profile.dealer_id); });
  document.getElementById("profile-dealer").value = profileDealer ? profileDealer.name : "Genel erişim";
  document.getElementById("profile-created-at").value = formatDate(profile.created_at);
  renderOwnActivities(results[1]);
}
async function loadAdminActivities() {
  if (!currentUser || currentUser.role !== "admin") return;
  const activities = await api("/api/activities");
  function renderRoleActivities(role, targetId) {
    const rows = activities.filter(function (item) { return item.user_role === role; });
    const body = document.getElementById(targetId);
    const roleName = role === "admin" ? "Yönetici" : "Kullanıcı";
    body.innerHTML = rows.length ? rows.map(function (item) {
      return "<tr><td>" + formatDateTime(item.created_at) + "</td><td>" + escapeHtml(item.user_name || "Hesap bilgisi yok") + "</td><td>" + activityLabel(item.event_type) + "</td><td>" + escapeHtml(item.description) + "</td></tr>";
    }).join("") : '<tr><td class="empty" colspan="4">Henüz ' + roleName.toLocaleLowerCase("tr-TR") + ' işlemi yok.</td></tr>';
  }
  renderRoleActivities("user", "user-activity-rows");
  renderRoleActivities("admin", "admin-activity-rows");
}
function billingDealerId() {
  if (!currentUser) return null;
  if (currentUser.role === "admin") return document.getElementById("billing-dealer-select").value || null;
  return currentUser.dealer_id || null;
}
function billingPlan(code, months) {
  return billingData && billingData.plans.find(function (plan) { return plan.code === code && plan.term_months === months; });
}
function renderBillingPlans() {
  const target = document.getElementById("billing-plan-cards");
  const plans = (billingData && billingData.plans || []).filter(function (plan) { return plan.term_months === selectedBillingTerm; });
  if (!plans.some(function (plan) { return plan.code === selectedBillingPlan; }) && plans.length) selectedBillingPlan = plans[0].code;
  target.innerHTML = plans.map(function (plan) {
    return '<button class="billing-plan-card ' + (plan.code === selectedBillingPlan ? "selected" : "") + '" type="button" data-billing-plan="' + escapeHtml(plan.code) + '" aria-pressed="' + (plan.code === selectedBillingPlan) + '"><span class="eyebrow">SAVESTOCK PAKETİ</span><strong>' + escapeHtml(plan.name) + '</strong><small>' + escapeHtml(plan.description) + '</small><span class="billing-plan-price">' + formatCurrency(plan.total_amount) + '</span><small>' + selectedBillingTerm + (selectedBillingTerm === 1 ? " aylık" : " aylık dönem · KDV dâhil") + '</small></button>';
  }).join("");
  document.querySelectorAll("[data-billing-term]").forEach(function (button) {
    button.classList.toggle("active", Number(button.dataset.billingTerm) === selectedBillingTerm);
    button.setAttribute("aria-pressed", String(Number(button.dataset.billingTerm) === selectedBillingTerm));
  });
  updateBillingSummary();
}
function updateBillingSummary() {
  const plan = billingPlan(selectedBillingPlan, selectedBillingTerm);
  if (!plan) return;
  document.getElementById("billing-summary-plan").textContent = plan.name;
  document.getElementById("billing-summary-term").textContent = selectedBillingTerm === 12 ? "1 yıl" : selectedBillingTerm + " ay";
  document.getElementById("billing-summary-net").textContent = formatCurrency(plan.net_amount);
  document.getElementById("billing-summary-vat").textContent = formatCurrency(plan.vat_amount);
  document.getElementById("billing-summary-total").textContent = formatCurrency(plan.total_amount);
}
function renderBilling() {
  if (!billingData) return;
  document.getElementById("billing-store-name").textContent = billingData.dealer.name;
  const current = billingData.subscription;
  const badge = document.getElementById("billing-current-badge");
  if (!current) {
    document.getElementById("billing-current-copy").textContent = "Bu mağazada henüz aktif abonelik yok. Paket seçerek başlayabilirsiniz.";
    badge.className = "badge mid"; badge.textContent = "Abonelik yok";
  } else if (current.status === "expired") {
    document.getElementById("billing-current-copy").textContent = "Aboneliğiniz " + formatDate(current.expires_at) + " tarihinde sona erdi. Yenilemek için paket seçin.";
    badge.className = "badge expired"; badge.textContent = "Süresi doldu";
  } else if (current.status === "scheduled") {
    document.getElementById("billing-current-copy").textContent = "Yenileme " + formatDate(current.starts_at) + " tarihinde başlayacak; " + formatDate(current.expires_at) + " tarihinde sona erecek.";
    badge.className = "badge near"; badge.textContent = "Yenileme planlandı";
  } else {
    document.getElementById("billing-current-copy").textContent = "Aboneliğiniz " + formatDate(current.expires_at) + " tarihine kadar aktif. Şimdiden yenileyerek sürenizi uzatabilirsiniz.";
    badge.className = "badge ok"; badge.textContent = "Aktif";
  }
  const selector = document.getElementById("billing-dealer-select");
  if (currentUser && currentUser.role === "admin") {
    const prior = selector.value;
    selector.innerHTML = dealers.map(function (dealer) { return '<option value="' + dealer.id + '">' + escapeHtml(dealer.name) + '</option>'; }).join("");
    if (prior && dealers.some(function (dealer) { return String(dealer.id) === prior; })) selector.value = prior;
    else if (dealers.length) selector.value = String(dealers[0].id);
  }
  const pending = billingData.pending_order;
  document.getElementById("billing-pending-panel").hidden = !pending;
  document.getElementById("billing-resume-button").dataset.paymentId = pending ? pending.id : "";
  document.getElementById("billing-resume-button").textContent = pending
    ? "Ödemeye devam et · " + formatCurrency(pending.total_amount)
    : "Ödemeye devam et";
  const ready = Boolean(billingData.payment_ready);
  document.getElementById("billing-resume-button").disabled = !ready;
  const purchaseButton = document.getElementById("billing-purchase-button");
  purchaseButton.disabled = !ready || Boolean(pending);
  document.getElementById("billing-payment-note").textContent = ready
    ? (pending ? "Bekleyen ödeme tamamlandıktan sonra yeni bir paket seçebilirsiniz." : "Kart bilgileriniz SaveStock tarafından saklanmaz.")
    : "PayTR mağaza bilgileri ve herkese açık site adresi tanımlandıktan sonra satın alma açılır.";
  renderBillingPlans();
}
async function loadBilling() {
  if (!currentUser) return;
  let url = "/api/billing";
  if (currentUser.role === "admin") {
    const selector = document.getElementById("billing-dealer-select");
    if (!selector.options.length && dealers.length) selector.innerHTML = dealers.map(function (dealer) { return '<option value="' + dealer.id + '">' + escapeHtml(dealer.name) + '</option>'; }).join("");
    if (!selector.value && dealers.length) selector.value = String(dealers[0].id);
    if (selector.value) url += "?dealer_id=" + encodeURIComponent(selector.value);
  }
  billingData = await api(url);
  renderBilling();
}
async function openPaytrCheckout(paymentId, isResume) {
  const dealerId = billingDealerId();
  const suffix = dealerId ? "?dealer_id=" + encodeURIComponent(dealerId) : "";
  const result = isResume
    ? await api("/api/billing/purchases/" + paymentId + "/checkout" + suffix, {method: "POST", body: "{}"})
    : await api("/api/billing/purchases", {method: "POST", body: JSON.stringify({dealer_id: dealerId ? Number(dealerId) : null, plan_code: selectedBillingPlan, term_months: selectedBillingTerm})});
  if (!/^[A-Za-z0-9]+$/.test(result.iframe_token || "")) throw new Error("PayTR güvenli ödeme anahtarı geçersiz.");
  const panel = document.getElementById("billing-checkout-panel");
  const frame = document.getElementById("paytriframe");
  panel.hidden = false;
  frame.src = "https://www.paytr.com/odeme/guvenli/" + result.iframe_token;
  panel.scrollIntoView({behavior: "smooth", block: "start"});
  const resize = function () { if (window.iFrameResize) window.iFrameResize({}, "#paytriframe"); };
  if (window.iFrameResize) resize();
  else if (!document.getElementById("paytr-iframe-resizer")) {
    const script = document.createElement("script"); script.id = "paytr-iframe-resizer"; script.src = "https://www.paytr.com/js/iframeResizer.min.js";
    script.onload = resize; document.head.appendChild(script);
  } else setTimeout(resize, 300);
}
function drawMovementChart(targetId, dataSet) {
  const target = document.getElementById(targetId), now = new Date(), months = [];
  if (!dataSet.length) {
    target.innerHTML = '<div class="empty chart-empty">Stok hareketi oluştuğunda aylık giriş ve çıkış özeti burada görüntülenir.</div>';
    target.setAttribute("role", "status");
    target.removeAttribute("aria-label");
    return;
  }
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), label: new Intl.DateTimeFormat("tr-TR", {month: "short"}).format(date), input: 0, output: 0});
  }
  dataSet.forEach(function (movement) {
    const date = new Date(movement.created_at), key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    const month = months.find(function (item) { return item.key === key; });
    if (month) month[movement.movement_type === "IN" ? "input" : "output"] += movement.quantity;
  });
  const maximum = Math.max(1, ...months.map(function (item) { return Math.max(item.input, item.output); }));
  target.innerHTML = '<div class="chart-bars">' + months.map(function (month) {
    const inside = Math.max(month.input ? 5 : 0, Math.round(month.input / maximum * 100));
    const outside = Math.max(month.output ? 5 : 0, Math.round(month.output / maximum * 100));
    return '<div class="chart-month"><div class="bar-pair"><i class="bar-in" style="height:' + inside + '%" title="Giriş: ' + month.input + '"></i><i class="bar-out" style="height:' + outside + '%" title="Çıkış: ' + month.output + '"></i></div><small>' + escapeHtml(month.label) + "</small></div>";
  }).join("") + "</div>";
  target.setAttribute("role", "img");
  target.setAttribute("aria-label", "Son altı ayın stok hareketleri: " + months.map(function (month) {
    return month.label + " stok girişi " + month.input + ", stok çıkışı " + month.output;
  }).join("; "));
}
function getOverviewContext() {
  let dealer = currentUser && currentUser.dealer_id
    ? dealers.find(function (item) { return String(item.id) === String(currentUser.dealer_id); })
    : null;
  if (!dealer) dealer = dealers.find(function (item) { return item.name.toLocaleLowerCase("tr-TR") === "meram bayisi"; }) || null;
  if (!dealer) return {dealer: null, products: productCatalog, batches: batches, movements: movements};

  const scopedBatches = batches.filter(function (batch) { return String(batch.dealer_id) === String(dealer.id); });
  const quantities = new Map();
  scopedBatches.forEach(function (batch) {
    quantities.set(batch.product_id, (quantities.get(batch.product_id) || 0) + batch.quantity_on_hand);
  });
  const scopedProducts = productCatalog.map(function (product) {
    return Object.assign({}, product, {total_quantity: quantities.get(product.id) || 0});
  });
  const scopedMovements = overviewMovements || movements.filter(function (movement) { return String(movement.dealer_id) === String(dealer.id); });
  return {dealer: dealer, products: scopedProducts, batches: scopedBatches, movements: scopedMovements};
}
function renderDashboard() {
  const context = getOverviewContext();
  const dashboardProducts = context.products, dashboardBatches = context.batches, dashboardMovements = context.movements;
  if (context.dealer && document.getElementById("page-overview").classList.contains("active")) {
    document.getElementById("page-subtitle").textContent = context.dealer.name + " · stok ve SKT özeti";
  }
  const total = dashboardProducts.reduce(function (sum, product) { return sum + product.total_quantity; }, 0);
  const stocked = dashboardProducts.filter(function (product) { return product.total_quantity > 0; }).length, empty = dashboardProducts.length - stocked;
  const near = dashboardBatches.filter(function (batch) { return batchStatus(batch) === "near"; }), expired = dashboardBatches.filter(function (batch) { return batchStatus(batch) === "expired"; });
  const criticalProducts = dashboardProducts.filter(isCriticalStock).sort(function (a, b) { return Number(a.total_quantity || 0) - Number(b.total_quantity || 0); });
  document.getElementById("product-count").textContent = dashboardProducts.length;
  document.getElementById("total-units").textContent = total.toLocaleString("tr-TR");
  document.getElementById("near-expiry").textContent = near.length;
  document.getElementById("expired").textContent = expired.length;
  document.getElementById("expiry-window-label").textContent = "Önümüzdeki " + expiryWarningDays + " gün · lot";
  const lowStockAlert = document.getElementById("low-stock-alert");
  lowStockAlert.hidden = criticalProducts.length === 0;
  if (criticalProducts.length) {
    document.getElementById("low-stock-alert-copy").textContent =
      criticalProducts.length + " ürünün toplam miktarı " + lowStockThreshold + " " + (criticalProducts.length === 1 ? "birim" : "birim") + " veya altında.";
    document.getElementById("low-stock-alert-list").innerHTML = criticalProducts.slice(0, 4).map(function (product) {
      const quantity = Number(product.total_quantity || 0);
      return '<div class="low-stock-alert-item"><strong>' + escapeHtml(product.name) + '</strong><span class="badge ' + (quantity === 0 ? "expired" : "near") + '">' +
        (quantity === 0 ? "Stokta yok" : quantity.toLocaleString("tr-TR") + " " + escapeHtml(product.unit)) + "</span></div>";
    }).join("") + (criticalProducts.length > 4 ? '<small class="help-text">+' + (criticalProducts.length - 4) + " ürün daha</small>" : "");
  } else {
    document.getElementById("low-stock-alert-copy").textContent = "";
    document.getElementById("low-stock-alert-list").replaceChildren();
  }
  document.getElementById("stock-status").innerHTML = '<div class="stock-status-ring" style="--stocked:' + (dashboardProducts.length ? stocked / dashboardProducts.length * 100 : 0) + '%"><span>' + dashboardProducts.length + '<small>ürün</small></span></div>' +
    '<div class="status-lines"><div><i class="dot-green"></i><span>Stokta olan</span><strong>' + stocked + '</strong></div><div><i class="dot-red"></i><span>Stokta yok</span><strong>' + empty + '</strong></div></div>';
  const upcoming = dashboardBatches.slice().sort(function (a, b) { return a.expiry_date.localeCompare(b.expiry_date); }).slice(0, 5);
  document.getElementById("upcoming-list").innerHTML = upcoming.length ? upcoming.map(function (batch) {
    const status = batchStatus(batch), days = daysUntil(batch.expiry_date), remaining = days < 0 ? Math.abs(days) + " gün geçti" : days + " gün kaldı";
    return '<div class="compact-row"><span class="compact-marker ' + status + '">◷</span><div><strong>' + escapeHtml(batch.product_name) + '</strong><small>' + escapeHtml(batch.batch_code) + " · " + formatDate(batch.expiry_date) + '</small></div><span class="compact-trailing ' + status + '">' + remaining + "</span></div>";
  }).join("") : '<div class="empty">Henüz lot yok.</div>';
  const recent = dashboardMovements.slice(0, 5);
  document.getElementById("recent-list").innerHTML = recent.length ? recent.map(function (movement) {
    const incoming = movement.movement_type === "IN";
    const actionLabel = movement.is_adjustment ? "Stok düzeltmesi" : (incoming ? "Stok girişi" : "Stok çıkışı");
    return '<div class="compact-row"><span class="compact-marker ' + (incoming ? "near" : "expired") + '">' + (incoming ? "↓" : "↑") + '</span><div><strong>' + escapeHtml(movement.product_name) + " · " + escapeHtml(movement.batch_code) + '</strong><small>' + actionLabel + " · " + formatDateTime(movement.created_at) + " · " + escapeHtml(movement.performed_by || "Önceki kayıt") + '</small></div><span class="compact-trailing ' + (incoming ? "near" : "expired") + '">' + (incoming ? "+" : "−") + movement.quantity + "</span></div>";
  }).join("") : '<div class="empty">Henüz hareket yok.</div>';
  drawMovementChart("movement-chart", dashboardMovements);
}
function renderExpirySummary() {
  const counts = {expired: 0, near: 0, mid: 0, long: 0};
  batches.forEach(function (batch) { counts[batchStatus(batch)] += 1; });
  document.getElementById("expiry-expired-count").textContent = counts.expired;
  document.getElementById("expiry-near-count").textContent = counts.near;
  document.getElementById("expiry-mid-count").textContent = counts.mid;
  document.getElementById("expiry-long-count").textContent = counts.long;
  document.getElementById("expiry-setting-caption").textContent = "İlk " + expiryWarningDays + " gün";
}
function renderMovementSummary() {
  document.getElementById("movement-total").textContent = movements.length;
  document.getElementById("movement-limit-label").textContent = "Son " + movements.length + " kayıt";
  document.getElementById("inbound-total").textContent = movements.filter(function (item) { return item.movement_type === "IN"; }).reduce(function (sum, item) { return sum + item.quantity; }, 0).toLocaleString("tr-TR");
  document.getElementById("outbound-total").textContent = movements.filter(function (item) { return item.movement_type === "OUT"; }).reduce(function (sum, item) { return sum + item.quantity; }, 0).toLocaleString("tr-TR");
}
function renderReports() {
  document.getElementById("report-product-count").textContent = productCatalog.length;
  document.getElementById("report-total-units").textContent = productCatalog.reduce(function (sum, product) { return sum + product.total_quantity; }, 0).toLocaleString("tr-TR");
  document.getElementById("report-expiry-count").textContent = batches.filter(function (batch) { return ["expired", "near"].includes(batchStatus(batch)); }).length;
  const definitions = [["expired", "SKT'si geçmiş", "#f66e76"], ["near", "Uyarı döneminde", "#f5a94f"], ["mid", "30–90 gün", "#f2c94c"], ["long", "90 günden fazla", "#36c982"]];
  const max = Math.max(1, ...definitions.map(function (entry) { return batches.filter(function (batch) { return batchStatus(batch) === entry[0]; }).length; }));
  document.getElementById("report-expiry").innerHTML = definitions.map(function (entry) {
    const count = batches.filter(function (batch) { return batchStatus(batch) === entry[0]; }).length;
    return '<div class="report-bar-row"><span>' + entry[1] + '</span><div class="report-bar-track"><i style="width:' + (count / max * 100) + "% ;background:" + entry[2] + '"></i></div><strong>' + count + "</strong></div>";
  }).join("");
  drawMovementChart("report-movement", movements);
  renderReportInsights();
}
function renderReportInsights() {
  const target = document.getElementById("report-insights");
  if (!target) return;
  const insights = [];
  const isAdmin = currentUser && currentUser.role === "admin";
  const dealerName = function (dealerId) {
    const dealer = dealers.find(function (item) { return String(item.id) === String(dealerId); });
    return dealer ? dealer.name : "Bayi";
  };
  const stockByKey = new Map();
  const usableStockByKey = new Map();
  const transferableStockByKey = new Map();
  batches.forEach(function (batch) {
    const key = String(batch.dealer_id) + ":" + String(batch.product_id);
    const quantity = Number(batch.quantity_on_hand || 0);
    stockByKey.set(key, (stockByKey.get(key) || 0) + quantity);
    const daysRemaining = daysUntil(batch.expiry_date);
    if (daysRemaining > expiryWarningDays) {
      usableStockByKey.set(key, (usableStockByKey.get(key) || 0) + quantity);
    }
    if (daysRemaining > expiryWarningDays) {
      transferableStockByKey.set(key, (transferableStockByKey.get(key) || 0) + quantity);
    }
  });
  const expiredLots = batches.filter(function (batch) { return daysUntil(batch.expiry_date) < 0; })
    .sort(function (a, b) { return daysUntil(a.expiry_date) - daysUntil(b.expiry_date); });
  expiredLots.slice(0, 2).forEach(function (batch) {
    insights.push({
      level: "critical", label: "Acil", title: "SKT’si geçmiş lot",
      detail: (isAdmin ? dealerName(batch.dealer_id) + " · " : "") + batch.product_name + " · " + Number(batch.quantity_on_hand).toLocaleString("tr-TR") + " " + batch.unit + " · " + batch.batch_code,
      advice: "Bu lotu satıştan ayırıp fiziksel stoğu ve kaydı kontrol edin."
    });
  });
  const nearLots = batches.filter(function (batch) {
    const days = daysUntil(batch.expiry_date);
    return days >= 0 && days <= expiryWarningDays;
  }).sort(function (a, b) { return daysUntil(a.expiry_date) - daysUntil(b.expiry_date); });
  nearLots.slice(0, 2).forEach(function (batch) {
    const days = daysUntil(batch.expiry_date);
    insights.push({
      level: "warning", label: "SKT yaklaşıyor", title: batch.product_name,
      detail: (isAdmin ? dealerName(batch.dealer_id) + " · " : "") + batch.batch_code + " lotunda " + Number(batch.quantity_on_hand).toLocaleString("tr-TR") + " " + batch.unit + " · " + (days === 0 ? "bugün" : days + " gün içinde") + " SKT",
      advice: "Bu lotu önce kullanmayı planlayın ve sevkiyatlarda son kullanma tarihini kontrol edin."
    });
  });

  const cutoff = Date.now() - 30 * 86400000;
  const demandByKey = new Map();
  movements.forEach(function (movement) {
    if (movement.movement_type !== "OUT" || movement.is_adjustment || !movement.product_id || new Date(movement.created_at).getTime() < cutoff) return;
    if (/^stok talebi\s*#/i.test(String(movement.note || "").trim())) return;
    const key = String(movement.dealer_id) + ":" + String(movement.product_id);
    const demand = demandByKey.get(key) || {quantity: 0, movements: 0, firstMovementAt: Infinity};
    const movementTime = new Date(movement.created_at).getTime();
    demand.quantity += Number(movement.quantity || 0);
    demand.movements += 1;
    demand.firstMovementAt = Math.min(demand.firstMovementAt, movementTime);
    demandByKey.set(key, demand);
  });
  const lowStockRows = [];
  demandByKey.forEach(function (demand, key) {
    const parts = key.split(":");
    const dealerId = parts[0], productId = parts[1];
    const product = productCatalog.find(function (item) { return String(item.id) === productId; });
    if (!product || demand.quantity <= 0) return;
    const onHand = stockByKey.get(key) || 0;
    const usableOnHand = usableStockByKey.get(key) || 0;
    const dailyRate = demand.quantity / 30;
    const coverageDays = dailyRate > 0 ? Math.floor(usableOnHand / dailyRate) : 0;
    const hasDemandEvidence = demand.movements >= 3 && Date.now() - demand.firstMovementAt >= 7 * 86400000;
    if (hasDemandEvidence && coverageDays <= 14) {
      lowStockRows.push({
        dealerId: dealerId, product: product, outbound: demand.quantity, movementCount: demand.movements,
        onHand: onHand, usableOnHand: usableOnHand, coverageDays: coverageDays, dailyRate: dailyRate
      });
    }
  });
  lowStockRows.sort(function (a, b) { return a.coverageDays - b.coverageDays; });
  lowStockRows.slice(0, 3).forEach(function (item) {
    const targetStock = Math.ceil(item.dailyRate * 30);
    const destinationNeed = Math.max(0, targetStock - item.usableOnHand);
    let transferSuggestion = null;
    if (isAdmin) {
      const sources = dealers.filter(function (dealer) { return dealer.is_active !== false && String(dealer.id) !== String(item.dealerId); })
        .map(function (dealer) {
          const key = String(dealer.id) + ":" + String(item.product.id);
          const sourceDemand = demandByKey.get(key);
          if (!sourceDemand || sourceDemand.movements < 3 ||
              Date.now() - sourceDemand.firstMovementAt < 7 * 86400000) return null;
          const sourceDailyRate = sourceDemand.quantity / 30;
          const sourceReserve = Math.ceil(sourceDailyRate * 30);
          const transferable = Math.max(0, (transferableStockByKey.get(key) || 0) - sourceReserve);
          return transferable > 0 ? {
            name: dealer.name,
            transferable: transferable,
            sourceReserve: sourceReserve,
            sourceDailyRate: sourceDailyRate
          } : null;
        }).filter(Boolean).sort(function (a, b) { return b.transferable - a.transferable; });
      if (sources.length && destinationNeed > 0) {
        const source = sources[0];
        transferSuggestion = {
          dealer: source.name,
          quantity: Math.min(destinationNeed, source.transferable),
          sourceReserve: source.sourceReserve
        };
      }
    }
    const advice = transferSuggestion
      ? transferSuggestion.dealer + " bayisinde SKT uyarı döneminin dışındaki stoktan, kendi son 30 günlük çıkış ihtiyacı (" +
        transferSuggestion.sourceReserve.toLocaleString("tr-TR") + " " + item.product.unit +
        ") ayrıldıktan sonra " + transferSuggestion.quantity.toLocaleString("tr-TR") + " " + item.product.unit +
        " transfer edilebilir. Bu miktar alıcı bayinin tahmini 30 günlük ihtiyacına yöneliktir; transferi onaylamadan önce lot ve talebi kontrol edin."
      : (isAdmin
        ? "Son 30 gündeki " + item.movementCount + " çıkış kaydına göre stok yaklaşık " + item.coverageDays +
          " gün yeterli görünüyor. Güvenli transfer için başka bayide yeterli SKT riski olmayan fazlalık ve karşılaştırılabilir çıkış geçmişi bulunmadığından, tedarik veya stok talebini değerlendirin."
        : "Son 30 gündeki " + item.movementCount + " çıkış kaydına göre stok yaklaşık " + item.coverageDays +
          " gün yeterli görünüyor. Yöneticiye stok talebi iletin.");
    insights.push({
      level: item.coverageDays <= 7 ? "critical" : "warning",
      label: transferSuggestion ? "Transfer önerisi" : (item.coverageDays <= 7 ? "Stok kritik" : "Stok azalıyor"),
      title: item.product.name,
      detail: (isAdmin ? dealerName(item.dealerId) + " · " : "") + "Mevcut " + item.onHand.toLocaleString("tr-TR") + " " + item.product.unit +
        " · son 30 günde " + item.outbound.toLocaleString("tr-TR") + " " + item.product.unit + " çıkış · yaklaşık " +
        item.coverageDays + " günlük stok · tahmin " + item.movementCount + " çıkış kaydına dayanıyor",
      advice: advice
    });
  });

  target.innerHTML = insights.length ? insights.map(function (item) {
    return '<article class="report-insight ' + item.level + '"><span class="report-insight-mark" aria-hidden="true">' + (item.level === "critical" ? "!" : "◷") + '</span><div class="report-insight-copy"><div class="report-insight-heading"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.label) + '</span></div><p>' + escapeHtml(item.detail) + '</p><small>' + escapeHtml(item.advice) + '</small></div></article>';
  }).join("") : '<p class="report-insights-empty">Şu an öncelikli bir stok veya SKT uyarısı yok. Yeni hareketler ve lot kayıtları geldikçe öneriler güncellenir.</p>';
}
function renderAiReportInsights(result) {
  const container = document.getElementById("ai-report-result");
  const summary = document.getElementById("ai-report-summary");
  const target = document.getElementById("ai-report-insights");
  const typeLabels = {
    demand: "Talep eğilimi",
    transfer: "Transfer önerisi",
    replenishment: "Stok takviyesi",
    risk: "Stok riski"
  };
  const priorityLabels = {high: "Yüksek öncelik", medium: "Orta öncelik", low: "Düşük öncelik"};
  const confidenceLabels = {high: "Yüksek", medium: "Orta", low: "Sınırlı"};
  target.replaceChildren();
  summary.textContent = result.summary;
  document.getElementById("ai-report-meta").textContent =
    result.model + " · " + formatDateTime(result.generated_at);
  if (!result.recommendations.length) {
    const empty = document.createElement("p");
    empty.className = "report-insights-empty";
    empty.textContent = "Bu verilerle uygulanabilir bir öneri bulunamadı.";
    target.appendChild(empty);
  } else {
    result.recommendations.forEach(function (item) {
      const card = document.createElement("article");
      card.className = "report-insight report-insight-ai " +
        (item.priority === "high" ? "critical" : "warning");
      const mark = document.createElement("span");
      mark.className = "report-insight-mark";
      mark.setAttribute("aria-hidden", "true");
      mark.textContent = item.type === "transfer" ? "⇄" : (item.priority === "high" ? "!" : "✦");
      const copy = document.createElement("div");
      copy.className = "report-insight-copy";
      const heading = document.createElement("div");
      heading.className = "report-insight-heading";
      const title = document.createElement("strong");
      title.textContent = item.product_name;
      const type = document.createElement("span");
      type.textContent = typeLabels[item.type] || "Stok önerisi";
      const priority = document.createElement("span");
      priority.className = "report-insight-priority";
      priority.textContent = priorityLabels[item.priority] || "Öneri";
      heading.append(title, type, priority);
      const location = document.createElement("p");
      location.textContent = item.type === "transfer"
        ? item.source_dealer_name + " → " + item.destination_dealer_name + " · " +
          Number(item.suggested_quantity).toLocaleString("tr-TR") + " " + item.unit
        : item.dealer_name;
      const reason = document.createElement("p");
      reason.textContent = item.reason;
      const evidence = document.createElement("small");
      evidence.textContent = "Dayanak: " + item.evidence + " · Güven: " +
        (confidenceLabels[item.confidence] || "Sınırlı");
      copy.append(heading, location, reason, evidence);
      card.append(mark, copy);
      target.appendChild(card);
    });
  }
  container.hidden = false;
}
function renderAll() {
  renderProducts(); renderProductInsight(); renderCategories(); renderBatches(); renderExpiryInsight(); renderDealerOverview(); renderDealerInsight(); renderStockRequests(); renderRequestInsight(); renderMovements(); renderDashboard(); renderExpirySummary(); renderMovementSummary(); renderMovementInsight(); renderReports();
  updateNotificationIndicator();
}
function updateNotificationIndicator() {
  const button = document.getElementById("notification-button");
  const dot = button.querySelector(".notification-dot");
  const notifications = getNotifications();
  dot.hidden = notifications.length === 0;
  button.setAttribute("aria-label", notifications.length
    ? "Bildirimleri aç, " + notifications.length + " bildirim"
    : "Bildirimleri aç, yeni bildirim yok");
  button.title = notifications.length ? notifications.length + " güncel stok ve SKT bildirimi" : "Yeni bildirim yok";
  if (!document.getElementById("notification-panel").hidden) renderNotifications();
}
function getNotifications() {
  const criticalProducts = productCatalog.filter(isCriticalStock).map(function (product) {
    const quantity = Number(product.total_quantity || 0);
    return {
      id: "stock-" + product.id,
      type: "stock",
      title: quantity === 0 ? "Stokta ürün kalmadı" : "Kritik stok seviyesi",
      detail: product.name + " · " + (product.sku || "Stok kodu yok") + " · " + quantity.toLocaleString("tr-TR") + " " + product.unit,
      search: product.sku || product.name,
      productId: product.id,
      quantity: quantity
    };
  });
  const expiryBatches = batches.filter(function (batch) {
    return ["expired", "near"].includes(batchStatus(batch));
  }).map(function (batch) {
    const days = daysUntil(batch.expiry_date);
    return {
      id: "expiry-" + batch.id,
      type: "expiry",
      title: days < 0 ? "Lotun son kullanma tarihi geçti" : "Lotun son kullanma tarihi yaklaşıyor",
      detail: batch.product_name + " · " + batch.batch_code + " · " + formatDate(batch.expiry_date) + " · " +
        Number(batch.quantity_on_hand || 0).toLocaleString("tr-TR") + " " + batch.unit + " · " +
        (days < 0 ? Math.abs(days) + " gün geçti" : days + " gün kaldı"),
      search: batch.batch_code,
      productName: batch.product_name,
      days: days
    };
  });
  return criticalProducts.concat(expiryBatches).sort(function (a, b) {
    const aUrgency = a.type === "stock" ? (a.quantity === 0 ? -1 : 0) : a.days;
    const bUrgency = b.type === "stock" ? (b.quantity === 0 ? -1 : 0) : b.days;
    return aUrgency - bUrgency || a.title.localeCompare(b.title, "tr");
  });
}
function renderNotifications() {
  const notifications = getNotifications();
  const list = document.getElementById("notification-list");
  document.getElementById("notification-panel-summary").textContent = notifications.length
    ? notifications.length + " güncel stok ve SKT uyarısı"
    : "Şu an görüntülenecek yeni bildirim yok.";
  if (!notifications.length) {
    list.innerHTML = '<p class="notification-empty">Stok ve son kullanma tarihi durumları normal.</p>';
    return;
  }
  list.innerHTML = notifications.slice(0, 30).map(function (item) {
    const label = item.type === "stock" ? "Stok" : (item.days < 0 ? "SKT geçti" : "SKT yaklaşıyor");
    return '<button class="notification-item ' + item.type + '" type="button" data-notification-id="' + escapeHtml(item.id) + '">' +
      '<span class="notification-item-mark" aria-hidden="true">' + (item.type === "stock" ? "!" : "◷") + '</span><span class="notification-item-copy">' +
      '<strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.detail) + '</small></span><span class="notification-item-label">' + label + "</span></button>";
  }).join("") + (notifications.length > 30 ? '<p class="notification-more">+' + (notifications.length - 30) + " bildirim daha</p>" : "");
}
async function refreshAll() {
  const data = await Promise.all([api("/api/categories"), api("/api/products"), api("/api/batches"), api("/api/movements?limit=100"), api("/api/dealers"), api("/api/dealer-overview")]);
  categories = data[0]; productCatalog = data[1]; batches = data[2]; movements = data[3]; dealers = data[4]; dealerOverview = data[5];
  const overviewDealer = currentUser && currentUser.dealer_id
    ? dealers.find(function (item) { return String(item.id) === String(currentUser.dealer_id); })
    : dealers.find(function (item) { return item.name.toLocaleLowerCase("tr-TR") === "meram bayisi"; });
  overviewMovements = overviewDealer
    ? await api("/api/movements?limit=100&dealer_id=" + overviewDealer.id)
    : null;
  if (window.SaveStockOfflineStore.isUnlocked() && currentUser) {
    await window.SaveStockOfflineStore.updateSnapshot(currentUser, offlineSnapshot());
    offlineState = window.SaveStockOfflineStore.state();
    if (offlineState) applyOfflineProjection(offlineState.queue);
  }
  updateDealerSelects();
  updateCategorySelects(); updateProductSelects(); renderAll();
  const accountLoads = [loadProfile(), loadStockRequests()];
  if (currentUser && currentUser.role === "admin") accountLoads.push(loadUsers(), loadAdminActivities());
  accountLoads.push(loadBilling());
  await Promise.all(accountLoads);
  await renderOfflineSettings();
  document.getElementById("data-load-error").hidden = true;
}
function formObject(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  ["category_id", "product_id", "dealer_id", "quantity", "target_quantity", "requested_quantity"].forEach(function (key) { if (data[key] !== undefined && data[key] !== "") data[key] = Number(data[key]); });
  if (data.category_id === "") data.category_id = null;
  if (data.dealer_id === "") data.dealer_id = null;
  if (data.note === "") data.note = null;
  return data;
}

const STOCK_OPERATION_ROUTES = {
  inbound: "/api/stock/inbound",
  outbound: "/api/stock/outbound",
  adjustment: "/api/stock/adjustment"
};

function applyOfflineOperation(operation) {
  const payload = operation.payload;
  const product = productCatalog.find(function (item) { return Number(item.id) === Number(payload.product_id); });
  const dealer = dealers.find(function (item) { return Number(item.id) === Number(payload.dealer_id); });
  if (!product || !dealer) throw new Error("Ürün veya bayi önbellekte bulunamadı.");

  if (operation.kind === "inbound") {
    const batch = batches.find(function (item) {
      return Number(item.product_id) === Number(payload.product_id) &&
        Number(item.dealer_id) === Number(payload.dealer_id) && item.batch_code === payload.batch_code;
    });
    if (batch && batch.expiry_date !== payload.expiry_date) {
      throw new Error("Aynı lot kodu farklı bir SKT ile kayıtlı.");
    }
    if (batch) {
      batch.quantity_on_hand = Number(batch.quantity_on_hand || 0) + payload.quantity;
    } else {
      batches.push({
        id: -Date.now() - Math.floor(Math.random() * 1000),
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit: product.unit,
        dealer_id: dealer.id,
        dealer_name: dealer.name,
        batch_code: payload.batch_code,
        expiry_date: payload.expiry_date,
        quantity_on_hand: payload.quantity
      });
    }
  } else if (operation.kind === "outbound") {
    const today = localDateKey(new Date());
    const eligible = batches.filter(function (item) {
      return Number(item.product_id) === Number(payload.product_id) &&
        Number(item.dealer_id) === Number(payload.dealer_id) &&
        Number(item.quantity_on_hand) > 0 && item.expiry_date >= today;
    }).sort(function (a, b) {
      return a.expiry_date.localeCompare(b.expiry_date) || Number(a.id) - Number(b.id);
    });
    const available = eligible.reduce(function (sum, item) { return sum + Number(item.quantity_on_hand); }, 0);
    if (available < payload.quantity) {
      throw new Error("Önbelleğe göre yeterli kullanılabilir stok yok. Güncel stok için bağlantı kurun.");
    }
    let remaining = payload.quantity;
    eligible.forEach(function (item) {
      if (!remaining) return;
      const taken = Math.min(Number(item.quantity_on_hand), remaining);
      item.quantity_on_hand -= taken;
      remaining -= taken;
    });
  } else if (operation.kind === "adjustment") {
    if (!currentUser || currentUser.role !== "admin") throw new Error("Stok düzeltmesi için yönetici yetkisi gerekir.");
    const batch = batches.find(function (item) {
      return Number(item.product_id) === Number(payload.product_id) &&
        Number(item.dealer_id) === Number(payload.dealer_id) && item.batch_code === payload.batch_code;
    });
    if (!batch) throw new Error("Düzeltilecek lot önbellekte bulunamadı.");
    if (Number(batch.quantity_on_hand) === payload.target_quantity) throw new Error("Sayım miktarı mevcut miktarla aynı.");
    batch.quantity_on_hand = payload.target_quantity;
  }

  productCatalog.forEach(function (item) {
    item.total_quantity = batches.reduce(function (sum, batch) {
      return sum + (Number(batch.product_id) === Number(item.id) ? Number(batch.quantity_on_hand || 0) : 0);
    }, 0);
  });
}

function applyOfflineProjection(queue) {
  if (!offlineState || !offlineState.cache) return;
  categories = JSON.parse(JSON.stringify(offlineState.cache.categories || []));
  dealers = JSON.parse(JSON.stringify(offlineState.cache.dealers || []));
  productCatalog = JSON.parse(JSON.stringify(offlineState.cache.products || []));
  batches = JSON.parse(JSON.stringify(offlineState.cache.batches || []));
  let blocked = false;
  queue.forEach(function (operation) {
    if (blocked) return;
    if (operation.status === "conflict") { blocked = true; return; }
    try {
      applyOfflineOperation(operation);
    } catch (error) {
      operation.status = "conflict";
      operation.error = error.message;
      blocked = true;
      window.SaveStockOfflineStore.updateOperation(operation.id, {
        status: "conflict",
        error: operation.error
      }).catch(function (saveError) { showToast(saveError.message, true); });
    }
  });
}

function newStockOperationId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" + hex.slice(20);
}

async function enqueueOfflineOperation(operation) {
  if (!window.SaveStockOfflineStore.isUnlocked()) {
    throw new Error("Önce Profilim bölümünden çevrimdışı PIN ayarlayın.");
  }
  const previousProducts = JSON.stringify(productCatalog);
  const previousBatches = JSON.stringify(batches);
  try {
    applyOfflineOperation(operation);
    operation.status = "pending";
    await window.SaveStockOfflineStore.addOperation(operation);
    offlineState = window.SaveStockOfflineStore.state();
    offlineMode = true;
    offlineBannerNotice = null;
    renderAll();
    updateOfflineBanner();
  } catch (error) {
    productCatalog = JSON.parse(previousProducts);
    batches = JSON.parse(previousBatches);
    throw error;
  }
}

async function submitStockOperation(kind, form) {
  const payload = formObject(form);
  const requestId = newStockOperationId();
  const operation = {
    id: requestId,
    kind: kind,
    payload: payload,
    status: "sending",
    createdAt: new Date().toISOString()
  };
  if (offlineMode || !navigator.onLine) {
    await enqueueOfflineOperation(operation);
    return {queued: true};
  }

  const canPersist = window.SaveStockOfflineStore.isUnlocked();
  if (canPersist) {
    await window.SaveStockOfflineStore.addOperation(operation);
    offlineState = window.SaveStockOfflineStore.state();
    updateOfflineBanner();
  }
  try {
    const result = await api(STOCK_OPERATION_ROUTES[kind], {
      method: "POST",
      headers: {"Content-Type": "application/json", "Idempotency-Key": requestId},
      body: JSON.stringify(payload)
    });
    if (canPersist) {
      await window.SaveStockOfflineStore.removeOperation(requestId);
      offlineState = window.SaveStockOfflineStore.state();
    }
    updateOfflineBanner();
    return {result: result};
  } catch (error) {
    if (canPersist && (isNetworkError(error) || error.status === 401 || error.status >= 500)) {
      await window.SaveStockOfflineStore.updateOperation(requestId, {
        status: "pending",
        error: error.message
      });
      offlineState = window.SaveStockOfflineStore.state();
      if (error.status === 401) {
        requireOnlineLogin("Oturum süreniz doldu. Bekleyen stok işlemleri bu cihazda korundu; aynı hesapla giriş yaptığınızda eşitleme yeniden denenecek.");
      }
      if (isNetworkError(error)) {
        offlineMode = true;
        applyOfflineProjection(offlineState.queue);
        renderAll();
      }
      updateOfflineBanner(error.status === 401 ? "Giriş süreniz dolmuş olabilir. Yeniden giriş yaptıktan sonra aynı işlem anahtarıyla güvenle eşitlenir." : undefined);
      return {queued: true};
    }
    if (canPersist) {
      await window.SaveStockOfflineStore.removeOperation(requestId);
      offlineState = window.SaveStockOfflineStore.state();
      updateOfflineBanner();
    }
    if (isNetworkError(error)) {
      throw new Error("Sunucu yanıt vermedi ve çevrimdışı kasa açık değil. İşlem sunucuya ulaşmış olabilir; tekrar denemeden önce hareketleri kontrol edin. Güvenli çevrimdışı sıra için önce PIN ayarlayın.");
    }
    throw error;
  }
}

async function syncOfflineTransactions() {
  if (offlineSyncPromise) return offlineSyncPromise;
  offlineSyncPromise = (async function () {
    if (!navigator.onLine) {
      updateOfflineBanner("İnternet bağlantısı yok. İşlemler bu cihazda korunuyor.");
      return;
    }
    if (!window.SaveStockOfflineStore.isUnlocked()) {
      updateOfflineBanner("Eşitlemeden önce çevrimdışı PIN ile kasanın kilidini açın.");
      return;
    }
    const stored = window.SaveStockOfflineStore.state();
    if (!currentUser || String(stored.user.id) !== String(currentUser.id)) {
      document.getElementById("offline-login-button").hidden = false;
      updateOfflineBanner("Eşitlemek için çevrimdışı kasaya bağlı hesapla giriş yapın.");
      return;
    }

    let succeeded = 0;
    let requiresLogin = false;
    for (const operation of stored.queue) {
      if (operation.status === "conflict") break;
      try {
        await window.SaveStockOfflineStore.updateOperation(operation.id, {status: "sending", error: ""});
        await api(STOCK_OPERATION_ROUTES[operation.kind], {
          method: "POST",
          headers: {"Content-Type": "application/json", "Idempotency-Key": operation.id},
          body: JSON.stringify(operation.payload)
        });
        await window.SaveStockOfflineStore.removeOperation(operation.id);
        succeeded += 1;
      } catch (error) {
        if (error.status === 409 || error.status === 422 || error.status === 403 || error.status === 404) {
          await window.SaveStockOfflineStore.updateOperation(operation.id, {
            status: "conflict",
            error: error.message
          });
        } else {
          await window.SaveStockOfflineStore.updateOperation(operation.id, {
            status: "pending",
            error: error.message
          });
          requiresLogin = error.status === 401;
        }
        break;
      }
    }
    offlineState = window.SaveStockOfflineStore.state();
    if (!offlineState.queue.length) {
      offlineMode = false;
      offlineBannerNotice = null;
      await refreshAll();
      showToast(succeeded ? succeeded + " çevrimdışı işlem güvenle eşitlendi." : "Bekleyen işlem yok.");
    } else {
      applyOfflineProjection(offlineState.queue);
      renderAll();
      updateOfflineBanner(offlineState.queue.some(function (item) { return item.status === "conflict"; })
        ? "Bir işlem stok/izin doğrulamasında çakıştı. Bu işlem ve sonrakiler, gözden geçirilene kadar gönderilmez."
        : "Eşitleme tamamlanmadı. Bekleyen işlemler aynı işlem anahtarıyla güvenle yeniden denenebilir.");
      if (requiresLogin) {
        requireOnlineLogin("Oturum süreniz doldu. Bekleyen stok işlemleri bu cihazda korundu; aynı hesapla giriş yaptığınızda eşitleme yeniden denenecek.");
      }
    }
  })().catch(function (error) {
    updateOfflineBanner(error.message);
  }).finally(function () {
    offlineSyncPromise = null;
    updateOfflineBanner();
  });
  return offlineSyncPromise;
}

function exportCsv(filename, headers, rows) {
  const quote = function (value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; };
  const csv = "\uFEFF" + [headers, ...rows].map(function (row) { return row.map(quote).join(";"); }).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function wireEvents() {
  const sidebar = document.getElementById("app-sidebar");
  const menuButton = document.getElementById("mobile-menu-button");
  const menuCloseButton = document.getElementById("mobile-menu-close");
  const menuBackdrop = document.getElementById("mobile-menu-backdrop");
  const main = document.querySelector(".main");
  const mobileMenuQuery = window.matchMedia("(max-width: 760px)");
  const productFilterQuery = window.matchMedia("(max-width: 760px)");
  const productFilterPanel = document.getElementById("product-filter-panel");
  document.getElementById("retry-data-load").addEventListener("click", async function (event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Yükleniyor…";
    document.getElementById("data-load-error-message").textContent = "Sunucudan güncel veriler alınıyor…";
    try { await refreshAll(); }
    catch (error) { showDataLoadError(error); }
  });
  document.getElementById("offline-sync-button").addEventListener("click", syncOfflineTransactions);
  document.getElementById("offline-login-button").addEventListener("click", function () {
    pendingOnlineUser = null;
    showLogin();
  });
  document.getElementById("offline-discard-button").addEventListener("click", async function () {
    const state = window.SaveStockOfflineStore.state();
    if (!state || !state.queue.length) return;
    if (!window.confirm(state.queue.length + " bekleyen stok işlemi kalıcı olarak silinsin mi? Bu işlem sunucu stoğunu değiştirmez.")) return;
    try {
      await window.SaveStockOfflineStore.clearQueue();
      offlineState = window.SaveStockOfflineStore.state();
      offlineBannerNotice = null;
      if (offlineMode) await enterOfflineApp(offlineState);
      else await refreshAll();
      updateOfflineBanner();
      showToast("Bekleyen çevrimdışı işlemler silindi.");
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("offline-pin-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.pin !== values.pin_confirm) {
      document.getElementById("offline-settings-status").textContent = "Girdiğiniz PIN'ler aynı değil.";
      return;
    }
    try {
      if (await window.SaveStockOfflineStore.hasVault()) {
        document.getElementById("offline-settings-status").textContent = "Bu cihazda zaten bir çevrimdışı kasa var.";
        return;
      }
      await refreshAll();
      await window.SaveStockOfflineStore.setup(values.pin, {user: currentUser, cache: offlineSnapshot()});
      offlineState = window.SaveStockOfflineStore.state();
      form.reset();
      await renderOfflineSettings();
      showToast("Çevrimdışı erişim bu cihazda şifreli olarak etkinleştirildi.");
    } catch (error) {
      document.getElementById("offline-settings-status").textContent = error.message;
    }
  });
  document.getElementById("offline-clear-button").addEventListener("click", async function () {
    const state = window.SaveStockOfflineStore.state();
    if (state && state.queue.length && !window.confirm(
      state.queue.length + " bekleyen işlem de silinecek. Çevrimdışı erişim kapatılsın mı?"
    )) return;
    try {
      await window.SaveStockOfflineStore.clear();
      offlineState = null;
      await renderOfflineSettings();
      updateOfflineBanner();
      showToast("Bu cihazdaki çevrimdışı veriler silindi.");
    } catch (error) { showToast(error.message, true); }
  });
  window.addEventListener("offline", function () {
    if (!currentUser) return;
    offlineMode = true;
    offlineState = window.SaveStockOfflineStore.isUnlocked() ? window.SaveStockOfflineStore.state() : offlineState;
    updateOfflineBanner(window.SaveStockOfflineStore.isUnlocked()
      ? "Bağlantı kesildi. Yeni stok işlemleri PIN ile korunan sıraya alınacak."
      : "Bağlantı kesildi. Çevrimdışı işlem sırası için Profilim bölümünde PIN ayarlayın.");
  });
  window.addEventListener("online", function () {
    if (!currentUser && !offlineMode) return;
    if (window.SaveStockOfflineStore.isUnlocked()) {
      const state = window.SaveStockOfflineStore.state();
      if (state.queue.length) syncOfflineTransactions();
      else {
        offlineMode = false;
        refreshAll().catch(function (error) { showDataLoadError(error); });
      }
    } else {
      offlineMode = false;
      refreshAll().catch(function (error) { showDataLoadError(error); });
    }
  });
  productFilterPanel.open = !productFilterQuery.matches;
  productFilterQuery.addEventListener("change", function (event) { productFilterPanel.open = !event.matches; });
  document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
    button.addEventListener("click", function () {
      applyTheme(button.dataset.themeChoice);
      showToast(currentTheme === "light" ? "Açık mod etkinleştirildi." : "Koyu mod etkinleştirildi.");
    });
  });
  const setMobileMenuOpen = function (open, restoreFocus) {
    const shouldOpen = mobileMenuQuery.matches && open;
    sidebar.classList.toggle("is-open", shouldOpen);
    menuBackdrop.hidden = !shouldOpen;
    menuButton.setAttribute("aria-expanded", String(shouldOpen));
    menuButton.setAttribute("aria-label", shouldOpen ? "Menüyü kapat" : "Menüyü aç");
    sidebar.inert = mobileMenuQuery.matches && !shouldOpen;
    main.inert = mobileMenuQuery.matches && shouldOpen;
    document.body.classList.toggle("mobile-menu-open", shouldOpen);
    if (shouldOpen) menuCloseButton.focus();
    else if (restoreFocus) menuButton.focus();
  };
  menuButton.addEventListener("click", function () { setMobileMenuOpen(true, false); });
  menuCloseButton.addEventListener("click", function () { setMobileMenuOpen(false, true); });
  menuBackdrop.addEventListener("click", function () { setMobileMenuOpen(false, true); });
  sidebar.querySelectorAll(".nav-item").forEach(function (item) {
    item.addEventListener("click", function () { setMobileMenuOpen(false, true); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) setMobileMenuOpen(false, true);
  });
  mobileMenuQuery.addEventListener("change", function (event) {
    setMobileMenuOpen(false, false);
    sidebar.inert = event.matches;
  });
  sidebar.inert = mobileMenuQuery.matches;
  wireSwipeBackGesture();
  document.querySelectorAll("[data-page]").forEach(function (button) { button.addEventListener("click", function () { setPage(button.dataset.page); }); });
  document.querySelectorAll("[data-user-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeUserInsight = button.dataset.userInsight;
      userInsightPage = 1;
      document.getElementById("user-insight-search").value = "";
      renderUserInsight();
      setPage("user-insight");
    });
  });
  document.getElementById("user-insight-search").addEventListener("input", function () {
    userInsightPage = 1;
    renderUserInsight();
  });
  document.getElementById("user-insight-previous").addEventListener("click", function () {
    userInsightPage -= 1;
    renderUserInsight();
  });
  document.getElementById("user-insight-next").addEventListener("click", function () {
    userInsightPage += 1;
    renderUserInsight();
  });
  document.querySelectorAll("[data-request-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeRequestInsight = button.dataset.requestInsight;
      requestInsightPage = 1;
      document.getElementById("request-insight-search").value = "";
      renderRequestInsight();
      setPage("request-insight");
    });
  });
  document.getElementById("request-insight-search").addEventListener("input", function () {
    requestInsightPage = 1;
    renderRequestInsight();
  });
  document.getElementById("request-insight-previous").addEventListener("click", function () {
    requestInsightPage -= 1;
    renderRequestInsight();
  });
  document.getElementById("request-insight-next").addEventListener("click", function () {
    requestInsightPage += 1;
    renderRequestInsight();
  });
  document.querySelectorAll("[data-category-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeCategoryInsight = button.dataset.categoryInsight;
      categoryInsightPage = 1;
      document.getElementById("category-insight-search").value = "";
      renderCategoryInsight();
      setPage("category-insight");
    });
  });
  document.getElementById("category-insight-search").addEventListener("input", function () {
    categoryInsightPage = 1;
    renderCategoryInsight();
  });
  document.getElementById("category-insight-previous").addEventListener("click", function () {
    categoryInsightPage -= 1;
    renderCategoryInsight();
  });
  document.getElementById("category-insight-next").addEventListener("click", function () {
    categoryInsightPage += 1;
    renderCategoryInsight();
  });
  document.querySelectorAll("[data-product-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeProductInsight = button.dataset.productInsight;
      productInsightPage = 1;
      document.getElementById("product-insight-search").value = "";
      renderProductInsight();
      setPage("product-insight");
    });
  });
  document.querySelectorAll("[data-movement-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeMovementInsight = button.dataset.movementInsight;
      movementInsightPage = 1;
      document.getElementById("movement-insight-search").value = "";
      renderMovementInsight();
      setPage("movement-insight");
    });
  });
  document.querySelectorAll("[data-expiry-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeExpiryInsight = button.dataset.expiryInsight;
      expiryInsightPage = 1;
      document.getElementById("expiry-insight-search").value = "";
      renderExpiryInsight();
      setPage("expiry-insight");
    });
  });
  document.querySelectorAll("[data-dealer-insight]").forEach(function (button) {
    button.addEventListener("click", function () {
      activeDealerInsight = button.dataset.dealerInsight;
      dealerInsightPage = 1;
      document.getElementById("dealer-insight-search").value = "";
      renderDealerInsight();
      setPage("dealer-insight");
    });
  });
  document.getElementById("dealer-insight-search").addEventListener("input", function () {
    dealerInsightPage = 1;
    renderDealerInsight();
  });
  document.getElementById("dealer-insight-previous").addEventListener("click", function () {
    dealerInsightPage -= 1;
    renderDealerInsight();
  });
  document.getElementById("dealer-insight-next").addEventListener("click", function () {
    dealerInsightPage += 1;
    renderDealerInsight();
  });
  document.getElementById("expiry-insight-search").addEventListener("input", function () {
    expiryInsightPage = 1;
    renderExpiryInsight();
  });
  document.getElementById("expiry-insight-previous").addEventListener("click", function () {
    expiryInsightPage -= 1;
    renderExpiryInsight();
  });
  document.getElementById("expiry-insight-next").addEventListener("click", function () {
    expiryInsightPage += 1;
    renderExpiryInsight();
  });
  document.getElementById("movement-insight-search").addEventListener("input", function () {
    movementInsightPage = 1;
    renderMovementInsight();
  });
  document.getElementById("movement-insight-previous").addEventListener("click", function () {
    movementInsightPage -= 1;
    renderMovementInsight();
  });
  document.getElementById("movement-insight-next").addEventListener("click", function () {
    movementInsightPage += 1;
    renderMovementInsight();
  });
  document.getElementById("product-insight-search").addEventListener("input", function () {
    productInsightPage = 1;
    renderProductInsight();
  });
  document.getElementById("product-insight-previous").addEventListener("click", function () {
    productInsightPage -= 1;
    renderProductInsight();
  });
  document.getElementById("product-insight-next").addEventListener("click", function () {
    productInsightPage += 1;
    renderProductInsight();
  });
  document.getElementById("dashboard-products-card").addEventListener("click", function () {
    setPage("products");
  });
  document.getElementById("dashboard-stock-card").addEventListener("click", function () {
    setPage("movements");
  });
  document.getElementById("dashboard-near-expiry-card").addEventListener("click", function () {
    activeExpiryFilter = "near";
    batchPage = 1;
    document.getElementById("batch-search").value = "";
    document.querySelectorAll("[data-expiry-filter]").forEach(function (tab) {
      const active = tab.dataset.expiryFilter === activeExpiryFilter;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderBatches();
    setPage("expiry");
  });
  document.getElementById("dashboard-expired-card").addEventListener("click", function () {
    activeExpiryFilter = "expired";
    batchPage = 1;
    document.getElementById("batch-search").value = "";
    document.querySelectorAll("[data-expiry-filter]").forEach(function (tab) {
      const active = tab.dataset.expiryFilter === activeExpiryFilter;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderBatches();
    setPage("expiry");
  });
  document.querySelectorAll("[data-focus-form]").forEach(function (button) {
    button.addEventListener("click", function () {
      setTimeout(function () { document.querySelector("#" + button.dataset.focusForm + " input").focus(); }, 40);
    });
  });
  document.querySelectorAll("[data-open-stock]").forEach(function (button) {
    button.addEventListener("click", function () {
      const details = document.getElementById("movement-actions");
      details.open = true;
      setTimeout(function () {
        const form = document.getElementById(button.dataset.openStock + "-form");
        form.scrollIntoView({behavior: "smooth", block: "center"});
        form.querySelector("select").focus();
      }, 40);
    });
  });
  document.getElementById("notification-button").addEventListener("click", function () {
    const panel = document.getElementById("notification-panel");
    const button = document.getElementById("notification-button");
    const shouldOpen = panel.hidden;
    panel.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
    if (shouldOpen) {
      renderNotifications();
      const firstNotification = panel.querySelector(".notification-item");
      if (firstNotification) firstNotification.focus();
      else document.getElementById("notification-close").focus();
    }
  });
  document.getElementById("notification-close").addEventListener("click", function () {
    closeNotificationPanel(true);
  });
  document.getElementById("notification-panel").addEventListener("click", function (event) {
    const button = event.target.closest("[data-notification-id]");
    if (!button) return;
    const notification = getNotifications().find(function (item) { return item.id === button.dataset.notificationId; });
    if (!notification) {
      closeNotificationPanel(false);
      showToast("Bu bildirim artık güncel değil.", true);
      return;
    }
    closeNotificationPanel(false);
    if (notification.type === "stock") {
      document.getElementById("product-search").value = notification.search;
      document.getElementById("product-category-filter").value = "";
      document.getElementById("product-stock-filter").value = "all";
      productPage = 1;
      document.getElementById("product-filter-panel").open = true;
      renderProducts();
      setPage("products");
      const row = document.querySelector('#product-rows tr[data-product-id="' + Number(notification.productId) + '"]');
      if (row) {
        row.scrollIntoView({behavior: "smooth", block: "center"});
        const detailButton = row.querySelector("[data-edit-product], .product-row-select");
        if (detailButton) detailButton.focus({preventScroll: true});
      }
      return;
    }
    document.getElementById("batch-search").value = notification.search;
    activeExpiryFilter = notification.days < 0 ? "expired" : "near";
    batchPage = 1;
    document.querySelectorAll("[data-expiry-filter]").forEach(function (tab) {
      const active = tab.dataset.expiryFilter === activeExpiryFilter;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderBatches();
    setPage("expiry");
    const row = document.querySelector("#batch-rows tr");
    if (row && !row.classList.contains("empty")) {
      row.scrollIntoView({behavior: "smooth", block: "center"});
      row.setAttribute("tabindex", "-1");
      row.focus({preventScroll: true});
    }
  });
  document.addEventListener("click", function (event) {
    const panel = document.getElementById("notification-panel");
    if (!panel.hidden && !document.getElementById("notification-anchor").contains(event.target)) {
      closeNotificationPanel(false);
    }
  });
  document.addEventListener("keydown", function (event) {
    const panel = document.getElementById("notification-panel");
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      closeNotificationPanel(true);
    }
  });
  document.getElementById("refresh-user-activities").addEventListener("click", async function () {
    try { await loadAdminActivities(); showToast("Kullanıcı işlem kayıtları yenilendi."); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("refresh-admin-activities").addEventListener("click", async function () {
    try { await loadAdminActivities(); showToast("Yönetici işlem kayıtları yenilendi."); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("refresh-report-insights").addEventListener("click", async function () {
    try { await refreshAll(); showToast("Stok analizi güncellendi."); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("generate-ai-insights").addEventListener("click", async function (event) {
    const button = event.currentTarget;
    const status = document.getElementById("ai-report-status");
    button.disabled = true;
    button.textContent = "AI analiz ediyor…";
    document.getElementById("ai-report-result").hidden = true;
    status.hidden = false;
    status.textContent = "Güvenli stok ve hareket özeti OpenAI'a gönderiliyor…";
    try {
      const result = await api("/api/reports/ai-insights", {method: "POST", body: "{}"});
      renderAiReportInsights(result);
      status.textContent = "AI önerileri hazır. Transferler sizin onayınız olmadan yapılmaz.";
      showToast("AI stok önerileri hazır.");
    } catch (error) {
      status.textContent = error.message;
      showToast(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = "AI önerilerini al";
    }
  });
  document.getElementById("billing-plan-cards").addEventListener("click", function (event) {
    const button = event.target.closest("[data-billing-plan]");
    if (!button) return;
    selectedBillingPlan = button.dataset.billingPlan;
    renderBillingPlans();
  });
  document.querySelectorAll("[data-billing-term]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedBillingTerm = Number(button.dataset.billingTerm);
      renderBillingPlans();
    });
  });
  document.getElementById("billing-dealer-select").addEventListener("change", async function () {
    try { await loadBilling(); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("billing-purchase-button").addEventListener("click", async function (event) {
    const button = event.currentTarget;
    button.disabled = true;
    try { await openPaytrCheckout(null, false); }
    catch (error) { showToast(error.message, true); await loadBilling().catch(function () {}); }
    finally { if (billingData && billingData.payment_ready && !billingData.pending_order) button.disabled = false; }
  });
  document.getElementById("billing-resume-button").addEventListener("click", async function (event) {
    const button = event.currentTarget;
    button.disabled = true;
    try { await openPaytrCheckout(button.dataset.paymentId, true); }
    catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  });
  document.getElementById("billing-close-checkout").addEventListener("click", async function () {
    document.getElementById("paytriframe").src = "about:blank";
    document.getElementById("billing-checkout-panel").hidden = true;
    try { await loadBilling(); }
    catch (error) { showToast(error.message, true); }
  });
  window.addEventListener("message", async function (event) {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== "savestock-paytr-return") return;
    document.getElementById("paytriframe").src = "about:blank";
    document.getElementById("billing-checkout-panel").hidden = true;
    showToast("PayTR ödeme dönüşü alındı. Abonelik durumu güvenli bildirimle güncelleniyor.");
    try { await loadBilling(); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("profile-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    try {
      const user = await api("/api/profile", {method: "PATCH", body: JSON.stringify({full_name: document.getElementById("profile-full-name").value})});
      updateUserIdentity(user);
      const refreshes = [loadProfile()];
      if (currentUser.role === "admin") refreshes.push(loadUsers(), loadAdminActivities());
      await Promise.all(refreshes);
      showToast("Profil bilgileri kaydedildi.");
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("password-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.new_password !== values.confirm_password) { showToast("Yeni şifreler aynı değil.", true); return; }
    try {
      await api("/api/profile/password", {method: "POST", body: JSON.stringify({current_password: values.current_password, new_password: values.new_password})});
      form.reset();
      const refreshes = [loadProfile()];
      if (currentUser.role === "admin") refreshes.push(loadAdminActivities());
      await Promise.all(refreshes);
      showToast("Şifreniz güncellendi.");
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("product-search").addEventListener("input", function () { productPage = 1; renderProducts(); });
  ["product-category-filter", "product-stock-filter"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", function () { productPage = 1; renderProducts(); });
  });
  document.getElementById("product-page-previous").addEventListener("click", function () { productPage -= 1; renderProducts(); });
  document.getElementById("product-page-next").addEventListener("click", function () { productPage += 1; renderProducts(); });
  document.querySelectorAll("[data-product-sort]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (productSortKey === button.dataset.productSort) productSortDirection *= -1;
      else { productSortKey = button.dataset.productSort; productSortDirection = 1; }
      productPage = 1;
      renderProducts();
    });
  });
  document.getElementById("select-all-products").addEventListener("change", function (event) {
    visibleProductIds().forEach(function (id) {
      if (event.currentTarget.checked) selectedProductIds.add(id);
      else selectedProductIds.delete(id);
    });
    renderProducts();
  });
  document.getElementById("product-rows").addEventListener("change", function (event) {
    const checkbox = event.target.closest(".product-row-select");
    if (!checkbox) return;
    const id = checkbox.closest("tr").dataset.productId;
    if (checkbox.checked) selectedProductIds.add(id);
    else selectedProductIds.delete(id);
    renderProducts();
  });
  document.getElementById("product-rows").addEventListener("click", function (event) {
    const button = event.target.closest("[data-edit-product]");
    if (button) openProductEditor(button.dataset.editProduct);
    const stockButton = event.target.closest("[data-product-stock]");
    if (!stockButton) return;
    stockButton.closest("details").open = false;
    setPage("movements");
    const form = document.getElementById(stockButton.dataset.productStock + "-form");
    document.getElementById("movement-actions").open = true;
    const productSelect = form.querySelector(".product-select");
    productSelect.value = stockButton.dataset.productId;
    setTimeout(function () {
      form.scrollIntoView({behavior: "smooth", block: "center"});
      productSelect.focus();
    }, 40);
  });
  document.getElementById("clear-product-selection").addEventListener("click", function () {
    selectedProductIds.clear();
    renderProducts();
  });
  document.getElementById("export-selected-products").addEventListener("click", function () {
    const selected = productCatalog.filter(function (product) { return selectedProductIds.has(String(product.id)); });
    if (!selected.length) { showToast("Dışa aktarılacak ürün seçilmedi.", true); return; }
    exportCsv("savestock-secili-urunler.csv", ["Ürün", "Stok Kodu", "Barkod", "Kategori", "Mevcut Stok", "Birim"], selected.map(function (item) { return [item.name, item.sku, item.barcode || "", item.category_name, item.total_quantity, item.unit]; }));
  });
  ["product-form", "product-edit-form"].forEach(function (id) {
    const form = document.getElementById(id);
    form.addEventListener("input", function (event) {
      const field = event.target;
      if (!field.name) return;
      const message = Array.from(form.querySelectorAll("[data-error-for]")).find(function (item) { return item.dataset.errorFor === field.name; });
      if (message) { message.hidden = true; message.textContent = ""; }
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
  });
  document.getElementById("product-edit-close").addEventListener("click", function () { document.getElementById("product-edit-dialog").close(); });
  document.getElementById("product-edit-cancel").addEventListener("click", function () { document.getElementById("product-edit-dialog").close(); });
  document.getElementById("product-edit-dialog").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("show-low-stock-products").addEventListener("click", function () {
    document.getElementById("product-stock-filter").value = "low_stock";
    productPage = 1;
    productFilterPanel.open = true;
    renderProducts();
    setPage("products");
  });
  document.getElementById("barcode-scan-button").addEventListener("click", startBarcodeScanner);
  document.getElementById("barcode-scanner-close").addEventListener("click", closeBarcodeScanner);
  document.getElementById("barcode-scanner-cancel").addEventListener("click", closeBarcodeScanner);
  document.getElementById("barcode-scanner-dialog").addEventListener("cancel", function (event) {
    event.preventDefault();
    closeBarcodeScanner();
  });
  document.getElementById("barcode-scanner-dialog").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) closeBarcodeScanner();
  });
  document.getElementById("batch-search").addEventListener("input", function () { batchPage = 1; renderBatches(); });
  document.getElementById("movement-search").addEventListener("input", renderMovements);
  ["movement-type-filter", "movement-from", "movement-to"].forEach(function (id) { document.getElementById(id).addEventListener("change", renderMovements); });
  document.getElementById("category-search").addEventListener("input", renderCategories);
  document.querySelectorAll("[data-expiry-filter]").forEach(function (button) {
    button.addEventListener("click", function () { activeExpiryFilter = button.dataset.expiryFilter; batchPage = 1; document.querySelectorAll("[data-expiry-filter]").forEach(function (tab) { tab.classList.toggle("active", tab === button); }); renderBatches(); });
  });
  document.getElementById("batch-page-previous").addEventListener("click", function () { batchPage -= 1; renderBatches(); });
  document.getElementById("batch-page-next").addEventListener("click", function () { batchPage += 1; renderBatches(); });
  document.getElementById("product-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    clearProductFormErrors(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = "Kaydediliyor…";
    try {
      await api("/api/products", {method: "POST", body: JSON.stringify(formObject(form))});
      form.reset();
      form.elements.unit.value = "adet";
      form.querySelector(".product-add-options").open = false;
      selectedProductIds.clear();
      try { await refreshAll(); }
      catch (refreshError) {
        showDataLoadError(refreshError);
        showToast("Ürün kaydedildi; ancak liste yenilenemedi.", true);
        return;
      }
      showToast("Ürün kaydedildi.");
    } catch (error) { showProductFormError(form, error); showToast(error.message, true); }
    finally { submit.disabled = false; submit.textContent = "Ürünü kaydet"; }
  });
  document.getElementById("product-edit-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!editingProductId) return;
    clearProductFormErrors(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true; submit.textContent = "Kaydediliyor…";
    try {
      await api("/api/products/" + encodeURIComponent(editingProductId), {method: "PUT", body: JSON.stringify(formObject(form))});
      document.getElementById("product-edit-dialog").close();
      selectedProductIds.clear();
      try { await refreshAll(); }
      catch (refreshError) {
        showDataLoadError(refreshError);
        showToast("Ürün güncellendi; ancak liste yenilenemedi.", true);
        return;
      }
      showToast("Ürün bilgileri güncellendi.");
    } catch (error) { showProductFormError(form, error); showToast(error.message, true); }
    finally { submit.disabled = false; submit.textContent = "Değişiklikleri kaydet"; }
  });
  document.getElementById("category-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    try { await api("/api/categories", {method: "POST", body: JSON.stringify(formObject(form))}); form.reset(); await refreshAll(); showToast("Kategori eklendi."); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("user-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      await api("/api/users", {method: "POST", body: JSON.stringify(formObject(form))});
      form.reset();
      updateDealerSelects();
      await Promise.all([loadUsers(), loadAdminActivities()]);
      showToast("Hesap oluşturuldu.");
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("user-role").addEventListener("change", updateDealerSelects);
  document.getElementById("dealer-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/dealers", {method: "POST", body: JSON.stringify(formObject(form))});
      form.reset();
      await refreshAll();
      showToast("Bayi eklendi. Kullanıcılar ekranından bu bayiye bağlı kullanıcı hesabı oluşturabilirsiniz.");
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("dealer-summary-rows").addEventListener("click", function (event) {
    const row = event.target.closest("[data-dealer-view]");
    if (!row) return;
    selectedDealerId = Number(row.dataset.dealerView);
    renderDealerOverview();
    document.getElementById("dealer-stock-panel").scrollIntoView({behavior: "smooth", block: "start"});
  });
  document.getElementById("dealer-show-all").addEventListener("click", function () {
    selectedDealerId = null;
    renderDealerOverview();
    document.getElementById("dealer-summary-rows").scrollIntoView({behavior: "smooth", block: "center"});
  });
  document.getElementById("dealer-stock-search").addEventListener("input", function (event) {
    dealerStockQuery = event.target.value.trim().toLocaleLowerCase("tr-TR");
    renderDealerOverview();
  });
  document.getElementById("stock-request-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api("/api/stock-requests", {method: "POST", body: JSON.stringify(formObject(form))});
      form.reset();
      form.elements.requested_quantity.value = 1;
      updateDealerSelects();
      await loadStockRequests();
      showToast("Stok talebi oluşturuldu. Yönetici değerlendirdiğinde durumunu burada görebilirsiniz.");
    } catch (error) { showToast(error.message, true); }
  });
  document.querySelector('#stock-request-form [name="product_id"]').addEventListener("change", renderRequestProductStock);
  document.getElementById("request-dealer-select").addEventListener("change", renderRequestProductStock);
  document.getElementById("refresh-stock-requests").addEventListener("click", async function () {
    try { await loadStockRequests(); showToast("Stok talepleri yenilendi."); }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("stock-request-list").addEventListener("change", function (event) {
    const sourceSelect = event.target.closest("[data-request-source]");
    if (!sourceSelect) return;
    const card = sourceSelect.closest("[data-request-card]");
    const quantityInput = card.querySelector("[data-request-quantity]");
    const available = Number(sourceSelect.selectedOptions[0] && sourceSelect.selectedOptions[0].dataset.available || 0);
    const limit = Number(card.dataset.requestLimit || 0);
    const maximum = Math.min(limit, available);
    quantityInput.max = String(maximum);
    quantityInput.value = String(maximum);
  });
  document.getElementById("stock-request-list").addEventListener("click", async function (event) {
    const button = event.target.closest("[data-request-action]");
    if (!button) return;
    const card = button.closest("[data-request-card]");
    const action = button.dataset.requestAction;
    const sourceSelect = card.querySelector("[data-request-source]");
    const quantityInput = card.querySelector("[data-request-quantity]");
    const resolutionNote = card.querySelector("[data-request-note]");
    const payload = {
      action: action,
      source_dealer_id: action === "fulfill" && sourceSelect && sourceSelect.value ? Number(sourceSelect.value) : null,
      fulfilled_quantity: action === "fulfill" && quantityInput ? Number(quantityInput.value) : 0,
      resolution_note: resolutionNote && resolutionNote.value.trim() ? resolutionNote.value.trim() : null
    };
    button.disabled = true;
    try {
      const result = await api("/api/stock-requests/" + button.dataset.requestId + "/resolve", {
        method: "POST", body: JSON.stringify(payload)
      });
      await refreshAll();
      showToast(action === "reject" ? "Stok talebi reddedildi." : (result.status === "fulfilled" ? "Talep karşılandı ve stok transfer edildi." : "Talep kısmen karşılandı ve stok transfer edildi."));
    } catch (error) {
      button.disabled = false;
      showToast(error.message, true);
    }
  });
  document.getElementById("user-rows").addEventListener("click", async function (event) {
    const button = event.target.closest("[data-user-toggle]");
    if (!button) return;
    button.disabled = true;
    try {
      await api("/api/users/" + button.dataset.userToggle, {
        method: "PATCH",
        body: JSON.stringify({is_active: button.dataset.nextActive === "true"})
      });
      await Promise.all([loadUsers(), loadAdminActivities()]);
      showToast(button.dataset.nextActive === "true" ? "Hesap etkinleştirildi." : "Hesabın erişimi kapatıldı.");
    } catch (error) { button.disabled = false; showToast(error.message, true); }
  });
  document.getElementById("inbound-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const result = await submitStockOperation("inbound", form);
      form.reset();
      if (result.queued) showToast("Stok girişi çevrimdışı sıraya alındı.");
      else { await refreshAll(); showToast("Stok girişi kaydedildi."); }
    }
    catch (error) { showToast(error.message, true); }
  });
  document.getElementById("outbound-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const submitted = await submitStockOperation("outbound", form);
      form.reset();
      if (submitted.queued) showToast("Stok çıkışı çevrimdışı sıraya alındı; sunucu bağlantısında stok yeniden doğrulanacak.");
      else {
        await refreshAll();
        showToast("FIFO stok çıkışı tamamlandı · " + submitted.result.allocations.map(function (item) { return item.batch_code + ": " + item.quantity; }).join(", "));
      }
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("adjustment-form").addEventListener("submit", async function (event) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      const submitted = await submitStockOperation("adjustment", form);
      form.reset();
      if (submitted.queued) showToast("Stok düzeltmesi çevrimdışı sıraya alındı; eşitlemede yönetici yetkisi ve mevcut miktar doğrulanacak.");
      else {
        await refreshAll();
        showToast("Lot sayımı kaydedildi · " + submitted.result.previous_quantity + " → " + submitted.result.quantity_on_hand);
      }
    } catch (error) { showToast(error.message, true); }
  });
  document.getElementById("settings-form").addEventListener("submit", function (event) {
    event.preventDefault();
    expiryWarningDays = Math.min(365, Math.max(1, Number(document.getElementById("expiry-warning-days").value) || 30));
    lowStockThreshold = Math.min(1000000, Math.max(1, Number(document.getElementById("low-stock-threshold").value) || 5));
    document.getElementById("expiry-warning-days").value = expiryWarningDays;
    document.getElementById("low-stock-threshold").value = lowStockThreshold;
    localStorage.setItem("savestock-expiry-warning-days", String(expiryWarningDays));
    localStorage.setItem("savestock-low-stock-threshold", String(lowStockThreshold));
    renderAll(); showToast("Stok ve SKT ayarları kaydedildi.");
  });
  document.getElementById("export-products").addEventListener("click", function () {
    exportCsv("savestock-urunler.csv", ["Ürün", "Stok Kodu", "Barkod", "Kategori", "Mevcut Stok", "Birim"], productCatalog.map(function (item) { return [item.name, item.sku, item.barcode || "", item.category_name, item.total_quantity, item.unit]; }));
  });
  document.getElementById("export-movements").addEventListener("click", function () {
    exportCsv("savestock-stok-hareketleri.csv", ["Tarih / Saat", "Bayi", "Hareket", "Ürün", "Lot Kodu", "Miktar", "Açıklama", "İşlemi Yapan", "Rol"], movements.map(function (item) { return [formatDateTime(item.created_at), item.dealer_name || "Merkez Depo", item.is_adjustment ? (item.movement_type === "IN" ? "Düzeltme (+)" : "Düzeltme (−)") : item.movement_type === "IN" ? "Giriş" : "Çıkış", item.product_name, item.batch_code, item.quantity, item.note || "", item.performed_by || "Önceki kayıt", item.performed_by_role === "admin" ? "Yönetici" : item.performed_by_role === "user" ? "Kullanıcı" : "Bilinmiyor"]; }));
  });
  document.getElementById("export-batches").addEventListener("click", function () {
    exportCsv("savestock-skt-takibi.csv", ["Bayi", "Ürün", "Stok Kodu", "Lot Kodu", "SKT", "Kalan Gün", "Miktar", "Birim", "Durum"], batches.map(function (item) { return [item.dealer_name || "Merkez Depo", item.product_name, item.sku, item.batch_code, formatDate(item.expiry_date), daysUntil(item.expiry_date), item.quantity_on_hand, item.unit, statusLabel(batchStatus(item))]; }));
  });
}
document.getElementById("expiry-warning-days").value = expiryWarningDays;
document.getElementById("low-stock-threshold").value = lowStockThreshold;
applyTheme(currentTheme);
setupInstallableApp();
wireAuthEvents();
wireEvents();
initializeAuth();
