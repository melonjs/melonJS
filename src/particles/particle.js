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

            this.transform = new me.Matrix2d(1, 0, 0, 1, this.pos.x, this.pos.y);

            // Set the start particle rotation as defined in emitter
            // if the particle not follow trajectory
            if (!emitter.followTrajectory) {
                var angle = Number.prototype.random(emitter.minRotation, emitter.maxRotation);
                //this.transform.rotateLocal(this.angle);
                if (angle !== 0) {
                    var cos = Math.cos(angle);
                    var sin = Math.sin(angle);
                    var a = this.transform.a;
                    var b = this.transform.b;
                    var c = this.transform.c;
                    var d = this.transform.d;
                    this.transform.a = a * cos - b * sin;
                    this.transform.b = a * sin + b * cos;
                    this.transform.c = c * cos - d * sin;
                    this.transform.d = c * sin + d * cos;
                }
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
                var skew = dt * me.sys.fps / 1000;

                // Decrease particle life
                this.life -= dt;

                // Calculate the particle Age Ratio
                var ageRatio = this.life / this.startLife;

                // Resize the particle as particle Age Ratio
                var scale = (this.startScale > this.endScale) ?
                            Math.max(this.endScale, (this.startScale * ageRatio)) :
                            Math.min(this.endScale, (this.startScale / ageRatio));
                scale = scale > 0 ? scale : 0;
                // this.transform.setScale(scale);
                this.transform.set(scale, 0, 0, scale, this.transform.e, this.transform.f);

                // Set the particle opacity as Age Ratio
                this.alpha = ageRatio > 0 ? ageRatio : 0;

                // Adjust the particle velocity
                this.vel.x += this.wind * skew;
                this.vel.y += this.gravity * skew;

                // Update the rotation of particle in accordance the particle trajectory
                if (this.followTrajectory) {
                    var angle = Math.atan2(this.vel.y, this.vel.x);
                    //this.transform.rotateLocal(this.angle);
                    if (angle !== 0) {
                        var cos = Math.cos(angle);
                        var sin = Math.sin(angle);
                        var a = this.transform.a;
                        var b = this.transform.b;
                        var c = this.transform.c;
                        var d = this.transform.d;
                        this.transform.a = a * cos - b * sin;
                        this.transform.b = a * sin + b * cos;
                        this.transform.c = c * cos - d * sin;
                        this.transform.d = c * sin + d * cos;
                    }
                }

                // Update particle position
                this.transform.translate(this.vel.x * skew, this.vel.y * skew);
                return true;
            } else {
                // Mark particle for removal 
                this.isDead = true;
            }

            return false;
        },

        draw: function(context, originalAlpha) {
            // particle alpha value
            context.globalAlpha = originalAlpha * this.alpha;

            // translate to the defined anchor point and scale it
            var transform = this.transform;
            context.setTransform(transform.a, transform.b, transform.c, transform.d, ~~transform.e, ~~transform.f);

            var w = this.width, h = this.height;
            context.drawImage(this._emitter.image,
                            0, 0,
                            w, h,
                            -w / 2, -h / 2,
                            w, h);
        }
    });


    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})(window);
