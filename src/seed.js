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
  return { nodes: [], edges: [] };
}