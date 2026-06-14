from fastapi import APIRouter, Depends, HTTPException , Response , Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger
from datetime import datetime, timezone, timedelta

from app.schemas.auth import AuthResponse , UserLogIn
from app.db.database import get_db
from app.db.repositories.users_repo import  UserRepository
from app.utils.jwt import encode_jwt
from app.core.exceptions import InvalidPasswordError , UserNotFindError , JWTTokenDecodeError , JWTTokenGenerateError


router = APIRouter(prefix="/users", tags=["Auth"]) 


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
    except (JWTTokenGenerateError, JWTTokenDecodeError):
        logger.error("Error creating jwt token")
        raise HTTPException(status_code=500, detail="Internal server error")
    except Exception as e:
        logger.exception(f"Unexpected error: {e.__cause__}")
        raise HTTPException(status_code=500, detail="Internal server error")