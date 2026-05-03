#!/usr/bin/env bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for f in .logs/*.pid; do
  [ -f "$f" ] || continue
  pid=$(cat "$f")
  kill "$pid" 2>/dev/null && echo "killed $(basename "$f" .pid) ($pid)" || true
  rm -f "$f"
done
