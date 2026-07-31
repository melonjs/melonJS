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
 * Set `VITE_ALLOW_NO_WEBGL=1` to downgrade it to a skip, for the genuine case
 * of running on hardware with no GL at all.
 */
describe("WebGL availability (suite tripwire)", () => {
	it("the runner provides a WebGL 2 context", async (ctx) => {
		const renderer = await getWebGLRenderer(32, 32);

		if (import.meta.env.VITE_ALLOW_NO_WEBGL === "1") {
			if (renderer === undefined) {
				ctx.skip("WebGL unavailable, allowed via VITE_ALLOW_NO_WEBGL");
			}
			return;
		}

		expect(
			renderer,
			"No WebGL 2 renderer. Every WebGL spec will skip and the run will " +
				"still pass, leaving the engine's primary backend untested. " +
				"Check that the browser exposes WebGL 2 and that the renderer " +
				"opts out of failIfMajorPerformanceCaveat (a software rasterizer " +
				"trips it). Set VITE_ALLOW_NO_WEBGL=1 to allow a GL-less run.",
		).toBeDefined();

		const gl = renderer.gl;
		expect(gl).toBeDefined();
		expect(gl.getParameter(gl.VERSION)).toMatch(/WebGL 2/);
		// a lost or never-initialised context reports 0 here, which is a subtler
		// way for the suite to be running against nothing usable
		expect(gl.getParameter(gl.MAX_TEXTURE_SIZE)).toBeGreaterThan(0);
		expect(gl.isContextLost()).toBe(false);
	});
});
