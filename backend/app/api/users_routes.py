from fastapi import APIRouter, Depends, HTTPException , Response , Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from datetime import datetime, timezone, timedelta
from typing import List

from app.schemas.auth import AuthResponse , UserLogIn , AddUser , UserInfo , UpdateRole , UserPatch
from app.db.database import get_db
from app.db.repositories.users_repo import  UserRepository
from app.utils.jwt import encode_jwt
from app.core.exceptions import InvalidPasswordError , UserNotFindError , JWTTokenDecodeError , JWTTokenGenerateError
from app.api.deps import RoleChecker


router = APIRouter(prefix="/users", tags=["Users"]) 


@router.post("/login", response_model=AuthResponse)
async def login(user_data:UserLogIn , response: Response, db:AsyncSession= Depends(get_db)):
    repo = UserRepository(db)
    try: 
        user = await repo.user_login(**user_data.model_dump())
        token = encode_jwt({
            "sub": str(user.id),
            "role": user.role,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int((datetime.now(timezone.utc) + timedelta(hours=8)).timestamp())
        })

        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            secure=True,
            samesite="strict",
            max_age=28800 
        )
        logger.info(f"User {user.username} , {user.role} successfully logged in")
        return AuthResponse(username=user.username , role=user.role)
    
    except (InvalidPasswordError , UserNotFindError) as e:
        raise HTTPException(status_code=401, 
                            detail="Incorrect password or username!")
    except (JWTTokenGenerateError, JWTTokenDecodeError) as e:
        logger.error("Error creating jwt token")
        raise HTTPException(status_code=500, detail="Internal server error")
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    


@router.post("/workers",dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def create_worker(user_data:AddUser, db:AsyncSession= Depends(get_db)):
     user_repo = UserRepository(db)
     try:
         await  user_repo.add_worker(**user_data.model_dump())
         return {"success": True}
     except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
     


@router.post("/admins",dependencies=[Depends(RoleChecker(["superadmin"]))])
async def create_admin(user_data:AddUser, db:AsyncSession= Depends(get_db)):
     user_repo = UserRepository(db)
     try:
         await  user_repo.add_admin(**user_data.model_dump())
         return {"success": True}
     except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
     


@router.get("/", response_model=List[UserInfo],dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def get_all_users(db:AsyncSession= Depends(get_db)):
    user_repo = UserRepository(db)
    try:
        users = await user_repo.get_all_users()
        return users
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    

@router.get("/workers", response_model=List[UserInfo],dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def get_all_workers(db:AsyncSession= Depends(get_db)):
    user_repo = UserRepository(db)
    try:
        users = await user_repo.get_all_workers()
        return users
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    

@router.get("/admins", response_model=List[UserInfo],dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def get_all_admins(db:AsyncSession= Depends(get_db)):
    user_repo = UserRepository(db)
    try:
        users = await user_repo.get_all_admins()
        return users
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")
    

@router.get("/search", response_model=UserInfo, dependencies=[Depends(RoleChecker(["admin", "superadmin"]))])
async def search_user_by_name(username: str, db: AsyncSession = Depends(get_db)):
    user_repo = UserRepository(db)
    try:
        user = await user_repo.get_by_name(username=username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during user search")
        raise HTTPException(status_code=500, detail="Internal server error")
    

@router.get("/me")
async def get_me(
    user_info: dict = Depends(RoleChecker(["worker", "admin", "superadmin"]))):
    return user_info



@router.post("/logout")
async def logout(response: Response):
    try:
        response.delete_cookie(
            key="access_token",
            httponly=True,
            secure=True,
            samesite="strict"
        )
        return {"detail": "Successfully logged out"}
    except Exception as e:
        logger.exception(f"Unexpected error during logout: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    


@router.delete("/delete_worker")
async def delete_worker(user_id: int, db: AsyncSession = Depends(get_db),
                        user_info: dict = Depends(RoleChecker(["admin", "superadmin"]))):
    user_repo = UserRepository(db)
    try:
        user = await user_repo.get_by_id(user_id)
        if not user or user.role != "worker":
            raise HTTPException(status_code=404, detail="Worker not found")
        await user_repo.delete_user(user_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/delete_admin")
async def delete_admin(user_id: int, db: AsyncSession = Depends(get_db),
                       user_info: dict = Depends(RoleChecker(["superadmin"]))):
    user_repo = UserRepository(db)
    try:
        user = await user_repo.get_by_id(user_id)
        if not user or user.role != "admin":
            raise HTTPException(status_code=404, detail="Admin not found")
        await user_repo.delete_user(user_id)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/change_role", response_model=UserInfo)
async def change_role(user_id: int, role_data: UpdateRole, db: AsyncSession = Depends(get_db),
                      user_info: dict = Depends(RoleChecker(["superadmin"]))):
    user_repo = UserRepository(db)
    try:
        if role_data.role not in ["worker", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        user = await user_repo.get_by_id(user_id)
        if not user or user.role not in ["worker", "admin"]:
            raise HTTPException(status_code=404, detail="User not found")
        updated_user = await user_repo.update_role(user_id, role_data.role)
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.patch("/update_info", response_model=UserInfo)
async def update_info(user_id: int, user_data: UserPatch, db: AsyncSession = Depends(get_db),
                      user_info: dict = Depends(RoleChecker(["admin", "superadmin"]))):
    user_repo = UserRepository(db)
    try:
        user = await user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        updated_user = await user_repo.update_user_info(user_id, **user_data.model_dump(exclude_unset=True))
        return updated_user
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")