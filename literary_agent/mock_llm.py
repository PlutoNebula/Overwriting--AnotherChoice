from __future__ import annotations

import json

from langchain_core.messages import AIMessage


def _detect_task(messages) -> str:
    for m in messages:
        content = m.content if isinstance(m.content, str) else ""
        for tag in ("analyze", "assemble", "review"):
            if f"【任务类型】{tag}" in content:
                return tag
    return "analyze"


SAMPLE_ANALYSIS = {
    "局部梗概": "示例：主角登场并遭遇冲突。",
    "人物": [
        {"姓名": "张三", "身份": "旅人", "性格": "坚韧", "关系": "与李四为同伴", "本块经历事件": ["离开故乡"]}
    ],
    "世界": [
        {"类别": "地点", "名称": "雾镇", "描述": "终年有雾的小镇", "关联": "主角起点"}
    ],
}

SAMPLE_ASSEMBLE = {
    "剧本摘要": {
        "内容梗概.md": "# 内容梗概\n\n一句话：主角张三踏上旅程。\n\n全文梗概（示例）。",
        "章节摘要.md": "# 章节摘要\n\n## 开端\n- 张三离开故乡。",
        "主题分析.md": "# 主题分析\n\n主题：成长与抉择。",
    },
    "人物总览": "# 人物总览\n\n| 姓名 | 身份 | 定位 |\n|------|------|------|\n| 张三 | 旅人 | 主角 |",
    "人物关系": "# 人物关系\n\n- 张三 — 同伴 — 李四",
    "角色卡": [
        {
            "姓名": "张三",
            "描述": "主角，旅人。\n\n## 经历时间线\n1. 离开故乡",
            "性格": "坚韧",
            "场景": "雾镇",
            "开场白": "我要找回我的名字。",
            "对话示例": "",
            "标签": ["主角", "旅人"],
        }
    ],
    "世界设定": "# 世界设定\n\n雾镇及周边。",
    "世界条目": [
        {"关键词": ["雾镇", "小镇"], "内容": "终年有雾的小镇", "类别": "地点", "备注": ""}
    ],
}

PASS_REPORT = {
    "通过": True,
    "评分": {"一致性": 5, "完整性": 5, "准确性": 5, "去重": 5, "可读性": 5},
    "问题清单": [],
    "修订意见": "",
}

FAIL_REPORT = {
    "通过": False,
    "评分": {"一致性": 4, "完整性": 2, "准确性": 5, "去重": 4, "可读性": 4},
    "问题清单": [
        {"位置": "人物信息/人物总览.md", "严重度": "高", "描述": "遗漏角色李四", "建议": "补充李四档案"}
    ],
    "修订意见": "请补充主要人物「李四」的档案与经历，并加入人物总览与关系。",
}


class MockLLM:
    """离线测试用假 LLM：按系统提示词里的【任务类型】返回固定结构化结果。"""

    def __init__(self, review_mode: str = "pass"):
        self.review_mode = review_mode
        self.review_calls = 0

    def invoke(self, messages, **kwargs):
        task = _detect_task(messages)
        if task == "analyze":
            return AIMessage(content=json.dumps(SAMPLE_ANALYSIS, ensure_ascii=False))
        if task == "assemble":
            return AIMessage(content=json.dumps(SAMPLE_ASSEMBLE, ensure_ascii=False))
        if task == "review":
            self.review_calls += 1
            if self.review_mode == "fail_then_pass" and self.review_calls == 1:
                return AIMessage(content=json.dumps(FAIL_REPORT, ensure_ascii=False))
            return AIMessage(content=json.dumps(PASS_REPORT, ensure_ascii=False))
        return AIMessage(content="{}")
