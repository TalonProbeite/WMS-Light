from fastapi import Request, HTTPException, Depends
from app.utils.jwt import decode_jwt  

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = decode_jwt(token)
        user_id: str = payload.get("sub")
        user_role: str = payload.get("role")
        
        if not user_id or not user_role:
            raise HTTPException(status_code=401, detail="Invalid token payload")
            
        return {"id": int(user_id), "role": user_role}
        
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles


    async def __call__(self, current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        return current_user