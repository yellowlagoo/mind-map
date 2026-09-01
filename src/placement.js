import { GAP_X, GAP_Y, CHILD_GAP_Y } from "./constants";

/** True if `box` overlaps any node in `list` (with padding). */
export function collides(box, list) {
  return list.some(
    (n) =>
      box.x < n.x + n.w + 14 &&
      box.x + box.w + 14 > n.x &&
      box.y < n.y + n.h + 10 &&
      box.y + box.h + 10 > n.y,
  );
}

/** Nudge `y` downward until `box` no longer overlaps nodes. */
export function freeSpot(x, y, w, h, list) {
  let ty = y;
  let guard = 0;
  while (collides({ x, y: ty, w, h }, list) && guard++ < 80) ty += h + GAP_Y;
  return { x, y: ty };
}

/** Nodes connected as direct children of `parentId`. */
export function childrenOf(parentId, edges, nodes) {
  const ids = new Set(edges.filter((e) => e.from === parentId).map((e) => e.to));
  return nodes.filter((n) => ids.has(n.id));
}

/**
 * Place a new child on the row below `parent`, sharing y with existing siblings.
 * Existing siblings shift horizontally to stay centered as a group.
 */
export function layoutChildAmongSiblings(parent, siblings, newW) {
  const y = parent.y + parent.h + CHILD_GAP_Y;
  const ordered = [...siblings].sort((a, b) => a.x - b.x);
  const widths = [...ordered.map((s) => s.w), newW];
  const totalW =
    widths.reduce((sum, w) => sum + w, 0) + GAP_X * Math.max(0, widths.length - 1);
  let x = parent.x + parent.w / 2 - totalW / 2;

  const shifts = ordered.map((s) => {
    const pos = { id: s.id, x, y };
    x += s.w + GAP_X;
    return pos;
  });

  return { newSpot: { x, y }, shifts };
}
