/**
 * additional import for TypeScript
 * @import Color from "./../math/color.js";
 * @import { TextureAtlas } from "./../video/texture/atlas.js";
 */
/**
 * @classdesc
 * A NineSliceSprite is similar to a Sprite, but it uses 9-slice scaling to strech its inner area to fit the size of the Renderable,
 * by proportionally scaling a sprite by splitting it in a grid of nine parts (with only parts 1, 3, 7, 9 not being scaled). <br>
 * <img src="images/9-slice-scaling.png"/><br>
 * @see https://en.wikipedia.org/wiki/9-slice_scaling
 * @augments Sprite
 */
export default class NineSliceSprite extends Sprite {
    /**
     * @param {number} x - the x coordinates of the sprite object
     * @param {number} y - the y coordinates of the sprite object
     * @param {object} settings - Configuration parameters for the Sprite object
     * @param {number} settings.width - the width of the Renderable over which the sprite needs to be stretched
     * @param {number} settings.height - the height of the Renderable over which the sprite needs to be stretched
     * @param {number} [settings.insetx] - the width of a corner over which the sprite is unscaled (default is a quarter of the sprite width)
     * @param {number} [settings.insety] - the height of a corner over which the sprite is unscaled (default is a quarter of the sprite height)
     * @param {HTMLImageElement|HTMLCanvasElement|TextureAtlas|string} settings.image - reference to spritesheet image, a texture atlas or to a texture atlas
     * @param {string} [settings.name=""] - name of this object
     * @param {string} [settings.region] - region name of a specific region to use when using a texture atlas, see {@link TextureAtlas}
     * @param {number} [settings.framewidth] - Width of a single frame within the spritesheet
     * @param {number} [settings.frameheight] - Height of a single frame within the spritesheet
     * @param {string|Color} [settings.tint] - a tint to be applied to this sprite
     * @param {number} [settings.flipX] - flip the sprite on the horizontal axis
     * @param {number} [settings.flipY] - flip the sprite on the vertical axis
     * @param {Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] - Anchor point to draw the frame at (defaults to the center of the frame).
     * @example
     * this.panelSprite = new me.NineSliceSprite(0, 0, {
     *     image : game.texture,
     *     region : "grey_panel",
     *     width : this.width,
     *     height : this.height
     * });
     */
    constructor(x: number, y: number, settings: {
        width: number;
        height: number;
        insetx?: number | undefined;
        insety?: number | undefined;
        image: HTMLImageElement | HTMLCanvasElement | TextureAtlas | string;
        name?: string | undefined;
        region?: string | undefined;
        framewidth?: number | undefined;
        frameheight?: number | undefined;
        tint?: string | Color | undefined;
        flipX?: number | undefined;
        flipY?: number | undefined;
        anchorPoint?: any;
    });
    set width(value: number);
    /**
     * width of the NineSliceSprite
     * @type {number}
     */
    get width(): number;
    set height(value: number);
    /**
     * height of the NineSliceSprite
     * @type {number}
     */
    get height(): number;
    nss_width: number;
    nss_height: number;
    insetx: number | undefined;
    insety: number | undefined;
    /**
     * @ignore
     */
    draw(renderer: any): void;
}
import Sprite from "./sprite.js";
import type { TextureAtlas } from "./../video/texture/atlas.js";
import type Color from "./../math/color.js";
