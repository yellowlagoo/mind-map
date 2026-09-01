import { NODE_W } from "./constants";

/* ------------------------------------------------------------------ */
/*  ids                                                                */
/* ------------------------------------------------------------------ */

/* module-level counter: every MindMap instance on the page shares it */
let _id = 0;

export const uid = () => `n${++_id}`;

/* importing a file jumps the counter clear of the ids it contains */
export const resetIds = (n) => { _id = n; };

/* ------------------------------------------------------------------ */
/*  seed                                                               */
/* ------------------------------------------------------------------ */

export function seed() {
  const a = { id: uid(), type: "text", shape: "round", text: "Reading room", x: 0, y: 0, w: NODE_W, h: 42 };
  const b = { id: uid(), type: "text", shape: "plain", text: "Spatial memory beats search", x: 330, y: -90, w: NODE_W, h: 42 };
  const c = { id: uid(), type: "text", shape: "plain", text: "Auto-layout destroys it", x: 330, y: 10, w: NODE_W, h: 42 };
  const d = { id: uid(), type: "link", shape: "rect", text: "Notational velocity", url: "https://notational.net", x: 330, y: 110, w: NODE_W, h: 62 };
  return {
    nodes: [a, b, c, d],
    edges: [
      { id: "e1", from: a.id, to: b.id, label: "" },
      { id: "e2", from: a.id, to: c.id, label: "" },
      { id: "e3", from: a.id, to: d.id, label: "" },
      { id: "e4", from: b.id, to: c.id, label: "because" },
    ],
  };
}