"use client";
import { AGENT_ORDER, AGENT_PORTS, type AgentName } from "@/lib/api";

export type AgentStatus = "idle" | "live" | "done" | "error";

export function PortChips({ states }: { states: Record<AgentName, AgentStatus> }) {
  return (
    <ul className="flex flex-col gap-2 font-mono text-[11px]">
      {AGENT_ORDER.map((name) => {
        const st = states[name];
        const tone =
          st === "live"
            ? "text-[var(--color-rust)]"
            : st === "done"
              ? "text-[var(--color-ink)]"
              : st === "error"
                ? "text-[var(--color-rust)] line-through"
                : "text-[var(--color-ink-faint)]";
        return (
          <li key={name} className="flex items-center gap-2">
            <span
              className={`inline-block w-1.5 h-1.5 ${
                st === "live"
                  ? "bg-[var(--color-rust)] animate-pulse"
                  : st === "done"
                    ? "bg-[var(--color-ink)]"
                    : st === "error"
                      ? "bg-[var(--color-rust-soft)]"
                      : "bg-[var(--color-rule)]"
              }`}
            />
            <span className={`tabular-nums ${tone}`}>:{AGENT_PORTS[name]}</span>
            <span className={tone}>{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
