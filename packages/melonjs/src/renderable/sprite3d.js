import Camera3d from "../camera/camera3d.ts";
import { getImage } from "../loader/loader.js";
import { Vector3d } from "../math/vector3d.ts";
import Texture2d from "../video/texture/texture2d.ts";
import FrameAnimation from "./frameAnimation.js";
import Mesh from "./mesh.js";

// reusable basis vectors for the billboard projection (one draw runs at a time)
const _right = new Vector3d();
const _up = new Vector3d();
const _fwd = new Vector3d();
// render space is Y-down, so the visual "up" axis is -Y. Used to keep a
// cylindrical billboard upright. MUST be treated as read-only — it is a shared
// module singleton, only ever copied/crossed-from, never mutated in place.
const WORLD_UP = new Vector3d(0, -1, 0);

// Resolve just the source image dimensions for sizing the quad, without
// touching the renderer (the texture atlas itself is resolved by the Mesh
// base class). Runs before `super()`, so it must not touch `this`.
function imageSize(settings) {
	const src = settings.image ?? settings.texture;
	// any Texture2d asset (a TextureAtlas, or a procedural NoiseTexture2d)
	// exposes its drawable source via getTexture()
	if (src instanceof Texture2d) {
		const texture = src.getTexture();
		return { w: texture.width, h: texture.height };
	}
	const image = typeof src === "object" ? src : getImage(src);
	if (!image) {
		throw new Error("Sprite3d: '" + src + "' image/texture not found!");
	}
	return { w: image.width, h: image.height };
}

/**
 * A textured **quad in 3D space** — the 3D counterpart of {@link Sprite},
 * for rendering sprites under a {@link Camera3d} (the 2.5D workflow: characters,
 * pickups, foliage, signs, particles in a 3D scene). It's a thin {@link Mesh}
 * subclass, so it rides the same world-space mesh pipeline (depth testing,
 * frustum culling) and supports the same material features (`lit`, `emissive`,
 * `alphaCutoff`).
 *
 * Its headline feature is **billboarding** — keeping the quad facing the camera
 * regardless of camera orientation (see {@link Sprite3d#billboard}). With
 * billboarding off it's a fixed-orientation quad (decals, posters, ground
 * markers).
 *
 * **Frame animation** is supported through the same API as {@link Sprite}
 * ({@link Sprite3d#addAnimation}, {@link Sprite3d#setCurrentAnimation},
 * {@link Sprite3d#play}/`pause`/`stop`) — pass `framewidth`/`frameheight` for a
 * spritesheet, or a packed {@link TextureAtlas}, exactly as you would for a 2D
 * `Sprite`. Both share the {@link FrameAnimation} engine, so the timing, looping
 * and chaining behavior is identical; `Sprite3d` maps the current frame onto the
 * quad each step — including packer **rotated** and **trimmed** regions, mapped
 * to full parity with the 2D `Sprite`.
 *
 * **Camera3d only.** Like {@link Mesh}, `Sprite3d` renders through the 3D
 * world-space path; under a 2D `Camera2d` it falls back to the mesh's
 * self-projection and **billboarding has no effect** (a 2D scene has no camera
 * orientation to face). Use a regular {@link Sprite} for 2D.
 * @augments Mesh
 * @category Game Objects
 * @example
 * import { Application, Camera3d, Sprite3d } from "melonjs";
 *
 * // a 3D app (Camera3d is required for billboarding)
 * const app = new Application(1024, 768, { cameraClass: Camera3d });
 *
 * // a tree that always faces the camera but stays upright (2.5D).
 * // its texture has a transparent background — the mesh pass is opaque, so
 * // `alphaCutoff` (default 0.5) discards those texels for a clean silhouette.
 * const tree = new Sprite3d(0, 0, {
 *     image: "tree",        // a preloaded image with transparency
 *     width: 64, height: 96,
 *     z: -200,              // 3D depth (world z)
 *     billboard: true,      // = "cylindrical"
 *     // alphaCutoff: 0.5,  // the default — lower it to keep softer edges,
 *                           // or set 0 for a fully-opaque quad
 * });
 * app.world.addChild(tree);   // add it to the game world, like any Renderable
 *
 * // an animated, fully camera-facing pickup from a spritesheet, mirrored
 * const coin = new Sprite3d(0, 0, {
 *     image: "coins",
 *     framewidth: 32, frameheight: 32,
 *     width: 48, height: 48,
 *     billboard: "spherical",
 *     alphaCutoff: 0.5,     // cut out the transparent frame background
 * });
 * coin.addAnimation("spin", [0, 1, 2, 3, 4, 5]);
 * coin.setCurrentAnimation("spin");
 * coin.flipX();             // face the other way (mirrors the sprite)
 * app.world.addChild(coin);
 */
export default class Sprite3d extends Mesh {
	/**
	 * @param {number} x - world x position
	 * @param {number} y - world y position
	 * @param {object} settings - configuration
	 * @param {HTMLImageElement|Texture2d|string} [settings.image] - the sprite texture (image name, image, or a {@link Texture2d} asset such as a {@link TextureAtlas}). Alias: `settings.texture`.
	 * @param {number} [settings.width=settings.framewidth] - quad width in world units (pixels)
	 * @param {number} [settings.height=settings.width] - quad height in world units
	 * @param {number} [settings.framewidth] - width of a single frame within a spritesheet (enables frame animation)
	 * @param {number} [settings.frameheight] - height of a single frame within a spritesheet
	 * @param {string} [settings.region] - region name when using a texture atlas (see {@link TextureAtlas})
	 * @param {object[]} [settings.anims] - predefined animations (same shape as {@link Sprite})
	 * @param {number} [settings.z=0] - 3D depth (world z); also settable later via `.depth`
	 * @param {boolean|string} [settings.billboard=false] - billboard mode: `false` (fixed orientation), `true` / `"cylindrical"` (faces the camera but stays upright — the 2.5D default), or `"spherical"` (faces the camera on all axes). Only applies under a `Camera3d`.
	 * @param {boolean} [settings.flipX=false] - mirror the sprite horizontally (see {@link Sprite3d#flipX})
	 * @param {boolean} [settings.flipY=false] - mirror the sprite vertically (see {@link Sprite3d#flipY})
	 * @param {boolean} [settings.lit=false] - shade through the lit mesh batcher (see {@link Mesh})
	 * @param {number[]|Float32Array} [settings.emissive] - emissive color (see {@link Mesh})
	 * @param {number} [settings.alphaCutoff=0.5] - alpha cutout threshold (see {@link Mesh}). The mesh pass is opaque (no alpha blending), so this defaults to `0.5` to discard a sprite's transparent background (clean cutout silhouette, correct depth, no sorting). Set `0` for a fully-opaque quad, or tune the threshold.
	 */
	constructor(x, y, settings) {
		// world-space quad size (in pixels): explicit width/height first, then the
		// spritesheet frame size, then the full texture size. The texture atlas
		// itself is resolved by the Mesh base class (passing framewidth/frameheight
		// through, below) — so Sprite3d never touches the renderer directly.
		let w;
		let h;
		if (typeof settings.width === "number") {
			w = settings.width;
			h = typeof settings.height === "number" ? settings.height : w;
		} else if (typeof settings.framewidth === "number") {
			w = settings.framewidth;
			h = typeof settings.frameheight === "number" ? settings.frameheight : w;
		} else {
			const size = imageSize(settings);
			w = size.w;
			h = size.h;
		}
		const hw = w / 2;
		const hh = h / 2;
		// a unit quad with the real pixel size baked in, in the XY plane, facing
		// +Z. `normalize: false` + `scale: 1` keeps these coordinates as-is so the
		// fixed-orientation (non-billboard) case renders at the right size, and
		// the billboard path reuses the local (±hw, ±hh) offsets directly.
		const vertices = new Float32Array([
			-hw,
			-hh,
			0,
			hw,
			-hh,
			0,
			hw,
			hh,
			0,
			-hw,
			hh,
			0,
		]);
		// V flipped (1→0 top to bottom) so the texture renders upright under the
		// Y-down render space, matching Sprite. Overwritten per-frame by
		// `_applyFrame` once an animation/region is selected.
		const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]);
		const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
		const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);

		super(x, y, {
			vertices,
			uvs,
			indices,
			normals,
			// let Mesh resolve the texture; forward the spritesheet grid so the
			// resolved atlas carries animation frames
			texture: settings.image ?? settings.texture,
			framewidth: settings.framewidth,
			frameheight: settings.frameheight,
			// width/height drive the frustum-cull bounds; use the larger side so
			// the cull sphere always encloses the quad whatever way it faces
			width: Math.max(w, h),
			height: Math.max(w, h),
			scale: 1,
			normalize: false,
			rightHanded: true,
			// a sprite quad should be visible from both sides (a billboard can end
			// up wound either way, and a fixed quad is usually viewed front-on)
			cullBackFaces: false,
			lit: settings.lit === true,
			emissive: settings.emissive,
			// the mesh pass is opaque (no alpha blending), so a sprite's
			// transparent background would otherwise render as a solid box. Use an
			// alpha cutout by default — fragments below the threshold are
			// discarded, giving a clean transparent silhouette with correct depth
			// testing and no back-to-front sorting. Pass `alphaCutoff: 0` to
			// disable (fully opaque), or tune the threshold.
			alphaCutoff:
				typeof settings.alphaCutoff === "number" ? settings.alphaCutoff : 0.5,
		});

		/**
		 * the quad's half-width in world units (see {@link Sprite3d#billboard}).
		 * @type {number}
		 * @ignore
		 */
		this._halfW = hw;
		/** @ignore */
		this._halfH = hh;
		// reference logical (untrimmed) frame size the world quad maps to,
		// captured from the first applied frame so trimmed frames can be scaled
		// into the same world footprint (0 = not captured yet)
		/** @ignore */
		this._refLw = 0;
		/** @ignore */
		this._refLh = 0;
		// horizontal / vertical mirror flags. Applied by mirroring the local quad
		// in `_applyFrame` (uniform for the billboard + fixed paths, and agnostic
		// to atlas rotation/trim) rather than via the inherited transform flip,
		// which the billboard projection doesn't use.
		/** @ignore */
		this._flipX = false;
		/** @ignore */
		this._flipY = false;
		// the last region handed to `_applyFrame`, so a flip can re-map immediately
		/** @ignore */
		this._region = null;

		// ── frame-animation: texture refs the engine reads + the engine itself ──
		// (the animation state — anim / current / dt / … — lives on the engine and
		// is surfaced through the accessors below, matching Sprite)
		/**
		 * a callback fired when the current animation completes a cycle.
		 * @type {Function}
		 */
		this.onended = undefined;
		/** the frame-aware atlas (== this.texture) @ignore */
		this.source = this.texture;
		// region dictionary + name→index map. `settings.atlas` / `atlasIndices`
		// (as produced by `TextureAtlas.getAnimationSettings` /
		// `createAnimationFromName`) take precedence so atlas-by-name animation
		// works exactly as it does for a 2D Sprite; otherwise fall back to the
		// resolved atlas's own dictionary.
		/** the atlas region dictionary @ignore */
		this.textureAtlas = settings.atlas ?? this.texture.getAtlas();
		/** name→index map for named-region atlases @ignore */
		this.atlasIndices = settings.atlasIndices;
		/** the shared frame-animation engine @ignore */
		this._frameAnim = new FrameAnimation(this, (region) => {
			this._applyFrame(region);
		});

		// 3D depth (world z)
		this.depth = typeof settings.z === "number" ? settings.z : 0;

		/**
		 * Billboard mode — keeps the quad facing the active {@link Camera3d}:
		 * - `false` (default) — fixed orientation (a flat quad in the XY plane;
		 *   decals, posters, ground markers).
		 * - `true` / `"cylindrical"` — faces the camera but stays upright
		 *   (rotates only around the world up axis). The 2.5D default — trees,
		 *   characters, items.
		 * - `"spherical"` — faces the camera on all axes (particles, glints).
		 *
		 * **Only applies under a `Camera3d`**; ignored on the 2D path.
		 *
		 * Note: while billboarding, orientation comes from the camera, so the
		 * renderable's `currentTransform` (`rotate()` / `scale()` / parent-container
		 * transforms) and `meshScale` are **not** applied — only `pos` / `depth`,
		 * `flipX` / `flipY`, and the quad's authored size. With billboarding `false`
		 * the standard {@link Mesh} world transform applies as usual.
		 * @type {boolean|string}
		 * @default false
		 */
		this.billboard = settings.billboard ?? false;

		/** the camera captured at draw time for the billboard projection @ignore */
		this._billboardCam = null;

		// select an initial frame: an explicit atlas region, then any predefined
		// animations, then a catch-all "default" covering every frame.
		if (typeof settings.region !== "undefined") {
			const region = this.source.getRegion(settings.region);
			if (!region) {
				throw new Error(
					"Sprite3d: region for " + settings.region + " not found",
				);
			}
			this.setRegion(region);
		}
		if (typeof settings.anims !== "undefined") {
			for (const id in settings.anims) {
				this.addAnimation(
					settings.anims[id].name,
					settings.anims[id].index,
					settings.anims[id].speed,
				);
			}
		}
		// addAnimation returns 0 when there is no usable frame grid (e.g. a named
		// atlas, where the region above already selected the frame)
		if (
			this.current.name === undefined &&
			this.addAnimation("default", null) !== 0
		) {
			this.setCurrentAnimation("default");
		}

		// optional initial flip (after the first frame is applied, so the re-map
		// in flipX/flipY has a region to work with)
		if (settings.flipX) {
			this.flipX(true);
		}
		if (settings.flipY) {
			this.flipY(true);
		}
	}

	/**
	 * defined animations, keyed by id (see {@link Sprite3d#addAnimation}).
	 * @type {object}
	 */
	get anim() {
		return this._frameAnim.anim;
	}

	/**
	 * current frame information (name / index / texture offset & size / trim).
	 * @type {object}
	 */
	get current() {
		return this._frameAnim.current;
	}

	/**
	 * elapsed time within the current animation frame, in milliseconds.
	 * @type {number}
	 */
	get dt() {
		return this._frameAnim.dt;
	}
	set dt(value) {
		this._frameAnim.dt = value;
	}

	/**
	 * animation cycling speed (delay between frames in ms).
	 * @type {number}
	 * @default 100
	 */
	get animationspeed() {
		return this._frameAnim.animationspeed;
	}
	set animationspeed(value) {
		this._frameAnim.animationspeed = value;
	}

	/**
	 * pause the frame animation, freezing the current frame.
	 * @type {boolean}
	 * @default false
	 */
	get animationpause() {
		return this._frameAnim.animationpause;
	}
	set animationpause(value) {
		this._frameAnim.animationpause = value;
	}

	/**
	 * Add an animation, identical to {@link Sprite#addAnimation}.
	 * @param {string} name - animation id
	 * @param {number[]|string[]|object[]} index - frame indices / names (see {@link Sprite#addAnimation})
	 * @param {number} [animationspeed] - cycling speed in ms
	 * @returns {number} number of frames added
	 */
	addAnimation(name, index, animationspeed) {
		return this._frameAnim.addAnimation(name, index, animationspeed);
	}

	/**
	 * Select the active animation, identical to {@link Sprite#setCurrentAnimation}.
	 * @param {string} name - animation id
	 * @param {string|Function|object} [resetAnim] - loop / chain / completion behavior
	 * @param {boolean} [preserve_dt=false]
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	setCurrentAnimation(name, resetAnim, preserve_dt = false) {
		this._frameAnim.setCurrentAnimation(name, resetAnim, preserve_dt);
		return this;
	}

	/**
	 * Reverse the given (or current) animation in place (see {@link Sprite#reverseAnimation}).
	 * @param {string} [name] - animation id
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	reverseAnimation(name) {
		this._frameAnim.reverseAnimation(name);
		// reversing doesn't re-apply a frame, so mark dirty here (the host owns
		// its dirty flag)
		this.isDirty = true;
		return this;
	}

	/**
	 * Mirror the sprite horizontally (e.g. flip a character to face the other
	 * way). Unlike the 2D {@link Sprite}, the flip mirrors the quad's local
	 * geometry so it works for every billboard mode and for rotated/trimmed atlas
	 * regions alike. Takes effect immediately on the current frame.
	 * @param {boolean} [flip=true]
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	flipX(flip = true) {
		this._flipX = !!flip;
		if (this._region !== null) {
			// re-map the current frame with the new flip (also sets isDirty)
			this._applyFrame(this._region);
		}
		return this;
	}

	/**
	 * Mirror the sprite vertically. See {@link Sprite3d#flipX}.
	 * @param {boolean} [flip=true]
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	flipY(flip = true) {
		this._flipY = !!flip;
		if (this._region !== null) {
			this._applyFrame(this._region);
		}
		return this;
	}

	/**
	 * @returns {boolean} true if the sprite is mirrored horizontally.
	 */
	isFlippedX() {
		return this._flipX === true;
	}

	/**
	 * @returns {boolean} true if the sprite is mirrored vertically.
	 */
	isFlippedY() {
		return this._flipY === true;
	}

	/**
	 * Play (and optionally switch to) an animation, identical to {@link Sprite#play}.
	 * @param {string} [name] - animation id to play; omit to resume
	 * @param {string|Function|object} [options] - loop / chain / completion behavior
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	play(name, options) {
		this.animationpause = false;
		if (name !== undefined) {
			this.setCurrentAnimation(name, options);
		}
		return this;
	}

	/**
	 * Pause the current animation, freezing the current frame (see {@link Sprite#pause}).
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	pause() {
		this.animationpause = true;
		return this;
	}

	/**
	 * Stop and reset the current animation to its first frame (see {@link Sprite#stop}).
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	stop() {
		this.animationpause = true;
		this._frameAnim.rewind();
		return this;
	}

	/**
	 * Force the current animation frame index (see {@link Sprite#setAnimationFrame}).
	 * @param {number} [index=0] - animation frame index
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	setAnimationFrame(index = 0) {
		this._frameAnim.setAnimationFrame(index);
		return this;
	}

	/**
	 * Apply a texture region directly (see {@link Sprite#setRegion}).
	 * @param {object} region - typically from `texture.getRegion(name)`
	 * @returns {Sprite3d} Reference to this object for method chaining
	 */
	setRegion(region) {
		this._frameAnim.setRegion(region);
		return this;
	}

	/**
	 * @param {string} name - animation id
	 * @returns {boolean} true if `name` is the current animation (see {@link Sprite#isCurrentAnimation}).
	 */
	isCurrentAnimation(name) {
		return this._frameAnim.isCurrentAnimation(name);
	}

	/**
	 * @returns {string[]} the names of every defined animation (see {@link Sprite#getAnimationNames}).
	 */
	getAnimationNames() {
		return this._frameAnim.getAnimationNames();
	}

	/**
	 * @returns {number} the current animation frame index (see {@link Sprite#getCurrentAnimationFrame}).
	 */
	getCurrentAnimationFrame() {
		return this._frameAnim.getCurrentAnimationFrame();
	}

	/**
	 * The frame object for the given index within the current animation.
	 * @param {number} id - the frame id
	 * @returns {object} the frame data
	 * @ignore
	 */
	getAnimationFrameObjectByIndex(id) {
		return this._frameAnim.getAnimationFrameObjectByIndex(id);
	}

	/**
	 * Apply the current frame's texture region to the quad — the geometry hook
	 * called by the shared {@link FrameAnimation} engine (the 3D counterpart of
	 * {@link Sprite}'s sub-texture / size / anchor swap). Rewrites both the quad's
	 * UVs (the atlas sub-rect, with a 90° corner permutation for packer-rotated
	 * regions) and its local vertices (the trimmed art's sub-rectangle within the
	 * logical frame, scaled into the quad's world footprint), so trimmed and
	 * rotated `TextureAtlas` regions render at full parity with the 2D `Sprite`.
	 * @param {object} region - the texture region object
	 * @ignore
	 */
	_applyFrame(region) {
		// remember the region so a later flipX/flipY can re-map immediately
		this._region = region;
		// the texture backing this frame (full sheet for a spritesheet, the atlas
		// page for a packed atlas)
		const image = this.source.getTexture(region);
		const iw = image.width;
		const ih = image.height;

		// `region.width`/`height` are the art's UNROTATED dimensions; a
		// packer-rotated region occupies a height×width box in the atlas.
		const rotated = region.angle !== 0;
		const aw = region.width;
		const ah = region.height;
		const atlasW = rotated ? ah : aw;
		const atlasH = rotated ? aw : ah;

		// ── UVs: the atlas AABB, corners permuted 90° when the region is rotated
		const ox = region.offset.x;
		const oy = region.offset.y;
		const uL = ox / iw;
		const uR = (ox + atlasW) / iw;
		// texture-space top is the smaller pixel y; the baked UVs put v=0 at the
		// top corners (local +y) so the frame lands upright under Y-down.
		const vT = oy / ih;
		const vB = (oy + atlasH) / ih;
		const uv = this.uvs;
		// corners: 0=(left,bottom) 1=(right,bottom) 2=(right,top) 3=(left,top)
		if (rotated) {
			// TexturePacker stores rotated art 90° clockwise, so undo it by
			// rotating the corner→UV assignment: the quad's left edge samples the
			// atlas top row, its top edge samples the atlas right column.
			uv[0] = uL;
			uv[1] = vT; // BL → atlas top-left
			uv[2] = uL;
			uv[3] = vB; // BR → atlas bottom-left
			uv[4] = uR;
			uv[5] = vB; // TR → atlas bottom-right
			uv[6] = uR;
			uv[7] = vT; // TL → atlas top-right
		} else {
			uv[0] = uL;
			uv[1] = vB;
			uv[2] = uR;
			uv[3] = vB;
			uv[4] = uR;
			uv[5] = vT;
			uv[6] = uL;
			uv[7] = vT;
		}

		// ── geometry: place the (possibly trimmed) art rect inside the logical
		// frame. Logical size is the untrimmed sourceSize; the art occupies a
		// sub-rect offset by `trim`. The world quad (±_halfW/±_halfH) maps the
		// logical frame captured from the first applied frame, so trimmed frames
		// keep their position/size relative to the full sprite footprint.
		const trimmed = region.trimmed === true && region.sourceSize != null;
		const logicalW = trimmed ? region.sourceSize.w : aw;
		const logicalH = trimmed ? region.sourceSize.h : ah;
		const tx = region.trim ? region.trim.x : 0;
		const ty = region.trim ? region.trim.y : 0;
		if (this._refLw === 0) {
			this._refLw = logicalW;
			this._refLh = logicalH;
		}
		// world units per logical pixel
		const sx = (2 * this._halfW) / this._refLw;
		const sy = (2 * this._halfH) / this._refLh;
		// art rect in centered local space (texture top = +y, render Y-down)
		let xl = (tx - logicalW / 2) * sx;
		let xr = (tx + aw - logicalW / 2) * sx;
		let yt = (logicalH / 2 - ty) * sy;
		let yb = (logicalH / 2 - (ty + ah)) * sy;
		// mirror the local quad around its origin for flips — uniform across the
		// billboard + fixed paths and independent of atlas rotation/trim (each
		// corner's UV is unchanged, so the texture mirrors)
		if (this._flipX) {
			xl = -xl;
			xr = -xr;
		}
		if (this._flipY) {
			yt = -yt;
			yb = -yb;
		}
		const v = this.originalVertices;
		// c0 BL, c1 BR, c2 TR, c3 TL (z stays 0)
		v[0] = xl;
		v[1] = yb;
		v[3] = xr;
		v[4] = yb;
		v[6] = xr;
		v[7] = yt;
		v[9] = xl;
		v[10] = yt;
		// the frame changed → this sprite needs a redraw (the host owns its dirty
		// flag; the FrameAnimation engine never sets it)
		this.isDirty = true;
	}

	/**
	 * Advance the frame animation, then defer to the standard mesh update.
	 * @param {number} dt - time since the last update in milliseconds
	 * @returns {boolean} true if the sprite changed and needs a redraw
	 * @ignore
	 */
	update(dt) {
		// advance the engine first (a frame change marks this sprite dirty via
		// `_applyFrame`), then let `super.update` report `isDirty` — same order and
		// single-source-of-truth as Sprite
		this._frameAnim.update(dt);
		return super.update(dt);
	}

	/**
	 * Release resources (returns the engine's pooled `current.offset` to the
	 * pool), then defer to the standard mesh/renderable teardown.
	 * @ignore
	 */
	destroy() {
		this._frameAnim.destroy();
		this._region = null;
		super.destroy();
	}

	/**
	 * Capture the rendering camera so {@link Sprite3d#_projectVerticesWorld} can
	 * orient the billboard toward it. Read from the per-draw `viewport` (passed
	 * by `Container.draw`), so a multi-camera stage billboards correctly against
	 * whichever camera is drawing. When no `Camera3d` viewport is supplied the
	 * billboard is inactive and the quad renders fixed-orientation.
	 * @param {CanvasRenderer|WebGLRenderer} renderer
	 * @param {Camera2d} [viewport]
	 * @ignore
	 */
	draw(renderer, viewport) {
		this._billboardCam = viewport instanceof Camera3d ? viewport : null;
		super.draw(renderer, viewport);
	}

	/**
	 * Orient the quad toward the camera when billboarding; otherwise defer to the
	 * standard {@link Mesh} world projection (a fixed-orientation quad).
	 * @ignore
	 */
	_projectVerticesWorld(offsetX, offsetY, offsetZ) {
		const mode = this.billboard;
		const cam = this._billboardCam;
		if (mode === false || mode === "none" || cam === null) {
			super._projectVerticesWorld(offsetX, offsetY, offsetZ);
			return;
		}

		// camera basis (world space): right / up / forward. Note `getBasis`
		// returns a math basis (+Y up) while render space is Y-down — each mode
		// below resolves that sign so the card lands right-way-up.
		cam.getBasis(_right, _up, _fwd);

		if (mode === "cylindrical" || mode === true) {
			// stay upright: up = world up (-Y in render space), right = horizontal
			// axis = forward × up (this order makes the front face the camera).
			// Falls back to the camera right when looking straight up/down
			// (forward ∥ world up → degenerate cross product).
			_up.copy(WORLD_UP);
			_right.copy(_fwd).cross(WORLD_UP);
			if (_right.length() < 1e-4) {
				cam.getRight(_right);
			} else {
				_right.normalize();
			}
		} else {
			// spherical: face the camera on all axes. `getBasis` returns a math
			// (+Y up) basis, but render space is Y-down — so the camera's "up"
			// actually points screen-DOWN. Negate it to get the screen-up axis
			// (matching WORLD_UP at head-on), then right = forward × up to match
			// the cylindrical handedness so the front face — not the mirrored
			// back — points at the camera.
			_up.negateSelf();
			_right.copy(_fwd).cross(_up);
			if (_right.length() < 1e-4) {
				cam.getRight(_right);
			} else {
				_right.normalize();
			}
		}

		// emit the 4 corners as center ± right·localX ± up·localY (the local
		// offsets are the baked ±hw / ±hh quad coordinates)
		const out = this.vertices;
		const src = this.originalVertices;
		const rx = _right.x;
		const ry = _right.y;
		const rz = _right.z;
		const ux = _up.x;
		const uy = _up.y;
		const uz = _up.z;
		for (let i = 0; i < 4; i++) {
			const i3 = i * 3;
			const lx = src[i3];
			const ly = src[i3 + 1];
			out[i3] = offsetX + rx * lx + ux * ly;
			out[i3 + 1] = offsetY + ry * lx + uy * ly;
			out[i3 + 2] = offsetZ + rz * lx + uz * ly;
		}
	}
}
