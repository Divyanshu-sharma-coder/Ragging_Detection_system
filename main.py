from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router

app = FastAPI(title="Ragging Detection API", version="1.0.0")

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_FILE = BASE_DIR / "frontend" / "index.html"
STATIC_DIR = BASE_DIR / "static"
FRONTEND_DIR = BASE_DIR / "frontend"

app.include_router(api_router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/frontend-assets", StaticFiles(directory=FRONTEND_DIR), name="frontend-assets")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
def home() -> str:
	return FRONTEND_FILE.read_text(encoding="utf-8")


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
