import { beforeAll, describe, expect, it } from "vitest";
import { boot, loader, ShaderEffect, Texture2d, video } from "../src/index.js";

/**
 * Shader assets under a CANVAS renderer (e.g. a video.AUTO fallback):
 * preloading succeeds (with a console warning per shader), getShader returns
 * an inert ShaderEffect stub — born with `enabled === false` (a class field),
 * so every post-effect pass filters it out — all of its methods no-op safely,
 * and unload stays safe. The game keeps running, just unshaded.
 */
describe("shader assets under the Canvas renderer", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, { parent: "screen", renderer: video.CANVAS });
	});

	it("preloads into an inert, disabled stub and stays safe end-to-end", async () => {
		await loader.load({
			name: "flash-canvas",
			type: "shader",
			data: "uniform float uIntensity;\nvec4 apply(vec4 color, vec2 uv) { return color; }",
		});

		const fx = loader.getShader("flash-canvas");
		expect(fx).toBeInstanceOf(ShaderEffect);
		expect(fx.enabled).toBe(false); // born disabled → filtered from post-effect passes
		expect(fx.shared).toBe(true); // still loader-owned

		// every method no-ops without throwing — including a Texture2d asset
		// passed directly: the Canvas stub has no `_shader`, so setTexture
		// returns early before any unwrap (getTexture() is never called)
		class CanvasTexture extends Texture2d {
			getTexture() {
				return document.createElement("canvas");
			}
		}
		expect(() => {
			fx.setUniform("uIntensity", 1.0);
			fx.setTime(1.0);
			fx.setTexture("uNoise", document.createElement("canvas"));
			fx.setTexture("uNoise2", new CanvasTexture());
		}).not.toThrow();

		// clone still works (the recipe is stored before the Canvas-mode
		// early return), producing another inert, caller-owned stub
		const copy = fx.clone();
		expect(copy).toBeInstanceOf(ShaderEffect);
		expect(copy.enabled).toBe(false);
		expect(copy.shared).toBe(false);

		// unload destroys safely
		expect(loader.unload({ name: "flash-canvas", type: "shader" })).toBe(true);
		expect(fx.destroyed).toBe(true);
		expect(loader.getShader("flash-canvas")).toBe(null);
	});
});
