from __future__ import annotations

import shutil
import uuid
from pathlib import Path

import pytest


@pytest.fixture
def tmp_dir():
    """工作区内的临时目录。

    用默认权限 mkdir（而非 pytest 的 tmp_path / tempfile 默认的 0o700），
    以避开 DSH 沙箱对 0o700 目录的 ACL 限制。
    """
    d = Path.cwd() / f"tmp_test_{uuid.uuid4().hex[:8]}"
    d.mkdir()
    yield d
    shutil.rmtree(d, ignore_errors=True)
