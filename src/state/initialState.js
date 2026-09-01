import { seed } from "../seed";
import { splitNode } from "./nodeBounds";

export function createInitialState(seedData = seed()) {
  const byId = {};
  const nodes = seedData.nodes.map((raw) => {
    const { node, layout } = splitNode(raw);
    byId[node.id] = layout;
    return node;
  });

  return {
    document: { nodes, edges: seedData.edges, title: "Untitled" },
    layout: { byId },
    ui: {
      selection: null,
      editing: null,
      defShape: "plain",
      showKeys: true,
      linkFrom: null,
    },
    view: { x: 0, y: 0, k: 1 },
  };
}
