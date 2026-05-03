"use client";
import { useEffect, useRef } from "react";
import { type RunEvent } from "@/lib/api";

interface Entry {
  ts: string;
  kind: string;
  body: string;
  tone: "default" | "accent" | "muted" | "error" | "success";
}

function fmt(ev: RunEvent, ts: string): Entry {
  switch (ev.type) {
    case "clone_start":
      return { ts, kind: "clone", body: ev.source, tone: "muted" };
    case "clone_done":
      return { ts, kind: "clone", body: "complete", tone: "success" };
    case "pipeline_start":
      return { ts, kind: "pipe", body: `open ${ev.workspace}`, tone: "accent" };
    case "agent_start":
      return { ts, kind: ev.agent, body: `→ ${ev.url}`, tone: "default" };
    case "agent_done":
      return {
        ts,
        kind: ev.agent,
        body: `done · ${ev.elapsed_s.toFixed(2)}s`,
        tone: "success",
      };
    case "agent_error":
      return { ts, kind: ev.agent, body: `error · ${ev.error}`, tone: "error" };
    case "stage_done": {
      const meta = Object.entries(ev)
        .filter(([k]) => k !== "type" && k !== "stage")
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      return {
        ts,
        kind: `stage/${ev.stage}`,
        body: meta || "complete",
        tone: "muted",
      };
    }
    case "pipeline_done":
      return { ts, kind: "pipe", body: "close", tone: "accent" };
    case "fatal":
      return { ts, kind: "fatal", body: ev.error, tone: "error" };
    default:
      return { ts, kind: "log", body: JSON.stringify(ev), tone: "muted" };
  }
}

const TONE: Record<Entry["tone"], string> = {
  default: "text-[var(--color-fg-soft)]",
  accent: "text-[var(--color-accent)]",
  muted: "text-[var(--color-fg-muted)]",
  error: "text-[var(--color-error)]",
  success: "text-[var(--color-done)]",
};

export function Timeline({
  events,
  running,
}: {
  events: { ev: RunEvent; ts: string }[];
  running: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  return (
    <div className="hairline bg-[var(--color-surface-1)] flex flex-col h-full overflow-hidden">
      <header className="hairline-b px-4 py-2.5 flex items-center justify-between bg-[var(--color-surface-2)]">
        <div className="flex items-center gap-2.5">
          <span className="dot done" />
          <span className="eyebrow">stream</span>
          <span className="text-[11px] text-[var(--color-fg-muted)] font-mono">
            /runs/events
          </span>
        </div>
        <span className="numeric text-[11px] text-[var(--color-fg-muted)]">
          {events.length} events
        </span>
      </header>

      <ol
        ref={ref}
        className="flex-1 overflow-y-auto font-mono text-[11.5px] leading-[1.65] px-4 py-3"
      >
        {events.length === 0 ? (
          <li className="text-[var(--color-fg-faint)] italic">
            <span className="caret">awaiting first envelope</span>
          </li>
        ) : (
          events.map(({ ev, ts }, i) => {
            const e = fmt(ev, ts);
            return (
              <li
                key={i}
                className="fade-in grid grid-cols-[64px_120px_1fr] gap-3 items-baseline"
                style={{ animationDelay: `${Math.min(i * 12, 200)}ms` }}
              >
                <span className="text-[var(--color-fg-faint)] numeric">
                  {e.ts}
                </span>
                <span className="text-[var(--color-fg-muted)] truncate">
                  {e.kind}
                </span>
                <span className={`${TONE[e.tone]} truncate`}>{e.body}</span>
              </li>
            );
          })
        )}
        {running && (
          <li className="text-[var(--color-fg-faint)] mt-1 caret" />
        )}
      </ol>
    </div>
  );
}
