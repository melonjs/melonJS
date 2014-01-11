/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

    /**
     * Particle Emitter Object.
     * @class
     * @extends Object
     * @memberOf me
     * @constructor
     * @param {me.Vector2d} pos position of the particle emitter
     * @param {Image} image reference to the Particle Image. See {@link me.loader#getImage}
     * @example
     *
     * // Create a basic emitter at position 100, 100
     * var emitter = new me.ParticleEmitter(100, 100, me.loader.getImage("smoke"));
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
    me.ParticleEmitter = me.ObjectContainer.extend(
    /** @scope me.ParticleEmitter.prototype */
    {
        // Emitter is Stream, launch particles constantly
            /** @ignore */
        _stream: false,

        // Frequency timer (in ms) for emitter launch new particles
        // used only in stream emitter
            /** @ignore */
        _frequencyTimer: 0,

        // Time of live (in ms) for emitter launch new particles
        // used only in stream emitter
            /** @ignore */
        _durationTimer: 0,

        // Emitter is emitting particles
            /** @ignore */
        _enabled: false,


        /**
         * @ignore
         */
        init: function(x, y, image) {
            var pos = new me.Vector2d(x, y);
            
            // call the parent constructor
            this.parent(pos);

            // Emitter will always update
            this.alwaysUpdate = true;

            // Cache the emitter start pos
            this._defaultPos = pos;

            // Cache the emitter start image
            this._defaultImage = image;

            // don't sort the particles by z-index
            this.autoSort = false;

            // count the updates
            this._updateCount = 0;

            // internally store how much time was skipped when frames are skipped
            this._dt = 0;

            // Reset the emitter to defaults
            this.reset();

            /**
             * Z-order for particles <br>
             * default value : 0
             * @type Number
             * @name z
             * @memberOf me.ParticleEmitter
             */
            this.z = 0;
        },


        /**
         * Reset the Emitter with defaults params <br>
         * @function
         * @param {Object} params [optional] object with emitter params
         * @name reset
         * @memberOf me.ParticleEmitter
         */
        reset: function(params) {
            // check if params exists and create a dummy object
            params = params || {};

            /**
             * Start position for launch particles <br>
             * default value : x, y <br>
             * @public
             * @type me.Vector2d
             * @name pos
             * @memberOf me.ParticleEmitter
             */
            this.pos = params.pos || this._defaultPos.clone();

            /**
             * Variation in the start position for launch the particles (x, y) <br>
             * Random value in range [pos - varPos, pos + varPos] <br>
             * default value : 0, 0 <br>
             * @public
             * @type me.Vector2d
             * @name varPos
             * @memberOf me.ParticleEmitter
             */
            this.varPos = params.varPos || new me.Vector2d(0, 0);

            /**
             * Image used for particles <br>
             * @public
             * @type me.SpriteObject
             * @name image
             * @memberOf me.ParticleEmitter
             */
            this.image = params.image || this._defaultImage;

            /**
             * Total number of particles in this emitter <br>
             * default value : 50 <br>
             * @public
             * @type Number
             * @name totalParticles
             * @memberOf me.ParticleEmitter
             */
            this.totalParticles = params.totalParticles || 50;

            /**
             * Minimum start angle for launch particles in Radians <br>
             * default value : Math.PI / 2<br>
             * @public
             * @type Number
             * @name minAngle
             * @memberOf me.ParticleEmitter
             */
            this.minAngle = params.minAngle || (Math.PI / 2);

            /**
             * Maximum start angle for launch particles in Radians <br>
             * default value : Math.PI / 2 <br>
             * @public
             * @type Number
             * @name maxAngle
             * @memberOf me.ParticleEmitter
             */
            this.maxAngle = params.maxAngle || (Math.PI / 2);

            /**
             * Minimum time each particle lives once it is emitted in ms <br>
             * default value : 1000 <br>
             * @public
             * @type Number
             * @name minLife
             * @memberOf me.ParticleEmitter
             */
            this.minLife = params.minLife || 1000;

            /**
             * Maximum time each particle lives once it is emitted in ms <br>
             * default value : 3000 <br>
             * @public
             * @type Number
             * @name maxLife
             * @memberOf me.ParticleEmitter
             */
            this.maxLife = params.maxLife || 3000;

            /**
             * Minimum start speed for particles <br>
             * default value : 1 <br>
             * @public
             * @type Number
             * @name minSpeed
             * @memberOf me.ParticleEmitter
             */
            this.minSpeed = params.minSpeed || 1;

            /**
             * Maximum start speed for particles <br>
             * default value : 3 <br>
             * @public
             * @type Number
             * @name maxSpeed
             * @memberOf me.ParticleEmitter
             */
            this.maxSpeed = params.maxSpeed || 3;

            /**
             * Minimum start rotation for particles sprites in Radians <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name minRotation
             * @memberOf me.ParticleEmitter
             */
            this.minRotation = params.minRotation || 0;

            /**
             * Maximum start rotation for particles sprites in Radians <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name maxRotation
             * @memberOf me.ParticleEmitter
             */
            this.maxRotation = params.maxRotation || 0;

            /**
             * Minimum start scale ratio for particles (1 = no scaling) <br>
             * default value : 1 <br>
             * @public
             * @type Number
             * @name minStartScale
             * @memberOf me.ParticleEmitter
             */
            this.minStartScale = params.minStartScale || 1;

            /**
             * Maximum start scale ratio for particles (1 = no scaling) <br>
             * default value : 1 <br>
             * @public
             * @type Number
             * @name maxStartScale
             * @memberOf me.ParticleEmitter
             */
            this.maxStartScale = params.maxStartScale || 1;

            /**
             * Minimum end scale ratio for particles <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name minEndScale
             * @memberOf me.ParticleEmitter
             */
            this.minEndScale = params.minEndScale || 0;

            /**
             * Maximum end scale ratio for particles <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name maxEndScale
             * @memberOf me.ParticleEmitter
             */
            this.maxEndScale = params.maxEndScale || 0;

            /**
             * Vertical force (Gravity) for each particle <br>
             * default value : me.sys.gravity or 0 <br>
             * @public
             * @type Number
             * @name gravity
             * @memberOf me.ParticleEmitter
             */
            this.gravity = params.gravity || me.sys.gravity || 0;

            /**
             * Horizontal force (like a Wind) for each particle <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name wind
             * @memberOf me.ParticleEmitter
             */
            this.wind = params.wind || 0;

            /**
             * Update the rotation of particle in accordance the particle trajectory <br>
             * The particle sprite should aim at zero angle (draw from left to right) <br>
             * Override the particle minRotation and maxRotation <br>
             * default value : false <br>
             * @public
             * @type Boolean
             * @name followTrajectory
             * @memberOf me.ParticleEmitter
             */
            this.followTrajectory = params.followTrajectory || false;

            /**
             * Enable the Texture Additive by canvas composite operation (lighter) <br>
             * WARNING: Composite Operation may decreases performance! <br>
             * default value : false <br>
             * @public
             * @type Boolean
             * @name textureAdditive
             * @memberOf me.ParticleEmitter
             */
            this.textureAdditive = params.textureAdditive || false;

            /**
             * Update particles only in the viewport, remove it when out of viewport <br>
             * default value : true <br>
             * @public
             * @type Boolean
             * @name onlyInViewport
             * @memberOf me.ParticleEmitter
             */
            this.onlyInViewport = params.onlyInViewport || true;

            /**
             * Maximum number of particles launched each time in this emitter (used only if emitter is Stream) <br>
             * default value : 10 <br>
             * @public
             * @type Number
             * @name maxParticles
             * @memberOf me.ParticleEmitter
             */
            this.maxParticles = params.maxParticles || 10;

            /**
             * How often a particle is emitted in ms (used only if emitter is Stream) <br>
             * Necessary that value is greater than zero <br>
             * default value : 100 <br>
             * @public
             * @type Number
             * @name frequency
             * @memberOf me.ParticleEmitter
             */
            this.frequency = params.frequency || 100;

            /**
             * Duration that the emitter releases particles in ms (used only if emitter is Stream) <br>
             * After this period, the emitter stop the launch of particles <br>
             * default value : Infinity <br>
             * @public
             * @type Number
             * @name duration
             * @memberOf me.ParticleEmitter
             */
            this.duration = params.duration || Infinity;

            /**
             * Skip n frames after updating the particle system once. <br>
             * default value : 0 <br>
             * @public
             * @type Number
             * @name framesToSkip
             * @memberOf me.ParticleEmitter
             */
            this.framesToSkip = params.framesToSkip || 0;

            // reset internal values
            this.destroy();
            this._updateCount = 0;
            this._dt = 0;
        },


        // Add count particles in the game world
        /** @ignore */
        addParticles: function(count) {
            for (var i = 0; i < ~~count; i++) {
                // Add particle in the emitter
            	this.addChild(me.entityPool.newInstanceOf("me.Particle", this));
            }
        },


        /**
         * Emitter is of type stream and is launching particles <br>
         * @function
         * @returns {Boolean} Emitter is Stream and is launching particles
         * @name isRunning
         * @memberOf me.ParticleEmitter
         */
        isRunning: function() {
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
        streamParticles: function(duration) {
            this._enabled = true;
            this._stream = true;
            this.frequency = Math.max(this.frequency, 1);
            this._durationTimer = duration || this.duration;
        },


        /**
         * Stop the emitter from generating new particles (used only if emitter is Stream) <br>
         * @function
         * @name stopStream
         * @memberOf me.ParticleEmitter
         */
        stopStream: function() {
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
        burstParticles: function(total) {
            this._enabled = true;
            this._stream = false;
            this.addParticles(total || this.totalParticles);
            this._enabled = false;
        },


        /**
         * Update the Emitter <br>
         * This is automatically called by the game manager {@link me.game}
         * @name update
         * @memberOf me.ParticleEmitter
         * @function
         * @ignore
         * @param {Number} dt time since the last update in milliseconds
         */
        update: function(dt) {
            if (++this._updateCount > this.framesToSkip) {
                this._updateCount = 0;
            }
            if(this._updateCount > 0) {
            	this._dt += dt;
            	return false;
            }

            dt += this._dt;
            this._dt = 0;

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
                var particlesCount = this.children.length;
                if ((particlesCount < this.totalParticles) && (this._frequencyTimer >= this.frequency)) {
                    if ((particlesCount + this.maxParticles) <= this.totalParticles)
                        this.addParticles(this.maxParticles);
                    else
                        this.addParticles(this.totalParticles - particlesCount);

                    this._frequencyTimer = 0;
                }
            }

            // Update particles and remove them if they are dead
            var viewport = me.game.viewport;
            for ( var i = this.children.length - 1; i >= 0; --i) {
                var particle = this.children[i];
                // particle.inViewport = viewport.isVisible(particle);
                particle.inViewport = (particle.pos.x < viewport.pos.x + viewport.width && 
                                       viewport.pos.x < particle.pos.x + particle.width && 
                                       particle.pos.y < viewport.pos.y + viewport.height &&
                                       viewport.pos.y < particle.pos.y + particle.height);
                if(!particle.update(dt)) {
                	this.removeChildNow(particle);
                }
            }
            return true;
        },

        /**
         * @ignore
         */
        draw : function(context) {
            var particlesCount = this.children.length;
            if(particlesCount > 0) {
                // save context
                context.save();

                var originalAlpha = context.globalAlpha;

                // Check for additive draw
                if (this.textureAdditive) {
                    context.globalCompositeOperation = "lighter";
                }

                for ( var i = 0; i < particlesCount; ++i) {
                    var particle = this.children[i];
                    if(!particle.isDead) {
                        particle.draw(context, originalAlpha)
                    }
                }
            }

            // restore context
            context.restore();
        }
    });


    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})(window);
