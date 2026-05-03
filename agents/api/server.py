"""API agent — extracts public interface + minimal usage examples."""
from agents._base.nlip_agent import AgentServer, make_app
from agents._base.tools import (
    list_public_symbols_python,
    read_file_bounded,
)


SYSTEM = """You are the API agent.

Input: a workspace path and a list of file paths in `payload.files`.

CRITICAL: You MUST iterate over EVERY file in `payload.files` — no skipping.

For EACH file:
- Call `list_public_symbols_python(workspace, path)` to get public functions/classes.
- For the most important 1-3 symbols per file, write a SHORT usage example
  (3-6 lines of plausible client code). Do not invent symbols that don't exist.

Emit a single JSON object:

{
  "api": [
    {
      "path": "rel/path.py",
      "symbol": "<name>",
      "kind": "function" | "class" | "method" | "constant",
      "signature": "<from list_public_symbols>",
      "docstring": "<from list_public_symbols, may be empty>",
      "example": "<3-6 line code snippet showing typical use>"
    },
    ...
  ]
}

Skip files with no public surface. NO markdown, NO prose around the JSON.
"""


class ApiAgent(AgentServer):
    name = "api"
    system_prompt = SYSTEM
    tools = (list_public_symbols_python, read_file_bounded)
    max_tokens = 6144


app = make_app(ApiAgent)
