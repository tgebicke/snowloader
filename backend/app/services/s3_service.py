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

