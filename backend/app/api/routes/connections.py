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
    role: Optional[str] = None


class ConnectionResponse(BaseModel):
    id: int
    name: str
    type: str
    created_at: str

    class Config:
        from_attributes = True


class ConnectionDetailResponse(BaseModel):
    id: int
    name: str
    type: str
    created_at: str
    credentials: dict  # Decrypted credentials

    class Config:
        from_attributes = True


@router.post("/connections/s3/test")
def test_s3_connection_endpoint(
    connection: S3ConnectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Test S3 connection without creating it."""
    try:
        test_s3_connection(
            connection.access_key_id,
            connection.secret_access_key,
            connection.region
        )
        return {"status": "success", "message": "Connection test successful"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to S3: {str(e)}"
        )


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


@router.post("/connections/snowflake/test")
def test_snowflake_connection_endpoint(
    connection: SnowflakeConnectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Test Snowflake connection without creating it."""
    try:
        test_snowflake_connection(
            connection.account,
            connection.user,
            connection.password,
            None,  # warehouse not required for connection test
            None,  # database not required for connection test
            None,  # schema not required for connection test
            connection.role
        )
        return {"status": "success", "message": "Connection test successful"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to Snowflake: {str(e)}"
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
            None,  # warehouse not required for connection test
            None,  # database not required for connection test
            None,  # schema not required for connection test
            connection.role
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to connect to Snowflake: {str(e)}"
        )
    
    # Encrypt credentials (only store what's provided)
    credentials = {
        "account": connection.account,
        "user": connection.user,
        "password": connection.password
    }
    if connection.role:
        credentials["role"] = connection.role
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


@router.get("/connections/{connection_id}", response_model=ConnectionDetailResponse)
def get_connection(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get connection details with decrypted credentials."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connection not found"
        )
    
    # Decrypt credentials
    credentials_json = decrypt_data(connection.encrypted_credentials)
    credentials = json.loads(credentials_json)
    
    return ConnectionDetailResponse(
        id=connection.id,
        name=connection.name,
        type=connection.type.value,
        created_at=connection.created_at.isoformat(),
        credentials=credentials
    )


@router.put("/connections/{connection_id}/s3", response_model=ConnectionResponse)
def update_s3_connection(
    connection_id: int,
    connection: S3ConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update S3 connection."""
    db_connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.S3
    ).first()
    
    if not db_connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="S3 connection not found"
        )
    
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
    
    # Encrypt credentials
    credentials = {
        "access_key_id": connection.access_key_id,
        "secret_access_key": connection.secret_access_key,
        "region": connection.region
    }
    encrypted_credentials = encrypt_data(json.dumps(credentials))
    
    # Update connection
    db_connection.name = connection.name
    db_connection.encrypted_credentials = encrypted_credentials
    db.commit()
    db.refresh(db_connection)
    
    return ConnectionResponse(
        id=db_connection.id,
        name=db_connection.name,
        type=db_connection.type.value,
        created_at=db_connection.created_at.isoformat()
    )


@router.put("/connections/{connection_id}/snowflake", response_model=ConnectionResponse)
def update_snowflake_connection(
    connection_id: int,
    connection: SnowflakeConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update Snowflake connection."""
    db_connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id,
        Connection.type == ConnectionType.SNOWFLAKE
    ).first()
    
    if not db_connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snowflake connection not found"
        )
    
    # Test connection first
    try:
        test_snowflake_connection(
            connection.account,
            connection.user,
            connection.password,
            None,
            None,
            None,
            connection.role
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
        "password": connection.password
    }
    if connection.role:
        credentials["role"] = connection.role
    encrypted_credentials = encrypt_data(json.dumps(credentials))
    
    # Update connection
    db_connection.name = connection.name
    db_connection.encrypted_credentials = encrypted_credentials
    db.commit()
    db.refresh(db_connection)
    
    return ConnectionResponse(
        id=db_connection.id,
        name=db_connection.name,
        type=db_connection.type.value,
        created_at=db_connection.created_at.isoformat()
    )


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
            credentials.get('warehouse'),
            credentials.get('database'),
            credentials.get('schema'),
            credentials.get('role')
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
            credentials.get('warehouse'),
            target_database or credentials.get('database'),
            credentials.get('schema'),
            credentials.get('role')
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

