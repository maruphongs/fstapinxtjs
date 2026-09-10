from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    message: str


class RelationshipResponse(BaseModel):
    message: str


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
