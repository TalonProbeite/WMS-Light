from fastapi import FastAPI 
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager


from app.core.config import settings
from app.db.database import init_db
from app.core.logger import setup_logging
from app.api.users_routes import router as UsersRouter
from app.api.products_routes import router as ProductRouter
from app.api.transaction_routes import router as TransactionRouter
from app.api.categories_routes import router as CategoriesRouter
from backend.app.api.dashboard_routes import router as DashboardRouter
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield
    

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan
)




app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(UsersRouter)
app.include_router(ProductRouter)
app.include_router(TransactionRouter)
app.include_router(CategoriesRouter)
app.include_router(DashboardRouter)