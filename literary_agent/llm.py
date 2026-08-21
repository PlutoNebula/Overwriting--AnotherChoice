from __future__ import annotations

import json
import re
import time
from typing import Any, Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from .config import Settings

T = TypeVar("T")


def build_llm(settings: Settings, temperature: float | None = None) -> ChatOpenAI:
    """构造指向 DeepSeek（OpenAI 兼容端口）的 ChatOpenAI 实例。"""
    if not settings.api_key:
        raise RuntimeError("缺少 DEEPSEEK_API_KEY：请在 .env 中配置，或使用 --dry-run 离线模式")
    return ChatOpenAI(
        model=settings.model,
        api_key=settings.api_key,
        base_url=settings.base_url,
        temperature=settings.temperature if temperature is None else temperature,
        max_retries=settings.max_retries,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


def _extract_json(text: str) -> dict[str, Any]:
    """从 LLM 输出中稳健地提取 JSON 对象（兼容 markdown 代码块包裹）。"""
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", t, re.DOTALL)
    if fence:
        t = fence.group(1).strip()
    start = t.find("{")
    if start == -1:
        raise ValueError("输出中未找到 JSON 对象")
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(t[start:])
    if not isinstance(obj, dict):
        raise ValueError("JSON 根节点不是对象")
    return obj


def call_json(llm, system: str, user: str, model_class: Type[T], max_attempts: int = 2) -> T:
    """调用 LLM 并把结果解析为指定 Pydantic 模型，失败时强化指令重试。"""
    last_err: Exception | None = None
    current_user = user
    for attempt in range(max_attempts):
        try:
            resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=current_user)])
            content = resp.content if isinstance(resp.content, str) else str(resp.content)
            data = _extract_json(content)
            return model_class.model_validate(data)
        except Exception as e:  # noqa: BLE001
            last_err = e
            current_user = (
                user
                + "\n\n【重试要求】请严格只输出一个合法的 JSON 对象："
                "不要用 markdown 代码块包裹，不要输出任何解释文字。"
            )
            time.sleep(1 + attempt)
    raise last_err if last_err else RuntimeError("JSON 解析失败")
