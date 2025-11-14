"""Contract API endpoints with tenant isolation."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import yaml

from app.db.session import get_db
from app.api.models.database import User, Contract, Project
from app.api.routes.auth import get_current_user
from app.core.tenant import get_user_tenant_id
from app.services.contract_service import (
    parse_contract,
    validate_contract,
    contract_to_yaml,
    contract_to_json,
    detect_schema_from_sample,
    resolve_environment_config,
    validate_project_reference,
    validate_connection_names
)
from app.api.models.contract import IngestionContract

router = APIRouter()


class ContractCreate(BaseModel):
    """Request model for creating a contract."""
    name: str
    description: Optional[str] = None
    organization: str
    department: str
    project_name: str
    source: str
    project_id: Optional[int] = None
    contract_data: Dict[str, Any]  # Full contract structure as JSON


class ContractUpdate(BaseModel):
    """Request model for updating a contract."""
    name: Optional[str] = None
    description: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    project_name: Optional[str] = None
    source: Optional[str] = None
    project_id: Optional[int] = None
    contract_data: Optional[Dict[str, Any]] = None


class ContractResponse(BaseModel):
    """Response model for contract."""
    id: int
    name: str
    description: Optional[str]
    organization: str
    department: str
    project_name: str
    source: str
    project_id: Optional[int]
    contract_data: Dict[str, Any]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ContractValidateRequest(BaseModel):
    """Request model for contract validation."""
    contract_data: Dict[str, Any]
    format: Optional[str] = "yaml"  # yaml or json


class ContractValidateResponse(BaseModel):
    """Response model for contract validation."""
    valid: bool
    errors: Optional[List[str]] = None


class SchemaDetectionRequest(BaseModel):
    """Request model for schema detection."""
    connection_id: int
    bucket: str
    sample_file: str
    file_format: str  # CSV, JSON, PARQUET


class SchemaDetectionResponse(BaseModel):
    """Response model for schema detection."""
    detected_schema: List[Dict[str, Any]] = Field(..., alias="schema")


@router.get("/contracts", response_model=List[ContractResponse])
def list_contracts(
    organization: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List contracts for current tenant, optionally filtered by organizational hierarchy."""
    tenant_id = get_user_tenant_id(current_user)
    
    query = db.query(Contract).filter(Contract.tenant_id == tenant_id)
    
    if organization:
        query = query.filter(Contract.organization == organization)
    if department:
        query = query.filter(Contract.department == department)
    if project_name:
        query = query.filter(Contract.project_name == project_name)
    if source:
        query = query.filter(Contract.source == source)
    
    contracts = query.order_by(Contract.created_at.desc()).all()
    
    return [
        ContractResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            organization=c.organization,
            department=c.department,
            project_name=c.project_name,
            source=c.source,
            project_id=c.project_id,
            contract_data=c.contract_data,
            created_at=c.created_at.isoformat(),
            updated_at=c.updated_at.isoformat() if c.updated_at else c.created_at.isoformat()
        )
        for c in contracts
    ]


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get contract details."""
    tenant_id = get_user_tenant_id(current_user)
    
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.tenant_id == tenant_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    return ContractResponse(
        id=contract.id,
        name=contract.name,
        description=contract.description,
        organization=contract.organization,
        department=contract.department,
        project_name=contract.project_name,
        source=contract.source,
        project_id=contract.project_id,
        contract_data=contract.contract_data,
        created_at=contract.created_at.isoformat(),
        updated_at=contract.updated_at.isoformat() if contract.updated_at else contract.created_at.isoformat()
    )


@router.post("/contracts", response_model=ContractResponse)
def create_contract(
    contract: ContractCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new contract."""
    tenant_id = get_user_tenant_id(current_user)
    
    # Validate contract structure
    try:
        validated_contract = validate_contract(contract.contract_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid contract structure: {str(e)}"
        )
    
    # Validate project reference if provided
    if contract.project_id:
        try:
            validate_project_reference(contract.project_id, tenant_id, db)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    # Validate connection names
    connection_validation = validate_connection_names(validated_contract, tenant_id, db)
    missing_connections = [name for name, exists in connection_validation.items() if not exists]
    if missing_connections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection names not found: {', '.join(missing_connections)}"
        )
    
    db_contract = Contract(
        tenant_id=tenant_id,
        user_id=current_user.id,
        name=contract.name,
        description=contract.description,
        organization=contract.organization,
        department=contract.department,
        project_name=contract.project_name,
        source=contract.source,
        project_id=contract.project_id,
        contract_data=contract.contract_data
    )
    
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    
    return ContractResponse(
        id=db_contract.id,
        name=db_contract.name,
        description=db_contract.description,
        organization=db_contract.organization,
        department=db_contract.department,
        project_name=db_contract.project_name,
        source=db_contract.source,
        project_id=db_contract.project_id,
        contract_data=db_contract.contract_data,
        created_at=db_contract.created_at.isoformat(),
        updated_at=db_contract.updated_at.isoformat() if db_contract.updated_at else db_contract.created_at.isoformat()
    )


@router.put("/contracts/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: int,
    contract: ContractUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing contract."""
    tenant_id = get_user_tenant_id(current_user)
    
    db_contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.tenant_id == tenant_id
    ).first()
    
    if not db_contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    # If contract_data is being updated, validate it
    contract_data_to_validate = contract.contract_data if contract.contract_data else db_contract.contract_data
    try:
        validated_contract = validate_contract(contract_data_to_validate)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid contract structure: {str(e)}"
        )
    
    # Validate project reference if provided
    project_id_to_check = contract.project_id if contract.project_id is not None else db_contract.project_id
    if project_id_to_check:
        try:
            validate_project_reference(project_id_to_check, tenant_id, db)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    # Validate connection names
    connection_validation = validate_connection_names(validated_contract, tenant_id, db)
    missing_connections = [name for name, exists in connection_validation.items() if not exists]
    if missing_connections:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection names not found: {', '.join(missing_connections)}"
        )
    
    # Update fields
    if contract.name is not None:
        db_contract.name = contract.name
    if contract.description is not None:
        db_contract.description = contract.description
    if contract.organization is not None:
        db_contract.organization = contract.organization
    if contract.department is not None:
        db_contract.department = contract.department
    if contract.project_name is not None:
        db_contract.project_name = contract.project_name
    if contract.source is not None:
        db_contract.source = contract.source
    if contract.project_id is not None:
        db_contract.project_id = contract.project_id
    if contract.contract_data is not None:
        db_contract.contract_data = contract.contract_data
    
    db.commit()
    db.refresh(db_contract)
    
    return ContractResponse(
        id=db_contract.id,
        name=db_contract.name,
        description=db_contract.description,
        organization=db_contract.organization,
        department=db_contract.department,
        project_name=db_contract.project_name,
        source=db_contract.source,
        project_id=db_contract.project_id,
        contract_data=db_contract.contract_data,
        created_at=db_contract.created_at.isoformat(),
        updated_at=db_contract.updated_at.isoformat() if db_contract.updated_at else db_contract.created_at.isoformat()
    )


@router.delete("/contracts/{contract_id}")
def delete_contract(
    contract_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a contract."""
    tenant_id = get_user_tenant_id(current_user)
    
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.tenant_id == tenant_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    db.delete(contract)
    db.commit()
    
    return {"message": "Contract deleted"}


@router.post("/contracts/validate", response_model=ContractValidateResponse)
def validate_contract_endpoint(
    request: ContractValidateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Validate contract structure."""
    try:
        validate_contract(request.contract_data)
        return ContractValidateResponse(valid=True)
    except ValueError as e:
        return ContractValidateResponse(valid=False, errors=[str(e)])


@router.post("/contracts/detect-schema", response_model=SchemaDetectionResponse)
def detect_schema(
    request: SchemaDetectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Detect schema from a sample file."""
    tenant_id = get_user_tenant_id(current_user)
    
    try:
        schema = detect_schema_from_sample(
            request.connection_id,
            request.bucket,
            request.sample_file,
            request.file_format,
            db,
            tenant_id
        )
        return SchemaDetectionResponse(detected_schema=schema)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect schema: {str(e)}"
        )


@router.get("/contracts/{contract_id}/preview")
def preview_contract(
    contract_id: int,
    environment: str = Query("default", description="Environment: default, dev, uat, or prod"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview resolved contract configuration for a specific environment."""
    tenant_id = get_user_tenant_id(current_user)
    
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.tenant_id == tenant_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    try:
        validated_contract = validate_contract(contract.contract_data)
        resolved_config = resolve_environment_config(validated_contract, environment)
        return resolved_config
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid contract: {str(e)}"
        )


@router.get("/contracts/{contract_id}/yaml")
def get_contract_yaml(
    contract_id: int,
    environment: Optional[str] = Query(None, description="Optional environment for resolved config"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get contract as YAML string."""
    tenant_id = get_user_tenant_id(current_user)
    
    contract = db.query(Contract).filter(
        Contract.id == contract_id,
        Contract.tenant_id == tenant_id
    ).first()
    
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract not found"
        )
    
    try:
        validated_contract = validate_contract(contract.contract_data)
        
        # If environment specified, return resolved config
        if environment:
            resolved_config = resolve_environment_config(validated_contract, environment)
            return {"yaml": yaml.dump(resolved_config, default_flow_style=False, sort_keys=False)}
        else:
            return {"yaml": contract_to_yaml(validated_contract)}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid contract: {str(e)}"
        )

