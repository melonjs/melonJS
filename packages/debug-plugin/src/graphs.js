import { timer } from "melonjs";
import { GRAPH_HEIGHT, GRAPH_SAMPLES } from "./styles";

/**
 * Resize a canvas backing store to match its CSS layout width.
 * @param {HTMLCanvasElement} canvas
 */
function fitCanvas(canvas) {
	const w = canvas.clientWidth;
	if (w > 0 && canvas.width !== w) {
		canvas.width = w;
	}
}

/**
 * Draw the stacked frame-time sparkline (update + draw).
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array} updateHistory
 * @param {Float32Array} drawHistory
 * @param {number} historyIndex - current write position in the ring buffer
 * @param {HTMLElement} peakEl - element to display peak value
 */
export function drawFrameGraph(
	canvas,
	updateHistory,
	drawHistory,
	historyIndex,
	peakEl,
) {
	fitCanvas(canvas);
	const ctx = canvas.getContext("2d");
	const w = canvas.width;
	const h = GRAPH_HEIGHT;
	if (w === 0) {
		return;
	}

	// find peak for scaling
	let peak = 1;
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const total = updateHistory[i] + drawHistory[i];
		if (total > peak) {
			peak = total;
		}
	}
	peak = Math.ceil(peak / 4) * 4;
	if (peak < 4) {
		peak = 4;
	}

	peakEl.textContent = `peak ${peak}ms`;

	ctx.clearRect(0, 0, w, h);

	// target frame time line (e.g. 16.67ms for 60fps)
	const targetMs = 1000 / timer.maxfps;
	const targetY = h - (targetMs / peak) * h;
	if (targetY > 0 && targetY < h) {
		ctx.strokeStyle = "rgba(40,80,140,0.5)";
		ctx.setLineDash([2, 2]);
		ctx.beginPath();
		ctx.moveTo(0, targetY);
		ctx.lineTo(w, targetY);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// stacked bars: draw (amber) on bottom, update (cyan) on top
	const barW = w / GRAPH_SAMPLES;
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const idx = (historyIndex + i) % GRAPH_SAMPLES;
		const updateVal = updateHistory[idx];
		const drawVal = drawHistory[idx];
		const updateH = (updateVal / peak) * h;
		const drawH = (drawVal / peak) * h;
		const x = Math.round(i * barW);
		const bw = Math.max(1, Math.round((i + 1) * barW) - x);

		// draw time on bottom (amber)
		if (drawH > 0) {
			ctx.fillStyle = "#ffb800";
			ctx.fillRect(x, h - drawH - updateH, bw, drawH);
		}
		// update time on top (cyan)
		if (updateH > 0) {
			ctx.fillStyle = "#00e0ff";
			ctx.fillRect(x, h - updateH, bw, updateH);
		}
	}
}

/**
 * Draw the memory heap area graph.
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array} memHistory - heap usage in MB
 * @param {number} historyIndex - current write position in the ring buffer
 * @param {HTMLElement} peakEl - element to display peak value
 */
export function drawMemGraph(canvas, memHistory, historyIndex, peakEl) {
	fitCanvas(canvas);
	const ctx = canvas.getContext("2d");
	const w = canvas.width;
	const h = GRAPH_HEIGHT;
	if (w === 0) {
		return;
	}

	// find peak memory for scaling
	let peak = 1;
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		if (memHistory[i] > peak) {
			peak = memHistory[i];
		}
	}
	peak = Math.ceil(peak / 4) * 4;
	if (peak < 4) {
		peak = 4;
	}

	peakEl.textContent = `peak ${peak}MB`;

	ctx.clearRect(0, 0, w, h);

	// filled area graph
	const barW = w / GRAPH_SAMPLES;
	ctx.fillStyle = "rgba(198,120,221,0.3)";
	ctx.strokeStyle = "#c678dd";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, h);
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const idx = (historyIndex + i) % GRAPH_SAMPLES;
		const val = memHistory[idx];
		const y = h - (val / peak) * h;
		const x = Math.round(i * barW);
		ctx.lineTo(x, y);
	}
	ctx.lineTo(w, h);
	ctx.closePath();
	ctx.fill();

	// stroke the top edge
	ctx.beginPath();
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const idx = (historyIndex + i) % GRAPH_SAMPLES;
		const val = memHistory[idx];
		const y = h - (val / peak) * h;
		const x = Math.round(i * barW);
		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.stroke();
}
