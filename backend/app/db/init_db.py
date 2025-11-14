"""Initialize database tables."""
from app.db.base import Base
from app.db.session import engine
# Import all models to ensure they're registered with Base.metadata
from app.api.models.database import (
    User, Connection, Pipeline, PipelineRun,
    Tenant, Project, Contract
)


def init_db():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created successfully!")

