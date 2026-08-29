"""按「第X章」标题把长文本正则划分为章节。"""

import re

_NUM = r"[一二三四五六七八九十百千零〇两0-9０-９]"
CHAPTER_RE = re.compile(rf"^[ \t]*第[ \t]*{_NUM}+[ \t]*章[^\n]*", re.MULTILINE)


def _split_paras(text: str) -> list[str]:
    """识别自然段，并去掉 TXT 为控制行宽而插入的软换行。"""
    # 只去掉文件首尾的换行，保留首行段首缩进用于判断自然段边界。
    rows = text.strip("\n").split("\n")
    non_empty = [line for line in rows if line.strip()]
    has_blank_line = any(not line.strip() for line in rows)
    indented_count = sum(bool(re.match(r"^(?:[ \t]{2,}|\u3000)", line)) for line in non_empty)
    groups: list[list[str]] = []
    current: list[str] = []

    def flush() -> None:
        if current:
            groups.append(current.copy())
            current.clear()

    for raw_line in rows:
        line = raw_line.strip()
        if not line:
            flush()
            continue
        if (
            not has_blank_line
            and indented_count > 1
            and current
            and re.match(r"^(?:[ \t]{2,}|\u3000)", raw_line)
        ):
            flush()
        current.append(line)
        if (
            not has_blank_line
            and indented_count <= 1
            and re.search(r"[。！？!?…][”’』」》）】)]*$", line)
        ):
            flush()
    flush()

    def join_wrapped_lines(lines: list[str]) -> str:
        result = ""
        for line in lines:
            if result and result[-1].isascii() and result[-1].isalnum() and line[0].isascii() and line[0].isalnum():
                result += " "
            result += line
        return result

    return [join_wrapped_lines(group) for group in groups]


def split_chapters(text: str) -> list[dict]:
    """把长文本按「第X章」标题切分成章节，返回 [{title, paras}]。

    规则：
    - 章节标题形如「第一章」「第 1 章」「第十二章」，可带后续标题文字。
    - 第一个标题之前的文本归入「前言」章。
    - 每个章节的正文按空行拆成段落（paras）。
    """
    if not text:
        return []
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    matches = list(CHAPTER_RE.finditer(text))
    if not matches:
        paras = _split_paras(text)
        return [{"title": "", "paras": paras}] if paras else []

    chapters = []
    pre = text[: matches[0].start()].strip()
    if pre:
        paras = _split_paras(pre)
        if paras:
            chapters.append({"title": "前言", "paras": paras})

    for i, m in enumerate(matches):
        title = m.group(0).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        paras = _split_paras(text[start:end])
        if paras:
            chapters.append({"title": title, "paras": paras})
    return chapters
