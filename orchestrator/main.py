"""FastAPI orchestrator: POST /runs to start, WS /runs/{id}/events to watch."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from orchestrator.pipeline import run_pipeline
from orchestrator.workspace import (
    new_run_id,
    clone_repo,
    workspace_dir,
    artifacts_dir,
)

app = FastAPI(title="hax orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunIn(BaseModel):
    source: str  # git URL or local path


# run_id -> list of events (so a late-connecting WS can replay)
_RUN_EVENTS: dict[str, list[dict]] = {}
# run_id -> asyncio.Event signaling completion
_RUN_DONE: dict[str, asyncio.Event] = {}
# run_id -> set of WS push queues
_RUN_QUEUES: dict[str, set[asyncio.Queue]] = {}


async def _broadcast(run_id: str, event: dict) -> None:
    _RUN_EVENTS.setdefault(run_id, []).append(event)
    for q in list(_RUN_QUEUES.get(run_id, set())):
        await q.put(event)


@app.post("/runs")
async def create_run(body: RunIn) -> dict[str, Any]:
    run_id = new_run_id()
    _RUN_EVENTS[run_id] = []
    _RUN_DONE[run_id] = asyncio.Event()
    _RUN_QUEUES[run_id] = set()

    async def _go():
        try:
            await _broadcast(run_id, {"type": "clone_start", "source": body.source})
            clone_repo(run_id, body.source)
            await _broadcast(run_id, {"type": "clone_done"})

            async def cb(ev: dict) -> None:
                await _broadcast(run_id, ev)

            await run_pipeline(run_id, cb)
        except Exception as e:
            await _broadcast(run_id, {"type": "fatal", "error": str(e)})
        finally:
            _RUN_DONE[run_id].set()

    asyncio.create_task(_go())
    return {"run_id": run_id}


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> dict[str, Any]:
    if run_id not in _RUN_EVENTS:
        raise HTTPException(404, "unknown run")
    return {
        "run_id": run_id,
        "events": _RUN_EVENTS[run_id],
        "done": _RUN_DONE[run_id].is_set(),
    }


@app.get("/runs/{run_id}/artifacts/{name}")
async def get_artifact(run_id: str, name: str):
    p = artifacts_dir(run_id) / name
    if not p.exists():
        raise HTTPException(404, f"no such artifact {name}")
    if name.endswith(".json"):
        return JSONResponse(json.loads(p.read_text()))
    return FileResponse(p)


@app.websocket("/runs/{run_id}/events")
async def stream_events(ws: WebSocket, run_id: str):
    await ws.accept()
    if run_id not in _RUN_EVENTS:
        await ws.close(code=4404, reason="unknown run")
        return
    q: asyncio.Queue = asyncio.Queue()
    _RUN_QUEUES[run_id].add(q)
    try:
        for ev in _RUN_EVENTS[run_id]:
            await ws.send_json(ev)
        while not _RUN_DONE[run_id].is_set() or not q.empty():
            try:
                ev = await asyncio.wait_for(q.get(), timeout=1.0)
                await ws.send_json(ev)
            except asyncio.TimeoutError:
                continue
        await ws.close()
    except WebSocketDisconnect:
        pass
    finally:
        _RUN_QUEUES[run_id].discard(q)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
