from pathlib import Path
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from .config import PDF_DIR, UPLOAD_DIR, STATIC_DIR, TEMPLATE_DIR
from .rag_service import RAGService

app = FastAPI(
    title="AI Study Assistant using RAG",
    version="1.0.0",
    description="Python study assistant powered by embeddings, ChromaDB and Groq.",
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATE_DIR)

rag = RAGService()

class QueryRequest(BaseModel):
    question: str
    top_k: int = 5

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"request": request},
    )

@app.get("/api/health")
async def health():
    return {"status": "ok", "stats": rag.stats()}

@app.post("/api/upload")
async def upload_pdfs(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one PDF.")

    saved = []

    # Replace the upload folder contents with the current upload set.
    for existing in UPLOAD_DIR.glob("*.pdf"):
        existing.unlink()

    for upload in files:
        if not upload.filename.lower().endswith(".pdf"):
            continue

        safe_name = Path(upload.filename).name
        destination = UPLOAD_DIR / safe_name

        with destination.open("wb") as buffer:
            shutil.copyfileobj(upload.file, buffer)

        saved.append(safe_name)

    if not saved:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    return {
        "message": f"{len(saved)} PDF file(s) uploaded.",
        "files": saved,
        "count": len(saved),
    }

@app.post("/api/index")
async def build_index():
    pdf_paths = sorted(UPLOAD_DIR.glob("*.pdf"))

    if len(pdf_paths) != 5:
        raise HTTPException(
            status_code=400,
            detail=f"Please upload exactly 5 PDF files. Found {len(pdf_paths)}.",
        )

    result = rag.build_index(pdf_paths)
    return {
        "message": "Embeddings created and saved to ChromaDB.",
        **result,
    }

@app.post("/api/query")
async def query(request: QueryRequest):
    question = request.question.strip()

    if len(question) < 3:
        raise HTTPException(
            status_code=400,
            detail="Please enter a meaningful question.",
        )

    try:
        return rag.query(question, top_k=max(1, min(request.top_k, 10)))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/api/stats")
async def stats():
    return rag.stats()
