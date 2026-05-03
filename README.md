<div align="center">

# codescan

**Documentation generator for legacy codebases.**
Five specialist AI agents — written with [AG2](https://github.com/ag2ai/ag2) and
speaking the IBM [NLIP](https://github.com/nlip-project) protocol — read a
strange repository and return a complete onboarding guide.

[![ci](https://github.com/meyharsharma/hackathon-fordham/actions/workflows/ci.yml/badge.svg)](https://github.com/meyharsharma/hackathon-fordham/actions/workflows/ci.yml)
![python](https://img.shields.io/badge/python-3.12+-ededf2?labelColor=0a0a0d)
![next](https://img.shields.io/badge/next.js-15-ededf2?labelColor=0a0a0d)
![nlip](https://img.shields.io/badge/protocol-NLIP%20%C2%B7%20ECMA--430-ff7a3d?labelColor=0a0a0d)
![ag2](https://img.shields.io/badge/agents-AG2%20beta-ff7a3d?labelColor=0a0a0d)

</div>

---

## Overview

Point `codescan` at any git repository and it produces:

- A **dependency graph** of the source tree
- A **per-module summary** (purpose, responsibilities, neighbors)
- A **public API reference** with usage examples
- **Decision archaeology** — *why* the code looks the way it does, mined from
  git history and PR commentary
- A synthesized **onboarding field guide** for a new developer

Each artifact is produced by an independent agent that runs in its own OS
process, exposes its own port, and is reachable only over NLIP. The
orchestrator never imports an agent — it sends envelopes.

## Architecture

```
                          ┌────────────────┐
                          │    Browser     │   Next.js · operator console
                          └────────┬───────┘
                                   │  WebSocket  (events)
                                   ▼
                          ┌────────────────┐
                          │  Orchestrator  │   FastAPI  :8088
                          │   (pipeline)   │   clones repo, drives stages
                          └────────┬───────┘
                                   │  NLIP / JSON over HTTP  (ECMA-431)
        ┌───────────┬──────────────┼──────────────┬──────────────┐
        ▼           ▼              ▼              ▼              ▼
     :9001       :9002          :9003          :9004          :9005
   architecture   module          api          decisions     onboarding

        └───────────┴──────────────┴──────────────┴──────────────┘
                                   │
                                   ▼
                       workspaces/<run-id>/
                          repo/                 cloned source
                          artifacts/            dep_graph.json,
                                                modules.json,
                                                api.json,
                                                decisions.json,
                                                onboarding.md
```

The pipeline runs in three stages:

| stage | mode       | agents                                    |
|-------|------------|-------------------------------------------|
| 1     | sequential | `architecture`                            |
| 2     | fan-out    | `module` ‖ `api` ‖ `decisions` (parallel) |
| 3     | sequential | `onboarding`                              |

## Stack

| layer            | choice                                                  |
|------------------|---------------------------------------------------------|
| Agent runtime    | AG2 beta (`autogen.beta.Agent`)                         |
| Inter-agent wire | IBM NLIP — ECMA-430/431, JSON over HTTP                 |
| Orchestrator     | FastAPI · WebSocket events · pydantic schemas           |
| Frontend         | Next.js 15 · React 19 · Tailwind v4 · TypeScript        |
| LLM              | OpenRouter → `google/gemini-2.5-flash`                  |
| Repo intake      | GitPython · shallow clone into per-run workspace        |

## Quick start

```bash
# 1. python deps
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# 2. credentials
cp .env.example .env
# edit OPENROUTER_API_KEY in .env

# 3. boot the 5 NLIP agents + orchestrator
./scripts/run_all.sh

# 4. boot the frontend
cd frontend && pnpm install && pnpm dev

# 5. open the operator console in your browser
```

Paste any public git URL into the target field and press **execute**.

## Project layout

```
hax/
├── agents/
│   ├── _base/
│   │   ├── nlip_agent.py        # AG2 Agent inside an NLIP server (load-bearing)
│   │   └── tools.py             # @tool functions: walk_tree, parse_imports_*, git_log_*
│   ├── architecture/server.py
│   ├── module/server.py
│   ├── api/server.py
│   ├── decisions/server.py
│   └── onboarding/server.py
├── orchestrator/
│   ├── pipeline.py              # 3-stage NLIP driver (only place that knows topology)
│   ├── main.py                  # FastAPI · POST /runs · WS /runs/{id}/events
│   └── workspace.py             # per-run repo clone + artifact dirs
├── shared/
│   ├── envelopes.py             # NLIP request/response helpers + httpx client
│   ├── schemas.py               # pydantic artifact models
│   └── config.py                # ports · model · base url
├── frontend/                    # Next.js operator console (single page)
├── scripts/
│   ├── run_all.sh               # boot all 5 agents + orchestrator
│   └── stop_all.sh
├── tests/fixtures/tiny-repo/    # offline-safe demo target
└── workspaces/                  # gitignored · per-run output
```

## How the NLIP wrapper works

Each agent is a separate process. Inside that process, an AG2 `Agent` runs
its own short LLM-mediated chat to fulfill exactly one NLIP request and
returns. There is no cross-process AG2 message bus — the orchestrator owns
all inter-agent traffic and speaks NLIP directly via `httpx`.

```python
# agents/_base/nlip_agent.py — abridged
class AgentServer(SafeApplication):
    name: str
    system_prompt: str
    tools: Iterable[Callable] = ()

    def create_session(self) -> NLIP_Session:
        agent = Agent(name=self.name, prompt=self.system_prompt,
                      config=make_llm_config(), tools=tuple(self.tools))
        return _AgentSession(agent)


class _AgentSession(NLIP_Session):
    async def execute(self, msg: NLIP_Message) -> NLIP_Message:
        spec = json.loads(msg.content)
        reply = await self.agent.ask(format_task(spec))
        return reply_text(reply.body or "")
```

This inversion — NLIP outside, AG2 inside — keeps each agent independently
restartable and lets any non-AG2 NLIP-speaking agent plug into the same
pipeline without changes.

## Performance

Measured end-to-end on Apple Silicon with OpenRouter Gemini 2.5-flash:

| target          | files | wall time |
|-----------------|------:|----------:|
| tiny fixture    |     5 |      ~16s |
| `psf/requests`  |    36 |      ~50s |
| `pallets/flask` |   ~85 |    50–90s |

The fan-out stage is parallel, so total time is roughly the longest of
`architecture` + `max(module, api, decisions)` + `onboarding`.

## Continuous integration

Every push to `main` runs the [`ci`](.github/workflows/ci.yml) workflow:

- **backend** — installs the package, smoke-imports every module, boots the
  orchestrator and hits `/health`
- **frontend** — installs with frozen lockfile and runs `pnpm build`

## License

MIT.
