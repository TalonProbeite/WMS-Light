from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from typing import List

from app.schemas.categories import CategoriesResponse, CategoryCreate
from app.db.database import get_db
from app.db.repositories.categories_repo import CategoriesRepository
from app.core.exceptions import CategoriesNotEmptyError
from app.api.deps import RoleChecker

router = APIRouter(prefix="/categories", tags=["Categories"]) 

@router.get("/", dependencies=[Depends(RoleChecker(["admin", "superadmin", "worker"]))], response_model=List[CategoriesResponse])
async def get_categories(db: AsyncSession = Depends(get_db)):
    repo = CategoriesRepository(db)
    try:
        result = await repo.get_all_cat()
        return result
    except Exception:
        logger.exception("Unexpected error in get_categories")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/create", dependencies=[Depends(RoleChecker(["admin", "superadmin", "worker"]))], response_model=CategoriesResponse)
async def create_categories(cat_data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    repo = CategoriesRepository(db)
    try:
        existing = await repo.get_by_name(cat_data.name)
        if existing:
            raise HTTPException(status_code=400, detail="Category already exists")
        result = await repo.add_categories(**cat_data.model_dump())
        return result
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in create_categories")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{cat_name}", dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def delete_categories(cat_name: str, db: AsyncSession = Depends(get_db)):
    cat_repo = CategoriesRepository(db)
    try:
        res = await cat_repo.delete_cat_by_name(cat_name=cat_name)
        if res == 0:
            raise HTTPException(status_code=404, detail="Category not found")
        return {"Records successfully deleted": res}
    except CategoriesNotEmptyError:
        raise HTTPException(status_code=400, detail="There are still products in this category!")
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in delete_categories")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{cat_id}", dependencies=[Depends(RoleChecker(["admin", "superadmin"]))], response_model=CategoriesResponse)
async def update_category(cat_id: int, cat_data: CategoryCreate, db: AsyncSession = Depends(get_db)):
    repo = CategoriesRepository(db)
    try:
        updated_cat = await repo.update_category(cat_id=cat_id, name=cat_data.name, description=cat_data.description)
        if not updated_cat:
            raise HTTPException(status_code=404, detail="Category not found")
        return updated_cat
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in update_category")
        raise HTTPException(status_code=500, detail="Internal server error")