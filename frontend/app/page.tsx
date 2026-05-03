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
import { DepGraphCanvas } from "@/components/DepGraph";
import { Markdown } from "@/components/Markdown";
import { ModuleDrawer } from "@/components/ModuleDrawer";

const DEFAULT_REPO = "https://github.com/pallets/flask";

function clock(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}

export default function Page() {
  const [source, setSource] = useState(DEFAULT_REPO);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ ev: RunEvent; ts: string }[]>([]);
  const [done, setDone] = useState(false);
  const [agentState, setAgentState] = useState<Record<AgentName, AgentStatus>>(
    Object.fromEntries(AGENT_ORDER.map((n) => [n, "idle"])) as Record<
      AgentName,
      AgentStatus
    >,
  );
  const [graph, setGraph] = useState<DepGraph | null>(null);
  const [modules, setModules] = useState<ModuleDoc[]>([]);
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [onboardingMd, setOnboardingMd] = useState("");
  const [openPath, setOpenPath] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [now, setNow] = useState<string>(clock());
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch artifacts as stages complete
  useEffect(() => {
    if (!runId) return;
    const last = events[events.length - 1]?.ev;
    if (!last) return;
    if (last.type === "stage_done" && last.stage === "architecture") {
      fetchArtifact<DepGraph>(runId, "dep_graph.json").then(setGraph).catch(() => {});
    }
    if (last.type === "stage_done" && last.stage === "fanout") {
      fetchArtifact<{ modules: ModuleDoc[] }>(runId, "modules.json")
        .then((d) => setModules(d.modules ?? []))
        .catch(() => {});
      fetchArtifact<{ api: ApiEntry[] }>(runId, "api.json")
        .then((d) => setApis(d.api ?? []))
        .catch(() => {});
    }
    if (last.type === "pipeline_done") {
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
    setOnboardingMd("");
    setDone(false);
    setAgentState(
      Object.fromEntries(AGENT_ORDER.map((n) => [n, "idle"])) as Record<
        AgentName,
        AgentStatus
      >,
    );
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
          if (ev.type === "agent_done")
            setAgentState((s) => ({ ...s, [ev.agent]: "done" }));
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
    if (!graph) return [];
    return [...graph.files].sort((a, b) => a.path.localeCompare(b.path));
  }, [graph]);

  const status = !runId
    ? "AT REST"
    : done
      ? "FILED"
      : running
        ? "IN SESSION"
        : "PAUSED";

  return (
    <main className="min-h-screen px-10 py-12 max-w-[1400px] mx-auto relative">
      {/* MASTHEAD */}
      <header className="mb-10 grid grid-cols-[1fr_auto] gap-8 items-end pb-5 border-b-[2px] border-[var(--color-ink)]">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.32em] text-[var(--color-ink-faint)] mb-1">
            Vol. I  ·  No. 001  ·  documentation generator for legacy codebases
          </p>
          <h1 className="font-serif italic text-[78px] leading-[0.95] tracking-tight text-[var(--color-ink)]">
            hax<span className="text-[var(--color-rust)]">.</span>
            <span className="not-italic font-light text-[28px] align-top ml-3 text-[var(--color-ink-soft)]">
              field notes
            </span>
          </h1>
          <p className="font-serif italic text-[15px] mt-3 text-[var(--color-ink-soft)] max-w-[58ch]">
            Five specialist agents — written with{" "}
            <span className="not-italic font-mono text-[12px]">AG2</span>,
            speaking the IBM{" "}
            <span className="not-italic font-mono text-[12px]">NLIP</span>{" "}
            protocol — read a strange repository and return with notes.
          </p>
        </div>
        <div className="text-right font-mono text-[11px] text-[var(--color-ink-soft)] space-y-1">
          <div className="leaders w-44">
            <span className="label">date</span>
            <span className="dots" />
            <span className="value">
              {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
          <div className="leaders w-44">
            <span className="label">clock</span>
            <span className="dots" />
            <span className="value">{now}</span>
          </div>
          <div className="leaders w-44">
            <span className="label">run</span>
            <span className="dots" />
            <span className="value">{runId ?? "—"}</span>
          </div>
          <div className="pt-1">
            <span className={`stamp ${running ? "live" : runId ? "fresh" : ""}`}>
              {status}
            </span>
          </div>
        </div>
      </header>

      {/* INPUT BAR */}
      <section className="mb-10 grid grid-cols-[auto_1fr_auto] items-baseline gap-5 border-b border-[var(--color-rule)] pb-5">
        <label className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
          subject of inquiry
        </label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="font-mono text-[14px] text-[var(--color-stamp)] border-b border-[var(--color-ink)] py-1 px-1 bg-transparent placeholder:text-[var(--color-ink-faint)]"
        />
        <button
          onClick={onRun}
          disabled={running}
          className="group font-sans text-[11px] uppercase tracking-[0.28em] text-[var(--color-paper)] bg-[var(--color-ink)] px-6 py-2.5 border border-[var(--color-ink)] hover:bg-[var(--color-rust)] hover:border-[var(--color-rust)] disabled:opacity-40 transition-colors"
        >
          {running ? "in progress" : "begin study"}
          <span className="inline-block ml-3 group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </button>
      </section>

      {/* MAIN GRID */}
      <div className="grid grid-cols-[200px_1fr_240px] gap-10">
        {/* LEFT: marginalia — port chips + counts */}
        <aside className="space-y-8 sticky top-8 self-start">
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)] mb-3">
              correspondents
            </p>
            <PortChips states={agentState} />
          </div>
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)] mb-3">
              tally
            </p>
            <ul className="font-mono text-[11px] space-y-1.5">
              <li className="leaders">
                <span className="label">files</span>
                <span className="dots" />
                <span className="value">{graph?.files.length ?? 0}</span>
              </li>
              <li className="leaders">
                <span className="label">edges</span>
                <span className="dots" />
                <span className="value">{graph?.edges.length ?? 0}</span>
              </li>
              <li className="leaders">
                <span className="label">modules</span>
                <span className="dots" />
                <span className="value">{modules.length}</span>
              </li>
              <li className="leaders">
                <span className="label">apis</span>
                <span className="dots" />
                <span className="value">{apis.length}</span>
              </li>
              <li className="leaders">
                <span className="label">envelopes</span>
                <span className="dots" />
                <span className="value">{events.length}</span>
              </li>
            </ul>
          </div>
          {graph && graph.layers.length > 0 && (
            <div>
              <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)] mb-3">
                strata
              </p>
              <ul className="font-serif italic text-[13px] space-y-1 leading-snug">
                {graph.layers.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* CENTER: graph + onboarding essay */}
        <section className="space-y-12 min-w-0">
          <div>
            <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-1">
              plate I — dependency etching
            </h2>
            <p className="font-serif italic text-[13px] text-[var(--color-ink-soft)] mb-3">
              {graph?.summary ||
                "the architecture agent reports here once its survey is complete."}
            </p>
            <DepGraphCanvas graph={graph} />
          </div>

          <div>
            <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-3">
              the field guide
            </h2>
            <Markdown source={onboardingMd} />
          </div>

          <div>
            <h2 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-3">
              record of dispatches
            </h2>
            <Timeline events={events} />
          </div>
        </section>

        {/* RIGHT: contents — file list */}
        <aside className="sticky top-8 self-start">
          <p className="font-sans text-[9px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)] mb-3">
            table of contents
          </p>
          {filesSorted.length === 0 ? (
            <p className="font-mono text-[11px] italic text-[var(--color-ink-faint)]">
              no entries indexed
            </p>
          ) : (
            <ol className="space-y-1 max-h-[78vh] overflow-y-auto pr-2">
              {filesSorted.map((f, i) => {
                const has = moduleByPath.has(f.path);
                return (
                  <li key={f.path}>
                    <button
                      onClick={() => setOpenPath(f.path)}
                      className="w-full text-left leaders group"
                    >
                      <span
                        className={`label font-mono text-[11px] truncate max-w-[140px] ${
                          has
                            ? "text-[var(--color-stamp)] group-hover:text-[var(--color-rust)]"
                            : "text-[var(--color-ink-faint)]"
                        }`}
                        title={f.path}
                      >
                        {String(i + 1).padStart(2, "0")}.{" "}
                        {f.path.length > 22 ? "…" + f.path.slice(-21) : f.path}
                      </span>
                      <span className="dots" />
                      <span className="value text-[var(--color-ink-faint)]">
                        {f.loc}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>

      <ModuleDrawer
        path={openPath}
        module={openPath ? moduleByPath.get(openPath) ?? null : null}
        apis={openPath ? apiByPath.get(openPath) ?? [] : []}
        onClose={() => setOpenPath(null)}
      />

      <footer className="mt-20 pt-6 border-t border-[var(--color-rule)] flex justify-between text-[10px] font-mono text-[var(--color-ink-faint)]">
        <span>hax · field notebook edition</span>
        <span>NLIP / ECMA-430 · agents over loopback</span>
        <span>
          set in IBM Plex Serif & JetBrains Mono · printed on parchment
        </span>
      </footer>
    </main>
  );
}
