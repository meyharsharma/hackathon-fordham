"use client";
import { useEffect } from "react";
import type { ApiEntry, ModuleDoc } from "@/lib/api";

export function ModuleDrawer({
  path,
  module,
  apis,
  onClose,
}: {
  path: string | null;
  module: ModuleDoc | null;
  apis: ApiEntry[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!path) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [path, onClose]);

  if (!path) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-[var(--color-overlay)] z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="drawer-in fixed top-0 right-0 h-full w-[520px] max-w-[94vw] bg-[var(--color-surface-1)] hairline-l z-50 flex flex-col">
        <header className="hairline-b px-6 py-4 flex items-start justify-between gap-4 bg-[var(--color-surface-2)]">
          <div className="min-w-0">
            <div className="eyebrow mb-1.5">file</div>
            <div className="font-mono text-[13px] text-[var(--color-accent)] break-all">
              {path}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[11px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] uppercase tracking-[0.16em] hairline px-2.5 py-1.5 hover:border-[var(--color-border-bright)] transition-colors shrink-0"
          >
            esc · close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {module ? (
            <>
              <section>
                <div className="eyebrow mb-3">purpose</div>
                <p className="text-[14px] leading-relaxed text-[var(--color-fg-soft)]">
                  {module.purpose}
                </p>
              </section>

              <section>
                <div className="eyebrow mb-3">responsibilities</div>
                <ul className="space-y-2">
                  {module.responsibilities.map((r, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[13px] text-[var(--color-fg-soft)] leading-snug"
                    >
                      <span className="text-[var(--color-accent)] font-mono shrink-0 mt-px">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {module.neighbors.length > 0 && (
                <section>
                  <div className="eyebrow mb-3">imports</div>
                  <ul className="font-mono text-[11.5px] flex flex-wrap gap-1.5">
                    {module.neighbors.map((n) => (
                      <li
                        key={n}
                        className="hairline px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <p className="font-mono text-[11px] text-[var(--color-fg-faint)]">
              no module documentation written for this file
            </p>
          )}

          {apis.length > 0 && (
            <section>
              <div className="eyebrow mb-3">public surface</div>
              <div className="space-y-4">
                {apis.map((a, i) => (
                  <div
                    key={i}
                    className="hairline bg-[var(--color-surface-2)] p-4 space-y-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
                        {a.kind}
                      </span>
                      <span className="font-mono text-[12px] text-[var(--color-fg)]">
                        {a.symbol}
                      </span>
                    </div>
                    <pre className="font-mono text-[11px] text-[var(--color-fg-soft)] whitespace-pre-wrap">
                      {a.signature}
                    </pre>
                    {a.docstring && (
                      <p className="text-[12px] italic text-[var(--color-fg-muted)] leading-snug">
                        {a.docstring}
                      </p>
                    )}
                    {a.example && (
                      <pre className="font-mono text-[11px] text-[var(--color-fg-soft)] mt-2 p-3 bg-[var(--color-bg)] hairline overflow-x-auto whitespace-pre">
                        {a.example}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
