from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from loguru import logger



engine = create_async_engine(
    settings.db.url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)


SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with SessionLocal() as db:
        yield db


async def init_db():
    from app.db import models 
    from app.db.repositories.users_repo import UserRepository
    
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("The database has been initialized.")
        
    
    async with SessionLocal() as session:
        repo = UserRepository(session)
        admin, status = await repo.add_superadmin()
        if status == "created":
            logger.info("The super admin is initialized with standard environment arguments.")
        elif status == "existing":
            logger.info("Super admin already exists")