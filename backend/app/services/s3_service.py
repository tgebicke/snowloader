import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from typing import List, Dict, Optional


def get_s3_client(access_key_id: str, secret_access_key: str, region: str):
    """Create S3 client with credentials."""
    return boto3.client(
        's3',
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name=region
    )


def test_s3_connection(access_key_id: str, secret_access_key: str, region: str):
    """Test S3 connection by listing buckets."""
    try:
        s3_client = get_s3_client(access_key_id, secret_access_key, region)
        # Test by listing buckets - this validates credentials
        s3_client.list_buckets()
    except ClientError as e:
        raise Exception(f"S3 connection failed: {str(e)}")
    except NoCredentialsError:
        raise Exception("Invalid AWS credentials")


def list_buckets(access_key_id: str, secret_access_key: str, region: str = "us-east-1") -> List[str]:
    """List all buckets available to the AWS credentials."""
    try:
        s3_client = get_s3_client(access_key_id, secret_access_key, region)
        response = s3_client.list_buckets()
        buckets = [bucket['Name'] for bucket in response.get('Buckets', [])]
        return sorted(buckets)
    except ClientError as e:
        raise Exception(f"Failed to list buckets: {str(e)}")
    except NoCredentialsError:
        raise Exception("Invalid AWS credentials")


def list_s3_files(access_key_id: str, secret_access_key: str, bucket: str, prefix: str = "", region: str = "us-east-1") -> List[Dict]:
    """List files in S3 bucket with optional prefix."""
    s3_client = get_s3_client(access_key_id, secret_access_key, region)
    
    try:
        response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        files = []
        if 'Contents' in response:
            for obj in response['Contents']:
                files.append({
                    "key": obj['Key'],
                    "size": obj['Size'],
                    "last_modified": obj['LastModified'].isoformat()
                })
        return files
    except ClientError as e:
        raise Exception(f"Failed to list S3 files: {str(e)}")


def preview_s3_file(access_key_id: str, secret_access_key: str, bucket: str, key: str, region: str = "us-east-1", lines: int = 10) -> List[str]:
    """Preview first N lines of an S3 file."""
    s3_client = get_s3_client(access_key_id, secret_access_key, region)
    
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        content = response['Body'].read().decode('utf-8')
        return content.split('\n')[:lines]
    except ClientError as e:
        raise Exception(f"Failed to preview S3 file: {str(e)}")


def create_s3_event_notification(
    access_key_id: str,
    secret_access_key: str,
    bucket: str,
    prefix: str,
    sqs_arn: str,
    region: str = "us-east-1"
) -> str:
    """Create S3 event notification for Snowpipe auto-ingest.
    
    Args:
        access_key_id: AWS access key ID
        secret_access_key: AWS secret access key
        bucket: S3 bucket name
        prefix: S3 prefix/path to monitor
        sqs_arn: SQS ARN from Snowpipe
        region: AWS region
        
    Returns:
        Event notification configuration ID
    """
    s3_client = get_s3_client(access_key_id, secret_access_key, region)
    
    try:
        # Normalize prefix - remove leading slash, ensure trailing slash if not empty
        normalized_prefix = prefix.strip('/')
        if normalized_prefix and not normalized_prefix.endswith('/'):
            normalized_prefix += '/'
        
        # Create event notification configuration
        # Snowpipe expects events on object creation
        notification_config = {
            'QueueConfigurations': [
                {
                    'QueueArn': sqs_arn,
                    'Events': ['s3:ObjectCreated:*'],  # Trigger on any object creation
                    'Filter': {
                        'Key': {
                            'FilterRules': [
                                {
                                    'Name': 'prefix',
                                    'Value': normalized_prefix
                                }
                            ]
                        }
                    }
                }
            ]
        }
        
        # Get existing notification configuration
        try:
            existing_config = s3_client.get_bucket_notification_configuration(Bucket=bucket)
            
            # Merge with existing queue configurations
            existing_queues = existing_config.get('QueueConfigurations', [])
            # Check if this SQS ARN already exists
            for queue_config in existing_queues:
                if queue_config.get('QueueArn') == sqs_arn:
                    # Update existing configuration
                    notification_config['QueueConfigurations'] = existing_queues
                    break
            else:
                # Add new queue configuration
                notification_config['QueueConfigurations'] = existing_queues + notification_config['QueueConfigurations']
        except ClientError:
            # No existing configuration, use new one
            pass
        
        # Put the notification configuration
        s3_client.put_bucket_notification_configuration(
            Bucket=bucket,
            NotificationConfiguration=notification_config
        )
        
        return f"Event notification created for prefix: {normalized_prefix}"
    except ClientError as e:
        raise Exception(f"Failed to create S3 event notification: {str(e)}")

