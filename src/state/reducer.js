import { NODE_W, GAP_X, GAP_Y } from "../constants";
import { FIXED_ASPECT } from "../shapes";
import { uid } from "../seed";
import { freeSpot } from "../placement";
import { addEdge, hasEdgeBetween } from "./edges";
import { computeFitView } from "./view";
import {
  defaultLayout,
  layoutForShape,
  layoutForText,
  nodesWithBounds,
} from "./nodeBounds";

/* ------------------------------------------------------------------ */
/*  selectors                                                          */
/* ------------------------------------------------------------------ */

export function selectedNodeId(ui) {
  return ui.selection?.kind === "node" ? ui.selection.id : null;
}

export function selectedEdgeId(ui) {
  return ui.selection?.kind === "edge" ? ui.selection.id : null;
}

export function editingNodeId(ui) {
  return ui.editing?.kind === "node" ? ui.editing.id : null;
}

export function editingEdgeId(ui) {
  return ui.editing?.kind === "edge" ? ui.editing.id : null;
}

/* ------------------------------------------------------------------ */
/*  pure node helpers                                                  */
/* ------------------------------------------------------------------ */

function buildNode(partial, defShape) {
  const shape = partial.shape || defShape;
  const { w, h, ...rest } = partial;
  const node = {
    id: uid(),
    type: "text",
    text: "",
    ...rest,
    shape,
  };
  const layout =
    w != null && h != null ? { w, h } : defaultLayout(node);
  return { node, layout };
}

function removeLayoutEntry(byId, id) {
  const { [id]: _, ...rest } = byId;
  return rest;
}

function merged(state) {
  return nodesWithBounds(state.document.nodes, state.layout.byId);
}

/* ------------------------------------------------------------------ */
/*  reducer                                                            */
/* ------------------------------------------------------------------ */

export function boardReducer(state, action) {
  const { document: doc, layout, ui, view } = state;

  switch (action.type) {
    /* ---- layout (not undoable) ---- */
    case "LAYOUT_BATCH": {
      const next = { ...layout.byId };
      let changed = false;
      for (const { id, w, h } of action.entries) {
        const prev = layout.byId[id];
        if (prev && Math.abs(prev.w - w) <= 0.5 && Math.abs(prev.h - h) <= 0.5) continue;
        next[id] = { w, h };
        changed = true;
      }
      if (!changed) return state;
      return { ...state, layout: { byId: next } };
    }

    /* ---- document: nodes ---- */
    case "NODE_ADD": {
      const { node, layout: entry } = buildNode(action.partial, ui.defShape);
      const connectFrom = action.connectFrom ?? null;
      const edges = connectFrom
        ? addEdge(doc.edges, connectFrom, node.id, `e${node.id}`)
        : doc.edges;
      return {
        ...state,
        document: { nodes: [...doc.nodes, node], edges },
        layout: { byId: { ...layout.byId, [node.id]: entry } },
        ui: {
          ...ui,
          selection: { kind: "node", id: node.id },
          editing: node.type === "text" ? { kind: "node", id: node.id } : null,
        },
      };
    }

    case "NODE_MOVE":
      return {
        ...state,
        document: {
          ...doc,
          nodes: doc.nodes.map((n) =>
            n.id === action.id ? { ...n, x: action.x, y: action.y } : n,
          ),
        },
      };

    case "NODE_PATCH": {
      const node = doc.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      const next = { ...node, ...action.fields };
      let byId = layout.byId;
      if (FIXED_ASPECT.has(next.shape) && "text" in action.fields) {
        byId = { ...byId, [action.id]: layoutForText(next, action.fields.text) };
      }
      return {
        ...state,
        document: {
          ...doc,
          nodes: doc.nodes.map((n) => (n.id === action.id ? next : n)),
        },
        layout: { byId },
      };
    }

    case "NODE_SET_SHAPE": {
      const node = doc.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      const next = { ...node, shape: action.shape };
      return {
        ...state,
        document: {
          ...doc,
          nodes: doc.nodes.map((n) => (n.id === action.id ? next : n)),
        },
        layout: {
          byId: {
            ...layout.byId,
            [action.id]: layoutForShape(node, action.shape, layout.byId[action.id]),
          },
        },
      };
    }

    case "NODE_REMOVE": {
      const id = action.id;
      const incoming = doc.edges.find((e) => e.to === id);
      const deletingSelected =
        ui.selection?.kind === "node" && ui.selection.id === id;
      const selection = deletingSelected
        ? incoming
          ? { kind: "node", id: incoming.from }
          : null
        : ui.selection;
      return {
        ...state,
        document: {
          nodes: doc.nodes.filter((n) => n.id !== id),
          edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
        },
        layout: { byId: removeLayoutEntry(layout.byId, id) },
        ui: {
          ...ui,
          selection,
          editing: ui.editing?.id === id ? null : ui.editing,
        },
      };
    }

    case "ADD_CHILD": {
      const parentId = selectedNodeId(ui);
      const bounds = merged(state);
      const parent = bounds.find((n) => n.id === parentId);
      if (!parent) return state;
      const w = FIXED_ASPECT.has(ui.defShape) ? 128 : NODE_W;
      const spot = freeSpot(parent.x + parent.w + GAP_X, parent.y, w, 42, bounds);
      const { node, layout: entry } = buildNode(spot, ui.defShape);
      return {
        ...state,
        document: {
          nodes: [...doc.nodes, node],
          edges: addEdge(doc.edges, parent.id, node.id, `e${node.id}`),
        },
        layout: { byId: { ...layout.byId, [node.id]: entry } },
        ui: {
          ...ui,
          selection: { kind: "node", id: node.id },
          editing: { kind: "node", id: node.id },
        },
      };
    }

    case "ADD_SIBLING": {
      const childId = selectedNodeId(ui);
      const bounds = merged(state);
      const child = bounds.find((n) => n.id === childId);
      if (!child) return state;
      const pe = doc.edges.find((e) => e.to === child.id);
      const w = FIXED_ASPECT.has(ui.defShape) ? 128 : NODE_W;
      const spot = freeSpot(child.x, child.y + child.h + GAP_Y, w, 42, bounds);
      const { node, layout: entry } = buildNode(spot, ui.defShape);
      const edges = pe
        ? addEdge(doc.edges, pe.from, node.id, `e${node.id}`)
        : doc.edges;
      return {
        ...state,
        document: { nodes: [...doc.nodes, node], edges },
        layout: { byId: { ...layout.byId, [node.id]: entry } },
        ui: {
          ...ui,
          selection: { kind: "node", id: node.id },
          editing: { kind: "node", id: node.id },
        },
      };
    }

    /* ---- document: edges ---- */
    case "EDGE_CONNECT":
      return {
        ...state,
        document: {
          ...doc,
          edges: addEdge(doc.edges, action.from, action.to),
        },
      };

    case "EDGE_UPDATE_LABEL":
      return {
        ...state,
        document: {
          ...doc,
          edges: doc.edges.map((e) =>
            e.id === action.id ? { ...e, label: action.label } : e,
          ),
        },
      };

    case "EDGE_APPEND_LABEL":
      return {
        ...state,
        document: {
          ...doc,
          edges: doc.edges.map((e) =>
            e.id === action.id
              ? { ...e, label: (e.label || "") + action.char }
              : e,
          ),
        },
        ui: { ...ui, editing: { kind: "edge", id: action.id } },
      };

    case "EDGE_REMOVE":
      return {
        ...state,
        document: {
          ...doc,
          edges: doc.edges.filter((e) => e.id !== action.id),
        },
        ui: {
          ...ui,
          selection: ui.selection?.id === action.id ? null : ui.selection,
          editing: ui.editing?.id === action.id ? null : ui.editing,
        },
      };

    case "EDGE_REWIRE": {
      const { id, end, newNodeId, anchorId } = action;
      if (newNodeId === anchorId || hasEdgeBetween(doc.edges, newNodeId, anchorId, id)) {
        return state;
      }
      return {
        ...state,
        document: {
          ...doc,
          edges: doc.edges.map((e) =>
            e.id === id ? { ...e, [end]: newNodeId } : e,
          ),
        },
      };
    }

    case "DOCUMENT_LOAD": {
      const byId = {};
      const nodes = action.nodes.map((raw) => {
        const { w, h, ...rest } = { shape: "plain", ...raw };
        const node = rest;
        byId[node.id] =
          w != null && h != null ? { w, h } : defaultLayout(node);
        return node;
      });
      return {
        ...state,
        document: { nodes, edges: action.edges || [] },
        layout: { byId },
        ui: { ...ui, selection: null, editing: null, linkFrom: null },
      };
    }

    /* ---- ui ---- */
    case "SELECT":
      return { ...state, ui: { ...ui, selection: action.target } };

    case "START_EDIT":
      return { ...state, ui: { ...ui, editing: action.target } };

    case "STOP_EDIT":
      return { ...state, ui: { ...ui, editing: null } };

    case "CLEAR_UI":
      return {
        ...state,
        ui: { ...ui, selection: null, editing: null, linkFrom: null },
      };

    case "SET_DEF_SHAPE":
      return { ...state, ui: { ...ui, defShape: action.shape } };

    case "TOGGLE_SHOW_KEYS":
      return { ...state, ui: { ...ui, showKeys: !ui.showKeys } };

    case "SET_LINK_FROM":
      return { ...state, ui: { ...ui, linkFrom: action.id } };

    case "TOGGLE_LINK_FROM": {
      const nodeId = selectedNodeId(ui);
      return {
        ...state,
        ui: { ...ui, linkFrom: ui.linkFrom ? null : nodeId },
      };
    }

    case "DELETE_SELECTION": {
      const edgeId = selectedEdgeId(ui);
      if (edgeId) {
        return boardReducer(state, { type: "EDGE_REMOVE", id: edgeId });
      }
      const nodeId = selectedNodeId(ui);
      if (nodeId) {
        return boardReducer(state, { type: "NODE_REMOVE", id: nodeId });
      }
      return state;
    }

    case "CONNECT_ARMED": {
      if (!ui.linkFrom || ui.linkFrom === action.to) return state;
      const from = ui.linkFrom;
      const next = boardReducer(
        { ...state, ui: { ...ui, linkFrom: null } },
        { type: "EDGE_CONNECT", from, to: action.to },
      );
      return {
        ...next,
        ui: { ...next.ui, selection: { kind: "node", id: action.to } },
      };
    }

    /* ---- view ---- */
    case "VIEW_SET":
      return { ...state, view: action.view };

    case "VIEW_ZOOM_KEY": {
      const k =
        action.direction === "in"
          ? Math.min(2.5, view.k * 1.15)
          : Math.max(0.2, view.k / 1.15);
      return { ...state, view: { ...view, k } };
    }

    case "VIEW_WHEEL": {
      const { mx, my, deltaY, panX, panY } = action;
      if (action.zoom) {
        const k = Math.min(2.5, Math.max(0.2, view.k * Math.exp(-deltaY * 0.0022)));
        return {
          ...state,
          view: {
            k,
            x: mx - (mx - view.x) * (k / view.k),
            y: my - (my - view.y) * (k / view.k),
          },
        };
      }
      return { ...state, view: { ...view, x: view.x - panX, y: view.y - panY } };
    }

    case "VIEW_FIT": {
      const next = computeFitView(merged(state), action.width, action.height);
      if (!next) return state;
      return { ...state, view: next };
    }

    default:
      return state;
  }
}
