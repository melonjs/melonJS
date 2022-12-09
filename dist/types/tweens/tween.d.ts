/**
 * @classdesc
 * Javascript Tweening Engine<p>
 * Super simple, fast and easy to use tweening engine which incorporates optimised Robert Penner's equation<p>
 * <a href="https://github.com/sole/Tween.js">https://github.com/sole/Tween.js</a><p>
 * author sole / http://soledadpenades.com<br>
 * author mr.doob / http://mrdoob.com<br>
 * author Robert Eisele / http://www.xarg.org<br>
 * author Philippe / http://philippe.elsass.me<br>
 * author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html<br>
 * author Paul Lewis / http://www.aerotwist.com/<br>
 * author lechecacharro<br>
 * author Josh Faul / http://jocafa.com/
 */
export default class Tween {
    static get Easing(): any;
    static get Interpolation(): any;
    /**
     * @param {object} object - object on which to apply the tween
     * @example
     * // add a tween to change the object pos.x and pos.y variable to 200 in 3 seconds
     * tween = new me.Tween(myObject.pos).to({
     *       x: 200,
     *       y: 200,
     *    }, {
     *       duration: 3000,
     *       easing: me.Tween.Easing.Bounce.Out,
     *       autoStart : true
     * }).onComplete(myFunc);
     */
    constructor(object: object);
    /**
     * reset the tween object to default value
     * @ignore
     */
    onResetEvent(object: any): void;
    /**
     * @ignore
     */
    setProperties(object: any): void;
    _object: any;
    _valuesStart: {} | undefined;
    _valuesEnd: {} | undefined;
    _valuesStartRepeat: {} | undefined;
    _duration: any;
    _repeat: number | undefined;
    _yoyo: boolean | undefined;
    _reversed: any;
    _delayTime: number | undefined;
    _startTime: any;
    _easingFunction: any;
    _interpolationFunction: any;
    _chainedTweens: IArguments | any[] | undefined;
    _onStartCallback: Function | null | undefined;
    _onStartCallbackFired: boolean | undefined;
    _onUpdateCallback: Function | null | undefined;
    _onCompleteCallback: Function | null | undefined;
    _tweenTimeTracker: any;
    isPersistent: boolean | undefined;
    updateWhenPaused: boolean | undefined;
    isRenderable: boolean | undefined;
    /**
     * @ignore
     */
    _resumeCallback(elapsed: any): void;
    /**
     * subscribe to the resume event when added
     * @ignore
     */
    onActivateEvent(): void;
    /**
     * Unsubscribe when tween is removed
     * @ignore
     */
    onDeactivateEvent(): void;
    /**
     * object properties to be updated and duration
     * @name to
     * @memberof Tween
     * @public
     * @param {object} properties - hash of properties
     * @param {object|number} [options] - object of tween properties, or a duration if a numeric value is passed
     * @param {number} [options.duration] - tween duration
     * @param {Tween.Easing} [options.easing] - easing function
     * @param {number} [options.delay] - delay amount expressed in milliseconds
     * @param {boolean} [options.yoyo] - allows the tween to bounce back to their original value when finished. To be used together with repeat to create endless loops.
     * @param {number} [options.repeat] - amount of times the tween should be repeated
     * @param {Tween.Interpolation} [options.interpolation] - interpolation function
     * @param {boolean} [options.autoStart] - allow this tween to start automatically. Otherwise call me.Tween.start().
     * @returns {Tween} this instance for object chaining
     */
    public to(properties: object, options?: number | object | undefined): Tween;
    /**
     * start the tween
     * @name start
     * @memberof Tween
     * @public
     * @param {number} [time] - the current time when the tween was started
     * @returns {Tween} this instance for object chaining
     */
    public start(time?: number | undefined): Tween;
    /**
     * stop the tween
     * @name stop
     * @memberof Tween
     * @public
     * @returns {Tween} this instance for object chaining
     */
    public stop(): Tween;
    /**
     * delay the tween
     * @name delay
     * @memberof Tween
     * @public
     * @param {number} amount - delay amount expressed in milliseconds
     * @returns {Tween} this instance for object chaining
     */
    public delay(amount: number): Tween;
    /**
     * Repeat the tween
     * @name repeat
     * @memberof Tween
     * @public
     * @param {number} times - amount of times the tween should be repeated
     * @returns {Tween} this instance for object chaining
     */
    public repeat(times: number): Tween;
    /**
     * Allows the tween to bounce back to their original value when finished.
     * To be used together with repeat to create endless loops.
     * @name yoyo
     * @memberof Tween
     * @public
     * @see Tween#repeat
     * @param {boolean} yoyo
     * @returns {Tween} this instance for object chaining
     */
    public yoyo(yoyo: boolean): Tween;
    /**
     * set the easing function
     * @name easing
     * @memberof Tween
     * @public
     * @param {Tween.Easing} easing - easing function
     * @returns {Tween} this instance for object chaining
     */
    public easing(easing: any): Tween;
    /**
     * set the interpolation function
     * @name interpolation
     * @memberof Tween
     * @public
     * @param {Tween.Interpolation} interpolation - interpolation function
     * @returns {Tween} this instance for object chaining
     */
    public interpolation(interpolation: any): Tween;
    /**
     * chain the tween
     * @name chain
     * @memberof Tween
     * @public
     * @param {...Tween} chainedTween - Tween(s) to be chained
     * @returns {Tween} this instance for object chaining
     */
    public chain(...args: Tween[]): Tween;
    /**
     * onStart callback
     * @name onStart
     * @memberof Tween
     * @public
     * @param {Function} onStartCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    public onStart(onStartCallback: Function): Tween;
    /**
     * onUpdate callback
     * @name onUpdate
     * @memberof Tween
     * @public
     * @param {Function} onUpdateCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    public onUpdate(onUpdateCallback: Function): Tween;
    /**
     * onComplete callback
     * @name onComplete
     * @memberof Tween
     * @public
     * @param {Function} onCompleteCallback - callback
     * @returns {Tween} this instance for object chaining
     */
    public onComplete(onCompleteCallback: Function): Tween;
    /** @ignore */
    update(dt: any): boolean;
}
