import { BufferTextureResource } from "../../../texture/resource.js";
import GLShader from "../../glshader.js";
import orthogonalTMXLayerFragment from "../../shaders/orthogonal-tmxlayer.frag";
import orthogonalTMXLayerVertex from "../../shaders/orthogonal-tmxlayer.vert";

/**
 * additional imports for TypeScript
 * @import { default as TMXLayer } from "../../../../level/tiled/TMXLayer.js";
 * @import { default as WebGLRenderer } from "../../webgl_renderer.js";
 */

// Default `uTint` when the layer has no tint set. Module-scoped so the
// fallback path doesn't allocate per frame.
const DEFAULT_TINT = new Float32Array([1, 1, 1, 1]);

/**
 * GPU-accelerated renderer for orthogonal TMX tile layers (WebGL2). Draws
 * the visible region of a layer as one screen-aligned quad per tileset
 * referenced by the layer — the fragment shader samples a per-layer GID
 * index texture and the tileset atlas, eliminating the per-tile draw
 * loop. The visible rect, GID range, tile size, opacity, and tint are
 * pushed as uniforms; the index texture is uploaded once at activation
 * and re-uploaded only when `layer.dataVersion` changes (mutations from
 * `setTile`/`clearTile`).
 *
 * The per-layer index texture is a `BufferTextureResource` flowing
 * through the standard `TextureCache` / batcher path — same lane as
 * every other texture in the engine. Dynamic unit allocation, correct
 * `boundTextures` bookkeeping, and per-resource premultiplied-alpha /
 * filter all come for free; nothing here pokes `gl.bindTexture` or
 * `gl.activeTexture` directly.
 *
 * Cache lifecycle: one `BufferTextureResource` per `TMXLayer`. Tile
 * layers don't come and go individually — they only churn on game reset
 * — so the cache is freed in bulk via `reset()`, called from
 * `WebGLRenderer.reset()` (which the `GAME_RESET` event already
 * triggers).
 *
 * @ignore
 */
export default class OrthogonalTMXLayerGPURenderer {
	/**
	 * @param {WebGLRenderer} renderer - the WebGL renderer instance
	 */
	constructor(renderer) {
		this.renderer = renderer;
		this.gl = renderer.gl;
		// Standalone `GLShader` (not `ShaderEffect`) so we own both the
		// vertex and the fragment source — they're paired in GLSL ES 3.00,
		// which lets the fragment shader use `texelFetch` for byte-exact
		// reads from the index / animation lookup textures (samplers stay
		// `sampler2D` and decode the 8-bit channels as normalized floats;
		// `usampler2D` would conflict with the engine's multi-texture
		// batching cache). `setBatcher("quad", this.shader)` integrates
		// the program with the quad batcher just like a `ShaderEffect` —
		// only the per-fragment math gets cleaner.
		this.shader = new GLShader(
			renderer.gl,
			orthogonalTMXLayerVertex,
			orthogonalTMXLayerFragment,
			renderer.shaderPrecision,
		);
		// per-layer `BufferTextureResource`. `Map` (not `WeakMap`) so we
		// can iterate on `reset()` to walk through the global texture
		// cache and free GL handles. The world's container holds the
		// strong ref to each layer anyway, so this doesn't change layer
		// lifetime.
		this.resources = new Map();
		// per-tileset animation-lookup resources, keyed by `TMXTileset`.
		// Only allocated for tilesets that actually have animated tiles
		// (`tileset.isAnimated === true`).
		this.animLookups = new Map();
		// pre-allocated scratch for uniform uploads — avoids per-frame
		// allocation in the hot path
		this._v2 = new Float32Array(2);
		this._v4 = new Float32Array(4);
	}

	/**
	 * Free every cached per-layer index texture and empty the local
	 * resource map. Called from `WebGLRenderer.reset()` (which
	 * `GAME_RESET` triggers) so each level transition starts clean.
	 * @ignore
	 */
	reset() {
		const batcher = this.renderer.currentBatcher;
		const cache = this.renderer.cache;
		const drop = (resource) => {
			// route through the batcher so its `boundTextures` bookkeeping
			// stays in sync. When no batcher is active (e.g. context tear-
			// down) we don't have a clean GL deletion path, but we still
			// need to free the unit assignment — `cache.delete()` only
			// touches the image→atlas map and would leave the unit slot
			// held forever otherwise, so call `freeTextureUnit()` too.
			if (batcher !== undefined) {
				batcher.deleteTexture2D(resource);
			} else {
				cache.freeTextureUnit(resource);
				cache.delete(resource);
			}
		};
		for (const resource of this.resources.values()) {
			drop(resource);
		}
		for (const entry of this.animLookups.values()) {
			drop(entry.resource);
		}
		this.resources.clear();
		this.animLookups.clear();
	}

	/**
	 * Write a `vec2` uniform without allocating a fresh Float32Array per
	 * call. Both components flow into the shared `_v2` scratch buffer,
	 * which `setUniform` reads synchronously and forwards to
	 * `gl.uniform2fv` — so reusing the buffer across calls is safe.
	 * @param {string} name
	 * @param {number} x
	 * @param {number} y
	 * @private
	 */
	_setV2(name, x, y) {
		this._v2[0] = x;
		this._v2[1] = y;
		this.shader.setUniform(name, this._v2);
	}

	/**
	 * `vec4` counterpart to {@link _setV2}.
	 * @param {string} name
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 * @param {number} w
	 * @private
	 */
	_setV4(name, x, y, z, w) {
		this._v4[0] = x;
		this._v4[1] = y;
		this._v4[2] = z;
		this._v4[3] = w;
		this.shader.setUniform(name, this._v4);
	}

	/**
	 * Get-or-create the per-tileset animation-lookup entry. Returns
	 * `undefined` for tilesets that have no animated tiles (the shader's
	 * `uAnimEnabled` uniform is then set to 0 and the lookup texture is
	 * not bound).
	 *
	 * The entry holds a `tileCount × 1` RGBA8 `BufferTextureResource`
	 * where texel `localId` encodes the CURRENT frame's local id as
	 * `R = lo byte, G = hi byte` (same encoding as the GID index
	 * texture). Each call walks `tileset.animations` and rewrites
	 * dirty texels — `tileset.update(dt)` (driven by the layer) advances
	 * `anim.cur.tileid` independently of this renderer.
	 *
	 * @param {object} tileset
	 * @param {number} tileCount - tiles in the tileset's atlas grid
	 *   (`atlasCols * atlasRows`)
	 * @returns {{resource: BufferTextureResource, data: Uint8Array,
	 *   tileCount: number, dirty: boolean}|undefined}
	 */
	_getOrUpdateAnimLookup(tileset, tileCount) {
		if (!tileset.isAnimated || tileset.animations.size === 0) {
			return undefined;
		}
		let entry = this.animLookups.get(tileset);
		if (entry === undefined) {
			// allocate the lookup texture and initialize it to identity
			// (localId → localId); animated entries get overwritten below
			const data = new Uint8Array(tileCount * 4);
			for (let id = 0; id < tileCount; id++) {
				data[id * 4 + 0] = id & 0xff;
				data[id * 4 + 1] = (id >> 8) & 0xff;
			}
			const resource = new BufferTextureResource(data, {
				width: tileCount,
				height: 1,
				premultipliedAlpha: false,
				repeat: "no-repeat",
				// NEAREST so the shader's `texelFetch` reads byte-exact
				// channel values back as normalized floats
				filter: this.gl.NEAREST,
				format: "rgba8",
			});
			// new entry → first upload happens unconditionally via the
			// batcher's `boundTextures[unit] === undefined` path
			entry = { resource, data, tileCount, dirty: false };
			this.animLookups.set(tileset, entry);
		}
		// walk animations and rewrite the current-frame ids. The dirty
		// flag flips true only when at least one texel actually changed
		// — the batcher then force-reuploads on the next bind, otherwise
		// reuses the existing GL texture untouched.
		const data = entry.data;
		for (const [localId, anim] of tileset.animations) {
			const off = localId * 4;
			const cur = anim.cur.tileid;
			const lo = cur & 0xff;
			const hi = (cur >> 8) & 0xff;
			if (data[off] !== lo || data[off + 1] !== hi) {
				data[off] = lo;
				data[off + 1] = hi;
				entry.dirty = true;
			}
		}
		return entry;
	}

	/**
	 * Get-or-create the per-layer index `BufferTextureResource`.
	 * @param {TMXLayer} layer
	 * @returns {BufferTextureResource}
	 */
	_getResource(layer) {
		let resource = this.resources.get(layer);
		if (resource === undefined) {
			// reinterpret the layer's `Uint16Array` payload as RGBA bytes
			// (zero-copy on every little-endian platform = every browser)
			resource = new BufferTextureResource(
				new Uint8Array(layer.layerData.buffer),
				{
					width: layer.cols,
					height: layer.rows,
					// raw GID bytes — must NOT have alpha pre-multiplied
					// into RGB, otherwise A=0 cells wipe their R/G/B
					premultipliedAlpha: false,
					repeat: "no-repeat",
					// NEAREST so `texelFetch` returns the original byte
					// values (as normalized floats) for the GID/flip
					// decode below
					filter: this.gl.NEAREST,
					format: "rgba8",
				},
			);
			// track the last-uploaded version so we know when to force a
			// re-upload after `setTile` / `clearTile` mutations
			resource._uploadedVersion = -1;
			this.resources.set(layer, resource);
		}
		return resource;
	}

	/**
	 * Draw an orthogonal TMX layer through the shader path.
	 * @param {TMXLayer} layer
	 * @param {object} rect - the visible viewport rect (world coords)
	 */
	draw(layer, rect) {
		const renderer = this.renderer;
		const tileWidth = layer.tilewidth;
		const tileHeight = layer.tileheight;
		const cols = layer.cols;
		const rows = layer.rows;

		// compute the visible region in tile-coord space
		const startTileX = Math.max(0, Math.floor(rect.pos.x / tileWidth));
		const startTileY = Math.max(0, Math.floor(rect.pos.y / tileHeight));
		const endTileX = Math.min(
			cols,
			Math.ceil((rect.pos.x + rect.width) / tileWidth),
		);
		const endTileY = Math.min(
			rows,
			Math.ceil((rect.pos.y + rect.height) / tileHeight),
		);

		// visible rect entirely outside the layer — nothing to draw
		if (endTileX <= startTileX || endTileY <= startTileY) {
			return;
		}

		// quad world coords
		const worldX = startTileX * tileWidth;
		const worldY = startTileY * tileHeight;
		const worldW = (endTileX - startTileX) * tileWidth;
		const worldH = (endTileY - startTileY) * tileHeight;

		// visible region size in tile units (matches the quad's [0..1] UV
		// span — shader recovers the per-fragment tile coord as
		// `uVisibleStart + uv * uVisibleSize`)
		const visStartX = startTileX;
		const visStartY = startTileY;
		const visSizeX = endTileX - startTileX;
		const visSizeY = endTileY - startTileY;

		// switch the quad batcher to our custom shader. This flushes any
		// queued sprite vertices first so they render under their original
		// shader, then re-binds for our pass.
		const batcher = renderer.setBatcher("quad", this.shader);

		// upload (or rebind) the index texture through the standard cache
		// path: dynamic unit allocation, correct `boundTextures` tracking,
		// per-resource premultiply / filter applied automatically
		const resource = this._getResource(layer);
		const indexUnit = batcher.uploadTexture(
			resource,
			cols,
			rows,
			resource._uploadedVersion !== layer.dataVersion,
		);
		resource._uploadedVersion = layer.dataVersion;

		this.shader.setUniform("uTileIndex", indexUnit);
		this._setV2("uMapSize", cols, rows);
		this._setV2("uVisibleStart", visStartX, visStartY);
		this._setV2("uVisibleSize", visSizeX, visSizeY);
		this._setV2("uCellSize", tileWidth, tileHeight);
		this.shader.setUniform("uOpacity", layer.getOpacity());
		this.shader.setUniform(
			"uTint",
			layer.tint ? layer.tint.toArray() : DEFAULT_TINT,
		);

		// one pass per tileset — the shader's uGidRange uniform + discard
		// hides cells outside the active tileset's GID range
		const tilesets = layer.tilesets.tilesets;
		for (let i = 0; i < tilesets.length; i++) {
			const tileset = tilesets[i];
			// skip collection-of-image tilesets (caller's eligibility check
			// should have downgraded these layers to the legacy path, but
			// guard defensively — we can't compute uTilesetCols for them)
			if (tileset.isCollection || tileset.image === undefined) {
				continue;
			}

			const tsW = tileset.tilewidth;
			const tsH = tileset.tileheight;
			const margin = tileset.margin;
			const spacing = tileset.spacing;
			const atlasW = tileset.image.width;
			const atlasH = tileset.image.height;

			// atlas geometry (margin + spacing) — number of tiles per row/col
			// in the atlas image
			const atlasCols = Math.max(
				1,
				Math.floor((atlasW - margin * 2 + spacing) / (tsW + spacing)),
			);
			const atlasRows = Math.max(
				1,
				Math.floor((atlasH - margin * 2 + spacing) / (tsH + spacing)),
			);

			// per-tileset animation lookup. Only allocated/bound for
			// tilesets that actually have animated tiles — static tilesets
			// pay neither a texture-unit nor an upload.
			const tileCount = atlasCols * atlasRows;
			const animEntry = this._getOrUpdateAnimLookup(tileset, tileCount);
			if (animEntry !== undefined) {
				const animUnit = batcher.uploadTexture(
					animEntry.resource,
					animEntry.tileCount,
					1,
					animEntry.dirty,
				);
				animEntry.dirty = false;
				this.shader.setUniform("uAnimLookup", animUnit);
				this.shader.setUniform("uAnimSize", animEntry.tileCount);
			} else {
				// shader skips the animation lookup when uAnimSize == 0,
				// but every declared sampler must still point at a valid
				// unit — reuse the index unit so WebGL's draw-time
				// validation is happy (the sampler is never read because
				// of the uAnimSize guard)
				this.shader.setUniform("uAnimLookup", indexUnit);
				this.shader.setUniform("uAnimSize", 0);
			}

			this._setV2("uTileSize", tsW, tsH);
			this._setV2("uTilesetCols", atlasCols, atlasRows);
			this._setV2("uInvTilesetSize", 1 / atlasW, 1 / atlasH);
			this._setV4("uTilesetMargin", margin, margin, spacing, spacing);
			this._setV2(
				"uOverflow",
				Math.max(0, Math.ceil(tsW / tileWidth) - 1),
				Math.max(0, Math.ceil(tsH / tileHeight) - 1),
			);
			this._setV2("uGidRange", tileset.firstgid, tileset.lastgid);

			// emit one screen-quad. The batcher will bind the tileset's
			// TextureAtlas to uSampler (single-texture fallback path is
			// active because we have a custom ShaderEffect).
			batcher.addQuad(
				tileset.texture,
				worldX,
				worldY,
				worldW,
				worldH,
				0,
				0,
				1,
				1,
				0xffffffff,
			);

			// flush per-pass so each tileset's draw call uses its own
			// uniforms (uGidRange / uTileSize / uTilesetCols differ)
			batcher.flush();
		}
	}
}
