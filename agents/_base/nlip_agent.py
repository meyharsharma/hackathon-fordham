"""AG2-beta-Agent-inside-NLIP-server wrapper.

Each specialist agent server subclasses `AgentServer`, supplies a system
prompt and a list of @tool-decorated functions, and runs as a standalone
NLIP HTTP server. The orchestrator talks to them over NLIP only — there
is no in-process AG2 GroupChat.
"""
from __future__ import annotations

import json
from typing import Callable, Iterable

from autogen.beta import Agent
from autogen.beta.config import OpenAIConfig
from nlip_sdk.nlip import NLIP_Message
from nlip_server.server import (
    SafeApplication,
    NLIP_Session,
    setup_server,
)

from shared.config import LLM_MODEL, LLM_BASE_URL, OPENROUTER_API_KEY
from shared.envelopes import reply_text


def make_llm_config(max_tokens: int = 2048) -> OpenAIConfig:
    return OpenAIConfig(
        model=LLM_MODEL,
        streaming=False,
        api_key=OPENROUTER_API_KEY,
        base_url=LLM_BASE_URL,
        max_completion_tokens=max_tokens,
        temperature=0.0,
        seed=42,
    )


class AgentServer(SafeApplication):
    """NLIP application that wraps a single AG2 beta Agent."""

    name: str = "agent"
    system_prompt: str = "You are a helpful assistant."
    tools: Iterable[Callable] = ()
    max_tokens: int = 2048

    def create_session(self) -> NLIP_Session:
        agent = Agent(
            name=self.name,
            prompt=self.system_prompt,
            config=make_llm_config(self.max_tokens),
            tools=tuple(self.tools),
        )
        return _AgentSession(agent)


class _AgentSession(NLIP_Session):
    def __init__(self, agent: Agent):
        self.agent = agent

    async def execute(self, msg: NLIP_Message) -> NLIP_Message:
        raw = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
        try:
            spec = json.loads(raw)
            task = self._format_task(spec)
        except (json.JSONDecodeError, TypeError):
            task = raw

        reply = await self.agent.ask(task)
        return reply_text(reply.body or "")

    @staticmethod
    def _format_task(spec: dict) -> str:
        """Render the JSON task spec into the natural-language prompt the
        agent sees. Keep it explicit — the agent should only read the repo
        via its tools, never hallucinate paths."""
        workspace = spec.get("workspace", "")
        stage = spec.get("stage", "")
        payload = spec.get("payload", {})
        return (
            f"Stage: {stage}\n"
            f"Workspace root: {workspace}\n"
            f"Inputs: {json.dumps(payload, indent=2)}\n\n"
            "Use your tools to read the workspace. Respond ONLY with the "
            "JSON artifact described in your system prompt — no prose, no "
            "markdown fences."
        )


def make_app(server_cls: type[AgentServer]):
    """Build the FastAPI app for an agent server. uvicorn entrypoint."""
    return setup_server(server_cls())
