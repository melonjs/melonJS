import { ETA } from "./../../../math/math.ts";
import { Vector2d } from "../../../math/vector2d.ts";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 */
export function parseTexturePacker(data, textureAtlas) {
	const atlas = {};

	data.frames.forEach((frame) => {
		// fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
		if (frame.hasOwnProperty("filename")) {
			// Source coordinates
			const s = frame.frame;
			const trimmed = !!frame.trimmed;

			let trim;

			if (trimmed) {
				trim = {
					x: frame.spriteSourceSize.x,
					y: frame.spriteSourceSize.y,
					w: frame.spriteSourceSize.w,
					h: frame.spriteSourceSize.h,
				};
			}

			let originX;
			let originY;
			// Pixel-based offset origin from the top-left of the source frame
			const hasTextureAnchorPoint = frame.sourceSize && frame.pivot;
			if (hasTextureAnchorPoint) {
				originX = frame.sourceSize.w * frame.pivot.x - (trimmed ? trim.x : 0);
				originY = frame.sourceSize.h * frame.pivot.y - (trimmed ? trim.y : 0);
			}

			atlas[frame.filename] = {
				name: frame.filename, // frame name
				texture: data.meta.image || "default", // the source texture
				offset: new Vector2d(s.x, s.y),
				anchorPoint: hasTextureAnchorPoint
					? new Vector2d(originX / s.w, originY / s.h)
					: null,
				trimmed: trimmed,
				trim: trim,
				width: s.w,
				height: s.h,
				angle: frame.rotated === true ? -ETA : 0,
			};
			textureAtlas.addUVs(
				atlas,
				frame.filename,
				data.meta.size.w,
				data.meta.size.h,
			);
		}
	});
	return atlas;
}
