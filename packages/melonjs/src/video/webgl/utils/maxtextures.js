/**
 * Default ceiling applied when `maxTextures` is `"auto"`.
 *
 * There is no spec maximum to defer to — WebGL 2 / GLES 3.0 only set a
 * *minimum* of 16 for `MAX_TEXTURE_IMAGE_UNITS`, and an implementation may
 * report any value at or above it. What actually limits us is that the
 * multi-texture fragment shader unrolls one sampler and one branch per unit
 * (see `buildMultiTextureFragment`), so a very wide pool costs compile time
 * and register pressure, and historically some drivers mis-compile the widest
 * ladders. 32 covers current desktop and mobile hardware while staying a
 * conservative default; raise or lower it with the `maxTextures` setting.
 * @ignore
 */
export const AUTO_MAX_TEXTURES = 32;

/**
 * Smallest pool the engine will resolve to. A lit quad occupies a colour slot
 * and a normal-map slot simultaneously, so anything narrower makes the two ids
 * collide and the sprite samples its own albedo as a normal map.
 * @ignore
 */
export const MIN_MAX_TEXTURES = 2;

/**
 * Resolve the texture-unit pool this renderer will use.
 *
 * Clamping happens ONCE, at renderer construction, before the batchers and the
 * `TextureCache` are built — every consumer derives from the result, so the
 * batchers' sampler counts and the cache's capacity cannot disagree. A setting
 * above what the device reports is clamped down rather than honoured: declaring
 * more `sampler2D` uniforms than the device has units fails to link, and a link
 * failure at startup is not a useful way to learn about a typo.
 * @param {number} deviceMax - the device's `MAX_TEXTURE_IMAGE_UNITS`
 * @param {"auto"|number} [setting="auto"] - the `maxTextures` application setting
 * @returns {number} the pool size, at least 1 and never above `deviceMax`
 * @ignore
 */
export function resolveMaxTextures(deviceMax, setting = "auto") {
	// a device that reports nothing usable still has to render something
	const device = Number.isFinite(deviceMax) && deviceMax > 0 ? deviceMax : 1;
	// MIN_POOL, not 1: a lit quad needs a colour slot and a normal slot at the
	// same time, and a one-slot pool makes the two collide — the sprite would
	// sample its own albedo as its normal map. Never above what the device has.
	const floor = Math.min(MIN_MAX_TEXTURES, device);
	if (typeof setting === "number" && Number.isFinite(setting)) {
		return Math.max(floor, Math.min(Math.floor(setting), device));
	}
	// "auto" (or anything unrecognized — an unset/typo'd value must not brick
	// the renderer, matching how `textureFilter` tolerates an unknown mode)
	return Math.max(floor, Math.min(device, AUTO_MAX_TEXTURES));
}
