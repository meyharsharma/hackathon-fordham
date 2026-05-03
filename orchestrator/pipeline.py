"""3-stage NLIP pipeline driver. The ONLY place that knows agent topology."""
from __future__ import annotations
import asyncio
import json
import re
import time
from pathlib import Path
from typing import Awaitable, Callable

from shared.config import agent_url
from shared.envelopes import send
from orchestrator.workspace import repo_dir, artifacts_dir


EventCb = Callable[[dict], Awaitable[None]]


async def _emit(cb: EventCb | None, event: dict) -> None:
    if cb:
        await cb(event)


async def _call_agent(name: str, payload: dict, cb: EventCb | None) -> dict | str:
    url = agent_url(name)
    t0 = time.time()
    await _emit(cb, {"type": "agent_start", "agent": name, "url": url})
    try:
        result = await send(url, payload, timeout=600)
        elapsed = round(time.time() - t0, 2)
        await _emit(cb, {"type": "agent_done", "agent": name, "elapsed_s": elapsed})
        return result
    except Exception as e:
        await _emit(cb, {"type": "agent_error", "agent": name, "error": str(e)})
        raise


_FENCE_RE = re.compile(r"^```[a-zA-Z]*\s*\n?|\n?```\s*$", re.MULTILINE)


def _coerce_obj(result, list_key: str = "items") -> dict:
    """Agents return JSON; tolerate stray markdown fences with any lang tag."""
    if isinstance(result, dict):
        return result
    if isinstance(result, list):
        return {list_key: result}
    text = str(result).strip()
    text = _FENCE_RE.sub("", text).strip()
    # Sometimes a bare lang word leaks before the JSON
    if text and not text.lstrip().startswith(("{", "[")):
        # Drop the first word/line if it isn't valid JSON start
        first_brace = min(
            (i for i in (text.find("{"), text.find("[")) if i != -1),
            default=-1,
        )
        if first_brace > 0:
            text = text[first_brace:]
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return {list_key: parsed}
        return parsed
    except json.JSONDecodeError:
        return {"raw": text}


def _write_artifact(run_id: str, name: str, data: dict) -> Path:
    p = artifacts_dir(run_id) / name
    p.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return p


async def run_pipeline(run_id: str, cb: EventCb | None = None) -> dict:
    workspace = str(repo_dir(run_id))
    await _emit(cb, {"type": "pipeline_start", "run_id": run_id, "workspace": workspace})

    # ---- Stage 1: Architecture ----
    arch_raw = await _call_agent("architecture", {
        "workspace": workspace, "stage": "architecture", "payload": {}
    }, cb)
    dep_graph = _coerce_obj(arch_raw)
    _write_artifact(run_id, "dep_graph.json", dep_graph)
    files = [f["path"] for f in dep_graph.get("files", [])]
    await _emit(cb, {"type": "stage_done", "stage": "architecture",
                     "file_count": len(files)})

    # ---- Stage 2: fan-out Module + API + Decisions ----
    # Pick the most-imported files as the focus set — small enough that the
    # LLM has time to actually document each one within its token budget.
    in_degree: dict[str, int] = {}
    for e in dep_graph.get("edges", []):
        in_degree[e.get("dst", "")] = in_degree.get(e.get("dst", ""), 0) + 1
    def _score(f: str) -> int:
        for k, v in in_degree.items():
            if k and (k in f or f.endswith(k.replace(".", "/") + ".py")):
                return v
        return 0
    sorted_files = sorted(files, key=_score, reverse=True)
    focus = sorted_files[:14]
    py_focus = [f for f in sorted_files if f.endswith(".py")][:10]

    mod_task = _call_agent("module", {
        "workspace": workspace, "stage": "module",
        "payload": {"files": focus}
    }, cb)
    api_task = _call_agent("api", {
        "workspace": workspace, "stage": "api",
        "payload": {"files": py_focus}
    }, cb)
    dec_task = _call_agent("decisions", {
        "workspace": workspace, "stage": "decisions",
        "payload": {"files": focus}
    }, cb)

    mod_raw, api_raw, dec_raw = await asyncio.gather(
        mod_task, api_task, dec_task, return_exceptions=True,
    )

    modules = _coerce_obj(mod_raw, "modules") if not isinstance(mod_raw, Exception) else {"modules": []}
    api = _coerce_obj(api_raw, "api") if not isinstance(api_raw, Exception) else {"api": []}
    decisions = _coerce_obj(dec_raw, "decisions") if not isinstance(dec_raw, Exception) else {"decisions": []}

    # Normalize: agents sometimes return arrays under wrong keys
    if "modules" not in modules and "items" in modules:
        modules = {"modules": modules["items"]}
    if "api" not in api and "items" in api:
        api = {"api": api["items"]}
    if "decisions" not in decisions and "items" in decisions:
        decisions = {"decisions": decisions["items"]}

    _write_artifact(run_id, "modules.json", modules)
    _write_artifact(run_id, "api.json", api)
    _write_artifact(run_id, "decisions.json", decisions)
    await _emit(cb, {"type": "stage_done", "stage": "fanout",
                     "modules": len(modules.get("modules", [])),
                     "api": len(api.get("api", [])),
                     "decisions": len(decisions.get("decisions", []))})

    # ---- Stage 3: Onboarding ----
    try:
        onb_raw = await _call_agent("onboarding", {
            "workspace": workspace, "stage": "onboarding",
            "payload": {
                "artifacts": ["dep_graph.json", "modules.json", "api.json", "decisions.json"]
            }
        }, cb)
        onboarding = _coerce_obj(onb_raw)
    except Exception as e:
        await _emit(cb, {"type": "agent_error", "agent": "onboarding", "error": str(e)})
        onboarding = {"onboarding_md": f"# Onboarding generation failed\n\n{e}\n"}
    md = onboarding.get("onboarding_md", "")
    (artifacts_dir(run_id) / "onboarding.md").write_text(md, encoding="utf-8")
    _write_artifact(run_id, "onboarding.json", onboarding)

    await _emit(cb, {"type": "pipeline_done", "run_id": run_id})
    return {
        "dep_graph": dep_graph,
        "modules": modules,
        "api": api,
        "decisions": decisions,
        "onboarding_md": md,
    }
