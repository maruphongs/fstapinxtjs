from pydantic import BaseModel


class item(BaseModel):
    id: int
    name: str
    description: str
    price: float


class itemCreate(BaseModel):
    name: str
    description: str
    price: float


class itemResponse(item):
    class Config:
        from_attributes = True
