from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

from app.db.session import get_db
from app.api.models.database import (
    User, Connection, Pipeline, PipelineRun,
    IngestionType, PipelineStatus, RunStatus
)
from app.api.routes.auth import get_current_user
from app.services.pipeline_service import create_one_time_pipeline, create_snowpipe_pipeline

router = APIRouter()


class PipelineCreate(BaseModel):
    name: str
    ingestion_type: str  # "one_time" or "snowpipe"
    s3_connection_id: int
    snowflake_connection_id: int
    s3_path: str  # File path for one-time, prefix for Snowpipe
    target_database: str
    target_schema: str
    target_table: Optional[str] = None  # Optional - will be auto-generated if not provided
    file_format: Optional[str] = None  # Optional - will be auto-detected from file extension
    copy_options: Optional[Dict] = None  # Advanced copy options for FILE_FORMAT


class PipelineResponse(BaseModel):
    id: int
    name: str
    ingestion_type: str
    status: str
    target_database: str
    target_schema: str
    target_table: str
    created_at: str

    class Config:
        from_attributes = True


class PipelineRunResponse(BaseModel):
    id: int
    status: str
    started_at: str
    completed_at: Optional[str]
    error_message: Optional[str]
    rows_loaded: Optional[int]

    class Config:
        from_attributes = True


@router.post("/pipelines", response_model=PipelineResponse)
def create_pipeline(
    pipeline: PipelineCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new ingestion pipeline."""
    # Validate connections belong to user
    s3_conn = db.query(Connection).filter(
        Connection.id == pipeline.s3_connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    sf_conn = db.query(Connection).filter(
        Connection.id == pipeline.snowflake_connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not s3_conn or not sf_conn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Validate ingestion type
    try:
        ingestion_type = IngestionType(pipeline.ingestion_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid ingestion type. Must be 'one_time' or 'snowpipe'"
        )
    
    try:
        if ingestion_type == IngestionType.ONE_TIME:
            # For one-time ingestion, determine table name first (may be auto-generated)
            target_table = pipeline.target_table if pipeline.target_table and pipeline.target_table.strip() else None
            
            # Create pipeline record with placeholder table name (will be updated)
            db_pipeline = Pipeline(
                user_id=current_user.id,
                name=pipeline.name,
                ingestion_type=ingestion_type,
                s3_connection_id=pipeline.s3_connection_id,
                snowflake_connection_id=pipeline.snowflake_connection_id,
                s3_path=pipeline.s3_path,
                target_database=pipeline.target_database,
                target_schema=pipeline.target_schema,
                target_table=target_table or "TEMP",  # Temporary, will be updated
                status=PipelineStatus.ACTIVE,
                config={
                    "file_format": pipeline.file_format,
                    "copy_options": pipeline.copy_options
                }
            )
            db.add(db_pipeline)
            db.flush()  # Get the ID without committing
            
            # Execute the pipeline
            result = create_one_time_pipeline(
                s3_conn,
                sf_conn,
                pipeline.s3_path,
                pipeline.target_database,
                pipeline.target_schema,
                target_table or "",  # Pass empty string if None to trigger auto-generation
                pipeline.file_format,
                pipeline.copy_options
            )
            
            # Update with the actual table name (may have been auto-generated)
            final_table_name = result.get("table_name", pipeline.target_table or "unknown")
            db_pipeline.target_table = final_table_name
            
            # Create run record
            run = PipelineRun(
                pipeline_id=db_pipeline.id,
                status=RunStatus.SUCCESS if result["status"] == "success" else RunStatus.FAILED,
                completed_at=datetime.utcnow(),
                rows_loaded=result.get("rows_loaded", 0)
            )
            db.add(run)
            
        elif ingestion_type == IngestionType.SNOWPIPE:
            # For Snowpipe, table name must be provided
            if not pipeline.target_table or not pipeline.target_table.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Table name is required for Snowpipe pipelines"
                )
            final_table_name = pipeline.target_table
            
            # Create pipeline record
            db_pipeline = Pipeline(
                user_id=current_user.id,
                name=pipeline.name,
                ingestion_type=ingestion_type,
                s3_connection_id=pipeline.s3_connection_id,
                snowflake_connection_id=pipeline.snowflake_connection_id,
                s3_path=pipeline.s3_path,
                target_database=pipeline.target_database,
                target_schema=pipeline.target_schema,
                target_table=final_table_name,
                status=PipelineStatus.ACTIVE,
                config={"file_format": pipeline.file_format}
            )
            db.add(db_pipeline)
            db.flush()  # Get the ID without committing
            
            # Create Snowpipe
            pipe_name = f"PIPE_{final_table_name}_{db_pipeline.id}"
            result = create_snowpipe_pipeline(
                s3_conn,
                sf_conn,
                pipeline.s3_path,
                pipeline.target_database,
                pipeline.target_schema,
                final_table_name,
                pipe_name,
                pipeline.file_format
            )
            
            db_pipeline.snowpipe_name = result["pipe_name"]
        
        db.commit()
        db.refresh(db_pipeline)
        
        return PipelineResponse(
            id=db_pipeline.id,
            name=db_pipeline.name,
            ingestion_type=db_pipeline.ingestion_type.value,
            status=db_pipeline.status.value,
            target_database=db_pipeline.target_database,
            target_schema=db_pipeline.target_schema,
            target_table=db_pipeline.target_table,
            created_at=db_pipeline.created_at.isoformat()
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pipeline: {str(e)}"
        )


@router.get("/pipelines", response_model=List[PipelineResponse])
def list_pipelines(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all pipelines for current user."""
    pipelines = db.query(Pipeline).filter(Pipeline.user_id == current_user.id).all()
    return [
        PipelineResponse(
            id=p.id,
            name=p.name,
            ingestion_type=p.ingestion_type.value,
            status=p.status.value,
            target_database=p.target_database,
            target_schema=p.target_schema,
            target_table=p.target_table,
            created_at=p.created_at.isoformat()
        )
        for p in pipelines
    ]


@router.get("/pipelines/{pipeline_id}", response_model=PipelineResponse)
def get_pipeline(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pipeline details."""
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found"
        )
    
    return PipelineResponse(
        id=pipeline.id,
        name=pipeline.name,
        ingestion_type=pipeline.ingestion_type.value,
        status=pipeline.status.value,
        target_database=pipeline.target_database,
        target_schema=pipeline.target_schema,
        target_table=pipeline.target_table,
        created_at=pipeline.created_at.isoformat()
    )


@router.get("/pipelines/{pipeline_id}/runs", response_model=List[PipelineRunResponse])
def get_pipeline_runs(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pipeline execution history."""
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.user_id == current_user.id
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found"
        )
    
    runs = db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline_id).order_by(PipelineRun.started_at.desc()).limit(100).all()
    
    return [
        PipelineRunResponse(
            id=r.id,
            status=r.status.value,
            started_at=r.started_at.isoformat(),
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
            error_message=r.error_message,
            rows_loaded=r.rows_loaded
        )
        for r in runs
    ]


@router.post("/pipelines/{pipeline_id}/run")
def run_pipeline(
    pipeline_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Execute one-time pipeline."""
    pipeline = db.query(Pipeline).filter(
        Pipeline.id == pipeline_id,
        Pipeline.user_id == current_user.id,
        Pipeline.ingestion_type == IngestionType.ONE_TIME
    ).first()
    
    if not pipeline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pipeline not found or not a one-time pipeline"
        )
    
    # Get connections
    s3_conn = db.query(Connection).filter(Connection.id == pipeline.s3_connection_id).first()
    sf_conn = db.query(Connection).filter(Connection.id == pipeline.snowflake_connection_id).first()
    
    # Create run record
    run = PipelineRun(
        pipeline_id=pipeline.id,
        status=RunStatus.RUNNING
    )
    db.add(run)
    db.commit()
    
    try:
        file_format = pipeline.config.get("file_format", "CSV") if pipeline.config else "CSV"
        copy_options = pipeline.config.get("copy_options") if pipeline.config else None
        result = create_one_time_pipeline(
            s3_conn,
            sf_conn,
            pipeline.s3_path,
            pipeline.target_database,
            pipeline.target_schema,
            pipeline.target_table,
            file_format,
            copy_options
        )
        
        run.status = RunStatus.SUCCESS if result["status"] == "success" else RunStatus.FAILED
        run.completed_at = datetime.utcnow()
        run.rows_loaded = result.get("rows_loaded", 0)
        
        db.commit()
        return {"status": "success", "rows_loaded": result.get("rows_loaded", 0)}
    except Exception as e:
        run.status = RunStatus.FAILED
        run.completed_at = datetime.utcnow()
        run.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

