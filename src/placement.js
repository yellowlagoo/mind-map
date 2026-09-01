import { GAP_Y } from "./constants";

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
