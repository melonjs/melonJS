import Vector2d from "./../math/vector2.js";
import timer from "./../system/timer.js";
import { randomFloat, clamp } from "./../math/math.js";
import Renderable from "./../renderable/renderable.js";


/**
 * @classdesc
 * Single Particle Object.
 * @class Particle
 * @augments me.Renderable
 * @memberof me
 * @param {me.ParticleEmitter} particle emitter
 */
class Particle extends Renderable {
    /**
     * @ignore
     */
    constructor(emitter) {
        // Call the super constructor
        super(
            emitter.getRandomPointX(),
            emitter.getRandomPointY(),
            emitter.image.width,
            emitter.image.height
        );

        // particle velocity
        this.vel = new Vector2d();
        this.onResetEvent(emitter, true);
    }

    onResetEvent(emitter, newInstance = false) {
        if (newInstance === false) {
            super.onResetEvent(
                emitter.getRandomPointX(),
                emitter.getRandomPointY(),
                emitter.image.width,
                emitter.image.height
            );
        }

        // Particle will always update
        this.alwaysUpdate = true;

        // Cache the image reference
        this.image = emitter.image;

        // Set the start particle Angle and Speed as defined in emitter
        var angle = emitter.angle + ((emitter.angleVariation > 0) ? (randomFloat(0, 2) - 1) * emitter.angleVariation : 0);
        var speed = emitter.speed + ((emitter.speedVariation > 0) ? (randomFloat(0, 2) - 1) * emitter.speedVariation : 0);

        // Set the start particle Velocity
        this.vel.set(speed * Math.cos(angle), -speed * Math.sin(angle));

        // Set the start particle Time of Life as defined in emitter
        this.life = randomFloat(emitter.minLife, emitter.maxLife);
        this.startLife = this.life;

        // Set the start and end particle Scale as defined in emitter
        // clamp the values as minimum and maximum scales range
        this.startScale = clamp(
            randomFloat(emitter.minStartScale, emitter.maxStartScale),
            emitter.minStartScale,
            emitter.maxStartScale
        );
        this.endScale = clamp(
            randomFloat(emitter.minEndScale, emitter.maxEndScale),
            emitter.minEndScale,
            emitter.maxEndScale
        );

        // Set the particle Gravity and Wind (horizontal gravity) as defined in emitter
        this.gravity = emitter.gravity;
        this.wind = emitter.wind;

        // Set if the particle update the rotation in accordance the trajectory
        this.followTrajectory = emitter.followTrajectory;

        // Set if the particle update only in Viewport
        this.onlyInViewport = emitter.onlyInViewport;

        // Set the particle Z Order
        this.pos.z = emitter.z;

        // cache inverse of the expected delta time
        this._deltaInv = timer.maxfps / 1000;

        // Set the start particle rotation as defined in emitter
        // if the particle not follow trajectory
        if (!emitter.followTrajectory) {
            this.angle = randomFloat(emitter.minRotation, emitter.maxRotation);
        }
    }

    /**
     * Update the Particle <br>
     * This is automatically called by the game manager {@link me.game}
     * @name update
     * @memberof me.Particle
     * @function
     * @ignore
     * @param {number} dt time since the last update in milliseconds
     */
    update(dt) {
        // move things forward independent of the current frame rate
        var skew = dt * this._deltaInv;

        // Decrease particle life
        this.life = this.life > dt ? this.life - dt : 0;

        // Calculate the particle Age Ratio
        var ageRatio = this.life / this.startLife;

        // Resize the particle as particle Age Ratio
        var scale = this.startScale;
        if (this.startScale > this.endScale) {
            scale *= ageRatio;
            scale = (scale < this.endScale) ? this.endScale : scale;
        }
        else if (this.startScale < this.endScale) {
            scale /= ageRatio;
            scale = (scale > this.endScale) ? this.endScale : scale;
        }

        // Set the particle opacity as Age Ratio
        this.alpha = ageRatio;

        // Adjust the particle velocity
        this.vel.x += this.wind * skew;
        this.vel.y += this.gravity * skew;

        // If necessary update the rotation of particle in accordance the particle trajectory
        var angle = this.followTrajectory ? Math.atan2(this.vel.y, this.vel.x) : this.angle;

        this.pos.x += this.vel.x * skew;
        this.pos.y += this.vel.y * skew;

        // Update particle transform
        this.currentTransform.setTransform(
            scale, 0, 0,
            0, scale, 0,
            this.pos.x, this.pos.y, 1
        ).rotate(angle);

        // Return true if the particle is not dead yet
        return (this.inViewport || !this.onlyInViewport) && (this.life > 0);
    }

    /**
     * @ignore
     */
    preDraw(renderer) {

        // restore is called in postDraw
        renderer.save();

        // particle alpha value
        renderer.setGlobalAlpha(renderer.globalAlpha() * this.alpha);

        // translate to the defined anchor point and scale it
        renderer.transform(this.currentTransform);
    }

    /**
     * @ignore
     */
    draw(renderer) {
        var w = this.width, h = this.height;
        renderer.drawImage(
            this.image,
            0, 0,
            w, h,
            -w / 2, -h / 2,
            w, h
        );
    }
};

export default Particle;
