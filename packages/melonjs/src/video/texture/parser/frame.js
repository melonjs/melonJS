import { ETA } from "../../../math/math.ts";
import { Vector2d } from "../../../math/vector2d.ts";

/**
 * Add one frame of a TexturePacker or Aseprite JSON file to an atlas page.
 * Both tools describe a frame the same way: a `frame` rectangle, with
 * `trimmed`, `spriteSourceSize`, `sourceSize`, `rotated` and `pivot` beside it.
 * @param {Object} atlas - the atlas page being built
 * @param {string} name - the name the frame is stored under
 * @param {Object} entry - the frame, as the file describes it
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @ignore
 * @internal
 */
export function addFrame(atlas, name, entry, data, textureAtlas) {
	// Source coordinates
	const s = entry.frame;
	const trimmed = !!entry.trimmed;

	let trim;

	if (trimmed) {
		trim = {
			x: entry.spriteSourceSize.x,
			y: entry.spriteSourceSize.y,
			w: entry.spriteSourceSize.w,
			h: entry.spriteSourceSize.h,
		};
	}

	let originX;
	let originY;
	// Pixel-based offset origin from the top-left of the source frame
	const hasTextureAnchorPoint = entry.sourceSize && entry.pivot;
	if (hasTextureAnchorPoint) {
		originX = entry.sourceSize.w * entry.pivot.x - (trimmed ? trim.x : 0);
		originY = entry.sourceSize.h * entry.pivot.y - (trimmed ? trim.y : 0);
	}

	atlas[name] = {
		name: name, // frame name
		texture: data.meta.image || "default", // the source texture
		offset: new Vector2d(s.x, s.y),
		anchorPoint: hasTextureAnchorPoint
			? new Vector2d(originX / s.w, originY / s.h)
			: null,
		trimmed: trimmed,
		trim: trim,
		width: s.w,
		height: s.h,
		sourceSize: entry.sourceSize || { w: s.w, h: s.h },
		angle: entry.rotated === true ? -ETA : 0,
	};
	textureAtlas.addUVs(atlas, name, data.meta.size.w, data.meta.size.h);
}
