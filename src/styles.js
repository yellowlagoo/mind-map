/* ------------------------------------------------------------------ */
/*  tokens                                                             */
/* ------------------------------------------------------------------ */

export const CSS = `
.mm-root {
  --bg:        #12151b;
  --dot:       #212630;
  --line:      #39404c;
  --ink:       #e2e0da;
  --ink-dim:   #7d8493;
  --ink-faint: #565d6b;
  --sage:      #8fafa4;
  --sage-dim:  #4a6058;

  position: absolute; inset: 0;
  background: var(--bg);
  color: var(--ink);
  overflow: hidden;
  font-family: ui-sans-serif, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
.mm-surface { position:absolute; inset:0; cursor: grab; }
.mm-surface.panning { cursor: grabbing; }
.mm-root.arming .mm-node { cursor: crosshair; }
.mm-world { position:absolute; top:0; left:0; transform-origin: 0 0; }

.mm-node { position:absolute; }
.mm-shape { position:absolute; inset:0; overflow:visible; pointer-events:none; }

.mm-body {
  position:relative;
  font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  font-size: 15px; line-height: 1.45; color: var(--ink);
  padding: 9px 12px; overflow-wrap: break-word;
}
.mm-node.center .mm-body {
  height:100%; display:flex; flex-direction:column;
  align-items:center; justify-content:center; text-align:center;
}
.mm-node.imgnode .mm-body { padding:0; line-height:0; }
.mm-body img { width:100%; display:block; }
.mm-node.clip .mm-body img { height:100%; object-fit:cover; }
.mm-node.clip-circle .mm-body img { border-radius:50%; }
.mm-node.clip-diamond .mm-body img { clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%); }
.mm-node.clip-round .mm-body img { border-radius:10px; }
.mm-empty { color: var(--ink-faint); font-style: italic; }

.mm-link-host {
  font-family: ui-sans-serif, -apple-system, sans-serif;
  font-size: 11px; color: var(--ink-dim);
  display:flex; align-items:center; gap:6px; margin-top:7px; max-width:100%;
}
.mm-node.center .mm-link-host { justify-content:center; }
.mm-link-host img { width:13px; height:13px; border-radius:2px; flex:none; }
.mm-link-host span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.mm-edit {
  width:100%; background:transparent; border:0; outline:0; resize:none;
  color: var(--ink); font: inherit; padding:0; margin:0;
  overflow:hidden; display:block;
}
.mm-node.center .mm-edit { text-align:center; }

.mm-handle {
  position:absolute; width:9px; height:9px; border-radius:50%;
  background: var(--bg); border:1.5px solid var(--sage);
  right:-6px; top:50%; margin-top:-5px;
  opacity:0; transition: opacity .12s ease; cursor: crosshair; z-index:3;
}
.mm-node:hover .mm-handle, .mm-node.sel .mm-handle { opacity:1; }

.mm-shapebar {
  position:absolute; transform: translate(-50%, -100%);
  display:flex; gap:2px; padding:4px;
  background: #171b22; border:1px solid #2a3038; border-radius:4px;
  z-index: 20;
}
.mm-shapebar button {
  width:26px; height:26px; display:grid; place-items:center;
  background:none; border:0; border-radius:3px; cursor:pointer; color: var(--ink-faint);
}
.mm-shapebar button:hover { background:#212730; color: var(--ink-dim); }
.mm-shapebar button.on { color: var(--sage); background:#1d2a27; }

.mm-edgelabel {
  position:absolute; transform: translate(-50%,-50%);
  background: var(--bg); padding: 1px 6px; border-radius:2px;
  font-size:10px; color: var(--ink-dim); white-space:nowrap;
  font-family: ui-sans-serif, sans-serif; cursor:pointer;
}
.mm-edgelabel.sel { color: var(--sage); }
.mm-edgeinput {
  background:transparent; border:0; outline:0; padding:0; margin:0;
  color: var(--sage); font: inherit; font-family: ui-sans-serif, sans-serif;
  min-width:4ch; text-align:center;
}

.mm-bar {
  position:absolute; left:18px; bottom:16px; right:18px;
  display:flex; gap:18px; align-items:center;
  font-size:11px; color: var(--ink-faint);
}
.mm-bar button {
  background:none; border:0; color: var(--ink-faint); font:inherit;
  cursor:pointer; padding:0; letter-spacing:.01em;
}
.mm-bar button:hover { color: var(--ink-dim); }
.mm-bar .sp { flex:1; }

.mm-keys {
  position:absolute; right:18px; top:16px;
  background:#171b22; border:1px solid #2a3038;
  border-radius:3px; padding:14px 16px; font-size:11px;
  color: var(--ink-dim); line-height:1.9; min-width:214px;
}
.mm-keys div { display:flex; justify-content:space-between; gap:24px; }
.mm-keys b { color: var(--ink); font-weight:500; font-variant-numeric: tabular-nums; }
.mm-keys hr { border:0; border-top:1px solid #2a3038; margin:9px 0; }

@media (prefers-reduced-motion: reduce) { .mm-handle { transition:none; } }
`;