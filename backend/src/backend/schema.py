from pydantic import BaseModel, ConfigDict, Field


class CategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float


class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str
    price: float = Field(ge=0)


class ProductResponse(ProductCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    categories: list[CategorySummary] = Field(default_factory=list)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1)


class CategoryResponse(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    products: list[ProductSummary] = Field(default_factory=list)


class RelationshipResponse(BaseModel):
    message: str
