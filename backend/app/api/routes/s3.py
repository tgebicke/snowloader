from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json

from app.db.session import get_db
from app.api.models.database import User, Connection, ConnectionType
from app.api.routes.auth import get_current_user
from app.core.security import decrypt_data
from app.services.s3_service import list_s3_files, preview_s3_file

router = APIRouter()


class S3ListRequest(BaseModel):
    connection_id: int
    bucket: str
    prefix: str = ""


class S3FileResponse(BaseModel):
    key: str
    size: int
    last_modified: str


class S3PreviewRequest(BaseModel):
    connection_id: int
    bucket: str
    key: str
    lines: int = 10


@router.post("/s3/list", response_model=List[S3FileResponse])
def list_s3_objects(
    request: S3ListRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List files in S3 bucket."""
    # Get connection
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.S3
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="S3 connection not found"
        )
    
    # Decrypt credentials
    credentials_json = decrypt_data(connection.encrypted_credentials)
    credentials = json.loads(credentials_json)
    
    # List files
    try:
        files = list_s3_files(
            credentials['access_key_id'],
            credentials['secret_access_key'],
            request.bucket,
            request.prefix,
            credentials.get('region', 'us-east-1')
        )
        return [S3FileResponse(**file) for file in files]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/s3/preview")
def preview_s3_object(
    request: S3PreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview S3 file contents."""
    # Get connection
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.S3
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="S3 connection not found"
        )
    
    # Decrypt credentials
    credentials_json = decrypt_data(connection.encrypted_credentials)
    credentials = json.loads(credentials_json)
    
    # Preview file
    try:
        lines = preview_s3_file(
            credentials['access_key_id'],
            credentials['secret_access_key'],
            request.bucket,
            request.key,
            credentials.get('region', 'us-east-1'),
            request.lines
        )
        return {"lines": lines}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

