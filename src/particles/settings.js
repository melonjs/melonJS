/**
 * ParticleEmitterSettings contains the default settings for ParticleEmitter
 * @see ParticleEmitter
 * @namespace ParticleEmitterSettings
 */
const ParticleEmitterSettings = {
    /**
     * Width of the particle spawn area.<br>
     * @type {number}
     * @name width
     * @memberof ParticleEmitterSettings
     * @default 1
     */
    width : 1,

    /**
     * Height of the particle spawn area
     * @public
     * @type {number}
     * @name height
     * @memberof ParticleEmitterSettings
     * @default 1
     */
    height : 1,

    /**
     * default image used for particles.
     * (by default melonJS will create an white texture image)
     * @public
     * @type {HTMLCanvasElement}
     * @name image
     * @memberof ParticleEmitterSettings
     * @default undefined
     */
    image : undefined,

    /**
     * tint to be applied to particles
     * @public
     * @type {string}
     * @name tint
     * @memberof ParticleEmitterSettings
     * @default "#fff"
     */
    tint : "#fff",

    /**
     * Total number of particles in the emitter
     * @public
     * @type {number}
     * @name totalParticles
     * @default 50
     * @memberof ParticleEmitterSettings
     */
    totalParticles : 50,

    /**
     * Start angle for particle launch in Radians
     * @public
     * @type {number}
     * @name angle
     * @default Math.PI / 2
     * @memberof ParticleEmitterSettings
     */
    angle : Math.PI / 2,

    /**
     * Variation in the start angle for particle launch in Radians
     * @public
     * @type {number}
     * @name angleVariation
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    angleVariation : 0,

    /**
     * Minimum time each particle lives once it is emitted in ms
     * @public
     * @type {number}
     * @name minLife
     * @default 1000
     * @memberof ParticleEmitterSettings
     */
    minLife : 1000,

    /**
     * Maximum time each particle lives once it is emitted in ms
     * @public
     * @type {number}
     * @name maxLife
     * @default 3000
     * @memberof ParticleEmitterSettings
     */
    maxLife : 3000,

    /**
     * Start speed of particles.<br>
     * @public
     * @type {number}
     * @name speed
     * @default 2
     * @memberof ParticleEmitterSettings
     */
    speed : 2,

    /**
     * Variation in the start speed of particles
     * @public
     * @type {number}
     * @name speedVariation
     * @default 1
     * @memberof ParticleEmitterSettings
     */
    speedVariation : 1,

    /**
     * Minimum start rotation for particles sprites in Radians
     * @public
     * @type {number}
     * @name minRotation
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    minRotation : 0,

    /**
     * Maximum start rotation for particles sprites in Radians
     * @public
     * @type {number}
     * @name maxRotation
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    maxRotation : 0,

    /**
     * Minimum start scale ratio for particles (1 = no scaling)
     * @public
     * @type {number}
     * @name minStartScale
     * @default 1
     * @memberof ParticleEmitterSettings
     */
    minStartScale : 1,

    /**
     * Maximum start scale ratio for particles (1 = no scaling)
     * @public
     * @type {number}
     * @name maxStartScale
     * @default 1
     * @memberof ParticleEmitterSettings
     */
    maxStartScale : 1,

    /**
     * Minimum end scale ratio for particles
     * @public
     * @type {number}
     * @name minEndScale
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    minEndScale : 0,

    /**
     * Maximum end scale ratio for particles
     * @public
     * @type {number}
     * @name maxEndScale
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    maxEndScale : 0,

    /**
     * Vertical force (Gravity) for each particle
     * @public
     * @type {number}
     * @name gravity
     * @default 0
     * @memberof ParticleEmitterSettings
     * @see game.world.gravity
     */
    gravity : 0,

    /**
     * Horizontal force (like a Wind) for each particle
     * @public
     * @type {number}
     * @name wind
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    wind : 0,

    /**
     * Update the rotation of particle in accordance the particle trajectory.<br>
     * The particle sprite should aim at zero angle (draw from left to right).<br>
     * Override the particle minRotation and maxRotation.<br>
     * @public
     * @type {boolean}
     * @name followTrajectory
     * @default false
     * @memberof ParticleEmitterSettings
     */
    followTrajectory : false,

    /**
     * Enable the Texture Additive by canvas composite operation (lighter).<br>
     * WARNING: Composite Operation may decreases performance!.<br>
     * @public
     * @type {boolean}
     * @name textureAdditive
     * @default false
     * @memberof ParticleEmitterSettings
     */
    textureAdditive : false,

    /**
     * Update particles only in the viewport, remove it when out of viewport.<br>
     * @public
     * @type {boolean}
     * @name onlyInViewport
     * @default true
     * @memberof ParticleEmitterSettings
     */
    onlyInViewport : true,

    /**
     * Render particles in screen space. <br>
     * @public
     * @type {boolean}
     * @name floating
     * @default false
     * @memberof ParticleEmitterSettings
     */
    floating : false,

    /**
     * Maximum number of particles launched each time in this emitter (used only if emitter is Stream).<br>
     * @public
     * @type {number}
     * @name maxParticles
     * @default 10
     * @memberof ParticleEmitterSettings
     */
    maxParticles : 10,

    /**
     * How often a particle is emitted in ms (used only if emitter is Stream).<br>
     * Necessary that value is greater than zero.<br>
     * @public
     * @type {number}
     * @name frequency
     * @default 100
     * @memberof ParticleEmitterSettings
     */
    frequency : 100,

    /**
     * Duration that the emitter releases particles in ms (used only if emitter is Stream).<br>
     * After this period, the emitter stop the launch of particles.<br>
     * @public
     * @type {number}
     * @name duration
     * @default Infinity
     * @memberof ParticleEmitterSettings
     */
    duration : Infinity,

    /**
     * Skip n frames after updating the particle system once. <br>
     * This can be used to reduce the performance impact of emitters with many particles.<br>
     * @public
     * @type {number}
     * @name framesToSkip
     * @default 0
     * @memberof ParticleEmitterSettings
     */
    framesToSkip : 0
};

export default ParticleEmitterSettings;
