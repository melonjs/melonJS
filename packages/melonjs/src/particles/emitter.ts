import { randomFloat } from "./../math/math.ts";
import { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d } from "../math/vector2d.ts";
import Container from "./../renderable/container.js";
import timer from "../system/timer.ts";
import type CanvasRenderer from "../video/canvas/canvas_renderer.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import type WebGLRenderer from "../video/webgl/webgl_renderer.js";
import { particlePool } from "./particle.ts";
import defaultEmitterSettings, {
	type ParticleEmitterSettings,
} from "./settings.ts";

/**
 * Scratch matrices for the reference-space correction. Shared across every
 * emitter rather than held per instance: the values are consumed within the
 * call that produces them, and a `Matrix3d` is a `Float32Array(16)`. Two
 * distinct ones because a single scratch reused twice would clobber the first
 * operand mid-computation.
 * @ignore
 */
const _m1 = new Matrix3d();
/** @ignore */
const _m2 = new Matrix3d();
/** @ignore */
const _correction = new Matrix3d();
/** @ignore */
const _rebase = new Vector2d();

/**
 * @ignore
 */
function createDefaultParticleTexture(
	w: number = 8,
	h: number = 8,
): CanvasRenderTarget {
	const defaultParticleTexture = new CanvasRenderTarget(w, h, {
		offscreenCanvas: true,
	});

	defaultParticleTexture.context.fillStyle = "#fff";
	defaultParticleTexture.context.fillRect(0, 0, w, h);

	return defaultParticleTexture;
}

/**
 * If `settings[minKey] > settings[maxKey]`, lower `min` to `max`.
 * Guards against the partial-override footgun where a user sets only the
 * `max` half of a range-style setting and the default of `min` ends up larger.
 * @ignore
 */
function clampMinToMax<K extends keyof ParticleEmitterSettings>(
	settings: ParticleEmitterSettings,
	minKey: K,
	maxKey: K,
): void {
	if ((settings[minKey] as number) > (settings[maxKey] as number)) {
		(settings as Record<K, number>)[minKey] = settings[maxKey] as number;
	}
}

/**
 * Particle Emitter Object.
 *
 * ### Blend modes
 *
 * An emitter draws no pixels of its own: every {@link Particle} is a
 * renderable in its own right and carries its own blend mode. Assigning
 * `emitter.blendMode` applies the mode to the particles — both the ones
 * already alive and, through {@link ParticleEmitterSettings.blendMode}, the
 * ones emitted afterwards. The change is picked up on the emitter's next
 * `update`, so within the same frame.
 *
 * ```js
 * emitter.blendMode = "overlay";   // live particles AND future ones
 * ```
 *
 * ### Reference space
 *
 * A particle stores a position, and
 * {@link ParticleEmitterSettings.referenceSpace} decides what that position is
 * measured against. By default it is the emitter, so a moving emitter carries
 * its whole cloud along — right for a flame or an aura, wrong for anything
 * emitted and then abandoned. Set it to `"world"` and the position names a
 * place in the level instead, so the emitter moves away and leaves the
 * particles behind; that is a trail. Pass a {@link Container} to measure from
 * something else entirely.
 *
 * Changing it at runtime — by assigning the property or through
 * {@link ParticleEmitter#reset} — re-bases the particles already alive, so the
 * cloud does not jump; only its subsequent motion changes.
 *
 * Two things are worth knowing before reaching for a non-local space. The
 * emitter is treated as always visible while it has live particles, because
 * otherwise a trail would vanish the moment the emitter that made it scrolled
 * off-screen (the particles themselves are still culled individually). And
 * `clipping` or a `backgroundColor` on the emitter would be applied in the
 * emitter's own frame rather than the particles', so neither composes with
 * this.
 *
 * ```js
 * // exhaust that stays where it was emitted
 * const emitter = new ParticleEmitter(x, y, { referenceSpace: "world" });
 * ```
 * @category Particles
 */
export default class ParticleEmitter extends Container {
	/**
	 * the current (active) emitter settings (with defaults merged in)
	 */
	settings: ParticleEmitterSettings;

	/** @ignore */
	_stream: boolean;

	/** @ignore */
	_frequencyTimer: number;

	/** @ignore */
	_durationTimer: number;

	/** @ignore */
	_enabled: boolean;

	/** @ignore */
	_updateCount: number;

	/** @ignore */
	_dt: number;

	/** @ignore */
	_defaultParticle: CanvasRenderTarget | undefined;

	/**
	 * The blend mode last fanned out to the particles, so a change to
	 * {@link ParticleEmitter#blendMode} can be detected per frame.
	 * @ignore
	 */
	#appliedBlendMode: string = "normal";

	/**
	 * whether at least one particle has been spawned by this emitter — used as
	 * the precondition for completion detection (a brand-new emitter with zero
	 * children must not count as "complete")
	 * @ignore
	 */
	_hasSpawned: boolean;

	/**
	 * cached `timer.maxfps / 1000` — particles read this directly instead of
	 * recomputing it on every spawn.
	 * @ignore
	 */
	_deltaInv: number;

	/**
	 * Maps an emitter-local spawn point into the reference frame the particles
	 * live in, so a particle is BORN where the emitter is even though its
	 * position is thereafter measured from somewhere else. `undefined` in
	 * local mode, where the two frames coincide and no mapping is needed.
	 *
	 * Held per emitter (not a module scratch) because particles read it during
	 * their own reset, after `addParticles` has computed it. One matrix per
	 * emitter that actually uses a non-local space — emitters are few, unlike
	 * particles, which allocate nothing.
	 * @ignore
	 */
	_spawnMap: Matrix3d | undefined;

	/**
	 * @param x - x position of the particle emitter
	 * @param y - y position of the particle emitter
	 * @param [settings=ParticleEmitterSettings] - the settings for the particle emitter.
	 * @example
	 * // Create a particle emitter at position 100, 100
	 * let emitter = new ParticleEmitter(100, 100, {
	 *     width: 16,
	 *     height : 16,
	 *     tint: "#f00",
	 *     totalParticles: 32,
	 *     angle: 0,
	 *     angleVariation: 6.283185307179586,
	 *     maxLife: 5,
	 *     speed: 3
	 * });
	 *
	 * // Add the emitter to the game world
	 * app.world.addChild(emitter);
	 *
	 * // Launch all particles one time and stop, like an explosion
	 * emitter.burstParticles();
	 *
	 * // Launch constantly the particles, like a fountain
	 * emitter.streamParticles();
	 *
	 * // At the end, remove emitter from the game world
	 * // call this in onDestroyEvent function
	 * app.world.removeChild(emitter);
	 */
	constructor(
		x: number,
		y: number,
		settings: Partial<ParticleEmitterSettings> = {},
	) {
		// call the super constructor — `??` (not `||`) so a deliberate width/height
		// of 0 (point emitter) survives, only `undefined` falls back to 1.
		super(x, y, settings.width ?? 1, settings.height ?? 1);

		// settings will be fully populated by reset() below; start with defaults
		this.settings = { ...defaultEmitterSettings };

		// center the emitter around the given coordinates
		this.centerOn(x, y);

		// stream mode flag
		this._stream = false;
		// frequency timer (ms) — stream mode only
		this._frequencyTimer = 0;
		// duration timer (ms) — stream mode only
		this._durationTimer = 0;
		// whether the emitter is currently emitting
		this._enabled = false;
		// emitter ticks regardless of viewport
		this.alwaysUpdate = true;
		// preserve insertion order — particle z-sort would be wasted work
		this.autoSort = false;
		// frame-skip bookkeeping
		this._updateCount = 0;
		this._dt = 0;
		// completion tracking
		this._hasSpawned = false;
		// per-spawn delta inverse — populated by reset()
		this._deltaInv = timer.maxfps / 1000;

		// Apply user overrides + clamp range pairs
		this.reset(settings);
	}

	override reset(settings: Partial<ParticleEmitterSettings> = {}): void {
		// captured before the wholesale assign below, so a reference space
		// arriving through `reset()` re-bases live particles exactly as the
		// accessor does rather than teleporting them. `#frameOf` needs the
		// settings intact, hence reading it here.
		const previousFrame = this.#frameOf(this.settings?.referenceSpace);

		Object.assign(this.settings, defaultEmitterSettings, settings);

		// Clamp range-style settings: if `min > max`, lower `min` to `max`.
		// Catches the common footgun where a user overrides only one half of
		// a min/max pair (e.g. `maxLife: 5` while `minLife` keeps its 1000 ms
		// default), which would otherwise produce a wide unintended range.
		clampMinToMax(this.settings, "minLife", "maxLife");
		clampMinToMax(this.settings, "minStartScale", "maxStartScale");
		clampMinToMax(this.settings, "minEndScale", "maxEndScale");
		clampMinToMax(this.settings, "minRotation", "maxRotation");

		// refresh the cached delta inverse — `timer.maxfps` is constant after
		// boot but reset() runs after VIDEO_INIT, so this is the safest place.
		this._deltaInv = timer.maxfps / 1000;

		// dispose any previously-created fallback texture. Switching to a
		// user-provided image *or* re-creating the default fallback both make
		// the old CanvasRenderTarget unreachable, so destroy it eagerly to
		// avoid a leak across repeated reset() calls.
		if (typeof this._defaultParticle !== "undefined") {
			this._defaultParticle.destroy();
			this._defaultParticle = undefined;
		}
		if (typeof this.settings.image === "undefined") {
			this._defaultParticle = createDefaultParticleTexture(
				this.settings.textureSize,
				this.settings.textureSize,
			);
			this.settings.image = this._defaultParticle.canvas;
		}

		this.floating = this.settings.floating;
		// keep the property in step with the setting, so constructing (or
		// resetting) with `{ blendMode }` leaves `emitter.blendMode` reporting
		// it rather than the "normal" the Renderable constructor assigned
		this.blendMode = this.settings.blendMode;
		this.#appliedBlendMode = this.settings.blendMode;

		// no-op from the constructor (no children yet) and whenever the
		// reference space is unchanged
		this.#rebase(previousFrame);

		this.isDirty = true;
	}

	/**
	 * What a particle's position is measured against — see
	 * {@link ParticleEmitterSettings.referenceSpace}.
	 *
	 * Assigning this re-bases every particle already alive into the new frame,
	 * so nothing jumps: the cloud stays exactly where it is on screen and only
	 * its subsequent motion differs. Passing it through
	 * {@link ParticleEmitter#reset} does the same.
	 * @default "local"
	 * @example
	 * emitter.referenceSpace = "world";   // start leaving a trail
	 */
	get referenceSpace(): "local" | "world" | Container {
		return this.settings.referenceSpace;
	}

	set referenceSpace(space: "local" | "world" | Container) {
		if (space === this.settings.referenceSpace) {
			return;
		}

		const previous = this.#frameOf(this.settings.referenceSpace);
		this.settings.referenceSpace = space;
		this.#rebase(previous);
	}

	/**
	 * Map the particles already alive out of the frame they were simulating
	 * in and into the current one, so a change of reference space is
	 * invisible at the instant it happens: the cloud stays exactly where it
	 * is on screen and only its subsequent motion differs.
	 *
	 * Called from the accessor and from {@link ParticleEmitter#reset} alike —
	 * `reset()` assigns `settings` wholesale and would otherwise leave live
	 * particles holding coordinates measured against a frame that is no
	 * longer theirs, teleporting the lot.
	 * @ignore
	 * @param previous - the frame the live particles are currently in
	 */
	#rebase(previous: Container): void {
		const next = this.#frameOf(this.settings.referenceSpace);

		if (previous !== next) {
			// p_new = inv(W_next) · W_previous · p_old
			_m1.identity();
			_m1.multiply(this.#worldFrame(next, _m2).invert());
			_m1.multiply(this.#worldFrame(previous, _m2));
			for (const particle of this.getChildren()) {
				_rebase.set(particle.pos.x, particle.pos.y);
				_m1.apply(_rebase);
				// assigned component-wise rather than through `set()`, which
				// would default the z component to 0 and flatten the depth
				// `addParticles` gave this particle
				particle.pos.x = _rebase.x;
				particle.pos.y = _rebase.y;
			}
		}

		this._spawnMap = undefined;
		this.isDirty = true;
	}

	/**
	 * Resolve a reference-space value to the container whose frame the
	 * particles live in. Returns `this` whenever the answer is "the emitter
	 * itself" — including the degenerate cases (`"world"` on an emitter with no
	 * parent, or a custom target that IS the emitter), which then take the
	 * local fast path with no correction at all.
	 * @ignore
	 */
	#frameOf(space: "local" | "world" | Container): Container {
		if (space === "local") {
			return this;
		}
		if (space === "world") {
			return (this.ancestor as Container) ?? this;
		}
		// A destroyed container has had its `pos` cleared, so measuring
		// against it would throw from inside the render loop. Nothing can be
		// salvaged from a frame that no longer exists, but falling back to
		// local keeps the particles on screen instead of taking the frame
		// down with them.
		if (!space || typeof space.pos === "undefined") {
			return this;
		}
		return space;
	}

	/**
	 * The world transform of a reference frame — i.e. of the space that
	 * container's children are drawn in.
	 * @ignore
	 */
	#worldFrame(frame: Container, out: Matrix3d): Matrix3d {
		return frame.getWorldTransform(out);
	}

	/**
	 * The transform to insert before walking the children so they are drawn in
	 * the reference frame instead of the emitter's own.
	 *
	 * At the insertion point the renderer holds `W_ancestor · preContrib`, and
	 * `Container.draw` appends `T(pos)` afterwards, so what we need is
	 *
	 * ```
	 * K = inv(preContrib) · inv(W_ancestor) · W_target · T(−pos)
	 * ```
	 *
	 * expressed below via `inv(preContrib) = T(pos) · inv(L)`. Note this is
	 * NOT `inv(W_emitter) · W_target` — matrices do not commute, and that form
	 * only coincides with this one when both chains share the same linear
	 * part, which hides the difference until something upstream is rotated.
	 *
	 * When the target is the emitter's own parent — the `"world"` case — the
	 * whole ancestor chain cancels and no walk happens at all.
	 * @ignore
	 * @returns the correction, or `undefined` in local mode
	 */
	#correctionMatrix(): Matrix3d | undefined {
		const target = this.#frameOf(this.settings.referenceSpace);
		if (target === this) {
			return undefined;
		}

		_correction.identity();
		_correction.translate(this.pos.x, this.pos.y);
		_correction.multiply(this.getLocalTransform(_m1).invert());

		if (target !== this.ancestor) {
			if (this.ancestor) {
				_correction.multiply(
					(this.ancestor as Container).getWorldTransform(_m1).invert(),
				);
			}
			_correction.multiply(target.getWorldTransform(_m2));
		}

		_correction.translate(-this.pos.x, -this.pos.y);
		return _correction;
	}

	/**
	 * returns a random point on the x axis within the bounds of this emitter
	 * @returns a random x position within the emitter bounds
	 */
	getRandomPointX(): number {
		return randomFloat(0, this.getBounds().width);
	}

	/**
	 * returns a random point on the y axis within the bounds this emitter
	 * @returns a random y position within the emitter bounds
	 */
	getRandomPointY(): number {
		return randomFloat(0, this.getBounds().height);
	}

	/**
	 * Draw the particles in their reference frame rather than the emitter's.
	 *
	 * The correction goes in before `super.draw()` because that is where the
	 * child walk happens; translations and the correction compose, and in
	 * local mode there is no correction and this is the inherited path
	 * untouched.
	 * @ignore
	 */
	override draw(
		renderer: CanvasRenderer | WebGLRenderer,
		viewport?: Parameters<Container["draw"]>[1],
	): void {
		const correction = this.#correctionMatrix();
		if (correction !== undefined) {
			renderer.transform(correction);
		}
		super.draw(renderer, viewport);
	}

	// Add count particles in the game world
	/** @ignore */
	addParticles(count: number): void {
		// Propagate the emitter's depth onto each new particle via
		// `Container.addChild(child, z)` so Camera3d projects them at
		// the emitter's z slice (not at the world origin, which would
		// place them on the wrong perspective plane for explosions /
		// exhaust trails attached to a moving Mesh).
		// `Renderable.depth` proxies to `pos.z` — same value, no cast.
		const z = this.depth;

		// Refresh the spawn mapping once for the whole batch, not per
		// particle: every particle in this call is born in the same frame.
		// `S = inv(W_target) · W_emitter` takes an emitter-local point to the
		// place in the reference frame where the emitter currently is, which
		// is what freezes a trail behind a moving emitter.
		const target = this.#frameOf(this.settings.referenceSpace);
		if (target === this) {
			this._spawnMap = undefined;
		} else {
			const map = this._spawnMap ?? (this._spawnMap = new Matrix3d());
			if (target === this.ancestor) {
				// `"world"`: the ancestor chain cancels outright, since
				// `W_emitter = W_ancestor · L_emitter` leaves
				// `S = inv(W_ancestor) · W_ancestor · L_emitter = L_emitter`.
				// Worth the branch — a streaming emitter runs this every few
				// frames, and the general form walks the chain twice.
				map.copy(this.getLocalTransform(_m1));
			} else {
				map.identity();
				map.multiply(target.getWorldTransform(_m1).invert());
				map.multiply(this.getWorldTransform(_m2));
			}
		}

		for (let i = 0; i < count; i++) {
			// Add particle to the container
			this.addChild(particlePool.get(this), z);
		}
		if (count > 0) {
			this._hasSpawned = true;
		}
		this.isDirty = true;
	}

	/**
	 * Emitter is of type stream and is launching particles
	 * @returns Emitter is Stream and is launching particles
	 */
	isRunning(): boolean {
		return this._enabled && this._stream;
	}

	/**
	 * Launch particles from emitter constantly (e.g. for stream)
	 * @param [duration] - time that the emitter releases particles in ms
	 */
	streamParticles(duration?: number): void {
		this._enabled = true;
		this._stream = true;
		this.settings.frequency = Math.max(1, this.settings.frequency);
		this._durationTimer =
			typeof duration === "number" ? duration : this.settings.duration;
	}

	/**
	 * Stop the emitter from generating new particles (used only if emitter is Stream)
	 */
	stopStream(): void {
		this._enabled = false;
	}

	/**
	 * Launch all particles from emitter and stop (e.g. for explosion)
	 * @param [total] - number of particles to launch
	 */
	burstParticles(total?: number): void {
		this._enabled = true;
		this._stream = false;
		this.addParticles(
			typeof total === "number" ? total : this.settings.totalParticles,
		);
		this._enabled = false;
	}

	/**
	 * @ignore
	 */
	override update(dt: number): boolean {
		// Fan a changed blend mode out to the particles.
		//
		// An emitter draws no pixels of its own — each Particle is a
		// renderable that carries its own blend mode, copied from
		// `settings.blendMode` when it is BORN. So assigning
		// `emitter.blendMode` (the plain `Renderable` field) reaches nothing
		// on its own, which reads as "particles do not support blend modes".
		// Detect the change here instead: one string compare per emitter per
		// frame, rather than an accessor on `Renderable` that every renderable
		// in the scene would pay for on every `preDraw`.
		if (this.blendMode !== this.#appliedBlendMode) {
			this.#appliedBlendMode = this.blendMode;
			// future particles inherit it at birth...
			this.settings.blendMode = this.blendMode;
			// ...and the ones already alive switch now, rather than the mode
			// fading in over a particle lifetime
			for (const particle of this.children ?? []) {
				particle.blendMode = this.blendMode;
			}
			this.isDirty = true;
		}

		// frame-skip: only do the bookkeeping when actually configured.
		// Defaults to 0 (every frame), and that path is the hot one.
		if (this.settings.framesToSkip > 0) {
			if (++this._updateCount > this.settings.framesToSkip) {
				this._updateCount = 0;
			}
			if (this._updateCount > 0) {
				this._dt += dt;
				return this.isDirty;
			}
			dt += this._dt;
			this._dt = 0;
		}

		// Update particles. `super.update(dt)` walks every child
		// (each Particle) through Container.update — visibility check,
		// per-particle `update(dt)`, etc. CRITICAL: assign it to a
		// local first, then OR into `this.isDirty`. Writing this as
		// `this.isDirty = this.isDirty || super.update(dt)` would
		// short-circuit when `isDirty` is already true (very common),
		// silently skipping the whole child walk — particles would
		// keep `inViewport = false` and never draw.
		const childrenDirty = super.update(dt);
		this.isDirty = this.isDirty || childrenDirty;

		// Particles left behind in another frame outlive the emitter's own
		// position, but `Container.draw` gates every child on the PARENT's
		// `inViewport` and an emitter's bounds do not cover its children. So
		// a trail would vanish the instant the emitter it came from scrolled
		// off-screen. Re-assert visibility here — the parent assigns
		// `inViewport` just before calling this, and draw happens after, so
		// this is the last word for the frame. Particles are still culled
		// individually inside our own child walk, so nothing extra rasterizes.
		if (
			this.#frameOf(this.settings.referenceSpace) !== this &&
			this.getChildren().length > 0
		) {
			this.inViewport = true;
		}

		// Launch new particles, if emitter is Stream
		if (this._enabled && this._stream) {
			// Check if the emitter has duration set
			if (this._durationTimer !== Infinity) {
				this._durationTimer -= dt;

				if (this._durationTimer <= 0) {
					this.stopStream();
					return this.isDirty;
				}
			}

			// Increase the emitter launcher timer
			this._frequencyTimer += dt;

			// Check for new particles launch
			const particlesCount = this.getChildren().length;
			if (
				particlesCount < this.settings.totalParticles &&
				this._frequencyTimer >= this.settings.frequency
			) {
				this.addParticles(
					Math.min(
						this.settings.maxParticles,
						this.settings.totalParticles - particlesCount,
					),
				);
				this._frequencyTimer = 0;
				this.isDirty = true;
			}
		}

		// completion detection — fires once after at least one particle has
		// been spawned, the emitter is no longer producing new ones, and all
		// children have died. Covers both burst (instant _enabled = false) and
		// stream (duration elapsed → stopStream()).
		if (this._hasSpawned && !this._enabled && this.getChildren().length === 0) {
			// guard against re-entry: clear the flag so we only fire once
			this._hasSpawned = false;
			if (typeof this.settings.onComplete === "function") {
				this.settings.onComplete.call(this);
			}
			if (this.settings.autoDestroyOnComplete && this.ancestor) {
				(this.ancestor as Container).removeChild(this);
			}
		}

		return this.isDirty;
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	override destroy(): void {
		super.destroy();
		if (typeof this._defaultParticle !== "undefined") {
			this._defaultParticle.destroy();
			this._defaultParticle = undefined;
		}
		// Clear the image reference so a discarded emitter doesn't pin a
		// (potentially large) image / canvas alive via `settings.image`.
		// `this.settings = undefined` was here too but offered no GC win
		// — once the emitter itself is unreferenced, `settings` follows —
		// and it required a `as unknown as ParticleEmitterSettings` cast
		// that lied about the field type. Dropped.
		this.settings.image = undefined;
		// a custom reference space holds a reference to a whole container —
		// release it for the same reason, so a discarded emitter cannot pin
		// an entire subtree alive
		this.settings.referenceSpace = "local";
		this._spawnMap = undefined;
	}
}
