"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_ORDER,
  type AgentName,
  type ApiEntry,
  type DepGraph,
  type ModuleDoc,
  type RunEvent,
  fetchArtifact,
  openEvents,
  startRun,
} from "@/lib/api";
import { PortChips, type AgentStatus } from "@/components/PortChips";
import { Timeline } from "@/components/Timeline";
import { Markdown } from "@/components/Markdown";
import { ModuleDrawer } from "@/components/ModuleDrawer";

const DEFAULT_REPO = "https://github.com/pallets/flask";

function clock(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}

const initState = () =>
  Object.fromEntries(AGENT_ORDER.map((n) => [n, "idle"])) as Record<
    AgentName,
    AgentStatus
  >;

const initElapsed = () =>
  Object.fromEntries(AGENT_ORDER.map((n) => [n, 0])) as Record<
    AgentName,
    number
  >;

export default function Page() {
  const [source, setSource] = useState(DEFAULT_REPO);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ ev: RunEvent; ts: string }[]>([]);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);
  const [agentState, setAgentState] = useState<Record<AgentName, AgentStatus>>(
    initState(),
  );
  const [elapsed, setElapsed] = useState<Record<AgentName, number>>(
    initElapsed(),
  );
  const [graph, setGraph] = useState<DepGraph | null>(null);
  const [modules, setModules] = useState<ModuleDoc[]>([]);
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [decisions, setDecisions] = useState<unknown[]>([]);
  const [onboardingMd, setOnboardingMd] = useState("");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [now, setNow] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    setNow(clock());
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, []);

  // Track which artifacts were already fetched per run so React batching
  // (which can collapse multiple WS events into one effect run) can't make
  // us miss a stage_done.
  const fetched = useRef<{ runId: string | null; arch: boolean; fanout: boolean; onb: boolean }>(
    { runId: null, arch: false, fanout: false, onb: false },
  );

  useEffect(() => {
    if (!runId) return;
    if (fetched.current.runId !== runId) {
      fetched.current = { runId, arch: false, fanout: false, onb: false };
    }
    const seenStages = new Set<string>();
    let pipelineDone = false;
    for (const { ev } of events) {
      if (ev.type === "stage_done") seenStages.add(ev.stage);
      if (ev.type === "pipeline_done") pipelineDone = true;
    }
    if (seenStages.has("architecture") && !fetched.current.arch) {
      fetched.current.arch = true;
      fetchArtifact<DepGraph>(runId, "dep_graph.json")
        .then(setGraph)
        .catch(() => {});
    }
    if (seenStages.has("fanout") && !fetched.current.fanout) {
      fetched.current.fanout = true;
      fetchArtifact<{ modules: ModuleDoc[] }>(runId, "modules.json")
        .then((d) => setModules(d.modules ?? []))
        .catch(() => {});
      fetchArtifact<{ api: ApiEntry[] }>(runId, "api.json")
        .then((d) => setApis(d.api ?? []))
        .catch(() => {});
      fetchArtifact<{ decisions: unknown[] }>(runId, "decisions.json")
        .then((d) => setDecisions(d.decisions ?? []))
        .catch(() => {});
    }
    if (pipelineDone && !fetched.current.onb) {
      fetched.current.onb = true;
      fetchArtifact<string>(runId, "onboarding.md")
        .then(setOnboardingMd)
        .catch(() => {});
    }
  }, [events, runId]);

  const onRun = async () => {
    if (running) return;
    setRunning(true);
    setEvents([]);
    setGraph(null);
    setModules([]);
    setApis([]);
    setDecisions([]);
    setOnboardingMd("");
    setDone(false);
    setAgentState(initState());
    setElapsed(initElapsed());
    startedAt.current = Date.now();
    try {
      const id = await startRun(source);
      setRunId(id);
      wsRef.current?.close();
      wsRef.current = openEvents(
        id,
        (ev) => {
          setEvents((es) => [...es, { ev, ts: clock() }]);
          if (ev.type === "agent_start")
            setAgentState((s) => ({ ...s, [ev.agent]: "live" }));
          if (ev.type === "agent_done") {
            setAgentState((s) => ({ ...s, [ev.agent]: "done" }));
            setElapsed((e) => ({ ...e, [ev.agent]: ev.elapsed_s }));
          }
          if (ev.type === "agent_error")
            setAgentState((s) => ({ ...s, [ev.agent]: "error" }));
          if (ev.type === "pipeline_done" || ev.type === "fatal") {
            setDone(true);
            setRunning(false);
          }
        },
        () => setRunning(false),
      );
    } catch (e) {
      setEvents((es) => [
        ...es,
        { ev: { type: "fatal", error: String(e) }, ts: clock() },
      ]);
      setRunning(false);
    }
  };

  const moduleByPath = useMemo(
    () => new Map(modules.map((m) => [m.path, m] as const)),
    [modules],
  );
  const apiByPath = useMemo(() => {
    const m = new Map<string, ApiEntry[]>();
    for (const a of apis) {
      if (!m.has(a.path)) m.set(a.path, []);
      m.get(a.path)!.push(a);
    }
    return m;
  }, [apis]);

  const filesSorted = useMemo(() => {
    const files = graph?.files;
    if (!Array.isArray(files)) return [];
    return [...files].sort((a, b) => a.path.localeCompare(b.path));
  }, [graph]);

  const elapsedTotal =
    startedAt.current && (running || done)
      ? ((Date.now() - startedAt.current) / 1000).toFixed(1)
      : "—";

  const phase = !runId
    ? "ready"
    : running
      ? "running"
      : done
        ? "complete"
        : "idle";

  const phaseColor =
    phase === "running"
      ? "text-[var(--color-accent)]"
      : phase === "complete"
        ? "text-[var(--color-done)]"
        : "text-[var(--color-fg-muted)]";

  return (
    <div className="grid grid-cols-[260px_1fr] min-h-screen">
      {/* ======================= SIDEBAR ======================= */}
      <aside className="hairline-r bg-[var(--color-surface-1)] flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="px-5 py-5 hairline-b flex items-center gap-2.5">
          <div className="relative w-7 h-7 hairline bg-[var(--color-surface-2)] flex items-center justify-center">
            <span className="font-mono text-[12px] font-bold text-[var(--color-accent)]">
              ▲
            </span>
            <span className="absolute -top-px -right-px w-1.5 h-1.5 bg-[var(--color-accent)]" />
          </div>
          <div>
            <div className="font-mono text-[14px] font-bold tracking-tight">
              codescan
            </div>
            <div className="text-[10px] text-[var(--color-fg-muted)] tracking-widest uppercase font-mono mt-0.5">
              v0.1 · scanner
            </div>
          </div>
        </div>

        {/* Agents rail label */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <span className="eyebrow">agents</span>
          <span className="numeric text-[10px] text-[var(--color-fg-faint)]">
            5 nodes
          </span>
        </div>

        <PortChips states={agentState} elapsed={elapsed} />

        {/* Run meta */}
        <div className="mt-auto p-5 hairline-t space-y-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow">run</span>
            <span className="font-mono text-[11px] text-[var(--color-fg-soft)]">
              {runId ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="eyebrow">phase</span>
            <span className={`font-mono text-[11px] ${phaseColor}`}>
              {phase}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="eyebrow">elapsed</span>
            <span className="numeric text-[11px] text-[var(--color-fg-soft)]">
              {elapsedTotal}{elapsedTotal !== "—" ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="eyebrow">clock</span>
            <span className="numeric text-[11px] text-[var(--color-fg-soft)]">
              {now}
            </span>
          </div>
          <div className="pt-3 hairline-t">
            <div className="text-[10px] font-mono text-[var(--color-fg-faint)] leading-relaxed">
              <div>
                NLIP · ECMA-431 · localhost
              </div>
              <div className="mt-1">
                AG2 beta · gemini-2.5-flash
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ======================= MAIN ======================= */}
      <main className="flex flex-col min-w-0">
        {/* Top bar — input */}
        <header className="hairline-b bg-[var(--color-surface-1)] px-8 py-4 flex items-center gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-2 shrink-0">
            <span className="eyebrow">target</span>
          </div>
          <div className="flex-1 flex items-center hairline bg-[var(--color-bg)] px-3 py-2 focus-within:border-[var(--color-accent)] transition-colors">
            <span className="font-mono text-[12px] text-[var(--color-fg-faint)] mr-2 shrink-0">
              git ::
            </span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 font-mono text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)] min-w-0"
            />
          </div>
          <button
            onClick={onRun}
            disabled={running}
            className="group shrink-0 font-mono text-[11px] uppercase tracking-[0.2em] font-semibold text-[var(--color-bg)] bg-[var(--color-accent)] px-5 py-2.5 hover:bg-[var(--color-accent-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {running ? (
              <>
                <span className="dot live" /> running
              </>
            ) : (
              <>
                execute
                <span className="group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </>
            )}
          </button>
        </header>

        {/* Summary strip */}
        <section className="px-8 pt-6 pb-4">
          <div className="hairline bg-[var(--color-surface-1)] p-5 grid grid-cols-[1fr_auto] gap-6 items-start">
            <div>
              <div className="eyebrow mb-2">analysis summary</div>
              <p className="text-[15px] text-[var(--color-fg)] leading-snug max-w-3xl">
                {graph?.summary ||
                  (running
                    ? "agents are working — summary will appear after the architecture pass."
                    : "press execute to begin a documentation run.")}
              </p>
              {graph && Array.isArray(graph.layers) && graph.layers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {graph.layers.map((l, i) => (
                    <span
                      key={i}
                      className="font-mono text-[10.5px] px-2 py-1 hairline-strong bg-[var(--color-surface-2)] text-[var(--color-fg-soft)]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-5 gap-px bg-[var(--color-border)] hairline">
              <Stat
                label="files"
                value={graph?.files?.length ?? 0}
                pending={running && !graph}
              />
              <Stat
                label="modules"
                value={modules.length}
                pending={running && !!graph && modules.length === 0}
              />
              <Stat
                label="api"
                value={apis.length}
                pending={running && !!graph && apis.length === 0}
              />
              <Stat
                label="decisions"
                value={decisions.length}
                pending={running && !!graph && decisions.length === 0}
              />
              <Stat label="events" value={events.length} accent />
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="px-8 pb-6 min-h-[420px]">
          <div className="h-[420px]">
            <Timeline events={events} running={running} />
          </div>
        </section>


        {/* Onboarding */}
        <section className="px-8 pb-12">
          <div className="hairline bg-[var(--color-surface-1)]">
            <div className="hairline-b px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="eyebrow">onboarding · field guide</span>
                <span className="font-mono text-[10.5px] text-[var(--color-fg-faint)]">
                  produced by :9005
                </span>
              </div>
              {onboardingMd && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(onboardingMd);
                  }}
                  className="font-mono text-[10.5px] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] uppercase tracking-wider hairline px-2 py-1"
                >
                  copy md
                </button>
              )}
            </div>
            <div className="px-8 py-8">
              <Markdown
                source={onboardingMd}
                knownPaths={filesSorted.map((f) => f.path)}
                onPathClick={setOpenPath}
              />
            </div>
          </div>
        </section>

        <footer className="px-8 pb-6 flex items-center justify-between text-[10px] font-mono text-[var(--color-fg-faint)]">
          <span>codescan · v0.1</span>
          <span>NLIP/ECMA-430 · agents over loopback</span>
          <span>built with AG2 · gemini-2.5-flash</span>
        </footer>
      </main>

      <ModuleDrawer
        path={openPath}
        module={openPath ? (moduleByPath.get(openPath) ?? null) : null}
        apis={openPath ? (apiByPath.get(openPath) ?? []) : []}
        onClose={() => setOpenPath(null)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
  pending,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  hint?: string;
  pending?: boolean;
}) {
  const tone = pending
    ? "text-[var(--color-accent)]"
    : accent
      ? "text-[var(--color-accent)]"
      : "text-[var(--color-fg)]";
  return (
    <div className="bg-[var(--color-surface-1)] px-4 py-3 min-w-[110px]">
      <div className="eyebrow mb-1 flex items-center gap-1.5">
        {label}
        {pending && <span className="dot live" />}
      </div>
      <div
        className={`numeric text-[20px] font-bold tabular-nums ${tone} ${
          pending ? "animate-pulse" : ""
        }`}
      >
        {pending ? "···" : value}
      </div>
      {hint && (
        <div className="text-[9.5px] text-[var(--color-fg-faint)] uppercase tracking-wider mt-0.5">
          {hint}
        </div>
      )}
    </div>
  );
}
