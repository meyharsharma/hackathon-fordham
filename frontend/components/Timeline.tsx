"use client";
import { type RunEvent } from "@/lib/api";

interface Entry {
  ts: string;
  body: string;
  tone: "default" | "accent" | "muted";
}

function fmt(ev: RunEvent, ts: string): Entry {
  const t = ts;
  switch (ev.type) {
    case "clone_start":
      return { ts: t, body: `clone start  ${ev.source}`, tone: "muted" };
    case "clone_done":
      return { ts: t, body: "clone complete", tone: "muted" };
    case "pipeline_start":
      return { ts: t, body: `pipeline opens — ${ev.workspace}`, tone: "accent" };
    case "agent_start":
      return { ts: t, body: `${ev.agent}  →  ${ev.url}`, tone: "default" };
    case "agent_done":
      return {
        ts: t,
        body: `${ev.agent}  ✓  ${ev.elapsed_s}s`,
        tone: "default",
      };
    case "agent_error":
      return { ts: t, body: `${ev.agent}  ✕  ${ev.error}`, tone: "accent" };
    case "stage_done": {
      const meta = Object.entries(ev)
        .filter(([k]) => k !== "type" && k !== "stage")
        .map(([k, v]) => `${k}=${v}`)
        .join(" · ");
      return { ts: t, body: `stage  ${ev.stage}  · ${meta}`, tone: "muted" };
    }
    case "pipeline_done":
      return { ts: t, body: "pipeline closes", tone: "accent" };
    case "fatal":
      return { ts: t, body: `fatal  ${ev.error}`, tone: "accent" };
    default:
      return { ts: t, body: JSON.stringify(ev), tone: "muted" };
  }
}

export function Timeline({ events }: { events: { ev: RunEvent; ts: string }[] }) {
  if (events.length === 0) {
    return (
      <p className="font-mono text-xs text-[var(--color-ink-faint)] italic">
        no entries yet — paste a repo and press Run
      </p>
    );
  }
  return (
    <ol className="font-mono text-[12px] leading-[1.7]">
      {events.map(({ ev, ts }, i) => {
        const e = fmt(ev, ts);
        const tone =
          e.tone === "accent"
            ? "text-[var(--color-rust)]"
            : e.tone === "muted"
              ? "text-[var(--color-ink-faint)]"
              : "text-[var(--color-ink)]";
        return (
          <li
            key={i}
            className="ink-in grid grid-cols-[3rem_5rem_1fr] gap-4 items-baseline"
            style={{ animationDelay: `${Math.min(i * 25, 600)}ms` }}
          >
            <span className="text-[var(--color-ink-faint)] text-right tabular-nums">
              {String(i + 1).padStart(3, "0")}
            </span>
            <span className="text-[var(--color-ink-faint)] tabular-nums">
              {e.ts}
            </span>
            <span className={tone}>{e.body}</span>
          </li>
        );
      })}
    </ol>
  );
}
