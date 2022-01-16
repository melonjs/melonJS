import { createCanvas } from "./../video/video.js";
import pool from "./../system/pooling.js";
import Renderable from "./../renderable/renderable.js";
import ParticleContainer from "./particlecontainer.js";
import { randomFloat } from "./../math/math.js";



// generate a default image for the particles
var pixel = (function () {
    var canvas = createCanvas(1, 1);
    var context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1, 1);
    return canvas;
})();

/**
 * me.ParticleEmitterSettings contains the default settings for me.ParticleEmitter
 * @ignore
 * @class
 * @memberof me
 * @see me.ParticleEmitter
 */
var ParticleEmitterSettings = {
    /**
     * Width of the particle spawn area.<br>
     * @public
     * @type {number}
     * @name width
     * @memberof me.ParticleEmitterSettings
     * @default 0
     */
    width : 0,

    /**
     * Height of the particle spawn area
     * @public
     * @type {number}
     * @name height
     * @memberof me.ParticleEmitterSettings
     * @default 0
     */
    height : 0,

    /**
     * Image used for particles
     * @public
     * @type {CanvasImageSource}
     * @name image
     * @memberof me.ParticleEmitterSettings
     * @default 1x1 white pixel
     * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#canvasimagesource
     */
    image : pixel,

    /**
     * Total number of particles in the emitter
     * @public
     * @type {number}
     * @name totalParticles
     * @default 50
     * @memberof me.ParticleEmitterSettings
     */
    totalParticles : 50,

    /**
     * Start angle for particle launch in Radians
     * @public
     * @type {number}
     * @name angle
     * @default Math.PI / 2
     * @memberof me.ParticleEmitterSettings
     */
    angle : Math.PI / 2,

    /**
     * Variation in the start angle for particle launch in Radians
     * @public
     * @type {number}
     * @name angleVariation
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    angleVariation : 0,

    /**
     * Minimum time each particle lives once it is emitted in ms
     * @public
     * @type {number}
     * @name minLife
     * @default 1000
     * @memberof me.ParticleEmitterSettings
     */
    minLife : 1000,

    /**
     * Maximum time each particle lives once it is emitted in ms
     * @public
     * @type {number}
     * @name maxLife
     * @default 3000
     * @memberof me.ParticleEmitterSettings
     */
    maxLife : 3000,

    /**
     * Start speed of particles.<br>
     * @public
     * @type {number}
     * @name speed
     * @default 2
     * @memberof me.ParticleEmitterSettings
     */
    speed : 2,

    /**
     * Variation in the start speed of particles
     * @public
     * @type {number}
     * @name speedVariation
     * @default 1
     * @memberof me.ParticleEmitterSettings
     */
    speedVariation : 1,

    /**
     * Minimum start rotation for particles sprites in Radians
     * @public
     * @type {number}
     * @name minRotation
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    minRotation : 0,

    /**
     * Maximum start rotation for particles sprites in Radians
     * @public
     * @type {number}
     * @name maxRotation
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    maxRotation : 0,

    /**
     * Minimum start scale ratio for particles (1 = no scaling)
     * @public
     * @type {number}
     * @name minStartScale
     * @default 1
     * @memberof me.ParticleEmitterSettings
     */
    minStartScale : 1,

    /**
     * Maximum start scale ratio for particles (1 = no scaling)
     * @public
     * @type {number}
     * @name maxStartScale
     * @default 1
     * @memberof me.ParticleEmitterSettings
     */
    maxStartScale : 1,

    /**
     * Minimum end scale ratio for particles
     * @public
     * @type {number}
     * @name minEndScale
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    minEndScale : 0,

    /**
     * Maximum end scale ratio for particles
     * @public
     * @type {number}
     * @name maxEndScale
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    maxEndScale : 0,

    /**
     * Vertical force (Gravity) for each particle
     * @public
     * @type {number}
     * @name gravity
     * @default 0
     * @memberof me.ParticleEmitterSettings
     * @see me.game.world.gravity
     */
    gravity : 0,

    /**
     * Horizontal force (like a Wind) for each particle
     * @public
     * @type {number}
     * @name wind
     * @default 0
     * @memberof me.ParticleEmitterSettings
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
     * @memberof me.ParticleEmitterSettings
     */
    followTrajectory : false,

    /**
     * Enable the Texture Additive by canvas composite operation (lighter).<br>
     * WARNING: Composite Operation may decreases performance!.<br>
     * @public
     * @type {boolean}
     * @name textureAdditive
     * @default false
     * @memberof me.ParticleEmitterSettings
     */
    textureAdditive : false,

    /**
     * Update particles only in the viewport, remove it when out of viewport.<br>
     * @public
     * @type {boolean}
     * @name onlyInViewport
     * @default true
     * @memberof me.ParticleEmitterSettings
     */
    onlyInViewport : true,

    /**
     * Render particles in screen space. <br>
     * @public
     * @type {boolean}
     * @name floating
     * @default false
     * @memberof me.ParticleEmitterSettings
     */
    floating : false,

    /**
     * Maximum number of particles launched each time in this emitter (used only if emitter is Stream).<br>
     * @public
     * @type {number}
     * @name maxParticles
     * @default 10
     * @memberof me.ParticleEmitterSettings
     */
    maxParticles : 10,

    /**
     * How often a particle is emitted in ms (used only if emitter is Stream).<br>
     * Necessary that value is greater than zero.<br>
     * @public
     * @type {number}
     * @name frequency
     * @default 100
     * @memberof me.ParticleEmitterSettings
     */
    frequency : 100,

    /**
     * Duration that the emitter releases particles in ms (used only if emitter is Stream).<br>
     * After this period, the emitter stop the launch of particles.<br>
     * @public
     * @type {number}
     * @name duration
     * @default Infinity
     * @memberof me.ParticleEmitterSettings
     */
    duration : Infinity,

    /**
     * Skip n frames after updating the particle system once. <br>
     * This can be used to reduce the performance impact of emitters with many particles.<br>
     * @public
     * @type {number}
     * @name framesToSkip
     * @default 0
     * @memberof me.ParticleEmitterSettings
     */
    framesToSkip : 0
};

/**
 * Particle Emitter Object.
 * @class
 * @augments Rect
 * @memberof me
 * @param {number} x x-position of the particle emitter
 * @param {number} y y-position of the particle emitter
 * @param {object} settings An object containing the settings for the particle emitter. See {@link me.ParticleEmitterSettings}
 * @example
 * // Create a basic emitter at position 100, 100
 * var emitter = new me.ParticleEmitter(100, 100);
 *
 * // Adjust the emitter properties
 * emitter.totalParticles = 200;
 * emitter.minLife = 1000;
 * emitter.maxLife = 3000;
 * emitter.z = 10;
 *
 * // Add the emitter to the game world
 * me.game.world.addChild(emitter);
 *
 * // Launch all particles one time and stop, like a explosion
 * emitter.burstParticles();
 *
 * // Launch constantly the particles, like a fountain
 * emitter.streamParticles();
 *
 * // At the end, remove emitter from the game world
 * // call this in onDestroyEvent function
 * me.game.world.removeChild(emitter);
 */
class ParticleEmitter extends Renderable {

    /**
     * @ignore
     */
    constructor(x, y, settings) {
        // call the super constructor
        super(x, y, Infinity, Infinity);

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

        this.container = new ParticleContainer(this);

        // Reset the emitter to defaults
        this.reset(settings);
    }

    /**
     * @ignore
     */
    get z() {
        return this.container.pos.z;
    }

    /**
     * @ignore
     */
    set z(value) {
        this.container.pos.z = value;
    }

    /**
     * Floating property for particles, value is forwarded to the particle container <br>
     * @type {boolean}
     * @name floating
     * @memberof me.ParticleEmitter
     */
    get floating() {
        return this.container.floating;
    }

    set floating(value) {
        this.container.floating = value;
    }

    /**
     * @ignore
     */
    onActivateEvent() {
        this.ancestor.addChild(this.container);
        this.container.pos.z = this.pos.z;
        if (!this.ancestor.autoSort) {
            this.ancestor.sort();
        }
    }

    /**
     * @ignore
     */
    onDeactivateEvent() {
        if (this.ancestor.hasChild(this.container)) {
            this.ancestor.removeChildNow(this.container);
        }
    }

    /**
     * @ignore
     */
    destroy() {
        this.reset();
    }

    /**
     * returns a random point inside the bounds x axis of this emitter
     * @name getRandomPointX
     * @memberof me.ParticleEmitter
     * @function
     * @returns {number}
     */
    getRandomPointX() {
        return this.pos.x + randomFloat(0, this.width);
    }

    /**
     * returns a random point inside the bounds y axis of this emitter
     * @name getRandomPointY
     * @memberof me.ParticleEmitter
     * @function
     * @returns {number}
     */
    getRandomPointY() {
        return this.pos.y + randomFloat(0, this.height);
    }

    /**
     * Reset the emitter with default values.<br>
     * @function
     * @param {object} settings [optional] object with emitter settings. See {@link me.ParticleEmitterSettings}
     * @name reset
     * @memberof me.ParticleEmitter
     */
    reset(settings) {
        // check if settings exists and create a dummy object if necessary
        settings = settings || {};
        var defaults = ParticleEmitterSettings;

        var width = (typeof settings.width === "number") ? settings.width : defaults.width;
        var height = (typeof settings.height === "number") ? settings.height : defaults.height;
        this.resize(width, height);

        Object.assign(this, defaults, settings);

        // reset particle container values
        this.container.reset();
    }

    // Add count particles in the game world
    /** @ignore */
    addParticles(count) {
        for (var i = 0; i < ~~count; i++) {
            // Add particle to the container
            var particle = pool.pull("Particle", this);
            this.container.addChild(particle);
        }
    }

    /**
     * Emitter is of type stream and is launching particles <br>
     * @function
     * @returns {boolean} Emitter is Stream and is launching particles
     * @name isRunning
     * @memberof me.ParticleEmitter
     */
    isRunning() {
        return this._enabled && this._stream;
    }

    /**
     * Launch particles from emitter constantly <br>
     * Particles example: Fountains
     * @param {number} duration [optional] time that the emitter releases particles in ms
     * @function
     * @name streamParticles
     * @memberof me.ParticleEmitter
     */
    streamParticles(duration) {
        this._enabled = true;
        this._stream = true;
        this.frequency = Math.max(this.frequency, 1);
        this._durationTimer = (typeof duration === "number") ? duration : this.duration;
    }

    /**
     * Stop the emitter from generating new particles (used only if emitter is Stream) <br>
     * @function
     * @name stopStream
     * @memberof me.ParticleEmitter
     */
    stopStream() {
        this._enabled = false;
    }

    /**
     * Launch all particles from emitter and stop <br>
     * Particles example: Explosions <br>
     * @param {number} total [optional] number of particles to launch
     * @function
     * @name burstParticles
     * @memberof me.ParticleEmitter
     */
    burstParticles(total) {
        this._enabled = true;
        this._stream = false;
        this.addParticles((typeof total === "number") ? total : this.totalParticles);
        this._enabled = false;
    }

    /**
     * @ignore
     */
    update(dt) {
        // Launch new particles, if emitter is Stream
        if ((this._enabled) && (this._stream)) {
            // Check if the emitter has duration set
            if (this._durationTimer !== Infinity) {
                this._durationTimer -= dt;

                if (this._durationTimer <= 0) {
                    this.stopStream();
                    return false;
                }
            }

            // Increase the emitter launcher timer
            this._frequencyTimer += dt;

            // Check for new particles launch
            var particlesCount = this.container.children.length;
            if ((particlesCount < this.totalParticles) && (this._frequencyTimer >= this.frequency)) {
                if ((particlesCount + this.maxParticles) <= this.totalParticles) {
                    this.addParticles(this.maxParticles);
                }
                else {
                    this.addParticles(this.totalParticles - particlesCount);
                }

                this._frequencyTimer = 0;
            }
        }
        return true;
    }

};

export { ParticleEmitterSettings, ParticleEmitter };
