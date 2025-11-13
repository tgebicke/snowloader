from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json

from app.db.session import get_db
from app.api.models.database import User, Connection, ConnectionType
from app.api.routes.auth import get_current_user
from app.core.security import encrypt_data, decrypt_data
from app.services.s3_service import test_s3_connection, list_buckets
from app.services.snowflake_service import test_snowflake_connection, get_snowflake_connection, list_databases, list_schemas

router = APIRouter()


class S3ConnectionCreate(BaseModel):
    name: str
    access_key_id: str
    secret_access_key: str
    region: str = "us-east-1"


class SnowflakeConnectionCreate(BaseModel):
    name: str
    account: str
    user: str
    password: str
    warehouse: str
    database: str
    schema: str


class ConnectionResponse(BaseModel):
    id: int
    name: str
    type: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/connections/s3", response_model=ConnectionResponse)
def create_s3_connection(
    connection: S3ConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and test S3 connection."""
    # Test connection first
    try:
        test_s3_connection(
            connection.access_key_id,
            connection.secret_access_key,
            connection.region
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to S3: {str(e)}"
        )
    
    # Encrypt credentials (without bucket)
    credentials = {
        "access_key_id": connection.access_key_id,
        "secret_access_key": connection.secret_access_key,
        "region": connection.region
    }
    encrypted_credentials = encrypt_data(json.dumps(credentials))
    
    # Create connection
    db_connection = Connection(
        user_id=current_user.id,
        name=connection.name,
        type=ConnectionType.S3,
        encrypted_credentials=encrypted_credentials
    )
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    return ConnectionResponse(
        id=db_connection.id,
        name=db_connection.name,
        type=db_connection.type.value,
        created_at=db_connection.created_at.isoformat()
    )


@router.post("/connections/snowflake", response_model=ConnectionResponse)
def create_snowflake_connection(
    connection: SnowflakeConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create and test Snowflake connection."""
    # Test connection first
    try:
        test_snowflake_connection(
            connection.account,
            connection.user,
            connection.password,
            connection.warehouse,
            connection.database,
            connection.schema
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to Snowflake: {str(e)}"
        )
    
    # Encrypt credentials
    credentials = {
        "account": connection.account,
        "user": connection.user,
        "password": connection.password,
        "warehouse": connection.warehouse,
        "database": connection.database,
        "schema": connection.schema
    }
    encrypted_credentials = encrypt_data(json.dumps(credentials))
    
    # Create connection
    db_connection = Connection(
        user_id=current_user.id,
        name=connection.name,
        type=ConnectionType.SNOWFLAKE,
        encrypted_credentials=encrypted_credentials
    )
    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    
    return ConnectionResponse(
        id=db_connection.id,
        name=db_connection.name,
        type=db_connection.type.value,
        created_at=db_connection.created_at.isoformat()
    )


@router.get("/connections", response_model=List[ConnectionResponse])
def list_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all connections for current user."""
    connections = db.query(Connection).filter(Connection.user_id == current_user.id).all()
    return [
        ConnectionResponse(
            id=conn.id,
            name=conn.name,
            type=conn.type.value,
            created_at=conn.created_at.isoformat()
        )
        for conn in connections
    ]


@router.delete("/connections/{connection_id}")
def delete_connection(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    db.delete(connection)
    db.commit()
    return {"message": "Connection deleted"}


@router.get("/connections/{connection_id}/databases")
def get_databases(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of databases for a Snowflake connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.SNOWFLAKE
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snowflake connection not found"
        )
    
    # Decrypt credentials
    credentials_json = decrypt_data(connection.encrypted_credentials)
    credentials = json.loads(credentials_json)
    
    # Connect to Snowflake
    try:
        conn = get_snowflake_connection(
            credentials['account'],
            credentials['user'],
            credentials['password'],
            credentials['warehouse'],
            credentials.get('database', ''),
            credentials.get('schema', '')
        )
        
        databases = list_databases(conn)
        conn.close()
        
        return {"databases": databases}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch databases: {str(e)}"
        )


@router.get("/connections/{connection_id}/schemas")
def get_schemas(
    connection_id: int,
    database: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of schemas for a Snowflake connection, optionally filtered by database."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.SNOWFLAKE
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snowflake connection not found"
        )
    
    # Decrypt credentials
    credentials_json = decrypt_data(connection.encrypted_credentials)
    credentials = json.loads(credentials_json)
    
    # Use provided database or default from connection
    target_database = database or credentials.get('database', '')
    
    # Connect to Snowflake
    try:
        conn = get_snowflake_connection(
            credentials['account'],
            credentials['user'],
            credentials['password'],
            credentials['warehouse'],
            target_database or credentials.get('database', ''),
            credentials.get('schema', '')
        )
        
        schemas = list_schemas(conn, target_database if target_database else None)
        conn.close()
        
        return {"schemas": schemas}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch schemas: {str(e)}"
        )


@router.get("/connections/{connection_id}/buckets")
def get_buckets(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of buckets for an S3 connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
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
    
    # List buckets
    try:
        buckets = list_buckets(
            credentials['access_key_id'],
            credentials['secret_access_key'],
            credentials.get('region', 'us-east-1')
        )
        return {"buckets": buckets}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch buckets: {str(e)}"
        )

