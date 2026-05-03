"use client";

function inline(s: string): string {
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
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

export function Markdown({ source }: { source: string }) {
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
      className="essay"
      dangerouslySetInnerHTML={{ __html: render(source) }}
    />
  );
}
