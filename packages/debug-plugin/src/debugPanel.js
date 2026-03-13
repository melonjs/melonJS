import { event, game, pool, timer, utils, video } from "melonjs";

import Counters from "./counters";
import { drawFrameGraph, drawMemGraph } from "./graphs";
import { applyPatches } from "./patches";
import { GRAPH_HEIGHT, GRAPH_SAMPLES, registerStyles } from "./styles";

export class DebugPanel {
	constructor(debugToggle) {
		this.counters = new Counters([
			"shapes",
			"sprites",
			"velocity",
			"bounds",
			"children",
		]);

		this.visible = false;
		this.version = "__VERSION__";
		this.debugToggle = debugToggle;

		// checkbox state
		const hash = utils.getUriFragment();
		this.options = {
			hitbox: hash.hitbox || false,
			velocity: hash.velocity || false,
			quadtree: hash.quadtree || false,
		};

		// frame time history for the sparkline graphs
		this.updateHistory = new Float32Array(GRAPH_SAMPLES);
		this.drawHistory = new Float32Array(GRAPH_SAMPLES);
		this.memHistory = new Float32Array(GRAPH_SAMPLES);
		this.historyIndex = 0;

		// register the web font / CSS and build the HTML overlay
		registerStyles();
		this.panel = null;
		this.panelWrap = null;
		this.stats = {};
		this._buildPanel();

		// frame timing
		this.frameUpdateStartTime = 0;
		this.frameDrawStartTime = 0;
		this.frameUpdateTime = 0;
		this.frameDrawTime = 0;

		// event listener references for cleanup
		this._onResize = () => {
			this._syncPosition();
		};
		this._onBeforeUpdate = (time) => {
			this.frameUpdateStartTime = time;
		};
		this._onAfterUpdate = (time) => {
			this.frameUpdateTime = time - this.frameUpdateStartTime;
			if (this.visible) {
				timer.countFPS();
			}
		};
		this._onBeforeDraw = (time) => {
			this.frameDrawStartTime = time;
			this.counters.reset();
		};
		this._onAfterDraw = (time) => {
			this.frameDrawTime = time - this.frameDrawStartTime;
			if (this.visible) {
				this._updatePanel();
				this._drawQuadTree();
			}
		};

		event.on(event.CANVAS_ONRESIZE, this._onResize);
		event.on(event.GAME_BEFORE_UPDATE, this._onBeforeUpdate);
		event.on(event.GAME_AFTER_UPDATE, this._onAfterUpdate);
		event.on(event.GAME_BEFORE_DRAW, this._onBeforeDraw);
		event.on(event.GAME_AFTER_DRAW, this._onAfterDraw);

		applyPatches(this);
	}

	/** @private */
	_buildPanel() {
		this.panelWrap = document.createElement("div");
		this.panelWrap.className = "dbg-wrap";

		this.panel = document.createElement("div");
		this.panel.className = "dbg";
		this.panelWrap.appendChild(this.panel);
		this.panelWrap.style.display = "none";

		// helper to create a stat as two grid cells: label | value
		const stat = (id, label) => {
			const dimEl = document.createElement("span");
			dimEl.className = "dim";
			dimEl.textContent = label;
			const valEl = document.createElement("span");
			valEl.className = "val";
			valEl.textContent = "0";
			this.stats[id] = valEl;
			return [dimEl, valEl];
		};

		// helper to create a checkbox label
		const checkbox = (key, label) => {
			const el = document.createElement("label");
			const cb = document.createElement("input");
			cb.type = "checkbox";
			cb.checked = this.options[key];
			cb.addEventListener("change", () => {
				this.options[key] = cb.checked;
				game.repaint();
			});
			el.appendChild(cb);
			el.appendChild(document.createTextNode(label));
			return el;
		};

		const toggleKey = String.fromCharCode(32 + this.debugToggle);

		// helper to append a stat (two grid cells) or a single element spanning 2 columns
		const addStat = (id, label) => {
			const [dimEl, valEl] = stat(id, label);
			this.panel.appendChild(dimEl);
			this.panel.appendChild(valEl);
		};
		const addSpan2 = (el) => {
			el.style.gridColumn = "span 2";
			this.panel.appendChild(el);
		};

		// row 1
		addStat("objects", "#objects");
		addSpan2(checkbox("hitbox", "hitbox"));
		addSpan2(checkbox("quadtree", "quadtree"));
		addStat("update", "Update");
		addStat("heap", "Heap");
		const fpsEl = document.createElement("span");
		fpsEl.className = "fps-val";
		this.stats.fps = fpsEl;
		addSpan2(fpsEl);

		// row 2
		addStat("draws", "#draws");
		addSpan2(checkbox("velocity", "velocity"));
		addSpan2(document.createElement("span"));
		addStat("draw", "Draw");
		addStat("pool", "Pool");
		addSpan2(document.createElement("span"));

		// row 3
		addStat("shapes", "Shapes");
		addStat("sprites", "Sprites");
		addStat("velocity_count", "Velocity");
		addStat("bounds", "Bounds");
		addStat("children", "Children");
		const helpEl = document.createElement("span");
		helpEl.className = "help";
		helpEl.textContent = `[${toggleKey}] show/hide`;
		addSpan2(helpEl);

		// row 4: frame time graph (full width)
		const frameRow = document.createElement("div");
		frameRow.className = "graph-row";

		this.graphCanvas = document.createElement("canvas");
		this.graphCanvas.height = GRAPH_HEIGHT;
		frameRow.appendChild(this.graphCanvas);

		const frameLegend = document.createElement("div");
		frameLegend.className = "graph-label";
		const peakEl = document.createElement("span");
		this.stats.peak = peakEl;
		frameLegend.innerHTML = `<span class="update-color">&#9644; update</span><span class="draw-color">&#9644; draw</span>`;
		frameLegend.appendChild(peakEl);
		frameRow.appendChild(frameLegend);
		this.panel.appendChild(frameRow);

		// row 5: memory graph (full width, Chrome only)
		if (window.performance?.memory) {
			const memRow = document.createElement("div");
			memRow.className = "graph-row";

			this.memCanvas = document.createElement("canvas");
			this.memCanvas.height = GRAPH_HEIGHT;
			memRow.appendChild(this.memCanvas);

			const memLegend = document.createElement("div");
			memLegend.className = "graph-label";
			const memPeakEl = document.createElement("span");
			this.stats.memPeak = memPeakEl;
			memLegend.innerHTML = `<span class="mem-color">&#9644; heap</span>`;
			memLegend.appendChild(memPeakEl);
			memRow.appendChild(memLegend);
			this.panel.appendChild(memRow);
		}

		// append to <html> element to avoid triggering melonJS's MutationObserver
		// (which watches document.body / canvas parent for DOM changes and triggers resize)
		document.documentElement.appendChild(this.panelWrap);
		this._syncPosition();
	}

	/** @private */
	_syncPosition() {
		const rect = video.renderer.getCanvas().getBoundingClientRect();
		const s = this.panelWrap.style;
		s.top = `${rect.top}px`;
		s.left = `${rect.left}px`;
		s.width = `${rect.width}px`;
	}

	/** @private */
	_updatePanel() {
		this.stats.objects.textContent = game.world.children.length;
		this.stats.draws.textContent = game.world.drawCount;
		this.stats.update.textContent = `${this.frameUpdateTime.toFixed(2)}ms`;
		this.stats.draw.textContent = `${this.frameDrawTime.toFixed(2)}ms`;
		this.stats.fps.textContent = `${timer.fps}/${timer.maxfps} fps`;
		this.stats.shapes.textContent = this.counters.get("shapes");
		this.stats.sprites.textContent = this.counters.get("sprites");
		this.stats.velocity_count.textContent = this.counters.get("velocity");
		this.stats.bounds.textContent = this.counters.get("bounds");
		this.stats.children.textContent = this.counters.get("children");
		this.stats.pool.textContent = pool.getInstanceCount();

		if (window.performance?.memory) {
			const used = Number(
				(window.performance.memory.usedJSHeapSize / 1048576).toFixed(1),
			);
			const total = Number(
				(window.performance.memory.totalJSHeapSize / 1048576).toFixed(1),
			);
			this.stats.heap.textContent = `${used}/${total}MB`;
		} else {
			this.stats.heap.textContent = "n/a";
		}

		// record frame times and memory
		this.updateHistory[this.historyIndex] = this.frameUpdateTime;
		this.drawHistory[this.historyIndex] = this.frameDrawTime;
		if (window.performance?.memory) {
			this.memHistory[this.historyIndex] =
				window.performance.memory.usedJSHeapSize / 1048576;
		}
		this.historyIndex = (this.historyIndex + 1) % GRAPH_SAMPLES;

		drawFrameGraph(
			this.graphCanvas,
			this.updateHistory,
			this.drawHistory,
			this.historyIndex,
			this.stats.peak,
		);
		if (this.memCanvas) {
			drawMemGraph(
				this.memCanvas,
				this.memHistory,
				this.historyIndex,
				this.stats.memPeak,
			);
		}
	}

	/**
	 * show the debug panel
	 */
	show() {
		if (!this.visible) {
			this.panelWrap.style.display = "";
			this.visible = true;
			this._syncPosition();
			game.repaint();
		}
	}

	/**
	 * hide the debug panel
	 */
	hide() {
		if (this.visible) {
			this.panelWrap.style.display = "none";
			this.visible = false;
			game.repaint();
		}
	}

	/** @private */
	_drawQuadTree() {
		if (!this.options.quadtree) {
			return;
		}
		const renderer = video.renderer;
		renderer.save();
		const { x, y } = game.viewport.pos;
		renderer.translate(-x, -y);
		this._drawQuadTreeNode(renderer, game.world.broadphase);
		renderer.translate(x, y);
		renderer.restore();
	}

	/** @private */
	_drawQuadTreeNode(renderer, node) {
		const bounds = node.bounds;

		// wireframe outline — color based on density
		if (node.objects.length > 0) {
			const ratio = Math.min(node.objects.length / node.max_objects, 1);
			// green (few) → yellow → red (full)
			const r = Math.round(ratio < 0.5 ? ratio * 2 * 255 : 255);
			const g = Math.round(ratio < 0.5 ? 255 : 255 * (1 - (ratio - 0.5) * 2));
			renderer.setColor(`rgb(${r},${g},0)`);
		} else {
			renderer.setColor("green");
		}
		renderer.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);

		// recurse into subnodes
		for (let i = 0; i < node.nodes.length; i++) {
			this._drawQuadTreeNode(renderer, node.nodes[i]);
		}
	}

	destroy() {
		this.hide();
		// remove the HTML overlay
		if (this.panelWrap?.parentElement) {
			this.panelWrap.parentElement.removeChild(this.panelWrap);
		}
		event.off(event.CANVAS_ONRESIZE, this._onResize);
		event.off(event.GAME_BEFORE_UPDATE, this._onBeforeUpdate);
		event.off(event.GAME_AFTER_UPDATE, this._onAfterUpdate);
		event.off(event.GAME_BEFORE_DRAW, this._onBeforeDraw);
		event.off(event.GAME_AFTER_DRAW, this._onAfterDraw);
	}
}
