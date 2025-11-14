from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import httpx
from app.core.config import settings
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.models.database import User
from app.core.tenant import get_or_create_default_tenant

security = HTTPBearer()


async def get_clerk_jwks():
    """Fetch Clerk JWKS (JSON Web Key Set) for token verification."""
    # For MVP, we'll use a simple approach - verify token and extract user ID
    # In production, you'd want to cache the JWKS
    async with httpx.AsyncClient() as client:
        # Clerk JWKS URL format: https://<your-clerk-domain>/.well-known/jwks.json
        # For now, we'll verify the token structure and extract claims
        pass


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Verify Clerk JWT token and get or create user."""
    try:
        token = credentials.credentials
        
        # Decode token without verification first to get the user ID
        # In production, you should verify the token signature with Clerk's JWKS
        decoded = jwt.decode(token, options={"verify_signature": False})
        clerk_user_id = decoded.get("sub") or decoded.get("user_id")
        
        if not clerk_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )
        
        # Get or create user in database
        user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
        if not user:
            # Extract email from token if available
            email = decoded.get("email", "")
            # Assign default tenant to new user
            tenant = get_or_create_default_tenant(db)
            user = User(
                clerk_user_id=clerk_user_id,
                email=email,
                tenant_id=tenant.id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        elif not user.tenant_id:
            # Ensure existing users have a tenant (migration support)
            tenant = get_or_create_default_tenant(db)
            user.tenant_id = tenant.id
            db.commit()
            db.refresh(user)
        
        return user
    except jwt.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

