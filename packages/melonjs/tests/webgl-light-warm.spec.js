/**
 * The WebGL renderer draws a light through effects of its own (see
 * `drawLight`, `drawAmbientLight`), made the first time a frame draws one.
 * Nothing attached them, so the warm-up never saw them, and their programs
 * were linked inside that frame. A light warmed when it enters the world now
 * has them linked then, off the frame.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, Light2d } from "../src/index.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

describe("a light's effects are linked when it is warmed (WebGL)", () => {
	let renderer;

	beforeAll(async () => {
		boot();
		renderer = await getWebGLRenderer(64, 64);
		if (!(renderer instanceof WebGLRenderer)) {
			renderer = undefined;
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("links the glow and the darkness before any frame draws the light", (ctx) => {
		requireWebGL(ctx);
		const light = new Light2d(32, 32, 16, 16, "#ffffff", 1);
		light.softness = 1;
		expect(renderer._lightShader).toBeUndefined();
		expect(renderer._ambientShader).toBeUndefined();
		renderer._warmDraw(light);
		expect(renderer._lightShader).toBeDefined();
		expect(renderer._ambientShader).toBeDefined();

		// the first frame that draws it links nothing
		const link = vi.spyOn(renderer.gl, "linkProgram");
		try {
			renderer.drawLight(light);
			renderer.drawAmbientLight(light.color, [light], 0, 0, 64, 64, 64, 64);
			renderer.flush();
			expect(link).not.toHaveBeenCalled();
		} finally {
			link.mockRestore();
		}
	});

	it("leaves the darkness to the stage for a light with a hard edge", (ctx) => {
		requireWebGL(ctx);
		const ambient = renderer._ambientShader;
		renderer._ambientShader = undefined;
		try {
			renderer._warmDraw(new Light2d(32, 32, 16, 16, "#ffffff", 1));
			expect(renderer._ambientShader).toBeUndefined();
		} finally {
			renderer._ambientShader = ambient;
		}
	});
});
