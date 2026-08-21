from __future__ import annotations

import re


def split_paragraphs(text: str) -> list[str]:
    """按空行切分段落，保留段落内部换行。"""
    parts = re.split(r"\n\s*\n", text)
    return [p.strip() for p in parts if p.strip()]


def _hard_split(text: str, size: int, overlap: int) -> list[str]:
    """把超长段落硬切成固定大小的重叠块。"""
    pieces: list[str] = []
    start = 0
    n = len(text)
    step = max(size - overlap, 1)
    while start < n:
        pieces.append(text[start : start + size])
        start += step
    return pieces


def chunk_text(text: str, chunk_size: int = 8000, overlap: int = 500) -> list[str]:
    """把长文本切成带重叠的块，优先在段落边界断开。

    - 短于 chunk_size 的文本直接返回单块，避免无谓 fan-out。
    - 相邻块之间保留 overlap 个字符，减少跨块信息断裂。
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    current = ""
    for para in split_paragraphs(text):
        if len(para) > chunk_size:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(_hard_split(para, chunk_size, overlap))
            continue
        if len(current) + len(para) + 1 > chunk_size:
            chunks.append(current)
            tail = current[-overlap:] if overlap > 0 else ""
            current = f"{tail}\n{para}" if tail else para
        else:
            current = f"{current}\n{para}".strip()
    if current:
        chunks.append(current)
    return chunks
