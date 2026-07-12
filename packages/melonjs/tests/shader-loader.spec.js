import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	GLShader,
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

		// clean up the global loader cache (and its GL program)
		loader.unload({ name: "flash-inline", type: "shader" });
		expect(fx.destroyed).toBe(true);
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

// GLShader is not ShaderEffect's base class (ShaderEffect wraps one by
// composition) — so it carries its own clone(), with the same semantics,
// for full custom vertex+fragment programs.
describe("GLShader.clone", () => {
	let renderer;
	let isWebGL;
	let gl;

	const VERTEX =
		"attribute vec2 aVertex;\nvoid main(void) { gl_Position = vec4(aVertex, 0.0, 1.0); }";
	const FRAGMENT =
		"uniform float uIntensity;\nvoid main(void) { gl_FragColor = vec4(uIntensity); }";

	beforeAll(() => {
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	it("compiles an independent program and replays uniform values", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const orig = new GLShader(gl, VERTEX, FRAGMENT);
		orig.setUniform("uIntensity", 0.4);

		const copy = orig.clone();
		expect(copy).toBeInstanceOf(GLShader);
		expect(copy).not.toBe(orig);
		expect(copy.program).not.toBe(orig.program);

		const loc = gl.getUniformLocation(copy.program, "uIntensity");
		expect(gl.getUniform(copy.program, loc)).toBeCloseTo(0.4);

		orig.destroy();
		copy.destroy();
	});

	it("always resets `shared` to false, and clones are destroy-independent", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const orig = new GLShader(gl, VERTEX, FRAGMENT);
		orig.shared = true;

		const copy = orig.clone();
		expect(copy.shared).toBe(false); // ownership does not carry
		expect(orig.shared).toBe(true);

		orig.destroy();
		expect(copy.destroyed).toBe(false);
		expect(gl.isProgram(copy.program)).toBe(true);
		copy.destroy();
	});

	it("throws when cloning a destroyed shader", (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const shader = new GLShader(gl, VERTEX, FRAGMENT);
		shader.destroy();
		expect(() => {
			shader.clone();
		}).toThrow(/destroyed/);
	});
});

/**
 * Adversarial: shader assets + clone across a REAL WebGL context loss
 * (WEBGL_lose_context), mirroring webgl_pipeline_adversarial.spec.js.
 * Runs last — losing the context mid-suite would poison earlier tests.
 */
describe("shader assets + clone under context loss", () => {
	let renderer;
	let isWebGL;
	let gl;

	const tick = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	beforeAll(() => {
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	it("two concurrent loads of the same name resolve to ONE shared effect", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		// both fetches start before either resolves — the parser's post-fetch
		// re-check must keep the first stored effect (a second compile would
		// orphan a live GL program, pinned by its context-loss subscriptions)
		const src = `data:text/plain,${encodeURIComponent(FLASH)}`;
		await Promise.all([
			loader.load({ name: "flash-race", type: "shader", src }),
			loader.load({ name: "flash-race", type: "shader", src }),
		]);

		const fx = loader.getShader("flash-race");
		expect(fx).toBeInstanceOf(ShaderEffect);
		expect(loader.getShader("flash-race")).toBe(fx);

		expect(loader.unload({ name: "flash-race", type: "shader" })).toBe(true);
		expect(fx.destroyed).toBe(true);
	});

	it("clone() during a lost context does not throw, and works after restore", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip();
			return;
		}
		const orig = new ShaderEffect(renderer, FLASH);
		orig.setUniform("uIntensity", 0.6);

		ext.loseContext();
		await tick();

		// cloning mid-loss must not throw (the clone's program is deferred,
		// its uniforms map is null — the replay must defer, not crash)
		let copy;
		expect(() => {
			copy = orig.clone();
		}).not.toThrow();
		expect(copy.shared).toBe(false);

		ext.restoreContext();
		await tick();

		// after restore the clone has its own live program with the copied
		// uniform value replayed onto it
		expect(gl.isProgram(copy._shader.program)).toBe(true);
		expect(copy._shader.program).not.toBe(orig._shader.program);
		const loc = gl.getUniformLocation(copy._shader.program, "uIntensity");
		expect(gl.getUniform(copy._shader.program, loc)).toBeCloseTo(0.6);

		orig.destroy();
		copy.destroy();
	});

	it("a preloaded shader asset survives a full context loss/restore cycle", async (ctx) => {
		if (!isWebGL) {
			ctx.skip();
			return;
		}
		const ext = gl.getExtension("WEBGL_lose_context");
		if (ext === null) {
			ctx.skip();
			return;
		}
		await loader.load({ name: "flash-cycle", type: "shader", data: FLASH });
		const fx = loader.getShader("flash-cycle");
		fx.setUniform("uIntensity", 0.3);

		ext.loseContext();
		await tick();
		// suspended: the effect gates itself off
		expect(fx.enabled).toBe(false);

		ext.restoreContext();
		await tick();

		// transparently recovered: same shared instance, re-enabled, fresh
		// program with the cached uniform value replayed
		expect(loader.getShader("flash-cycle")).toBe(fx);
		expect(fx.enabled).toBe(true);
		expect(gl.isProgram(fx._shader.program)).toBe(true);
		const loc = gl.getUniformLocation(fx._shader.program, "uIntensity");
		expect(gl.getUniform(fx._shader.program, loc)).toBeCloseTo(0.3);

		expect(loader.unload({ name: "flash-cycle", type: "shader" })).toBe(true);
		expect(fx.destroyed).toBe(true);
	});

	/*
	 * {vertex, fragment} program pairs → a raw, shared GLShader. Each test
	 * is adversarial: it pins a behavior a plausible implementation
	 * shortcut would break (wrong return type, swapped sources, cache
	 * clobbering, half-registered failures, missing destroy).
	 */
	describe("{vertex, fragment} program pairs", () => {
		// distinct, actively-used uniforms in EACH stage — proves both
		// sources reached the right stage of the linked program (swapped
		// vertex/fragment would fail to compile: attributes are
		// vertex-only)
		const PAIR_VERTEX = [
			"attribute vec3 aVertex;",
			"uniform mat4 uProjectionMatrix;",
			"uniform float uVertOnly;",
			"void main(void) {",
			"    gl_Position = uProjectionMatrix * vec4(aVertex.xy, aVertex.z + uVertOnly, 1.0);",
			"}",
		].join("\n");
		const PAIR_FRAGMENT = [
			"uniform float uFragOnly;",
			"void main(void) {",
			"    gl_FragColor = vec4(uFragOnly, 0.0, 0.0, 1.0);",
			"}",
		].join("\n");

		it("inline pair compiles into a shared raw GLShader — not a ShaderEffect", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await loader.load({
				name: "pair-inline",
				type: "shader",
				data: { vertex: PAIR_VERTEX, fragment: PAIR_FRAGMENT },
			});

			const shader = loader.getShader("pair-inline");
			expect(shader).toBeInstanceOf(GLShader);
			expect(shader).not.toBeInstanceOf(ShaderEffect);
			expect(shader.shared).toBe(true);
			// both stages' uniforms are active on the linked program — the
			// sources landed in the RIGHT stages
			expect(typeof shader.uniforms.uVertOnly).not.toBe("undefined");
			expect(typeof shader.uniforms.uFragOnly).not.toBe("undefined");
			// shared semantics: same instance on every call
			expect(loader.getShader("pair-inline")).toBe(shader);

			expect(loader.unload({ name: "pair-inline", type: "shader" })).toBe(true);
			expect(shader.destroyed).toBe(true);
			expect(loader.getShader("pair-inline")).toBe(null);
		});

		it("src pair fetches BOTH URLs and compiles them into their stages", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await loader.load({
				name: "pair-src",
				type: "shader",
				src: {
					vertex: `data:text/plain,${encodeURIComponent(PAIR_VERTEX)}`,
					fragment: `data:text/plain,${encodeURIComponent(PAIR_FRAGMENT)}`,
				},
			});

			const shader = loader.getShader("pair-src");
			expect(shader).toBeInstanceOf(GLShader);
			expect(typeof shader.uniforms.uVertOnly).not.toBe("undefined");
			expect(typeof shader.uniforms.uFragOnly).not.toBe("undefined");

			loader.unload({ name: "pair-src", type: "shader" });
		});

		it("a second load of the same name keeps the first instance (no clobber)", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await loader.load({
				name: "pair-dup",
				type: "shader",
				data: { vertex: PAIR_VERTEX, fragment: PAIR_FRAGMENT },
			});
			const first = loader.getShader("pair-dup");
			await loader.load({
				name: "pair-dup",
				type: "shader",
				data: { vertex: PAIR_VERTEX, fragment: PAIR_FRAGMENT },
			});
			expect(loader.getShader("pair-dup")).toBe(first);
			expect(first.destroyed).toBe(false);

			loader.unload({ name: "pair-dup", type: "shader" });
		});

		it("clone() yields a caller-owned (non-shared) GLShader copy", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await loader.load({
				name: "pair-clone",
				type: "shader",
				data: { vertex: PAIR_VERTEX, fragment: PAIR_FRAGMENT },
			});
			const shader = loader.getShader("pair-clone");
			const copy = shader.clone();
			expect(copy).toBeInstanceOf(GLShader);
			expect(copy).not.toBe(shader);
			expect(copy.shared).toBe(false);
			// independent programs: destroying the copy leaves the shared one
			copy.destroy();
			expect(shader.destroyed).toBe(false);

			loader.unload({ name: "pair-clone", type: "shader" });
		});

		it("rejects a pair missing one source, with the asset name — and registers nothing", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await expect(
				loader.load({
					name: "pair-halved",
					type: "shader",
					src: { fragment: "data:text/plain,void%20main(void)%20%7B%7D" },
				}),
			).rejects.toThrow(/pair-halved.*vertex/);
			// a failed load must not leave a half-registered cache entry
			expect(loader.getShader("pair-halved")).toBe(null);

			await expect(
				loader.load({
					name: "pair-halved-inline",
					type: "shader",
					data: { vertex: PAIR_VERTEX },
				}),
			).rejects.toThrow(/pair-halved-inline/);
			expect(loader.getShader("pair-halved-inline")).toBe(null);
		});

		it("rejects invalid GLSL in a pair, with the asset name — and registers nothing", async (ctx) => {
			if (!isWebGL) {
				ctx.skip();
				return;
			}
			await expect(
				loader.load({
					name: "pair-broken",
					type: "shader",
					data: { vertex: "not glsl", fragment: PAIR_FRAGMENT },
				}),
			).rejects.toThrow(/pair-broken/);
			expect(loader.getShader("pair-broken")).toBe(null);
		});
	});
});
