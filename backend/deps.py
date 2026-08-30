from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.auth_utils import decode_access_token
from backend.models import User

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    return user

def require_role(*allowed_roles):
    def role_checker(user: User = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return user
    return role_checker

def require_school_access(school_id: int, user: User = Depends(get_current_user)):
    """
    A school-scoped user (school_id set on their token/user record) may only touch their own school_id.
    A platform-level user (school_id is null) may access any school.
    """
    if user.school_id is not None and user.school_id != school_id:
        raise HTTPException(status_code=403, detail="Access denied to this school")
    return user
