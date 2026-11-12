import os
import binascii

from cryptography.fernet import Fernet
from sqlalchemy.engine import make_url


def environment() -> str:
    return os.getenv("SAVESTOCK_ENV", "development").strip().lower()


def cookie_secure() -> bool:
    configured = os.getenv("SAVESTOCK_COOKIE_SECURE")
    if configured is not None:
        return configured.strip().lower() == "true"
    return environment() == "production"


def allowed_hosts() -> list[str]:
    return [
        host.strip()
        for host in os.getenv("SAVESTOCK_ALLOWED_HOSTS", "").split(",")
        if host.strip()
    ]


def validate_runtime_configuration() -> None:
    if environment() != "production":
        return

    problems: list[str] = []
    if not cookie_secure():
        problems.append("SAVESTOCK_COOKIE_SECURE must be true")
    hosts = allowed_hosts()
    if not hosts or "*" in hosts:
        problems.append("SAVESTOCK_ALLOWED_HOSTS must list the public host names")
    if not os.getenv("SAVESTOCK_SECRET_KEY") or len(os.environ["SAVESTOCK_SECRET_KEY"]) < 32:
        problems.append("SAVESTOCK_SECRET_KEY must contain at least 32 characters")

    database_url = make_url(os.environ.get("DATABASE_URL", "sqlite://"))
    if not database_url.drivername.startswith("postgresql"):
        problems.append("production DATABASE_URL must use PostgreSQL")

    backup_key = os.getenv("BACKUP_ENCRYPTION_KEY", "")
    try:
        Fernet(backup_key.encode("ascii"))
    except (ValueError, UnicodeEncodeError, binascii.Error):
        problems.append("BACKUP_ENCRYPTION_KEY must be a valid Fernet key")

    if problems:
        raise RuntimeError("Invalid production configuration: " + "; ".join(problems))
