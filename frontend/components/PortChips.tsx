"use client";
import { AGENT_ORDER, AGENT_PORTS, type AgentName } from "@/lib/api";

export type AgentStatus = "idle" | "live" | "done" | "error";

const LABELS: Record<AgentName, string> = {
  architecture: "Architecture",
  module: "Module",
  api: "API surface",
  decisions: "Decisions",
  onboarding: "Onboarding",
};

const ROLE: Record<AgentName, string> = {
  architecture: "tree · imports",
  module: "purpose · scope",
  api: "symbols · examples",
  decisions: "git log · why",
  onboarding: "synthesis",
};

export function PortChips({
  states,
  elapsed,
}: {
  states: Record<AgentName, AgentStatus>;
  elapsed?: Record<AgentName, number>;
}) {
  const e = elapsed ?? ({} as Record<AgentName, number>);
  return (
    <ol className="flex flex-col">
      {AGENT_ORDER.map((name, i) => {
        const st = states[name];
        const tone =
          st === "live"
            ? "text-[var(--color-accent)]"
            : st === "done"
              ? "text-[var(--color-fg)]"
              : st === "error"
                ? "text-[var(--color-error)]"
                : "text-[var(--color-fg-faint)]";
        return (
          <li
            key={name}
            className={`group relative px-4 py-3 hairline-b ${
              st === "live" ? "bg-[var(--color-accent-glow)]" : ""
            } ${i === 0 ? "hairline-t" : ""}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`dot ${st !== "idle" ? st : ""}`} />
                <div className="min-w-0">
                  <div
                    className={`text-[13px] font-semibold tracking-tight truncate ${
                      st === "idle"
                        ? "text-[var(--color-fg-muted)]"
                        : "text-[var(--color-fg)]"
                    }`}
                  >
                    {LABELS[name]}
                  </div>
                  <div className="text-[10.5px] text-[var(--color-fg-faint)] mt-0.5 tracking-wide">
                    {ROLE[name]}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`numeric text-[11px] ${tone}`}>
                  :{AGENT_PORTS[name]}
                </div>
                {(e[name] ?? 0) > 0 && (
                  <div className="numeric text-[10px] text-[var(--color-fg-faint)] mt-0.5">
                    {(e[name] ?? 0).toFixed(2)}s
                  </div>
                )}
              </div>
            </div>
            {st === "live" && (
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--color-accent)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
