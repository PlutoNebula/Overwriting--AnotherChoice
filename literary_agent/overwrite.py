from __future__ import annotations

import json
import operator
from datetime import datetime, timezone
from functools import partial
from pathlib import Path
from typing import Annotated, Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from . import prompts, tavern
from .llm import call_json
from .schemas import AspectClassification, ModifyOutput, ReviewReport, RewriteChapterResult, RewriteResult
from .storage import atomic_write, render_review_report, sanitize_name


class OverwriteState(TypedDict, total=False):
    # 前端 payload
    book_id: str
    book_title: str
    book_author: str
    origin: dict
    context: str
    prompt: str
    tones: list[str]
    strength: str
    constraints: str

    # classify
    aspect: str
    aspect_reason: str

    # 世界书
    has_worldbook: bool
    artifacts: dict[str, str]
    modified_artifacts: dict[str, str]

    # rewrite
    result: dict

    # review 回路
    review_history: Annotated[list[dict], operator.add]
    review_feedback: str
    review_passed: bool
    revision_count: int

    branch_dir: str
    errors: Annotated[list[str], operator.add]
    status: str


def _find_work_dir(settings, book_id: str, book_title: str) -> Path | None:
    candidates = []
    if book_id:
        candidates.append(settings.works_dir / sanitize_name(book_id))
    if book_title:
        candidates.append(settings.works_dir / sanitize_name(book_title))
    for c in candidates:
        if c.is_dir():
            return c
    if settings.works_dir.is_dir():
        want = {sanitize_name(book_title), sanitize_name(book_id)}
        for d in sorted(settings.works_dir.iterdir()):
            if d.is_dir() and d.name in want:
                return d
    return None


def _read_artifacts(work_dir: Path) -> dict[str, str]:
    arts: dict[str, str] = {}
    for p in sorted(work_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(work_dir).as_posix()
        if rel.startswith("改写/") or p.name in ("评测报告.md", "_meta.json"):
            continue
        try:
            arts[rel] = p.read_text(encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass
    return arts


def _semantic_view(artifacts: dict[str, str]) -> dict:
    view: dict[str, Any] = {"世界条目": [], "角色卡": [], "剧本摘要": {}, "世界设定": ""}
    for rel, content in artifacts.items():
        if rel == "世界书/world_info.json":
            try:
                view["世界条目"] = tavern.parse_world_info(json.loads(content))
            except Exception:  # noqa: BLE001
                pass
        elif rel == "世界书/世界设定.md":
            view["世界设定"] = content
        elif rel.startswith("人物信息/") and rel.endswith(".json"):
            try:
                view["角色卡"].append(tavern.parse_chara_card(json.loads(content)))
            except Exception:  # noqa: BLE001
                pass
        elif rel.startswith("剧本摘要/"):
            view["剧本摘要"][rel.split("/", 1)[1]] = content
    return view


def load_node(state: dict, settings) -> dict:
    work_dir = _find_work_dir(settings, state.get("book_id", ""), state.get("book_title", ""))
    if work_dir:
        arts = _read_artifacts(work_dir)
        return {"has_worldbook": bool(arts), "artifacts": arts, "status": "loaded"}
    return {"has_worldbook": False, "artifacts": {}, "status": "loaded-stateless"}


def classify_node(state: dict, llm, builder=None) -> dict:
    if state.get("aspect"):
        return {}
    user = (builder or prompts.build_classify_user)(state)
    try:
        r = call_json(llm, prompts.CLASSIFY_SYSTEM, user, AspectClassification)
        return {"aspect": r.方面, "aspect_reason": r.理由}
    except Exception as e:  # noqa: BLE001
        return {"aspect": "世界观", "aspect_reason": f"分类失败按世界观兜底: {e}", "errors": [f"分类失败: {e}"]}


def modify_node(state: dict, llm) -> dict:
    revising = bool(state.get("review_feedback"))
    revision_count = state.get("revision_count", 0) + (1 if revising else 0)
    if not state.get("has_worldbook") or not state.get("artifacts"):
        return {"revision_count": revision_count}
    semantic = _semantic_view(state.get("artifacts", {}))
    user = prompts.build_modify_user(state, semantic)
    try:
        out = call_json(llm, prompts.MODIFY_ARTIFACTS_SYSTEM, user, ModifyOutput)
        mods = tavern.build_modify_outputs(out)
        return {"modified_artifacts": mods, "revision_count": revision_count}
    except Exception as e:  # noqa: BLE001
        return {
            "modified_artifacts": {},
            "revision_count": revision_count,
            "errors": [f"修改世界书失败: {e}"],
        }


def rewrite_node(state: dict, llm) -> dict:
    user = prompts.build_rewrite_user(state)
    try:
        r = call_json(llm, prompts.REWRITE_SYSTEM, user, RewriteResult)
        return {"result": r.model_dump()}
    except Exception as e:  # noqa: BLE001
        empty = {"标题": "", "正文": "", "关键变化": [], "设定冲突": [], "后续方向": []}
        return {"result": empty, "errors": [f"改写失败: {e}"]}


def review_node(state: dict, llm) -> dict:
    user = prompts.build_rewrite_review_user(state)
    try:
        rep = call_json(llm, prompts.REWRITE_REVIEW_SYSTEM, user, ReviewReport)
        d = rep.model_dump()
        errs = None
    except Exception as e:  # noqa: BLE001
        d = {"通过": True, "评分": {}, "问题清单": [], "修订意见": ""}
        errs = [f"评测失败，按通过处理: {e}"]
    result = {
        "review_history": [d],
        "review_passed": bool(d.get("通过", True)),
        "review_feedback": d.get("修订意见", ""),
    }
    if errs:
        result["errors"] = errs
    return result


def _render_rewrite_note(state: dict) -> str:
    lines = [
        "# 改写说明",
        "",
        f"- 方面：{state.get('aspect', '')}（{state.get('aspect_reason', '')}）",
        f"- 意图：{state.get('prompt', '')}",
        f"- 强度：{state.get('strength', '')}",
        f"- 倾向：{', '.join(state.get('tones', [])) or '未指定'}",
        f"- 约束：{state.get('constraints', '') or '无'}",
    ]
    return "\n".join(lines)


def save_node(state: dict, settings) -> dict:
    if state.get("has_worldbook") and state.get("modified_artifacts"):
        work_dir = _find_work_dir(settings, state.get("book_id", ""), state.get("book_title", ""))
        branch_id = "rewrite_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")[:26]
        branch_dir = (work_dir or (settings.works_dir / sanitize_name(state.get("book_title", "") or "未命名"))) / "改写" / branch_id
        for rel, content in state["modified_artifacts"].items():
            parts = [sanitize_name(p) for p in rel.replace("\\", "/").split("/") if p]
            atomic_write(branch_dir / Path(*parts), content)
        atomic_write(branch_dir / "改写说明.md", _render_rewrite_note(state))
        atomic_write(branch_dir / "评测报告.md", render_review_report(state.get("review_history", []), state))
        return {"branch_dir": str(branch_dir), "status": "done"}
    return {"branch_dir": "", "status": "done-stateless"}


def route_after_review(state: dict, max_revisions: int) -> str:
    if state.get("review_passed") or state.get("revision_count", 0) >= max_revisions:
        return "save"
    return "modify"


def build_overwrite_graph(settings, llm, checkpointer=None, max_revisions=None):
    max_rev = settings.max_revisions if max_revisions is None else max_revisions

    g = StateGraph(OverwriteState)
    g.add_node("load", partial(load_node, settings=settings))
    g.add_node("classify", partial(classify_node, llm=llm))
    g.add_node("modify", partial(modify_node, llm=llm))
    g.add_node("rewrite", partial(rewrite_node, llm=llm))
    g.add_node("review", partial(review_node, llm=llm))
    g.add_node("save", partial(save_node, settings=settings))

    g.set_entry_point("load")
    g.add_edge("load", "classify")
    g.add_edge("classify", "modify")
    g.add_edge("modify", "rewrite")
    g.add_edge("rewrite", "review")
    g.add_conditional_edges(
        "review",
        partial(route_after_review, max_revisions=max_rev),
        {"modify": "modify", "save": "save"},
    )
    g.add_edge("save", END)

    if checkpointer is None:
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)


def run_overwrite(payload: dict, settings=None, llm=None, checkpointer=None, max_revisions=None) -> dict:
    """执行一次改写：输入前端 payload，返回含 result/aspect/branch_dir 的最终 State。"""
    from .config import load_settings

    if settings is None:
        settings = load_settings()
    if llm is None:
        from .llm import build_llm

        llm = build_llm(settings)

    graph = build_overwrite_graph(
        settings, llm=llm, checkpointer=checkpointer, max_revisions=max_revisions
    )
    book = payload.get("book") or {}
    origin = payload.get("origin") or {}
    initial = {
        "book_id": book.get("id", ""),
        "book_title": book.get("title", ""),
        "book_author": book.get("author", ""),
        "origin": origin,
        "context": payload.get("context", ""),
        "prompt": payload.get("prompt", ""),
        "tones": payload.get("tones", []) or [],
        "strength": payload.get("strength", "medium"),
        "constraints": payload.get("constraints", ""),
        "revision_count": 0,
        "review_passed": False,
    }
    config = {
        "recursion_limit": 100,
        "configurable": {"thread_id": book.get("id") or book.get("title") or "overwrite"},
    }
    return graph.invoke(initial, config)


# ---------------------------------------------------------------------------
# 全书顺序改写：一次一章（/api/overwrite/chapter）
# ---------------------------------------------------------------------------


class OverwriteChapterState(TypedDict, total=False):
    book_id: str
    book_title: str
    book_author: str
    branch: dict
    origin: dict
    target: dict
    prev_summaries: list
    prev_two_chapters: list
    context: str
    prompt: str
    tones: list[str]
    strength: str
    constraints: str
    aspect: str
    aspect_reason: str
    has_worldbook: bool
    artifacts: dict[str, str]
    modified_artifacts: dict[str, str]
    result: dict
    review_history: Annotated[list[dict], operator.add]
    review_feedback: str
    review_passed: bool
    revision_count: int
    branch_dir: str
    errors: Annotated[list[str], operator.add]
    status: str


def _fmt_chapter_context(state: dict) -> str:
    parts: list[str] = []
    for it in state.get("prev_summaries") or []:
        if not isinstance(it, dict):
            continue
        ch = it.get("ch", 0)
        title = (it.get("title") or "").strip()
        summary = (it.get("summary") or "").strip()
        parts.append(f"- 第 {int(ch) + 1} 节{'『' + title + '』' if title else ''}：{summary or '（无）'}")
    for it in state.get("prev_two_chapters") or []:
        if not isinstance(it, dict):
            continue
        ch = it.get("ch", 0)
        title = (it.get("title") or "").strip()
        narrative = (it.get("narrative") or "").strip()
        parts.append(f"—— 第 {int(ch) + 1} 节{'『' + title + '』' if title else ''} ——\n{narrative or '（空）'}")
    return "\n\n".join(parts)


def chapter_load_node(state: dict, settings) -> dict:
    base = load_node(state, settings)
    base["context"] = _fmt_chapter_context(state)
    return base


def chapter_rewrite_node(state: dict, llm) -> dict:
    user = prompts.build_chapter_rewrite_user(state)
    try:
        r = call_json(llm, prompts.REWRITE_CHAPTER_SYSTEM, user, RewriteChapterResult)
        return {"result": r.model_dump()}
    except Exception as e:  # noqa: BLE001
        return {"result": {"标题": "", "正文": "", "摘要": ""}, "errors": [f"章节改写失败: {e}"]}


def build_overwrite_chapter_graph(settings, llm, checkpointer=None, max_revisions=None):
    max_rev = settings.max_revisions if max_revisions is None else max_revisions

    g = StateGraph(OverwriteChapterState)
    g.add_node("load", partial(chapter_load_node, settings=settings))
    g.add_node("classify", partial(classify_node, llm=llm, builder=prompts.build_chapter_classify_user))
    g.add_node("modify", partial(modify_node, llm=llm))
    g.add_node("rewrite", partial(chapter_rewrite_node, llm=llm))
    g.add_node("review", partial(review_node, llm=llm))
    g.add_node("save", partial(save_node, settings=settings))

    g.set_entry_point("load")
    g.add_edge("load", "classify")
    g.add_edge("classify", "modify")
    g.add_edge("modify", "rewrite")
    g.add_edge("rewrite", "review")
    g.add_conditional_edges(
        "review",
        partial(route_after_review, max_revisions=max_rev),
        {"modify": "modify", "save": "save"},
    )
    g.add_edge("save", END)

    if checkpointer is None:
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)


def run_overwrite_chapter(payload: dict, settings=None, llm=None, checkpointer=None, max_revisions=None) -> dict:
    """执行一次逐章改写：返回含 result/aspect/branch_dir 的最终 State。"""
    from .config import load_settings

    if settings is None:
        settings = load_settings()
    if llm is None:
        from .llm import build_llm

        llm = build_llm(settings)

    graph = build_overwrite_chapter_graph(
        settings, llm=llm, checkpointer=checkpointer, max_revisions=max_revisions
    )
    book = payload.get("book") or {}
    branch = payload.get("branch") or {}
    origin = payload.get("origin") or {}
    target = payload.get("target") or {}
    initial = {
        "book_id": book.get("id", ""),
        "book_title": book.get("title", ""),
        "book_author": book.get("author", ""),
        "branch": branch,
        "origin": origin,
        "target": target,
        "prev_summaries": payload.get("prev_summaries", []) or [],
        "prev_two_chapters": payload.get("prev_two_chapters", []) or [],
        "prompt": payload.get("prompt", ""),
        "tones": payload.get("tones", []) or [],
        "strength": payload.get("strength", "medium"),
        "constraints": payload.get("constraints", ""),
        "revision_count": 0,
        "review_passed": False,
    }
    config = {
        "recursion_limit": 100,
        "configurable": {"thread_id": book.get("id") or book.get("title") or "overwrite-chapter"},
    }
    return graph.invoke(initial, config)
