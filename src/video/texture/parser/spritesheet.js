import pool from "./../../../system/pooling.js";
import Vector2d from "./../../../math/vector2.js";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 */
export function parseSpriteSheet(data, textureAtlas) {
    let atlas = {};
    let image = data.image;
    let spacing = data.spacing || 0;
    let margin = data.margin || 0;

    let width = image.width;
    let height = image.height;

    // calculate the sprite count (line, col)
    let spritecount = pool.pull("Vector2d",
        ~~((width - margin + spacing) / (data.framewidth + spacing)),
        ~~((height - margin + spacing) / (data.frameheight + spacing))
    );

    // verifying the texture size
    if ((width % (data.framewidth + spacing)) !== 0 ||
        (height % (data.frameheight + spacing)) !== 0) {
        let computed_width = spritecount.x * (data.framewidth + spacing);
        let computed_height = spritecount.y * (data.frameheight + spacing);
        if (computed_width - width !== spacing && computed_height - height !== spacing) {
            // "truncate size" if delta is different from the spacing size
            width = computed_width;
            height = computed_height;
            // warning message
            console.warn(
                "Spritesheet Texture for image: " + image.src +
                " is not divisible by " + (data.framewidth + spacing) +
                "x" + (data.frameheight + spacing) +
                ", truncating effective size to " + width + "x" + height
            );
        }
    }

    // build the local atlas
    for (let frame = 0, count = spritecount.x * spritecount.y; frame < count; frame++) {
        let name = "" + frame;
        atlas[name] = {
            name            : name,
            texture         : "default", // the source texture
            offset          : new Vector2d(
                margin + (spacing + data.framewidth) * (frame % spritecount.x),
                margin + (spacing + data.frameheight) * ~~(frame / spritecount.x)
            ),
            anchorPoint     : (data.anchorPoint || null),
            trimmed         : false,
            trim            : undefined,
            width           : data.framewidth,
            height          : data.frameheight,
            angle           : 0
        };
        textureAtlas.addUVs(atlas, name, width, height);
    }

    pool.push(spritecount);

    return atlas;
}
