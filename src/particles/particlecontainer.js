import Container from "./../renderable/container.js";
import { viewport } from "./../game.js";

/**
 * @ignore
 */
class ParticleContainer extends Container {
    /**
     * @param {ParticleEmitter} emitter the emitter which owns this container
     */
    constructor(emitter) {
        // call the super constructor
        super(
            viewport.pos.x,
            viewport.pos.y,
            viewport.width,
            viewport.height
        );

        // don't sort the particles by z-index
        this.autoSort = false;

        // count the updates
        this._updateCount = 0;

        // internally store how much time was skipped when frames are skipped
        this._dt = 0;

        // cache the emitter for later use
        this._emitter = emitter;

        this.autoTransform = false;

        this.anchorPoint.set(0, 0);

        this.isKinematic = true;

        if (this._emitter.textureAdditive) {
            this.blendMode = "additive";
        } else {
            this.blendMode = "normal";
        }
    }

    /**
     * @ignore
     */
    update(dt) {
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
        for (var i = this.children.length - 1; i >= 0; --i) {
            var particle = this.children[i];
            particle.inViewport = viewport.isVisible(particle, this.floating);
            if (!particle.update(dt)) {
                this.removeChildNow(particle);
            }
        }
        return true;
    }

};
export default ParticleContainer;
