"use client";
import { useEffect, useRef } from "react";
import type { DepGraph } from "@/lib/api";

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  loc: number;
}

export function DepGraphCanvas({
  graph,
  height = 460,
}: {
  graph: DepGraph | null;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !graph) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = height;
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Build node set: every file + every distinct dst that isn't a file
    const ids = new Set<string>();
    graph.files.forEach((f) => ids.add(f.path));
    graph.edges.forEach((e) => {
      ids.add(e.src);
      ids.add(e.dst);
    });
    const locByPath = Object.fromEntries(
      graph.files.map((f) => [f.path, f.loc] as const),
    );
    const nodes: Node[] = Array.from(ids).map((id, i) => {
      const angle = (i / Math.max(ids.size, 1)) * Math.PI * 2;
      const r = Math.min(W, H) * 0.32;
      return {
        id,
        x: W / 2 + Math.cos(angle) * r,
        y: H / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        loc: locByPath[id] ?? 4,
      };
    });
    const idx = new Map(nodes.map((n, i) => [n.id, i] as const));
    const links = graph.edges
      .map((e) => ({ a: idx.get(e.src), b: idx.get(e.dst) }))
      .filter((l): l is { a: number; b: number } => l.a !== undefined && l.b !== undefined);

    let alpha = 1;
    let frame = 0;
    const tick = () => {
      // Force-directed: repulsion + spring + center
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          let dx = a.x - b.x,
            dy = a.y - b.y;
          const dist2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(dist2);
          const force = 1400 / dist2;
          dx /= d;
          dy /= d;
          a.vx += dx * force;
          a.vy += dy * force;
          b.vx -= dx * force;
          b.vy -= dy * force;
        }
      }
      for (const { a, b } of links) {
        const A = nodes[a],
          B = nodes[b];
        const dx = B.x - A.x,
          dy = B.y - A.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const ideal = 110;
        const k = 0.012;
        const f = (d - ideal) * k;
        A.vx += (dx / d) * f;
        A.vy += (dy / d) * f;
        B.vx -= (dx / d) * f;
        B.vy -= (dy / d) * f;
      }
      // Centering
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.0015;
        n.vy += (H / 2 - n.y) * 0.0015;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
        n.x = Math.max(40, Math.min(W - 40, n.x));
        n.y = Math.max(20, Math.min(H - 20, n.y));
      }
      alpha = Math.max(0.06, alpha * 0.985);

      // Draw
      ctx.clearRect(0, 0, W, H);
      // Edges — thin ink lines
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "rgba(26,23,20,0.35)";
      ctx.beginPath();
      for (const { a, b } of links) {
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
      }
      ctx.stroke();

      // Nodes — open circles, sized by loc
      for (const n of nodes) {
        const r = Math.max(3.5, Math.min(11, Math.sqrt(n.loc) * 0.85));
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = "#f5f1e8";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#1a1714";
        ctx.stroke();
      }

      // Labels — only for the largest 18 nodes, in serif
      const labeled = [...nodes]
        .sort((a, b) => b.loc - a.loc)
        .slice(0, 18);
      ctx.font = '11px "IBM Plex Serif", Georgia, serif';
      ctx.fillStyle = "#1a1714";
      for (const n of labeled) {
        const r = Math.max(3.5, Math.min(11, Math.sqrt(n.loc) * 0.85));
        const label =
          n.id.length > 28 ? "…" + n.id.slice(-27) : n.id;
        ctx.fillText(label, n.x + r + 4, n.y + 3);
      }
      // Caption — etching plate signature, bottom-right
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = "rgba(26,23,20,0.45)";
      ctx.fillText(
        `${nodes.length} nodes · ${links.length} edges`,
        W - 170,
        H - 10,
      );

      frame++;
      if (frame < 600) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [graph, height]);

  if (!graph) {
    return (
      <div
        className="border border-[var(--color-rule)] flex items-center justify-center text-[var(--color-ink-faint)] text-xs font-mono italic"
        style={{ height }}
      >
        — graph appears once architecture agent finishes —
      </div>
    );
  }
  return (
    <div className="border border-[var(--color-rule)] bg-[var(--color-paper)]">
      <canvas ref={ref} style={{ width: "100%", height }} />
    </div>
  );
}
