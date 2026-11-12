import argparse
import base64
import binascii
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import subprocess
import tempfile

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from sqlalchemy.engine import make_url

from app.database import DATABASE_URL

MAGIC = b"SSBK1"
CHUNK_SIZE = 1024 * 1024


def encryption_key() -> bytes:
    value = os.getenv("BACKUP_ENCRYPTION_KEY", "")
    try:
        key = base64.urlsafe_b64decode(value.encode("ascii"))
    except (ValueError, UnicodeEncodeError, binascii.Error) as error:
        raise RuntimeError("BACKUP_ENCRYPTION_KEY geçerli bir URL-safe Base64 anahtarı olmalı.") from error
    if len(key) != 32:
        raise RuntimeError("BACKUP_ENCRYPTION_KEY 32 baytlık AES anahtarı içermeli.")
    return key


def encrypt_file(source: Path, destination: Path, key: bytes) -> None:
    nonce = os.urandom(12)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    with source.open("rb") as input_file, destination.open("wb+") as output_file:
        output_file.write(MAGIC + nonce + (b"\0" * 16))
        while chunk := input_file.read(CHUNK_SIZE):
            output_file.write(encryptor.update(chunk))
        output_file.write(encryptor.finalize())
        output_file.seek(len(MAGIC) + len(nonce))
        output_file.write(encryptor.tag)


def decrypt_file(source: Path, destination: Path, key: bytes) -> None:
    with source.open("rb") as input_file:
        header = input_file.read(len(MAGIC) + 12 + 16)
        if len(header) != len(MAGIC) + 28 or not header.startswith(MAGIC):
            raise RuntimeError("Yedek dosyası tanınmıyor veya bozuk.")
        nonce = header[len(MAGIC):len(MAGIC) + 12]
        tag = header[len(MAGIC) + 12:]
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        invalid_tag = False
        with destination.open("wb") as output_file:
            while chunk := input_file.read(CHUNK_SIZE):
                output_file.write(decryptor.update(chunk))
            try:
                output_file.write(decryptor.finalize())
            except InvalidTag:
                invalid_tag = True
        if invalid_tag:
            destination.unlink(missing_ok=True)
            raise RuntimeError("Yedek doğrulanamadı; anahtar yanlış veya dosya bozuk.")


def postgres_environment() -> tuple[list[str], dict[str, str]]:
    url = make_url(DATABASE_URL)
    if not url.drivername.startswith("postgresql"):
        raise RuntimeError("Yedekleme ve geri yükleme PostgreSQL veritabanı gerektirir.")
    if not url.database:
        raise RuntimeError("DATABASE_URL bir PostgreSQL veritabanı adı içermeli.")

    args = []
    env = os.environ.copy()
    if url.host:
        args.extend(["--host", url.host])
    if url.port:
        args.extend(["--port", str(url.port)])
    if url.username:
        args.extend(["--username", url.username])
    if url.password:
        env["PGPASSWORD"] = url.password
    for name in ("sslmode", "sslrootcert", "sslcert", "sslkey", "connect_timeout"):
        value = url.query.get(name)
        if value:
            env[f"PG{name.upper()}"] = str(value)
    return args + ["--dbname", url.database], env


def run_tool(arguments: list[str], env: dict[str, str]) -> None:
    try:
        subprocess.run(arguments, env=env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError as error:
        raise RuntimeError(f"Gerekli PostgreSQL aracı bulunamadı: {arguments[0]}") from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError(f"{arguments[0]} başarısız oldu (çıkış kodu {error.returncode}). Bağlantı ve veritabanı izinlerini kontrol edin.") from error


def create_backup(directory: Path) -> Path:
    key = encryption_key()
    directory.mkdir(parents=True, exist_ok=True)
    pg_args, env = postgres_environment()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = directory / f"savestock-{timestamp}.dump.enc"
    with tempfile.TemporaryDirectory(prefix="savestock-backup-") as temp_dir:
        dump_path = Path(temp_dir) / "database.dump"
        run_tool(
            ["pg_dump", *pg_args, "--format=custom", "--no-owner", "--no-privileges", "--file", str(dump_path)],
            env,
        )
        encrypted_temp = directory / f".{destination.name}.tmp"
        try:
            encrypt_file(dump_path, encrypted_temp, key)
            os.replace(encrypted_temp, destination)
        finally:
            encrypted_temp.unlink(missing_ok=True)

    retention_days = max(1, int(os.getenv("BACKUP_RETENTION_DAYS", "30")))
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    for backup in directory.glob("savestock-*.dump.enc"):
        if backup == destination:
            continue
        modified = datetime.fromtimestamp(backup.stat().st_mtime, timezone.utc)
        if modified < cutoff:
            backup.unlink()
    return destination


def verify_backup(source: Path) -> None:
    key = encryption_key()
    with tempfile.TemporaryDirectory(prefix="savestock-verify-") as temp_dir:
        dump_path = Path(temp_dir) / "database.dump"
        decrypt_file(source, dump_path, key)
        run_tool(["pg_restore", "--list", str(dump_path)], os.environ.copy())


def restore_backup(source: Path) -> None:
    key = encryption_key()
    pg_args, env = postgres_environment()
    with tempfile.TemporaryDirectory(prefix="savestock-restore-") as temp_dir:
        dump_path = Path(temp_dir) / "database.dump"
        decrypt_file(source, dump_path, key)
        run_tool(
            [
                "pg_restore", *pg_args, "--clean", "--if-exists", "--single-transaction",
                "--no-owner", "--no-privileges", str(dump_path),
            ],
            env,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="SaveStock PostgreSQL yedekleme aracı")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("generate-key", help="Yedek şifreleme anahtarı üret")
    backup_parser = commands.add_parser("backup", help="Şifreli yedek oluştur ve eski yedekleri temizle")
    backup_parser.add_argument("--directory", type=Path, default=Path(os.getenv("BACKUP_DIRECTORY", "backups")))
    verify_parser = commands.add_parser("verify", help="Yedeğin şifresini ve PostgreSQL arşivini doğrula")
    verify_parser.add_argument("file", type=Path)
    restore_parser = commands.add_parser("restore", help="Yedeği mevcut veritabanına geri yükle")
    restore_parser.add_argument("file", type=Path)
    restore_parser.add_argument("--confirm", action="store_true", help="Mevcut veritabanındaki verileri değiştirmeyi onayla")
    args = parser.parse_args()

    try:
        if args.command == "generate-key":
            from cryptography.fernet import Fernet

            print(Fernet.generate_key().decode("ascii"))
        elif args.command == "backup":
            print(create_backup(args.directory))
        elif args.command == "verify":
            verify_backup(args.file)
            print("Yedek doğrulandı.")
        else:
            if not args.confirm:
                parser.error("Geri yükleme veritabanındaki verileri değiştirir; --confirm açıkça eklenmeli.")
            restore_backup(args.file)
            print("Geri yükleme tamamlandı.")
    except RuntimeError as error:
        parser.exit(1, f"Hata: {error}\n")


if __name__ == "__main__":
    main()
