/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

    /**
     * Single Particle Object.
     * @class
     * @extends me.SpriteObject
     * @memberOf me
     * @constructor
     * @param {me.ParticleEmitter} particle emitter
     */
    me.Particle = me.Renderable.extend(
    /** @scope me.Particle.prototype */
    {

        /**
         * Source rotation angle for pre-rotating the source image<br>
         * Commonly used for TexturePacker
         * @ignore
         */
        _sourceAngle: 0,
        
        /**
         * @ignore
         */
        init: function(emitter) {
            // Call the parent constructor
            this.parent(new me.Vector2d(emitter.pos.x + (Number.prototype.random(-emitter.varPos.x, emitter.varPos.x)),
                        emitter.pos.y + (Number.prototype.random(-emitter.varPos.y, emitter.varPos.y))),
                        emitter.image.width, emitter.image.height);

            // Particle will always update
            this.alwaysUpdate = true;

            // Cache the particle emitter
            this._emitter = emitter;

            // Set the start particle Angle and Speed as defined in emitter
            var angle = Number.prototype.random(emitter.minAngle * 10, emitter.maxAngle * 10) / 10;
            var speed = Number.prototype.random(emitter.minSpeed, emitter.maxSpeed);

            // Set the start particle Velocity
            this.vel = new me.Vector2d(speed * Math.cos(angle), -speed * Math.sin(angle));

            // Set the start particle rotation as defined in emitter
            // if the particle not follow trajectory
            if (!emitter.followTrajectory)
                this.angle = Number.prototype.random(emitter.minRotation, emitter.maxRotation);

            // Set the start particle Time of Life as defined in emitter
            this.life = Number.prototype.random(emitter.minLife, emitter.maxLife);
            this.startLife = this.life;

            // Set the start and end particle Scale as defined in emitter
            // clamp the values as minimum and maximum scales range
            this.startScale = Number.prototype.random(emitter.minStartScale, emitter.maxStartScale).
                            clamp(emitter.minStartScale, emitter.maxStartScale);
            this.endScale = Number.prototype.random(emitter.minEndScale, emitter.maxEndScale).
                            clamp(emitter.minEndScale, emitter.maxEndScale);

            // Set the particle Gravity and Wind (horizontal gravity) as defined in emitter
            this.gravity = emitter.gravity;
            this.wind = emitter.wind;

            // Set if the particle update the rotation in accordance the trajectory
            this.followTrajectory = emitter.followTrajectory;

            // Set if the particle update only in Viewport
            this.onlyInViewport = emitter.onlyInViewport;

            // Set the particle Z Order
            this.z = emitter.z;
            
            // Reset if this particle can be removed from the emitter
            this.isDead = false;

            // scale factor of the object
            this.scale = new me.Vector2d(1.0, 1.0);
            this.scaleFlag = false;

        },
        
        /**
         * Resize the particle around his center<br>
         * @name resize
         * @memberOf me.Particle
         * @function
         * @param {Number} ratio scaling ratio
         */
        resize : function(ratio) {
            if (ratio > 0) {
                this.scale.x = this.scale.x < 0.0 ? -ratio : ratio;
                this.scale.y = this.scale.y < 0.0 ? -ratio : ratio;
                // set the scaleFlag
                this.scaleFlag = this.scale.x !== 1.0 || this.scale.y !== 1.0;
            }
        },

        /**
         * Update the Particle <br>
         * This is automatically called by the game manager {@link me.game}
         * @name update
         * @memberOf me.Particle
         * @function
         * @ignore
         * @param {Number} dt time since the last update in milliseconds
         */
        update: function(dt) {
            if ((this.inViewport || !this.onlyInViewport) && (this.life > 0)) {
                // Decrease particle life
                this.life -= dt;

                // Calculate the particle Age Ratio
                var ageRatio = this.life / this.startLife;

                // Resize the particle as particle Age Ratio
                var scale = (this.startScale > this.endScale) ?
                            Math.max(this.endScale, (this.startScale * ageRatio)) :
                            Math.min(this.endScale, (this.startScale / ageRatio));
                this.resize(scale);

                // Set the particle opacity as Age Ratio
                this.setOpacity(ageRatio);

                var skew = dt * me.sys.fps / 1000;

                // Adjust the particle velocity
                this.vel.x += this.wind * skew;
                this.vel.y += this.gravity * skew;

                // Update particle position
                this.pos.x += this.vel.x * skew;
                this.pos.y += this.vel.y * skew;

                // Update the rotation of particle in accordance the particle trajectory
                if (this.followTrajectory)
                    this.angle = Math.atan2(this.vel.y, this.vel.x);

                return true;
            } else {
                // Mark particle for removal 
                this.isDead = true;
            }

            return false;
        },
    });


    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})(window);
