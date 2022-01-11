import Sprite from "./sprite.js";

/**
 * @classdesc
 * A NineSliceSprite is similar to a Sprite, but it uses 9-slice scaling to strech its inner area to fit the size of the Renderable,
 * by proportionally scaling a sprite by splitting it in a grid of nine parts (with only parts 1, 3, 7, 9 not being scaled). <br>
 * <img src="images/9-slice-scaling.png"/><br>
 * @see https://en.wikipedia.org/wiki/9-slice_scaling
 * @class NineSliceSprite
 * @augments me.Sprite
 * @memberof me
 * @param {number} x the x coordinates of the sprite object
 * @param {number} y the y coordinates of the sprite object
 * @param {object} settings Configuration parameters for the Sprite object
 * @param {number} settings.width the width of the Renderable over which the sprite needs to be stretched
 * @param {number} settings.height the height of the Renderable over which the sprite needs to be stretched
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|string} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {string} [settings.name=""] name of this object
 * @param {string} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {string|me.Color} [settings.tint] a tint to be applied to this sprite
 * @param {number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {number} [settings.flipY] flip the sprite on the vertical axis
 * @param {me.Vector2d} [settings.anchorPoint={x:0.5, y:0.5}] Anchor point to draw the frame at (defaults to the center of the frame).
 * @example
 * this.panelSprite = new me.NineSliceSprite(0, 0, {
 *     image : game.texture,
 *     region : "grey_panel",
 *     width : this.width,
 *     height : this.height
 * });
 */

class NineSliceSprite extends Sprite {

    /**
     * @ignore
     */
    constructor(x, y, settings) {
        // call the super constructor
        super(x, y, settings);

        // ensure mandatory properties are defined
        if ((typeof settings.width !== "number") || (typeof settings.height !== "number")) {
            throw new Error("height and width properties are mandatory");
        }

        // override the renderable sprite with the given one
        // resize based on the active frame
        this.width = settings.width;
        this.height = settings.height;
    }

    /**
     * @ignore
     */
    draw(renderer) {
        // the frame to draw
        var frame = this.current;

        // cache the current position and size
        var dx = this.pos.x,
            dy = this.pos.y;

        var w = frame.width,
            h = frame.height;

        // frame offset in the texture/atlas
        var frame_offset = frame.offset;
        var g_offset = this.offset;


        // remove image's TexturePacker/ShoeBox rotation
        if (frame.angle !== 0) {
            renderer.translate(-dx, -dy);
            renderer.rotate(frame.angle);
            dx -= h;
            w = frame.height;
            h = frame.width;
        }

        var sx = g_offset.x + frame_offset.x,
            sy = g_offset.y + frame_offset.y;

        // should this be configurable ?
        var corner_width = frame.width / 4,
            corner_height = frame.height / 4;

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
            dx + this.width - corner_width, // dx
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
            dy + this.height - corner_height,   // dy
            corner_width, corner_height         // dw,dh
        );
        // Bottom Right
        renderer.drawImage(
            this.image,
            sx + w - corner_width,              // sx
            sy + h - corner_height,             // sy
            corner_width, corner_height,        // sw,sh
            dx + this.width - corner_width,     //dx
            dy + this.height - corner_height,   // dy
            corner_width, corner_height         // dw,dh
        );


        // DRAW SIDES and CENTER
        var image_center_width = w - (corner_width << 1);
        var image_center_height = h - (corner_height << 1);

        var target_center_width = this.width - (corner_width << 1);
        var target_center_height = this.height - (corner_height << 1);

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
            dy + this.height - corner_height,   // dx
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
            dx + this.width - corner_width, // dx
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
};

export default NineSliceSprite;
