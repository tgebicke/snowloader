"""Initialize database tables."""
from app.db.base import Base
from app.db.session import engine
from app.api.models.database import User, Connection, Pipeline, PipelineRun


def init_db():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created successfully!")

