/**
 * Color-space bridge for glTF material factors.
 *
 * glTF 2.0 defines `pbrMetallicRoughness.baseColorFactor` in **linear** space
 * (spec §3.9.2), while a melonJS `tint` is an 8-bit **sRGB** value — the same
 * space as a CSS color or a texel out of a PNG. Handing the linear number
 * straight to `tint.setColor(f * 255)` therefore displays every untextured
 * glTF material far too light and desaturated: a linear `0.29` shows up as
 * sRGB `0.58`, so an authored mid-green renders as pale mint.
 *
 * The encode below is the standard sRGB transfer function.
 * @module level/gltf/srgb
 */

/**
 * Encode one linear channel (0..1) to an 8-bit sRGB value (0..255).
 * @param {number} c - linear channel value
 * @returns {number} the sRGB-encoded channel, rounded to 0..255
 */
export function linearToSrgb8(c) {
	// guard the domain: exporters can emit slightly out-of-range factors, and
	// `Math.pow` on a negative base returns NaN, which would poison the tint
	const v = c <= 0 ? 0 : c >= 1 ? 1 : c;
	const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
	return Math.round(s * 255);
}
