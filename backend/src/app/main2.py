from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import Column, Float, Integer, String, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ProductDB(Base):
    __tablename__ = "Products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Float, nullable=False)


class Product(BaseModel):
    id: int
    name: str
    description: str
    price: float


class ProductCreate(BaseModel):
    name: str
    description: str
    price: float


class ProductResponse(Product):
    class Config:
        from_attributes = True


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Product API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Product API is running"}


@app.post("/products", response_model=ProductResponse)
async def add_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = ProductDB(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.get("/products", response_model=list[ProductResponse])
async def get_products(db: Session = Depends(get_db)):
    return db.query(ProductDB).all()


@app.get("/products/{pid}", response_model=ProductResponse)
async def get_product(pid: int, db: Session = Depends(get_db)):
    db_product = db.query(ProductDB).filter(ProductDB.id == pid).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product


@app.delete("/products/{pid}")
async def delete_product(pid: int, db: Session = Depends(get_db)):
    db_product = db.query(ProductDB).filter(ProductDB.id == pid).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(db_product)
    db.commit()
    return {"message": "Successfully deleted."}


@app.put("/products/{pid}", response_model=ProductResponse)
async def update_product(pid: int, product_data: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(ProductDB).filter(ProductDB.id == pid).first()
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    for key, value in product_data.model_dump().items():
        setattr(db_product, key, value)

    db.commit()
    db.refresh(db_product)
    return db_product