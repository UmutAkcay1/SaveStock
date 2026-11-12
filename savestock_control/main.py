import hashlib
import hmac
import ipaddress
import json
import logging
import os
import secrets
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import and_, func, or_, select, text

from app.database import SessionLocal
from app.models import (
    Batch,
    BillingPayment,
    BillingSubscription,
    Category,
    Dealer,
    Product,
    User,
    UserActivity,
)

logger = logging.getLogger("savestock.control")
STATIC_DIR = Path(__file__).resolve().parent / "static"
SESSION_COOKIE = "savestock_control_session"
SESSION_TTL_SECONDS = 60 * 60
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_ATTEMPT_LIMIT = 10
PASSWORD_ITERATIONS = 600_000
_sessions: dict[str, tuple[str, float]] = {}
_login_attempts: dict[str, tuple[int, float]] = {}
_session_lock = Lock()

app = FastAPI(
    title="SaveStock Control",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def control_home() -> Path:
    configured = os.getenv("SAVESTOCK_CONTROL_HOME")
    if configured:
        return Path(configured).expanduser()
    local_app_data = os.getenv("LOCALAPPDATA")
    base = Path(local_app_data) if local_app_data else Path.home()
    return base / "SaveStockControl"


def read_config() -> dict | None:
    path = control_home() / "control.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, json.JSONDecodeError) as error:
        logger.exception("control_config_read_failed")
        raise HTTPException(status_code=500, detail="Control ayarları okunamadı.") from error


def configured_networks() -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    value = os.getenv("SAVESTOCK_CONTROL_ALLOWED_NETWORK", "").strip()
    if not value:
        return []
    try:
        return [ipaddress.ip_network(network.strip(), strict=False) for network in value.split(",") if network.strip()]
    except ValueError as error:
        logger.exception("control_allowed_network_invalid")
        raise HTTPException(status_code=500, detail="Control yerel ağ ayarı geçersiz.") from error


def configured_hosts() -> set[str]:
    values = os.getenv("SAVESTOCK_CONTROL_ALLOWED_HOSTS", "")
    return {"localhost", "127.0.0.1", "::1", *(host.strip().casefold() for host in values.split(",") if host.strip())}


def require_local_request(request: Request) -> None:
    client = request.client
    if client is None:
        raise HTTPException(status_code=403, detail="Bu uygulamaya yalnızca bu bilgisayardan erişilebilir.")
    host = (request.url.hostname or "").rstrip(".").casefold()
    if host not in configured_hosts():
        raise HTTPException(status_code=403, detail="Control paneli için izin verilmeyen sunucu adresi.")
    try:
        client_ip = ipaddress.ip_address(client.host)
    except ValueError:
        raise HTTPException(status_code=403, detail="Bu uygulamaya yalnızca izin verilen ağdan erişilebilir.")
    if client_ip.is_loopback:
        return
    if not any(client_ip.version == network.version and client_ip in network for network in configured_networks()):
        raise HTTPException(status_code=403, detail="Bu uygulamaya yalnızca izin verilen yerel ağdan erişilebilir.")


def require_local_setup(request: Request) -> None:
    client = request.client
    try:
        is_loopback = client is not None and ipaddress.ip_address(client.host).is_loopback
    except ValueError:
        is_loopback = False
    if not is_loopback:
        raise HTTPException(status_code=403, detail="İlk geliştirici hesabı yalnızca bu bilgisayardan kurulabilir.")


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != str(request.base_url).rstrip("/"):
        raise HTTPException(status_code=403, detail="İstek kaynağı doğrulanamadı.")


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)


def client_key(request: Request, username: str) -> str:
    remote = request.client.host if request.client else "unknown"
    return remote


def active_session(request: Request) -> str | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = time.monotonic()
    with _session_lock:
        session = _sessions.get(token_hash)
        if session is None:
            return None
        if session[1] <= now:
            del _sessions[token_hash]
            return None
        _sessions[token_hash] = (session[0], now + SESSION_TTL_SECONDS)
        return session[0]


def require_session(request: Request) -> str:
    require_local_request(request)
    username = active_session(request)
    if username is None:
        raise HTTPException(status_code=401, detail="Devam etmek için geliştirici hesabıyla giriş yapın.")
    return username


@app.middleware("http")
async def security_headers(request: Request, call_next):
    try:
        require_local_request(request)
    except HTTPException as error:
        response = JSONResponse(status_code=error.status_code, content={"detail": error.detail})
        response.headers["Cache-Control"] = "no-store"
        return response
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    )
    return response


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/session")
def get_session(request: Request):
    username = active_session(request)
    return {
        "authenticated": username is not None,
        "username": username,
        "setup_required": read_config() is None,
        "network_access": bool(configured_networks()),
    }


@app.post("/api/setup")
async def setup_developer(request: Request):
    require_local_setup(request)
    require_same_origin(request)
    if read_config() is not None:
        raise HTTPException(status_code=409, detail="İlk geliştirici hesabı zaten oluşturulmuş.")
    try:
        payload = await request.json()
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Geçerli bir JSON isteği gönderin.") from error
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Kullanıcı adı ve parola gerekli.")
    username = payload.get("username", "")
    password = payload.get("password", "")
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=422, detail="Kullanıcı adı ve parola gerekli.")
    username = username.strip()
    if not 3 <= len(username) <= 64:
        raise HTTPException(status_code=422, detail="Kullanıcı adı 3–64 karakter olmalı.")
    if len(password) < 14 or len(password) > 256:
        raise HTTPException(status_code=422, detail="Parola en az 14, en fazla 256 karakter olmalı.")
    salt = secrets.token_bytes(32)
    config = {
        "username": username,
        "salt": salt.hex(),
        "password_hash": password_digest(password, salt).hex(),
    }
    path = control_home() / "control.json"
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8") as config_file:
            json.dump(config, config_file)
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail="Geliştirici hesabı eşzamanlı olarak oluşturuldu.") from error
    except OSError as error:
        logger.exception("control_config_write_failed")
        raise HTTPException(status_code=500, detail="Geliştirici ayarları kaydedilemedi.") from error
    return {"status": "created", "message": "Geliştirici hesabı oluşturuldu. Şimdi giriş yapabilirsiniz."}


@app.post("/api/login")
async def login(request: Request, response: Response):
    require_same_origin(request)
    try:
        payload = await request.json()
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Geçerli bir JSON isteği gönderin.") from error
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Kullanıcı adı ve parola gerekli.")
    username = payload.get("username", "")
    password = payload.get("password", "")
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=422, detail="Kullanıcı adı ve parola gerekli.")
    key = client_key(request, username)
    now = time.monotonic()
    with _session_lock:
        previous = _login_attempts.get(key)
        attempts = previous[0] if previous and now - previous[1] < LOGIN_WINDOW_SECONDS else 0
        if attempts >= LOGIN_ATTEMPT_LIMIT:
            raise HTTPException(status_code=429, detail="Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.")
        _login_attempts[key] = (attempts + 1, previous[1] if attempts and previous else now)
    config = read_config()
    valid = False
    if config is not None:
        try:
            salt = bytes.fromhex(config["salt"])
            expected_hash = bytes.fromhex(config["password_hash"])
            valid = (
                hmac.compare_digest(username.casefold(), config["username"].casefold())
                and hmac.compare_digest(password_digest(password, salt), expected_hash)
            )
        except (KeyError, ValueError, TypeError) as error:
            logger.exception("control_config_invalid")
            raise HTTPException(status_code=500, detail="Control hesap ayarları geçersiz.") from error
    if not valid:
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya parola hatalı.")
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with _session_lock:
        _sessions[token_hash] = (config["username"], now + SESSION_TTL_SECONDS)
        _login_attempts.pop(key, None)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
    return {"status": "ok", "username": config["username"]}


@app.post("/api/logout")
def logout(request: Request, response: Response):
    require_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with _session_lock:
            _sessions.pop(token_hash, None)
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="strict")
    return {"status": "ok"}


@app.get("/api/overview")
def overview(request: Request):
    require_session(request)
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            today = date.today()
            renewal_cutoff = today + timedelta(days=30)
            active_subscription_filter = BillingSubscription.is_active.is_(True)
            counts = {
                "products": db.scalar(select(func.count(Product.id))) or 0,
                "categories": db.scalar(select(func.count(Category.id))) or 0,
                "dealers": db.scalar(select(func.count(Dealer.id))) or 0,
                "users": db.scalar(select(func.count(User.id))) or 0,
                "active_users": db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0,
                "stock_units": db.scalar(select(func.coalesce(func.sum(Batch.quantity_on_hand), 0))) or 0,
                "subscriptions": db.scalar(select(func.count(BillingSubscription.id))) or 0,
                "active_subscriptions": db.scalar(
                    select(func.count(BillingSubscription.id)).where(
                        active_subscription_filter,
                        or_(
                            BillingSubscription.expires_at.is_(None),
                            BillingSubscription.expires_at >= today,
                        ),
                    )
                ) or 0,
                "expired_subscriptions": db.scalar(
                    select(func.count(BillingSubscription.id)).where(
                        active_subscription_filter,
                        BillingSubscription.expires_at < today,
                    )
                ) or 0,
                "expiring_subscriptions": db.scalar(
                    select(func.count(BillingSubscription.id)).where(
                        active_subscription_filter,
                        BillingSubscription.expires_at >= today,
                        BillingSubscription.expires_at <= renewal_cutoff,
                    )
                ) or 0,
                "overdue_payments": db.scalar(
                    select(func.count(BillingPayment.id)).where(
                        or_(
                            BillingPayment.status == "failed",
                            and_(
                                BillingPayment.status == "pending",
                                BillingPayment.due_date < today,
                            ),
                        )
                    )
                ) or 0,
            }
            latest_activity = db.scalar(select(func.max(UserActivity.created_at)))
    except Exception as error:
        logger.exception("control_overview_failed")
        raise HTTPException(
            status_code=503,
            detail="SaveStock veritabanına bağlanılamadı. Ana uygulamanın veritabanı ayarlarını ve durumunu kontrol edin.",
        ) from error
    alerts = []
    if counts["overdue_payments"]:
        alerts.append({
            "key": "overdue-payments",
            "level": "urgent",
            "title": "Ödeme takibi gerekiyor",
            "message": f'{counts["overdue_payments"]} ödeme gecikmiş veya başarısız durumda.',
            "count": counts["overdue_payments"],
        })
    if counts["expired_subscriptions"]:
        alerts.append({
            "key": "expired-subscriptions",
            "level": "warning",
            "title": "Süresi dolmuş abonelikler var",
            "message": f'{counts["expired_subscriptions"]} aktif işaretli aboneliğin bitiş tarihi geçmiş.',
            "count": counts["expired_subscriptions"],
        })
    if counts["expiring_subscriptions"]:
        alerts.append({
            "key": "expiring-subscriptions",
            "level": "attention",
            "title": "Abonelik yenilemeleri yaklaşıyor",
            "message": f'Önümüzdeki 30 günde {counts["expiring_subscriptions"]} aboneliğin süresi doluyor.',
            "count": counts["expiring_subscriptions"],
        })
    return {
        "app": "SaveStock",
        "status": "ready",
        "generated_at": datetime.now(UTC),
        "latest_activity_at": latest_activity,
        "counts": counts,
        "alerts": alerts,
    }
