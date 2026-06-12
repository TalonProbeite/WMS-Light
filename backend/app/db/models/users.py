from app.db.database import Base
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")
    last_login = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    phone = Column(String(20), nullable=True, unique=True)
    
    transactions = relationship("Transactions", back_populates="users") 

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"