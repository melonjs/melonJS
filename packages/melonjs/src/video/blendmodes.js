/**
 * The engine's blend-mode registry — one definition of every mode, shared by
 * all three renderers.
 *
 * Blending is described here in **backend-neutral** terms and translated by
 * each backend: WebGPU consumes these tokens directly (they are its own
 * vocabulary), WebGL maps them onto `gl.*` enums, and Canvas ignores them
 * entirely in favour of `globalCompositeOperation`.
 *
 * Keeping the table in one place is not tidiness. The two GPU backends
 * previously each carried their own copy — a `switch` of `blendEquation` /
 * `blendFunc` calls on one side and a `GPUBlendState` table on the other —
 * which meant a mode added, removed or corrected on one backend could
 * silently disagree with the other, and `video.AUTO` would then render the
 * same scene differently depending on which backend it happened to pick.
 */

/**
 * The CSS blend modes that cannot be expressed as `src * sfactor + dst * dfactor`.
 *
 * Fixed-function blending computes one multiply-add per channel, which covers
 * `multiply`, `screen`, `additive` and `exclusion` — exactly, translucent
 * sources included. The modes below cannot be reached that way: most need a
 * per-pixel branch, a division or a `sqrt` on the DESTINATION, and `darken` /
 * `lighten` need a term the `min` / `max` operations leave no room for.
 * Neither GPU backend can read the destination in a fragment shader, so all of
 * them are implemented by capturing the destination to a texture and
 * compositing in `BlendEffect`.
 *
 * The array ORDER is the wire format: the index is the `uBlendMode` uniform
 * value the shader branches on, so reordering it silently remaps every mode.
 * @ignore
 */
export const ADVANCED_BLEND_MODES = [
	"difference",
	"overlay",
	"hard-light",
	"color-dodge",
	"color-burn",
	"soft-light",
	// `darken` and `lighten` joined the shader path in 20.2: fixed-function
	// MIN/MAX compute `min(src, dst)` and nothing else, so there is nowhere to
	// put the `(1 - srcAlpha) * dst` term source-over contributes after the
	// blend. A translucent source lost the backdrop's share entirely — a white
	// `lighten` glow over a light backdrop rendered invisible. APPENDED, never
	// inserted: the index is the shader's branch value.
	"darken",
	"lighten",
];

/**
 * Whether a blend mode needs the shader path rather than fixed-function state.
 * @param {string} mode - the blend mode to test
 * @returns {boolean} true when the mode needs the shader path
 * @ignore
 */
export function isAdvancedBlendMode(mode) {
	return ADVANCED_BLEND_MODES.indexOf(mode) !== -1;
}

/**
 * The `uBlendMode` uniform value for an advanced blend mode.
 * @param {string} mode - the blend mode
 * @returns {number} the shader's mode index, or -1 when not an advanced mode
 * @ignore
 */
export function advancedBlendModeIndex(mode) {
	return ADVANCED_BLEND_MODES.indexOf(mode);
}

/**
 * Normalize a user-facing blend-mode string to its canonical token: `add` and
 * `lighter` are spellings of `additive`, and anything unrecognized collapses
 * to `normal`.
 *
 * The six advanced modes normalize to `"normal"` on purpose — that is their
 * PIPELINE state, since the geometry really does rasterize under ordinary
 * source-over before the shader composites it. Use {@link isAdvancedBlendMode}
 * to ask the other question, and {@link reportedBlendMode} for what
 * `setBlendMode` should tell the caller.
 * @param {string} mode - blend mode as set through `setBlendMode`
 * @returns {string} the canonical token
 * @ignore
 */
export function normalizeBlendMode(mode) {
	switch (mode) {
		case "none":
		case "multiply":
		case "screen":
		case "exclusion":
		case "normal":
			return mode;
		case "additive":
		case "add":
		case "lighter":
			return "additive";
		default:
			return "normal";
	}
}

/**
 * Whether the engine can honour this blend mode at all, by either route.
 * @param {string} mode - the blend mode to test
 * @returns {boolean} false only for a mode no backend implements
 * @ignore
 */
export function isSupportedBlendMode(mode) {
	return (
		isAdvancedBlendMode(mode) ||
		mode === "normal" ||
		normalizeBlendMode(mode) !== "normal"
	);
}

/**
 * What `setBlendMode` reports back as applied.
 *
 * The return value is a capability probe: callers compare it against their
 * request, and a mismatch means the renderer could not honour the mode. So a
 * mode that WAS honoured must report itself verbatim — including an alias
 * like `add`, which shares a pipeline with `additive` but must not come back
 * under that name — while anything unimplemented reports `"normal"`.
 * @param {string} mode - the requested blend mode
 * @returns {string} the mode actually applied
 * @ignore
 */
export function reportedBlendMode(mode) {
	return isSupportedBlendMode(mode) ? mode : "normal";
}

/**
 * The blend state for a mode, in WebGPU's vocabulary — the neutral form each
 * backend translates from.
 *
 * `srcFactor` depends on whether sources carry premultiplied alpha: a
 * premultiplied source has already been scaled, so it takes `one` where a
 * straight one takes `src-alpha`.
 *
 * Every mode here is EXACT for a translucent source as well as an opaque one
 * — `multiply`, `screen` and `exclusion` were long commented as
 * "approximate", but the algebra works out and measurement agrees. The two
 * that genuinely could not be expressed this way, `darken` and `lighten`,
 * moved to the shader path instead of staying approximate.
 * @param {string} mode - a canonical mode from {@link normalizeBlendMode}
 * @param {boolean} premultipliedAlpha - whether sources are premultiplied
 * @returns {{operation: string, srcFactor: string, dstFactor: string}|undefined} the
 * blend state, or `undefined` for `"none"`, which means replace (no blending)
 * @ignore
 */
export function blendStateFor(mode, premultipliedAlpha) {
	const src = premultipliedAlpha ? "one" : "src-alpha";
	switch (mode) {
		case "none":
			// replace: the source overwrites the destination, alpha included
			return undefined;
		case "additive":
			return { operation: "add", srcFactor: src, dstFactor: "one" };
		case "multiply":
			return {
				operation: "add",
				srcFactor: "dst",
				dstFactor: "one-minus-src-alpha",
			};
		case "exclusion":
			// exclusion(a, b) = a + b - 2ab, expressed as s*(1-d) + d*(1-s)
			return {
				operation: "add",
				srcFactor: "one-minus-dst",
				dstFactor: "one-minus-src",
			};
		case "screen":
			return {
				operation: "add",
				srcFactor: "one",
				dstFactor: "one-minus-src",
			};
		default:
			// "normal", and the six advanced modes, whose GEOMETRY rasterizes
			// under ordinary source-over before `BlendEffect` composites it
			return {
				operation: "add",
				srcFactor: src,
				dstFactor: "one-minus-src-alpha",
			};
	}
}
