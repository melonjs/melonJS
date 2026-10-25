/**
 * The frame a sprite quad draws, as the GPU backends carry it.
 *
 * A sprite cut from an atlas or a tileset draws one frame of a bigger
 * texture. Every sprite vertex carries the UV of its quad's opposite corner,
 * so with its own UV the shaders know that frame and can keep their samples
 * inside it (see `webgl/shaders/frameclamp.js` and `quad.wgsl`).
 * @ignore
 */

/**
 * The opposite-corner UV a sprite vertex carries when its quad has no frame
 * to keep its samples inside: far below any UV a frame could have, so the
 * sprite shaders read it as "unbounded".
 * @ignore
 * @internal
 */
export const FRAME_UNBOUNDED = -1e6;

/**
 * Whether a quad drawn from this texture has a frame to keep its samples
 * inside: every texture but a repeating one (a pattern), which samples past
 * its UVs on purpose so that the texture wraps.
 * @param {{repeat?: string}} texture - the texture atlas drawn
 * @returns {boolean} false for a repeating texture
 * @ignore
 * @internal
 */
export function isFramed(texture) {
	const repeat = texture.repeat;
	return repeat === undefined || repeat === "no-repeat";
}

/**
 * The sprite shaders' frame clamp modes: off (every sprite samples as it
 * always did), half a texel of the full-size art inside the frame (a tile
 * layer drawn tile by tile, which must not blend with the next tile of its
 * tileset at its edge), or half a texel of the mipmap level read (under
 * `"linear-mipmap"`, where a small level's texels reach far past the frame).
 * @ignore
 * @internal
 */
export const FRAME_CLAMP = Object.freeze({ OFF: 0, TEXEL: 1, LEVELS: 2 });

/**
 * How the sprite shaders keep their samples inside a quad's frame, for a
 * renderer's current state: `FRAME_CLAMP.LEVELS` under `"linear-mipmap"`;
 * at least `FRAME_CLAMP.TEXEL` while a tile layer draws its tiles one by
 * one (`drawingTiles`), unless textures are sampled nearest, which never
 * blends two texels; `FRAME_CLAMP.OFF` otherwise.
 * @param {{settings: {textureFilter?: string}, drawingTiles?: boolean, getDefaultTextureFilter?: () => string}} renderer - the renderer
 * @returns {number} the mode, as the shaders' `uFrameClamp` / `frameClamp`
 * @ignore
 * @internal
 */
export function frameClampMode(renderer) {
	if (renderer.settings.textureFilter === "linear-mipmap") {
		return FRAME_CLAMP.LEVELS;
	}
	if (
		renderer.drawingTiles === true &&
		renderer.getDefaultTextureFilter?.() !== "nearest"
	) {
		return FRAME_CLAMP.TEXEL;
	}
	return FRAME_CLAMP.OFF;
}
