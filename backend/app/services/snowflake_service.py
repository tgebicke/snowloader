import snowflake.connector
from typing import Dict, Optional, List


def get_snowflake_connection(account: str, user: str, password: str, warehouse: Optional[str] = None, database: Optional[str] = None, schema: Optional[str] = None, role: Optional[str] = None):
    """Create Snowflake connection."""
    connection_params = {
        "user": user,
        "password": password,
        "account": account
    }
    if warehouse:
        connection_params["warehouse"] = warehouse
    if database:
        connection_params["database"] = database
    if schema:
        connection_params["schema"] = schema
    if role:
        connection_params["role"] = role
    return snowflake.connector.connect(**connection_params)


def test_snowflake_connection(account: str, user: str, password: str, warehouse: Optional[str] = None, database: Optional[str] = None, schema: Optional[str] = None, role: Optional[str] = None):
    """Test Snowflake connection."""
    try:
        conn = get_snowflake_connection(account, user, password, warehouse, database, schema, role)
        conn.close()
    except Exception as e:
        raise Exception(f"Snowflake connection failed: {str(e)}")


def execute_sql(conn, sql: str, params: Optional[Dict] = None):
    """Execute SQL statement."""
    cursor = conn.cursor()
    try:
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchall() if cursor.description else None
    finally:
        cursor.close()


def list_databases(conn) -> List[str]:
    """List all databases available to the current user."""
    cursor = conn.cursor()
    try:
        cursor.execute("SHOW DATABASES")
        results = cursor.fetchall()
        # SHOW DATABASES returns columns: created_on, name, is_default, is_current, origin, owner, comment, options, retention_time
        # The name is typically at index 1
        databases = []
        for row in results:
            if len(row) > 1:
                db_name = row[1]  # name column
                if db_name:  # Filter out None/empty
                    databases.append(db_name)
        return databases
    finally:
        cursor.close()


def list_schemas(conn, database: Optional[str] = None) -> List[str]:
    """List all schemas in a database. If database is None, uses current database."""
    cursor = conn.cursor()
    try:
        if database:
            cursor.execute(f"SHOW SCHEMAS IN DATABASE {database}")
        else:
            cursor.execute("SHOW SCHEMAS")
        results = cursor.fetchall()
        # Results format: (created_on, name, ...)
        # Extract schema names (typically second column, but may vary)
        schemas = []
        for row in results:
            # Find the name column (usually index 1 or 2)
            if len(row) > 1:
                # Try to find the name field
                for i, val in enumerate(row):
                    if isinstance(val, str) and val.upper() not in ['PUBLIC', 'INFORMATION_SCHEMA'] or i == 1:
                        if isinstance(val, str):
                            schemas.append(val)
                            break
                else:
                    # Fallback: use second column
                    if len(row) > 1:
                        schemas.append(str(row[1]))
        return schemas if schemas else [row[1] if len(row) > 1 else str(row[0]) for row in results]
    finally:
        cursor.close()


def create_table_from_schema(conn, database: str, schema: str, table_name: str, columns: List[Dict]):
    """Create table from column definitions."""
    # Build CREATE TABLE statement
    column_defs = []
    for col in columns:
        col_def = f"{col['name']} {col['type']}"
        if col.get('nullable', True) is False:
            col_def += " NOT NULL"
        column_defs.append(col_def)
    
    create_sql = f"""
    CREATE TABLE IF NOT EXISTS {database}.{schema}.{table_name} (
        {', '.join(column_defs)}
    )
    """
    
    execute_sql(conn, create_sql)


def create_external_stage(conn, database: str, schema: str, stage_name: str, s3_url: str, aws_credentials: Dict):
    """Create external stage pointing to S3."""
    create_sql = f"""
    CREATE OR REPLACE STAGE {database}.{schema}.{stage_name}
    URL = '{s3_url}'
    CREDENTIALS = (AWS_KEY_ID = '{aws_credentials['access_key_id']}' AWS_SECRET_KEY = '{aws_credentials['secret_access_key']}')
    """
    
    execute_sql(conn, create_sql)
    return stage_name


def create_snowpipe(conn, database: str, schema: str, pipe_name: str, stage_name: str, table_name: str, file_format: str = "JSON", copy_options: Optional[Dict] = None):
    """Create Snowpipe for continuous ingestion with AUTO_INGEST enabled."""
    # Build FILE_FORMAT options
    file_format_options = build_file_format_options(file_format, copy_options)
    
    # Build COPY INTO statement based on format type
    if file_format.upper() == "JSON":
        # For JSON, map to VARIANT column and include metadata
        copy_sql = f"""COPY INTO {database}.{schema}.{table_name} (raw_data, metadata_filename, metadata_file_row_number, metadata_file_content_key, metadata_file_last_modified)
FROM (
    SELECT 
        $1::VARIANT AS raw_data,
        METADATA$FILENAME AS metadata_filename,
        METADATA$FILE_ROW_NUMBER AS metadata_file_row_number,
        METADATA$FILE_CONTENT_KEY AS metadata_file_content_key,
        METADATA$FILE_LAST_MODIFIED AS metadata_file_last_modified
    FROM @{database}.{schema}.{stage_name}
)
FILE_FORMAT = ({file_format_options})"""
    else:
        # For other formats (future support)
        copy_sql = f"""COPY INTO {database}.{schema}.{table_name}
FROM @{database}.{schema}.{stage_name}
FILE_FORMAT = ({file_format_options})"""
    
    create_sql = f"""
    CREATE OR REPLACE PIPE {database}.{schema}.{pipe_name}
    AUTO_INGEST = TRUE
    AS
    {copy_sql}
    """
    
    execute_sql(conn, create_sql)
    return pipe_name


def get_snowpipe_sqs_arn(conn, database: str, schema: str, pipe_name: str) -> str:
    """Get SQS ARN from Snowpipe using DESCRIBE PIPE."""
    cursor = conn.cursor()
    try:
        describe_sql = f"DESC PIPE {database}.{schema}.{pipe_name}"
        cursor.execute(describe_sql)
        result = cursor.fetchall()
        
        # DESCRIBE PIPE returns a result set with columns
        # The exact format may vary, but typically includes property names and values
        # Look for notification-related properties
        
        # First, let's check what columns we have
        column_names = [desc[0] for desc in cursor.description] if cursor.description else []
        
        # Try to find the notification channel/SQS ARN
        # It might be in different columns depending on Snowflake version
        for row in result:
            # Check all columns for SQS ARN patterns (arn:aws:sqs:)
            for i, value in enumerate(row):
                if value and isinstance(value, str):
                    value_str = str(value).strip()
                    # Look for SQS ARN pattern
                    if value_str.startswith("arn:aws:sqs:") or "sqs" in value_str.lower():
                        return value_str
                    # Also check if this column name suggests it's the notification channel
                    if i < len(column_names):
                        col_name = str(column_names[i]).upper()
                        if "NOTIFICATION" in col_name or "CHANNEL" in col_name or "SQS" in col_name:
                            if value_str:
                                return value_str
            
            # Also check if row[0] is a property name and row[1] is the value
            if len(row) >= 2:
                property_name = str(row[0]).upper() if row[0] else ""
                property_value = str(row[1]).strip() if row[1] else ""
                
                # Check various possible property names
                if any(keyword in property_name for keyword in ["NOTIFICATION", "CHANNEL", "SQS", "QUEUE"]):
                    if property_value and (property_value.startswith("arn:aws:sqs:") or "sqs" in property_value.lower()):
                        return property_value
                
                # If property name matches and value exists, return it
                if property_name in ["NOTIFICATION_CHANNEL", "CHANNEL", "SQS_ARN"] and property_value:
                    return property_value
        
        # If we still haven't found it, raise an error with debug info
        debug_info = f"Columns: {column_names}, Rows: {len(result)}"
        raise Exception(f"SQS ARN not found in pipe description. {debug_info}. Pipe may not have AUTO_INGEST enabled or may need a moment to initialize.")
    finally:
        cursor.close()


def build_file_format_options(file_format: str, copy_options: Optional[Dict] = None) -> str:
    """Build FILE_FORMAT options string from file format and copy options."""
    options = []
    
    # Always include TYPE
    options.append(f"TYPE = '{file_format.upper()}'")
    
    if file_format.upper() == "CSV":
        # CSV default options
        if copy_options:
            if 'field_delimiter' in copy_options and copy_options['field_delimiter']:
                options.append(f"FIELD_DELIMITER = '{copy_options['field_delimiter']}'")
            if 'record_delimiter' in copy_options and copy_options['record_delimiter']:
                # Handle escape sequences
                record_delim = copy_options['record_delimiter'].replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                options.append(f"RECORD_DELIMITER = '{record_delim}'")
            # Skip header - use provided value or default to 1
            skip_header = copy_options.get('skip_header', 1)
            options.append(f"SKIP_HEADER = {skip_header}")
            # Field optionally enclosed by - use provided value or default to double quote
            field_enclosed = copy_options.get('field_optionally_enclosed_by', '"')
            options.append(f"FIELD_OPTIONALLY_ENCLOSED_BY = '{field_enclosed}'")
            # Trim space - default to True if not specified
            if copy_options.get('trim_space', True):
                options.append("TRIM_SPACE = TRUE")
            if copy_options.get('error_on_column_count_mismatch', False):
                options.append("ERROR_ON_COLUMN_COUNT_MISMATCH = TRUE")
        else:
            # Default CSV options
            options.extend([
                "SKIP_HEADER = 1",
                "FIELD_OPTIONALLY_ENCLOSED_BY = '\"'",
                "TRIM_SPACE = TRUE"
            ])
    elif file_format.upper() == "JSON":
        # JSON options
        if copy_options:
            if copy_options.get('strip_outer_array', False):
                options.append("STRIP_OUTER_ARRAY = TRUE")
            if copy_options.get('replace_invalid_characters', False):
                options.append("REPLACE_INVALID_CHARACTERS = TRUE")
            if copy_options.get('ignore_utf8_errors', False):
                options.append("IGNORE_UTF8_ERRORS = TRUE")
    
    return ", ".join(options)


def copy_into_table(conn, database: str, schema: str, table_name: str, stage_name: str, file_pattern: str, file_format: str = "CSV", copy_options: Optional[Dict] = None):
    """Execute COPY INTO command for one-time ingestion."""
    # Use FILES parameter to specify the file pattern
    # Escape single quotes in file_pattern if present
    file_pattern_escaped = file_pattern.replace("'", "''")
    
    # Build FILE_FORMAT options
    file_format_options = build_file_format_options(file_format, copy_options)
    
    # Build COPY INTO statement based on format type
    if file_format.upper() == "CSV":
        # For CSV, copy directly into columns
        copy_sql = f"""COPY INTO {database}.{schema}.{table_name}
FROM @{database}.{schema}.{stage_name}
FILES = ('{file_pattern_escaped}')
FILE_FORMAT = ({file_format_options})"""
    elif file_format.upper() == "JSON":
        # For JSON, map to VARIANT column and include metadata
        copy_sql = f"""COPY INTO {database}.{schema}.{table_name} (raw_data, metadata_filename, metadata_file_row_number, metadata_file_content_key, metadata_file_last_modified)
FROM (
    SELECT 
        $1::VARIANT AS raw_data,
        METADATA$FILENAME AS metadata_filename,
        METADATA$FILE_ROW_NUMBER AS metadata_file_row_number,
        METADATA$FILE_CONTENT_KEY AS metadata_file_content_key,
        METADATA$FILE_LAST_MODIFIED AS metadata_file_last_modified
    FROM @{database}.{schema}.{stage_name}
)
FILES = ('{file_pattern_escaped}')
FILE_FORMAT = ({file_format_options})"""
    else:
        copy_sql = f"""COPY INTO {database}.{schema}.{table_name}
FROM @{database}.{schema}.{stage_name}
FILES = ('{file_pattern_escaped}')
FILE_FORMAT = ({file_format_options})"""
    
    cursor = conn.cursor()
    try:
        cursor.execute(copy_sql)
        # COPY INTO returns status information
        # The result shows: file, status, rows_parsed, rows_loaded, error_limit, errors_seen, first_error, first_error_line, first_error_character, first_error_column_name
        result = cursor.fetchall()
        
        # Extract rows_loaded from the result
        # Result format: [(file, status, rows_parsed, rows_loaded, ...), ...]
        # Index 0: file, 1: status, 2: rows_parsed, 3: rows_loaded
        rows_loaded = 0
        if result and len(result) > 0:
            row = result[0]
            
            # Try to get rows_loaded from index 3
            if len(row) > 3:
                rows_loaded_value = row[3]
                # Convert to int, handling both int and string numeric values
                if isinstance(rows_loaded_value, (int, float)):
                    rows_loaded = int(rows_loaded_value)
                elif isinstance(rows_loaded_value, str) and rows_loaded_value.strip().isdigit():
                    # Only parse if it's a numeric string
                    rows_loaded = int(rows_loaded_value)
                else:
                    # If it's not a number (like 'LOADED'), try rows_parsed at index 2
                    if len(row) > 2:
                        rows_parsed_value = row[2]
                        if isinstance(rows_parsed_value, (int, float)):
                            rows_loaded = int(rows_parsed_value)
                        elif isinstance(rows_parsed_value, str) and rows_parsed_value.strip().isdigit():
                            rows_loaded = int(rows_parsed_value)
            # Fallback: try rows_parsed if rows_loaded wasn't available
            elif len(row) > 2:
                rows_parsed_value = row[2]
                if isinstance(rows_parsed_value, (int, float)):
                    rows_loaded = int(rows_parsed_value)
                elif isinstance(rows_parsed_value, str) and rows_parsed_value.strip().isdigit():
                    rows_loaded = int(rows_parsed_value)
        
        # Ensure we always return an integer
        rows_loaded = int(rows_loaded) if rows_loaded else 0
        
        return {"rows_loaded": rows_loaded, "result": result}
    finally:
        cursor.close()

