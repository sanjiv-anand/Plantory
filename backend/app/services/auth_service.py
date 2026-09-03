import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)

from app.core.config import settings
from app.models.app_user import AppUser
from app.models.auth_challenge import AuthChallenge
from app.models.passkey import PasskeyCredential

SESSION_COOKIE = "lilylog_session"
CHALLENGE_TTL = timedelta(minutes=5)


def _challenge_base64url(challenge: bytes | str) -> str:
    if isinstance(challenge, bytes):
        return bytes_to_base64url(challenge)
    return challenge


def has_registered_passkeys(db: Session) -> bool:
    return db.scalar(select(func.count(PasskeyCredential.id))) > 0


def get_owner(db: Session) -> AppUser | None:
    return db.scalar(select(AppUser).limit(1))


def ensure_owner(db: Session, *, display_name: str | None = None) -> AppUser:
    owner = get_owner(db)
    if owner:
        if display_name and owner.display_name != display_name:
            owner.display_name = display_name
            db.add(owner)
            db.commit()
            db.refresh(owner)
        return owner
    if not display_name:
        raise ValueError("Display name is required")
    owner = AppUser(display_name=display_name)
    db.add(owner)
    db.commit()
    db.refresh(owner)
    return owner


def update_display_name(db: Session, user: AppUser, display_name: str) -> AppUser:
    user.display_name = display_name
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _store_challenge(db: Session, *, challenge: str, purpose: str, user_id: int | None) -> str:
    challenge_id = secrets.token_urlsafe(16)
    db.add(
        AuthChallenge(
            id=challenge_id,
            challenge=challenge,
            purpose=purpose,
            user_id=user_id,
            expires_at=datetime.now(UTC) + CHALLENGE_TTL,
        )
    )
    db.commit()
    return challenge_id


def _consume_challenge(db: Session, challenge_id: str, purpose: str) -> AuthChallenge:
    row = db.get(AuthChallenge, challenge_id)
    if not row or row.purpose != purpose:
        raise ValueError("Invalid challenge")
    if row.expires_at < datetime.now(UTC):
        db.delete(row)
        db.commit()
        raise ValueError("Challenge expired")
    db.delete(row)
    db.commit()
    return row


def create_registration_options(db: Session, *, display_name: str, allow_additional: bool = False) -> tuple[dict, str]:
    if has_registered_passkeys(db) and not allow_additional:
        raise ValueError("Passkey already registered")

    owner = ensure_owner(db, display_name=display_name)
    existing = db.scalars(select(PasskeyCredential).where(PasskeyCredential.user_id == owner.id)).all()
    options = generate_registration_options(
        rp_id=settings.webauthn_rp_id,
        rp_name=settings.webauthn_rp_name,
        user_id=str(owner.id).encode(),
        user_name=owner.display_name,
        user_display_name=owner.display_name,
        exclude_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id)) for item in existing
        ]
        if allow_additional
        else None,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key="preferred",
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        timeout=300_000,
    )
    challenge = _challenge_base64url(options.challenge)
    challenge_id = _store_challenge(db, challenge=challenge, purpose="register", user_id=owner.id)
    payload = {
        "challengeId": challenge_id,
        "options": {
            "rp": {"name": options.rp.name, "id": options.rp.id},
            "user": {
                "id": bytes_to_base64url(options.user.id),
                "name": options.user.name,
                "displayName": options.user.display_name,
            },
            "challenge": challenge,
            "pubKeyCredParams": [{"type": p.type, "alg": p.alg} for p in options.pub_key_cred_params],
            "timeout": options.timeout,
            "excludeCredentials": [
                {"type": "public-key", "id": item.credential_id}
                for item in existing
            ]
            if allow_additional
            else [],
            "authenticatorSelection": {
                "residentKey": options.authenticator_selection.resident_key,
                "userVerification": options.authenticator_selection.user_verification,
            },
            "attestation": options.attestation,
        },
    }
    return payload, challenge_id


def create_additional_passkey_options(db: Session) -> tuple[dict, str]:
    if not has_registered_passkeys(db):
        raise ValueError("Register the first passkey before adding another")
    owner = get_owner(db)
    if not owner:
        raise ValueError("Owner not found")
    return create_registration_options(db, display_name=owner.display_name, allow_additional=True)


def verify_registration(db: Session, *, challenge_id: str, credential: dict) -> AppUser:
    challenge = _consume_challenge(db, challenge_id, "register")
    owner = db.get(AppUser, challenge.user_id)
    if not owner:
        raise ValueError("Owner not found")

    verification = verify_registration_response(
        credential=credential,
        expected_challenge=base64url_to_bytes(challenge.challenge),
        expected_rp_id=settings.webauthn_rp_id,
        expected_origin=settings.webauthn_origin,
        require_user_verification=True,
    )

    db.add(
        PasskeyCredential(
            user_id=owner.id,
            credential_id=bytes_to_base64url(verification.credential_id),
            public_key=verification.credential_public_key,
            sign_count=verification.sign_count,
            transports=",".join(credential.get("response", {}).get("transports") or []),
        )
    )
    db.commit()
    db.refresh(owner)
    return owner


def create_login_options(db: Session) -> dict:
    credentials = db.scalars(select(PasskeyCredential)).all()
    if not credentials:
        raise ValueError("No passkey registered")

    options = generate_authentication_options(
        rp_id=settings.webauthn_rp_id,
        allow_credentials=[
            PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id))
            for item in credentials
        ],
        user_verification=UserVerificationRequirement.REQUIRED,
        timeout=300_000,
    )
    challenge = _challenge_base64url(options.challenge)
    challenge_id = _store_challenge(db, challenge=challenge, purpose="login", user_id=None)
    return {
        "challengeId": challenge_id,
        "options": {
            "challenge": challenge,
            "timeout": options.timeout,
            "rpId": options.rp_id,
            "allowCredentials": [
                {"type": "public-key", "id": item.credential_id, "transports": item.transports.split(",") if item.transports else []}
                for item in credentials
            ],
            "userVerification": options.user_verification,
        },
    }


def verify_login(db: Session, *, challenge_id: str, credential: dict) -> AppUser:
    challenge = _consume_challenge(db, challenge_id, "login")
    credential_id = credential.get("id")
    if not credential_id:
        raise ValueError("Missing credential id")

    stored = db.scalar(select(PasskeyCredential).where(PasskeyCredential.credential_id == credential_id))
    if not stored:
        raise ValueError("Unknown credential")

    verification = verify_authentication_response(
        credential=credential,
        expected_challenge=base64url_to_bytes(challenge.challenge),
        expected_rp_id=settings.webauthn_rp_id,
        expected_origin=settings.webauthn_origin,
        credential_public_key=stored.public_key,
        credential_current_sign_count=stored.sign_count,
        require_user_verification=True,
    )

    stored.sign_count = verification.new_sign_count
    db.add(stored)
    db.commit()

    owner = db.get(AppUser, stored.user_id)
    if not owner:
        raise ValueError("Owner not found")
    return owner


def create_session_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(UTC) + timedelta(days=settings.session_days),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> int:
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    return int(payload["sub"])


def cleanup_expired_challenges(db: Session) -> None:
    db.execute(delete(AuthChallenge).where(AuthChallenge.expires_at < datetime.now(UTC)))
    db.commit()
