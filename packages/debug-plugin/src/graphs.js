import { timer } from "melonjs";
import { GRAPH_HEIGHT, GRAPH_SAMPLES } from "./styles";

/**
 * Resize a canvas backing store to match its CSS layout width, clear it,
 * and return a draw context. Returns `null` if the canvas has no layout
 * width yet (e.g. panel hidden, first frame).
 * @param {HTMLCanvasElement} canvas
 * @returns {{ ctx: CanvasRenderingContext2D, w: number, h: number, barW: number } | null}
 */
function prepareGraph(canvas) {
	const w = canvas.clientWidth;
	if (w === 0) {
		return null;
	}
	if (canvas.width !== w) {
		canvas.width = w;
	}
	const ctx = canvas.getContext("2d");
	const h = GRAPH_HEIGHT;
	ctx.clearRect(0, 0, w, h);
	return { ctx, w, h, barW: w / GRAPH_SAMPLES };
}

/**
 * Round a peak value up to the nearest multiple of 4, with a floor of 4.
 * Keeps the graph y-axis stable across small fluctuations.
 * @param {number} peak
 */
function roundPeak(peak) {
	const rounded = Math.ceil(peak / 4) * 4;
	return rounded < 4 ? 4 : rounded;
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
	const g = prepareGraph(canvas);
	if (g === null) {
		return;
	}
	const { ctx, w, h, barW } = g;

	let peak = 1;
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const total = updateHistory[i] + drawHistory[i];
		if (total > peak) {
			peak = total;
		}
	}
	peak = roundPeak(peak);
	peakEl.textContent = `peak ${peak}ms`;

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
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const idx = (historyIndex + i) % GRAPH_SAMPLES;
		const updateH = (updateHistory[idx] / peak) * h;
		const drawH = (drawHistory[idx] / peak) * h;
		const x = Math.round(i * barW);
		const bw = Math.max(1, Math.round((i + 1) * barW) - x);

		if (drawH > 0) {
			ctx.fillStyle = "#ffb800";
			ctx.fillRect(x, h - drawH - updateH, bw, drawH);
		}
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
	const g = prepareGraph(canvas);
	if (g === null) {
		return;
	}
	const { ctx, w, h, barW } = g;

	let peak = 1;
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		if (memHistory[i] > peak) {
			peak = memHistory[i];
		}
	}
	peak = roundPeak(peak);
	peakEl.textContent = `peak ${peak}MB`;

	// filled area graph
	ctx.fillStyle = "rgba(198,120,221,0.3)";
	ctx.strokeStyle = "#c678dd";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, h);
	for (let i = 0; i < GRAPH_SAMPLES; i++) {
		const idx = (historyIndex + i) % GRAPH_SAMPLES;
		const y = h - (memHistory[idx] / peak) * h;
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
		const y = h - (memHistory[idx] / peak) * h;
		const x = Math.round(i * barW);
		if (i === 0) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.stroke();
}
