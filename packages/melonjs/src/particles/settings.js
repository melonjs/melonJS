/**
 * ParticleEmitterSettings contains the default settings for ParticleEmitter
 * @see {@link ParticleEmitter}
 * @namespace ParticleEmitterSettings
 */
const ParticleEmitterSettings = {
	/**
	 * Width of the particle spawn area.
	 * @type {number}
	 * @default 1
	 */
	width: 1,

	/**
	 * Height of the particle spawn area
	 * @type {number}
	 * @default 1
	 */
	height: 1,

	/**
	 * image used for particles texture
	 * (by default melonJS will create an white 8x8 texture image)
	 * @type {HTMLCanvasElement}
	 * @default undefined
	 * @see {@link textureSize}
	 */
	image: undefined,

	/**
	 * default texture size used for particles if no image is specified
	 * (by default melonJS will create an white 8x8 texture image)
	 * @type {number}
	 * @default 8
	 * @see {@link image}
	 */
	textureSize: 8,

	/**
	 * tint to be applied to particles
	 * @type {string}
	 * @default "#fff"
	 */
	tint: "#fff",

	/**
	 * Total number of particles in the emitter
	 * @type {number}
	 * @default 50
	 */
	totalParticles: 50,

	/**
	 * Start angle for particle launch in Radians
	 * @type {number}
	 * @default Math.PI / 2
	 */
	angle: Math.PI / 2,

	/**
	 * letiation in the start angle for particle launch in Radians.
	 * @type {number}
	 * @default 0
	 */
	angleVariation: 0,

	/**
	 * Minimum time each particle lives once it is emitted in ms.
	 * @type {number}
	 * @default 1000
	 */
	minLife: 1000,

	/**
	 * Maximum time each particle lives once it is emitted in ms.
	 * @type {number}
	 * @default 3000
	 */
	maxLife: 3000,

	/**
	 * Start speed of particles.<br>
	 * @type {number}
	 * @default 2
	 */
	speed: 2,

	/**
	 * letiation in the start speed of particles
	 * @type {number}
	 * @default 1
	 */
	speedVariation: 1,

	/**
	 * Minimum start rotation for particles sprites in Radians
	 * @type {number}
	 * @default 0
	 */
	minRotation: 0,

	/**
	 * Maximum start rotation for particles sprites in Radians
	 * @type {number}
	 * @default 0
	 */
	maxRotation: 0,

	/**
	 * Minimum start scale ratio for particles (1 = no scaling)
	 * @type {number}
	 * @default 1
	 */
	minStartScale: 1,

	/**
	 * Maximum start scale ratio for particles (1 = no scaling)
	 * @type {number}
	 * @default 1
	 */
	maxStartScale: 1,

	/**
	 * Minimum end scale ratio for particles
	 * @type {number}
	 * @default 0
	 */
	minEndScale: 0,

	/**
	 * Maximum end scale ratio for particles
	 * @type {number}
	 * @default 0
	 */
	maxEndScale: 0,

	/**
	 * Vertical force (Gravity) for each particle
	 * @type {number}
	 * @default 0
	 * @see {@link World.gravity}
	 */
	gravity: 0,

	/**
	 * Horizontal force (like a Wind) for each particle
	 * @type {number}
	 * @default 0
	 */
	wind: 0,

	/**
	 * Update the rotation of particle in accordance the particle trajectory.<br>
	 * The particle sprite should aim at zero angle (draw from left to right).<br>
	 * Override the particle minRotation and maxRotation.<br>
	 * @type {boolean}
	 * @default false
	 */
	followTrajectory: false,

	/**
	 * Enable the Texture Additive by composite operation ("additive" blendMode)
	 * @type {boolean}
	 * @default false
	 * @see {@link blendMode}
	 */
	textureAdditive: false,

	/**
	 * the blend mode to be applied when rendering particles.
	 * (note: this will superseed the `textureAdditive` setting if different than "normal")
	 * @type {string}
	 * @default normal
	 * @see {@link CanvasRenderer#setBlendMode}
	 * @see {@link WebGLRenderer#setBlendMode}
	 */
	blendMode: "normal",

	/**
	 * Update particles only in the viewport, remove it when out of viewport.
	 * @type {boolean}
	 * @default true
	 */
	onlyInViewport: true,

	/**
	 * Render particles in screen space.
	 * @type {boolean}
	 * @default false
	 */
	floating: false,

	/**
	 * Maximum number of particles launched each time in this emitter (used only if emitter is Stream).
	 * @type {number}
	 * @default 10
	 */
	maxParticles: 10,

	/**
	 * How often a particle is emitted in ms (used only if emitter is a Stream).
	 * @type {number}
	 * @default 100
	 */
	frequency: 100,

	/**
	 * Duration that the emitter releases particles in ms (used only if emitter is Stream).
	 * After this period, the emitter stop the launch of particles.
	 * @type {number}
	 * @default Infinity
	 */
	duration: Infinity,

	/**
	 * Skip n frames after updating the particle system once.
	 * This can be used to reduce the performance impact of emitters with many particles.
	 * @type {number}
	 * @default 0
	 */
	framesToSkip: 0,
};

export default ParticleEmitterSettings;
