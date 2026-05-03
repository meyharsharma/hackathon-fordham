"use client";
/* Tiny zero-dep markdown renderer — handles headings, paragraphs,
 * unordered lists, inline `code`, and **bold**. Sufficient for the
 * onboarding doc the agent emits. */

function inline(s: string): string {
  // escape HTML
  s = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // italic
  s = s.replace(/(?<![*])\*([^*\n]+)\*(?![*])/g, "<em>$1</em>");
  return s;
}

function render(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  let inList = false;
  let firstP = true;

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
      firstP = lvl === 1; // next paragraph after H1 gets the dropcap
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

    // paragraph — collect consecutive non-empty, non-special lines
    const buf: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{1,6})\s+/.test(l) || /^[*\-]\s+/.test(l)) break;
      buf.push(l);
      i++;
    }
    closeList();
    const body = inline(buf.join(" "));
    out.push(`<p${firstP ? ' class="dropcap"' : ""}>${body}</p>`);
    firstP = false;
  }
  closeList();
  return out.join("\n");
}

export function Markdown({ source }: { source: string }) {
  if (!source.trim()) {
    return (
      <p className="font-mono text-xs text-[var(--color-ink-faint)] italic">
        — onboarding doc appears here once the pipeline closes —
      </p>
    );
  }
  return (
    <article
      className="essay"
      dangerouslySetInnerHTML={{ __html: render(source) }}
    />
  );
}
