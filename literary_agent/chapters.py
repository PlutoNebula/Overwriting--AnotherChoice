"""按「第X章」标题把长文本正则划分为章节。"""

import re

_NUM = r"[一二三四五六七八九十百千零〇两0-9０-９]"
CHAPTER_RE = re.compile(rf"^[ \t]*第[ \t]*{_NUM}+[ \t]*章[^\n]*", re.MULTILINE)


def _split_paras(text: str) -> list[str]:
    blocks = re.split(r"\n[ \t]*\n", text.strip())
    return [b.strip() for b in blocks if b.strip()]


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
