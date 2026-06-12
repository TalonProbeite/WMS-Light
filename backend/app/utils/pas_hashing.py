from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError


ph = PasswordHasher()

def get_hash_pass(password: str) -> str:
    return ph.hash(password)

def match_password(hash_pas: str, pas: str) -> bool:
    try:
        return ph.verify(hash_pas, pas)
    except VerifyMismatchError:
        return False