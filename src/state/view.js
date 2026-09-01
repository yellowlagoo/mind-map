/** Pure fit-to-view math — no DOM, viewport size passed in. */
export function computeFitView(nodes, viewportWidth, viewportHeight) {
  if (!nodes.length) return null;
  const x0 = Math.min(...nodes.map((n) => n.x));
  const y0 = Math.min(...nodes.map((n) => n.y));
  const x1 = Math.max(...nodes.map((n) => n.x + n.w));
  const y1 = Math.max(...nodes.map((n) => n.y + n.h));
  const pad = 100;
  const k = Math.min(
    1.35,
    (viewportWidth - pad * 2) / (x1 - x0 || 1),
    (viewportHeight - pad * 2) / (y1 - y0 || 1),
  );
  return {
    k,
    x: viewportWidth / 2 - ((x0 + x1) / 2) * k,
    y: viewportHeight / 2 - ((y0 + y1) / 2) * k,
  };
}
