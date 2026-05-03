#!/usr/bin/env bash
# Boot all 5 NLIP agent servers + orchestrator. Frontend started separately.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source .venv/bin/activate
mkdir -p .logs
echo "" > .logs/all.log

start() {
  local name=$1 port=$2
  local mod="agents.${name}.server:app"
  echo ">> ${name} :${port}"
  uvicorn "$mod" --host 127.0.0.1 --port "$port" \
      --log-level warning > ".logs/${name}.log" 2>&1 &
  echo $! > ".logs/${name}.pid"
}

start architecture 9001
start module       9002
start api          9003
start decisions    9004
start onboarding   9005

echo ">> orchestrator :8088"
uvicorn orchestrator.main:app --host 127.0.0.1 --port 8088 \
    --log-level warning > .logs/orchestrator.log 2>&1 &
echo $! > .logs/orchestrator.pid

sleep 2
echo ""
echo "Healthchecks:"
for port in 9001 9002 9003 9004 9005 8088; do
  printf "  :%s  " "$port"
  curl -fsS "http://127.0.0.1:${port}/health" 2>/dev/null \
    || curl -fsS "http://127.0.0.1:${port}/health/ready" 2>/dev/null \
    || echo "DOWN"
  echo ""
done

echo ""
echo "Stop with: scripts/stop_all.sh"
echo "Logs in: .logs/"
