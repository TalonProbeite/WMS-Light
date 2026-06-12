from app.db.database import Base
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

class Products(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(50), nullable=False, unique=True)
    qr_code_uuid = Column(String(64), nullable=False, unique=True)
    description = Column(String)

  
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    
    category = relationship("Categories", back_populates="products")
    stock = relationship("Stock", back_populates="product", uselist=False)
    transactions = relationship("Transactions", back_populates="product")

    def __repr__(self):
        return f"<Product(id={self.id}, name={self.name}, sku={self.sku})>"