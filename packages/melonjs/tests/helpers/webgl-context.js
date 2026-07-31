import { boot, event, video } from "../../src/index.js";
import WebGLRenderer from "../../src/video/webgl/webgl_renderer.js";

/**
 * A single WebGL renderer shared by every spec that asks for one.
 *
 * ## Why this exists
 *
 * Vitest browser mode runs every spec file in one page, and `video.init()`
 * builds a fresh canvas and GL context each time it is called. With a spec
 * file per feature that adds up to dozens of live contexts in a single
 * session — and browsers cap how many they will keep, force-losing the oldest
 * once past the limit. Past that point, creating another context stalls.
 *
 * The failure that produces is badly misleading: some *unrelated* spec's
 * `beforeAll` times out, the suite blames whichever file happened to be late
 * in the run, and adding or reordering files moves the casualty around. It
 * looks like flakiness in the victim, but it is a resource limit set by
 * everything before it.
 *
 * So: create one context, keep it for the session, and let specs borrow it.
 *
 * ## Using it
 *
 * ```js
 * let renderer;
 * beforeAll(async () => {
 *   renderer = await getWebGLRenderer(128, 128);
 * });
 * afterAll(() => {
 *   releaseWebGLRenderer();   // hands it back; does NOT destroy the context
 * });
 *
 * it("draws something", (ctx) => {
 *   requireWebGL(ctx, renderer);
 *   // ...
 * });
 * ```
 *
 * `getWebGLRenderer` resolves to `undefined` when WebGL genuinely isn't
 * available, which `requireWebGL` turns into a visible `ctx.skip()` rather
 * than a silent pass.
 * @module tests/helpers/webgl-context
 */

/** the one renderer handed out to every caller, or null before first use */
let shared = null;

/** set once WebGL has been found unavailable, so we stop retrying */
let unavailable = false;

/**
 * Borrow the shared WebGL renderer, creating it on first use.
 *
 * Resizes to the requested dimensions, since specs assume the canvas is the
 * size they asked for. Callers must not hold the returned reference past
 * their own `afterAll`.
 * @param {number} [width] - canvas width the spec expects
 * @param {number} [height] - canvas height the spec expects
 * @returns {Promise<WebGLRenderer|undefined>} the renderer, or `undefined` when WebGL is unavailable
 */
export async function getWebGLRenderer(width = 128, height = 128) {
	if (unavailable === true) {
		return undefined;
	}
	await boot();

	if (shared === null) {
		try {
			video.init(width, height, {
				parent: "screen",
				renderer: video.WEBGL,
				// headless Chromium's software GL trips the "major performance
				// caveat" flag; without opting out the renderer silently falls
				// back to Canvas and every WebGL spec skips
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine absence of WebGL — callers skip
			unavailable = true;
			return undefined;
		}
		if (
			!(video.renderer instanceof WebGLRenderer) ||
			typeof video.renderer.gl === "undefined"
		) {
			unavailable = true;
			return undefined;
		}
		shared = video.renderer;
	} else if (video.renderer !== shared) {
		// A spec that manages its own renderer (a few must — the teardown and
		// required-check specs, for instance) has replaced the global since we
		// last ran. Re-announce ours so engine paths that still read
		// `video.renderer` / `game.renderer` see it. The export is a live
		// binding kept in sync from this event, so it cannot be assigned
		// directly from here.
		event.emit(event.VIDEO_INIT, shared);
	}

	if (shared.width !== width || shared.height !== height) {
		shared.resize(width, height);
	}
	return shared;
}

/**
 * Hand the shared renderer back at the end of a spec file.
 *
 * Deliberately does NOT destroy the GL context — keeping one alive for the
 * whole session is the entire point. It resets renderer state so the next
 * spec starts from a clean slate rather than inheriting a custom shader, a
 * stale batcher or a dirty transform stack.
 */
export function releaseWebGLRenderer() {
	if (shared === null) {
		return;
	}
	try {
		shared.reset();
	} catch {
		// a spec may have lost the context on purpose; the next `get` will
		// find it unusable and skip, which is the honest outcome
	}
}

/**
 * Skip visibly when WebGL isn't available.
 *
 * Uses `ctx.skip()` rather than an early `return` so the skip shows up in the
 * reporter — a silent return reports as a pass, which is how a batch of
 * assertions once sat broken for months without anyone noticing.
 * @param {object} ctx - the vitest test context
 * @param {WebGLRenderer|undefined} renderer - what `getWebGLRenderer` resolved to
 */
export function requireWebGL(ctx, renderer) {
	if (renderer === undefined || renderer === null) {
		ctx.skip("WebGL2 renderer not available in this environment");
	}
}
