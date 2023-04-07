/**
 * @classdesc
 * Particle Emitter Object.
 * @augments Container
 */
export default class ParticleEmitter extends Container {
    /**
     * @param {number} x - x position of the particle emitter
     * @param {number} y - y position of the particle emitter
     * @param {ParticleEmitterSettings} [settings=ParticleEmitterSettings] - the settings for the particle emitter.
     * @example
     * // Create a particle emitter at position 100, 100
     * let emitter = new ParticleEmitter(100, 100, {
     *     width: 16,
     *     height : 16,
     *     tint: "#f00",
     *     totalParticles: 32,
     *     angle: 0,
     *     angleVariation: 6.283185307179586,
     *     maxLife: 5,
     *     speed: 3
     * });
     *
     * // Add the emitter to the game world
     * me.game.world.addChild(emitter);
     *
     * // Launch all particles one time and stop, like a explosion
     * emitter.burstParticles();
     *
     * // Launch constantly the particles, like a fountain
     * emitter.streamParticles();
     *
     * // At the end, remove emitter from the game world
     * // call this in onDestroyEvent function
     * me.game.world.removeChild(emitter);
     */
    constructor(x: number, y: number, settings?: {
        width: number;
        height: number;
        image: HTMLCanvasElement;
        textureSize: number;
        tint: string;
        totalParticles: number;
        angle: number;
        angleVariation: number;
        minLife: number;
        maxLife: number;
        speed: number;
        speedVariation: number;
        minRotation: number;
        maxRotation: number;
        minStartScale: number;
        maxStartScale: number;
        minEndScale: number;
        maxEndScale: number;
        gravity: number;
        wind: number;
        followTrajectory: boolean;
        textureAdditive: boolean;
        blendMode: string;
        onlyInViewport: boolean;
        floating: boolean;
        maxParticles: number;
        frequency: number;
        duration: number;
        framesToSkip: number;
    } | undefined);
    /**
     * the current (active) emitter settings
     * @public
     * @type {ParticleEmitterSettings}
     * @name settings
     * @memberof ParticleEmitter
     */
    public settings: {
        width: number;
        height: number;
        image: HTMLCanvasElement;
        textureSize: number;
        tint: string;
        totalParticles: number;
        angle: number;
        angleVariation: number;
        minLife: number;
        maxLife: number;
        speed: number;
        speedVariation: number;
        minRotation: number;
        maxRotation: number;
        minStartScale: number;
        maxStartScale: number;
        minEndScale: number;
        maxEndScale: number;
        gravity: number;
        wind: number;
        followTrajectory: boolean;
        textureAdditive: boolean;
        blendMode: string;
        onlyInViewport: boolean;
        floating: boolean;
        maxParticles: number;
        frequency: number;
        duration: number;
        framesToSkip: number;
    };
    /** @ignore */
    _stream: boolean;
    /** @ignore */
    _frequencyTimer: number;
    /** @ignore */
    _durationTimer: number;
    /** @ignore */
    _enabled: boolean;
    _updateCount: number;
    _dt: number;
    /**
     * Reset the emitter with particle emitter settings.
     * @param {ParticleEmitterSettings} settings - [optional] object with emitter settings. See {@link ParticleEmitterSettings}
     */
    reset(settings?: {
        width: number;
        height: number;
        image: HTMLCanvasElement;
        textureSize: number;
        tint: string;
        totalParticles: number;
        angle: number;
        angleVariation: number;
        minLife: number;
        maxLife: number;
        speed: number;
        speedVariation: number;
        minRotation: number;
        maxRotation: number;
        minStartScale: number;
        maxStartScale: number;
        minEndScale: number;
        maxEndScale: number;
        gravity: number;
        wind: number;
        followTrajectory: boolean;
        textureAdditive: boolean;
        blendMode: string;
        onlyInViewport: boolean;
        floating: boolean;
        maxParticles: number;
        frequency: number;
        duration: number;
        framesToSkip: number;
    }): void;
    _defaultParticle: object | undefined;
    /**
     * returns a random point on the x axis within the bounds of this emitter
     * @returns {number}
     */
    getRandomPointX(): number;
    /**
     * returns a random point on the y axis within the bounds this emitter
     * @returns {number}
     */
    getRandomPointY(): number;
    /** @ignore */
    addParticles(count: any): void;
    /**
     * Emitter is of type stream and is launching particles
     * @returns {boolean} Emitter is Stream and is launching particles
     */
    isRunning(): boolean;
    /**
     * Launch particles from emitter constantly (e.g. for stream)
     * @param {number} [duration] - time that the emitter releases particles in ms
     */
    streamParticles(duration?: number | undefined): void;
    /**
     * Stop the emitter from generating new particles (used only if emitter is Stream)
     */
    stopStream(): void;
    /**
     * Launch all particles from emitter and stop (e.g. for explosion)
     * @param {number} [total] - number of particles to launch
     */
    burstParticles(total?: number | undefined): void;
    /**
     * @ignore
     */
    update(dt: any): boolean;
}
import Container from "./../renderable/container.js";
