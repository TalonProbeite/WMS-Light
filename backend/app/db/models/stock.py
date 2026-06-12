from app.db.database import Base
from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

class Stock(Base):
    __tablename__ = "stock"

    id = Column(Integer, primary_key=True, index=True)
   
    quantity = Column(Integer, nullable=False, default=0) 
    update_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)
    product = relationship("Products", back_populates="stock")

    def __repr__(self):
        return f"<Stock(id={self.id}, product_id={self.product_id}, quantity={self.quantity})>"