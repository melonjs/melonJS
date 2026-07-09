import { ETA } from "../../../math/math.ts";
import { Vector2d } from "../../../math/vector2d.ts";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 */
export function parseAseprite(data, textureAtlas) {
	const atlas = {};

	// per-frame durations in frame order, consumed by the frameTags loop
	// below to build per-frame animation delays
	const frameDurations = [];

	const frames = data.frames;
	for (const name in frames) {
		// in aseprite's JSON export (hash and array forms alike), `trimmed`,
		// `spriteSourceSize`, `sourceSize`, `rotated`, `pivot` and `duration`
		// are SIBLINGS of the `frame` rect on each entry — same layout as
		// TexturePacker's (see texturepacker.js)
		const entry = frames[name];
		const frame = entry.frame;
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
			offset: new Vector2d(frame.x, frame.y),
			anchorPoint: hasTextureAnchorPoint
				? new Vector2d(originX / frame.w, originY / frame.h)
				: null,
			trimmed: trimmed,
			trim: trim,
			width: frame.w,
			height: frame.h,
			sourceSize: entry.sourceSize || { w: frame.w, h: frame.h },
			angle: entry.rotated === true ? -ETA : 0,
		};
		frameDurations.push(entry.duration);
		textureAtlas.addUVs(atlas, name, data.meta.size.w, data.meta.size.h);
	}

	const anims = {};
	for (const name in data.meta.frameTags) {
		const anim = data.meta.frameTags[name];
		// aseprite provides a [from..to] frame range plus a per-frame
		// `duration` (ms) on each frame — build frame objects carrying each
		// frame's own delay so the animation plays at its authored timing
		// (100 ms is aseprite's default duration, used as a safety net)
		const indexArray = Array.from(
			{ length: anim.to - anim.from + 1 },
			(_, i) => {
				const idx = anim.from + i;
				return {
					name: idx,
					delay:
						typeof frameDurations[idx] === "number" ? frameDurations[idx] : 100,
				};
			},
		);
		anims[name] = {
			name: anim.name,
			index: indexArray,
			// only "forward" is supported for now
			direction: anim.direction,
		};
	}
	atlas.anims = anims;

	return atlas;
}
