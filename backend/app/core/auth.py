import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.base import User

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${pwd_hash}"


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        salt, expected_hash = hashed_password.split("$", 1)
        calc_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
        return hmac.compare_digest(calc_hash, expected_hash)
    except Exception:
        return False


def create_access_token(user_id: str, role: str, expires_in_seconds: int = 86400 * 7) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds,
    }
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature_input = f"{encoded_header}.{encoded_payload}"
    signature = hmac.new(settings.secret_key.encode(), signature_input.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{signature_input}.{encoded_signature}"


def decode_access_token(token: str) -> dict | None:
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return None
        encoded_header, encoded_payload, encoded_signature = parts
        signature_input = f"{encoded_header}.{encoded_payload}"
        expected_sig = hmac.new(settings.secret_key.encode(), signature_input.encode(), hashlib.sha256).digest()
        
        # Add padding if needed
        rem = len(encoded_signature) % 4
        padded_signature = encoded_signature + ("=" * (4 - rem) if rem else "")
        actual_sig = base64.urlsafe_b64decode(padded_signature.encode())
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None
        
        rem_p = len(encoded_payload) % 4
        padded_payload = encoded_payload + ("=" * (4 - rem_p) if rem_p else "")
        payload = json.loads(base64.urlsafe_b64decode(padded_payload.encode()).decode())
        
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere iniciar sesión para realizar esta acción",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o expirada. Por favor inicia sesión de nuevo.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_sanctioned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ACCOUNT_SANCTIONED||{user.id}||{user.sanction_reason or 'Sin motivo especificado'}"
        )
    return user


def get_optional_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User | None:
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        return None
    return db.get(User, payload["sub"])


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador para realizar esta acción",
        )
    return user
