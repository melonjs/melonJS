import { isTopology } from "../../gpu/topology.ts";

/**
 * Translate between the backend-neutral topology vocabulary and WebGL's
 * primitive-mode enums.
 * @ignore
 * @internal
 */

/**
 * GL enum name for each topology. Indirection through the name keeps this
 * table context-free; the value is read off `gl` at call time.
 * @ignore
 * @internal
 */
const TOPOLOGY_TO_GL_NAME = {
	"point-list": "POINTS",
	"line-list": "LINES",
	"line-strip": "LINE_STRIP",
	"line-loop": "LINE_LOOP",
	"triangle-list": "TRIANGLES",
	"triangle-strip": "TRIANGLE_STRIP",
	"triangle-fan": "TRIANGLE_FAN",
};

/**
 * Reverse lookup, built once per context.
 * @type {WeakMap<WebGL2RenderingContext, Map<GLenum, string>>}
 * @ignore
 * @internal
 */
const reverseCache = new WeakMap();

/**
 * Normalize a draw mode to its GL enum.
 *
 * Accepts either vocabulary and always returns a number, so callers can keep
 * comparing modes numerically. This matters more than it looks: a topology
 * string that reaches a GL draw call is coerced to `NaN` and then to `0`,
 * which *is* `POINTS` — so a missed translation does not throw, it silently
 * renders the batch as points.
 * @param {WebGL2RenderingContext} gl - the rendering context
 * @param {string|GLenum} value - a topology name or a GL primitive enum
 * @returns {GLenum} the GL primitive mode
 * @throws {Error} when `value` is neither a known topology nor a number
 * @ignore
 * @internal
 */
export function resolveTopology(gl, value) {
	if (typeof value === "number") {
		// Reject a number we cannot name. Passing anything through would let
		// NaN or a bogus enum reach the draw call, where it coerces to 0 —
		// POINTS — which is exactly the silent failure this module exists to
		// prevent. The seven topologies cover every GL primitive mode, so a
		// number with no name is not a valid draw mode.
		if (topologyFromGL(gl, value) === undefined) {
			throw new Error(
				`Unknown draw mode ${String(value)}. Expected a GL primitive mode ` +
					`or one of: ${Object.keys(TOPOLOGY_TO_GL_NAME).join(", ")}`,
			);
		}
		return value;
	}
	if (isTopology(value)) {
		return gl[TOPOLOGY_TO_GL_NAME[value]];
	}
	throw new Error(
		`Unknown draw topology "${String(value)}". Expected a GL primitive mode ` +
			`or one of: ${Object.keys(TOPOLOGY_TO_GL_NAME).join(", ")}`,
	);
}

/**
 * Name a GL primitive mode in the neutral vocabulary.
 * @param {WebGL2RenderingContext} gl - the rendering context
 * @param {GLenum} mode - a GL primitive mode
 * @returns {string|undefined} the topology name, or `undefined` for an unknown mode
 * @ignore
 * @internal
 */
export function topologyFromGL(gl, mode) {
	let reverse = reverseCache.get(gl);
	if (reverse === undefined) {
		reverse = new Map();
		for (const [topology, name] of Object.entries(TOPOLOGY_TO_GL_NAME)) {
			reverse.set(gl[name], topology);
		}
		reverseCache.set(gl, reverse);
	}
	return reverse.get(mode);
}
