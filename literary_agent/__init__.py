"""中短篇文学作品解读 Agent 系统（LangGraph + DeepSeek）。

对外暴露主要入口，便于 `run.py` 与测试使用。
"""

from .graph import build_graph, run_pipeline

__all__ = ["build_graph", "run_pipeline"]
