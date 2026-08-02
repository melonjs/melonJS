import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	GLShader,
	game,
	ShaderEffect,
	WebGLRenderer,
} from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * The attribute-location contract (#1509): locations are bound in vertex
 * source declaration order, so every shader hosted by a batcher must
 * declare a PREFIX of that batcher's attribute layout, in layout order —
 * the engine's analogue of WebGPU's pipeline-creation validation.
 *
 * (a) violation → exactly one console warning per (batcher, shader) pair;
 * (b) built-in conformance sweep: every shader population the engine
 *     ships must satisfy the contract of its host batcher — CI fails the
 *     moment a non-conforming built-in is added.
 */
describe("WebGL vertex-state location contract", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(async () => {
		boot();
		await getWebGLRenderer(160, 120);
		renderer = game.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		// hand the shared context back and reset renderer state so the next
		// spec file does not inherit ours
		releaseWebGLRenderer();
	});

	const requireWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	it("an out-of-order shader triggers exactly one warning per (batcher, shader) pair", (ctx) => {
		requireWebGL(ctx);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			// aRegion declared BEFORE aVertex — links aRegion to location 0
			// where the quad vertex state expects aVertex
			const badShader = new GLShader(
				gl,
				`attribute vec2 aRegion;
				attribute vec3 aVertex;
				attribute vec4 aColor;
				uniform mat4 uProjectionMatrix;
				varying vec2 vRegion;
				void main(void) {
					vRegion = aRegion;
					gl_Position = uProjectionMatrix * vec4(aVertex, 1.0);
				}`,
				`varying vec2 vRegion;
				void main(void) { gl_FragColor = vec4(vRegion, 0.0, 1.0); }`,
			);
			const quad = renderer.setBatcher("quad") ?? renderer.batchers.get("quad");
			quad.useShader(badShader);
			quad.useShader(quad.defaultShader);
			// second use: the WeakSet cache must suppress a repeat warning
			quad.useShader(badShader);
			quad.useShader(quad.defaultShader);

			const contractWarns = warnSpy.mock.calls.filter((args) => {
				return /layout order/.test(String(args[0]));
			});
			expect(contractWarns.length).toBe(1);
			badShader.destroy();
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("a conforming ShaderEffect triggers no contract warning", (ctx) => {
		requireWebGL(ctx);
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const effect = new ShaderEffect(
				renderer,
				"vec4 apply(vec4 color, vec2 uv) { return color; }",
			);
			const quad = renderer.batchers.get("quad");
			renderer.setBatcher("quad");
			quad.useShader(effect._shader);
			quad.useShader(quad.defaultShader);
			const contractWarns = warnSpy.mock.calls.filter((args) => {
				return /layout order/.test(String(args[0]));
			});
			expect(contractWarns.length).toBe(0);
			effect.destroy();
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("built-in conformance sweep: every default batcher shader matches its own layout", (ctx) => {
		requireWebGL(ctx);
		// trivially true (the default shader DEFINES the canonical mapping)
		// but pins the invariant that getAttribLocation is stable + present
		for (const [name, batcher] of renderer.batchers) {
			for (const attr of batcher.attributes) {
				expect(
					batcher.defaultShader.getAttribLocation(attr.name),
					`${name}.${attr.name}`,
				).not.toBe(-1);
			}
		}
	});

	it("built-in conformance sweep: cross-hosted engine shaders satisfy the quad contract", (ctx) => {
		requireWebGL(ctx);
		const quad = renderer.batchers.get("quad");
		const canonical = {};
		for (const attr of quad.attributes) {
			canonical[attr.name] = quad.defaultShader.getAttribLocation(attr.name);
		}

		const hosted = [];
		// ShaderEffect-generated vertex (the user-effect population)
		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		hosted.push(["ShaderEffect", effect._shader]);
		// the light shader (drawLight swaps it onto the quad batcher)
		if (renderer._lightShader) {
			hosted.push(["lightShader", renderer._lightShader]);
		}

		for (const [label, shader] of hosted) {
			for (const [name, expected] of Object.entries(canonical)) {
				const actual = shader.getAttribLocation(name);
				if (actual !== -1) {
					expect(actual, `${label}.${name}`).toBe(expected);
				}
			}
		}
		effect.destroy();
	});
});
