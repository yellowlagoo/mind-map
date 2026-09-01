import { seed } from "../seed";

export function createInitialState(seedData = seed()) {
  return {
    document: {
      nodes: seedData.nodes,
      edges: seedData.edges,
    },
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
