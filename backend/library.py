"""业务持久化：结构化原文 upsert、分支 upsert、reparent 删除。

请求模型与前端 JSON 保持同名 camelCase；extra="ignore" 丢弃前端多带的字段。
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from backend.db import Book, Branch, BranchChapter, Chapter, Inscription, Paragraph


class ChapterSave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    paras: list[str] = Field(default_factory=list)


class BookSaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str = ""
    author: str = ""
    sub: str = ""
    finale: str = ""
    chapters: list[ChapterSave] = Field(default_factory=list)


class BranchChapterSave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    narrative: str = ""
    summary: str = ""
    title: str = ""
    demo: bool = False


class BranchSaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    no: int = 0
    parentId: str | None = None
    origin: dict = Field(default_factory=dict)
    title: str = ""
    narrative: str = ""
    chapters: dict[str, BranchChapterSave] = Field(default_factory=dict)
    changes: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    nextDirections: list[str] = Field(default_factory=list)
    form: dict = Field(default_factory=dict)
    result: dict = Field(default_factory=dict)
    status: str = "accepted"
    demo: bool = False
    editedByReader: bool = False
    pending: bool = False
    at: int = 0


def _get_book(session: Session, user_id: str, book_id: str) -> Book | None:
    return session.exec(select(Book).where(Book.user_id == user_id, Book.id == book_id)).first()


def upsert_book(session: Session, user_id: str, req: BookSaveRequest) -> Book:
    book = session.exec(select(Book).where(Book.id == req.id, Book.user_id == user_id)).first()
    if book is None:
        book = Book(id=req.id, user_id=user_id)
        session.add(book)
    book.title = req.title
    book.author = req.author
    book.sub = req.sub
    book.finale = req.finale

    # 替换章节：清旧章（段落由 delete-orphan 级联删除），flush 避免 (book_id, idx) 唯一冲突
    book.chapters.clear()
    session.flush()
    for ci, ch in enumerate(req.chapters):
        chapter = Chapter(idx=ci, title=ch.title)
        for pi, para in enumerate(ch.paras):
            chapter.paragraphs.append(Paragraph(idx=pi, text=para))
        book.chapters.append(chapter)

    session.commit()
    return book


def upsert_branch(session: Session, user_id: str, book_id: str, req: BranchSaveRequest) -> Branch | None:
    book = _get_book(session, user_id, book_id)
    if book is None:
        return None

    branch = session.get(Branch, req.id)
    if branch is None:
        branch = Branch(id=req.id, book_pk=book.pk)
        session.add(branch)
    elif branch.book_pk != book.pk:
        return None

    branch.parent_id = req.parentId
    branch.no = req.no
    branch.title = req.title
    branch.narrative = req.narrative
    branch.status = req.status
    branch.origin_json = req.origin or None
    branch.form_json = req.form or None
    branch.result_json = req.result or None
    branch.changes_json = req.changes or None
    branch.conflicts_json = req.conflicts or None
    branch.next_directions_json = req.nextDirections or None
    branch.demo = req.demo
    branch.edited_by_reader = req.editedByReader
    branch.pending = req.pending
    branch.at = req.at

    branch.chapters.clear()
    session.flush()
    for k, v in req.chapters.items():
        branch.chapters.append(BranchChapter(
            ch_idx=int(k), narrative=v.narrative, summary=v.summary, title=v.title, demo=v.demo
        ))

    session.commit()
    return branch


def delete_branch(session: Session, user_id: str, book_id: str, branch_id: str) -> tuple[str | None, str | None, list[str]]:
    """reparent 删除：子分支 parent_id 改指向被删分支的父分支，再删自身。

    返回 (deleted_id, parent_id, reparented)；不存在或不属于该书/该用户时返回 (None, None, [])。
    """
    book = _get_book(session, user_id, book_id)
    if book is None:
        return None, None, []
    target = session.get(Branch, branch_id)
    if target is None or target.book_pk != book.pk:
        return None, None, []

    parent_id = target.parent_id
    book_pk = target.book_pk
    children = list(session.exec(
        select(Branch).where(Branch.parent_id == branch_id, Branch.book_pk == book_pk)
    ).all())
    reparented = [c.id for c in children]
    for c in children:
        c.parent_id = parent_id
    session.flush()  # 先落库 reparent，避免 parent_id 的 RESTRICT 外键阻止删除
    session.delete(target)
    session.commit()
    return branch_id, parent_id, reparented


def list_branches(session: Session, user_id: str, book_id: str) -> list[Branch]:
    book = _get_book(session, user_id, book_id)
    if book is None:
        return []
    return list(session.exec(select(Branch).where(Branch.book_pk == book.pk)).all())


def delete_book(session: Session, user_id: str, book_id: str) -> str | None:
    """删除整本书：先解除分支间 parent_id 引用，再删书让级联清理章节/段落/分支。"""
    book = _get_book(session, user_id, book_id)
    if book is None:
        return None
    branches = list(session.exec(select(Branch).where(Branch.book_pk == book.pk)).all())
    for b in branches:
        b.parent_id = None
    session.flush()
    session.delete(book)
    session.commit()
    return book_id


class InscriptionSaveRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    kind: str = ""
    branchId: str | None = None
    ch: int = 0
    para: int = 0
    s: int = 0
    e: int = 0
    quote: str = ""
    body: str = ""
    at: int = 0


def upsert_inscription(session: Session, user_id: str, book_id: str, req: InscriptionSaveRequest) -> Inscription | None:
    book = _get_book(session, user_id, book_id)
    if book is None:
        return None
    ins = session.get(Inscription, req.id)
    if ins is None:
        ins = Inscription(id=req.id, book_pk=book.pk)
        session.add(ins)
    elif ins.book_pk != book.pk:
        return None
    ins.branch_id = req.branchId
    ins.kind = req.kind
    ins.ch = req.ch
    ins.para = req.para
    ins.s = req.s
    ins.e = req.e
    ins.quote = req.quote
    ins.body = req.body
    ins.at = req.at
    session.commit()
    return ins


def delete_inscription(session: Session, user_id: str, book_id: str, ins_id: str) -> str | None:
    book = _get_book(session, user_id, book_id)
    if book is None:
        return None
    ins = session.get(Inscription, ins_id)
    if ins is None or ins.book_pk != book.pk:
        return None
    session.delete(ins)
    session.commit()
    return ins_id


def list_inscriptions(session: Session, user_id: str, book_id: str) -> list[Inscription]:
    book = _get_book(session, user_id, book_id)
    if book is None:
        return []
    return list(session.exec(select(Inscription).where(Inscription.book_pk == book.pk)).all())
