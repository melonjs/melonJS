import { randomFloat } from "./../math/math.ts";
import Container from "./../renderable/container.js";
import CanvasRenderTarget from "../video/rendertarget/canvasrendertarget.js";
import { particlePool } from "./particle.ts";
import ParticleEmitterSettings from "./settings.js";

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
 * Particle Emitter Object.
 * @category Particles
 */
export default class ParticleEmitter extends Container {
	/**
	 * the current (active) emitter settings
	 */
	settings: Record<string, any>;

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
	 * me.game.world.addChild(emitter);
	 *
	 * // Launch all particles one time and stop, like an explosion
	 * emitter.burstParticles();
	 *
	 * // Launch constantly the particles, like a fountain
	 * emitter.streamParticles();
	 *
	 * // At the end, remove emitter from the game world
	 * // call this in onDestroyEvent function
	 * me.game.world.removeChild(emitter);
	 */
	constructor(x: number, y: number, settings: Record<string, any> = {}) {
		// call the super constructor
		super(x, y, settings.width | 1, settings.height | 1);

		this.settings = {};

		// center the emitter around the given coordinates
		this.centerOn(x, y);

		// Emitter is Stream, launch particles constantly
		/** @ignore */
		this._stream = false;

		// Frequency timer (in ms) for emitter launch new particles
		// used only in stream emitter
		/** @ignore */
		this._frequencyTimer = 0;

		// Time of live (in ms) for emitter launch new particles
		// used only in stream emitter
		/** @ignore */
		this._durationTimer = 0;

		// Emitter is emitting particles
		/** @ignore */
		this._enabled = false;

		// Emitter will always update
		this.alwaysUpdate = true;

		// don't sort the particles by z-index
		this.autoSort = false;

		// count the updates
		this._updateCount = 0;

		// internally store how much time was skipped when frames are skipped
		this._dt = 0;

		//this.anchorPoint.set(0, 0);

		// Reset the emitter to defaults
		this.reset(settings);
	}

	/**
	 * Reset the emitter with particle emitter settings.
	 * @param settings - [optional] object with emitter settings. See {@link ParticleEmitterSettings}
	 */
	override reset(settings: Record<string, any> = {}): void {
		Object.assign(this.settings, ParticleEmitterSettings, settings);

		if (typeof this.settings.image === "undefined") {
			this._defaultParticle = createDefaultParticleTexture(
				settings.textureSize,
				settings.textureSize,
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
		for (let i = 0; i < count; i++) {
			// Add particle to the container
			this.addChild(particlePool.get(this), (this.pos as any).z);
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
		// skip frames if necessary
		if (++this._updateCount > this.settings.framesToSkip) {
			this._updateCount = 0;
		}
		if (this._updateCount > 0) {
			this._dt += dt;
			return this.isDirty;
		}

		// apply skipped delta time
		dt += this._dt;
		this._dt = 0;

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
			const particlesCount = this.children?.length ?? 0;
			if (
				particlesCount < this.settings.totalParticles &&
				this._frequencyTimer >= this.settings.frequency
			) {
				if (
					particlesCount + (this.settings.maxParticles as number) <=
					this.settings.totalParticles
				) {
					this.addParticles(this.settings.maxParticles);
				} else {
					this.addParticles(this.settings.totalParticles - particlesCount);
				}
				this._frequencyTimer = 0;
				this.isDirty = true;
			}
		}
		return this.isDirty;
	}

	/**
	 * Destroy function
	 * @ignore
	 */
	override destroy(): void {
		// call the parent destroy method
		super.destroy();
		// clean emitter specific Properties
		if (typeof this._defaultParticle !== "undefined") {
			this._defaultParticle.destroy();
			this._defaultParticle = undefined;
		}
		this.settings.image = undefined;
		this.settings = undefined as unknown as Record<string, any>;
	}
}
