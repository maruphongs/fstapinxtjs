from sqlalchemy import Column, Float, Integer, String

from backend.old.database import Base


class itemDB(Base):
    __tablename__ = "Items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    