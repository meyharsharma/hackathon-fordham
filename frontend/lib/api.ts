export const BACKEND = "http://127.0.0.1:8088";
export const WS_BACKEND = "ws://127.0.0.1:8088";

export type AgentName =
  | "architecture"
  | "module"
  | "api"
  | "decisions"
  | "onboarding";

export const AGENT_PORTS: Record<AgentName, number> = {
  architecture: 9001,
  module: 9002,
  api: 9003,
  decisions: 9004,
  onboarding: 9005,
};

export const AGENT_ORDER: AgentName[] = [
  "architecture",
  "module",
  "api",
  "decisions",
  "onboarding",
];

export type RunEvent =
  | { type: "clone_start"; source: string }
  | { type: "clone_done" }
  | { type: "pipeline_start"; run_id: string; workspace: string }
  | { type: "agent_start"; agent: AgentName; url: string }
  | { type: "agent_done"; agent: AgentName; elapsed_s: number }
  | { type: "agent_error"; agent: AgentName; error: string }
  | { type: "stage_done"; stage: string; [k: string]: unknown }
  | { type: "pipeline_done"; run_id: string }
  | { type: "fatal"; error: string };

export interface DepGraph {
  root: string;
  files: { path: string; language: string; loc: number }[];
  edges: { src: string; dst: string; kind: string }[];
  summary: string;
  layers: string[];
}

export interface ModuleDoc {
  path: string;
  purpose: string;
  responsibilities: string[];
  neighbors: string[];
}
export interface ApiEntry {
  path: string;
  symbol: string;
  kind: string;
  signature: string;
  docstring: string;
  example: string;
}

export async function startRun(source: string): Promise<string> {
  const r = await fetch(`${BACKEND}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  });
  if (!r.ok) throw new Error(`start run failed: ${r.status}`);
  const { run_id } = await r.json();
  return run_id;
}

export async function fetchArtifact<T = unknown>(
  runId: string,
  name: string,
): Promise<T> {
  const r = await fetch(`${BACKEND}/runs/${runId}/artifacts/${name}`);
  if (!r.ok) throw new Error(`artifact ${name} ${r.status}`);
  if (name.endsWith(".json")) return r.json();
  return (await r.text()) as unknown as T;
}

export function openEvents(
  runId: string,
  onEvent: (e: RunEvent) => void,
  onClose?: () => void,
): WebSocket {
  const ws = new WebSocket(`${WS_BACKEND}/runs/${runId}/events`);
  ws.onmessage = (m) => {
    try {
      onEvent(JSON.parse(m.data) as RunEvent);
    } catch {
      /* ignore */
    }
  };
  ws.onclose = () => onClose?.();
  return ws;
}
