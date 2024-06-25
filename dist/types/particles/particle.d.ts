/**
 * @import ParticleEmitter from "./emitter.js";
 */
/**
 * Single Particle Object.
 */
export default class Particle extends Renderable {
    /**
     * @param {ParticleEmitter} emitter - the particle emitter
     */
    constructor(emitter: ParticleEmitter);
    /**
     * @ignore
     */
    onResetEvent(emitter: any, newInstance?: boolean): void;
    vel: object | undefined;
    image: any;
    life: any;
    startLife: any;
    startScale: number | undefined;
    endScale: number | undefined;
    gravity: any;
    wind: any;
    followTrajectory: any;
    onlyInViewport: any;
    _deltaInv: number | undefined;
    angle: number | undefined;
    /**
     * Update the Particle <br>
     * This is automatically called by the game manager {@link game}
     * @ignore
     * @param {number} dt - time since the last update in milliseconds
     */
    update(dt: number): boolean;
    /**
     * @ignore
     */
    draw(renderer: any): void;
}
import Renderable from "./../renderable/renderable.js";
import type ParticleEmitter from "./emitter.js";
