import { event, game, input, plugin, pool, timer, utils, video } from "melonjs";
import { homepage, name, version } from "../package.json";
import Counters from "./counters.js";
import { drawFrameGraph, drawMemGraph } from "./graphs.js";
import { applyPatches } from "./patches.js";
import { GRAPH_HEIGHT, GRAPH_SAMPLES, registerStyles } from "./styles.js";

/**
 * @classdesc
 * a simple debug panel plugin <br>
 * <img src="images/debugPanel.png"/> <br>
 * <b>usage : </b><br>
 * &bull; upon loading the debug panel, it will be automatically registered under me.plugins.debugPanel <br>
 * &bull; you can then press the default "s" key to show or hide the panel, or use me.plugins.debugPanel.show() and me.plugins.debugPanel.hide(), or add #debug as a parameter to your URL e.g. http://myURL/index.html#debug <br>
 * &bull; default key can be configured using the following parameters in the url : e.g. http://myURL/index.html#debugToggleKey=d <br>
 * <b>the debug panel provides the following information : </b><br>
 * &bull; amount of total objects currently active in the current stage <br>
 * &bull; amount of draws operation <br>
 * &bull; amount of body shape (for collision) <br>
 * &bull; amount of bounding box <br>
 * &bull; amount of sprites objects <br>
 * &bull; amount of objects currently inactive in the the object pool <br>
 * &bull; memory usage (Heap Memory information is only available under Chrome) <br>
 * &bull; frame update time (in ms) <br>
 * &bull; frame draw time (in ms) <br>
 * &bull; current fps rate vs target fps <br>
 * additionally, using the checkbox in the panel it is also possible to display : <br>
 * &bull; the hitbox or bounding box for all objects <br>
 * &bull; current velocity vector <br>
 * &bull; quadtree spatial visualization <br>
 * @augments plugin.BasePlugin
 */
export class DebugPanelPlugin extends plugin.BasePlugin {
	/**
	 * @param {number} [debugToggle=input.KEY.S] - a default key to toggle the debug panel visibility state
	 * @see input.KEY for default key options
	 */
	constructor(debugToggle = input.KEY.S) {
		super();

		// Minimum melonJS version — `Renderable.postDraw` now reads the
		// `PhysicsAdapter.getBodyAABB` / `getBodyShapes` debug API
		// added in 19.5. Older releases don't expose those methods and
		// the patch would silently skip drawing physics overlays.
		this.version = "19.5.0";

		console.log(`${name} ${version} | ${homepage}`);

		this.debugToggle = debugToggle;

		this.counters = new Counters([
			"shapes",
			"sprites",
			"velocity",
			"bounds",
			"children",
			"draws",
		]);

		this.visible = false;

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
		};
		this._onBeforeDraw = (time) => {
			this.frameDrawStartTime = time;
			this.counters.reset();
		};
		this._onAfterDraw = (time) => {
			this.frameDrawTime = time - this.frameDrawStartTime;
			// `_updatePanel()` writes into the HTML overlay — only useful
			// while the panel is open. `_drawQuadTree()` is a world-space
			// debug overlay and gates itself on `options.quadtree`, so it
			// keeps rendering even when the panel itself is hidden. Same
			// behavior the in-world patches (hitbox / velocity) now use.
			if (this.visible) {
				this._updatePanel();
			}
			this._drawQuadTree();
		};
		this._onKeyDown = (_action, keyCode) => {
			if (keyCode === this.debugToggle) {
				this.toggle();
			}
		};

		event.on(event.CANVAS_ONRESIZE, this._onResize);
		event.on(event.GAME_BEFORE_UPDATE, this._onBeforeUpdate);
		event.on(event.GAME_AFTER_UPDATE, this._onAfterUpdate);
		event.on(event.GAME_BEFORE_DRAW, this._onBeforeDraw);
		event.on(event.GAME_AFTER_DRAW, this._onAfterDraw);
		event.on(event.KEYDOWN, this._onKeyDown);

		applyPatches(this);

		// if "#debug" is present in the URL
		if (utils.getUriFragment().debug === true) {
			this.show();
		}
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

		const toggleKey =
			Object.keys(input.KEY).find((k) => {
				return input.KEY[k] === this.debugToggle;
			}) ?? "?";

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
		this.stats.draws.textContent = this.counters.get("draws");
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

	/**
	 * toggle the debug panel visibility state
	 */
	toggle() {
		if (this.visible) {
			this.hide();
		} else {
			this.show();
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
		renderer.restore();
		// flush is needed because this runs after GAME_AFTER_DRAW,
		// which is emitted after the main renderer.flush()
		renderer.flush();
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

	/**
	 * destroy the debug plugin
	 */
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
		event.off(event.KEYDOWN, this._onKeyDown);
	}
}
