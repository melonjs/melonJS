import { vector2dPool } from "../../math/vector2d.ts";
import Renderable from "../../renderable/renderable.js";
import CanvasRenderer from "../../video/canvas/canvas_renderer";
import { createCanvas } from "../../video/video.js";
import {
	TMX_CLEAR_BIT_MASK,
	TMX_FLIP_AD,
	TMX_FLIP_H,
	TMX_FLIP_V,
} from "./constants.js";
import Tile from "./TMXTile.js";
import * as TMXUtils from "./TMXUtils.js";

// flip-mask bit layout for layerData's G channel
const FLIP_H_BIT = 1 << 0;
const FLIP_V_BIT = 1 << 1;
const FLIP_AD_BIT = 1 << 2;

/**
 * extract a 3-bit flip mask from a raw 32-bit GID (Tiled's flip bits live in
 * the upper 3 bits)
 * @ignore
 */
function flipMaskFromGid(gid) {
	return (
		(gid & TMX_FLIP_H ? FLIP_H_BIT : 0) |
		(gid & TMX_FLIP_V ? FLIP_V_BIT : 0) |
		(gid & TMX_FLIP_AD ? FLIP_AD_BIT : 0)
	);
}

/**
 * extract a 3-bit flip mask from a Tile object's boolean flip flags
 * @ignore
 */
function flipMaskFromTile(tile) {
	return (
		(tile.flippedX ? FLIP_H_BIT : 0) |
		(tile.flippedY ? FLIP_V_BIT : 0) |
		(tile.flippedAD ? FLIP_AD_BIT : 0)
	);
}

/**
 * reconstruct a legacy 32-bit GID (with Tiled's high flip bits set) from the
 * cleaned GID and a 3-bit flip mask, for passing to the Tile constructor
 * @ignore
 */
function gidWithFlips(gid, flipMask) {
	return (
		gid |
		(flipMask & FLIP_H_BIT ? TMX_FLIP_H : 0) |
		(flipMask & FLIP_V_BIT ? TMX_FLIP_V : 0) |
		(flipMask & FLIP_AD_BIT ? TMX_FLIP_AD : 0)
	);
}

/**
 * Decode a tiled layer's data blob directly into the typed-array layerData
 * @ignore
 */
function setLayerData(layer, bounds, data) {
	let idx = 0;
	let width;
	let height;

	// layer provide rows and cols, chunk width and height
	if (typeof bounds.rows === "undefined") {
		width = bounds.width;
		height = bounds.height;
	} else {
		width = bounds.cols;
		height = bounds.rows;
	}

	const cols = layer.cols;
	const layerData = layer.layerData;
	const offsetX = bounds.x;
	const offsetY = bounds.y;
	// One-shot warning when a layer's flip-stripped GID won't fit in the
	// `Uint16Array` cell — silent truncation would render the wrong tile.
	// 65535 is far above any realistic tileset size, but flag it loudly
	// so users with degenerate maps notice immediately.
	let overflowedGid = 0;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const rawGid = data[idx++];
			if (rawGid !== 0) {
				const flatIdx = ((y + offsetY) * cols + (x + offsetX)) * 2;
				const cleanGid = rawGid & TMX_CLEAR_BIT_MASK;
				if (cleanGid > 0xffff && overflowedGid === 0) {
					overflowedGid = cleanGid;
				}
				layerData[flatIdx] = cleanGid;
				layerData[flatIdx + 1] = flipMaskFromGid(rawGid);
			}
		}
	}
	if (overflowedGid !== 0) {
		console.warn(
			"melonJS: TMX layer contains GID " +
				overflowedGid +
				" which exceeds the 16-bit cell capacity (max 65535). Tiles will be truncated and render incorrectly.",
		);
	}
}

/**
 * a TMX Tile Layer Object
 * Tiled QT 0.7.x format
 * @category Tilemap
 */
export default class TMXLayer extends Renderable {
	/**
	 * @param {object} map - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {object} data - layer data in JSON format ({@link http://docs.mapeditor.org/en/stable/reference/tmx-map-format/#layer})
	 * @param {number} tilewidth - width of each tile in pixels
	 * @param {number} tileheight - height of each tile in pixels
	 * @param {string} orientation - "isometric" or "orthogonal"
	 * @param {TMXTilesetGroup} tilesets - tileset as defined in Tiled
	 * @param {number} z - z-index position
	 */
	constructor(map, data, tilewidth, tileheight, orientation, tilesets, z) {
		// super constructor
		super(0, 0, 0, 0);

		// tile width & height
		this.tilewidth = data.tilewidth || tilewidth;
		this.tileheight = data.tileheight || tileheight;

		// layer orientation
		this.orientation = orientation;

		/**
		 * Horizontal layer offset in tiles
		 * @default 0
		 * @type {number}
		 */
		this.x = 0;

		/**
		 * Vertical layer offset in tiles
		 * @default 0
		 * @type {number}
		 */
		this.y = 0;

		/**
		 * The Layer corresponding Tilesets
		 * @type {TMXTilesetGroup}
		 */
		this.tilesets = tilesets;

		// the default tileset (used as cache in cellAt)
		this.tileset = this.tilesets ? this.tilesets.getTilesetByIndex(0) : null;

		// Biggest tile size to draw
		this.maxTileSize = {
			width: 0,
			height: 0,
		};
		for (let i = 0; i < this.tilesets.length; i++) {
			const tileset = this.tilesets.getTilesetByIndex(i);
			this.maxTileSize.width = Math.max(
				this.maxTileSize.width,
				tileset.tilewidth,
			);
			this.maxTileSize.height = Math.max(
				this.maxTileSize.height,
				tileset.tileheight,
			);
		}

		/**
		 * All animated tilesets in this layer
		 * @type {TMXTileset[]}
		 */
		this.animatedTilesets = [];

		/**
		 * Layer contains tileset animations
		 * @type {boolean}
		 */
		this.isAnimated = false;

		/**
		 * the order in which tiles on orthogonal tile layers are rendered.
		 * (valid values are "left-down", "left-up", "right-down", "right-up")
		 * @type {string}
		 * @default "right-down"
		 */
		this.renderorder = data.renderorder || "right-down";

		/**
		 * the layer class
		 * @type {string}
		 */
		this.class = data.class;

		// for displaying order
		this.pos.z = z;

		// tiled default coordinates are top-left
		this.anchorPoint.set(0, 0);

		// additional TMX flags
		this.name = data.name;
		this.cols = +data.width;
		this.rows = +data.height;

		// layer opacity
		const visible = typeof data.visible !== "undefined" ? +data.visible : 1;
		this.setOpacity(visible ? +data.opacity : 0);

		// layer blend mode (Tiled 1.12+)
		this.blendMode = TMXUtils.tiledBlendMode(data.mode);

		// layer tint
		if (typeof data.tintcolor === "string") {
			// Tiled provides #RRGGBB or #AARRGGBB
			this.tint.parseHex(data.tintcolor, true);
		}

		// layer "real" size
		if (this.orientation === "isometric") {
			this.width = (this.cols + this.rows) * (this.tilewidth / 2);
			this.height = (this.cols + this.rows) * (this.tileheight / 2);
		} else {
			this.width = this.cols * this.tilewidth;
			this.height = this.rows * this.tileheight;
		}

		// check if we have any user-defined properties
		TMXUtils.applyTMXProperties(this, data);

		// set a renderer
		this.setRenderer(map.getRenderer());

		/**
		 * The raw tile data for this layer. Each cell occupies two consecutive
		 * `Uint16` slots: the GID (with flip bits stripped) and a 3-bit flip
		 * mask. Cell `(x, y)` is at `layerData[(y * cols + x) * 2]` (row-major).
		 *
		 * The 16-bit GID slot caps per-tileset GIDs at 65 535. This matches the
		 * planned WebGL2 shader path (`RG16UI` index texture) — switching to
		 * `Uint32Array` would force a truncating copy at GPU upload time.
		 * @type {Uint16Array}
		 */
		this.layerData = new Uint16Array(this.cols * this.rows * 2);

		/**
		 * Lazy view cache of Tile objects, indexed by `y * cols + x` (row-major).
		 * Allocated lazily on the first `cellAt` / `getTile` call — the renderer
		 * hot path reads `layerData` directly and never touches this cache, so
		 * for games that never call `getTile`/`cellAt` from user code, this
		 * stays `null` for the layer's lifetime. Invalidated entry-by-entry by
		 * `setTile` and `clearTile`. The raw bytes in `layerData` are the source
		 * of truth; this exists only to preserve stable Tile identity across
		 * repeated user-facing reads.
		 * @type {Array<Tile|null>|null}
		 * @ignore
		 */
		this.cachedTile = null;

		/**
		 * Monotonically-increasing counter bumped by `setTile` and `clearTile`.
		 * Renderers can compare against a stashed value to detect mutations and
		 * decide whether to re-upload the layer data to the GPU.
		 * @type {number}
		 */
		this.dataVersion = 0;

		/**
		 * How this layer is rendered. Resolved by `onActivateEvent` to one of:
		 *   - `"shader"`   — WebGL2 procedural shader path (single quad per tileset, fragment GID lookup)
		 *   - `"prerender"`— offscreen-canvas bake at activation, blitted as one drawImage per frame
		 *   - `"perTile"`  — per-frame loop, one drawImage per visible tile
		 *
		 * User code may set this to one of the above values (or the special
		 * `"auto"`) before the layer is activated to override the engine's
		 * default choice; Tiled custom properties named `renderMode` are
		 * applied automatically via `applyTMXProperties`. If a forced mode
		 * is ineligible (e.g. `"shader"` on Canvas), a one-shot warning is
		 * emitted at activation and the layer falls back to the legacy path.
		 * @type {string}
		 * @default "auto"
		 */
		this.renderMode = "auto";

		if (map.infinite === 0) {
			// initialize and set the layer data
			setLayerData(
				this,
				this,
				TMXUtils.decode(data.data, data.encoding, data.compression),
			);
		} else if (map.infinite === 1) {
			// infinite map, initialize per chunk
			const chunks = data.chunks;
			for (let i = 0, len = chunks.length; i < len; i++) {
				const chunk = chunks[i];
				setLayerData(
					this,
					chunk,
					TMXUtils.decode(chunk.data, data.encoding, data.compression),
				);
			}
		}
	}

	// called when the layer is added to the game world or a container
	onActivateEvent() {
		if (this.tilesets) {
			const tileset = this.tilesets.tilesets;
			for (let i = 0; i < tileset.length; i++) {
				if (tileset[i].isAnimated) {
					this.animatedTilesets.push(tileset[i]);
				}
			}
		}

		this.isAnimated = this.animatedTilesets.length > 0;

		// resolve renderMode: shader > prerender > perTile, taking into
		// account user-forced values, Application/world settings, and the
		// per-layer preRender hint
		this._resolveRenderMode();

		// if pre-rendering method is in use, create an offline canvas/renderer
		if (this.renderMode === "prerender" && !this.canvasRenderer) {
			this.canvasRenderer = new CanvasRenderer({
				canvas: createCanvas(this.width, this.height),
				width: this.width,
				height: this.height,
				transparent: true,
			});
			// pre render the layer on the canvas
			this.getRenderer().drawTileLayer(this.canvasRenderer, this, this);
		}
		// keep `preRender` boolean in sync with the resolved mode (legacy
		// callers still read it; `Renderer.drawTileLayer` itself reads
		// `layer.canvasRenderer`)
		this.preRender = this.renderMode === "prerender";

		this.isDirty = true;
	}

	/**
	 * Resolve `this.renderMode` to one of "shader" / "prerender" / "perTile"
	 * based on eligibility checks and user/world hints. Emits a single
	 * `console.warn` at activation when a forced mode is ineligible, or
	 * when an auto-eligible mode falls back due to a layer feature the GPU
	 * path doesn't support (orientation, collection-of-image tileset, etc.).
	 * @ignore
	 */
	_resolveRenderMode() {
		const root = this.ancestor?.getRootAncestor?.();
		const renderer = this.parentApp?.renderer;
		const gpuAllowed = root?.gpuTilemap !== false;
		const preRenderHint =
			typeof this.preRender === "boolean" ? this.preRender : root?.preRender;

		const elig = this._checkShaderEligibility(renderer, gpuAllowed);

		const requested = this.renderMode;
		// explicit "shader" — honor if eligible, warn otherwise
		if (requested === "shader") {
			if (elig.ok) {
				return; // already "shader"
			}
			console.warn(
				`melonJS: layer "${this.name}" forced renderMode "shader" not available (${elig.reason}) — falling back to perTile`,
			);
			this.renderMode = "perTile";
			return;
		}
		// explicit "prerender" — honor unless animated (cache would go stale)
		if (requested === "prerender") {
			if (this.isAnimated) {
				console.warn(
					`melonJS: layer "${this.name}" forced renderMode "prerender" disabled (layer has animated tiles) — falling back to perTile`,
				);
				this.renderMode = "perTile";
			}
			return;
		}
		// explicit "perTile" — pass through
		if (requested === "perTile") {
			return;
		}
		// auto-resolve: shader > prerender > perTile
		if (elig.ok) {
			this.renderMode = "shader";
			return;
		}
		// only emit an info warning when the user enabled gpuTilemap and the
		// fallback is due to layer-specific limitations (not a missing
		// WebGL2 context, which is a renderer-wide condition)
		if (gpuAllowed && elig.reason !== "no-webgl2-renderer") {
			console.warn(
				`melonJS: layer "${this.name}" using legacy tile renderer (${elig.reason})`,
			);
		}
		if (preRenderHint && !this.isAnimated) {
			this.renderMode = "prerender";
			return;
		}
		this.renderMode = "perTile";
	}

	/**
	 * Check whether this layer is eligible for the WebGL2 shader path.
	 * @param {object} renderer
	 * @param {boolean} gpuAllowed - whether `gpuTilemap` is enabled at the world level
	 * @returns {{ok: boolean, reason?: string}}
	 * @ignore
	 */
	_checkShaderEligibility(renderer, gpuAllowed) {
		if (!gpuAllowed) {
			return { ok: false, reason: "gpuTilemap disabled" };
		}
		if (!renderer || renderer.WebGLVersion !== 2) {
			return { ok: false, reason: "no-webgl2-renderer" };
		}
		if (this.orientation !== "orthogonal") {
			return {
				ok: false,
				reason: `no gpu renderer supported yet for "${this.orientation}" orientation`,
			};
		}
		if (!this.tilesets || this.tilesets.tilesets.length === 0) {
			return { ok: false, reason: "no tilesets" };
		}
		// the shader iterates a fixed-size loop over candidate cells to
		// support oversized tiles (tile dim > cell dim) drawn bottom-aligned.
		// Loop bound is MAX_OVERFLOW + 1; anything beyond would silently clip,
		// so refuse the shader path for layers with extreme oversampling.
		const MAX_OVERFLOW_CELLS = 4;
		for (const ts of this.tilesets.tilesets) {
			if (ts.isCollection) {
				return { ok: false, reason: "collection-of-image tileset" };
			}
			if (ts.tilerendersize !== "tile") {
				return {
					ok: false,
					reason: `tilerendersize "${ts.tilerendersize}" not supported`,
				};
			}
			if (ts.tileoffset.x !== 0 || ts.tileoffset.y !== 0) {
				return { ok: false, reason: "non-zero tileoffset" };
			}
			const overflowX = Math.ceil(ts.tilewidth / this.tilewidth) - 1;
			const overflowY = Math.ceil(ts.tileheight / this.tileheight) - 1;
			if (overflowX > MAX_OVERFLOW_CELLS || overflowY > MAX_OVERFLOW_CELLS) {
				return {
					ok: false,
					reason: `tile overflow exceeds shader limit (${MAX_OVERFLOW_CELLS} cells)`,
				};
			}
		}
		return { ok: true };
	}

	// called when the layer is removed from the game world or a container
	onDeactivateEvent() {
		// renderer-side caches keyed by this layer (e.g. the WebGL2 shader
		// path's per-layer GID index texture) are cleared from the renderer's
		// own `reset()` path — tile layers only come and go on game reset.
		this.animatedTilesets = undefined;
		// keep canvasRenderer for reuse — dropping the reference would leak
		// event listeners registered by CanvasRenderer's constructor
	}

	/**
	 * Set the TMX renderer for this layer object
	 * @param {TMXRenderer} renderer
	 * @example
	 * // use the parent map default renderer
	 * let layer = new me.TMXLayer(...);
	 * layer.setRenderer(map.getRenderer());
	 */
	setRenderer(renderer) {
		this.renderer = renderer;
		this.isDirty = true;
	}

	/**
	 * Return the layer current renderer object
	 * @returns {TMXRenderer} renderer
	 */
	getRenderer() {
		return this.renderer;
	}

	/**
	 * Return the TileId of the Tile at the specified position
	 * @param {number} x - X coordinate (in world/pixels coordinates)
	 * @param {number} y - Y coordinate (in world/pixels coordinates)
	 * @returns {number} TileId or null if there is no Tile at the given position
	 */
	getTileId(x, y) {
		const tile = this.getTile(x, y);
		return tile ? tile.tileId : null;
	}

	/**
	 * Return the Tile object at the specified position
	 * @param {number} x - X coordinate (in world/pixels coordinates)
	 * @param {number} y - Y coordinate (in world/pixels coordinates)
	 * @returns {Tile} corresponding tile or null if there is no defined tile at the coordinate or if outside of the layer bounds
	 * @example
	 * // get the TMX Map Layer called "Front layer"
	 * let layer = app.world.getChildByName("Front Layer")[0];
	 * // get the tile object corresponding to the latest pointer position
	 * let tile = layer.getTile(me.input.pointer.x, me.input.pointer.y);
	 */
	getTile(x, y) {
		let tile = null;

		if (this.contains(x, y)) {
			const coord = this.getRenderer().pixelToTileCoords(
				x,
				y,
				vector2dPool.get(),
			);
			tile = this.cellAt(coord.x, coord.y);
			vector2dPool.release(coord);
		}
		return tile;
	}

	/**
	 * assign the given Tile object to the specified position
	 * @param {Tile} tile - the tile object to be assigned
	 * @param {number} x - x coordinate (in tile/column coordinates)
	 * @param {number} y - y coordinate (in tile/row coordinates)
	 * @returns {Tile} the tile object
	 */
	setTile(tile, x, y) {
		if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
			return tile;
		}
		const slot = y * this.cols + x;
		const idx = slot * 2;
		const cleanGid = tile.tileId & TMX_CLEAR_BIT_MASK;
		// `layerData` is a Uint16Array; writes silently truncate above
		// 0xFFFF. Warn once per layer so a runtime `setTile` with a
		// GID >= 65536 doesn't corrupt the cell undetected.
		if (cleanGid > 0xffff && !this._truncationWarned) {
			this._truncationWarned = true;
			console.warn(
				"melonJS: setTile received GID " +
					cleanGid +
					" which exceeds the 16-bit cell capacity (max 65535). Tile will be truncated and render incorrectly.",
			);
		}
		this.layerData[idx] = cleanGid;
		this.layerData[idx + 1] = flipMaskFromTile(tile);
		if (this.cachedTile !== null) {
			this.cachedTile[slot] = tile;
		}
		this.dataVersion++;
		this.isDirty = true;
		return tile;
	}

	/**
	 * return a new the Tile object corresponding to the given tile id
	 * @param {number} tileId - tileId
	 * @param {number} x - X coordinate (in world/pixels coordinates)
	 * @param {number} y - Y coordinate (in world/pixels coordinates)
	 * @returns {Tile} the tile object
	 */
	getTileById(tileId, x, y) {
		if (!this.tileset.contains(tileId)) {
			// look for the corresponding tileset
			this.tileset = this.tilesets.getTilesetByGid(tileId);
		}
		return new Tile(x, y, tileId, this.tileset);
	}

	/**
	 * Return the Tile object at the specified tile coordinates
	 * @param {number} x - x position of the tile (in Tile unit)
	 * @param {number} y - x position of the tile (in Tile unit)
	 * @param {number} [boundsCheck=true] - check first if within the layer bounds
	 * @returns {Tile} corresponding tile or null if there is no defined tile at the position or if outside of the layer bounds
	 * @example
	 * // return the first tile at offset 0, 0
	 * let tile = layer.cellAt(0, 0);
	 */
	cellAt(x, y, boundsCheck) {
		const _x = ~~x;
		const _y = ~~y;

		// boundsCheck only used internally by the tiled renderer, when the layer bound check was already done
		if (
			boundsCheck !== false &&
			(_x < 0 || _x >= this.cols || _y < 0 || _y >= this.rows)
		) {
			return null;
		}

		const slot = _y * this.cols + _x;
		const idx = slot * 2;
		const gid = this.layerData[idx];
		// `cellAt(x, y, false)` skips the explicit bounds check on the
		// coords for speed, but out-of-range reads from a typed array
		// return `undefined` — treat both that and an explicit empty
		// cell (gid 0) as "no tile" so we never push a bogus GID into
		// the tileset lookup path
		if (!gid) {
			return null;
		}

		// lazy-allocate the view cache on first user-facing query — the
		// renderer hot loop bypasses this method and reads layerData directly,
		// so games that never call cellAt/getTile keep cachedTile null forever
		if (this.cachedTile === null) {
			this.cachedTile = new Array(this.cols * this.rows).fill(null);
		} else {
			const cached = this.cachedTile[slot];
			if (cached !== null) {
				return cached;
			}
		}

		const flipMask = this.layerData[idx + 1];
		const tile = this.getTileById(gidWithFlips(gid, flipMask), _x, _y);
		this.cachedTile[slot] = tile;
		return tile;
	}

	/**
	 * clear the tile at the specified position
	 * @param {number} x - X coordinate (in map coordinates: row/column)
	 * @param {number} y - Y coordinate (in map coordinates: row/column)
	 * @example
	 * app.world.getChildByType(me.TMXLayer).forEach(function(layer) {
	 *     // clear all tiles at the given x,y coordinates
	 *     layer.clearTile(x, y);
	 * });
	 */
	clearTile(x, y) {
		if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) {
			return;
		}
		// clearing tile
		const slot = y * this.cols + x;
		const idx = slot * 2;
		this.layerData[idx] = 0;
		this.layerData[idx + 1] = 0;
		if (this.cachedTile !== null) {
			this.cachedTile[slot] = null;
		}
		// erase the corresponding area in the canvas
		if (this.preRender) {
			this.canvasRenderer.clearRect(
				x * this.tilewidth,
				y * this.tileheight,
				this.tilewidth,
				this.tileheight,
			);
		}
		this.dataVersion++;
		this.isDirty = true;
	}

	/**
	 * update animations in a tileset layer
	 * @ignore
	 */
	update(dt) {
		let result = this.isDirty;
		if (this.isAnimated) {
			for (let i = 0; i < this.animatedTilesets.length; i++) {
				result = this.animatedTilesets[i].update(dt) || result;
			}
		}
		return result;
	}

	/**
	 * draw a tileset layer
	 * @ignore
	 */
	draw(renderer, rect) {
		// dispatch to the active renderer — picks shader / preRender / perTile
		// based on `this.renderMode` and the renderer's capabilities
		renderer.drawTileLayer(this, rect);
	}
}
