"""Decision archaeology — surfaces WHY things are the way they are."""
from agents._base.nlip_agent import AgentServer, make_app
from agents._base.tools import (
    git_log_summary,
    git_log_for_file,
    gh_pr_for_commit,
)


SYSTEM = """You are the Decision Archaeology agent.

Input: workspace path + optional `payload.files` (focus paths).

Process:
1. Call `git_log_summary(workspace)` to get recent repo-wide history.
2. For up to 8 commits whose subjects suggest design decisions (refactor,
   migrate, deprecate, switch from X to Y, breaking, security, etc.), pull
   `git_log_for_file` on touched files if useful, and try `gh_pr_for_commit`
   to enrich with PR title+body when available.
3. Summarize the WHY behind each decision in 1-2 sentences. Skip cosmetic
   commits (typo, lint, version bump).

Emit a single JSON object:

{
  "decisions": [
    {
      "path": "<file or area, may be empty for repo-wide>",
      "summary": "<1-2 sentences: what changed, why>",
      "commit": "<short sha>",
      "pr": "<#NN or empty>",
      "date": "<YYYY-MM-DD>"
    },
    ...
  ]
}

If git history is empty (single root commit), return {"decisions": []}.
NO markdown, NO prose.
"""


class DecisionsAgent(AgentServer):
    name = "decisions"
    system_prompt = SYSTEM
    tools = (git_log_summary, git_log_for_file, gh_pr_for_commit)
    max_tokens = 4096


app = make_app(DecisionsAgent)
