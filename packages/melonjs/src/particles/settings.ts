import type ParticleEmitter from "./emitter.ts";

/**
 * Configuration shape for {@link ParticleEmitter}.
 * Every field has a sensible default; users typically pass a `Partial<ParticleEmitterSettings>`
 * to the constructor or {@link ParticleEmitter#reset}.
 * @category Particles
 * @see {@link ParticleEmitter}
 */
export interface ParticleEmitterSettings {
	/**
	 * Width of the particle spawn area.
	 * @default 1
	 */
	width: number;

	/**
	 * Height of the particle spawn area.
	 * @default 1
	 */
	height: number;

	/**
	 * Image used for particles texture (by default melonJS will create a white
	 * 8x8 texture image).
	 * @default undefined
	 * @see {@link textureSize}
	 */
	image: HTMLCanvasElement | HTMLImageElement | undefined;

	/**
	 * Default texture size used for particles if no image is specified
	 * (by default melonJS will create a white 8x8 texture image).
	 * @default 8
	 * @see {@link image}
	 */
	textureSize: number;

	/**
	 * Tint to be applied to particles.
	 * @default "#fff"
	 */
	tint: string;

	/**
	 * Total number of particles in the emitter.
	 * @default 50
	 */
	totalParticles: number;

	/**
	 * Start angle for particle launch in Radians.
	 * @default Math.PI / 2
	 */
	angle: number;

	/**
	 * Variation in the start angle for particle launch in Radians.
	 * @default 0
	 */
	angleVariation: number;

	/**
	 * Minimum time each particle lives once it is emitted in ms.
	 * If greater than `maxLife`, it is clamped to `maxLife` at reset.
	 * @default 1000
	 */
	minLife: number;

	/**
	 * Maximum time each particle lives once it is emitted in ms.
	 * @default 3000
	 */
	maxLife: number;

	/**
	 * Start speed of particles.
	 * @default 2
	 */
	speed: number;

	/**
	 * Variation in the start speed of particles.
	 * @default 1
	 */
	speedVariation: number;

	/**
	 * Minimum start rotation for particle sprites in Radians.
	 * @default 0
	 */
	minRotation: number;

	/**
	 * Maximum start rotation for particle sprites in Radians.
	 * @default 0
	 */
	maxRotation: number;

	/**
	 * Minimum start scale ratio for particles (1 = no scaling).
	 * @default 1
	 */
	minStartScale: number;

	/**
	 * Maximum start scale ratio for particles (1 = no scaling).
	 * @default 1
	 */
	maxStartScale: number;

	/**
	 * Minimum end scale ratio for particles.
	 * @default 0
	 */
	minEndScale: number;

	/**
	 * Maximum end scale ratio for particles.
	 * @default 0
	 */
	maxEndScale: number;

	/**
	 * Vertical force (Gravity) for each particle.
	 * @default 0
	 * @see {@link World.gravity}
	 */
	gravity: number;

	/**
	 * Horizontal force (like a Wind) for each particle.
	 * @default 0
	 */
	wind: number;

	/**
	 * Update the rotation of particle in accordance with the particle trajectory.
	 * The particle sprite should aim at zero angle (draw from left to right).
	 * Overrides the particle `minRotation` and `maxRotation`.
	 * @default false
	 */
	followTrajectory: boolean;

	/**
	 * Enable the Texture Additive by composite operation ("additive" blendMode).
	 * @default false
	 * @see {@link blendMode}
	 */
	textureAdditive: boolean;

	/**
	 * Blend mode applied when rendering particles. If different than "normal",
	 * supersedes the `textureAdditive` setting.
	 * @default "normal"
	 * @see {@link CanvasRenderer#setBlendMode}
	 * @see {@link WebGLRenderer#setBlendMode}
	 */
	blendMode: string;

	/**
	 * Update particles only in the viewport; remove when out of viewport.
	 * @default true
	 */
	onlyInViewport: boolean;

	/**
	 * Render particles in screen space.
	 * @default false
	 */
	floating: boolean;

	/**
	 * Maximum number of particles launched each tick (stream mode only).
	 * @default 10
	 */
	maxParticles: number;

	/**
	 * How often a particle is emitted in ms (stream mode only).
	 * @default 100
	 */
	frequency: number;

	/**
	 * Duration that the emitter releases particles in ms (stream mode only).
	 * After this period, the emitter stops launching particles.
	 * @default Infinity
	 */
	duration: number;

	/**
	 * Skip n frames after updating the particle system once.
	 * Reduces the performance impact of emitters with many particles.
	 * @default 0
	 */
	framesToSkip: number;

	/**
	 * When `true`, each particle refreshes its bounding box every frame so the
	 * hitbox tracks the visual exactly (useful for debug visualization or
	 * collision queries). When `false` (default), bounds reflect the previous
	 * frame's transform — sufficient for viewport culling and significantly
	 * cheaper at high particle counts.
	 * @default false
	 */
	accurateBounds: boolean;

	/**
	 * When `true`, the emitter automatically removes itself from its parent
	 * container once all particles have died. Useful for fire-and-forget
	 * `burstParticles()` use cases (explosions, pickups, impact effects) where
	 * there is no natural cleanup hook.
	 * @default false
	 */
	autoDestroyOnComplete: boolean;

	/**
	 * Optional callback fired when the emitter completes (all particles dead
	 * after at least one particle has been spawned, and — for stream mode —
	 * the duration has elapsed). Fires regardless of `autoDestroyOnComplete`,
	 * and runs *before* the emitter is removed from its parent. The callback
	 * is invoked with the emitter as its `this` context.
	 * @default undefined
	 */
	onComplete: ((this: ParticleEmitter) => void) | undefined;
}

/**
 * Default values for every {@link ParticleEmitterSettings} field.
 * @category Particles
 */
const defaultParticleEmitterSettings: ParticleEmitterSettings = {
	width: 1,
	height: 1,
	image: undefined,
	textureSize: 8,
	tint: "#fff",
	totalParticles: 50,
	angle: Math.PI / 2,
	angleVariation: 0,
	minLife: 1000,
	maxLife: 3000,
	speed: 2,
	speedVariation: 1,
	minRotation: 0,
	maxRotation: 0,
	minStartScale: 1,
	maxStartScale: 1,
	minEndScale: 0,
	maxEndScale: 0,
	gravity: 0,
	wind: 0,
	followTrajectory: false,
	textureAdditive: false,
	blendMode: "normal",
	onlyInViewport: true,
	floating: false,
	maxParticles: 10,
	frequency: 100,
	duration: Infinity,
	framesToSkip: 0,
	accurateBounds: false,
	autoDestroyOnComplete: false,
	onComplete: undefined,
};

export default defaultParticleEmitterSettings;
