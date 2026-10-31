import os
import jwt
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SHOPORA_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "Set the SHOPORA_SECRET_KEY environment variable before starting Shopora."
    )

ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60


def create_access_token(user_id: str, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": user_id,
        "role": role,
        "exp": expires_at,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        SECRET_KEY,
        algorithms=[ALGORITHM],
    )