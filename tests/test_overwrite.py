import json
from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver

from literary_agent.config import Settings
from literary_agent.mock_llm import MockLLM
from literary_agent.overwrite import run_overwrite


def _payload() -> dict:
    return {
        "book": {"id": "demo", "title": "雾镇旅人", "author": "测试"},
        "origin": {
            "ch": 0,
            "ch_title": "第 1 节",
            "para": 0,
            "quote": "森林里迷雾越来越浓",
            "mode": "from-selection",
            "from_ins": None,
        },
        "context": "张三离开雾镇，与李四同行。\n\n他们穿越迷雾森林。",
        "prompt": "让主角失败并黑化",
        "tones": ["darker"],
        "strength": "strong",
        "constraints": "李四不能死",
    }


def test_overwrite_stateless(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works")
    llm = MockLLM(review_mode="pass")
    final = run_overwrite(_payload(), settings=settings, llm=llm, checkpointer=MemorySaver())

    assert final["result"]["正文"]
    assert final["aspect"] == "剧情"
    assert final["review_passed"] is True
    assert final["branch_dir"] == ""  # 无世界书 → stateless


def test_overwrite_with_worldbook(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works")
    work = settings.works_dir / "雾镇旅人"
    (work / "世界书").mkdir(parents=True)
    (work / "世界书" / "world_info.json").write_text(json.dumps({"entries": {}}), encoding="utf-8")

    llm = MockLLM(review_mode="pass")
    final = run_overwrite(_payload(), settings=settings, llm=llm, checkpointer=MemorySaver())

    assert final["has_worldbook"] is True
    assert final["branch_dir"]
    branch = Path(final["branch_dir"])
    assert (branch / "世界书" / "world_info.json").exists()
    assert (branch / "改写说明.md").exists()
    # 原件不动（world_info.json 仍为空 entries）
    assert "雾镇" not in (work / "世界书" / "world_info.json").read_text(encoding="utf-8")


def test_overwrite_review_loop(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works", max_revisions=2)
    llm = MockLLM(review_mode="fail_then_pass")
    final = run_overwrite(_payload(), settings=settings, llm=llm, checkpointer=MemorySaver())

    assert final["review_passed"] is True
    assert final["revision_count"] >= 1
    assert len(final["review_history"]) == 2
