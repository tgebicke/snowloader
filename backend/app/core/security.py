from cryptography.fernet import Fernet
from app.core.config import settings


def get_encryption_cipher() -> Fernet:
    """Get Fernet cipher for encrypting/decrypting credentials."""
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_data(data: str) -> str:
    """Encrypt sensitive data."""
    cipher = get_encryption_cipher()
    return cipher.encrypt(data.encode()).decode()


def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data."""
    cipher = get_encryption_cipher()
    return cipher.decrypt(encrypted_data.encode()).decode()

