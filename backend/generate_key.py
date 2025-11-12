#!/usr/bin/env python3
"""Generate encryption key for credential storage."""
from cryptography.fernet import Fernet

if __name__ == "__main__":
    key = Fernet.generate_key()
    print(f"\nGenerated encryption key:")
    print(f"{key.decode()}\n")
    print("Add this to your .env file as ENCRYPTION_KEY")

