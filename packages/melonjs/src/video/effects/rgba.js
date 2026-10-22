/**
 * An effect color as the four floats its shader reads.
 *
 * Effects take their colors as `[r, g, b]` or `[r, g, b, a]`, each 0.0–1.0.
 * The alpha is the color's own opacity, and defaults to 1 so an `[r, g, b]`
 * color draws as it always has. Any other length throws: written into a
 * uniform as it came, a fourth value would spill into whichever uniform
 * follows the color in the effect's block.
 * @param {number[]|Float32Array} color - `[r, g, b]` or `[r, g, b, a]`
 * @returns {Float32Array} `[r, g, b, a]`
 * @ignore
 * @internal
 */
export function rgba(color) {
	if (color.length !== 3 && color.length !== 4) {
		throw new TypeError(
			`an effect color is [r, g, b] or [r, g, b, a], not ${color.length} values`,
		);
	}
	return new Float32Array([
		color[0],
		color[1],
		color[2],
		color.length === 4 ? color[3] : 1,
	]);
}
