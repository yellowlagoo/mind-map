import React from "react";

/* ------------------------------------------------------------------ */
/*  shapes                                                             */
/* ------------------------------------------------------------------ */

/* order matters: the 1–3 keyboard shortcuts index into this array */
export const SHAPES = ["plain", "rect", "round"];

/* legacy shapes from older saves — not selectable, still rendered on import */
export const FIXED_ASPECT = new Set(["square", "circle", "diamond"]);

export const CENTERED = new Set(["square", "circle", "diamond"]);

export const GLYPH = {
  plain: <path d="M3 6h12M3 10h9M3 14h11" />,
  rect:  <rect x="2.5" y="4.5" width="13" height="9" />,
  round: <rect x="2.5" y="4.5" width="13" height="9" rx="3" />,
};

/* how big a fixed-aspect node needs to be to hold its text */
export function aspectSize(node) {
  const len = (node.text || "").length;
  if (node.type === "image") return 230;
  const base = node.shape === "diamond" ? 155 : 128;
  const grow = node.shape === "diamond" ? 3.4 : 2.4;
  return Math.round(Math.min(330, base + len * grow));
}

/* interior padding for shapes that don't fill their bounding box */
export function padFor(shape, size) {
  if (shape === "circle") return Math.round(size * 0.15);
  if (shape === "diamond") return Math.round(size * 0.24);
  if (shape === "square") return 14;
  return null;
}