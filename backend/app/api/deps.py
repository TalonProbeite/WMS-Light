from fastapi import Request, HTTPException, status, Depends
from app.utils.jwt import decode_jwt
from app.core.exceptions import JWTTokenDecodeError


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Вы не авторизованы (кука отсутствует)"
        )
    
    try:
        payload = decode_jwt(token)
        return payload
    except JWTTokenDecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid or expired tokenInvalid or expired token!"
        )


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)):

        user_role = current_user.get("role")
        
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have sufficient permissions to perform this operation!"
            )
        
        return current_user