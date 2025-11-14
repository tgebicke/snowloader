"""Pydantic models for ingestion contract validation."""
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class FileFormat(str, Enum):
    CSV = "CSV"
    JSON = "JSON"
    PARQUET = "PARQUET"


class IngestionType(str, Enum):
    ONE_TIME = "one_time"
    SNOWPIPE = "snowpipe"


class ColumnSchema(BaseModel):
    """Schema for a single table column."""
    name: str = Field(..., description="Column name")
    type: str = Field(..., description="Snowflake data type (VARCHAR, NUMBER, VARIANT, TIMESTAMP_NTZ, etc.)")
    nullable: bool = Field(default=True, description="Whether the column is nullable")

    @validator('name')
    def validate_column_name(cls, v):
        """Ensure column name is a valid Snowflake identifier."""
        if not v or not v.strip():
            raise ValueError("Column name cannot be empty")
        # Basic validation - should be alphanumeric with underscores
        if not all(c.isalnum() or c == '_' for c in v):
            raise ValueError("Column name must contain only alphanumeric characters and underscores")
        if v[0].isdigit():
            raise ValueError("Column name cannot start with a digit")
        return v.strip()


class EnvironmentSourceConfig(BaseModel):
    """Source configuration for a specific environment."""
    connection_name: str = Field(..., description="Connection name for this environment")
    bucket: str = Field(..., description="S3 bucket name for this environment")


class EnvironmentTargetConfig(BaseModel):
    """Target configuration for a specific environment."""
    connection_name: str = Field(..., description="Snowflake connection name for this environment")
    database: str = Field(..., description="Target database for this environment")
    schema_name: str = Field(..., alias="schema", description="Target schema for this environment")


class SourceConfig(BaseModel):
    """Source configuration section."""
    type: str = Field(default="s3", description="Source type (currently only 's3' supported)")
    path: str = Field(..., description="S3 path/prefix (shared across environments)")
    sample_file: Optional[str] = Field(None, description="Optional sample file path for schema detection")
    # Environment-specific configs
    default: EnvironmentSourceConfig = Field(..., description="Default environment source config")
    dev: Optional[EnvironmentSourceConfig] = None
    uat: Optional[EnvironmentSourceConfig] = None
    prod: Optional[EnvironmentSourceConfig] = None

    @validator('type')
    def validate_source_type(cls, v):
        if v != "s3":
            raise ValueError("Currently only 's3' source type is supported")
        return v


class TargetConfig(BaseModel):
    """Target configuration section."""
    table: str = Field(..., description="Target table name (shared across environments)")
    # Environment-specific configs
    default: EnvironmentTargetConfig = Field(..., description="Default environment target config")
    dev: Optional[EnvironmentTargetConfig] = None
    uat: Optional[EnvironmentTargetConfig] = None
    prod: Optional[EnvironmentTargetConfig] = None


class IngestionConfig(BaseModel):
    """Ingestion configuration section."""
    type: IngestionType = Field(..., description="Ingestion type: one_time or snowpipe")
    file_format: FileFormat = Field(..., description="File format: CSV, JSON, or PARQUET")
    copy_options: Optional[Dict[str, Any]] = Field(None, description="Optional copy options for file format")


class ContractMetadata(BaseModel):
    """Contract metadata section."""
    name: str = Field(..., description="Contract name")
    description: Optional[str] = Field(None, description="Contract description")
    created_at: Optional[str] = Field(None, description="Creation timestamp (ISO format)")
    project_id: Optional[int] = Field(None, description="Reference to project for governance metadata")


class IngestionContract(BaseModel):
    """Complete ingestion contract schema."""
    version: str = Field(default="1.0", description="Contract schema version")
    metadata: ContractMetadata = Field(..., description="Contract metadata")
    source: SourceConfig = Field(..., description="Source configuration")
    target: TargetConfig = Field(..., description="Target configuration")
    table_schema: List[ColumnSchema] = Field(..., alias="schema", description="Table schema (list of columns)")
    ingestion: IngestionConfig = Field(..., description="Ingestion configuration")

    class Config:
        use_enum_values = True

    @validator('version')
    def validate_version(cls, v):
        if v != "1.0":
            raise ValueError("Currently only version '1.0' is supported")
        return v

    def get_environment_config(self, environment: str = "default") -> Dict[str, Any]:
        """Get resolved configuration for a specific environment."""
        env = environment.lower()
        
        # Get source config for environment
        if env == "default":
            source_env = self.source.default
        elif env == "dev" and self.source.dev:
            source_env = self.source.dev
        elif env == "uat" and self.source.uat:
            source_env = self.source.uat
        elif env == "prod" and self.source.prod:
            source_env = self.source.prod
        else:
            source_env = self.source.default  # Fallback to default
        
        # Get target config for environment
        if env == "default":
            target_env = self.target.default
        elif env == "dev" and self.target.dev:
            target_env = self.target.dev
        elif env == "uat" and self.target.uat:
            target_env = self.target.uat
        elif env == "prod" and self.target.prod:
            target_env = self.target.prod
        else:
            target_env = self.target.default  # Fallback to default
        
        return {
            "source": {
                "type": self.source.type,
                "path": self.source.path,
                "sample_file": self.source.sample_file,
                "connection_name": source_env.connection_name,
                "bucket": source_env.bucket,
            },
            "target": {
                "table": self.target.table,
                "connection_name": target_env.connection_name,
                "database": target_env.database,
                "schema": target_env.schema_name,
            },
            "schema": [col.dict() for col in self.table_schema],
            "ingestion": self.ingestion.dict(),
        }

