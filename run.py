from __future__ import annotations

import argparse
import sys
from pathlib import Path

from literary_agent.config import load_settings
from literary_agent.graph import run_pipeline
from literary_agent.mock_llm import MockLLM


def _make_checkpointer():
    """优先用 SQLite 持久化（支持断点续跑），失败则退回内存。"""
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver

        return SqliteSaver.from_conn_string("checkpoint.sqlite")
    except Exception:  # noqa: BLE001
        from langgraph.checkpoint.memory import MemorySaver

        return MemorySaver()


def cmd_analyze(args) -> int:
    settings = load_settings()
    if args.model:
        settings.model = args.model
    if args.max_revisions is not None:
        settings.max_revisions = args.max_revisions
    if args.works_dir:
        settings.works_dir = Path(args.works_dir)

    source = Path(args.input)
    if not source.exists():
        print(f"[错误] 文件不存在：{source}", file=sys.stderr)
        return 1

    if args.dry_run:
        from langgraph.checkpoint.memory import MemorySaver

        llm = MockLLM(review_mode="fail_then_pass" if not args.no_review else "pass")
        checkpointer = MemorySaver()
    else:
        from literary_agent.llm import build_llm

        llm = build_llm(settings)
        checkpointer = _make_checkpointer()

    final = run_pipeline(
        source,
        settings=settings,
        llm=llm,
        checkpointer=checkpointer,
        enable_review=not args.no_review,
    )

    print(f"[完成] 输出目录：{final.get('work_dir')}")
    if final.get("errors"):
        print("[警告] 存在以下问题：")
        for e in final["errors"]:
            print(f"  - {e}")
    return 0


def cmd_batch(args) -> int:
    d = Path(args.dir)
    if not d.is_dir():
        print(f"[错误] 目录不存在：{d}", file=sys.stderr)
        return 1
    files = sorted(p for p in d.iterdir() if p.is_file() and p.suffix.lower() in (".txt", ".md"))
    if not files:
        print(f"[错误] 目录中无 .txt/.md 文件：{d}", file=sys.stderr)
        return 1
    for f in files:
        print(f"[处理] {f}")
        sub = argparse.Namespace(
            input=str(f),
            model=args.model,
            max_revisions=args.max_revisions,
            no_review=args.no_review,
            dry_run=args.dry_run,
            works_dir=args.works_dir,
        )
        rc = cmd_analyze(sub)
        if rc != 0:
            return rc
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="中短篇文学作品解读 Agent（LangGraph + DeepSeek）")
    sub = parser.add_subparsers(dest="command", required=True)

    a = sub.add_parser("analyze", help="分析单篇作品")
    a.add_argument("input", help="作品文件路径（.txt/.md）")
    a.add_argument("--model", help="DeepSeek 模型名（默认 deepseek-chat）")
    a.add_argument("--max-revisions", type=int, help="review 最大修订次数（默认 2）")
    a.add_argument("--no-review", action="store_true", help="跳过评测环节")
    a.add_argument("--dry-run", action="store_true", help="离线 mock 模式，无需 API Key")
    a.add_argument("--works-dir", help="输出根目录（默认 works/）")
    a.set_defaults(func=cmd_analyze)

    b = sub.add_parser("batch", help="批量处理目录中的 .txt/.md")
    b.add_argument("dir", help="含 .txt/.md 的目录")
    b.add_argument("--model")
    b.add_argument("--max-revisions", type=int)
    b.add_argument("--no-review", action="store_true")
    b.add_argument("--dry-run", action="store_true")
    b.add_argument("--works-dir")
    b.set_defaults(func=cmd_batch)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
