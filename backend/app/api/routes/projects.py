"""Project API endpoints with tenant isolation."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.db.session import get_db
from app.api.models.database import User, Project, Tenant
from app.api.routes.auth import get_current_user
from app.core.tenant import get_user_tenant_id

router = APIRouter()


class DataGovernancePerson(BaseModel):
    """Person in data governance (owner, stakeholder, or steward)."""
    name: str
    email: str
    role: str


class DataGovernance(BaseModel):
    """Data governance metadata."""
    owners: Optional[List[DataGovernancePerson]] = []
    stakeholders: Optional[List[DataGovernancePerson]] = []
    stewards: Optional[List[DataGovernancePerson]] = []


class ProjectCreate(BaseModel):
    """Request model for creating a project."""
    organization: str
    department: str
    project: str
    data_governance: Optional[DataGovernance] = None


class ProjectUpdate(BaseModel):
    """Request model for updating a project."""
    organization: Optional[str] = None
    department: Optional[str] = None
    project: Optional[str] = None
    data_governance: Optional[DataGovernance] = None


class ProjectResponse(BaseModel):
    """Response model for project."""
    id: int
    organization: str
    department: str
    project: str
    data_governance: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class GovernanceUpdate(BaseModel):
    """Request model for updating governance metadata."""
    data_governance: DataGovernance


@router.get("/projects", response_model=List[ProjectResponse])
def list_projects(
    organization: Optional[str] = None,
    department: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List projects for current tenant, optionally filtered by organization/department."""
    tenant_id = get_user_tenant_id(current_user)
    
    query = db.query(Project).filter(Project.tenant_id == tenant_id)
    
    if organization:
        query = query.filter(Project.organization == organization)
    if department:
        query = query.filter(Project.department == department)
    
    projects = query.all()
    
    return [
        ProjectResponse(
            id=p.id,
            organization=p.organization,
            department=p.department,
            project=p.project,
            data_governance=p.data_governance,
            created_at=p.created_at.isoformat(),
            updated_at=p.updated_at.isoformat() if p.updated_at else p.created_at.isoformat()
        )
        for p in projects
    ]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project details with governance metadata."""
    tenant_id = get_user_tenant_id(current_user)
    
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return ProjectResponse(
        id=project.id,
        organization=project.organization,
        department=project.department,
        project=project.project,
        data_governance=project.data_governance,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat() if project.updated_at else project.created_at.isoformat()
    )


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    project: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project with governance metadata."""
    tenant_id = get_user_tenant_id(current_user)
    
    # Check if project already exists
    existing = db.query(Project).filter(
        Project.tenant_id == tenant_id,
        Project.organization == project.organization,
        Project.department == project.department,
        Project.project == project.project
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project with this organization/department/project combination already exists"
        )
    
    # Convert governance to dict if provided
    governance_dict = None
    if project.data_governance:
        governance_dict = project.data_governance.dict(exclude_none=True)
    
    db_project = Project(
        tenant_id=tenant_id,
        organization=project.organization,
        department=project.department,
        project=project.project,
        data_governance=governance_dict
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        organization=db_project.organization,
        department=db_project.department,
        project=db_project.project,
        data_governance=db_project.data_governance,
        created_at=db_project.created_at.isoformat(),
        updated_at=db_project.updated_at.isoformat() if db_project.updated_at else db_project.created_at.isoformat()
    )


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update project details."""
    tenant_id = get_user_tenant_id(current_user)
    
    db_project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant_id
    ).first()
    
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update fields if provided
    if project.organization is not None:
        db_project.organization = project.organization
    if project.department is not None:
        db_project.department = project.department
    if project.project is not None:
        db_project.project = project.project
    if project.data_governance is not None:
        db_project.data_governance = project.data_governance.dict(exclude_none=True)
    
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        organization=db_project.organization,
        department=db_project.department,
        project=db_project.project,
        data_governance=db_project.data_governance,
        created_at=db_project.created_at.isoformat(),
        updated_at=db_project.updated_at.isoformat() if db_project.updated_at else db_project.created_at.isoformat()
    )


@router.put("/projects/{project_id}/governance", response_model=ProjectResponse)
def update_governance(
    project_id: int,
    governance: GovernanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update governance metadata for a project."""
    tenant_id = get_user_tenant_id(current_user)
    
    db_project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant_id
    ).first()
    
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    db_project.data_governance = governance.data_governance.dict(exclude_none=True)
    db.commit()
    db.refresh(db_project)
    
    return ProjectResponse(
        id=db_project.id,
        organization=db_project.organization,
        department=db_project.department,
        project=db_project.project,
        data_governance=db_project.data_governance,
        created_at=db_project.created_at.isoformat(),
        updated_at=db_project.updated_at.isoformat() if db_project.updated_at else db_project.created_at.isoformat()
    )

