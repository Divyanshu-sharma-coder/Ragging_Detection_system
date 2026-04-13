from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router

app = FastAPI(title="Ragging Detection API", version="1.0.0")

app.include_router(api_router)

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/")
def home() -> dict[str, str]:
	return {
		"message": "Smart Eye Detection API is running.",
		"frontend": "Run Vite frontend at http://127.0.0.1:5173",
	}


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
