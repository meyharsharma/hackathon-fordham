"""Shared @tool functions usable by any specialist agent.

Each tool is a thin wrapper around stdlib calls. Keep them pure and
deterministic — the LLM should be the only source of variance.
"""
from __future__ import annotations

import ast
import json
import os
import subprocess
from pathlib import Path

from autogen.beta.tools import tool


_SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "__pycache__",
              "dist", "build", ".next", ".cache", "target", ".idea"}
_CODE_EXT = {".py": "python", ".js": "javascript", ".jsx": "javascript",
             ".ts": "typescript", ".tsx": "typescript", ".go": "go",
             ".rs": "rust", ".java": "java", ".rb": "ruby", ".php": "php",
             ".c": "c", ".h": "c", ".cpp": "cpp", ".hpp": "cpp",
             ".cs": "csharp", ".swift": "swift", ".kt": "kotlin"}


@tool
def walk_tree(workspace: str, max_files: int = 500) -> str:
    """List all source files in the workspace as JSON.

    Args:
        workspace: absolute path to repo root.
        max_files: cap on returned files (large repos truncate).
    Returns:
        JSON string: {"files": [{"path": str, "language": str, "loc": int}, ...]}
    """
    root = Path(workspace).resolve()
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            ext = Path(fn).suffix.lower()
            if ext not in _CODE_EXT:
                continue
            p = Path(dirpath) / fn
            try:
                loc = sum(1 for _ in p.open("r", encoding="utf-8", errors="ignore"))
            except OSError:
                loc = 0
            out.append({
                "path": str(p.relative_to(root)),
                "language": _CODE_EXT[ext],
                "loc": loc,
            })
            if len(out) >= max_files:
                return json.dumps({"files": out, "truncated": True})
    return json.dumps({"files": out, "truncated": False})


@tool
def parse_imports_python(workspace: str, file_path: str) -> str:
    """Extract import statements from a Python file.

    Returns JSON: {"imports": [str, ...]}
    """
    p = Path(workspace) / file_path
    try:
        tree = ast.parse(p.read_text(encoding="utf-8", errors="ignore"))
    except (SyntaxError, OSError) as e:
        return json.dumps({"imports": [], "error": str(e)})
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    return json.dumps({"imports": sorted(set(imports))})


@tool
def parse_imports_js(workspace: str, file_path: str) -> str:
    """Extract `import ... from '...'` and `require('...')` targets from JS/TS.

    Returns JSON: {"imports": [str, ...]}
    """
    import re
    p = Path(workspace) / file_path
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        return json.dumps({"imports": [], "error": str(e)})
    pattern = re.compile(r"""(?:from|require\()\s*['"]([^'"]+)['"]""")
    return json.dumps({"imports": sorted(set(pattern.findall(text)))})


@tool
def read_file_bounded(workspace: str, file_path: str, max_bytes: int = 12000) -> str:
    """Return up to max_bytes of a file's text content."""
    p = Path(workspace) / file_path
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        return f"ERROR: {e}"
    if len(text) > max_bytes:
        text = text[:max_bytes] + f"\n\n... [truncated, {len(text)} bytes total]"
    return text


@tool
def list_public_symbols_python(workspace: str, file_path: str) -> str:
    """Extract top-level functions/classes and their signatures from a Python file.

    Returns JSON: {"symbols": [{"kind": "function"|"class", "name": str,
                                "signature": str, "docstring": str}, ...]}
    """
    p = Path(workspace) / file_path
    try:
        tree = ast.parse(p.read_text(encoding="utf-8", errors="ignore"))
    except (SyntaxError, OSError) as e:
        return json.dumps({"symbols": [], "error": str(e)})
    out = []
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name.startswith("_"):
                continue
            args = ast.unparse(node.args)
            out.append({
                "kind": "function",
                "name": node.name,
                "signature": f"def {node.name}({args})",
                "docstring": ast.get_docstring(node) or "",
            })
        elif isinstance(node, ast.ClassDef):
            if node.name.startswith("_"):
                continue
            out.append({
                "kind": "class",
                "name": node.name,
                "signature": f"class {node.name}",
                "docstring": ast.get_docstring(node) or "",
            })
    return json.dumps({"symbols": out})


@tool
def git_log_for_file(workspace: str, file_path: str, max_commits: int = 8) -> str:
    """Return recent commit log entries touching a file.

    Returns JSON: {"commits": [{"sha": str, "date": str, "subject": str, "author": str}, ...]}
    """
    try:
        out = subprocess.check_output(
            ["git", "-C", workspace, "log",
             f"-n{max_commits}",
             "--pretty=format:%h%x09%ad%x09%an%x09%s",
             "--date=short", "--", file_path],
            stderr=subprocess.STDOUT, text=True, timeout=10,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
        return json.dumps({"commits": [], "error": str(e)})
    commits = []
    for line in out.strip().splitlines():
        parts = line.split("\t", 3)
        if len(parts) == 4:
            sha, date, author, subject = parts
            commits.append({"sha": sha, "date": date, "author": author, "subject": subject})
    return json.dumps({"commits": commits})


@tool
def git_log_summary(workspace: str, max_commits: int = 30) -> str:
    """Return recent commit log for whole repo, with body text.

    Returns JSON: {"commits": [{"sha": str, "date": str, "subject": str, "body": str}, ...]}
    """
    try:
        raw = subprocess.check_output(
            ["git", "-C", workspace, "log",
             f"-n{max_commits}",
             "--pretty=format:%h%x1f%ad%x1f%s%x1f%b%x1e",
             "--date=short"],
            stderr=subprocess.STDOUT, text=True, timeout=15,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired) as e:
        return json.dumps({"commits": [], "error": str(e)})
    commits = []
    for entry in raw.split("\x1e"):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split("\x1f")
        if len(parts) >= 4:
            commits.append({"sha": parts[0], "date": parts[1],
                            "subject": parts[2], "body": parts[3].strip()})
    return json.dumps({"commits": commits})


@tool
def gh_pr_for_commit(workspace: str, sha: str) -> str:
    """Look up the PR number for a commit via `gh`. May fail offline.

    Returns JSON: {"pr": int|null, "title": str|null, "body": str|null}
    """
    try:
        out = subprocess.check_output(
            ["gh", "pr", "list", "--state", "merged", "--search", sha,
             "--json", "number,title,body", "-L", "1"],
            stderr=subprocess.STDOUT, text=True, cwd=workspace, timeout=10,
        )
        arr = json.loads(out)
        if arr:
            pr = arr[0]
            return json.dumps({"pr": pr["number"], "title": pr["title"], "body": pr.get("body", "")[:1500]})
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass
    return json.dumps({"pr": None, "title": None, "body": None})


@tool
def read_artifact(workspace: str, artifact_name: str) -> str:
    """Read a previously-produced artifact JSON from workspaces/<run-id>/artifacts/."""
    p = Path(workspace).parent / "artifacts" / artifact_name
    try:
        return p.read_text(encoding="utf-8")
    except OSError as e:
        return json.dumps({"error": str(e)})
