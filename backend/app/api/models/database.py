from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, ForeignKey, JSON, Index, UniqueConstraint
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


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    users = relationship("User", back_populates="tenant")
    projects = relationship("Project", back_populates="tenant")
    contracts = relationship("Contract", back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="users")
    connections = relationship("Connection", back_populates="user")
    pipelines = relationship("Pipeline", back_populates="user")
    contracts = relationship("Contract", back_populates="user")


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


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    organization = Column(String, nullable=False)
    department = Column(String, nullable=False)
    project = Column(String, nullable=False)
    data_governance = Column(JSON, nullable=True)  # Contains owners, stakeholders, stewards
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="projects")
    contracts = relationship("Contract", back_populates="project")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'organization', 'department', 'project', name='uq_project_org_dept_proj'),
        Index('idx_project_tenant_org', 'tenant_id', 'organization'),
    )


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)  # Optional reference to project
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    organization = Column(String, nullable=False)
    department = Column(String, nullable=False)
    project_name = Column(String, nullable=False)  # Denormalized for filtering
    source = Column(String, nullable=False)
    contract_data = Column(JSON, nullable=False)  # Full contract structure
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant", back_populates="contracts")
    user = relationship("User", back_populates="contracts")
    project = relationship("Project", back_populates="contracts")

    __table_args__ = (
        Index('idx_contract_tenant_org', 'tenant_id', 'organization'),
        Index('idx_contract_tenant_dept', 'tenant_id', 'department'),
        Index('idx_contract_tenant_project', 'tenant_id', 'project_name'),
        Index('idx_contract_tenant_source', 'tenant_id', 'source'),
    )

