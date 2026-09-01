import { NODE_W, IMG_W } from "../constants";
import { FIXED_ASPECT, aspectSize } from "../shapes";

/** Default width/height for a node before DOM measurement runs. */
export function defaultLayout(node) {
  if (FIXED_ASPECT.has(node.shape)) {
    const s = aspectSize(node);
    return { w: s, h: s };
  }
  if (node.type === "image") return { w: IMG_W, h: 160 };
  if (node.type === "link") return { w: NODE_W, h: 62 };
  return { w: NODE_W, h: 42 };
}

/** Merge authored node fields with a layout entry for rendering and geometry. */
export function nodeBounds(node, layoutEntry) {
  const dims = layoutEntry ?? defaultLayout(node);
  return { ...node, w: dims.w, h: dims.h };
}

export function nodesWithBounds(nodes, byId) {
  return nodes.map((n) => nodeBounds(n, byId[n.id]));
}

/** Split a saved/imported node into intrinsic data and layout dimensions. */
export function splitNode(raw) {
  const { w, h, ...intrinsic } = raw;
  const layout =
    w != null && h != null ? { w, h } : defaultLayout({ shape: "plain", ...raw });
  return { node: intrinsic, layout };
}

/** Merge layout back into nodes for JSON export (backward compatible). */
export function mergeForExport(nodes, byId) {
  return nodes.map((n) => {
    const dims = byId[n.id] ?? defaultLayout(n);
    return { ...n, w: dims.w, h: dims.h };
  });
}

/** Recompute layout after a shape change. */
export function layoutForShape(node, shape, current) {
  const next = { ...node, shape };
  if (FIXED_ASPECT.has(shape)) {
    const s = aspectSize(next);
    return { w: s, h: s };
  }
  return {
    w: next.type === "image" ? IMG_W : NODE_W,
    h: current?.h ?? defaultLayout(next).h,
  };
}

/** Recompute layout when text changes on a fixed-aspect node. */
export function layoutForText(node, text) {
  const s = aspectSize({ ...node, text });
  return { w: s, h: s };
}
