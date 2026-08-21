from literary_agent.chunking import chunk_text, split_paragraphs


def test_split_paragraphs():
    text = "第一段。\n\n第二段。\n\n第三段。"
    assert split_paragraphs(text) == ["第一段。", "第二段。", "第三段。"]


def test_short_text_single_chunk():
    assert chunk_text("短文本", 100, 10) == ["短文本"]


def test_empty():
    assert chunk_text("") == []


def test_chunks_overlap():
    text = "字" * 5000
    chunks = chunk_text(text, 2000, 100)
    assert len(chunks) >= 3
    # 相邻块存在重叠
    assert chunks[0][-100:] == chunks[1][:100]
