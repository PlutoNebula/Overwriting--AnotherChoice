from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from literary_agent.config import load_settings
from literary_agent.graph import run_pipeline
from literary_agent.mock_llm import MockLLM
from literary_agent.storage import sanitize_name

ALLOWED_SUFFIXES = (".txt", ".md")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

app = FastAPI(title="文学解读 Agent 后端", version="0.1.0")

# 前端（web/）或第三方客户端跨域调用时放行；生产环境应收紧 allow_origins。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ImportResponse(BaseModel):
    work_id: str
    filename: str
    saved_path: str


class GenerateRequest(BaseModel):
    filename: str = Field(..., description="import 接口返回的 filename")
    review: bool = True
    model: str | None = None
    max_revisions: int | None = None
    dry_run: bool = False


class GenerateResponse(BaseModel):
    work_id: str
    work_name: str
    status: str
    outputs: dict[str, str]
    review_passed: bool
    revision_count: int
    review_history: list[dict]
    work_dir: str
    errors: list[str]


def _make_checkpointer():
    """优先 SQLite 持久化（断点续跑），失败退回内存。"""
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver

        return SqliteSaver.from_conn_string("checkpoint.sqlite")
    except Exception:  # noqa: BLE001
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/import", response_model=ImportResponse)
async def import_txt(file: UploadFile = File(...)) -> ImportResponse:
    """导入 txt（或 md）文件：存入 inputs/，返回后续生成用的 filename。"""
    original = file.filename or "未命名.txt"
    suffix = Path(original).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="仅支持 .txt / .md 文件")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="文件超过 10 MB 上限")
    if not content.strip():
        raise HTTPException(status_code=400, detail="文件内容为空")

    settings = load_settings()
    settings.inputs_dir.mkdir(parents=True, exist_ok=True)
    work_id = sanitize_name(Path(original).stem)
    dest = settings.inputs_dir / f"{work_id}{suffix}"
    dest.write_bytes(content)

    return ImportResponse(work_id=work_id, filename=dest.name, saved_path=str(dest))


@app.post("/api/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    """对已导入的文件跑 Agent 流水线，回传生成的剧本摘要/人物信息/世界书。"""
    settings = load_settings()
    if req.model:
        settings.model = req.model
    if req.max_revisions is not None:
        settings.max_revisions = req.max_revisions

    source = settings.inputs_dir / req.filename
    if not source.exists():
        raise HTTPException(status_code=404, detail=f"文件不存在: {req.filename}")

    if req.dry_run:
        from langgraph.checkpoint.memory import MemorySaver

        llm = MockLLM(review_mode="fail_then_pass" if req.review else "pass")
        checkpointer = MemorySaver()
    else:
        from literary_agent.llm import build_llm

        llm = build_llm(settings)
        checkpointer = _make_checkpointer()

    final = run_pipeline(
        source,
        settings=settings,
        llm=llm,
        checkpointer=checkpointer,
        enable_review=req.review,
    )

    return GenerateResponse(
        work_id=source.stem,
        work_name=final.get("work_name", source.stem),
        status=final.get("status", "done"),
        outputs=final.get("outputs", {}),
        review_passed=bool(final.get("review_passed")),
        revision_count=final.get("revision_count", 0),
        review_history=final.get("review_history", []),
        work_dir=final.get("work_dir", ""),
        errors=final.get("errors", []),
    )


@app.get("/api/works")
def list_works() -> dict:
    """列出已生成的作品目录。"""
    settings = load_settings()
    works = []
    if settings.works_dir.is_dir():
        for d in sorted(settings.works_dir.iterdir()):
            if d.is_dir():
                works.append({"work_id": d.name, "work_dir": str(d)})
    return {"works": works}


@app.get("/api/works/{work_id}")
def get_work(work_id: str) -> dict:
    """按 work_id 回传落盘后的生成内容（{相对路径: 内容}）。"""
    settings = load_settings()
    work_dir = settings.works_dir / sanitize_name(work_id)
    if not work_dir.is_dir():
        raise HTTPException(status_code=404, detail="作品不存在")
    files = {}
    for p in sorted(work_dir.rglob("*")):
        if p.is_file():
            files[str(p.relative_to(work_dir))] = p.read_text(encoding="utf-8", errors="replace")
    return {"work_id": work_id, "work_dir": str(work_dir), "files": files}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000)
