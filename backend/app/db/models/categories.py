from app.db.database import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

class Categories(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String)

    products = relationship("Products", back_populates="category")

    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name})>"