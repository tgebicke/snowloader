"""Migration script to add tenant_id column to existing users table."""
from sqlalchemy import text
from app.db.session import engine


def add_tenant_id_to_users():
    """Add tenant_id column to users table if it doesn't exist."""
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='tenant_id'
        """))
        
        if result.fetchone():
            print("Column 'tenant_id' already exists in 'users' table")
        else:
            # Add the column
            print("Adding 'tenant_id' column to 'users' table...")
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN tenant_id INTEGER REFERENCES tenants(id)
            """))
            conn.commit()
            print("Successfully added 'tenant_id' column")
        
        # Create index if it doesn't exist
        try:
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users(tenant_id)
            """))
            conn.commit()
            print("Index on tenant_id created/verified")
        except Exception as e:
            print(f"Note: Index creation: {e}")


if __name__ == "__main__":
    add_tenant_id_to_users()
    print("\nMigration complete!")

