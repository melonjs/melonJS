import { addFrame } from "./frame.js";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 * @internal
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
		// TexturePacker's (see frame.js)
		const entry = frames[name];
		addFrame(atlas, name, entry, data, textureAtlas);
		frameDurations.push(entry.duration);
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
