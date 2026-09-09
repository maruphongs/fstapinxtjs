from backend.old.database import Base, engine, get_db
from backend.old.model import itemDB
from backend.old.schema import itemCreate, itemResponse
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Item API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Item API is running"}


@app.post("/items", response_model=itemResponse)
async def add_item(item: itemCreate, db: Session = Depends(get_db)):
    db_item = itemDB(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@app.get("/items", response_model=list[itemResponse])
async def get_items(db: Session = Depends(get_db)):
    return db.query(itemDB).all()


@app.get("/items/{iid}", response_model=itemResponse)
async def get_item(iid: int, db: Session = Depends(get_db)):
    db_item = db.query(itemDB).filter(itemDB.id == iid).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return db_item


@app.delete("/items/{iid}")
async def delete_item(iid: int, db: Session = Depends(get_db)):
    db_item = db.query(itemDB).filter(itemDB.id == iid).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(db_item)
    db.commit()
    return {"message": "Successfully deleted."}


@app.put("/items/{iid}", response_model=itemResponse)
async def update_item(iid: int, item_data: itemCreate, db: Session = Depends(get_db)):
    db_item = db.query(itemDB).filter(itemDB.id == iid).first()
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in item_data.model_dump().items():
        setattr(db_item, key, value)

    db.commit()
    db.refresh(db_item)
    return db_item