/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    // generate a default image for the particles
    var pixel = (function () {
        var canvas = me.video.createCanvas(1, 1);
        var context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, 1, 1);
        return canvas;
    })();

    /**
     * me.ParticleEmitterSettings contains the default settings for me.ParticleEmitter.<br>
     *
     * @protected
     * @class
     * @memberOf me
     * @see me.ParticleEmitter
     */
    me.ParticleEmitterSettings = {
        /**
         * Width of the particle spawn area.<br>
         * @public
         * @type Number
         * @name width
         * @memberOf me.ParticleEmitterSettings
         * @default 0
         */
        width : 0,

        /**
         * Height of the particle spawn area.<br>
         * @public
         * @type Number
         * @name height
         * @memberOf me.ParticleEmitterSettings
         * @default 0
         */
        height : 0,

        /**
         * Image used for particles.<br>
         * @public
         * @type CanvasImageSource
         * @name image
         * @memberOf me.ParticleEmitterSettings
         * @default 1x1 white pixel
         * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#canvasimagesource
         */
        image : pixel,

        /**
         * Total number of particles in the emitter.<br>
         * @public
         * @type Number
         * @name totalParticles
         * @default 50
         * @memberOf me.ParticleEmitterSettings
         */
        totalParticles : 50,

        /**
         * Start angle for particle launch in Radians.<br>
         * @public
         * @type Number
         * @name angle
         * @default Math.PI / 2
         * @memberOf me.ParticleEmitterSettings
         */
        angle : Math.PI / 2,

        /**
         * Variation in the start angle for particle launch in Radians.<br>
         * @public
         * @type Number
         * @name angleVariation
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        angleVariation : 0,

        /**
         * Minimum time each particle lives once it is emitted in ms.<br>
         * @public
         * @type Number
         * @name minLife
         * @default 1000
         * @memberOf me.ParticleEmitterSettings
         */
        minLife : 1000,

        /**
         * Maximum time each particle lives once it is emitted in ms.<br>
         * @public
         * @type Number
         * @name maxLife
         * @default 3000
         * @memberOf me.ParticleEmitterSettings
         */
        maxLife : 3000,

        /**
         * Start speed of particles.<br>
         * @public
         * @type Number
         * @name speed
         * @default 2
         * @memberOf me.ParticleEmitterSettings
         */
        speed : 2,

        /**
         * Variation in the start speed of particles.<br>
         * @public
         * @type Number
         * @name speedVariation
         * @default 1
         * @memberOf me.ParticleEmitterSettings
         */
        speedVariation : 1,

        /**
         * Minimum start rotation for particles sprites in Radians.<br>
         * @public
         * @type Number
         * @name minRotation
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        minRotation : 0,

        /**
         * Maximum start rotation for particles sprites in Radians.<br>
         * @public
         * @type Number
         * @name maxRotation
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        maxRotation : 0,

        /**
         * Minimum start scale ratio for particles (1 = no scaling).<br>
         * @public
         * @type Number
         * @name minStartScale
         * @default 1
         * @memberOf me.ParticleEmitterSettings
         */
        minStartScale : 1,

        /**
         * Maximum start scale ratio for particles (1 = no scaling).<br>
         * @public
         * @type Number
         * @name maxStartScale
         * @default 1
         * @memberOf me.ParticleEmitterSettings
         */
        maxStartScale : 1,

        /**
         * Minimum end scale ratio for particles.<br>
         * @public
         * @type Number
         * @name minEndScale
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        minEndScale : 0,

        /**
         * Maximum end scale ratio for particles.<br>
         * @public
         * @type Number
         * @name maxEndScale
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        maxEndScale : 0,

        /**
         * Vertical force (Gravity) for each particle.<br>
         * @public
         * @type Number
         * @name gravity
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         * @see me.sys.gravity
         */
        gravity : 0,

        /**
         * Horizontal force (like a Wind) for each particle.<br>
         * @public
         * @type Number
         * @name wind
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        wind : 0,

        /**
         * Update the rotation of particle in accordance the particle trajectory.<br>
         * The particle sprite should aim at zero angle (draw from left to right).<br>
         * Override the particle minRotation and maxRotation.<br>
         * @public
         * @type Boolean
         * @name followTrajectory
         * @default false
         * @memberOf me.ParticleEmitterSettings
         */
        followTrajectory : false,

        /**
         * Enable the Texture Additive by canvas composite operation (lighter).<br>
         * WARNING: Composite Operation may decreases performance!.<br>
         * @public
         * @type Boolean
         * @name textureAdditive
         * @default false
         * @memberOf me.ParticleEmitterSettings
         */
        textureAdditive : false,

        /**
         * Update particles only in the viewport, remove it when out of viewport.<br>
         * @public
         * @type Boolean
         * @name onlyInViewport
         * @default true
         * @memberOf me.ParticleEmitterSettings
         */
        onlyInViewport : true,

        /**
         * Render particles in screen space. <br>
         * @public
         * @type Boolean
         * @name floating
         * @default false
         * @memberOf me.ParticleEmitterSettings
         */
        floating : false,

        /**
         * Maximum number of particles launched each time in this emitter (used only if emitter is Stream).<br>
         * @public
         * @type Number
         * @name maxParticles
         * @default 10
         * @memberOf me.ParticleEmitterSettings
         */
        maxParticles : 10,

        /**
         * How often a particle is emitted in ms (used only if emitter is Stream).<br>
         * Necessary that value is greater than zero.<br>
         * @public
         * @type Number
         * @name frequency
         * @default 100
         * @memberOf me.ParticleEmitterSettings
         */
        frequency : 100,

        /**
         * Duration that the emitter releases particles in ms (used only if emitter is Stream).<br>
         * After this period, the emitter stop the launch of particles.<br>
         * @public
         * @type Number
         * @name duration
         * @default Infinity
         * @memberOf me.ParticleEmitterSettings
         */
        duration : Infinity,

        /**
         * Skip n frames after updating the particle system once. <br>
         * This can be used to reduce the performance impact of emitters with many particles.<br>
         * @public
         * @type Number
         * @name framesToSkip
         * @default 0
         * @memberOf me.ParticleEmitterSettings
         */
        framesToSkip : 0
    };

    /**
     * Particle Emitter Object.
     * @class
     * @extends Rect
     * @memberOf me
     * @constructor
     * @param {Number} x x-position of the particle emitter
     * @param {Number} y y-position of the particle emitter
     * @param {object} settings An object containing the settings for the particle emitter. See {@link me.ParticleEmitterSettings}
     * @example
     *
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
     *
     */
    me.ParticleEmitter = me.Rect.extend(
    /** @scope me.ParticleEmitter.prototype */
    {
        /**
         * @ignore
         */
        init: function (x, y, settings) {
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
            this.isRenderable = false;
            // call the super constructor
            this._super(
                me.Rect,
                "init",
                [x, y,
                Infinity,
                Infinity]
            );

            // don't sort the particles by z-index
            this.autoSort = false;

            this.container = new me.ParticleContainer(this);

            /**
             * @ignore
             */
            Object.defineProperty(this.pos, "z", {
                /**
                 * @ignore
                 */
                get : (function () { return this.container.pos.z; }).bind(this),
                /**
                 * @ignore
                 */
                set : (function (value) { this.container.pos.z = value; }).bind(this),
                enumerable : true,
                configurable : true
            });

            /**
             * Floating property for particles, value is forwarded to the particle container <br>
             * @type Boolean
             * @name floating
             * @memberOf me.ParticleEmitter
             */
            Object.defineProperty(this, "floating", {
                /**
                 * @ignore
                 */
                get : function () { return this.container.floating; },
                /**
                 * @ignore
                 */
                set : function (value) { this.container.floating = value; },
                enumerable : true,
                configurable : true
            });

            // Reset the emitter to defaults
            this.reset(settings);
        },

        /**
         * @ignore
         */
        onActivateEvent: function() {
            this.ancestor.addChild(this.container);
            this.container.pos.z = this.pos.z;
            if (!this.ancestor.autoSort) {
                this.ancestor.sort();
            }
        },

        /**
         * @ignore
         */
        onDeactivateEvent: function() {
            if (this.ancestor.hasChild(this.container)) {
                this.ancestor.removeChildNow(this.container);
            }
        },

        /**
         * @ignore
         */
        destroy: function () {
            this.reset();
        },

        /**
         * returns a random point inside the bounds x axis of this emitter
         * @name getRandomPointX
         * @memberOf me.ParticleEmitter
         * @function
         * @return {Number}
         */
        getRandomPointX: function () {
            return this.pos.x + (0).randomFloat(this.width);
        },

        /**
         * returns a random point inside the bounds y axis of this emitter
         * @name getRandomPointY
         * @memberOf me.ParticleEmitter
         * @function
         * @return {Number}
         */
        getRandomPointY: function () {
            return this.pos.y + (0).randomFloat(this.height);
        },

        /**
         * Reset the emitter with default values.<br>
         * @function
         * @param {Object} settings [optional] object with emitter settings. See {@link me.ParticleEmitterSettings}
         * @name reset
         * @memberOf me.ParticleEmitter
         */
        reset: function (settings) {
            // check if settings exists and create a dummy object if necessary
            settings = settings || {};
            var defaults = me.ParticleEmitterSettings;

            var width = (typeof settings.width === "number") ? settings.width : defaults.width;
            var height = (typeof settings.height === "number") ? settings.height : defaults.height;
            this.resize(width, height);

            Object.assign(this, defaults, settings);

            // reset particle container values
            this.container.destroy();
        },

        // Add count particles in the game world
        /** @ignore */
        addParticles: function (count) {
            for (var i = 0; i < ~~count; i++) {
                // Add particle to the container
                var particle = me.pool.pull("me.Particle", this);
                this.container.addChild(particle);
            }
        },

        /**
         * Emitter is of type stream and is launching particles <br>
         * @function
         * @returns {Boolean} Emitter is Stream and is launching particles
         * @name isRunning
         * @memberOf me.ParticleEmitter
         */
        isRunning: function () {
            return this._enabled && this._stream;
        },

        /**
         * Launch particles from emitter constantly <br>
         * Particles example: Fountains
         * @param {Number} duration [optional] time that the emitter releases particles in ms
         * @function
         * @name streamParticles
         * @memberOf me.ParticleEmitter
         */
        streamParticles: function (duration) {
            this._enabled = true;
            this._stream = true;
            this.frequency = Math.max(this.frequency, 1);
            this._durationTimer = (typeof duration === "number") ? duration : this.duration;
        },

        /**
         * Stop the emitter from generating new particles (used only if emitter is Stream) <br>
         * @function
         * @name stopStream
         * @memberOf me.ParticleEmitter
         */
        stopStream: function () {
            this._enabled = false;
        },

        /**
         * Launch all particles from emitter and stop <br>
         * Particles example: Explosions <br>
         * @param {Number} total [optional] number of particles to launch
         * @function
         * @name burstParticles
         * @memberOf me.ParticleEmitter
         */
        burstParticles: function (total) {
            this._enabled = true;
            this._stream = false;
            this.addParticles((typeof total === "number") ? total : this.totalParticles);
            this._enabled = false;
        },

        /**
         * @ignore
         */
        update: function (dt) {
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
    });
})();
