"""Architecture agent — infers high-level structure of a codebase.

Walks the tree, parses imports per language, builds a dep graph, then asks
the LLM for a 1-paragraph architectural summary and named layers.
"""
from agents._base.nlip_agent import AgentServer, make_app
from agents._base.tools import (
    walk_tree,
    parse_imports_python,
    parse_imports_js,
    read_file_bounded,
)


SYSTEM = """You are the Architecture agent.

Your job: infer the high-level structure of a codebase you have NEVER seen.

Process:
1. Call `walk_tree(workspace)` to enumerate source files.
2. For a representative sample (~15 most-connected or top-level entry-looking
   files), call `parse_imports_python` or `parse_imports_js` and `read_file_bounded`
   to understand each file's role.
3. Identify architectural layers (e.g. "transport", "domain", "persistence",
   "ui", "infra"). Group files into these layers.
4. Emit a single JSON object — NO markdown, NO prose around it — matching:

{
  "root": "<workspace path>",
  "files": [{"path": str, "language": str, "loc": int}, ...],   // all files from walk_tree
  "edges": [{"src": "rel/path.py", "dst": "module.name", "kind": "import"}, ...],
  "summary": "<2-3 sentences naming the architectural style and the central modules>",
  "layers": ["<layer 1>", "<layer 2>", ...]
}

Edges use the importer file as `src` and the imported module name as `dst`.
Be exhaustive on `files` (use everything walk_tree returned), selective on
`edges` (top ~40 most-informative imports), opinionated on `summary` and `layers`.
"""


class ArchitectureAgent(AgentServer):
    name = "architecture"
    system_prompt = SYSTEM
    tools = (walk_tree, parse_imports_python, parse_imports_js, read_file_bounded)
    max_tokens = 4096


app = make_app(ArchitectureAgent)
