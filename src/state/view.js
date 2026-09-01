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

/**
 * Pan the canvas so a new child's bottom sits just above the bottom bar.
 * Only moves the view when the child would extend past that line.
 */
export function panChildIntoView(view, node, viewport, bottomReserve) {
  const targetBottom = viewport.height - bottomReserve;
  const nodeBottom = view.y + (node.y + node.h) * view.k;
  if (nodeBottom <= targetBottom) return view;
  return { ...view, y: targetBottom - (node.y + node.h) * view.k };
}
