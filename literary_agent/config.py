from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 在模块导入时加载 .env，确保 Settings 的 default_factory 能读到环境变量
load_dotenv(PROJECT_ROOT / ".env")


@dataclass
class Settings:
    """全局配置：从环境变量 / .env 读取，可用构造参数覆盖。"""

    # DeepSeek（OpenAI 兼容端口）
    api_key: str = field(default_factory=lambda: os.getenv("DEEPSEEK_API_KEY", ""))
    base_url: str = field(default_factory=lambda: os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))
    model: str = field(default_factory=lambda: os.getenv("DEEPSEEK_MODEL", "deepseek-chat"))

    # 分块
    chunk_size: int = 8000
    chunk_overlap: int = 500

    # 生成
    temperature: float = 0.2
    max_retries: int = 3

    # review 评测
    max_revisions: int = 2

    # 路径
    works_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "works")
    inputs_dir: Path = field(default_factory=lambda: PROJECT_ROOT / "inputs")


def load_settings() -> Settings:
    return Settings()
