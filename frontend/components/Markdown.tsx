"use client";
import { useEffect, useRef } from "react";

function inline(s: string): string {
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/`([^`]+)`/g, '<code data-md-code="$1">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, "<em>$1</em>");
  return s;
}

function render(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      i++;
      continue;
    }

    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(trimmed))) {
      closeList();
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^[*\-]\s+/.test(trimmed)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(trimmed.replace(/^[*\-]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    const buf: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{1,6})\s+/.test(l) || /^[*\-]\s+/.test(l)) break;
      buf.push(l);
      i++;
    }
    closeList();
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  closeList();
  return out.join("\n");
}

export function Markdown({
  source,
  knownPaths,
  onPathClick,
}: {
  source: string;
  knownPaths?: string[];
  onPathClick?: (path: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current || !onPathClick || !knownPaths?.length) return;
    const set = new Set(knownPaths);
    const root = ref.current;
    const codes = root.querySelectorAll<HTMLElement>("code[data-md-code]");
    const handlers: { el: HTMLElement; fn: (e: Event) => void }[] = [];
    codes.forEach((el) => {
      const text = el.dataset.mdCode ?? el.textContent ?? "";
      // Match exact path OR any known path that ends with this token
      const exact = set.has(text);
      const suffix = !exact
        ? knownPaths.find((p) => p.endsWith("/" + text) || p.endsWith(text))
        : null;
      const target = exact ? text : suffix;
      if (!target) return;
      el.classList.add("clickable");
      const fn = (e: Event) => {
        e.preventDefault();
        onPathClick(target);
      };
      el.addEventListener("click", fn);
      handlers.push({ el, fn });
    });
    return () => {
      handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    };
  }, [source, knownPaths, onPathClick]);

  if (!source.trim()) {
    return (
      <div className="hairline bg-[var(--color-surface-1)] p-8 flex flex-col items-center justify-center gap-3 text-center">
        <span className="eyebrow">pending synthesis</span>
        <p className="text-[12px] text-[var(--color-fg-faint)] font-mono max-w-md">
          onboarding document appears once all upstream agents have reported
        </p>
      </div>
    );
  }
  return (
    <article
      ref={ref}
      className="essay"
      dangerouslySetInnerHTML={{ __html: render(source) }}
    />
  );
}
