/**
 * @classdesc
 * Single Particle Object.
 * @augments Renderable
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
    vel: any;
    image: any;
    life: any;
    startLife: any;
    startScale: number;
    endScale: number;
    gravity: any;
    wind: any;
    followTrajectory: any;
    onlyInViewport: any;
    _deltaInv: number;
    angle: number;
    /**
     * @ignore
     */
    draw(renderer: any): void;
}
import Renderable from "./../renderable/renderable.js";
