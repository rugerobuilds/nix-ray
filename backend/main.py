import os
import secrets
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import parsers

# SESSION SECURITY
API_KEY = secrets.token_urlsafe(32)
api_key_header = APIKeyHeader(name="X-NIXRAY-KEY", auto_error=True)

# DIRECTORY MAPPING
# From backend/main.py, we go up one level then into 'frontend'
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

app = FastAPI(title="NIX-RAY // Secure Edition")

print(f"\n" + "="*40)
print(f" NIX-RAY CORE: OPERATIONAL")
print(f" SESSION KEY: {API_KEY}")
print(f" INTERFACE: http://127.0.0.1:8000")
print("="*40 + "\n")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

class ActionRequest(BaseModel):
    password: str = None

# Security Check Dependency
async def get_api_key(api_key: str = Security(api_key_header)):
    if api_key == API_KEY:
        return api_key
    raise HTTPException(status_code=403, detail="Unauthorized Access Blocked")

# --- UI SERVING ---

@app.get("/")
async def serve_dashboard():
    """Serves the main entry point from the frontend folder."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# Mount the frontend directory so app.js and style.css are available at /static/
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# --- API ENDPOINTS ---

@app.get("/packages/all", dependencies=[Depends(get_api_key)])
async def get_all():
    return {
        "pip": parsers.get_pip_packages(),
        "snap": parsers.get_snap_packages(),
        "apt": parsers.get_apt_packages()
    }

@app.get("/details/{manager}/{package_name}", dependencies=[Depends(get_api_key)])
async def get_details(manager: str, package_name: str):
    return parsers.get_package_info(manager, package_name)

@app.post("/packages/{manager}/{package_name}", dependencies=[Depends(get_api_key)])
async def delete_package(manager: str, package_name: str, req: ActionRequest):
    return parsers.remove_package(manager, package_name, req.password)