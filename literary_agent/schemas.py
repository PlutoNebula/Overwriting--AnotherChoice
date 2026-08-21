from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CharacterFact(BaseModel):
    model_config = ConfigDict(extra="ignore")

    姓名: str = ""
    身份: str = ""
    性格: str = ""
    关系: str = ""
    本块经历事件: list[str] = Field(default_factory=list)


class WorldFact(BaseModel):
    model_config = ConfigDict(extra="ignore")

    类别: str = ""  # 地点|势力|规则|时间线|物品|术语|背景
    名称: str = ""
    描述: str = ""
    关联: str = ""


class ChunkAnalysis(BaseModel):
    """单块分析结果：一次 LLM 调用同时产出梗概 + 人物 + 世界三类信息。"""

    model_config = ConfigDict(extra="ignore")

    局部梗概: str = ""
    人物: list[CharacterFact] = Field(default_factory=list)
    世界: list[WorldFact] = Field(default_factory=list)


class Issue(BaseModel):
    model_config = ConfigDict(extra="ignore")

    位置: str = ""
    严重度: Literal["高", "中", "低"] = "中"
    描述: str = ""
    建议: str = ""


class ReviewReport(BaseModel):
    """评测报告：review 节点用原始分析结果反向核对成稿。"""

    model_config = ConfigDict(extra="ignore")

    通过: bool = False
    评分: dict[str, int] = Field(default_factory=dict)
    问题清单: list[Issue] = Field(default_factory=list)
    修订意见: str = ""


class AssembleOutput(BaseModel):
    """成稿输出：相对路径 → 内容 的扁平映射。"""

    model_config = ConfigDict(extra="ignore")

    outputs: dict[str, str] = Field(default_factory=dict)
