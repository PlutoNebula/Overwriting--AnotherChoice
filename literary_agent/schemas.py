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


class AspectClassification(BaseModel):
    """改写方面分类：剧情 / 人物 / 世界观。"""

    model_config = ConfigDict(extra="ignore")

    方面: Literal["剧情", "人物", "世界观"] = "世界观"
    理由: str = ""


class ModifyOutput(BaseModel):
    """modify 节点输出：只改「方面」对应的语义字段，其余留空。"""

    model_config = ConfigDict(extra="ignore")

    世界条目: list[WorldEntry] = Field(default_factory=list)
    角色卡: list[CharacterCard] = Field(default_factory=list)
    剧本摘要: dict[str, str] = Field(default_factory=dict)
    世界设定: str = ""


class RewriteResult(BaseModel):
    """rewrite 节点输出：改写正文 + 关键变化 + 冲突 + 后续方向。"""

    model_config = ConfigDict(extra="ignore")

    标题: str = ""
    正文: str = ""
    关键变化: list[str] = Field(default_factory=list)
    设定冲突: list[str] = Field(default_factory=list)
    后续方向: list[str] = Field(default_factory=list)


class CharacterCard(BaseModel):
    """角色卡（酒馆 chara_card_v2 的语义字段）。"""

    model_config = ConfigDict(extra="ignore")

    姓名: str = ""
    描述: str = ""  # 完整档案：身份/外貌/性格/能力/关系/经历时间线/动机/转变
    性格: str = ""
    场景: str = ""
    开场白: str = ""
    对话示例: str = ""
    标签: list[str] = Field(default_factory=list)


class WorldEntry(BaseModel):
    """世界书条目（酒馆 World Info 的语义字段）。"""

    model_config = ConfigDict(extra="ignore")

    关键词: list[str] = Field(default_factory=list)
    内容: str = ""
    类别: str = ""  # 地点|势力|规则|时间线|物品|术语|背景
    备注: str = ""


class AssembleOutput(BaseModel):
    """成稿输出（结构化，由 tavern.build_outputs 落成文件）。"""

    model_config = ConfigDict(extra="ignore")

    剧本摘要: dict[str, str] = Field(default_factory=dict)
    人物总览: str = ""
    人物关系: str = ""
    角色卡: list[CharacterCard] = Field(default_factory=list)
    世界设定: str = ""
    世界条目: list[WorldEntry] = Field(default_factory=list)
