# hax

Documentation generator for legacy codebases. Five specialist agents — written
with **AG2** and speaking the IBM **NLIP** protocol — read a strange repository
and return with notes.

## Stack
- **Agents:** AG2 beta (`autogen.beta.Agent`) — five processes, one per role
- **Inter-agent transport:** IBM NLIP (`nlip_sdk`, `nlip_server`) — JSON over HTTP, ECMA-431
- **Orchestrator:** FastAPI (port 8088), 3-stage pipeline driver
- **Frontend:** Next.js 15 + React 19 + Tailwind v4 (port 3030), field-notebook aesthetic
- **LLM:** OpenRouter → `google/gemini-2.5-flash`

## Agents
| port | name | role |
|------|------|------|
| 9001 | architecture | infers high-level structure from imports + tree |
| 9002 | module       | per-file purpose + responsibilities |
| 9003 | api          | extracts public symbols + usage examples |
| 9004 | decisions    | reads git log to surface *why* |
| 9005 | onboarding   | synthesizes a new-dev guide from the four upstreams |

## Pipeline

```
clone → architecture → [module ‖ api ‖ decisions] → onboarding
```

Stage 1 is sequential, stage 2 fans out in parallel, stage 3 reads all four
artifacts. Every arrow between processes is an NLIP envelope.

## Run

```bash
# 1. python deps
python3 -m venv .venv && source .venv/bin/activate
pip install -e .

# 2. set OPENROUTER_API_KEY in .env
cp .env.example .env && $EDITOR .env

# 3. boot the 5 NLIP agents + orchestrator
./scripts/run_all.sh

# 4. boot the frontend
cd frontend && pnpm install && pnpm dev
# open http://localhost:3030
```

## Layout

```
agents/
  _base/
    nlip_agent.py    # AG2-beta-Agent inside an NLIP server (the load-bearing wrapper)
    tools.py         # @tool functions: walk_tree, parse_imports_*, git_log_*, etc.
  architecture/server.py
  module/server.py
  api/server.py
  decisions/server.py
  onboarding/server.py
orchestrator/
  pipeline.py        # 3-stage NLIP driver — only place that knows agent topology
  main.py            # FastAPI: POST /runs, WS /runs/{id}/events
  workspace.py       # git clone, run-id mgmt
shared/
  config.py          # ports, model, base URL
  envelopes.py       # NLIP request/response helpers, httpx send()
  schemas.py         # pydantic artifact models
frontend/            # Next.js single-page run view
scripts/
  run_all.sh         # boot the 5 agents + orchestrator
  stop_all.sh
```

## Why NLIP

Each agent is a separate OS process with its own port, system prompt, and
tool surface. The orchestrator never touches AG2's in-process group chat — it
sends NLIP envelopes between processes. That means:
- agents are independently restartable / rewritable
- the protocol is the same one any other NLIP-speaking agent (not just AG2)
  could plug into
- the demo can show three port numbers lighting up in parallel during the
  fan-out stage, which is the visual proof that this isn't one big
  monolithic LLM call

## Parallel development

Six git worktrees, one per track:

```bash
git worktree list
# /Users/meyhar/Documents/hax              main
# /Users/meyhar/Documents/hax-arch         feat/architecture-agent
# /Users/meyhar/Documents/hax-module       feat/module-agent
# /Users/meyhar/Documents/hax-api          feat/api-agent
# /Users/meyhar/Documents/hax-decisions    feat/decisions-agent
# /Users/meyhar/Documents/hax-onboarding   feat/onboarding-agent
# /Users/meyhar/Documents/hax-frontend     feat/frontend
```

Each track edits its own folder + may add to `_base`/`shared`.
