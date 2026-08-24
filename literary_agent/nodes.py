from __future__ import annotations

from pathlib import Path

from . import prompts
from .chunking import chunk_text
from .llm import call_json
from .schemas import AssembleOutput, ChunkAnalysis, ReviewReport
from .storage import read_text, write_all
from .tavern import build_outputs


def load_node(state: dict, settings) -> dict:
    path = Path(state.get("source_path", ""))
    if not path.exists():
        return {"errors": [f"文件不存在: {path}"]}
    text = read_text(path)
    return {"work_name": path.stem, "source_text": text, "status": "loaded"}


def chunk_node(state: dict, settings) -> dict:
    text = state.get("source_text", "")
    chunks = chunk_text(text, settings.chunk_size, settings.chunk_overlap)
    if not chunks:
        return {"chunks": [""], "errors": ["输入文本为空"]}
    return {"chunks": chunks, "status": "chunked"}


def analyze_node(state: dict, llm) -> dict:
    """map 节点：对单个片段做统一结构化提取（梗概 + 人物 + 世界）。"""
    chunk = state.get("chunk", "")
    idx = int(state.get("idx", 0))
    user = f"【作品片段 #{idx + 1}】\n{chunk}"
    try:
        analysis = call_json(llm, prompts.ANALYZE_SYSTEM, user, ChunkAnalysis)
        return {"chunk_analyses": [analysis.model_dump()]}
    except Exception as e:  # noqa: BLE001
        return {
            "chunk_analyses": [{"局部梗概": "", "人物": [], "世界": [], "_error": str(e)}],
            "errors": [f"片段 #{idx + 1} 分析失败: {e}"],
        }


def assemble_node(state: dict, llm) -> dict:
    """reduce 节点：合并全部分析结果，成稿三类产物；修订时落实 review 意见。"""
    analyses = state.get("chunk_analyses", [])
    work_name = state.get("work_name", "")
    feedback = state.get("review_feedback", "")
    revising = bool(feedback)
    revision_count = state.get("revision_count", 0) + (1 if revising else 0)

    user = prompts.build_assemble_user(work_name, analyses, feedback)
    try:
        out = call_json(llm, prompts.ASSEMBLE_SYSTEM, user, AssembleOutput)
        outputs = build_outputs(out)
        return {"outputs": outputs, "revision_count": revision_count, "status": "assembled"}
    except Exception as e:  # noqa: BLE001
        return {
            "outputs": state.get("outputs", {}),
            "revision_count": revision_count,
            "errors": [f"成稿失败: {e}"],
        }


def review_node(state: dict, llm) -> dict:
    """评测节点：用原始分析结果反向核对成稿，产出质检报告与修订意见。"""
    analyses = state.get("chunk_analyses", [])
    outputs = state.get("outputs", {})
    user = prompts.build_review_user(analyses, outputs)
    try:
        rep = call_json(llm, prompts.REVIEW_SYSTEM, user, ReviewReport)
        d = rep.model_dump()
        errs = None
    except Exception as e:  # noqa: BLE001
        # 评测本身失败时按通过处理，避免死循环；错误记入 errors
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


def write_node(state: dict, settings) -> dict:
    work_name = state.get("work_name", "未命名作品")
    outputs = state.get("outputs", {})
    review_history = state.get("review_history", [])
    work_dir = write_all(settings, work_name, outputs, review_history, state)
    return {"work_dir": str(work_dir), "status": "done"}
