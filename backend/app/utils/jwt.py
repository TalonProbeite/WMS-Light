import jwt

from app.core.exceptions import JWTTokenDecodeError , JWTTokenGenerateError
from app.core.config import settings


def encode_jwt(attributes:dict,
               secret_key:str=settings.jwt.SECRET_KEY,
               algorithm:str= settings.jwt.algorithm, 
                 )->str:
    try:
    
        jwt_token  = jwt.encode(attributes , secret_key, algorithm)
        return jwt_token
    except Exception as e:
        raise JWTTokenGenerateError() from e
    

def decode_jwt(token:str,
               secret_key:str=settings.jwt.SECRET_KEY,  
               algorithm:str = settings.jwt.algorithm ,
               )->dict:

    try:
        return jwt.decode(token, secret_key, algorithms=[algorithm])
    except Exception as e:
        raise JWTTokenDecodeError()  from e