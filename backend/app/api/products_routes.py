from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from typing import List, Optional

from app.schemas.products import ProductCrate, ProductResponse, ProductDetailedResponse
from app.db.database import get_db
from app.db.repositories.products_repo import ProductsRepository
from app.api.deps import RoleChecker

router = APIRouter(prefix="/products", tags=["Products"])

@router.post("/create",
             dependencies=[Depends(RoleChecker(["admin", "superadmin", "worker"]))],
             response_model=ProductResponse)
async def create_product(product_data: ProductCrate, db: AsyncSession = Depends(get_db)):
    repo = ProductsRepository(db=db)
    try:
        product = await repo.create_product_with_stock(**product_data.model_dump())
        return product
    except Exception as e:
        logger.exception(f"Unexpected error!")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/single", response_model=ProductDetailedResponse)
async def get_single_product(
    product_id: Optional[int] = None,
    name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["worker", "admin", "superadmin"]))
):
    if product_id is None and name is None:
        raise HTTPException(status_code=400, detail="Either product_id or name must be provided")
    
    repo = ProductsRepository(db=db)
    try:
        product = await repo.get_product_detailed(product_id=product_id, name=name)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error in get_single_product")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[ProductDetailedResponse])
async def get_all_products(
    limit: int = 20,
    offset: int = 0,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    category_name: Optional[str] = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["worker", "admin", "superadmin"]))
):
    if limit > 100:
        limit = 100

    if sort_by not in ["name", "sku", "quantity", "stock_updated_at"]:
        sort_by = "name"

    if sort_order not in ["asc", "desc"]:
        sort_order = "asc"

    repo = ProductsRepository(db=db)
    try:
        return await repo.get_all_products_detailed(
            limit=limit,
            offset=offset,
            search=search,
            category_id=category_id,
            category_name=category_name,
            sort_by=sort_by,
            sort_order=sort_order
        )
    except Exception:
        logger.exception("Unexpected error in get_all_products")
        raise HTTPException(status_code=500, detail="Internal server error")
    


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    user_info: dict = Depends(RoleChecker(["admin", "superadmin"]))
):
    repo = ProductsRepository(db=db)
    try:
        deleted_count = await repo.delete_product_by_id(prod_id=product_id)
        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"success": True, "deleted_records": deleted_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in delete_product: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")