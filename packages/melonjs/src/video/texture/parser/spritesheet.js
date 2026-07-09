import { Vector2d, vector2dPool } from "../../../math/vector2d.ts";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 */
export function parseSpriteSheet(data, textureAtlas) {
	const atlas = {};
	const image = data.image;
	const spacing = data.spacing || 0;
	const margin = data.margin || 0;

	const width = image.width;
	const height = image.height;

	// calculate the sprite count (line, col)
	const spritecount = vector2dPool.get(
		~~((width - margin + spacing) / (data.framewidth + spacing)),
		~~((height - margin + spacing) / (data.frameheight + spacing)),
	);

	// verifying the texture size. The frame GRID is implicitly truncated by
	// the floored spritecount above; the UV divisor below must stay the
	// PHYSICAL image size — the GPU texture is uploaded at full size, so
	// dividing by a truncated size would scale/shift every frame's UVs.
	if (
		width % (data.framewidth + spacing) !== 0 ||
		height % (data.frameheight + spacing) !== 0
	) {
		const computed_width = spritecount.x * (data.framewidth + spacing);
		const computed_height = spritecount.y * (data.frameheight + spacing);
		if (
			computed_width - width !== spacing &&
			computed_height - height !== spacing
		) {
			// warning message
			console.warn(
				"Spritesheet Texture for image: " +
					image.src +
					" is not divisible by " +
					(data.framewidth + spacing) +
					"x" +
					(data.frameheight + spacing) +
					", truncating the frame grid to " +
					computed_width +
					"x" +
					computed_height,
			);
		}
	}

	// build the local atlas
	for (
		let frame = 0, count = spritecount.x * spritecount.y;
		frame < count;
		frame++
	) {
		const name = "" + frame;
		atlas[name] = {
			name: name,
			texture: "default", // the source texture
			offset: new Vector2d(
				margin + (spacing + data.framewidth) * (frame % spritecount.x),
				margin + (spacing + data.frameheight) * ~~(frame / spritecount.x),
			),
			anchorPoint: data.anchorPoint || null,
			trimmed: false,
			trim: undefined,
			width: data.framewidth,
			height: data.frameheight,
			angle: 0,
		};
		textureAtlas.addUVs(atlas, name, width, height);
	}

	vector2dPool.release(spritecount);

	return atlas;
}
