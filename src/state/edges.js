/** True if an undirected edge already exists between `a` and `b`. */
export function hasEdgeBetween(edges, a, b, exceptId = null) {
  return edges.some(
    (e) =>
      e.id !== exceptId &&
      ((e.from === a && e.to === b) || (e.from === b && e.to === a)),
  );
}

/** Add an edge unless it would be a self-loop or duplicate pair. */
export function addEdge(edges, from, to, id = `e${from}-${to}-${Date.now()}`) {
  if (!from || !to || from === to) return edges;
  if (hasEdgeBetween(edges, from, to)) return edges;
  return [...edges, { id, from, to, label: "" }];
}
