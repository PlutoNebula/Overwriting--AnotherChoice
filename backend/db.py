"""数据库层：SQLModel 引擎 / Session / 建表 / 五张业务表。

业务主键沿用前端字符串 id（book.id / branch.id），不自增；
结构化原文用代理自增主键 + idx 定位（章节/段落无稳定 id，靠数组下标）。
"""

from typing import Iterator

from sqlalchemy import JSON, BigInteger, Column, ForeignKey, Integer, String, Text, UniqueConstraint, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Field, Relationship, SQLModel, Session, create_engine

_engine: Engine | None = None
_SessionLocal: sessionmaker | None = None


def make_engine(url: str) -> Engine:
    """按 URL 建引擎。sqlite（测试用）加 check_same_thread 与外键开关；MySQL 走连接池。"""
    connect_args: dict = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    eng = create_engine(url, connect_args=connect_args, pool_pre_ping=True, pool_recycle=3600)
    if url.startswith("sqlite"):
        @event.listens_for(eng, "connect")
        def _fk_on(dbapi_conn, _record):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return eng


def ensure_database(settings) -> None:
    """MySQL 不会自动建库，先连无库 URL 执行 CREATE DATABASE IF NOT EXISTS。"""
    from sqlalchemy import create_engine as _ce
    from sqlalchemy import text

    url = (f"mysql+pymysql://{settings.db_user}:{settings.db_password}"
           f"@{settings.db_host}:{settings.db_port}/?charset=utf8mb4")
    eng = _ce(url, isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    try:
        with eng.connect() as conn:
            conn.execute(text(
                f"CREATE DATABASE IF NOT EXISTS `{settings.db_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            ))
    finally:
        eng.dispose()


def init_db(settings) -> Engine:
    """建库 + 建引擎 + 建表，返回引擎并绑定模块级 SessionLocal。"""
    global _engine, _SessionLocal
    ensure_database(settings)
    _engine = make_engine(settings.database_url)
    SQLModel.metadata.create_all(_engine)
    _SessionLocal = sessionmaker(bind=_engine, class_=Session, expire_on_commit=False)
    return _engine


def get_session() -> Iterator[Session]:
    """FastAPI 依赖注入用：每请求一个 Session。"""
    if _SessionLocal is None:
        raise RuntimeError("数据库未初始化：请先调用 init_db()")
    with _SessionLocal() as session:
        yield session


# ============================ 模型 ============================


class Book(SQLModel, table=True):
    __tablename__ = "book"
    __table_args__ = (UniqueConstraint("user_id", "id"),)

    pk: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(default="", index=True, max_length=64)
    id: str = Field(default="", index=True, max_length=64)
    title: str = Field(default="", max_length=255)
    author: str = Field(default="", max_length=255)
    sub: str = Field(default="", max_length=255)
    finale: str = Field(default="", sa_column=Column(Text))

    chapters: list["Chapter"] = Relationship(back_populates="book", cascade_delete=True)
    inscriptions: list["Inscription"] = Relationship(back_populates="book", cascade_delete=True)


class Chapter(SQLModel, table=True):
    __tablename__ = "chapter"
    __table_args__ = (UniqueConstraint("book_pk", "idx"),)

    id: int | None = Field(default=None, primary_key=True)
    book_pk: int | None = Field(sa_column=Column(Integer, ForeignKey("book.pk", ondelete="CASCADE"), index=True))
    idx: int = Field(default=0)
    title: str = Field(default="", max_length=255)

    book: Book = Relationship(back_populates="chapters")
    paragraphs: list["Paragraph"] = Relationship(back_populates="chapter", cascade_delete=True)


class Paragraph(SQLModel, table=True):
    __tablename__ = "paragraph"
    __table_args__ = (UniqueConstraint("chapter_id", "idx"),)

    id: int | None = Field(default=None, primary_key=True)
    chapter_id: int | None = Field(sa_column=Column(Integer, ForeignKey("chapter.id", ondelete="CASCADE"), index=True))
    idx: int = Field(default=0)
    text: str = Field(default="", sa_column=Column(Text))

    chapter: Chapter = Relationship(back_populates="paragraphs")


class Branch(SQLModel, table=True):
    __tablename__ = "branch"

    id: str = Field(primary_key=True, max_length=64)
    book_pk: int | None = Field(sa_column=Column(Integer, ForeignKey("book.pk", ondelete="CASCADE"), index=True))
    parent_id: str | None = Field(
        default=None,
        sa_column=Column(String(64), ForeignKey("branch.id", ondelete="RESTRICT"), index=True),
    )
    no: int = Field(default=0)
    title: str = Field(default="", max_length=255)
    narrative: str = Field(default="", sa_column=Column(Text))
    status: str = Field(default="accepted", max_length=16)

    origin_json: dict | None = Field(default=None, sa_column=Column(JSON))
    form_json: dict | None = Field(default=None, sa_column=Column(JSON))
    result_json: dict | None = Field(default=None, sa_column=Column(JSON))
    changes_json: list | None = Field(default=None, sa_column=Column(JSON))
    conflicts_json: list | None = Field(default=None, sa_column=Column(JSON))
    next_directions_json: list | None = Field(default=None, sa_column=Column(JSON))

    demo: bool = Field(default=False)
    edited_by_reader: bool = Field(default=False)
    pending: bool = Field(default=False)
    at: int = Field(default=0, sa_column=Column(BigInteger))

    chapters: list["BranchChapter"] = Relationship(back_populates="branch", cascade_delete=True)


class BranchChapter(SQLModel, table=True):
    __tablename__ = "branch_chapter"
    __table_args__ = (UniqueConstraint("branch_id", "ch_idx"),)

    id: int | None = Field(default=None, primary_key=True)
    branch_id: str = Field(sa_column=Column(String(64), ForeignKey("branch.id", ondelete="CASCADE"), index=True))
    ch_idx: int = Field(default=0)
    narrative: str = Field(default="", sa_column=Column(Text))
    summary: str = Field(default="", sa_column=Column(Text))
    title: str = Field(default="", max_length=255)
    demo: bool = Field(default=False)

    branch: Branch = Relationship(back_populates="chapters")


class Inscription(SQLModel, table=True):
    __tablename__ = "inscription"

    id: str = Field(primary_key=True, max_length=64)
    book_pk: int | None = Field(sa_column=Column(Integer, ForeignKey("book.pk", ondelete="CASCADE"), index=True))
    branch_id: str | None = Field(default=None, max_length=64, index=True)
    kind: str = Field(default="", max_length=32)
    ch: int = Field(default=0)
    para: int = Field(default=0)
    s: int = Field(default=0)
    e: int = Field(default=0)
    quote: str = Field(default="", sa_column=Column(Text))
    body: str = Field(default="", sa_column=Column(Text))
    at: int = Field(default=0, sa_column=Column(BigInteger))

    book: Book = Relationship(back_populates="inscriptions")
