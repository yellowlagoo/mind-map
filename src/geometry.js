/* ------------------------------------------------------------------ */
/*  geometry                                                           */
/* ------------------------------------------------------------------ */

export function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  }
  
  export function titleFromUrl(url) {
    try {
      const u = new URL(url);
      const seg = u.pathname.split("/").filter(Boolean).pop();
      if (!seg) return u.hostname.replace(/^www\./, "");
      return decodeURIComponent(seg).replace(/[-_]+/g, " ").replace(/\.\w{2,4}$/, "");
    } catch { return url; }
  }
  
  /* where an edge should touch a node, given the shape it is drawn as */
  export function anchorOn(node, toward, end = "auto") {
    const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
    let dx = toward.x - cx, dy = toward.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const a = node.w / 2, b = node.h / 2;

    if (node.shape === "circle") {
      return { x: cx + dx * a, y: cy + dy * b, nx: dx, ny: dy };
    }
    if (node.shape === "diamond") {
      const t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
      return { x: cx + dx * t, y: cy + dy * t, nx: dx, ny: dy };
    }
    /* boxy shapes: exit bottom on the source, enter top on the target */
    if (end === "from") {
      return { x: cx, y: node.y + node.h, nx: 0, ny: 1 };
    }
    if (end === "to") {
      return { x: cx, y: node.y, nx: 0, ny: -1 };
    }
    const down = toward.y >= cy;
    return { x: cx, y: down ? node.y + node.h : node.y, nx: 0, ny: down ? 1 : -1 };
  }

  export function edgePath(a, b) {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const p = anchorOn(a, bc, "from");
    const q = anchorOn(b, ac, "to");
    const d = Math.max(36, Math.hypot(q.x - p.x, q.y - p.y) * 0.38);
    return {
      d: `M ${p.x} ${p.y} C ${p.x + p.nx * d} ${p.y + p.ny * d}, ${q.x + q.nx * d} ${q.y + q.ny * d}, ${q.x} ${q.y}`,
      mid: { x: (p.x + q.x) / 2 + (p.nx + q.nx) * d * 0.26, y: (p.y + q.y) / 2 + (p.ny + q.ny) * d * 0.26 },
      p, q,
    };
  }