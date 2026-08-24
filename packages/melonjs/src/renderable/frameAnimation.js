import { vector2dPool } from "../math/vector2d.ts";
import { parseAnimationOptions } from "./animation.ts";

/**
 * additional import for TypeScript
 * @import { TextureAtlas } from "../video/texture/atlas.js";
 * @import { Vector2d } from "../math/vector2d.js";
 */

/**
 * The shared **frame-animation engine** behind {@link Sprite} (2D) and
 * {@link Sprite3d} (3D billboards). It *owns* the animation state — definitions,
 * the current frame, timing, looping and chaining — everything independent of
 * how a frame is ultimately *drawn*, and drives its host renderable through a
 * small contract:
 *
 * - it reads the host's resolved texture (`host.source`, `host.textureAtlas`,
 *   `host.atlasIndices`) to turn a frame index/name into a region;
 * - it calls the `applyFrame(region)` callback passed to the constructor whenever
 *   the frame changes — the host applies it to its own geometry ({@link Sprite}
 *   swaps its source sub-texture, size and anchor; {@link Sprite3d} maps the
 *   region onto its quad's UVs + vertices) **and marks itself dirty there**;
 * - it fires `host.onended()` at each cycle end.
 *
 * The engine owns no dirty flag: a frame change flows through `applyFrame`, where
 * the host sets its own `isDirty`. Callers read dirtiness from the host (the
 * host's `update()` returns `super.update()` → `isDirty`).
 *
 * Hosts expose the public-facing state (`anim`, `current`, `animationspeed`,
 * `animationpause`, …) as thin accessors onto this engine, so 2D and 3D frame
 * animation share one implementation with no behavioral fork.
 * @category Animation
 */
export default class FrameAnimation {
	/**
	 * @param {object} host - the renderable this engine drives. Read for the
	 * texture it animates (`source` / `textureAtlas` / `atlasIndices`) and the
	 * mutable cycle-end callback (`onended`). These are read lazily (the texture is
	 * usually resolved after the engine is constructed), which is why they live on
	 * the host rather than being passed in. The engine does not touch `isDirty` —
	 * the host marks itself dirty inside `applyFrame`.
	 * @param {(region: object) => void} applyFrame - called whenever the frame
	 * changes, with the selected texture region; the host applies it to its own
	 * geometry (a {@link Sprite} swaps its sub-texture / size / anchor, a
	 * {@link Sprite3d} remaps its quad's UVs + vertices).
	 */
	constructor(host, applyFrame) {
		/**
		 * the host renderable this engine draws through.
		 * @type {object}
		 * @ignore
		 */
		this.host = host;

		/**
		 * geometry hook invoked on every frame change (see constructor).
		 * @type {(region: object) => void}
		 * @ignore
		 */
		this._applyFrame = applyFrame;

		/** defined animations, keyed by id @type {object} */
		this.anim = {};

		/** animation to chain to / completion callback on cycle end @ignore */
		this.resetAnim = undefined;

		/** current frame info @type {object} */
		this.current = {
			// the current animation name
			name: undefined,
			// length of the current animation
			length: 0,
			// current frame texture offset
			offset: vector2dPool.get(0, 0),
			// current frame size
			width: 0,
			height: 0,
			// source rotation angle for pre-rotating the source image
			angle: 0,
			// current frame index
			idx: 0,
			// trim offset for trimmed sprites
			trim: null,
		};

		/** elapsed time within the current frame, in ms @type {number} */
		this.dt = 0;

		/** default frame cycling speed (ms between frames) @type {number} */
		this.animationspeed = 100;

		/** pause flag — freezes the current frame @type {boolean} */
		this.animationpause = false;

		/** per-play speed multiplier (1 = authored speed) @ignore */
		this._animSpeed = 1;

		/** set once a `loop:false` animation has finished its single cycle @ignore */
		this._animDone = false;
	}

	/**
	 * add an animation definition (see {@link Sprite#addAnimation}).
	 * @param {string} name - animation id
	 * @param {number[]|string[]|object[]} index - frame indices / names / objects
	 * @param {number} [animationspeed] - cycling speed in ms
	 * @returns {number} number of frames added (0 if no texture atlas)
	 */
	addAnimation(name, index, animationspeed) {
		const host = this.host;
		this.anim[name] = {
			name: name,
			frames: [],
			idx: 0,
			length: 0,
		};

		// # of frames
		let counter = 0;

		if (typeof host.textureAtlas !== "object") {
			return 0;
		}

		if (index == null) {
			index = [];
			// create a default animation with all frame
			Object.keys(host.textureAtlas).forEach((v, i) => {
				index[i] = i;
			});
		}

		// set each frame configuration (offset, size, etc..)
		for (let i = 0, len = index.length; i < len; i++) {
			const frame = index[i];
			let frameObject;
			if (typeof frame === "number" || typeof frame === "string") {
				frameObject = {
					name: frame,
					delay: animationspeed || this.animationspeed,
				};
			} else {
				frameObject = frame;
			}
			const frameObjectName = frameObject.name;
			if (typeof frameObjectName === "number") {
				if (typeof host.textureAtlas[frameObjectName] !== "undefined") {
					// see https://github.com/melonjs/melonJS/issues/1281
					this.anim[name].frames[i] = Object.assign(
						{},
						host.textureAtlas[frameObjectName],
						frameObject,
					);
					counter++;
				}
			} else {
				// string
				if (host.source.getFormat().includes("Spritesheet")) {
					throw new Error(
						"string parameters for addAnimation are not allowed for standard spritesheet based Texture",
					);
				} else {
					this.anim[name].frames[i] = Object.assign(
						{},
						host.textureAtlas[host.atlasIndices[frameObjectName]],
						frameObject,
					);
					counter++;
				}
			}
		}
		this.anim[name].length = counter;

		return counter;
	}

	/**
	 * select the active animation (see {@link Sprite#setCurrentAnimation}).
	 * @param {string} name - animation id
	 * @param {string|Function|object} [resetAnim] - loop / chain / completion behavior
	 * @param {boolean} [preserve_dt=false] - keep the elapsed-frame timer
	 * @returns {object} the host (for method chaining)
	 */
	setCurrentAnimation(name, resetAnim, preserve_dt = false) {
		if (typeof this.anim[name] !== "undefined") {
			// re-selecting the already-current animation is a no-op (so the
			// common call-every-frame idiom doesn't restart it) — EXCEPT when
			// a play-once (`loop: false`) run has completed: without the
			// `_animDone` escape, a finished animation could never be
			// replayed (`_animDone` stayed set and new options were dropped)
			if (!this.isCurrentAnimation(name) || this._animDone) {
				this.current.name = name;
				this.current.length = this.anim[this.current.name].length;
				const opts = parseAnimationOptions(resetAnim);
				this._animSpeed = opts.speed;
				this._animDone = false;
				const onComplete = opts.onComplete;
				if (opts.legacyFn) {
					// legacy bare-function callback: invoked at each loop end,
					// return `false` to hold the last frame (contract unchanged)
					this.resetAnim = onComplete;
				} else if (typeof opts.next === "string") {
					// chain to another animation when this one ends (the legacy
					// string form and the options `next` field), firing
					// `onComplete` first when provided
					const next = opts.next;
					this.resetAnim = () => {
						if (typeof onComplete === "function") {
							onComplete();
							// The guard in `update()` runs after `resetAnim`
							// RETURNS, which is too late for this wrapper: it
							// re-enters the engine below, still inside the
							// call. A callback that destroyed the host has
							// already emptied `anim`, so chaining would throw
							// "animation id not defined" from inside what looks
							// to the caller like their own completion handler.
							if (!this._isCurrentAnimationLive()) {
								return false;
							}
						}
						this.setCurrentAnimation(next, null, true);
					};
				} else if (opts.loop === false) {
					// play once: fire onComplete, hold the last frame, and stop
					// advancing (without touching `animationpause`)
					this.resetAnim = () => {
						if (typeof onComplete === "function") {
							onComplete();
							// see the chain wrapper above. Writing `_animDone`
							// on a destroyed engine is harmless, but bailing
							// here keeps the two wrappers reading the same way
							if (!this._isCurrentAnimationLive()) {
								return false;
							}
						}
						this._animDone = true;
						return false;
					};
				} else if (typeof onComplete === "function") {
					// loop forever, firing onComplete at each cycle
					this.resetAnim = () => {
						onComplete();
					};
				} else {
					this.resetAnim = undefined;
				}
				// `setAnimationFrame(0)` applies frame 0 → `_applyFrame`, which is
				// where the host marks itself dirty (the engine never touches it).
				this.setAnimationFrame(0);
				if (!preserve_dt) {
					this.dt = 0;
				}
			}
		} else {
			throw new Error("animation id '" + name + "' not defined");
		}
		return this.host;
	}

	/**
	 * reverse the given (or current) animation in place (see {@link Sprite#reverseAnimation}).
	 * The host marks itself dirty (this path doesn't re-apply a frame, so it's the
	 * one place a host's `reverseAnimation` wrapper sets `isDirty`).
	 * @param {string} [name] - animation id
	 */
	reverseAnimation(name) {
		if (typeof name !== "undefined" && typeof this.anim[name] !== "undefined") {
			this.anim[name].frames.reverse();
		} else {
			this.anim[this.current.name].frames.reverse();
		}
	}

	/**
	 * @param {string} name - animation id
	 * @returns {boolean} true if `name` is the current animation
	 */
	isCurrentAnimation(name) {
		return this.current.name === name;
	}

	/**
	 * @returns {string[]} the names of every defined animation
	 */
	getAnimationNames() {
		return Object.keys(this.anim);
	}

	/**
	 * apply a texture region as the current frame: store its geometry into
	 * `current` and hand it to the host to draw (see {@link Sprite#setRegion}).
	 * @param {object} region - the texture region object
	 * @returns {object} the host (for method chaining)
	 */
	setRegion(region) {
		const current = this.current;
		// set the frame offset within the texture
		current.offset.setV(region.offset);
		// set angle if defined
		current.angle = typeof region.angle === "number" ? region.angle : 0;
		// update the current frame size (trimmed dimensions, used for drawing)
		current.width = region.width;
		current.height = region.height;
		// cache trim offset for drawing
		current.trim = region.trim || null;
		// hand the region to the host to apply to its own geometry; the host
		// marks itself dirty inside `_applyFrame` (the engine owns no dirty flag)
		this._applyFrame(region);
		return this.host;
	}

	/**
	 * force the current animation frame index (see {@link Sprite#setAnimationFrame}).
	 * @param {number} [index=0] - animation frame index
	 * @returns {object} the host (for method chaining)
	 */
	setAnimationFrame(index = 0) {
		this.current.idx = index % this.current.length;
		return this.setRegion(
			this.getAnimationFrameObjectByIndex(this.current.idx),
		);
	}

	/**
	 * @returns {number} the current animation frame index
	 */
	getCurrentAnimationFrame() {
		return this.current.idx;
	}

	/**
	 * the frame object for the given index within the current animation.
	 * @param {number} id - the frame id
	 * @returns {object} the frame data
	 */
	/**
	 * Whether the current animation is still resolvable.
	 *
	 * `update()` hands control to user code in the middle of its frame loop:
	 * `onended`, and the completion callback behind `resetAnim`. That code is
	 * free to tear the host down — "remove me once the animation finishes" is
	 * an entirely reasonable reaction, and `removeChildNow()` destroys the
	 * sprite, whose `destroy()` empties `anim`. Everything after the callback
	 * reads out of `anim`, so the loop has to check it is still there rather
	 * than resume into a map the callback just cleared.
	 *
	 * A callback that switches animations with `setCurrentAnimation()` leaves
	 * this true, which is the point: only a genuinely torn-down host stops the
	 * loop.
	 * @ignore
	 * @returns {boolean} true while the current animation can still be read
	 */
	_isCurrentAnimationLive() {
		return (
			this.current !== undefined &&
			this.current !== null &&
			this.anim[this.current.name] !== undefined
		);
	}

	getAnimationFrameObjectByIndex(id) {
		return this.anim[this.current.name].frames[id];
	}

	/**
	 * clear the frame timer and the play-once "done" hold, without changing the
	 * current frame (the timer half of a stop, used by the video path which has
	 * no frame to rewind to).
	 */
	resetTimer() {
		this._animDone = false;
		this.dt = 0;
	}

	/**
	 * reset the current animation to its first frame (the frame-animation half of
	 * {@link Sprite#stop} — the host still handles any video / pause concerns).
	 */
	rewind() {
		this.resetTimer();
		if (this.current.name !== undefined && this.current.length > 0) {
			this.setAnimationFrame(0);
		}
	}

	/**
	 * advance the frame animation by `dt` milliseconds, stepping frames, looping
	 * and chaining as configured (see {@link Sprite#update}). On a frame change the
	 * host marks itself dirty via `_applyFrame` (the engine owns no dirty flag);
	 * this returns whether a frame actually changed this tick — a finer-grained
	 * signal than the host's `isDirty` (which means "needs redraw for any reason").
	 * @param {number} dt - elapsed time since the last update, in milliseconds
	 * @returns {boolean} true if a frame changed this tick
	 */
	update(dt) {
		let changed = false;
		// a host torn down on an earlier tick whose `update()` is still being
		// called (a caller holding its own reference) has no animation left to
		// step; report "nothing changed" rather than throwing out of the frame
		if (!this._isCurrentAnimationLive()) {
			return changed;
		}
		if (!this.animationpause && !this._animDone && this.current.length > 1) {
			let duration = this.getAnimationFrameObjectByIndex(
				this.current.idx,
			).delay;
			// `_animSpeed` (per-play multiplier) scales how fast the frame
			// delay is consumed — 2 = twice as fast, 0.5 = half speed
			this.dt += dt * this._animSpeed;
			while (this.dt >= duration) {
				changed = true;
				this.dt -= duration;

				const nextFrame =
					this.current.length > 1 ? this.current.idx + 1 : this.current.idx;
				this.setAnimationFrame(nextFrame);

				// Switch animation if we reach the end of the strip and a callback is defined
				if (this.current.idx === 0) {
					if (typeof this.host.onended === "function") {
						this.host.onended();
						// the handler may have destroyed the host
						if (!this._isCurrentAnimationLive()) {
							break;
						}
					}
					if (typeof this.resetAnim === "function") {
						// Otherwise is must be callable
						const keepPlaying = this.resetAnim();
						// resolved BEFORE acting on the result: this is the
						// user's completion callback and carries the same
						// exposure as `onended` above, so its return value must
						// not be used to drive a frame change on a dead host
						if (!this._isCurrentAnimationLive()) {
							break;
						}
						if (keepPlaying === false) {
							// Reset to last frame
							this.setAnimationFrame(this.current.length - 1);

							// Bail early without skipping any more frames.
							this.dt %= duration;
							break;
						}
					}
				}
				// Get next frame duration
				duration = this.getAnimationFrameObjectByIndex(this.current.idx).delay;

				// a zero (or negative) frame delay would never drain `dt` and
				// spin this loop forever — treat it as "fastest possible":
				// advance at most one frame per update tick
				if (duration <= 0) {
					this.dt = 0;
					break;
				}
			}
		}
		return changed;
	}

	/**
	 * release engine-held resources — returns the pooled `current.offset`
	 * Vector2d to the pool. Call from the host's `destroy()`.
	 */
	destroy() {
		if (this.current.offset !== null) {
			vector2dPool.release(this.current.offset);
			this.current.offset = null;
		}
		this.anim = {};
		this.resetAnim = undefined;
	}
}
