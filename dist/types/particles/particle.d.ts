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
     * @ignore
     */
    draw(renderer: any): void;
}
import Renderable from "./../renderable/renderable.js";
import type ParticleEmitter from "./emitter.js";
