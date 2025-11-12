from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import connections, pipelines, s3

app = FastAPI(title=settings.PROJECT_NAME)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(connections.router, prefix=settings.API_V1_STR, tags=["connections"])
app.include_router(s3.router, prefix=settings.API_V1_STR, tags=["s3"])
app.include_router(pipelines.router, prefix=settings.API_V1_STR, tags=["pipelines"])


@app.get("/")
def read_root():
    return {"message": "Snowloader API"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

