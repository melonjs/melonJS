import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	loader,
	ShaderEffect,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * "shader" loader asset type: a GLSL fragment body (the ShaderEffect
 * convention — uniforms + `vec4 apply(vec4 color, vec2 uv)`) preloaded from a
 * `src` URL (or data: URI) or inline via the `data` field, COMPILED AT LOAD
 * TIME into a shared, loader-owned ShaderEffect (`shared = true`), retrieved
 * with `loader.getShader(name)` and freed only by `loader.unload/unloadAll`.
 * `ShaderEffect.clone()` produces a private, caller-owned copy (`shared`
 * reset to false) for per-renderable uniform values.
 */
const FLASH =
	"uniform float uIntensity;\nvec4 apply(vec4 color, vec2 uv) { return mix(color, vec4(1.0), uIntensity); }";

describe("shader asset preloading", () => {
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		isWebGL = video.renderer instanceof WebGLRenderer;
	});

	it("preloads inline GLSL (data field) into a precompiled, shared effect", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		await loader.load({ name: "flash-inline", type: "shader", data: FLASH });

		const fx = loader.getShader("flash-inline");
		expect(fx).toBeInstanceOf(ShaderEffect);
		// loader-owned: renderable cleanup must never auto-destroy it
		expect(fx.shared).toBe(true);
		// compiled at load time — the uniform exists on the linked program
		expect(typeof fx._shader.uniforms.uIntensity).not.toBe("undefined");
		// SHARED semantics: the same instance on every call
		expect(loader.getShader("flash-inline")).toBe(fx);
	});

	it("loads source from a URL (data: URI) too", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		await loader.load({
			name: "flash-url",
			type: "shader",
			src: `data:text/plain,${encodeURIComponent(FLASH)}`,
		});
		const fx = loader.getShader("flash-url");
		expect(fx).toBeInstanceOf(ShaderEffect);
		expect(typeof fx._shader.uniforms.uIntensity).not.toBe("undefined");
		loader.unload({ name: "flash-url", type: "shader" });
	});

	it("a compile error fails the load with the asset name", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		await expect(
			loader.load({ name: "broken", type: "shader", data: "not glsl at all" }),
		).rejects.toThrow(/broken/);
		// the failed asset is not cached
		expect(loader.getShader("broken")).toBe(null);
	});

	it("unload destroys the shared GL program", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		await loader.load({ name: "flash-tmp", type: "shader", data: FLASH });
		const fx = loader.getShader("flash-tmp");
		expect(fx.destroyed).toBe(false);

		expect(loader.unload({ name: "flash-tmp", type: "shader" })).toBe(true);
		expect(fx.destroyed).toBe(true);
		expect(loader.getShader("flash-tmp")).toBe(null);
		// unloading twice reports false
		expect(loader.unload({ name: "flash-tmp", type: "shader" })).toBe(false);
	});

	it("getShader returns null for unknown assets", () => {
		expect(loader.getShader("no-such-shader")).toBe(null);
	});
});

describe("ShaderEffect.clone", () => {
	let renderer;
	let isWebGL;
	let gl;

	beforeAll(() => {
		// video already initialized by the previous describe's beforeAll (same
		// page); grab the active renderer
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	it("compiles an independent program and copies uniform values", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const orig = new ShaderEffect(renderer, FLASH);
		orig.setUniform("uIntensity", 0.7);

		const copy = orig.clone();
		expect(copy).toBeInstanceOf(ShaderEffect);
		expect(copy).not.toBe(orig);
		expect(copy._shader).not.toBe(orig._shader);
		expect(copy._shader.program).not.toBe(orig._shader.program);

		// uniform value copied — read back from the clone's own GL program
		const loc = gl.getUniformLocation(copy._shader.program, "uIntensity");
		expect(gl.getUniform(copy._shader.program, loc)).toBeCloseTo(0.7);

		orig.destroy();
		copy.destroy();
	});

	it("always resets `shared` to false — ownership does not carry", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		await loader.load({ name: "flash-clone", type: "shader", data: FLASH });
		const sharedFx = loader.getShader("flash-clone");
		expect(sharedFx.shared).toBe(true);

		const copy = sharedFx.clone();
		expect(copy.shared).toBe(false); // caller-owned
		expect(sharedFx.shared).toBe(true); // original untouched

		copy.destroy();
		loader.unload({ name: "flash-clone", type: "shader" });
	});

	it("copies extra setTexture bindings, each clone owning its own upload", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 8;
		const orig = new ShaderEffect(
			renderer,
			"uniform sampler2D uNoise;\nvec4 apply(vec4 color, vec2 uv) { return texture2D(uNoise, uv); }",
		);
		orig.setTexture("uNoise", canvas, "repeat");

		const copy = orig.clone();
		const entry = copy._extraTextures.get("uNoise");
		expect(entry.image).toBe(canvas); // same source image
		expect(entry.repeat).toBe("repeat");
		expect(entry.tex).toBe(null); // but its OWN GL upload (lazy, on first draw)

		orig.destroy();
		copy.destroy();
	});

	it("destroying the original leaves the clone alive (and vice versa)", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const orig = new ShaderEffect(renderer, FLASH);
		const copy = orig.clone();

		orig.destroy();
		expect(copy.destroyed).toBe(false);
		expect(copy.enabled).toBe(true);
		// the clone's program is still live GL state
		expect(gl.isProgram(copy._shader.program)).toBe(true);

		copy.destroy();
	});

	it("throws when cloning a destroyed effect", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const fx = new ShaderEffect(renderer, FLASH);
		fx.destroy();
		expect(() => {
			fx.clone();
		}).toThrow(/destroyed/);
	});
});
