from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from literary_agent.config import load_settings
from literary_agent.graph import run_pipeline
from literary_agent.mock_llm import MockLLM
from literary_agent.overwrite import run_overwrite, run_overwrite_chapter
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
        import sqlite3

        from langgraph.checkpoint.sqlite import SqliteSaver

        conn = sqlite3.connect("checkpoint.sqlite", check_same_thread=False)
        return SqliteSaver(conn)
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


# ============================================================================
# §5.6 剧情覆写工作台 · 后端接口
# ----------------------------------------------------------------------------
# POST /api/overwrite         起点章一次性推演（Stage 3 结果）
# POST /api/overwrite/chapter 全书顺序改写：后续每一章调用一次
#
# 下面四个下划线函数（_overwrite_stub / _build_overwrite_prompt /
# _chapter_stub / _build_chapter_prompt）是旧版单次 LLM 调用的实现，
# 现在主路径走 literary_agent.overwrite.run_overwrite (classify→tavern→
# rewrite→review 回路)，但保留它们作为：
#   1) 无 langgraph / mock_llm 环境下的极简回退；
#   2) 独立单元测试可直接调用；
#   3) 未来若要在 /api/overwrite 上加"快通道"模式，直接复用。
# ============================================================================

TONE_HINTS: dict[str, str] = {
    "darker": "让代价更沉重、结局更冷",
    "gentler": "让人物得到抚慰、笔触更温柔",
    "twisty": "增加出乎意料的反转",
    "noir": "悬念大于结论，气氛紧绷",
    "romantic": "让人物关系流动，暧昧张力",
    "political": "让立场先于情感，博弈明显",
    "mythic": "神秘、留白，不解释所有的事",
    "grounded": "写实，让魔法退到幕后",
}

STRENGTH_HINTS: dict[str, str] = {
    "soft": "沿着原作方向轻推一步",
    "medium": "让一个关键事实换向",
    "strong": "推翻一个原本必然的结局",
}

MODE_HINTS: dict[str, str] = {
    "end-of-chapter": "从当前章节结尾之后开始改编",
    "from-selection": "从读者选中的一句原文开始改编",
    "from-inscription": "把读者的一枚续章铭文发展为新剧情",
}


def _tone_lines(tones: list[str]) -> str:
    if not tones:
        return "（未指定倾向）"
    return "、".join(f"{t}（{TONE_HINTS.get(t, t)}）" for t in tones)


def _fmt_prev_summaries(prev_summaries: list[dict[str, Any]] | None) -> str:
    if not prev_summaries:
        return "（此前尚无章节摘要）"
    lines = []
    for it in prev_summaries:
        ch = it.get("ch")
        title = (it.get("title") or "").strip()
        summary = (it.get("summary") or "").strip()
        lines.append(f"- 第 {int(ch) + 1 if ch is not None else '?'} 节"
                     f"{'『' + title + '』' if title else ''}：{summary or '（无）'}")
    return "\n".join(lines)


def _fmt_prev_two_chapters(prev_two: list[dict[str, Any]] | None) -> str:
    if not prev_two:
        return "（无上文全文可供参考）"
    blocks = []
    for it in prev_two:
        ch = it.get("ch")
        title = (it.get("title") or "").strip()
        narrative = (it.get("narrative") or "").strip()
        blocks.append(
            f"—— 第 {int(ch) + 1 if ch is not None else '?'} 节"
            f"{'『' + title + '』' if title else ''} ——\n{narrative or '（空）'}"
        )
    return "\n\n".join(blocks)


class OverwriteBook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = ""
    title: str = ""
    author: str = ""


class OverwriteOrigin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ch: int = 0
    ch_title: str = ""
    para: int | None = None
    quote: str = ""
    mode: str = "end-of-chapter"
    from_ins: str | None = None


class OverwriteRequest(BaseModel):
    """POST /api/overwrite —— 与前端 overwrite.js 的 _buildPayload 严格对齐。"""

    model_config = ConfigDict(extra="ignore")

    book: OverwriteBook = Field(default_factory=OverwriteBook)
    origin: OverwriteOrigin = Field(default_factory=OverwriteOrigin)
    context: str = ""
    prompt: str = ""
    tones: list[str] = Field(default_factory=list)
    strength: str = "medium"
    constraints: str = ""


class OverwriteResponse(BaseModel):
    title: str = ""
    narrative: str = ""
    changes: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    nextDirections: list[str] = Field(default_factory=list)
    strength: str = "medium"
    demo: bool = False


class OverwriteResultSchema(BaseModel):
    """DeepSeek 返回的 JSON 结构（后端内部使用；字段名允许 snake_case 别名）。"""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    title: str = ""
    narrative: str = ""
    changes: list[str] = Field(default_factory=list, alias="key_changes")
    conflicts: list[str] = Field(default_factory=list, alias="setting_conflicts")
    next_directions: list[str] = Field(default_factory=list)


def _overwrite_stub(req: OverwriteRequest) -> OverwriteResponse:
    """无 API key 时的兜底：与前端 stubResult 逻辑对齐但内容独立。"""
    quote = req.origin.quote or "（未选中原文）"
    intent = (req.prompt or "").strip()[:60]
    lines = [
        f"（后端演示 · 从第 {req.origin.ch + 1} 节起）",
        f"「{quote}」之后 —— 事情没有按原作那样发生。",
        f"读者的意图「{intent or '未指明'}」在这里推动了一次换向：",
        "一位在原作里被记漏了名字的守灯人从阴影里走出来，把一枚布签放在纸上。"
        "布签上的字，是主角第一次值夜时写下、又被读走的那一个。",
        "第七盏灯的油面第一次颤动。灯芯没有熄，只是短暂地弯下去，"
        "像在等她开口。"
        + ("这一夜，抄经室换了一位新的总务修士。"
           if req.strength == "strong" else
           "这一夜，她没有交出灯，也没有开口。"),
    ]
    return OverwriteResponse(
        title=("分支 · " + (intent[:12] or req.origin.ch_title[:12] or "未命名")).strip(),
        narrative="\n\n".join(lines),
        changes=[
            "原作里没有说出的守灯人被引入正面场景",
            "油灯的『从不见少』被解释为『有人替她记着』",
        ],
        conflicts=[
            "需要与原作里『抄经室只说得太省』的调子保持一致",
            "第八张桌是新增设定，后续需要交代",
        ],
        nextDirections=[
            "让主角在第二夜把布签写满，看看谁在读",
            "让另一位抄书人先她一步发现第八张桌",
            "让原作总务修士回来 —— 但只在灯里出现",
        ],
        strength=req.strength or "medium",
        demo=True,
    )


def _build_overwrite_prompt(req: OverwriteRequest) -> tuple[str, str]:
    """返回 (system, user) 提示词对，供 DeepSeek JSON 模式使用。"""
    system = (
        "你是一位剧情改编写手，专为读者生成『分支剧情』。硬性要求：\n"
        "1) 严格从读者指定的起点位置继续写，不改动原文，只写新分支；\n"
        "2) 语气、称谓、地名、专有术语必须与原文保持一致；\n"
        "3) 不解释你是 AI，不写引言、题记、注释；\n"
        "4) 只输出一个合法 JSON 对象，字段：\n"
        "   - title：不超过 20 字的分支标题\n"
        "   - narrative：150–800 字的新剧情正文（可含多段，用 \\n\\n 分段）\n"
        "   - key_changes：3 条以内『与原作的关键区别』短语\n"
        "   - setting_conflicts：可能与原作设定冲突的点，0–3 条\n"
        "   - next_directions：3 条后续可选剧情走向短语\n"
    )
    user_parts = [
        f"# 秘典\n《{req.book.title}》 · 作者：{req.book.author or '佚名'}",
        f"# 起点位置\n第 {req.origin.ch + 1} 节"
        f"{'『' + req.origin.ch_title + '』' if req.origin.ch_title else ''}"
        f" · {MODE_HINTS.get(req.origin.mode, req.origin.mode)}",
    ]
    if req.origin.quote:
        user_parts.append(f"# 被选中的原文\n「{req.origin.quote}」")
    if req.context:
        user_parts.append(f"# 起点章节最后几段原文（仅供参考，不要重复）\n{req.context}")
    user_parts.append(f"# 读者改编意图\n{req.prompt or '（未填写，请顺势换向）'}")
    user_parts.append(f"# 语气倾向\n{_tone_lines(req.tones)}")
    user_parts.append(
        f"# 改编强度\n{req.strength}（{STRENGTH_HINTS.get(req.strength, '')}）"
    )
    if req.constraints:
        user_parts.append(f"# 必须保留的设定\n{req.constraints}")
    user_parts.append("# 输出\n只回一个 JSON 对象，键顺序可以任意。")
    return system, "\n\n".join(user_parts)


@app.post("/api/overwrite", response_model=OverwriteResponse)
def overwrite(req: OverwriteRequest) -> OverwriteResponse:
    """起点章一次性推演：classify → 改世界书(另存) → 改写后文 → review 回路。"""
    settings = load_settings()
    use_demo = not settings.api_key

    if use_demo:
        from langgraph.checkpoint.memory import MemorySaver

        llm = MockLLM(review_mode="pass")
        checkpointer = MemorySaver()
    else:
        try:
            from literary_agent.llm import build_llm

            llm = build_llm(settings)
            checkpointer = _make_checkpointer()
        except Exception:  # noqa: BLE001
            from langgraph.checkpoint.memory import MemorySaver

            llm = MockLLM(review_mode="pass")
            checkpointer = MemorySaver()
            use_demo = True

    final = run_overwrite(req.model_dump(), settings=settings, llm=llm, checkpointer=checkpointer)
    result = final.get("result") or {}
    return OverwriteResponse(
        title=result.get("标题") or f"分支 · {(req.prompt or '').strip()[:12] or '未命名'}",
        narrative=result.get("正文", ""),
        changes=result.get("关键变化", []),
        conflicts=result.get("设定冲突", []),
        nextDirections=result.get("后续方向", []),
        strength=req.strength or "medium",
        demo=use_demo,
    )


# ---------------------------------------------------------------------------
# POST /api/overwrite/chapter —— 全书顺序改写：一次一章
# ---------------------------------------------------------------------------


class OverwriteBranchRef(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = ""
    no: int = 0
    title: str = ""


class OverwriteTarget(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ch: int = 0
    ch_title: str = ""
    origin_text: str = ""


class OverwritePrevSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ch: int = 0
    title: str = ""
    summary: str = ""


class OverwritePrevChapter(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ch: int = 0
    title: str = ""
    narrative: str = ""


class OverwriteChapterRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    book: OverwriteBook = Field(default_factory=OverwriteBook)
    branch: OverwriteBranchRef = Field(default_factory=OverwriteBranchRef)
    origin: OverwriteOrigin = Field(default_factory=OverwriteOrigin)
    target: OverwriteTarget = Field(default_factory=OverwriteTarget)
    prev_summaries: list[OverwritePrevSummary] = Field(default_factory=list)
    prev_two_chapters: list[OverwritePrevChapter] = Field(default_factory=list)
    prompt: str = ""
    tones: list[str] = Field(default_factory=list)
    strength: str = "medium"
    constraints: str = ""


class OverwriteChapterResponse(BaseModel):
    title: str = ""
    narrative: str = ""
    summary: str = ""
    demo: bool = False


class OverwriteChapterResultSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    narrative: str = ""
    summary: str = ""


def _chapter_stub(req: OverwriteChapterRequest) -> OverwriteChapterResponse:
    intent = (req.prompt or "").strip()[:40]
    prev_tail = ""
    if req.prev_two_chapters:
        last = req.prev_two_chapters[-1].narrative or ""
        parts = [p.strip() for p in last.replace("\r", "").split("\n") if p.strip()]
        if parts:
            tail_sentences = [s for s in parts[-1].split("。") if s.strip()]
            if tail_sentences:
                prev_tail = tail_sentences[-1][-40:]
    lines = [
        f"（分支续写 · 第 {req.target.ch + 1} 节"
        f"{'『' + req.target.ch_title + '』' if req.target.ch_title else ''}）",
        f"承上文「…{prev_tail}」——" if prev_tail else "这一节，事情继续朝着另一个方向走。",
        f"「{intent}」的意图仍在推动叙事：" if intent else "读者的改编意图仍在推动叙事：",
        "人物记住了上一节没能说出口的话，本节里被换了一种方式讲出来。"
        "场景没有回到原作既定的落点，而是留出一条空白供后来的章节承接。",
        "（演示：后端未连或 LLM 调用失败，本节由后端 stub 生成。）",
    ]
    narrative = "\n\n".join(x for x in lines if x)
    return OverwriteChapterResponse(
        title=("分支 · " + (req.target.ch_title[:12] or "未命名")).strip(),
        narrative=narrative,
        summary=("意图：" + intent + "。" if intent else "") +
                "本节承接上章走向，未回到原作落点。",
        demo=True,
    )


def _build_chapter_prompt(req: OverwriteChapterRequest) -> tuple[str, str]:
    system = (
        "你是一位剧情改编写手，正在为一条『分支剧情』续写后续章节。硬性要求：\n"
        "1) 严格延续分支的叙事走向，不要回到原作的既定落点；\n"
        "2) 人物、地名、专有术语与原作一致；\n"
        "3) 参照『前面章节摘要』保持长线连贯，参照『上两章正文』保持语气/近景细节一致；\n"
        "4) 本章长度 300–900 字，用 \\n\\n 分段；\n"
        "5) 只输出一个合法 JSON 对象：\n"
        "   - title：不超过 20 字的章节新标题（可保留原作标题或改写）\n"
        "   - narrative：本章新正文\n"
        "   - summary：60–140 字的本章内容摘要，供后续章节续写时参考\n"
    )
    user_parts = [
        f"# 秘典\n《{req.book.title}》 · 作者：{req.book.author or '佚名'}",
        f"# 当前分支\n分支 {req.branch.no:02d}「{req.branch.title or '未命名'}」"
        f" · 起点：第 {req.origin.ch + 1} 节"
        f" · 模式：{MODE_HINTS.get(req.origin.mode, req.origin.mode)}",
        f"# 读者改编意图\n{req.prompt or '（未填写，按分支走向续写）'}",
        f"# 语气倾向\n{_tone_lines(req.tones)}",
        f"# 改编强度\n{req.strength}（{STRENGTH_HINTS.get(req.strength, '')}）",
    ]
    if req.constraints:
        user_parts.append(f"# 必须保留的设定\n{req.constraints}")

    user_parts.append(
        "# 前面章节摘要（原作或已改写章节）\n"
        + _fmt_prev_summaries([s.model_dump() for s in req.prev_summaries])
    )
    user_parts.append(
        "# 上两章完整正文（分支已改写的优先，否则回退原作）\n"
        + _fmt_prev_two_chapters([c.model_dump() for c in req.prev_two_chapters])
    )
    user_parts.append(
        f"# 待改写的本章原文（第 {req.target.ch + 1} 节"
        f"{'『' + req.target.ch_title + '』' if req.target.ch_title else ''}）\n"
        f"{req.target.origin_text or '（空）'}"
    )
    user_parts.append("# 输出\n只回一个 JSON 对象。")
    return system, "\n\n".join(user_parts)


@app.post("/api/overwrite/chapter", response_model=OverwriteChapterResponse)
def overwrite_chapter(req: OverwriteChapterRequest) -> OverwriteChapterResponse:
    """全书顺序改写：一次一章。同样走 classify → 改世界书 → 改写 → review 回路。"""
    settings = load_settings()
    use_demo = not settings.api_key

    if use_demo:
        from langgraph.checkpoint.memory import MemorySaver

        llm = MockLLM(review_mode="pass")
        checkpointer = MemorySaver()
    else:
        try:
            from literary_agent.llm import build_llm

            llm = build_llm(settings)
            checkpointer = _make_checkpointer()
        except Exception:  # noqa: BLE001
            from langgraph.checkpoint.memory import MemorySaver

            llm = MockLLM(review_mode="pass")
            checkpointer = MemorySaver()
            use_demo = True

    final = run_overwrite_chapter(req.model_dump(), settings=settings, llm=llm, checkpointer=checkpointer)
    result = final.get("result") or {}
    return OverwriteChapterResponse(
        title=result.get("标题") or req.target.ch_title or "",
        narrative=result.get("正文", ""),
        summary=result.get("摘要", ""),
        demo=use_demo,
    )


# 主路径走 literary_agent.overwrite.run_overwrite；
# 下方四个下划线函数保留作为极简回退与单测入口（详见文件顶部注释），
# 用 __all__ 明确导出，Pylance / mypy 视其为公共 API，不再报 "未存取"。
__all__ = [
    "app",
    "overwrite",
    "overwrite_chapter",
    "_overwrite_stub",
    "_build_overwrite_prompt",
    "_chapter_stub",
    "_build_chapter_prompt",
]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000)
