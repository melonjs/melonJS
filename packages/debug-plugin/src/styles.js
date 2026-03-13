import fontSource from "./font/PressStart2P.ttf";

const FONT_NAME = "PressStart2P";

export const GRAPH_HEIGHT = 30;
export const GRAPH_SAMPLES = 200;

let registered = false;

/**
 * Inject the @font-face rule and all debug panel CSS into the document.
 * Safe to call multiple times — only injects once.
 */
export function registerStyles() {
	if (registered) {
		return;
	}
	const style = document.createElement("style");
	style.textContent = `
@font-face { font-family: "${FONT_NAME}"; src: url("${fontSource}") format("truetype"); }

.dbg-wrap {
  position: fixed; pointer-events: none; z-index: 9999;
}

.dbg {
  font-family: "${FONT_NAME}", monospace; font-size: 8px; color: #b0c4d8;
  background:
    repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px),
    linear-gradient(180deg, rgba(6,8,18,0.94) 0%, rgba(10,14,28,0.92) 100%);
  border-bottom: 2px solid #1a3050;
  box-shadow: inset 0 0 0 1px rgba(40,80,140,0.3), 0 2px 8px rgba(0,0,0,0.5);
  padding: 6px 10px 5px; pointer-events: none;
  display: grid; grid-template-columns: repeat(6, auto 1fr); gap: 2px 0;
  align-items: center; line-height: 1.7;
  image-rendering: pixelated;
}

/* labels: muted steel blue, right-aligned */
.dbg .dim {
  color: #4a6a88; text-align: right; padding-right: 6px;
  white-space: nowrap; text-transform: lowercase;
}

/* values: bright cyan */
.dbg .val {
  color: #00e0ff; white-space: nowrap; padding-right: 14px;
  text-shadow: 0 0 6px rgba(0,224,255,0.2);
}

/* fps: amber accent, bold presence */
.dbg .fps-val {
  color: #ffb800; text-shadow: 0 0 6px rgba(255,184,0,0.25);
  justify-content: flex-end; white-space: nowrap;
}

/* help text */
.dbg .help {
  color: #384858; justify-content: flex-end;
  font-size: 7px; white-space: nowrap;
}

/* checkbox labels */
.dbg label {
  cursor: pointer; white-space: nowrap; pointer-events: auto;
  display: flex; align-items: center; gap: 5px;
  color: #6888a8; transition: color 0.15s;
}
.dbg label:hover { color: #00e0ff; }

/* pixel-art checkbox: NES-style toggle */
.dbg input[type=checkbox] {
  appearance: none; -webkit-appearance: none;
  width: 10px; height: 10px; margin: 0; cursor: pointer;
  border: 2px solid #2a4a6a; background: rgba(0,20,40,0.5);
  image-rendering: pixelated; flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.dbg input[type=checkbox]:hover {
  border-color: #00b8d4;
}
.dbg input[type=checkbox]:checked {
  border-color: #00e0ff; background: #00e0ff;
  box-shadow: 0 0 4px rgba(0,224,255,0.4), inset 0 0 0 1px rgba(6,8,18,0.9);
}

/* graph rows */
.dbg .graph-row {
  grid-column: 1 / span 12;
  display: flex; align-items: center; gap: 8px;
  border-top: 1px solid rgba(40,80,140,0.2);
  padding-top: 4px; margin-top: 2px;
}
.dbg .graph-row canvas {
  flex: 1; min-width: 0; height: ${GRAPH_HEIGHT}px;
  image-rendering: pixelated;
  border: 1px solid #1a3050;
  background: rgba(0,0,0,0.35);
  box-shadow: 0 0 4px rgba(0,0,0,0.3);
}
.dbg .graph-label {
  font-size: 7px; color: #384858; white-space: nowrap;
  display: flex; flex-direction: column; gap: 2px; min-width: 70px;
}
.dbg .graph-label .update-color { color: #00e0ff; }
.dbg .graph-label .draw-color { color: #ffb800; }
.dbg .graph-label .mem-color { color: #c678dd; }
`;
	document.head.appendChild(style);
	registered = true;
}
