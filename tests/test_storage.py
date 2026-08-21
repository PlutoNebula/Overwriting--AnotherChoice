from literary_agent.storage import atomic_write, sanitize_name


def test_sanitize_name():
    assert sanitize_name('a/b\\c:d*e?f"g<h>i|j') == "abcdefghij"
    assert sanitize_name("..") == "未命名"
    assert sanitize_name("") == "未命名"


def test_atomic_write(tmp_dir):
    dest = tmp_dir / "x" / "f.md"
    atomic_write(dest, "hello")
    assert dest.read_text(encoding="utf-8") == "hello"
    assert not dest.with_name("f.md.tmp").exists()
