import pool from "./../system/pooling.js";
import timer from "./../system/timer.js";
import { randomFloat, clamp } from "./../math/math.js";
import Renderable from "./../renderable/renderable.js";

/**
 * @import ParticleEmitter from "./emitter.js";
 */

/**
 * @classdesc
 * Single Particle Object.
 * @augments Renderable
 */
export default class Particle extends Renderable {
    /**
     * @param {ParticleEmitter} emitter - the particle emitter
     */
    constructor(emitter) {
        // Call the super constructor
        super(
            emitter.getRandomPointX(),
            emitter.getRandomPointY(),
            emitter.settings.image.width,
            emitter.settings.image.height
        );
        this.onResetEvent(emitter, true);
    }

    /**
     * @ignore
     */
    onResetEvent(emitter, newInstance = false) {
        if (newInstance === false) {
            this.pos.set(
                emitter.getRandomPointX(),
                emitter.getRandomPointY()
            );
            this.resize(
                emitter.settings.image.width,
                emitter.settings.image.height
            );
            this.currentTransform.identity();
        } else {
            // particle velocity
            this.vel = pool.pull("Vector2d");
        }

        this.image = emitter.settings.image;

        // Particle will always update
        this.alwaysUpdate = true;

        if (typeof emitter.settings.tint === "string") {
            this.tint.parseCSS(emitter.settings.tint);
        }

        if (emitter.settings.textureAdditive === true) {
            this.blendMode = "additive";
        }

        if (emitter.settings.blendMode !== "normal") {
            this.blendMode = emitter.settings.blendMode;
        }

        // Set the start particle Angle and Speed as defined in emitter
        let angle = emitter.settings.angle + ((emitter.settings.angleVariation > 0) ? (randomFloat(0, 2) - 1) * emitter.settings.angleVariation : 0);
        let speed = emitter.settings.speed + ((emitter.settings.speedVariation > 0) ? (randomFloat(0, 2) - 1) * emitter.settings.speedVariation : 0);

        // Set the start particle Velocity
        this.vel.set(speed * Math.cos(angle), -speed * Math.sin(angle));

        // Set the start particle Time of Life as defined in emitter
        this.life = randomFloat(emitter.settings.minLife, emitter.settings.maxLife);
        this.startLife = this.life;

        // Set the start and end particle Scale as defined in emitter
        // clamp the values as minimum and maximum scales range
        this.startScale = clamp(
            randomFloat(emitter.settings.minStartScale, emitter.settings.maxStartScale),
            emitter.settings.minStartScale,
            emitter.settings.maxStartScale
        );
        this.endScale = clamp(
            randomFloat(emitter.settings.minEndScale, emitter.settings.maxEndScale),
            emitter.settings.minEndScale,
            emitter.settings.maxEndScale
        );

        // Set the particle Gravity and Wind (horizontal gravity) as defined in emitter
        this.gravity = emitter.settings.gravity;
        this.wind = emitter.settings.wind;

        // Set if the particle update the rotation in accordance the trajectory
        this.followTrajectory = emitter.settings.followTrajectory;

        // Set if the particle update only in Viewport
        this.onlyInViewport = emitter.settings.onlyInViewport;

        // cache inverse of the expected delta time
        this._deltaInv = timer.maxfps / 1000;

        // Set the start particle rotation as defined in emitter
        // if the particle not follow trajectory
        if (!emitter.settings.followTrajectory) {
            this.angle = randomFloat(emitter.settings.minRotation, emitter.settings.maxRotation);
        }
    }

    /**
     * Update the Particle <br>
     * This is automatically called by the game manager {@link game}
     * @ignore
     * @param {number} dt - time since the last update in milliseconds
     */
    update(dt) {
        // move things forward independent of the current frame rate
        let skew = dt * this._deltaInv;

        // Decrease particle life
        this.life = this.life > dt ? this.life - dt : 0;

        if (this.life <= 0) {
            this.ancestor.removeChild(this);
            return false;
        }

        // Calculate the particle Age Ratio
        let ageRatio = this.life / this.startLife;

        // Resize the particle as particle Age Ratio
        let scale = this.startScale;
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
        let angle = this.followTrajectory ? Math.atan2(this.vel.y, this.vel.x) : this.angle;

        this.pos.x += this.vel.x * skew;
        this.pos.y += this.vel.y * skew;

        // Update particle transform
        this.currentTransform.setTransform(
            scale, 0, 0,
            0, scale, 0,
            this.pos.x, this.pos.y, 1
        ).rotate(angle);

        // mark as dirty if the particle is not dead yet
        this.isDirty = this.inViewport || !this.onlyInViewport;

        return super.update(dt);
    }

    /**
     * @ignore
     */
    draw(renderer) {
        let w = this.width, h = this.height;
        renderer.drawImage(
            this.image,
            0, 0,
            w, h,
            -w / 2, -h / 2,
            w, h
        );
    }
}

