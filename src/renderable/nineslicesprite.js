import Sprite from "./sprite.js";

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
    constructor(x, y, settings) {
        // call the super constructor
        super(x, y, settings);

        // ensure mandatory properties are defined
        if ((typeof settings.width !== "number") || (typeof settings.height !== "number")) {
            throw new Error("height and width properties are mandatory");
        }

        // adjust the nss sprite size accordingly to the target "expanded" size
        this.width = Math.floor(settings.width);
        this.height = Math.floor(settings.height);

        // nine slice sprite specific internal variables
        this.nss_width = this.width;
        this.nss_height = this.height;

        this.insetx = settings.insetx;
        this.insety = settings.insety;
    }

    /**
     * width of the NineSliceSprite
     * @type {number}
     */
    get width() {
        return super.width;
    }
    set width(value) {
        super.width = this.nss_width = value;
    }

    /**
     * height of the NineSliceSprite
     * @type {number}
     */
    get height() {
        return super.height;
    }
    set height(value) {
        super.height = this.nss_height = value;
    }

    /**
     * @ignore
     */
    draw(renderer) {
        // the frame to draw
        let frame = this.current;

        // cache the current position and size
        let dx = this.pos.x,
            dy = this.pos.y;

        let w = frame.width,
            h = frame.height;

        // frame offset in the texture/atlas
        let frame_offset = frame.offset;
        let g_offset = this.offset;


        // remove image's TexturePacker/ShoeBox rotation
        if (frame.angle !== 0) {
            renderer.translate(-dx, -dy);
            renderer.rotate(frame.angle);
            dx -= h;
            w = frame.height;
            h = frame.width;
        }

        let sx = g_offset.x + frame_offset.x,
            sy = g_offset.y + frame_offset.y;

        // should this be configurable ?
        let corner_width = this.insetx || w / 4,
            corner_height = this.insety || h / 4;

        // OPTIMIZE ME !

        // DRAW CORNERS

        // Top Left
        renderer.drawImage(
            this.image,
            sx,                          // sx
            sy,                          // sy
            corner_width, corner_height, // sw,sh
            dx, dy,                      // dx,dy
            corner_width, corner_height  // dw,dh
        );

        // Top Right
        renderer.drawImage(
            this.image,
            sx + w - corner_width,          // sx
            sy,                             // sy
            corner_width, corner_height,    // sw,sh
            dx + this.nss_width - corner_width, // dx
            dy,                             // dy
            corner_width, corner_height     // dw,dh
        );
        // Bottom Left
        renderer.drawImage(
            this.image,
            sx,                                 // sx
            sy + h - corner_height,             // sy
            corner_width, corner_height,        // sw,sh
            dx,                                 // dx
            dy + this.nss_height - corner_height,   // dy
            corner_width, corner_height         // dw,dh
        );
        // Bottom Right
        renderer.drawImage(
            this.image,
            sx + w - corner_width,              // sx
            sy + h - corner_height,             // sy
            corner_width, corner_height,        // sw,sh
            dx + this.nss_width - corner_width,     //dx
            dy + this.nss_height - corner_height,   // dy
            corner_width, corner_height         // dw,dh
        );


        // DRAW SIDES and CENTER
        let image_center_width = w - (corner_width << 1);
        let image_center_height = h - (corner_height << 1);

        let target_center_width = this.nss_width - (corner_width << 1);
        let target_center_height = this.nss_height - (corner_height << 1);

        //Top center
        renderer.drawImage(
            this.image,
            sx + corner_width,         // sx
            sy,                        // sy
            image_center_width,        // sw
            corner_height,             // sh
            dx + corner_width,         // dx
            dy,                        // dy
            target_center_width,       // dw
            corner_height              // dh
        );

        //Bottom center
        renderer.drawImage(
            this.image,
            sx + corner_width,                  // sx
            sy + h - corner_height,             // sy
            image_center_width,                 // sw
            corner_height,                      // sh
            dx + corner_width,                  // dx
            dy + this.nss_height - corner_height,   // dx
            target_center_width,                // dw
            corner_height                       // dh
        );

        // Middle Left
        renderer.drawImage(
            this.image,
            sx,                   // sx
            sy + corner_height,   // sy
            corner_width,         // sw
            image_center_height,  // sh
            dx,                   // dx
            dy + corner_height,   // dy
            corner_width,         // dw
            target_center_height  // dh
        );

        // Middle Right
        renderer.drawImage(
            this.image,
            sx + w - corner_width,          // sx
            sy + corner_height,             // sy
            corner_width,                   // sw
            image_center_height,            // sh
            dx + this.nss_width - corner_width, // dx
            dy + corner_height,             // dy
            corner_width,                   // dw
            target_center_height            // dh
        );

        // Middle Center
        renderer.drawImage(
            this.image,
            sx + corner_width,    // sx
            sy + corner_height,   // sy
            image_center_width,   // sw
            image_center_height,  // sh
            dx + corner_width,    // dx
            dy + corner_height,   // dy
            target_center_width,  // dw
            target_center_height  // dh
        );
    }
}
