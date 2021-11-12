import Sprite from "./sprite.js";

/**
 * @classdesc
 * A NineSliceSprite is similar to a Sprite, but it it can strech its inner area to fit the size of the Renderable
 * @class NineSliceSprite
 * @extends me.Sprite
 * @memberOf me
 * @constructor
 * @param {Number} x the x coordinates of the sprite object
 * @param {Number} y the y coordinates of the sprite object
 * @param {Object} settings Configuration parameters for the Sprite object
 * @param {Number} settings.width the width of the Renderable over which the sprite needs to be stretched
 * @param {Number} settings.height the height of the Renderable over which the sprite needs to be stretched
 * @param {me.Renderer.Texture|HTMLImageElement|HTMLCanvasElement|String} settings.image reference to a texture, spritesheet image or to a texture atlas
 * @param {String} [settings.name=""] name of this object
 * @param {String} [settings.region] region name of a specific region to use when using a texture atlas, see {@link me.Renderer.Texture}
 * @param {Number} [settings.framewidth] Width of a single frame within the spritesheet
 * @param {Number} [settings.frameheight] Height of a single frame within the spritesheet
 * @param {String|Color} [settings.tint] a tint to be applied to this sprite
 * @param {Number} [settings.flipX] flip the sprite on the horizontal axis
 * @param {Number} [settings.flipY] flip the sprite on the vertical axis
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

        //Top center
        renderer.drawImage(
            this.image,
            sx + corner_width,                              // sx
            sy,                                             // sy
            w - corner_width * 2, corner_height,            // sw,sh
            dx + corner_width, dy,                          // dx,dy
            this.width - corner_width * 2, corner_height    // dw,dh
        );

        //Bottom center
        renderer.drawImage(
            this.image,
            sx + corner_width,                  // sx
            sy + h - corner_height,             // sy
            w - corner_width * 2,               // sw
            corner_height,                      // sw
            dx + corner_width,                  // dx
            dy + this.height - corner_height,   // dx
            this.width - corner_width * 2,      // dw
            corner_height                       // dh
        );

        // Middle Left
        renderer.drawImage(
            this.image,
            sx,                             // sx
            sy + corner_height,             // sy
            corner_width,                   // sw
            w - corner_width * 2,           // sh
            dx,                             // dx
            dy + corner_height,             // dy
            corner_width,                   // dw
            this.height - corner_width * 2  // dh
        );

        // Middle Right
        renderer.drawImage(
            this.image,
            sx + w - corner_width,          // sx
            sy + corner_height,             // sy
            corner_width,                   // sw
            w - corner_width * 2,           // sh
            dx + this.width - corner_width, // dx
            dy + corner_height,             // dy
            corner_width,                   // dw
            this.height - corner_width * 2  // dh
        );

        // Middle Center
        renderer.drawImage(
            this.image,
            sx + corner_width,              // sx
            sy + corner_height,             // sy
            w - corner_width * 2,           // sw
            w - corner_width * 2,           // sh
            dx + corner_width,              // dx
            dy + corner_height,             // dy
            this.width - corner_width * 2,  // dw
            this.height - corner_width * 2  // dh
        );
    }
};

export default NineSliceSprite;
