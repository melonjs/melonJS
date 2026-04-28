import { randomFloat } from "./../math/math.ts";
import Container from "./../renderable/container.js";
import timer from "../system/timer.ts";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import { particlePool } from "./particle.ts";
import defaultEmitterSettings, {
	type ParticleEmitterSettings,
} from "./settings.ts";

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
		// call the super constructor
		super(x, y, settings.width || 1, settings.height || 1);

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

	/**
	 * Reset the emitter with particle emitter settings.
	 * @param settings - object with emitter settings. See {@link ParticleEmitterSettings}
	 */
	override reset(settings: Partial<ParticleEmitterSettings> = {}): void {
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

		if (typeof this.settings.image === "undefined") {
			this._defaultParticle = createDefaultParticleTexture(
				this.settings.textureSize,
				this.settings.textureSize,
			);
			this.settings.image = this._defaultParticle.canvas;
		}

		this.floating = this.settings.floating;

		this.isDirty = true;
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

	// Add count particles in the game world
	/** @ignore */
	addParticles(count: number): void {
		// pos is an ObservableVector3d at runtime; the renderable typedef exposes
		// it as Vector2d, so we read .z through an unknown cast.
		const z = (this.pos as unknown as { z: number }).z;
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

		// Update particles
		this.isDirty = this.isDirty || super.update(dt);

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
		this.settings.image = undefined;
		this.settings = undefined as unknown as ParticleEmitterSettings;
	}
}
