import type { TextureAtlas } from "melonjs"; // Replace 'path/to/TextureAtlas' with the actual path to the TextureAtlas class.

export const gameState = {
	/**
	 * object where to store game global scole
	 */
	data: {
		// score
		score: 0,
	},

	// a reference to the texture atlas
	texture: undefined as TextureAtlas | undefined,
};
