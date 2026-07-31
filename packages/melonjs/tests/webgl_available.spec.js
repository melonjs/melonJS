import { describe, expect, it } from "vitest";
import { getWebGLRenderer } from "./helpers/webgl-context.js";

/**
 * A tripwire: fail the run if the environment cannot give us WebGL 2.
 *
 * Most of the WebGL suite guards itself with `ctx.skip()` when no renderer is
 * available, which is right for an individual test — but it means a machine
 * or container that silently loses WebGL turns hundreds of tests into skips
 * and still reports a green build. The engine's primary backend would be
 * entirely unexercised and nothing would say so.
 *
 * `texture-resource.spec.js` is the precedent: it omitted
 * `failIfMajorPerformanceCaveat: false`, so on a software-GL runner its whole
 * WebGL block skipped, and that went unnoticed. This spec makes that class of
 * misconfiguration a red build instead of a quiet one.
 *
 * Scoped to CI, where the container image is pinned and WebGL must be present.
 * Outside CI a missing context is a visible skip instead, so a contributor on
 * hardware without GL is not blocked. `VITE_ALLOW_NO_WEBGL=1` forces the skip
 * behaviour in CI too, should a runner ever genuinely lose its GL stack.
 */
describe("WebGL availability (suite tripwire)", () => {
	it("the runner provides a WebGL 2 context", async (ctx) => {
		const renderer = await getWebGLRenderer(32, 32);

		if (renderer === undefined) {
			const inCI = import.meta.env.VITE_CI !== "";
			const opted = import.meta.env.VITE_ALLOW_NO_WEBGL === "1";
			if (!inCI || opted) {
				// A contributor's machine may genuinely have no usable GL. Skip
				// visibly rather than blocking them — the whole WebGL suite will
				// skip too, and the reporter will show it.
				ctx.skip(
					"No WebGL 2 context; the WebGL suite will not run in this environment",
				);
				return;
			}
			// In CI the image is pinned and WebGL must be there. Silence here
			// means every WebGL spec skipped and the run still went green, with
			// the engine's primary backend untested.
			throw new Error(
				"No WebGL 2 renderer in CI. Every WebGL spec will skip and the run " +
					"will still pass, leaving the engine's primary backend untested. " +
					"Check that the container still ships a GL stack (Chromium falls " +
					"back to SwiftShader when there is no GPU) and that the renderer " +
					"opts out of failIfMajorPerformanceCaveat — a software rasterizer " +
					"trips it. Set VITE_ALLOW_NO_WEBGL=1 to accept a GL-less run.",
			);
		}

		const gl = renderer.gl;
		expect(gl).toBeDefined();
		expect(gl.getParameter(gl.VERSION)).toMatch(/WebGL 2/);
		// a lost or never-initialised context reports 0 here, which is a subtler
		// way for the suite to be running against nothing usable
		expect(gl.getParameter(gl.MAX_TEXTURE_SIZE)).toBeGreaterThan(0);
		expect(gl.isContextLost()).toBe(false);
	});
});
