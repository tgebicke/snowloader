"""Contract service for parsing, validating, and managing ingestion contracts."""
import json
import yaml
from typing import Dict, Optional, Any, List
from pydantic import ValidationError
from app.api.models.contract import IngestionContract
from app.api.models.database import Project, Connection
from app.services.pipeline_service import detect_schema_from_file
from app.core.security import decrypt_data


def parse_contract(contract_data: str, format: str = "yaml") -> Dict[str, Any]:
    """Parse contract from YAML or JSON string."""
    try:
        if format.lower() == "yaml":
            return yaml.safe_load(contract_data)
        elif format.lower() == "json":
            return json.loads(contract_data)
        else:
            raise ValueError(f"Unsupported format: {format}. Must be 'yaml' or 'json'")
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML: {str(e)}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {str(e)}")


def validate_contract(contract_dict: Dict[str, Any]) -> IngestionContract:
    """Validate contract structure using Pydantic models."""
    try:
        return IngestionContract(**contract_dict)
    except ValidationError as e:
        raise ValueError(f"Contract validation failed: {str(e)}")


def contract_to_yaml(contract: IngestionContract) -> str:
    """Convert contract to YAML string."""
    return yaml.dump(contract.dict(exclude_none=True), default_flow_style=False, sort_keys=False)


def contract_to_json(contract: IngestionContract) -> str:
    """Convert contract to JSON string."""
    return json.dumps(contract.dict(exclude_none=True), indent=2)


def detect_schema_from_sample(
    connection_id: int,
    bucket: str,
    sample_file: str,
    file_format: str,
    db_session,
    tenant_id: int
) -> List[Dict[str, Any]]:
    """Detect schema from a sample file using existing pipeline service."""
    from app.api.models.database import User
    # Get connection and validate tenant ownership
    connection = db_session.query(Connection).join(User).filter(
        Connection.id == connection_id,
        User.tenant_id == tenant_id
    ).first()
    
    if not connection:
        raise ValueError(f"Connection {connection_id} not found or not accessible")
    
    # Decrypt credentials
    creds_json = decrypt_data(connection.encrypted_credentials)
    creds = json.loads(creds_json)
    
    # Get region (default to us-east-1 for S3)
    region = creds.get('region', 'us-east-1')
    
    if connection.type.value == "s3":
        access_key_id = creds['access_key_id']
        secret_access_key = creds['secret_access_key']
        
        # Use existing schema detection function
        columns = detect_schema_from_file(
            access_key_id,
            secret_access_key,
            bucket,
            sample_file,
            region,
            file_format
        )
        
        return columns
    else:
        raise ValueError(f"Unsupported connection type: {connection.type}")


def resolve_environment_config(
    contract: IngestionContract,
    environment: str = "default"
) -> Dict[str, Any]:
    """Resolve configuration for a specific environment."""
    return contract.get_environment_config(environment)


def validate_project_reference(
    project_id: Optional[int],
    tenant_id: int,
    db_session
) -> Optional[Project]:
    """Validate that project exists and belongs to the tenant."""
    if project_id is None:
        return None
    
    project = db_session.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant_id
    ).first()
    
    if not project:
        raise ValueError(f"Project {project_id} not found or not accessible")
    
    return project


def validate_connection_names(
    contract: IngestionContract,
    tenant_id: int,
    db_session
) -> Dict[str, bool]:
    """Validate that all referenced connection names exist for the tenant."""
    connection_names = set()
    
    # Collect all connection names from source configs
    connection_names.add(contract.source.default.connection_name)
    if contract.source.dev:
        connection_names.add(contract.source.dev.connection_name)
    if contract.source.uat:
        connection_names.add(contract.source.uat.connection_name)
    if contract.source.prod:
        connection_names.add(contract.source.prod.connection_name)
    
    # Collect all connection names from target configs
    connection_names.add(contract.target.default.connection_name)
    if contract.target.dev:
        connection_names.add(contract.target.dev.connection_name)
    if contract.target.uat:
        connection_names.add(contract.target.uat.connection_name)
    if contract.target.prod:
        connection_names.add(contract.target.prod.connection_name)
    
    # Check each connection exists for the tenant
    from app.api.models.database import User
    results = {}
    for conn_name in connection_names:
        connection = db_session.query(Connection).join(User).filter(
            Connection.name == conn_name,
            User.tenant_id == tenant_id
        ).first()
        results[conn_name] = connection is not None
    
    return results

