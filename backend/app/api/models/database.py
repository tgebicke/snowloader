from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.base import Base


class ConnectionType(str, enum.Enum):
    S3 = "s3"
    SNOWFLAKE = "snowflake"


class IngestionType(str, enum.Enum):
    ONE_TIME = "one_time"
    SNOWPIPE = "snowpipe"


class PipelineStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    ERROR = "error"


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    connections = relationship("Connection", back_populates="user")
    pipelines = relationship("Pipeline", back_populates="user")


class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(Enum(ConnectionType), nullable=False)
    encrypted_credentials = Column(Text, nullable=False)  # JSON encrypted
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="connections")


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    ingestion_type = Column(Enum(IngestionType), nullable=False)
    s3_connection_id = Column(Integer, ForeignKey("connections.id"), nullable=False)
    snowflake_connection_id = Column(Integer, ForeignKey("connections.id"), nullable=False)
    s3_path = Column(String, nullable=False)  # File path or prefix for Snowpipe
    target_database = Column(String, nullable=False)
    target_schema = Column(String, nullable=False)
    target_table = Column(String, nullable=False)
    snowpipe_name = Column(String, nullable=True)  # For Snowpipe pipelines
    status = Column(Enum(PipelineStatus), default=PipelineStatus.ACTIVE)
    config = Column(JSON, nullable=True)  # Additional configuration
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="pipelines")
    runs = relationship("PipelineRun", back_populates="pipeline")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"), nullable=False)
    status = Column(Enum(RunStatus), default=RunStatus.PENDING)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    rows_loaded = Column(Integer, nullable=True)
    run_metadata = Column(JSON, nullable=True)  # Additional run metadata

    pipeline = relationship("Pipeline", back_populates="runs")

