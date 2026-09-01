import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";

import { CSS } from "./styles";
import { NODE_W, IMG_W, GAP_X, GAP_Y } from "./constants";
import { SHAPES, FIXED_ASPECT, CENTERED, GLYPH, aspectSize, padFor } from "./shapes";
import { hostOf, titleFromUrl, edgePath } from "./geometry";
import { seed, uid, resetIds } from "./seed";

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */

export default function MindMap() {
  const init = useRef(seed());
  const [nodes, setNodes] = useState(init.current.nodes);
  const [edges, setEdges] = useState(init.current.edges);
  const [sel, setSel] = useState(null);
  const [selEdge, setSelEdge] = useState(null);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [wire, setWire] = useState(null);
  const [showKeys, setShowKeys] = useState(true);
  const [defShape, setDefShape] = useState("plain");
  const [linkFrom, setLinkFrom] = useState(null);   // armed connect mode
  const [cursor, setCursor] = useState(null);       // world point, for the live line
  const [hoverEdge, setHoverEdge] = useState(null);
  const [rewire, setRewire] = useState(null);       // { id, end: "from" | "to", x, y }
  const [editEdge, setEditEdge] = useState(null);   // edge id whose label is being typed

  const surfaceRef = useRef(null);
  const measured = useRef({});
  const viewRef = useRef(view); viewRef.current = view;
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const fileRef = useRef(null);

  const toWorld = useCallback((sx, sy) => {
    const r = surfaceRef.current.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (sx - r.left - v.x) / v.k, y: (sy - r.top - v.y) / v.k };
  }, []);

  const centerWorld = useCallback(() => {
    const r = surfaceRef.current.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }, [toWorld]);

  /* fixed-aspect nodes size themselves; free ones measure their content.
     NOTE: no dependency array on purpose — this has to run after every
     render, and the 0.5 epsilon below is what stops it looping. */
  useLayoutEffect(() => {
    let changed = false;
    const next = nodes.map((n) => {
      if (FIXED_ASPECT.has(n.shape)) {
        const s = aspectSize(n);
        if (Math.abs(s - n.w) > 0.5 || Math.abs(s - n.h) > 0.5) { changed = true; return { ...n, w: s, h: s }; }
        return n;
      }
      const el = measured.current[n.id];
      if (!el) return n;
      const h = el.offsetHeight;
      if (h && Math.abs(h - n.h) > 0.5) { changed = true; return { ...n, h }; }
      return n;
    });
    if (changed) setNodes(next);
  });

  const patch = (id, fields) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...fields } : n)));

  const setShape = (id, shape) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      if (FIXED_ASPECT.has(shape)) {
        const s = aspectSize({ ...n, shape });
        return { ...n, shape, w: s, h: s };
      }
      return { ...n, shape, w: n.type === "image" ? IMG_W : NODE_W };
    }));
  };

  const connect = (from, to) => {
    if (!from || !to || from === to) return;
    setEdges((es) =>
      es.some((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from))
        ? es
        : [...es, { id: `e${from}-${to}-${Date.now()}`, from, to, label: "" }]);
  };

  const collides = (box, list) =>
    list.some((n) =>
      box.x < n.x + n.w + 14 && box.x + box.w + 14 > n.x &&
      box.y < n.y + n.h + 10 && box.y + box.h + 10 > n.y);

  const freeSpot = (x, y, w, h, list) => {
    let ty = y, guard = 0;
    while (collides({ x, y: ty, w, h }, list) && guard++ < 80) ty += h + GAP_Y;
    return { x, y: ty };
  };

  const addNode = (partial, connectFrom) => {
    const shape = partial.shape || defShape;
    const base = { id: uid(), type: "text", shape, text: "", w: NODE_W, h: 42, ...partial, shape };
    if (FIXED_ASPECT.has(shape)) { const s = aspectSize(base); base.w = s; base.h = s; }
    setNodes((ns) => [...ns, base]);
    if (connectFrom) setEdges((es) => [...es, { id: `e${base.id}`, from: connectFrom, to: base.id, label: "" }]);
    setSel(base.id); setSelEdge(null);
    if (base.type === "text") setEditing(base.id);
    return base;
  };

  const addChild = () => {
    const p = nodesRef.current.find((n) => n.id === sel);
    if (!p) return;
    const w = FIXED_ASPECT.has(defShape) ? 128 : NODE_W;
    const spot = freeSpot(p.x + p.w + GAP_X, p.y, w, 42, nodesRef.current);
    addNode(spot, p.id);
  };

  const addSibling = () => {
    const c = nodesRef.current.find((n) => n.id === sel);
    if (!c) return;
    const pe = edges.find((e) => e.to === c.id);
    const w = FIXED_ASPECT.has(defShape) ? 128 : NODE_W;
    const spot = freeSpot(c.x, c.y + c.h + GAP_Y, w, 42, nodesRef.current);
    addNode(spot, pe ? pe.from : null);
  };

  const removeNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.from !== id && e.to !== id));
    setSel(null);
  };

  /* ---------- keyboard ---------- */
  /* NOTE: no dependency array on purpose — re-subscribing every render is
     how this handler always sees the current sel / nodes / edges. */
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT";
      if (typing) {
        if (e.key === "Escape") { e.preventDefault(); setEditing(null); setEditEdge(null); }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setEditing(null); setEditEdge(null); }
        if (e.key === "Tab" && !editEdge) { e.preventDefault(); setEditing(null); setTimeout(addChild, 0); }
        return;
      }
      if (e.key === "Tab") { e.preventDefault(); addChild(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selEdge) { setEditEdge(selEdge); return; }
        if (sel && nodes.find((n) => n.id === sel)?.type !== "image") setEditing(sel);
        return;
      }
      if (e.key === "Escape") { setLinkFrom(null); setEditEdge(null); setSel(null); setSelEdge(null); return; }
      if (e.key === "c") {
        e.preventDefault();
        setLinkFrom((f) => (f ? null : sel));
        return;
      }
      if (e.key === "?") { setShowKeys((s) => !s); return; }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (selEdge) { setEdges((es) => es.filter((x) => x.id !== selEdge)); setSelEdge(null); }
        else if (sel) removeNode(sel);
        return;
      }
      if (selEdge && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEdges((es) => es.map((x) => (x.id === selEdge ? { ...x, label: (x.label || "") + e.key } : x)));
        setEditEdge(selEdge);
        return;
      }
      if (e.key >= "1" && e.key <= "6") {
        const shape = SHAPES[Number(e.key) - 1];
        if (sel) setShape(sel, shape); else setDefShape(shape);
        return;
      }
      if (e.key === "n" && sel) { e.preventDefault(); addSibling(); return; }
      if (e.key === "f") { e.preventDefault(); fit(); return; }
      if (e.key === "=" || e.key === "+") { setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.15) })); return; }
      if (e.key === "-") { setView((v) => ({ ...v, k: Math.max(0.2, v.k / 1.15) })); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- paste ---------- */
  /* NOTE: no dependency array on purpose — see the keyboard effect above. */
  useEffect(() => {
    const onPaste = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      const c = centerWorld();
      const items = [...(e.clipboardData?.items || [])];
      const img = items.find((i) => i.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        const rd = new FileReader();
        rd.onload = () => addNode({ type: "image", src: rd.result, x: c.x - IMG_W / 2, y: c.y - 60, w: IMG_W, h: 160 });
        rd.readAsDataURL(img.getAsFile());
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;
      e.preventDefault();
      if (/^https?:\/\//i.test(text)) {
        addNode({ type: "link", url: text, text: titleFromUrl(text), x: c.x - NODE_W / 2, y: c.y - 30, h: 62 });
      } else {
        addNode({ type: "text", text, x: c.x - NODE_W / 2, y: c.y - 20 });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const onDrop = (e) => {
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    [...e.dataTransfer.files].forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      const rd = new FileReader();
      rd.onload = () => addNode({ type: "image", src: rd.result, x: p.x + i * 24, y: p.y + i * 24, w: IMG_W, h: 160 });
      rd.readAsDataURL(file);
    });
  };

  const loadFiles = (list) => {
    const c = centerWorld();
    [...list].forEach((file, i) => {
      if (!file.type.startsWith("image/")) return;
      const rd = new FileReader();
      rd.onload = () => addNode({ type: "image", src: rd.result, x: c.x + i * 24, y: c.y + i * 24, w: IMG_W, h: 160 });
      rd.readAsDataURL(file);
    });
  };

  /* ---------- pan / zoom ---------- */
  const onSurfaceDown = (e) => {
    if (e.target.closest(".mm-node") || e.target.closest(".mm-edgelabel") || e.target.closest(".mm-shapebar")) return;
    setSel(null); setSelEdge(null); setEditing(null);
    setPanning(true);
    const s = { mx: e.clientX, my: e.clientY, vx: view.x, vy: view.y };
    const move = (ev) => setView((v) => ({ ...v, x: s.vx + ev.clientX - s.mx, y: s.vy + ev.clientY - s.my }));
    const up = () => {
      setPanning(false);
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const r = surfaceRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0022)));
        return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) };
      });
    } else {
      setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    }
  };

  const fit = () => {
    const ns = nodesRef.current;
    if (!ns.length) return;
    const r = surfaceRef.current.getBoundingClientRect();
    const x0 = Math.min(...ns.map((n) => n.x)), y0 = Math.min(...ns.map((n) => n.y));
    const x1 = Math.max(...ns.map((n) => n.x + n.w)), y1 = Math.max(...ns.map((n) => n.y + n.h));
    const pad = 100;
    const k = Math.min(1.35, (r.width - pad * 2) / (x1 - x0 || 1), (r.height - pad * 2) / (y1 - y0 || 1));
    setView({ k, x: r.width / 2 - ((x0 + x1) / 2) * k, y: r.height / 2 - ((y0 + y1) / 2) * k });
  };

  useEffect(() => { const t = setTimeout(fit, 40); return () => clearTimeout(t); }, []);

  /* ---------- node drag ---------- */
  const onNodeDown = (e, n) => {
    if (e.target.classList.contains("mm-handle")) return;
    e.stopPropagation();

    /* armed connect mode: one click lands the connection */
    if (linkFrom && linkFrom !== n.id) {
      connect(linkFrom, n.id);
      setLinkFrom(null); setSel(n.id);
      return;
    }
    /* shift-click: connect from whatever is already selected */
    if (e.shiftKey && sel && sel !== n.id) {
      connect(sel, n.id);
      return;
    }

    setSel(n.id); setSelEdge(null); setEditEdge(null);
    if (editing && editing !== n.id) setEditing(null);
    const s = { mx: e.clientX, my: e.clientY, nx: n.x, ny: n.y };
    let moved = false;
    const move = (ev) => {
      const k = viewRef.current.k;
      const dx = (ev.clientX - s.mx) / k, dy = (ev.clientY - s.my) / k;
      if (Math.abs(dx) + Math.abs(dy) > 2) { moved = true; setDragging(true); }
      if (moved) patch(n.id, { x: s.nx + dx, y: s.ny + dy });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  /* grab either end of an edge and put it somewhere else */
  const onEndDown = (e, edge, end) => {
    e.stopPropagation(); e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    setRewire({ id: edge.id, end, x: p.x, y: p.y });
    setSelEdge(edge.id); setSel(null);

    const move = (ev) => {
      const q = toWorld(ev.clientX, ev.clientY);
      setRewire({ id: edge.id, end, x: q.x, y: q.y });
    };
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const q = toWorld(ev.clientX, ev.clientY);
      const hit = nodesRef.current.find(
        (m) => q.x >= m.x && q.x <= m.x + m.w && q.y >= m.y && q.y <= m.y + m.h);
      const anchor = end === "from" ? edge.to : edge.from;
      /* dropping on nothing, on itself, or on a duplicate just snaps back */
      if (hit && hit.id !== anchor) {
        setEdges((es) => {
          const dupe = es.some((x) =>
            x.id !== edge.id &&
            ((x.from === hit.id && x.to === anchor) || (x.from === anchor && x.to === hit.id)));
          if (dupe) return es;
          return es.map((x) => (x.id === edge.id ? { ...x, [end]: hit.id } : x));
        });
      }
      setRewire(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onHandleDown = (e, n) => {
    e.stopPropagation(); e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    setWire({ from: n.id, x: p.x, y: p.y });
    const move = (ev) => { const q = toWorld(ev.clientX, ev.clientY); setWire({ from: n.id, x: q.x, y: q.y }); };
    const up = (ev) => {
      window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
      const q = toWorld(ev.clientX, ev.clientY);
      const hit = nodesRef.current.find((m) => m.id !== n.id && q.x >= m.x && q.x <= m.x + m.w && q.y >= m.y && q.y <= m.y + m.h);
      if (hit) {
        setEdges((es) =>
          es.some((x) => (x.from === n.id && x.to === hit.id) || (x.from === hit.id && x.to === n.id))
            ? es : [...es, { id: `e${n.id}-${hit.id}-${Date.now()}`, from: n.id, to: hit.id, label: "" }]);
      } else {
        addNode({ x: q.x, y: q.y - 20 }, n.id);
      }
      setWire(null);
    };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  /* ---------- files ---------- */
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "map.json"; a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file) => {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!Array.isArray(data.nodes)) return;
        setNodes(data.nodes.map((n) => ({ shape: "plain", ...n })));
        setEdges(data.edges || []);
        resetIds(data.nodes.length + 1000);
        setTimeout(fit, 40);
      } catch { /* malformed file, leave the map alone */ }
    };
    rd.readAsText(file);
  };

  /* ---------- render ---------- */
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const wireFrom = wire ? byId[wire.from] : null;
  const dot = 26 * view.k;
  const selNode = sel ? byId[sel] : null;

  const shapeEl = (n, on) => {
    const stroke = on ? "var(--sage)" : n.shape === "plain" ? "transparent" : "var(--line)";
    const common = {
      fill: "none", stroke, strokeWidth: 1.2,
      vectorEffect: "non-scaling-stroke",
      strokeDasharray: n.shape === "plain" ? "3 4" : undefined,
    };
    const w = n.w, h = n.h;
    if (n.shape === "circle") return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} {...common} />;
    if (n.shape === "diamond") return <path d={`M ${w / 2} 1 L ${w - 1} ${h / 2} L ${w / 2} ${h - 1} L 1 ${h / 2} Z`} {...common} />;
    const rx = n.shape === "round" ? 10 : n.shape === "plain" ? 4 : 2;
    return <rect x={1} y={1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={rx} {...common} />;
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
        onMouseMove={(e) => { if (linkFrom) setCursor(toWorld(e.clientX, e.clientY)); }}
        onWheel={onWheel}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onDoubleClick={(e) => {
          if (e.target.closest(".mm-node") || e.target.closest(".mm-edgelabel")) return;
          if (e.target.tagName === "path" || e.target.tagName === "circle") return;
          const p = toWorld(e.clientX, e.clientY);
          addNode({ x: p.x - NODE_W / 2, y: p.y - 20 });
        }}
      >
        <div className="mm-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg style={{ position: "absolute", overflow: "visible", pointerEvents: "none", width: 1, height: 1 }}>
            {edges.map((e) => {
              let a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              if (rewire && rewire.id === e.id) {
                const loose = { x: rewire.x, y: rewire.y, w: 1, h: 1, shape: "rect" };
                if (rewire.end === "from") a = loose; else b = loose;
              }
              const on = selEdge === e.id || hoverEdge === e.id || sel === e.from || sel === e.to;
              const live = rewire && rewire.id === e.id;
              return (
                <g key={e.id}>
                  {/* a wide transparent copy, so a 1px line is still easy to hit */}
                  <path
                    d={edgePath(a, b).d} fill="none" stroke="transparent" strokeWidth="16"
                    style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onMouseEnter={() => setHoverEdge(e.id)}
                    onMouseLeave={() => setHoverEdge((h) => (h === e.id ? null : h))}
                    onMouseDown={(ev) => { ev.stopPropagation(); if (editEdge !== e.id) setEditEdge(null); setSelEdge(e.id); setSel(null); }}
                  />
                  <path
                    d={edgePath(a, b).d} fill="none"
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
              const a = byId[e.from], b = byId[e.to];
              if (!a || !b) return null;
              const live = rewire && rewire.id === e.id;
              const shown = selEdge === e.id || hoverEdge === e.id || live;
              if (!shown || panning) return null;
              const { p, q } = edgePath(a, b);
              const r = 4.5 / view.k;
              const ends = [
                { pt: p, end: "from", hide: live && rewire.end === "from" },
                { pt: q, end: "to",   hide: live && rewire.end === "to" },
              ];
              return (
                <g key={`h${e.id}`}>
                  {ends.map(({ pt, end, hide }) =>
                    hide ? null : (
                      <circle
                        key={end} cx={pt.x} cy={pt.y} r={r}
                        fill="var(--bg)" stroke="var(--sage)" strokeWidth="1.4"
                        vectorEffect="non-scaling-stroke"
                        style={{ pointerEvents: "all", cursor: "move" }}
                        onMouseEnter={() => setHoverEdge(e.id)}
                        onMouseDown={(ev) => onEndDown(ev, e, end)}
                      />
                    ))}
                </g>
              );
            })}
            {linkFrom && cursor && byId[linkFrom] && (
              <path
                d={edgePath(byId[linkFrom], { x: cursor.x, y: cursor.y, w: 1, h: 1, shape: "rect" }).d}
                fill="none" stroke="var(--sage-dim)" strokeWidth="1.4"
                strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
              />
            )}
            {wire && wireFrom && (
              <path
                d={edgePath(wireFrom, { x: wire.x, y: wire.y, w: 1, h: 1, shape: "rect" }).d}
                fill="none" stroke="var(--sage-dim)" strokeWidth="1.4"
                strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {edges.map((e) => {
            const a = byId[e.from], b = byId[e.to];
            if (!a || !b) return null;
            const typingHere = editEdge === e.id;
            if (!e.label && !typingHere) return null;
            const { mid } = edgePath(a, b);
            return (
              <div
                key={`l${e.id}`}
                className={`mm-edgelabel${selEdge === e.id ? " sel" : ""}`}
                style={{ left: mid.x, top: mid.y }}
                onMouseDown={(ev) => { ev.stopPropagation(); setSelEdge(e.id); setSel(null); }}
              >
                {typingHere ? (
                  <input
                    className="mm-edgeinput" autoFocus value={e.label || ""}
                    style={{ width: `${Math.max(4, (e.label || "").length + 1)}ch` }}
                    onChange={(ev) =>
                      setEdges((es) => es.map((x) => (x.id === e.id ? { ...x, label: ev.target.value } : x)))}
                    onBlur={() => setEditEdge(null)}
                    onMouseDown={(ev) => ev.stopPropagation()}
                  />
                ) : (
                  e.label
                )}
              </div>
            );
          })}

          {nodes.map((n) => {
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
            ].filter(Boolean).join(" ");

            return (
              <div
                key={n.id}
                className={cls}
                style={{ left: n.x, top: n.y, width: n.w, height: fixed ? n.h : undefined }}
                onMouseDown={(e) => onNodeDown(e, n)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (n.type === "image") return;
                  setEditing(n.id);
                }}
              >
                <svg className="mm-shape" viewBox={`0 0 ${n.w} ${n.h}`} preserveAspectRatio="none">
                  {shapeEl(n, isSel)}
                </svg>

                <div
                  className="mm-body"
                  ref={(el) => { if (el) measured.current[n.id] = el; }}
                  style={pad ? { padding: pad } : undefined}
                >
                  {n.type === "image" ? (
                    <img src={n.src} alt="" draggable={false} />
                  ) : isEdit ? (
                    <textarea
                      className="mm-edit" autoFocus rows={1} value={n.text}
                      onChange={(e) => {
                        patch(n.id, { text: e.target.value });
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      onFocus={(e) => {
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                        e.target.select();
                      }}
                      onBlur={() => setEditing(null)}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={!n.text ? "mm-empty" : undefined}>{n.text || "untitled"}</span>
                  )}

                  {n.type === "link" && !isEdit && (
                    <div className="mm-link-host">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${hostOf(n.url)}&sz=32`}
                        alt="" onError={(e) => (e.target.style.visibility = "hidden")}
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
              key={s} className={selNode.shape === s ? "on" : ""} title={s}
              onClick={() => { setShape(selNode.id, s); setDefShape(s); }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                {GLYPH[s]}
              </svg>
            </button>
          ))}
        </div>
      )}

      {showKeys && (
        <div className="mm-keys">
          <div><span>New child</span><b>Tab</b></div>
          <div><span>New sibling</span><b>N</b></div>
          <div><span>Edit selected</span><b>Enter</b></div>
          <div><span>Delete</span><b>Backspace</b></div>
          <hr />
          <div><span>Shape</span><b>1 – 6</b></div>
          <div><span>Connect</span><b>shift-click</b></div>
          <div><span>Connect, hands free</span><b>C</b></div>
          <div><span>Move a connection</span><b>drag its end</b></div>
          <div><span>Name a connection</span><b>select, type</b></div>
          <div><span>Add image or URL</span><b>paste</b></div>
          <hr />
          <div><span>Fit to view</span><b>F</b></div>
          <div><span>Zoom</span><b>⌘ scroll</b></div>
        </div>
      )}

      <div className="mm-bar">
        <span>
          {linkFrom
            ? "Click a node to connect it. Esc to stop."
            : selEdge
            ? "Type to name this connection. Backspace deletes it."
            : `${nodes.length} nodes · ${edges.length} connections`}
        </span>
        <span className="sp" />
        <span>new nodes: {defShape}</span>
        <button onClick={() => setDefShape(SHAPES[(SHAPES.indexOf(defShape) + 1) % SHAPES.length])}>change</button>
        <button onClick={() => fileRef.current?.click()}>Add image</button>
        <button onClick={exportJson}>Save to file</button>
        <button onClick={() => document.getElementById("mm-import").click()}>Open file</button>
        <button onClick={() => setShowKeys((s) => !s)}>{showKeys ? "Hide keys" : "Keys"}</button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
             onChange={(e) => { loadFiles(e.target.files); e.target.value = ""; }} />
      <input id="mm-import" type="file" accept="application/json" style={{ display: "none" }}
             onChange={(e) => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}