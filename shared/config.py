import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

LLM_MODEL = os.environ.get("LLM_MODEL", "google/gemini-2.5-flash")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACES = REPO_ROOT / "workspaces"
WORKSPACES.mkdir(exist_ok=True)

AGENT_PORTS = {
    "architecture": 9001,
    "module": 9002,
    "api": 9003,
    "decisions": 9004,
    "onboarding": 9005,
}
ORCHESTRATOR_PORT = 8088
FRONTEND_PORT = 3000


def agent_url(name: str) -> str:
    return f"http://127.0.0.1:{AGENT_PORTS[name]}/nlip/"
