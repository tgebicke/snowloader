import json
from typing import Dict, Optional, Any
from app.services.snowflake_service import (
    get_snowflake_connection,
    create_table_from_schema,
    create_external_stage,
    create_snowpipe,
    copy_into_table,
    execute_sql
)
from app.services.s3_service import get_s3_client, preview_s3_file
from app.core.security import decrypt_data
from app.api.models.database import Connection, ConnectionType, IngestionType


def detect_file_format_from_path(file_path: str) -> str:
    """Detect file format from file extension."""
    file_path_lower = file_path.lower()
    if file_path_lower.endswith('.json') or file_path_lower.endswith('.jsonl'):
        return "JSON"
    elif file_path_lower.endswith('.csv'):
        return "CSV"
    elif file_path_lower.endswith('.parquet'):
        return "PARQUET"
    else:
        # Default to CSV for unknown extensions
        return "CSV"


def detect_schema_from_file(access_key_id: str, secret_access_key: str, bucket: str, key: str, region: str, file_type: str = "CSV") -> list:
    """Detect schema from S3 file."""
    if file_type.upper() == "CSV":
        # Preview first few lines to detect schema
        lines = preview_s3_file(
            access_key_id, secret_access_key, bucket, key, region, lines=5
        )
        if not lines:
            raise Exception("File is empty")
        
        # Simple CSV schema detection
        headers = lines[0].split(',')
        # For MVP, assume all columns are VARCHAR
        columns = [{"name": h.strip().replace(' ', '_'), "type": "VARCHAR", "nullable": True} for h in headers]
        return columns
    elif file_type.upper() == "JSON":
        # For JSON, we create a table with VARIANT column + metadata columns
        # The actual JSON structure will be stored in the VARIANT column
        columns = [
            {"name": "raw_data", "type": "VARIANT", "nullable": True},
            {"name": "metadata_filename", "type": "VARCHAR", "nullable": True},
            {"name": "metadata_file_row_number", "type": "NUMBER", "nullable": True},
            {"name": "metadata_file_content_key", "type": "VARCHAR", "nullable": True},
            {"name": "metadata_file_last_modified", "type": "TIMESTAMP_NTZ", "nullable": True},
        ]
        return columns
    else:
        raise Exception(f"File type {file_type} not yet supported")


def create_one_time_pipeline(
    s3_connection: Connection,
    snowflake_connection: Connection,
    s3_path: str,
    target_database: str,
    target_schema: str,
    target_table: str,
    file_format: Optional[str] = None,
    copy_options: Optional[Dict] = None
) -> Dict:
    """Create and execute one-time ingestion pipeline."""
    # Auto-detect file format if not provided
    if not file_format:
        file_format = detect_file_format_from_path(s3_path)
    
    # Auto-generate table name if not provided (use file name without extension)
    if not target_table or target_table.strip() == "":
        file_name = s3_path.split('/')[-1]
        target_table = file_name.rsplit('.', 1)[0].replace('-', '_').replace(' ', '_')
        # Ensure valid Snowflake identifier
        target_table = ''.join(c if c.isalnum() or c == '_' else '_' for c in target_table)
        if not target_table or target_table[0].isdigit():
            target_table = f"TABLE_{target_table}"
    
    # Decrypt credentials
    s3_creds_json = decrypt_data(s3_connection.encrypted_credentials)
    s3_creds = json.loads(s3_creds_json)
    
    sf_creds_json = decrypt_data(snowflake_connection.encrypted_credentials)
    sf_creds = json.loads(sf_creds_json)
    
    # Get S3 client
    s3_client = get_s3_client(
        s3_creds['access_key_id'],
        s3_creds['secret_access_key'],
        s3_creds.get('region', 'us-east-1')
    )
    
    # Detect schema from file
    columns = detect_schema_from_file(
        s3_creds['access_key_id'],
        s3_creds['secret_access_key'],
        s3_creds['bucket'],
        s3_path,
        s3_creds.get('region', 'us-east-1'),
        file_format
    )
    
    # Connect to Snowflake
    conn = get_snowflake_connection(
        sf_creds['account'],
        sf_creds['user'],
        sf_creds['password'],
        sf_creds['warehouse'],
        sf_creds['database'],
        sf_creds['schema']
    )
    
    try:
        # Create table if not exists
        create_table_from_schema(conn, target_database, target_schema, target_table, columns)
        
        # Create external stage pointing to S3
        # Extract the directory path from the S3 path
        if '/' in s3_path:
            s3_prefix = '/'.join(s3_path.split('/')[:-1])
            s3_url = f"s3://{s3_creds['bucket']}/{s3_prefix}/"
        else:
            s3_url = f"s3://{s3_creds['bucket']}/"
        
        stage_name = f"STAGE_{target_table}"
        create_external_stage(
            conn,
            target_database,
            target_schema,
            stage_name,
            s3_url,
            {
                'access_key_id': s3_creds['access_key_id'],
                'secret_access_key': s3_creds['secret_access_key']
            }
        )
        
        # Execute COPY INTO
        file_name = s3_path.split('/')[-1]
        copy_result = copy_into_table(conn, target_database, target_schema, target_table, stage_name, file_name, file_format, copy_options)
        
        return {
            "status": "success",
            "rows_loaded": copy_result.get("rows_loaded", 0),
            "table_name": target_table  # Return the table name (may have been auto-generated)
        }
    finally:
        conn.close()


def create_snowpipe_pipeline(
    s3_connection: Connection,
    snowflake_connection: Connection,
    s3_prefix: str,
    target_database: str,
    target_schema: str,
    target_table: str,
    pipe_name: str,
    file_format: str = "CSV"
) -> Dict:
    """Create Snowpipe for continuous ingestion."""
    # Decrypt credentials
    s3_creds_json = decrypt_data(s3_connection.encrypted_credentials)
    s3_creds = json.loads(s3_creds_json)
    
    sf_creds_json = decrypt_data(snowflake_connection.encrypted_credentials)
    sf_creds = json.loads(sf_creds_json)
    
    # Connect to Snowflake
    conn = get_snowflake_connection(
        sf_creds['account'],
        sf_creds['user'],
        sf_creds['password'],
        sf_creds['warehouse'],
        sf_creds['database'],
        sf_creds['schema']
    )
    
    try:
        # Create table (need to detect schema from a sample file if available)
        # For MVP, create a simple table structure
        # In production, you'd want to detect schema from a sample file
        columns = [
            {"name": "raw_data", "type": "VARIANT", "nullable": True}
        ]
        create_table_from_schema(conn, target_database, target_schema, target_table, columns)
        
        # Create external stage
        s3_url = f"s3://{s3_creds['bucket']}/{s3_prefix}"
        stage_name = f"STAGE_{target_table}"
        create_external_stage(
            conn,
            target_database,
            target_schema,
            stage_name,
            s3_url,
            {
                'access_key_id': s3_creds['access_key_id'],
                'secret_access_key': s3_creds['secret_access_key']
            }
        )
        
        # Create Snowpipe
        full_pipe_name = f"{target_database}.{target_schema}.{pipe_name}"
        create_snowpipe(
            conn,
            target_database,
            target_schema,
            pipe_name,
            f"{target_database}.{target_schema}.{stage_name}",
            f"{target_database}.{target_schema}.{target_table}",
            file_format
        )
        
        return {
            "status": "success",
            "pipe_name": full_pipe_name
        }
    finally:
        conn.close()

