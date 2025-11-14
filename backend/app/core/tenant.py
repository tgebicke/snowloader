"""Tenant utilities for multi-tenant isolation."""
from sqlalchemy.orm import Session
from app.api.models.database import User, Tenant
from typing import Optional


def get_user_tenant_id(user: User) -> int:
    """Get tenant_id from user."""
    return user.tenant_id


def get_or_create_default_tenant(db: Session, tenant_name: str = "Default Tenant") -> Tenant:
    """Get or create a default tenant."""
    tenant = db.query(Tenant).filter(Tenant.name == tenant_name).first()
    if not tenant:
        tenant = Tenant(name=tenant_name)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant


def ensure_user_has_tenant(user: User, db: Session) -> None:
    """Ensure user has a tenant assigned. If not, assign default tenant."""
    if not user.tenant_id:
        tenant = get_or_create_default_tenant(db)
        user.tenant_id = tenant.id
        db.commit()
        db.refresh(user)

