from literary_agent.schemas import ChunkAnalysis, ReviewReport


def test_chunk_analysis_validate():
    data = {"局部梗概": "x", "人物": [{"姓名": "张三", "本块经历事件": ["a"]}], "世界": []}
    ca = ChunkAnalysis.model_validate(data)
    assert ca.局部梗概 == "x"
    assert ca.人物[0].姓名 == "张三"
    assert ca.人物[0].本块经历事件 == ["a"]


def test_chunk_analysis_ignores_extra():
    ca = ChunkAnalysis.model_validate({"局部梗概": "x", "extra": 1})
    assert ca.局部梗概 == "x"
    assert ca.人物 == []


def test_review_report():
    r = ReviewReport.model_validate({"通过": True, "评分": {"一致性": 5}, "问题清单": [], "修订意见": ""})
    assert r.通过 is True
    assert r.评分["一致性"] == 5
