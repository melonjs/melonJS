import { beforeAll, describe, expect, it } from "vitest";
import { boot, ShaderEffect, video, WebGLRenderer } from "../src/index.js";

/**
 * `ShaderEffect.setTime(seconds)` is a manual convenience for the `uTime`
 * shader-animation convention: it writes the shader's `uTime` uniform when the
 * fragment declares one, and is a no-op otherwise. The engine never calls it —
 * animation is opt-in, driven by the user's own clock (like re-baking a noise).
 */
describe("ShaderEffect.setTime (manual uTime helper)", () => {
	let renderer;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
	});

	it("writes uTime on a shader that declares it, and is chainable", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const fx = new ShaderEffect(
			renderer,
			"uniform float uTime;\nvec4 apply(vec4 color, vec2 uv) { return color * (0.5 + 0.5 * sin(uTime)); }",
		);
		expect(fx._usesTime).toBe(true);

		let written = null;
		const orig = fx._shader.setUniform.bind(fx._shader);
		fx._shader.setUniform = (name, value) => {
			if (name === "uTime") {
				written = value;
			}
			return orig(name, value);
		};

		const ret = fx.setTime(2.5);
		expect(written).toBe(2.5);
		expect(ret).toBe(fx); // chainable
	});

	it("is a no-op for a shader that doesn't declare uTime", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const fx = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		expect(fx._usesTime).toBe(false);

		let touched = false;
		const orig = fx._shader.setUniform.bind(fx._shader);
		fx._shader.setUniform = (name, value) => {
			if (name === "uTime") {
				touched = true;
			}
			return orig(name, value);
		};

		fx.setTime(1.0);
		expect(touched).toBe(false);
	});
});
