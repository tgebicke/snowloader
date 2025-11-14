"""Migration script to assign existing users to default tenant."""
from app.db.session import SessionLocal
from app.api.models.database import User, Tenant
from app.core.tenant import get_or_create_default_tenant


def migrate_users_to_tenants():
    """Assign all users without a tenant to the default tenant."""
    db = SessionLocal()
    try:
        # Get or create default tenant
        tenant = get_or_create_default_tenant(db, "Default Tenant")
        
        # Find users without tenant_id
        users_without_tenant = db.query(User).filter(User.tenant_id == None).all()
        
        if users_without_tenant:
            print(f"Found {len(users_without_tenant)} users without tenant assignment")
            for user in users_without_tenant:
                user.tenant_id = tenant.id
                print(f"  - Assigned user {user.email} (ID: {user.id}) to tenant '{tenant.name}'")
            
            db.commit()
            print(f"\nSuccessfully assigned {len(users_without_tenant)} users to default tenant")
        else:
            print("All users already have tenant assignments")
        
        # Show summary
        total_users = db.query(User).count()
        users_with_tenant = db.query(User).filter(User.tenant_id.isnot(None)).count()
        print(f"\nSummary: {users_with_tenant}/{total_users} users have tenant assignments")
        
    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_users_to_tenants()

