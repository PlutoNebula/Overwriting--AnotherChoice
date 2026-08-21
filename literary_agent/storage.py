from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

_ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

REQUIRED_SUBDIRS = ["剧本摘要", "人物信息", "世界书"]


def sanitize_name(name: str, max_len: int = 80) -> str:
    """清洗文件名/目录名：去掉 Windows 非法字符与空白，防路径穿越。"""
    name = _ILLEGAL.sub("", name).strip().strip(".")
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        name = "未命名"
    return name[:max_len].rstrip()


def read_text(path: Path) -> str:
    """读取文本文件，按常见中文编码顺序探测。"""
    data = path.read_bytes()
    for enc in ("utf-8", "gbk", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", errors="replace")


def atomic_write(dest: Path, content: str) -> None:
    """先写临时文件再 rename，避免并发/中断造成半写文件。"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(dest)


def _safe_rel(rel: str) -> Path:
    parts = [sanitize_name(p) for p in rel.replace("\\", "/").split("/") if p]
    return Path(*parts) if parts else Path("未命名.md")


def render_review_report(review_history: list[dict], state: dict) -> str:
    lines = ["# 评测报告", ""]
    if not review_history:
        lines.append("（未进行评测）")
        return "\n".join(lines)

    for i, rep in enumerate(review_history, 1):
        passed = "✅ 通过" if rep.get("通过") else "❌ 需修订"
        lines.append(f"## 第 {i} 轮 · {passed}")
        scores = rep.get("评分", {})
        if scores:
            lines.append("")
            lines.append("| 维度 | 评分 |")
            lines.append("|------|------|")
            for k, v in scores.items():
                lines.append(f"| {k} | {v} |")
        issues = rep.get("问题清单", [])
        if issues:
            lines.append("")
            lines.append("### 问题清单")
            for iss in issues:
                lines.append(
                    f"- [{iss.get('严重度', '中')}] **{iss.get('位置', '')}**："
                    f"{iss.get('描述', '')}（建议：{iss.get('建议', '')}）"
                )
        else:
            lines.append("")
            lines.append("无问题。")
        if rep.get("修订意见"):
            lines.append("")
            lines.append(f"**修订意见**：{rep.get('修订意见')}")
        lines.append("")

    final = review_history[-1]
    conclusion = "通过" if final.get("通过") else "达到修订上限，按当前版本归档"
    lines.append(f"## 结论：{conclusion}")
    return "\n".join(lines)


def render_meta(work_name: str, state: dict, model: str) -> str:
    meta = {
        "作品名": work_name,
        "源文件": state.get("source_path", ""),
        "模型": model,
        "块数": len(state.get("chunks", [])),
        "修订次数": state.get("revision_count", 0),
        "评测通过": bool(state.get("review_passed")),
        "生成时间": datetime.now(timezone.utc).isoformat(),
        "错误": state.get("errors", []),
    }
    return json.dumps(meta, ensure_ascii=False, indent=2)


def write_all(settings, work_name: str, outputs: dict[str, str], review_history: list[dict], state: dict) -> Path:
    """把成稿写入 `works/<作品名>/` 下的三个子文件夹 + 评测报告 + 元数据。"""
    work_dir = settings.works_dir / sanitize_name(work_name)
    for sub in REQUIRED_SUBDIRS:
        (work_dir / sub).mkdir(parents=True, exist_ok=True)

    for rel, content in outputs.items():
        atomic_write(work_dir / _safe_rel(rel), content)

    atomic_write(work_dir / "评测报告.md", render_review_report(review_history, state))
    atomic_write(work_dir / "_meta.json", render_meta(work_name, state, settings.model))
    return work_dir
