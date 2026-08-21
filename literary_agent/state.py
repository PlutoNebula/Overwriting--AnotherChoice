from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class WorkState(TypedDict, total=False):
    """贯穿整张图的状态载体。

    列表字段使用 operator.add reducer（累加语义），避免被并行 fan-out 结果覆盖。
    """

    source_path: str
    work_name: str
    source_text: str
    chunks: list[str]

    # 每个片段的分析结果（analyze map 节点累加，作为 review 的 ground truth）
    chunk_analyses: Annotated[list[dict[str, Any]], operator.add]

    # 成稿：{相对路径: 内容}
    outputs: dict[str, str]

    # 评测历史（每轮一次）
    review_history: Annotated[list[dict[str, Any]], operator.add]
    review_feedback: str
    review_passed: bool
    revision_count: int

    errors: Annotated[list[str], operator.add]
    status: str
    work_dir: str
