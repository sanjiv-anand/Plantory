from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.app_user import AppUser
from app.services import auth_service

__all__ = ["get_db", "Session", "get_current_user", "require_auth_if_registered"]


def get_current_user(request: Request, db: Session = Depends(get_db)) -> AppUser:
    if not auth_service.has_registered_passkeys(db):
        owner = auth_service.ensure_owner(db)
        return owner

    token = request.cookies.get(auth_service.SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        user_id = auth_service.decode_session_token(token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc

    user = db.get(AppUser, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
