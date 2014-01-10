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
    me.Particle = me.SpriteObject.extend(
    /** @scope me.Particle.prototype */
    {

        /**
         * @ignore
         */
        init: function(emitter) {
            // Call the parent constructor
            this.parent(emitter.pos.x + (Number.prototype.random(-emitter.varPos.x, emitter.varPos.x)),
                        emitter.pos.y + (Number.prototype.random(-emitter.varPos.y, emitter.varPos.y)),
                        emitter.image);

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

            // Set the particle additive draw
            this.textureAdditive = emitter.textureAdditive;

            // Set the particle Z Order
            this.z = emitter.z;
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

                // Adjust the particle velocity
                this.vel.x += this.wind;
                this.vel.y += this.gravity;

                // Update particle position
                this.pos.x += this.vel.x * me.timer.tick;
                this.pos.y += this.vel.y * me.timer.tick;

                // Update the rotation of particle in accordance the particle trajectory
                if (this.followTrajectory)
                    this.angle = Math.atan2(this.vel.y, this.vel.x);

                // Call the parent constructor
                this.parent(dt);
                return true;
            } else {
                // Remove particle from game world
                this._emitter._particlesCount--;
                me.game.world.removeChild(this);
            }

            return false;
        },

        /**
         * @ignore
         */
        draw: function(context) {
            // Check for particle additive draw
            if (this.textureAdditive) {
                var gco = context.globalCompositeOperation;
                context.globalCompositeOperation = "lighter";
                this.parent(context);
                context.globalCompositeOperation = gco;
            } else {
                this.parent(context);
            }
        }
    });


    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})(window);
