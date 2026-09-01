import React, { useReducer, useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";

import { CSS } from "./styles";
import { NODE_W, IMG_W, LANDING_MS } from "./constants";
import { SHAPES, FIXED_ASPECT, CENTERED, GLYPH, aspectSize, padFor } from "./shapes";
import { hostOf, titleFromUrl, edgePath } from "./geometry";
import { resetIds } from "./seed";
import { createInitialState } from "./state/initialState";
import { nodesWithBounds, mergeForExport } from "./state/nodeBounds";
import { filenameFromTitle } from "./state/filename";
import {
  boardReducer,
  selectedNodeId,
  selectedEdgeId,
  editingNodeId,
  editingEdgeId,
} from "./state/reducer";

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function MindMap() {
  const [state, dispatch] = useReducer(boardReducer, undefined, createInitialState);
  const { document: board, layout, ui, view } = state;
  const { nodes, edges, title } = board;
  const boundsNodes = useMemo(
    () => nodesWithBounds(nodes, layout.byId),
    [nodes, layout.byId],
  );
  const { defShape, showKeys, linkFrom } = ui;
  const sel = selectedNodeId(ui);
  const selEdge = selectedEdgeId(ui);
  const editing = editingNodeId(ui);
  const editEdge = editingEdgeId(ui);

  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [wire, setWire] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hoverEdge, setHoverEdge] = useState(null);
  const [rewire, setRewire] = useState(null);
  const [showLanding, setShowLanding] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);

  const surfaceRef = useRef(null);
  const measured = useRef({});
  const viewRef = useRef(view);
  viewRef.current = view;
  const nodesRef = useRef(boundsNodes);
  nodesRef.current = boundsNodes;
  const stateRef = useRef(state);
  stateRef.current = state;
  const fileRef = useRef(null);
  const pendingKeyRef = useRef(null);
  const centerWorldRef = useRef(() => ({ x: 0, y: 0 }));

  const toWorld = useCallback((sx, sy) => {
    const r = surfaceRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (sx - r.left - v.x) / v.k, y: (sy - r.top - v.y) / v.k };
  }, []);

  const centerWorld = useCallback(() => {
    const r = surfaceRef.current.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }, [toWorld]);
  centerWorldRef.current = centerWorld;

  const fit = useCallback(() => {
    const r = surfaceRef.current?.getBoundingClientRect();
    if (!r) return;
    dispatch({ type: "VIEW_FIT", width: r.width, height: r.height });
  }, []);

  useLayoutEffect(() => {
    const { document: doc, layout: lay } = stateRef.current;
    const entries = [];
    for (const n of doc.nodes) {
      const cur = lay.byId[n.id];
      if (FIXED_ASPECT.has(n.shape)) {
        const s = aspectSize(n);
        if (!cur || Math.abs(s - cur.w) > 0.5 || Math.abs(s - cur.h) > 0.5) {
          entries.push({ id: n.id, w: s, h: s });
        }
        continue;
      }
      const el = measured.current[n.id];
      if (!el) continue;
      const h = el.offsetHeight;
      const w = cur?.w ?? NODE_W;
      if (h && (!cur || Math.abs(h - cur.h) > 0.5)) {
        entries.push({ id: n.id, w, h });
      }
    }
    if (entries.length) dispatch({ type: "LAYOUT_BATCH", entries });
  });

  useEffect(() => {
    if (nodes.length > 0) setShowLanding(false);
  }, [nodes.length]);

  useEffect(() => {
    if (nodes.length > 0 || !showLanding) return;
    const t = setTimeout(() => setShowLanding(false), LANDING_MS);
    return () => clearTimeout(t);
  }, [nodes.length, showLanding]);

  useEffect(() => {
    const id = editing;
    const key = pendingKeyRef.current;
    if (!id || !key) return;
    pendingKeyRef.current = null;
    dispatch({ type: "NODE_PATCH", id, fields: { text: key } });
  }, [editing, dispatch]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const { ui, document: doc } = stateRef.current;
      const sel = selectedNodeId(ui);
      const selEdge = selectedEdgeId(ui);
      const editEdge = editingEdgeId(ui);
      const typing = e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
      if (typing) {
        if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "STOP_EDIT" });
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          dispatch({ type: "STOP_EDIT" });
        }
        if (e.key === "Tab" && !editEdge) {
          e.preventDefault();
          dispatch({ type: "STOP_EDIT" });
          setTimeout(() => dispatch({ type: "ADD_CHILD" }), 0);
        }
        return;
      }
      if (doc.nodes.length === 0) {
        const shortcut =
          e.key === "Tab" ||
          e.key === "Enter" ||
          e.key === "Escape" ||
          e.key === "Backspace" ||
          e.key === "Delete" ||
          e.key === "c" ||
          e.key === "f" ||
          e.key === "n" ||
          e.key === "?" ||
          e.key === "=" ||
          e.key === "+" ||
          e.key === "-" ||
          (e.key >= "1" && e.key <= String(SHAPES.length));
        if (
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          !shortcut
        ) {
          e.preventDefault();
          setShowLanding(false);
          pendingKeyRef.current = e.key;
          const c = centerWorldRef.current();
          dispatch({
            type: "NODE_ADD",
            partial: { x: c.x - NODE_W / 2, y: c.y - 20 },
          });
          return;
        }
      }
      if (e.key === "Tab") {
        e.preventDefault();
        dispatch({ type: "ADD_CHILD" });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selEdge) {
          dispatch({ type: "START_EDIT", target: { kind: "edge", id: selEdge } });
          return;
        }
        if (sel) {
          const node = doc.nodes.find((n) => n.id === sel);
          if (node?.type !== "image") {
            dispatch({ type: "START_EDIT", target: { kind: "node", id: sel } });
          }
        }
        return;
      }
      if (e.key === "Escape") {
        dispatch({ type: "CLEAR_UI" });
        return;
      }
      if (e.key === "c") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_LINK_FROM" });
        return;
      }
      if (e.key === "?") {
        dispatch({ type: "TOGGLE_SHOW_KEYS" });
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        dispatch({ type: "DELETE_SELECTION" });
        return;
      }
      if (selEdge && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        dispatch({ type: "EDGE_APPEND_LABEL", id: selEdge, char: e.key });
        return;
      }
      if (e.key >= "1" && e.key <= String(SHAPES.length)) {
        const shape = SHAPES[Number(e.key) - 1];
        if (sel) {
          dispatch({ type: "NODE_SET_SHAPE", id: sel, shape });
        } else {
          dispatch({ type: "SET_DEF_SHAPE", shape });
        }
        return;
      }
      if (e.key === "n" && sel) {
        e.preventDefault();
        dispatch({ type: "ADD_SIBLING" });
        return;
      }
      if (e.key === "f") {
        e.preventDefault();
        fit();
        return;
      }
      if (e.key === "=" || e.key === "+") {
        dispatch({ type: "VIEW_ZOOM_KEY", direction: "in" });
        return;
      }
      if (e.key === "-") {
        dispatch({ type: "VIEW_ZOOM_KEY", direction: "out" });
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, fit]);

  /* ---------- paste ---------- */
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const c = centerWorld();
      const items = [...(e.clipboardData?.items || [])];
      const img = items.find((i) => i.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        const rd = new FileReader();
        rd.onload = () =>
          dispatch({
            type: "NODE_ADD",
            partial: {
              type: "image",
              src: rd.result,
              x: c.x - IMG_W / 2,
              y: c.y - 60,
              w: IMG_W,
              h: 160,
            },
          });
        rd.readAsDataURL(img.getAsFile());
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;
      e.preventDefault();
      if (/^https?:\/\//i.test(text)) {
        dispatch({
          type: "NODE_ADD",
          partial: {
            type: "link",
            url: text,
            text: titleFromUrl(text),
            x: c.x - NODE_W / 2,
            y: c.y - 30,
            h: 62,
          },
        });
      } else {
        dispatch({
          type: "NODE_ADD",
          partial: { type: "text", text, x: c.x - NODE_W / 2, y: c.y - 20 },
        });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [dispatch, centerWorld]);

  const onDrop = (e) => {
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    [...e.dataTransfer.files].forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      const rd = new FileReader();
      rd.onload = () =>
        dispatch({
          type: "NODE_ADD",
          partial: {
            type: "image",
            src: rd.result,
            x: p.x + i * 24,
            y: p.y + i * 24,
            w: IMG_W,
            h: 160,
          },
        });
      rd.readAsDataURL(file);
    });
  };

  const loadFiles = (list) => {
    const c = centerWorld();
    [...list].forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      const rd = new FileReader();
      rd.onload = () =>
        dispatch({
          type: "NODE_ADD",
          partial: {
            type: "image",
            src: rd.result,
            x: c.x + i * 24,
            y: c.y + i * 24,
            w: IMG_W,
            h: 160,
          },
        });
      rd.readAsDataURL(file);
    });
  };

  /* ---------- pan / zoom ---------- */
  const onSurfaceDown = (e) => {
    if (e.target.closest(".mm-node") || e.target.closest(".mm-edgelabel") || e.target.closest(".mm-shapebar")) return;
    dispatch({ type: "CLEAR_UI" });
    setPanning(true);
    const s = { mx: e.clientX, my: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    const move = (ev) =>
      dispatch({
        type: "VIEW_SET",
        view: {
          ...viewRef.current,
          x: s.vx + ev.clientX - s.mx,
          y: s.vy + ev.clientY - s.my,
        },
      });
    const up = () => {
      setPanning(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onWheel = (e) => {
    const r = surfaceRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      dispatch({
        type: "VIEW_WHEEL",
        zoom: true,
        mx,
        my,
        deltaY: e.deltaY,
      });
    } else {
      dispatch({
        type: "VIEW_WHEEL",
        zoom: false,
        panX: e.deltaX,
        panY: e.deltaY,
      });
    }
  };

  useEffect(() => {
    const t = setTimeout(fit, 40);
    return () => clearTimeout(t);
  }, [fit]);

  /* ---------- node drag ---------- */
  const onNodeDown = (e, n) => {
    if (e.target.classList.contains("mm-handle")) return;
    e.stopPropagation();

    if (linkFrom && linkFrom !== n.id) {
      dispatch({ type: "CONNECT_ARMED", to: n.id });
      return;
    }
    if (e.shiftKey && sel && sel !== n.id) {
      dispatch({ type: "EDGE_CONNECT", from: sel, to: n.id });
      return;
    }

    dispatch({ type: "SELECT", target: { kind: "node", id: n.id } });
    if (editing && editing !== n.id) dispatch({ type: "STOP_EDIT" });
    const s = { mx: e.clientX, my: e.clientY, nx: n.x, ny: n.y };
    let moved = false;
    const move = (ev) => {
      const k = viewRef.current.k;
      const dx = (ev.clientX - s.mx) / k;
      const dy = (ev.clientY - s.my) / k;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        moved = true;
        setDragging(true);
      }
      if (moved) {
        dispatch({ type: "NODE_MOVE", id: n.id, x: s.nx + dx, y: s.ny + dy });
      }
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onEndDown = (e, edge, end) => {
    e.stopPropagation();
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    setRewire({ id: edge.id, end, x: p.x, y: p.y });
    dispatch({ type: "SELECT", target: { kind: "edge", id: edge.id } });

    const move = (ev) => {
      const q = toWorld(ev.clientX, ev.clientY);
      setRewire({ id: edge.id, end, x: q.x, y: q.y });
    };
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const q = toWorld(ev.clientX, ev.clientY);
      const hit = nodesRef.current.find(
        (m) => q.x >= m.x && q.x <= m.x + m.w && q.y >= m.y && q.y <= m.y + m.h,
      );
      const anchor = end === "from" ? edge.to : edge.from;
      if (hit && hit.id !== anchor) {
        dispatch({
          type: "EDGE_REWIRE",
          id: edge.id,
          end,
          newNodeId: hit.id,
          anchorId: anchor,
        });
      }
      setRewire(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onHandleDown = (e, n) => {
    e.stopPropagation();
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    setWire({ from: n.id, x: p.x, y: p.y });
    const move = (ev) => {
      const q = toWorld(ev.clientX, ev.clientY);
      setWire({ from: n.id, x: q.x, y: q.y });
    };
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const q = toWorld(ev.clientX, ev.clientY);
      const hit = nodesRef.current.find(
        (m) =>
          m.id !== n.id &&
          q.x >= m.x &&
          q.x <= m.x + m.w &&
          q.y >= m.y &&
          q.y <= m.y + m.h,
      );
      if (hit) {
        dispatch({ type: "EDGE_CONNECT", from: n.id, to: hit.id });
      } else {
        dispatch({
          type: "NODE_ADD",
          partial: { x: q.x, y: q.y - 20 },
          connectFrom: n.id,
        });
      }
      setWire(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /* ---------- files ---------- */
  const exportJson = () => {
    const payload = {
      title,
      nodes: mergeForExport(nodes, layout.byId),
      edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = globalThis.document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filenameFromTitle(title);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };

  const importJson = (file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!Array.isArray(data.nodes)) return;
        dispatch({
          type: "DOCUMENT_LOAD",
          nodes: data.nodes,
          edges: data.edges,
          title: data.title,
        });
        resetIds(data.nodes.length + 1000);
        setTimeout(fit, 40);
      } catch {
        /* malformed file */
      }
    };
    rd.readAsText(file);
  };

  /* ---------- render ---------- */
  const byId = Object.fromEntries(boundsNodes.map((n) => [n.id, n]));
  const wireFrom = wire ? byId[wire.from] : null;
  const dot = 26 * view.k;
  const selNode = sel ? byId[sel] : null;

  const shapeEl = (n, on) => {
    const stroke = on ? "var(--sage)" : n.shape === "plain" ? "transparent" : "var(--line)";
    const common = {
      fill: "none",
      stroke,
      strokeWidth: 1.2,
      vectorEffect: "non-scaling-stroke",
      strokeDasharray: n.shape === "plain" ? "3 4" : undefined,
    };
    const w = n.w;
    const h = n.h;
    if (n.shape === "circle") {
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} {...common} />;
    }
    if (n.shape === "diamond") {
      return (
        <path
          d={`M ${w / 2} 1 L ${w - 1} ${h / 2} L ${w / 2} ${h - 1} L 1 ${h / 2} Z`}
          {...common}
        />
      );
    }
    const rx = n.shape === "round" ? 10 : n.shape === "plain" ? 4 : 2;
    return (
      <rect
        x={1}
        y={1}
        width={Math.max(0, w - 2)}
        height={Math.max(0, h - 2)}
        rx={rx}
        {...common}
      />
    );
  };

  return (
    <div className={`mm-root${linkFrom ? " arming" : ""}`}>
      <style>{CSS}</style>

      <div
        ref={surfaceRef}
        className={`mm-surface${panning ? " panning" : ""}`}
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, var(--dot) 1px, transparent 0)",
          backgroundSize: `${dot}px ${dot}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onMouseDown={onSurfaceDown}
        onMouseMove={(e) => {
          if (linkFrom) setCursor(toWorld(e.clientX, e.clientY));
        }}
        onWheel={onWheel}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDoubleClick={(e) => {
          if (e.target.closest(".mm-node") || e.target.closest(".mm-edgelabel")) return;
          if (e.target.tagName === "path" || e.target.tagName === "circle") return;
          setShowLanding(false);
          const p = toWorld(e.clientX, e.clientY);
          dispatch({
            type: "NODE_ADD",
            partial: { x: p.x - NODE_W / 2, y: p.y - 20 },
          });
        }}
      >
        <div
          className="mm-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          <svg
            style={{
              position: "absolute",
              overflow: "visible",
              pointerEvents: "none",
              width: 1,
              height: 1,
            }}
          >
            {edges.map((e) => {
              let a = byId[e.from];
              let b = byId[e.to];
              if (!a || !b) return null;
              if (rewire && rewire.id === e.id) {
                const loose = { x: rewire.x, y: rewire.y, w: 1, h: 1, shape: "rect" };
                if (rewire.end === "from") a = loose;
                else b = loose;
              }
              const on =
                selEdge === e.id || hoverEdge === e.id || sel === e.from || sel === e.to;
              const live = rewire && rewire.id === e.id;
              return (
                <g key={e.id}>
                  <path
                    d={edgePath(a, b).d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onMouseEnter={() => setHoverEdge(e.id)}
                    onMouseLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
                    onMouseDown={(ev) => {
                      ev.stopPropagation();
                      if (editEdge !== e.id) dispatch({ type: "STOP_EDIT" });
                      dispatch({ type: "SELECT", target: { kind: "edge", id: e.id } });
                    }}
                  />
                  <path
                    d={edgePath(a, b).d}
                    fill="none"
                    stroke={on ? "var(--sage)" : "var(--line)"}
                    strokeWidth={on ? 1.5 : 1.1}
                    strokeDasharray={live ? "5 4" : undefined}
                    vectorEffect="non-scaling-stroke"
                    opacity={on ? 0.95 : 0.72}
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}
            {edges.map((e) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b) return null;
              const live = rewire && rewire.id === e.id;
              const shown = selEdge === e.id || hoverEdge === e.id || live;
              if (!shown || panning) return null;
              const { p, q } = edgePath(a, b);
              const r = 4.5 / view.k;
              const ends = [
                { pt: p, end: "from", hide: live && rewire.end === "from" },
                { pt: q, end: "to", hide: live && rewire.end === "to" },
              ];
              return (
                <g key={`h${e.id}`}>
                  {ends.map(({ pt, end, hide }) =>
                    hide ? null : (
                      <circle
                        key={end}
                        cx={pt.x}
                        cy={pt.y}
                        r={r}
                        fill="var(--bg)"
                        stroke="var(--sage)"
                        strokeWidth="1.4"
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: "all", cursor: "move" }}
                        onMouseEnter={() => setHoverEdge(e.id)}
                        onMouseDown={(ev) => onEndDown(ev, e, end)}
                      />
                    ),
                  )}
                </g>
              );
            })}
            {linkFrom && cursor && byId[linkFrom] && (
              <path
                d={
                  edgePath(byId[linkFrom], {
                    x: cursor.x,
                    y: cursor.y,
                    w: 1,
                    h: 1,
                    shape: "rect",
                  }).d
                }
                fill="none"
                stroke="var(--sage-dim)"
                strokeWidth="1.4"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {wire && wireFrom && (
              <path
                d={
                  edgePath(wireFrom, { x: wire.x, y: wire.y, w: 1, h: 1, shape: "rect" }).d
                }
                fill="none"
                stroke="var(--sage-dim)"
                strokeWidth="1.4"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {edges.map((e) => {
            const a = byId[e.from];
            const b = byId[e.to];
            if (!a || !b) return null;
            const typingHere = editEdge === e.id;
            if (!e.label && !typingHere) return null;
            const { mid } = edgePath(a, b);
            return (
              <div
                key={`l${e.id}`}
                className={`mm-edgelabel${selEdge === e.id ? " sel" : ""}`}
                style={{ left: mid.x, top: mid.y }}
                onMouseDown={(ev) => {
                  ev.stopPropagation();
                  dispatch({ type: "SELECT", target: { kind: "edge", id: e.id } });
                }}
              >
                {typingHere ? (
                  <input
                    className="mm-edgeinput"
                    autoFocus
                    value={e.label || ""}
                    style={{ width: `${Math.max(4, (e.label || "").length + 1)}ch` }}
                    onChange={(ev) =>
                      dispatch({
                        type: "EDGE_UPDATE_LABEL",
                        id: e.id,
                        label: ev.target.value,
                      })
                    }
                    onBlur={() => dispatch({ type: "STOP_EDIT" })}
                    onMouseDown={(ev) => ev.stopPropagation()}
                  />
                ) : (
                  e.label
                )}
              </div>
            );
          })}

          {boundsNodes.map((n) => {
            const isSel = sel === n.id || linkFrom === n.id;
            const isEdit = editing === n.id;
            const pad = padFor(n.shape, n.w);
            const fixed = FIXED_ASPECT.has(n.shape);
            const cls = [
              "mm-node",
              isSel ? "sel" : "",
              CENTERED.has(n.shape) ? "center" : "",
              n.type === "image" ? "imgnode" : "",
              n.type === "image" && fixed ? "clip" : "",
              n.type === "image" ? `clip-${n.shape}` : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={n.id}
                className={cls}
                style={{ left: n.x, top: n.y, width: n.w, height: fixed ? n.h : undefined }}
                onMouseDown={(e) => onNodeDown(e, n)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (n.type === "image") return;
                  dispatch({ type: "START_EDIT", target: { kind: "node", id: n.id } });
                }}
              >
                <svg className="mm-shape" viewBox={`0 0 ${n.w} ${n.h}`} preserveAspectRatio="none">
                  {shapeEl(n, isSel)}
                </svg>

                <div
                  className="mm-body"
                  ref={(el) => {
                    if (el) measured.current[n.id] = el;
                  }}
                  style={pad ? { padding: pad } : undefined}
                >
                  {n.type === "image" ? (
                    <img src={n.src} alt="" draggable={false} />
                  ) : isEdit ? (
                    <textarea
                      className="mm-edit"
                      autoFocus
                      rows={1}
                      value={n.text}
                      onChange={(e) => {
                        dispatch({
                          type: "NODE_PATCH",
                          id: n.id,
                          fields: { text: e.target.value },
                        });
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onFocus={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                        e.target.select();
                      }}
                      onBlur={() => dispatch({ type: "STOP_EDIT" })}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={!n.text ? "mm-empty" : undefined}>
                      {n.text || "untitled"}
                    </span>
                  )}

                  {n.type === "link" && !isEdit && (
                    <div className="mm-link-host">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${hostOf(n.url)}&sz=32`}
                        alt=""
                        onError={(e) => {
                          e.target.style.visibility = "hidden";
                        }}
                      />
                      <span>{hostOf(n.url)}</span>
                    </div>
                  )}
                </div>

                <div className="mm-handle" onMouseDown={(e) => onHandleDown(e, n)} />
              </div>
            );
          })}
        </div>
      </div>

      {showLanding && nodes.length === 0 && (
        <p className="mm-landing">Type anywhere to start</p>
      )}

      {selNode && !editing && !dragging && !wire && !linkFrom && (
        <div
          className="mm-shapebar"
          style={{
            left: view.x + (selNode.x + selNode.w / 2) * view.k,
            top: view.y + selNode.y * view.k - 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {SHAPES.map((s) => (
            <button
              key={s}
              className={selNode.shape === s ? "on" : ""}
              title={s}
              onClick={() => {
                dispatch({ type: "NODE_SET_SHAPE", id: selNode.id, shape: s });
                dispatch({ type: "SET_DEF_SHAPE", shape: s });
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              >
                {GLYPH[s]}
              </svg>
            </button>
          ))}
        </div>
      )}

      {showKeys && (
        <div className="mm-keys">
          <div>
            <span>New child</span>
            <b>Tab</b>
          </div>
          <div>
            <span>New sibling</span>
            <b>N</b>
          </div>
          <div>
            <span>Edit selected</span>
            <b>Enter</b>
          </div>
          <div>
            <span>Delete</span>
            <b>Backspace</b>
          </div>
          <hr />
          <div>
            <span>Shape</span>
            <b>1 – 3</b>
          </div>
          <div>
            <span>Connect</span>
            <b>shift-click</b>
          </div>
          <div>
            <span>Connect, hands free</span>
            <b>C</b>
          </div>
          <div>
            <span>Move a connection</span>
            <b>drag its end</b>
          </div>
          <div>
            <span>Name a connection</span>
            <b>select, type</b>
          </div>
          <div>
            <span>Add image or URL</span>
            <b>paste</b>
          </div>
          <hr />
          <div>
            <span>Fit to view</span>
            <b>F</b>
          </div>
          <div>
            <span>Zoom</span>
            <b>⌘ scroll</b>
          </div>
        </div>
      )}

      <div className="mm-bar">
        <div className="mm-boardtitle">
          {editingTitle ? (
            <input
              className="mm-boardtitle-input"
              autoFocus
              defaultValue={title}
              onBlur={(e) => {
                dispatch({ type: "SET_TITLE", title: e.target.value });
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dispatch({ type: "SET_TITLE", title: e.currentTarget.value });
                  setEditingTitle(false);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="mm-boardtitle-btn"
              title="Rename board"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </button>
          )}
        </div>
        <span>
          {linkFrom
            ? "Click a node to connect it. Esc to stop."
            : selEdge
              ? "Type to name this connection. Backspace deletes it."
              : `${nodes.length} nodes · ${edges.length} connections`}
        </span>
        <span className="sp" />
        <span>new nodes: {defShape}</span>
        <button
          onClick={() =>
            dispatch({
              type: "SET_DEF_SHAPE",
              shape: SHAPES[(SHAPES.indexOf(defShape) + 1) % SHAPES.length],
            })
          }
        >
          change
        </button>
        <button onClick={() => fileRef.current?.click()}>Add image</button>
        <button onClick={exportJson}>Save to file</button>
        <button onClick={() => document.getElementById("mm-import").click()}>Open file</button>
        <button onClick={() => dispatch({ type: "TOGGLE_SHOW_KEYS" })}>
          {showKeys ? "Hide keys" : "Keys"}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          loadFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        id="mm-import"
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) importJson(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
