"""SillyTavern（酒馆）格式序列化：角色卡 chara_card_v2 与 World Info（世界书）。

由 LLM 产出「语义字段」（角色档案、世界条目），这里确定性套上酒馆的固定 JSON 骨架，
保证导出的 .json 可直接被 SillyTavern 导入。
"""

from __future__ import annotations

import json

from .storage import sanitize_name

CARD_SPEC = "chara_card_v2"
CARD_SPEC_VERSION = "2.0"
CARD_CREATOR = "文学解读Agent"


def build_chara_card(card) -> dict:
    """把角色档案包装成 SillyTavern chara_card_v2 JSON。"""
    return {
        "spec": CARD_SPEC,
        "spec_version": CARD_SPEC_VERSION,
        "data": {
            "name": card.姓名 or "未命名角色",
            "description": card.描述 or "",
            "personality": card.性格 or "",
            "scenario": card.场景 or "",
            "first_mes": card.开场白 or "",
            "mes_example": card.对话示例 or "",
            "creator_notes": "",
            "system_prompt": "",
            "post_history_instructions": "",
            "alternate_greetings": [],
            "tags": card.标签 or [],
            "creator": CARD_CREATOR,
            "character_version": "1.0",
            "extensions": {},
        },
    }


def build_world_info(entries: list) -> dict:
    """把世界条目包装成 SillyTavern World Info（Lorebook）JSON。"""
    entries_obj: dict[str, dict] = {}
    for i, e in enumerate(entries, start=1):
        entry = {
            "uid": i,
            "key": [k for k in (e.关键词 or []) if k],
            "keysecondary": [],
            "comment": ((f"[{e.类别}] " if e.类别 else "") + (e.备注 or "")).strip(),
            "content": e.内容 or "",
            "constant": False,
            "selective": True,
            "insertionOrder": 50,
            "enabled": True,
            "position": "before_char",
            "extensions": {},
            "excludeRecursion": False,
            "preventRecursion": False,
            "probability": 100,
            "useProbability": True,
            "depth": 4,
            "group": e.类别 or "",
            "groupOverride": False,
            "groupWeight": 100,
            "scanDepth": None,
            "caseSensitive": None,
            "matchWholeWords": None,
            "useGroupScoring": False,
            "automationId": "",
            "role": 0,
            "sticky": 0,
            "cooldown": 0,
            "delay": 0,
        }
        entries_obj[str(i)] = entry
    return {"entries": entries_obj}


def build_outputs(out) -> dict[str, str]:
    """把结构化成稿转成 {相对路径: 文件内容} 的扁平映射。"""
    outputs: dict[str, str] = {}

    for name, content in (out.剧本摘要 or {}).items():
        outputs[f"剧本摘要/{sanitize_name(name)}"] = content

    outputs["人物信息/人物总览.md"] = out.人物总览 or ""
    outputs["人物信息/人物关系.md"] = out.人物关系 or ""

    seen: set[str] = set()
    for card in out.角色卡 or []:
        base = sanitize_name(card.姓名) or "未命名角色"
        name = base
        n = 2
        while name in seen:
            name = f"{base}_{n}"
            n += 1
        seen.add(name)
        outputs[f"人物信息/{name}.json"] = json.dumps(build_chara_card(card), ensure_ascii=False, indent=2)

    outputs["世界书/世界设定.md"] = out.世界设定 or ""
    outputs["世界书/world_info.json"] = json.dumps(
        build_world_info(out.世界条目 or []), ensure_ascii=False, indent=2
    )
    return outputs


def build_modify_outputs(out) -> dict[str, str]:
    """把 ModifyOutput（只含被修改方面的语义字段）序列化为 {相对路径: 内容}。"""
    outputs: dict[str, str] = {}

    for name, content in (out.剧本摘要 or {}).items():
        outputs[f"剧本摘要/{sanitize_name(name)}"] = content

    seen: set[str] = set()
    for card in out.角色卡 or []:
        base = sanitize_name(card.姓名) or "未命名角色"
        name = base
        n = 2
        while name in seen:
            name = f"{base}_{n}"
            n += 1
        seen.add(name)
        outputs[f"人物信息/{name}.json"] = json.dumps(build_chara_card(card), ensure_ascii=False, indent=2)

    if out.世界设定:
        outputs["世界书/世界设定.md"] = out.世界设定
    if out.世界条目:
        outputs["世界书/world_info.json"] = json.dumps(
            build_world_info(out.世界条目), ensure_ascii=False, indent=2
        )
    return outputs


def parse_world_info(data: dict) -> list[dict]:
    """把 SillyTavern World Info JSON 还原成语义条目列表。"""
    if not isinstance(data, dict):
        return []
    entries = data.get("entries", {})
    if isinstance(entries, list):
        items = entries
    elif isinstance(entries, dict):
        items = list(entries.values())
    else:
        items = []
    out: list[dict] = []
    for e in items:
        if not isinstance(e, dict):
            continue
        group = e.get("group", "") or ""
        out.append({
            "关键词": e.get("key") or e.get("keys") or [],
            "内容": e.get("content", ""),
            "类别": group,
            "备注": (e.get("comment", "") or "").replace(f"[{group}] ", "").strip(),
        })
    return out


def parse_chara_card(data: dict) -> dict:
    """把 chara_card_v2 JSON 还原成语义字段。"""
    d = data.get("data", data) if isinstance(data, dict) else {}
    return {
        "姓名": d.get("name", ""),
        "描述": d.get("description", ""),
        "性格": d.get("personality", ""),
        "场景": d.get("scenario", ""),
        "开场白": d.get("first_mes", ""),
        "对话示例": d.get("mes_example", ""),
        "标签": d.get("tags", []) or [],
    }
