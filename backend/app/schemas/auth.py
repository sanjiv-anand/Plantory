from pydantic import BaseModel, Field


class AuthStatus(BaseModel):
    registered: bool
    authenticated: bool
    display_name: str | None = None


class AuthOptionsResponse(BaseModel):
    challengeId: str
    options: dict


class AuthVerifyRequest(BaseModel):
    challengeId: str
    credential: dict


class RegisterOptionsRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
