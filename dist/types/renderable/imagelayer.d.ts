/**
 * @classdesc
 * a generic Image Layer Object
 * @augments Renderable
 */
export default class ImageLayer {
    /**
     * @param {number} x - x coordinate
     * @param {number} y - y coordinate
     * @param {object} settings - ImageLayer properties
     * @param {HTMLImageElement|HTMLCanvasElement|string} settings.image - Image reference. See {@link loader.getImage}
     * @param {string} [settings.name="me.ImageLayer"] - layer name
     * @param {number} [settings.z=0] - z-index position
     * @param {number|Vector2d} [settings.ratio=1.0] - Scrolling ratio to be applied. See {@link ImageLayer#ratio}
     * @param {string} [settings.repeat='repeat'] - define if and how an Image Layer should be repeated (accepted values are 'repeat', 'repeat-x', 'repeat-y', 'no-repeat'). See {@link ImageLayer#repeat}
     * @param {number|Vector2d} [settings.anchorPoint=0.0] - Image origin. See {@link ImageLayer#anchorPoint}
     * @example
     * // create a repetitive background pattern on the X axis using the citycloud image asset
     * me.game.world.addChild(new me.ImageLayer(0, 0, {
     *     image:"citycloud",
     *     repeat :"repeat-x"
     * }), 1);
     */
    constructor(x: number, y: number, settings: {
        image: HTMLImageElement | HTMLCanvasElement | string;
        name?: string | undefined;
        z?: number | undefined;
        ratio?: number | Vector2d;
        repeat?: string | undefined;
        anchorPoint?: number | Vector2d;
    });
    floating: boolean;
    /**
     * Define the image scrolling ratio<br>
     * Scrolling speed is defined by multiplying the viewport delta position by the specified ratio.
     * Setting this vector to &lt;0.0,0.0&gt; will disable automatic scrolling.<br>
     * To specify a value through Tiled, use one of the following format : <br>
     * - a number, to change the value for both axis <br>
     * - a json expression like `json:{"x":0.5,"y":0.5}` if you wish to specify a different value for both x and y
     * @public
     * @type {Vector2d}
     * @default <1.0,1.0>
     * @name ImageLayer#ratio
     */
    public ratio: Vector2d;
    public set repeat(arg: string);
    /**
     * Define if and how an Image Layer should be repeated.<br>
     * By default, an Image Layer is repeated both vertically and horizontally.<br>
     * Acceptable values : <br>
     * - 'repeat' - The background image will be repeated both vertically and horizontally <br>
     * - 'repeat-x' - The background image will be repeated only horizontally.<br>
     * - 'repeat-y' - The background image will be repeated only vertically.<br>
     * - 'no-repeat' - The background-image will not be repeated.<br>
     * @public
     * @type {string}
     * @default 'repeat'
     * @name ImageLayer#repeat
     */
    public get repeat(): string;
    _repeat: string | undefined;
    repeatX: boolean | undefined;
    repeatY: boolean | undefined;
    onActivateEvent(): void;
    /**
     * resize the Image Layer to match the given size
     * @name resize
     * @memberof ImageLayer
     * @param {number} w - new width
     * @param {number} h - new height
     */
    resize(w: number, h: number): any;
    /**
     * createPattern function
     * @ignore
     */
    createPattern(): void;
    _pattern: any;
    /**
     * updateLayer function
     * @ignore
     */
    updateLayer(vpos: any): void;
    isDirty: boolean | undefined;
    /**
     * override the default predraw function
     * as repeat and anchor are managed directly in the draw method
     * @ignore
     */
    preDraw(renderer: any): void;
    /**
     * draw this ImageLayer (automatically called by melonJS)
     * @name draw
     * @memberof ImageLayer
     * @protected
     * @param {CanvasRenderer|WebGLRenderer} renderer - a renderer instance
     * @param {Camera2d} [viewport] - the viewport to (re)draw
     */
    protected draw(renderer: CanvasRenderer | WebGLRenderer, viewport?: any): void;
    onDeactivateEvent(): void;
    /**
     * Destroy function<br>
     * @ignore
     */
    destroy(): void;
}
