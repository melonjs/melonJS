import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { GLShader, Mesh } from "../src/index.js";
import ShineEffect from "../src/video/effects/shine.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * WebGL twins of the custom-mesh-shader coverage (the WebGPU side lives in
 * webgpu_custom_mesh_shader.spec.js), plus the review-driven parity fixes:
 * the hosted-shader guard and one-shot warn in `drawMesh`, the guarded
 * `uSampler`, exception-safe hosting, `setBlendMode("none")`, and shine's
 * `uUVYDir` adoption.
 */

// a complete GLSL program over the mesh contract (attributes in the frozen
// layout order, engine-fed uniforms declared)
const TOON_VERTEX = [
	"attribute vec3 aVertex;",
	"attribute vec2 aRegion;",
	"attribute vec4 aColor;",
	"uniform mat4 uProjectionMatrix;",
	"uniform mat4 uViewMatrix;",
	"uniform mat4 uModelMatrix;",
	"varying vec2 vRegion;",
	"varying vec4 vColor;",
	"void main(void) {",
	"    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertex, 1.0);",
	"    vRegion = aRegion;",
	"    vColor = aColor;",
	"}",
].join("\n");
const TOON_FRAGMENT = [
	"precision mediump float;",
	"uniform sampler2D uSampler;",
	"varying vec2 vRegion;",
	"varying vec4 vColor;",
	"void main(void) {",
	"    vec4 color = texture2D(uSampler, vRegion) * vColor;",
	"    gl_FragColor = vec4(floor(color.rgb * 4.0) / 4.0, color.a);",
	"}",
].join("\n");
// no texture read at all — vertex colors only (no uSampler declared)
const FLAT_FRAGMENT = [
	"precision mediump float;",
	"varying vec2 vRegion;",
	"varying vec4 vColor;",
	"void main(void) {",
	"    gl_FragColor = vColor;",
	"}",
].join("\n");

const WGSL_MODULE = [
	"@vertex",
	"fn vertex_main(@location(0) aVertex : vec3f) -> @builtin(position) vec4f {",
	"    return vec4f(aVertex, 1.0);",
	"}",
	"@fragment",
	"fn fragment_main() -> @location(0) vec4f { return vec4f(1.0); }",
].join("\n");

let renderer;

beforeAll(async () => {
	renderer = await getWebGLRenderer(128, 128);
});

afterAll(() => {
	releaseWebGLRenderer();
});

describe("WebGL drawMesh — custom shader hosting", () => {
	afterEach(() => {
		if (renderer) {
			renderer.customShader = undefined;
			renderer._meshShaderWarned = false;
		}
	});

	const makeTexturedMesh = (settings = {}) => {
		const canvas = document.createElement("canvas");
		canvas.width = 32;
		canvas.height = 32;
		canvas.getContext("2d").fillRect(0, 0, 32, 32);
		return new Mesh(0, 0, {
			vertices: [-8, -8, 0, 8, -8, 0, 8, 8, 0, -8, 8, 0],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			width: 16,
			height: 16,
			texture: canvas,
			...settings,
		});
	};

	it("hosts a complete GLSL program and reverts to the default shader", (ctx) => {
		requireWebGL(ctx, renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shader = new GLShader(renderer.gl, TOON_VERTEX, TOON_FRAGMENT);
		const mesh = makeTexturedMesh();
		renderer.customShader = shader;
		try {
			renderer.drawMesh(mesh);
			const batcher = renderer.currentBatcher;
			// the finally bracket reverted to the built-in shading — the
			// next unshaded mesh must not silently draw with the custom one
			expect(batcher.currentShader).toBe(batcher.defaultShader);
			expect(warn).not.toHaveBeenCalled();
		} finally {
			warn.mockRestore();
			shader.destroy();
			mesh.destroy();
		}
	});

	it("a custom shader that never samples the texture (no uSampler) draws without throwing", (ctx) => {
		requireWebGL(ctx, renderer);
		const shader = new GLShader(renderer.gl, TOON_VERTEX, FLAT_FRAGMENT);
		const mesh = makeTexturedMesh();
		renderer.customShader = shader;
		try {
			expect(() => {
				renderer.drawMesh(mesh);
			}).not.toThrow();
		} finally {
			shader.destroy();
			mesh.destroy();
		}
	});

	it("a WGSL-only shader warns once and draws with the built-in shading", (ctx) => {
		requireWebGL(ctx, renderer);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const shader = new GLShader(undefined, { wgsl: WGSL_MODULE });
		const mesh = makeTexturedMesh();
		renderer.customShader = shader;
		try {
			renderer.drawMesh(mesh);
			renderer.drawMesh(mesh);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toMatch(/Mesh/);
			const batcher = renderer.currentBatcher;
			expect(batcher.currentShader).toBe(batcher.defaultShader);
		} finally {
			warn.mockRestore();
			mesh.destroy();
		}
	});

	it("an exception mid-draw still reverts the hosted shader and the cull toggle", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const shader = new GLShader(renderer.gl, TOON_VERTEX, TOON_FRAGMENT);
		const mesh = makeTexturedMesh({ cullBackFaces: true });
		renderer.customShader = shader;
		// route the draw into a throw after the shader was hosted
		renderer.drawMesh(mesh); // warm: batcher selected
		const batcher = renderer.currentBatcher;
		const original = batcher.addMesh;
		batcher.addMesh = () => {
			throw new Error("boom");
		};
		try {
			expect(() => {
				renderer.drawMesh(mesh);
			}).toThrow("boom");
			expect(batcher.currentShader).toBe(batcher.defaultShader);
			expect(gl.isEnabled(gl.CULL_FACE)).toBe(false);
		} finally {
			batcher.addMesh = original;
			shader.destroy();
			mesh.destroy();
		}
	});
});

describe("WebGL setBlendMode('none')", () => {
	it("disables blending (replace), and a later mode re-enables it", (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		try {
			expect(renderer.setBlendMode("none")).toBe("none");
			expect(gl.isEnabled(gl.BLEND)).toBe(false);
			// no silent downgrade to "normal" (the pre-fix behavior)
			expect(renderer.currentBlendMode).toBe("none");
			expect(renderer.setBlendMode("normal")).toBe("normal");
			expect(gl.isEnabled(gl.BLEND)).toBe(true);
		} finally {
			renderer.setBlendMode("normal");
		}
	});
});

describe("ShineEffect uUVYDir adoption", () => {
	it("declares the directional uniform, defaulted top-down, and accepts the feed", (ctx) => {
		requireWebGL(ctx, renderer);
		const fx = new ShineEffect(renderer, { angle: Math.PI / 2 });
		try {
			// active on the compiled program (the sweep uses it, so the
			// compiler cannot eliminate it) — the batcher feed sites can
			// flip it on the bottom-up pooled path
			expect(typeof fx._shader.uniforms.uUVYDir).not.toBe("undefined");
			expect(() => {
				fx._setUVYDir(-1);
				fx._setUVYDir(1);
			}).not.toThrow();
		} finally {
			fx.destroy();
		}
	});
});
