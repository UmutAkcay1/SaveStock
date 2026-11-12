(function () {
  const authView = document.getElementById("auth-view");
  const dashboardView = document.getElementById("dashboard-view");
  const authForm = document.getElementById("auth-form");
  const menuToggle = document.getElementById("menu-toggle");
  const controlSidebar = document.getElementById("control-sidebar");
  const menuBackdrop = document.getElementById("menu-backdrop");
  const menuClose = document.getElementById("menu-close");
  let setupRequired = false;
  let overviewLoaded = false;

  function setMenuOpen(open, restoreFocus) {
    controlSidebar.classList.toggle("is-open", open);
    menuBackdrop.hidden = !open;
    controlSidebar.setAttribute("aria-hidden", String(!open));
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    if (!open && restoreFocus !== false && !menuToggle.hidden) menuToggle.focus();
  }

  const plannedPages = {
    status: {
      title: "Durum ve Uyarılar",
      description: "SaveStock servislerinin ve yedekleme durumunun takibi.",
      features: ["Uygulama ve veritabanı erişilebilirlik durumu", "Son yedekleme zamanı ve doğrulama sonucu", "Sorunlarda anlaşılır yönetim uyarıları"]
    },
    customers: {
      title: "Müşteri / Bayiler",
      description: "SaveStock kullanan bayi ve müşterilerin toplu görünümü.",
      features: ["Bayi başına kullanıcı, ürün ve stok özeti", "Abonelik durumu ve son etkinlik", "Müşteri parolalarını ve hassas hareket verilerini göstermeyen görünüm"]
    },
    backups: {
      title: "Yedekleme",
      description: "Veri yedeklerini takip etme ve güvenle doğrulama.",
      features: ["Yeni yedek oluşturma ve geçmiş yedekleri listeleme", "Yedek bütünlüğünü denetleme", "Geri yükleme işlemlerinde ek onay ve güvenlik adımları"]
    },
    subscriptions: {
      title: "Abonelikler",
      description: "Ürün aboneliklerini ve ödeme takibini tek yerden izleme.",
      features: ["Aktif, yaklaşan ve süresi dolmuş abonelikler", "Ödeme durumu ve yenileme tarihleri", "Yaklaşan yenilemeler için uyarılar"]
    },
    audit: {
      title: "Yönetici Kayıtları",
      description: "Control üzerinden yapılan yönetim işlemlerinin denetim izi.",
      features: ["İşlemi yapan geliştirici ve zaman bilgisi", "Değişiklik ve yönetim işlemi geçmişi", "Güvenlik incelemeleri için aranabilir kayıtlar"]
    },
    tools: {
      title: "Geliştirici Araçları",
      description: "SaveStock kurulumunu anlamaya ve bakımını yapmaya yardımcı araçlar.",
      features: ["Uygulama sürümü ve yapılandırma kontrolleri", "Bakım modu ve kontrollü özellik anahtarları", "Hataları araştırmak için güvenli teknik bilgiler"]
    }
  };

  const overviewElements = [
    document.getElementById("overview-content")
  ];

  function formatDateTime(value) {
    if (!value) return "Kayıt yok";
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  async function request(path, options) {
    const response = await fetch(path, Object.assign({
      headers: {"Content-Type": "application/json"},
      credentials: "same-origin"
    }, options || {}));
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.detail || "İstek tamamlanamadı.");
    return result;
  }

  function renderAlerts(alerts) {
    const list = document.getElementById("attention-list");
    list.replaceChildren();
    if (!alerts.length) {
      const card = document.createElement("article");
      card.className = "attention-card attention-clear";
      const icon = document.createElement("span");
      icon.className = "attention-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = "Şu an öncelikli uyarı yok";
      const message = document.createElement("p");
      message.textContent = "Geciken ödeme veya yaklaşan abonelik görünmüyor.";
      content.append(title, message);
      card.append(icon, content);
      list.appendChild(card);
      return;
    }
    alerts.forEach(function (alert) {
      const card = document.createElement("article");
      card.className = "attention-card attention-" + alert.level;
      const icon = document.createElement("span");
      icon.className = "attention-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = alert.level === "urgent" ? "!" : alert.level === "warning" ? "◷" : "◇";
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = alert.title;
      const message = document.createElement("p");
      message.textContent = alert.message;
      content.append(title, message);
      card.append(icon, content);
      list.appendChild(card);
    });
  }

  function showAuthentication(requiredSetup) {
    setupRequired = requiredSetup;
    setMenuOpen(false, false);
    menuToggle.hidden = true;
    authView.hidden = false;
    dashboardView.hidden = true;
    document.getElementById("auth-eyebrow").textContent = requiredSetup ? "İLK KURULUM · BU BİLGİSAYAR" : "YALNIZCA GELİŞTİRİCİLER";
    document.getElementById("auth-title").textContent = requiredSetup ? "Geliştirici hesabı oluştur" : "SaveStock Control";
    document.getElementById("auth-copy").textContent = requiredSetup
      ? "Bu yerel yönetim uygulamasına erişecek tek geliştirici hesabını oluşturun."
      : "SaveStock ürününün durumunu güvenli yönetim alanından takip edin.";
    document.getElementById("auth-password").autocomplete = requiredSetup ? "new-password" : "current-password";
    document.getElementById("confirm-label").hidden = !requiredSetup;
    document.getElementById("auth-confirm").required = requiredSetup;
    document.getElementById("setup-note").hidden = !requiredSetup;
    document.getElementById("network-warning").hidden =
      document.getElementById("network-label").textContent !== "Aynı ağdan erişim açık";
    document.getElementById("auth-submit").textContent = requiredSetup ? "Hesabı oluştur" : "Giriş yap";
    document.getElementById("auth-error").hidden = true;
    authForm.reset();
  }

  async function showDashboard(username) {
    authView.hidden = true;
    dashboardView.hidden = false;
    menuToggle.hidden = false;
    document.getElementById("sidebar-developer-name").textContent = username;
    document.querySelector(".developer-avatar").textContent = username.trim().slice(0, 2).toLocaleUpperCase("tr-TR");
    overviewLoaded = false;
    await loadOverview();
  }

  async function loadOverview() {
    const errorBox = document.getElementById("overview-error");
    const button = document.getElementById("refresh-button");
    button.disabled = true;
    errorBox.hidden = true;
    document.getElementById("overview-status-title").textContent = "Bağlantı denetleniyor";
    document.getElementById("overview-summary").textContent = "Güncel ürün durumu alınıyor…";
    try {
      const data = await request("/api/overview");
      const counts = data.counts;
      document.getElementById("overview-status-title").textContent = "Sistem çalışıyor";
      document.getElementById("overview-status-symbol").textContent = "✓";
      document.getElementById("overview-status-symbol").classList.remove("status-error");
      document.getElementById("count-active-subscriptions").textContent = Number(counts.active_subscriptions).toLocaleString("tr-TR");
      document.getElementById("count-expiring-subscriptions").textContent = Number(counts.expiring_subscriptions).toLocaleString("tr-TR");
      document.getElementById("count-overdue-payments").textContent = Number(counts.overdue_payments).toLocaleString("tr-TR");
      document.getElementById("overview-latest-activity").textContent = formatDateTime(data.latest_activity_at);
      document.getElementById("overview-updated-at").textContent = "Son kontrol " + formatDateTime(data.generated_at);
      errorBox.hidden = true;
      const alerts = Array.isArray(data.alerts) ? data.alerts : [];
      renderAlerts(alerts);
      document.getElementById("overview-summary").textContent = alerts.length
        ? alerts.length + " konu kontrolünüzü bekliyor."
        : "Şu an öncelikli bir uyarı yok; ürününüz normal çalışıyor.";
      overviewLoaded = true;
    } catch (error) {
      if (error.message.includes("geliştirici hesabıyla giriş")) {
        showAuthentication(false);
        return;
      }
      document.getElementById("overview-status-title").textContent = "Bağlantı kurulamadı";
      document.getElementById("overview-status-symbol").textContent = "!";
      document.getElementById("overview-status-symbol").classList.add("status-error");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  authForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const submit = document.getElementById("auth-submit");
    const errorBox = document.getElementById("auth-error");
    const password = document.getElementById("auth-password").value;
    submit.disabled = true;
    errorBox.hidden = true;
    try {
      if (setupRequired) {
        if (password !== document.getElementById("auth-confirm").value) {
          throw new Error("Parolalar eşleşmiyor.");
        }
        await request("/api/setup", {
          method: "POST",
          body: JSON.stringify({
            username: document.getElementById("auth-username").value,
            password: password
          })
        });
        showAuthentication(false);
        document.getElementById("auth-error").textContent = "Hesap oluşturuldu. Şimdi giriş yapabilirsiniz.";
        document.getElementById("auth-error").classList.add("success-message");
        document.getElementById("auth-error").hidden = false;
        return;
      }
      const session = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: document.getElementById("auth-username").value,
          password: password
        })
      });
      await showDashboard(session.username);
    } catch (error) {
      errorBox.classList.remove("success-message");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  document.getElementById("logout-button").addEventListener("click", async function () {
    try {
      await request("/api/logout", {method: "POST"});
      const session = await request("/api/session");
      setMenuOpen(false, false);
      menuToggle.hidden = true;
      showAuthentication(session.setup_required);
    } catch (error) {
      const errorBox = document.getElementById("overview-error");
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    }
  });
  document.getElementById("refresh-button").addEventListener("click", loadOverview);
  menuClose.addEventListener("click", function () {
    setMenuOpen(false);
  });
  menuToggle.addEventListener("click", function () {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  menuBackdrop.addEventListener("click", function () {
    setMenuOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
      setMenuOpen(false);
    }
  });
  document.querySelectorAll(".menu-item").forEach(function (item) {
    item.addEventListener("click", function () {
      setMenuOpen(false);
      const page = item.dataset.page;
      document.querySelectorAll(".menu-item").forEach(function (menuItem) {
        menuItem.classList.remove("active");
        menuItem.removeAttribute("aria-current");
      });
      item.classList.add("active");
      item.setAttribute("aria-current", "page");
      const plannedPage = document.getElementById("planned-page");
      if (page === "overview") {
        document.getElementById("page-title").textContent = "Genel Bakış";
        document.getElementById("page-description").textContent = "Bugün dikkat etmeniz gerekenler ve SaveStock ürününüzün durumu.";
        plannedPage.hidden = true;
        overviewElements.forEach(function (element) { element.hidden = false; });
        if (!overviewLoaded) loadOverview();
        return;
      }
      const content = plannedPages[page];
      if (!content) return;
      document.getElementById("page-title").textContent = content.title;
      document.getElementById("page-description").textContent = content.description;
      overviewElements.forEach(function (element) { element.hidden = true; });
      plannedPage.replaceChildren();
      const badge = document.createElement("span");
      badge.className = "planned-badge";
      badge.textContent = "PLANLANDI";
      const heading = document.createElement("h2");
      heading.textContent = "Bu bölüm geliştirme planında";
      const introduction = document.createElement("p");
      introduction.className = "planned-intro";
      introduction.textContent = "Bu ekranda yer alması planlanan özellikler:";
      const list = document.createElement("ul");
      content.features.forEach(function (feature) {
        const row = document.createElement("li");
        row.textContent = feature;
        list.appendChild(row);
      });
      plannedPage.append(badge, heading, introduction, list);
      plannedPage.hidden = false;
    });
  });

  request("/api/session").then(function (session) {
    if (session.network_access) {
      document.getElementById("network-label").textContent = "Aynı ağdan erişim açık";
    }
    if (session.authenticated) return showDashboard(session.username);
    showAuthentication(session.setup_required);
  }).catch(function (error) {
    showAuthentication(false);
    const errorBox = document.getElementById("auth-error");
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  });
}());
