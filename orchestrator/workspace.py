"""Workspace lifecycle: create run-id, clone repo, manage artifact dirs."""
from __future__ import annotations
import secrets
import shutil
from pathlib import Path

from git import Repo, GitCommandError

from shared.config import WORKSPACES


def new_run_id() -> str:
    return secrets.token_hex(4)


def workspace_dir(run_id: str) -> Path:
    return WORKSPACES / run_id


def repo_dir(run_id: str) -> Path:
    return workspace_dir(run_id) / "repo"


def artifacts_dir(run_id: str) -> Path:
    p = workspace_dir(run_id) / "artifacts"
    p.mkdir(parents=True, exist_ok=True)
    return p


def clone_repo(run_id: str, source: str) -> Path:
    """Clone a git URL OR copy a local path into workspaces/<run-id>/repo/."""
    target = repo_dir(run_id)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        shutil.rmtree(target)

    src_path = Path(source)
    if src_path.exists() and src_path.is_dir():
        shutil.copytree(src_path, target)
        return target

    try:
        Repo.clone_from(source, target, depth=50)
    except GitCommandError as e:
        raise RuntimeError(f"git clone failed: {e}") from e
    return target
