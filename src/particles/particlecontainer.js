/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2017, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 */
(function () {
    /**
     * Particle Container Object.
     * @class
     * @extends me.Container
     * @memberOf me
     * @constructor
     * @param {me.ParticleEmitter} emitter the emitter which owns this container
     */
    me.ParticleContainer = me.Container.extend(
    /** @scope ParticleContainer */
    {
        /**
         * @ignore
         */
        init: function (emitter) {
            // cache a reference to the viewport to use as our bounding box
            this._viewport = me.game.viewport;

            // call the super constructor
            this._super(me.Container, "init");

            // don't sort the particles by z-index
            this.autoSort = false;

            // count the updates
            this._updateCount = 0;

            // internally store how much time was skipped when frames are skipped
            this._dt = 0;

            // cache the emitter for later use
            this._emitter = emitter;
        },

        /**
         * @ignore
         */
        getBounds : function () {
            return this._viewport;
        },

        /**
         * @ignore
         */
        update: function (dt) {
            // skip frames if necessary
            if (++this._updateCount > this._emitter.framesToSkip) {
                this._updateCount = 0;
            }
            if (this._updateCount > 0) {
                this._dt += dt;
                return false;
            }

            // apply skipped delta time
            dt += this._dt;
            this._dt = 0;

            // Update particles and remove them if they are dead
            var viewport = me.game.viewport;
            for (var i = this.children.length - 1; i >= 0; --i) {
                var particle = this.children[i];
                particle.isRenderable = true;
                // particle.inViewport = viewport.isVisible(particle);
                particle.inViewport = this.floating || (
                    particle.pos.x < viewport.pos.x + viewport.width &&
                    viewport.pos.x < particle.pos.x + particle.width &&
                    particle.pos.y < viewport.pos.y + viewport.height &&
                    viewport.pos.y < particle.pos.y + particle.height
                );
                if (!particle.update(dt)) {
                    this.removeChildNow(particle);
                }
            }
            return true;
        },

        /**
         * @ignore
         */
        draw : function (renderer, rect) {
            if (this.children.length > 0) {
                var context = renderer.getContext(),
                    gco;
                // Check for additive draw
                if (this._emitter.textureAdditive) {
                    gco = context.globalCompositeOperation;
                    context.globalCompositeOperation = "lighter";
                }

                this._super(me.Container, "draw", [renderer, rect]);

                // Restore globalCompositeOperation
                if (this._emitter.textureAdditive) {
                    context.globalCompositeOperation = gco;
                }
            }
        }
    });
})();
