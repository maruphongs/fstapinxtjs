from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)


class UserLogin(BaseModel):
    username: str
    password: str


class UserRegister(UserBase):
    password: str = Field(min_length=4)


class UserCreate(UserRegister):
    role: str = "user"
    is_active: bool = True


class UserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=4)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str | None = None
    role: str | None = None
