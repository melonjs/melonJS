import { addFrame } from "./frame.js";

/**
 * parse the given data and return a corresponding atlas
 * @param {Object} data - atlas data information. See {@link loader.getJSON}
 * @param {TextureAtlas} textureAtlas - the texture atlas class calling the parser
 * @returns {Object} the corresponding Atlas
 * @ignore
 * @internal
 */
export function parseTexturePacker(data, textureAtlas) {
	const atlas = {};
	const frames = data.frames;

	if (Array.isArray(frames)) {
		// "JSON (Array)": a list of frames, each with its `filename`
		for (const frame of frames) {
			// fix wrongly formatted JSON (e.g. last dummy object in ShoeBox)
			if (frame.hasOwnProperty("filename")) {
				addFrame(atlas, frame.filename, frame, data, textureAtlas);
			}
		}
	} else {
		// "JSON (Hash)": the frames keyed by that name
		for (const name of Object.keys(frames)) {
			addFrame(atlas, name, frames[name], data, textureAtlas);
		}
	}
	return atlas;
}
