import { createCanvas } from "./../video/video.js";
import * as pool from "./../system/pooling.js";
import Renderable from "./../renderable/renderable.js";
import ParticleContainer from "./particlecontainer.js";
import ParticleEmitterSettings from "./settings.js";
import { randomFloat } from "./../math/math.js";

/**
 * @ignore
 */
function createDefaultParticleTexture(w, h) {
    var canvas = createCanvas(w, h);
    var context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, h);
    return canvas;
};

/**
 * @classdesc
 * Particle Emitter Object.
 * @augments Rect
 */
class ParticleEmitter extends Renderable {
    /*
     * @param {number} x x-position of the particle emitter
     * @param {number} y y-position of the particle emitter
     * @param {object} settings An object containing the settings for the particle emitter. See {@link ParticleEmitterSettings}
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
     */
    get floating() {
        return typeof this.container !== "undefined" && this.container.floating;
    }

    set floating(value) {
        if (typeof this.container !== "undefined") {
            this.container.floating = value;
        }
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
     * @returns {number}
     */
    getRandomPointX() {
        return this.pos.x + randomFloat(0, this.width);
    }

    /**
     * returns a random point inside the bounds y axis of this emitter
     * @returns {number}
     */
    getRandomPointY() {
        return this.pos.y + randomFloat(0, this.height);
    }

    /**
     * Reset the emitter with default values.<br>
     * @param {object} settings [optional] object with emitter settings. See {@link ParticleEmitterSettings}
     */
    reset(settings) {
        // check if settings exists and create a dummy object if necessary
        settings = settings || {};
        var defaults = ParticleEmitterSettings;

        var width = (typeof settings.width === "number") ? settings.width : defaults.width;
        var height = (typeof settings.height === "number") ? settings.height : defaults.height;
        this.resize(width, height);

        Object.assign(this, defaults, settings);

        // Cache the image reference
        if (typeof this.image === "undefined") {
            this.image = createDefaultParticleTexture(width, height);
        }

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
     * Emitter is of type stream and is launching particles
     * @returns {boolean} Emitter is Stream and is launching particles
     */
    isRunning() {
        return this._enabled && this._stream;
    }

    /**
     * Launch particles from emitter constantly (e.g. for stream)
     * @param {number} duration [optional] time that the emitter releases particles in ms
     */
    streamParticles(duration) {
        this._enabled = true;
        this._stream = true;
        this.frequency = Math.max(this.frequency, 1);
        this._durationTimer = (typeof duration === "number") ? duration : this.duration;
    }

    /**
     * Stop the emitter from generating new particles (used only if emitter is Stream)
     */
    stopStream() {
        this._enabled = false;
    }

    /**
     * Launch all particles from emitter and stop (e.g. for explosion)
     * @param {number} total [optional] number of particles to launch
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

export default ParticleEmitter;
