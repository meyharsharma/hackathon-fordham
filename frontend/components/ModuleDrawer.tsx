"use client";
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
  if (!path) return null;
  return (
    <aside className="fixed top-0 right-0 h-full w-[480px] max-w-[92vw] bg-[var(--color-paper-warm)] border-l border-[var(--color-rule)] z-50 flex flex-col shadow-[-12px_0_24px_-18px_rgba(26,23,20,0.25)]">
      <header className="px-6 pt-6 pb-3 border-b border-[var(--color-rule)] flex items-start justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
            entry
          </p>
          <h2 className="font-mono text-[13px] mt-1 break-all text-[var(--color-stamp)]">
            {path}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="font-mono text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-rust)] uppercase tracking-[0.18em]"
        >
          close ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
        {module ? (
          <>
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-2">
                purpose
              </h3>
              <p className="font-serif text-[15px] leading-relaxed">
                {module.purpose}
              </p>
            </section>
            <section>
              <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-2">
                responsibilities
              </h3>
              <ul className="space-y-1">
                {module.responsibilities.map((r, i) => (
                  <li key={i} className="font-serif text-[14px] leading-snug pl-4 relative">
                    <span className="absolute left-0 top-0 text-[var(--color-rust)]">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </section>
            {module.neighbors.length > 0 && (
              <section>
                <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-2">
                  neighbors
                </h3>
                <ul className="font-mono text-[12px] space-y-1">
                  {module.neighbors.map((n) => (
                    <li key={n} className="text-[var(--color-stamp)]">
                      → {n}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <p className="font-mono text-xs text-[var(--color-ink-faint)] italic">
            no module documentation for this file
          </p>
        )}

        {apis.length > 0 && (
          <section>
            <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mb-3">
              public surface
            </h3>
            <div className="space-y-5">
              {apis.map((a, i) => (
                <div key={i} className="border-l-2 border-[var(--color-rust)] pl-3">
                  <p className="font-mono text-[12px] text-[var(--color-stamp)]">
                    {a.signature}
                  </p>
                  {a.docstring && (
                    <p className="font-serif text-[13px] mt-1 italic text-[var(--color-ink-soft)]">
                      {a.docstring}
                    </p>
                  )}
                  {a.example && (
                    <pre className="font-mono text-[11px] mt-2 p-2 bg-[var(--color-paper)] border border-[var(--color-rule-faint)] overflow-x-auto whitespace-pre">
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
  );
}
