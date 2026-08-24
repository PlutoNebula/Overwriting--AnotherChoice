import json

from literary_agent.schemas import CharacterCard, WorldEntry
from literary_agent.tavern import build_chara_card, build_world_info


def test_chara_card_v2():
    card = CharacterCard(姓名="张三", 描述="主角，旅人。", 性格="坚韧", 标签=["主角"])
    obj = build_chara_card(card)
    assert obj["spec"] == "chara_card_v2"
    assert obj["spec_version"] == "2.0"
    assert obj["data"]["name"] == "张三"
    assert obj["data"]["description"] == "主角，旅人。"
    assert obj["data"]["tags"] == ["主角"]
    # 可序列化
    json.dumps(obj, ensure_ascii=False)


def test_world_info():
    entries = [WorldEntry(关键词=["雾镇", "小镇"], 内容="终年有雾的小镇", 类别="地点", 备注="主角起点")]
    obj = build_world_info(entries)
    assert set(obj) == {"entries"}
    e = obj["entries"]["1"]
    assert e["key"] == ["雾镇", "小镇"]
    assert e["content"] == "终年有雾的小镇"
    assert e["position"] == "before_char"
    assert e["group"] == "地点"
    assert e["comment"] == "[地点] 主角起点"
    json.dumps(obj, ensure_ascii=False)
