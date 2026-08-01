import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { event } from "../src/index.js";
import UniformBlock from "../src/video/webgl/buffer/uniformblock.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * The uniform buffer behind the light blocks (issue #1552).
 *
 * Two things here fail silently rather than loudly, so both are pinned:
 *
 * - an unbound block reads as zeroes, so a shader whose binding was never
 *   established renders black rather than erroring
 * - a block binding is *program* state, and `GLShader` recompiles its program
 *   on context restore — so a binding established once at startup is gone
 *   after a lose/restore cycle, and lighting goes black with no GL error
 */
describe("UniformBlock (issue #1552)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** a program declaring a std140 block, so bindTo has something to find */
	const VERT = `#version 300 es
in vec3 aVertex;
void main(void) { gl_Position = vec4(aVertex, 1.0); }`;

	const FRAG = `#version 300 es
precision mediump float;
layout(std140) uniform TestBlock {
	vec4 first;
	vec4 second;
};
out vec4 fragColor;
void main(void) { fragColor = first + second; }`;

	/**
	 * Compile and link a program declaring `TestBlock`.
	 * @returns {WebGLProgram} the linked program
	 */
	const buildProgram = () => {
		const vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, VERT);
		gl.compileShader(vs);
		const fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, FRAG);
		gl.compileShader(fs);
		const p = gl.createProgram();
		gl.attachShader(p, vs);
		gl.attachShader(p, fs);
		gl.linkProgram(p);
		return p;
	};

	const tick = () => {
		return new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	};

	describe("construction", () => {
		it("allocates a staging buffer and a GL buffer", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 8, 3);
			try {
				expect(block.data).toBeInstanceOf(Float32Array);
				expect(block.data.length).toBe(8);
				expect(gl.isBuffer(block.buffer)).toBe(true);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				block.destroy();
			}
		});

		it("occupies the binding point it was given", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 8, 5);
			try {
				expect(gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, 5)).toBe(
					block.buffer,
				);
			} finally {
				block.destroy();
			}
		});

		it("leaves the generic UNIFORM_BUFFER binding clean", (ctx) => {
			requireWebGL(ctx, renderer);
			// leaking it would make an unrelated later bufferData land here
			const block = new UniformBlock(gl, 8, 3);
			try {
				expect(gl.getParameter(gl.UNIFORM_BUFFER_BINDING)).toBeNull();
			} finally {
				block.destroy();
			}
		});
	});

	describe("bindTo", () => {
		it("binds a declared block and reports success", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 8, 2);
			const program = buildProgram();
			try {
				expect(block.bindTo(program, "TestBlock")).toBe(true);
				const index = gl.getUniformBlockIndex(program, "TestBlock");
				expect(
					gl.getActiveUniformBlockParameter(
						program,
						index,
						gl.UNIFORM_BLOCK_BINDING,
					),
				).toBe(2);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				gl.deleteProgram(program);
				block.destroy();
			}
		});

		it("reports failure for a block the program does not declare", (ctx) => {
			requireWebGL(ctx, renderer);
			// not an error: a shader may simply not use lighting. Returning
			// false lets the caller skip feeding it rather than throw.
			const block = new UniformBlock(gl, 8, 2);
			const program = buildProgram();
			try {
				expect(block.bindTo(program, "NoSuchBlock")).toBe(false);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				gl.deleteProgram(program);
				block.destroy();
			}
		});

		it("is idempotent", (ctx) => {
			requireWebGL(ctx, renderer);
			// re-bound after every context restore, with no way to ask whether
			// it already was
			const block = new UniformBlock(gl, 8, 2);
			const program = buildProgram();
			try {
				expect(block.bindTo(program, "TestBlock")).toBe(true);
				expect(block.bindTo(program, "TestBlock")).toBe(true);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				gl.deleteProgram(program);
				block.destroy();
			}
		});
	});

	describe("upload", () => {
		it("sends only the live prefix", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 64, 1);
			const seen = [];
			const orig = gl.bufferSubData.bind(gl);
			gl.bufferSubData = (target, offset, data, srcOffset, length) => {
				seen.push(length);
				return orig(target, offset, data, srcOffset, length);
			};
			try {
				block.data[0] = 1;
				expect(block.upload(8)).toBe(true);
				expect(seen).toEqual([8]);
			} finally {
				gl.bufferSubData = orig;
				block.destroy();
			}
		});

		it("skips the upload when nothing changed", (ctx) => {
			requireWebGL(ctx, renderer);
			// the property this replaces: uniform writes are already skipped
			// when unchanged, so a static light set must stay free
			const block = new UniformBlock(gl, 64, 1);
			try {
				block.data[0] = 42;
				expect(block.upload(8)).toBe(true);
				expect(block.upload(8)).toBe(false);
				expect(block.upload(8)).toBe(false);
			} finally {
				block.destroy();
			}
		});

		it("uploads again once a value actually changes", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 64, 1);
			try {
				block.data[0] = 1;
				expect(block.upload(8)).toBe(true);
				expect(block.upload(8)).toBe(false);
				block.data[7] = 2;
				expect(block.upload(8)).toBe(true);
			} finally {
				block.destroy();
			}
		});

		it("uploads again when only the prefix length changes", (ctx) => {
			requireWebGL(ctx, renderer);
			// dropping from 4 lights to 1 leaves the first light's bytes
			// identical; comparing only content would skip the header change
			const block = new UniformBlock(gl, 64, 1);
			try {
				block.data.fill(3);
				expect(block.upload(24)).toBe(true);
				expect(block.upload(16)).toBe(true);
				expect(block.upload(16)).toBe(false);
			} finally {
				block.destroy();
			}
		});

		it("does not throw after destroy", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 8, 1);
			block.destroy();
			expect(block.upload(8)).toBe(false);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	describe("destroy", () => {
		it("releases the buffer and is safe to repeat", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = new UniformBlock(gl, 8, 1);
			const buffer = block.buffer;
			block.destroy();
			expect(block.buffer).toBeNull();
			expect(gl.isBuffer(buffer)).toBe(false);
			expect(() => {
				block.destroy();
			}).not.toThrow();
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});

	// deliberately last: a lose/restore cycle takes the context away from
	// everything sharing it
	describe("context loss", () => {
		it("is rebuilt by the batcher that owns it, and re-binds", async (ctx) => {
			requireWebGL(ctx, renderer);
			const ext = gl.getExtension("WEBGL_lose_context");
			if (ext === null) {
				ctx.skip("WEBGL_lose_context unavailable");
				return;
			}
			// The engine has no recovery hook on the block itself: on restore
			// `WebGLRenderer.reset()` re-runs each batcher's `init()`, which
			// destroys the old block and constructs a new one against the new
			// context. This exercises that real path rather than a method
			// nothing calls — an unbound or dead block reads as zeroes, so a
			// gap here would render lit surfaces black with no GL error.
			const batcher = renderer.batchers.get("litQuad");
			const before = batcher.lightBlock;
			expect(before).toBeDefined();

			const restored = new Promise((resolve) => {
				event.once(event.ONCONTEXT_RESTORED, resolve);
			});
			ext.loseContext();
			await tick();
			ext.restoreContext();
			await restored;
			await tick();

			const after = batcher.lightBlock;
			// a fresh block against the new context; the old handle is gone
			expect(after).not.toBe(before);
			expect(gl.isBuffer(after.buffer)).toBe(true);
			expect(
				gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, after.bindingPoint),
			).toBe(after.buffer);

			// and it still accepts data, so the next frame's lights land
			after.data[0] = 3;
			expect(after.upload(8)).toBe(true);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});
	});
});
