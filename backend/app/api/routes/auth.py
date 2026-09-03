from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidRegistrationResponse

from app.api.deps import get_current_user, get_db
from app.models.app_user import AppUser
from app.schemas.auth import AuthOptionsResponse, AuthStatus, AuthVerifyRequest, RegisterOptionsRequest, UpdateProfileRequest
from app.services import auth_service

router = APIRouter()


def _set_session_cookie(response: Response, user_id: int) -> None:
    token = auth_service.create_session_token(user_id)
    response.set_cookie(
        key=auth_service.SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )


@router.get("/status", response_model=AuthStatus)
def auth_status(request: Request, db: Session = Depends(get_db)) -> AuthStatus:
    auth_service.cleanup_expired_challenges(db)
    registered = auth_service.has_registered_passkeys(db)
    token = request.cookies.get(auth_service.SESSION_COOKIE)
    authenticated = False
    display_name = None

    if token:
        try:
            user_id = auth_service.decode_session_token(token)
            owner = db.get(AppUser, user_id)
            if owner:
                authenticated = True
                display_name = owner.display_name
        except Exception:
            authenticated = False

    return AuthStatus(registered=registered, authenticated=authenticated, display_name=display_name)


@router.post("/register/options", response_model=AuthOptionsResponse)
def register_options(payload: RegisterOptionsRequest, db: Session = Depends(get_db)) -> AuthOptionsResponse:
    try:
        options_payload, _ = auth_service.create_registration_options(db, display_name=payload.display_name.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthOptionsResponse(**options_payload)


@router.post("/register/add-passkey/options", response_model=AuthOptionsResponse)
def add_passkey_options(
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthOptionsResponse:
    del current_user
    try:
        options_payload, _ = auth_service.create_additional_passkey_options(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthOptionsResponse(**options_payload)


@router.post("/register/add-passkey/verify", response_model=AuthStatus)
def add_passkey_verify(
    payload: AuthVerifyRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthStatus:
    del current_user
    try:
        owner = auth_service.verify_registration(db, challenge_id=payload.challengeId, credential=payload.credential)
    except (ValueError, InvalidRegistrationResponse) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthStatus(registered=True, authenticated=True, display_name=owner.display_name)


@router.post("/register/verify", response_model=AuthStatus)
def register_verify(payload: AuthVerifyRequest, response: Response, db: Session = Depends(get_db)) -> AuthStatus:
    try:
        owner = auth_service.verify_registration(db, challenge_id=payload.challengeId, credential=payload.credential)
    except (ValueError, InvalidRegistrationResponse) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _set_session_cookie(response, owner.id)
    return AuthStatus(registered=True, authenticated=True, display_name=owner.display_name)


@router.post("/login/options", response_model=AuthOptionsResponse)
def login_options(db: Session = Depends(get_db)) -> AuthOptionsResponse:
    try:
        payload = auth_service.create_login_options(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AuthOptionsResponse(**payload)


@router.post("/login/verify", response_model=AuthStatus)
def login_verify(payload: AuthVerifyRequest, response: Response, db: Session = Depends(get_db)) -> AuthStatus:
    try:
        owner = auth_service.verify_login(db, challenge_id=payload.challengeId, credential=payload.credential)
    except (ValueError, InvalidAuthenticationResponse) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    _set_session_cookie(response, owner.id)
    return AuthStatus(registered=True, authenticated=True, display_name=owner.display_name)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(auth_service.SESSION_COOKIE, path="/")


@router.get("/me", response_model=AuthStatus)
def me(current_user: AppUser = Depends(get_current_user)) -> AuthStatus:
    return AuthStatus(registered=True, authenticated=True, display_name=current_user.display_name)


@router.patch("/profile", response_model=AuthStatus)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuthStatus:
    user = auth_service.update_display_name(db, current_user, payload.display_name.strip())
    return AuthStatus(registered=True, authenticated=True, display_name=user.display_name)
