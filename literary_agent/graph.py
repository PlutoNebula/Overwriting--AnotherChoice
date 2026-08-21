from __future__ import annotations

from functools import partial
from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import Send

from . import nodes
from .state import WorkState


def dispatch_analyze(state: dict) -> list[Send]:
    """map-reduce 派发：对每个片段 Send 一个 analyze 任务（并行 fan-out）。"""
    return [Send("analyze", {"chunk": c, "idx": i}) for i, c in enumerate(state.get("chunks", []))]


def route_after_review(state: dict, max_revisions: int) -> str:
    """review 之后的条件路由：通过或达修订上限 → 落盘；否则回 assemble 修订。"""
    if state.get("review_passed") or state.get("revision_count", 0) >= max_revisions:
        return "write"
    return "assemble"


def build_graph(settings, llm, checkpointer=None, max_revisions=None, enable_review=True):
    """组装 StateGraph：load → chunk → analyze(map) → assemble → review ⇄ → write。"""
    max_rev = settings.max_revisions if max_revisions is None else max_revisions

    g = StateGraph(WorkState)
    g.add_node("load", partial(nodes.load_node, settings=settings))
    g.add_node("chunk", partial(nodes.chunk_node, settings=settings))
    g.add_node("analyze", partial(nodes.analyze_node, llm=llm))
    g.add_node("assemble", partial(nodes.assemble_node, llm=llm))
    g.add_node("write", partial(nodes.write_node, settings=settings))

    g.set_entry_point("load")
    g.add_edge("load", "chunk")
    g.add_conditional_edges("chunk", dispatch_analyze, ["analyze"])
    g.add_edge("analyze", "assemble")

    if enable_review:
        g.add_node("review", partial(nodes.review_node, llm=llm))
        g.add_edge("assemble", "review")
        g.add_conditional_edges(
            "review",
            partial(route_after_review, max_revisions=max_rev),
            {"assemble": "assemble", "write": "write"},
        )
    else:
        g.add_edge("assemble", "write")

    g.add_edge("write", END)

    if checkpointer is None:
        checkpointer = MemorySaver()
    return g.compile(checkpointer=checkpointer)


def run_pipeline(
    source_path,
    settings=None,
    llm=None,
    checkpointer=None,
    max_revisions=None,
    enable_review=True,
) -> dict:
    """一次调用跑完整条流水线，返回最终 State。"""
    from .config import load_settings

    if settings is None:
        settings = load_settings()
    if llm is None:
        from .llm import build_llm

        llm = build_llm(settings)

    graph = build_graph(
        settings,
        llm=llm,
        checkpointer=checkpointer,
        max_revisions=max_revisions,
        enable_review=enable_review,
    )
    initial = {
        "source_path": str(source_path),
        "revision_count": 0,
        "review_passed": False,
    }
    config = {"recursion_limit": 100, "configurable": {"thread_id": Path(source_path).stem}}
    return graph.invoke(initial, config)
