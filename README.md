# Snowloader - Snowflake Ingestion Pipeline Builder

A web application that allows data engineers to build ingestion pipelines into Snowflake cloud database. This app manages all the elements involved in setting up an ingestion pipeline into Snowflake, providing a "one-click" solution while allowing for all the options and customizations that Snowflake offers.

## Features

- **Easy Connection Management**: Connect to S3 and Snowflake with encrypted credential storage
- **One-Time Ingestion**: Load specific files from S3 into Snowflake tables
- **Continuous Ingestion**: Create Snowpipe pipelines for automatic file ingestion
- **Pipeline Management**: Monitor and manage all your ingestion pipelines in one place
- **Secure Authentication**: Powered by Clerk for user authentication

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Python FastAPI
- **Database**: PostgreSQL
- **Authentication**: Clerk
- **Cloud**: AWS (S3)

## Prerequisites

- Node.js 20+ and npm
- Python 3.10+ (3.12 recommended)
- Poetry for Python dependency management
- PostgreSQL 15+
- Clerk account (for authentication)
- AWS account with S3 access
- Snowflake account

## Setup Instructions

### 1. Clone and Navigate

```bash
cd app
```

### 2. Set Up Backend

```bash
cd backend

# Install Poetry if you haven't already
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Generate encryption key for credentials
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copy the output - you'll need it for ENCRYPTION_KEY

# Create .env file
cp .env.example .env
# Edit .env and add:
# - DATABASE_URL (PostgreSQL connection string)
# - CLERK_SECRET_KEY (from Clerk dashboard)
# - ENCRYPTION_KEY (from the command above)
# - AWS credentials (optional, can use IAM roles)
```

### 3. Set Up Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add:
# - VITE_CLERK_PUBLISHABLE_KEY (from Clerk dashboard)
# - VITE_API_URL (http://localhost:8000 for local dev)
```

### 4. Set Up Clerk

1. Sign up at https://clerk.com
2. Create a new application
3. Get your Publishable Key and Secret Key from the dashboard
4. Add `http://localhost:5173` to allowed origins in Clerk settings

### 5. Set Up Database

```bash
# Start PostgreSQL (using Docker Compose)
cd ..
docker-compose up -d postgres

# Initialize database tables
cd backend
poetry run python app/db/init_db.py
```

### 6. Run the Application

#### Option A: Using Docker Compose (Recommended)

```bash
# From the app directory
docker-compose up
```

This will start:
- PostgreSQL on port 5432
- Backend API on port 8000
- Frontend on port 5173

#### Option B: Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
poetry run uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 7. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Usage

1. **Sign Up / Sign In**: Use Clerk authentication
2. **Create Connections**:
   - Add S3 connection (Access Key, Secret Key, Bucket, Region)
   - Add Snowflake connection (Account, User, Password, Warehouse, Database, Schema)
3. **Create Pipeline**:
   - Choose ingestion type (One-Time or Snowpipe)
   - Select S3 and Snowflake connections
   - Select file(s) or configure S3 path/prefix
   - Configure target database, schema, and table
   - Create pipeline

## Project Structure

```
app/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   └── utils/         # API utilities
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/          # API routes and models
│   │   ├── core/         # Core configuration
│   │   ├── db/           # Database setup
│   │   └── services/     # Business logic services
└── docker-compose.yml  # Local development setup
```

## Environment Variables

### Backend (.env)
- `DATABASE_URL`: PostgreSQL connection string
- `CLERK_SECRET_KEY`: Clerk backend secret key
- `ENCRYPTION_KEY`: Fernet encryption key (32 bytes, base64 encoded)
- `AWS_ACCESS_KEY_ID`: (Optional) AWS access key
- `AWS_SECRET_ACCESS_KEY`: (Optional) AWS secret key

### Frontend (.env)
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `VITE_API_URL`: Backend API URL

## Development

### Backend
```bash
cd backend
poetry run uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm run dev
```

## Architecture Notes

- **Snowflake Objects as Application Logic**: All Snowflake objects (tables, stages, pipes) are managed directly via SQL through the application, not through Terraform or infrastructure-as-code
- **Encrypted Credentials**: All connection credentials are encrypted at rest using Fernet symmetric encryption
- **JWT Authentication**: Clerk handles authentication, backend verifies JWT tokens on each request

## Future Enhancements

- Advanced Snowflake options (file format customization, transformations)
- Enhanced Snowpipe monitoring and error tracking
- S3 event notification integration for automatic Snowpipe triggering
- Observability dashboard with pipeline health metrics
- Email/Slack notifications for pipeline failures
- Stripe subscription integration
- Multi-user workspaces/organizations

## License

[Your License Here]

