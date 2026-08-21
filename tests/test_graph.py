from pathlib import Path

from langgraph.checkpoint.memory import MemorySaver

from literary_agent.config import Settings
from literary_agent.graph import run_pipeline
from literary_agent.mock_llm import MockLLM


def _write_sample(tmp_dir: Path) -> Path:
    p = tmp_dir / "样例.txt"
    p.write_text("张三离开雾镇，与李四同行，踏上旅程。\n\n他们穿越迷雾森林，遭遇了守林人。", encoding="utf-8")
    return p


def test_end_to_end_pass(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works")
    src = _write_sample(tmp_dir)
    llm = MockLLM(review_mode="pass")
    final = run_pipeline(src, settings=settings, llm=llm, checkpointer=MemorySaver(), enable_review=True)

    assert final["status"] == "done"
    assert final["review_passed"] is True
    work_dir = Path(final["work_dir"])
    assert (work_dir / "剧本摘要" / "内容梗概.md").exists()
    assert (work_dir / "人物信息" / "张三.md").exists()
    assert (work_dir / "世界书" / "worldbook.json").exists()
    assert (work_dir / "评测报告.md").exists()
    assert (work_dir / "_meta.json").exists()


def test_end_to_end_revision_loop(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works", max_revisions=2)
    src = _write_sample(tmp_dir)
    llm = MockLLM(review_mode="fail_then_pass")
    final = run_pipeline(src, settings=settings, llm=llm, checkpointer=MemorySaver(), enable_review=True)

    assert final["status"] == "done"
    assert final["review_passed"] is True
    # 发生过一次修订
    assert final["revision_count"] >= 1
    # 评测历史应有两轮
    assert len(final["review_history"]) == 2


def test_end_to_end_no_review(tmp_dir):
    settings = Settings(works_dir=tmp_dir / "works")
    src = _write_sample(tmp_dir)
    llm = MockLLM(review_mode="pass")
    final = run_pipeline(src, settings=settings, llm=llm, checkpointer=MemorySaver(), enable_review=False)

    assert final["status"] == "done"
    assert final["review_history"] == []
    assert (Path(final["work_dir"]) / "评测报告.md").exists()
