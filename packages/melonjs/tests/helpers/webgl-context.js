import { Application, boot, event, video } from "../../src/index.js";
import WebGLRenderer from "../../src/video/webgl/webgl_renderer.js";

/**
 * A single WebGL renderer shared by every spec that asks for one.
 *
 * ## Why this exists
 *
 * Constructing an `Application` and awaiting `init()` builds a fresh canvas
 * and GL context each time, and on a CI container with no GPU that runs
 * through a software rasterizer — slow enough that `vitest.config.ts` raises
 * `hookTimeout` to 90s for it. Creating FEWER contexts is therefore worth
 * real time, which is what this helper is for.
 *
 * ## What this is NOT for
 *
 * This used to claim that vitest runs every spec file in one page, so contexts
 * accumulated across files until the browser's cap force-lost the oldest and a
 * later `beforeAll` stalled. That is measurably false: vitest isolates each
 * spec FILE. A probe confirmed it — a global set in one file is `undefined` in
 * the next, and a context opened in one is already lost by the next. Contexts
 * accumulate only WITHIN a file, across its describe blocks.
 *
 * The belief was load-bearing for a while: an intermittent CI failure (an
 * unrelated spec's `beforeAll` timing out in `getWebGLRenderer`) was blamed on
 * cross-file starvation. It is not that. The cause is still unknown, and the
 * `hookTimeout` note above — that acquisition is genuinely slow under load —
 * is the better lead. Do not rebuild the starvation theory from this file.
 *
 * So: create one context per file, keep it for that file, and let its specs
 * borrow it.
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
 *
 * ## Table-driven tests: use `it.for`, not `it.each`
 *
 * `it.each` does **not** pass the test context to its callback, so a
 * `requireWebGL(ctx, …)` guard written inside one receives `undefined` and
 * throws a `TypeError` on a machine with no GL instead of skipping. `it.for`
 * passes the context as its second argument and is otherwise equivalent:
 *
 * ```js
 * it.for([["a", 1], ["b", 2]])("case %s", ([name, n], ctx) => {
 *   requireWebGL(ctx, renderer);   // works
 * });
 * ```
 * @module tests/helpers/webgl-context
 */

/** the one renderer handed out to every caller, or null before first use */
let shared = null;

/** set once WebGL has been found unavailable, so we stop retrying */
let unavailable = false;

/**
 * The renderer most recently announced via VIDEO_INIT — every
 * `Application.init()` emits it. Used to detect that a spec managing its own
 * renderer has taken over since we last handed out `shared`, without
 * reaching for the `game` global.
 */
let lastAnnounced = null;
event.on(event.VIDEO_INIT, (renderer) => {
	lastAnnounced = renderer;
});

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
		let app;
		try {
			app = new Application(width, height, {
				parent: "screen",
				renderer: video.WEBGL,
				// headless Chromium's software GL trips the "major performance
				// caveat" flag; without opting out the renderer silently falls
				// back to Canvas and every WebGL spec skips
				failIfMajorPerformanceCaveat: false,
				// Ground shadows (#1515) ship ON, which means a second draw for
				// every 3D mesh. The suites that are not testing them should not
				// pay for them: on CI's software renderer that extra GPU work is
				// enough to push unrelated suites past their timeout. The shadow
				// spec opts itself in per test, and asserts the shipped default
				// separately against `defaultApplicationSettings`.
				castGroundShadow: false,
			});
			await app.init();
		} catch {
			// genuine absence of WebGL — callers skip
			unavailable = true;
			return undefined;
		}
		if (
			!(app.renderer instanceof WebGLRenderer) ||
			typeof app.renderer.gl === "undefined"
		) {
			unavailable = true;
			return undefined;
		}
		shared = app.renderer;
	} else if (lastAnnounced !== shared) {
		// A spec that manages its own renderer (a few must — the teardown and
		// required-check specs, for instance) has announced its own since we
		// last ran. Re-announce ours so engine paths keyed off VIDEO_INIT
		// (e.g. the shader asset parser's active-renderer tracking) see it.
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
