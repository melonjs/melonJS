/**
 * Writing a uniform must not corrupt a pending batch.
 *
 * `GLShader.setUniform` writes through `bind()` → `gl.useProgram`, and a
 * freshly linked program is left bound too. `GLShader` is constructed with a
 * bare `gl` and cannot reach the renderer, so if the renderer cached the
 * current program in a field of its own, that field would drift out of step
 * with GL. Every batcher compares against it before re-issuing `useProgram`
 * (`syncProgram`, and the mesh and primitive paths), so a stale cache makes
 * them skip a rebind they needed — and the queued geometry rasterizes through
 * whichever program the uniform write happened to leave bound. The attribute
 * layouts overlap enough that nothing errors; sprites simply turn black or
 * vanish.
 *
 * Found while building the blend-mode-by-renderable example, where a sprite
 * rendered as a solid black rectangle. Reachable without any blend mode: this
 * spec never leaves `"normal"`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShaderEffect } from "../src/index.js";
import { expectPixelClose, readPixel } from "./helpers/pixels.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

const SIZE = 32;
const RED = [220, 40, 40];

const solidCanvas = (rgb) => {
	const c = document.createElement("canvas");
	c.width = 8;
	c.height = 8;
	const x = c.getContext("2d");
	x.fillStyle = `rgb(${rgb.join(",")})`;
	x.fillRect(0, 0, 8, 8);
	return c;
};

describe("shader program cache stays in step with GL", () => {
	let renderer;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(SIZE, SIZE);
		if (renderer !== undefined) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** two sprites, optionally writing an effect uniform between them */
	const drawPair = (effect) => {
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.setColor("#000000");
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.setColor("#ffffff");
		const img = solidCanvas(RED);
		renderer.drawImage(img, 0, 0, 8, 8, 0, 0, SIZE / 2, SIZE);
		if (effect !== undefined) {
			// the batch is PENDING at this point — this is the whole hazard
			effect.setUniform("uTime", 1.5);
		}
		renderer.drawImage(img, 0, 0, 8, 8, SIZE / 2, 0, SIZE / 2, SIZE);
		renderer.flush();
	};

	it("a uniform written mid-batch does not corrupt the batch", async (ctx) => {
		requireWebGL(ctx, renderer);
		const effect = new ShaderEffect(
			renderer,
			`uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) { return color; }`,
		);
		try {
			drawPair(undefined);
			const clean = await readPixel(renderer, SIZE / 2 + 4, SIZE / 2);
			expectPixelClose(clean, [...RED, 255], 3, "control: no uniform write");

			drawPair(effect);
			const afterWrite = await readPixel(renderer, SIZE / 2 + 4, SIZE / 2);
			// used to come back [0, 0, 0, 255]: the pending sprites drew through
			// the effect's program
			expectPixelClose(afterWrite, [...RED, 255], 3, "after a uniform write");
		} finally {
			effect.destroy();
		}
	});

	it("the cached program agrees with what GL actually has bound", async (ctx) => {
		requireWebGL(ctx, renderer);
		const gl = renderer.gl;
		const effect = new ShaderEffect(
			renderer,
			`uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) { return color; }`,
		);
		try {
			drawPair(undefined);
			expect(
				renderer.currentProgram,
				"cache disagreed with GL before any uniform write",
			).toBe(gl.getParameter(gl.CURRENT_PROGRAM));

			// the operation that used to desync them
			effect.setUniform("uTime", 2.5);
			expect(
				renderer.currentProgram,
				"a uniform write left the cache naming a program GL no longer has bound",
			).toBe(gl.getParameter(gl.CURRENT_PROGRAM));
		} finally {
			effect.destroy();
		}
	});
	it("setTime mid-batch is safe — the documented per-frame call", async (ctx) => {
		requireWebGL(ctx, renderer);
		// ShaderEffect's own docs tell you to drive an animated effect with
		// `setTime` every frame. It routes through the same setUniform path,
		// so it carries the same hazard when a batch is pending.
		const effect = new ShaderEffect(
			renderer,
			`uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) { return color; }`,
		);
		try {
			renderer.setBlendMode("normal");
			renderer.setGlobalAlpha(1);
			renderer.setColor("#000000");
			renderer.fillRect(0, 0, SIZE, SIZE);
			renderer.flush();
			renderer.setColor("#ffffff");
			const img = solidCanvas(RED);
			renderer.drawImage(img, 0, 0, 8, 8, 0, 0, SIZE / 2, SIZE);
			effect.setTime(1.25);
			renderer.drawImage(img, 0, 0, 8, 8, SIZE / 2, 0, SIZE / 2, SIZE);
			renderer.flush();
			const px = await readPixel(renderer, SIZE / 2 + 4, SIZE / 2);
			expectPixelClose(px, [...RED, 255], 3, "after setTime");
		} finally {
			effect.destroy();
		}
	});

	it("CONSTRUCTING an effect mid-batch is safe", async (ctx) => {
		requireWebGL(ctx, renderer);
		// linking a program leaves it bound, so building an effect lazily —
		// on first use, say — desyncs the cache just as writing a uniform does
		renderer.setBlendMode("normal");
		renderer.setGlobalAlpha(1);
		renderer.setColor("#000000");
		renderer.fillRect(0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.setColor("#ffffff");
		const img = solidCanvas(RED);
		renderer.drawImage(img, 0, 0, 8, 8, 0, 0, SIZE / 2, SIZE);
		const effect = new ShaderEffect(
			renderer,
			"vec4 apply(vec4 color, vec2 uv) { return color; }",
		);
		renderer.drawImage(img, 0, 0, 8, 8, SIZE / 2, 0, SIZE / 2, SIZE);
		renderer.flush();
		const px = await readPixel(renderer, SIZE / 2 + 4, SIZE / 2);
		expectPixelClose(px, [...RED, 255], 3, "effect built mid-batch");
		effect.destroy();
	});

	it("a pending SHAPE batch survives a uniform write too", async (ctx) => {
		requireWebGL(ctx, renderer);
		// the primitive batcher makes the same cache comparison as the quad
		// one, so it has the same exposure
		const effect = new ShaderEffect(
			renderer,
			`uniform float uTime;
			vec4 apply(vec4 color, vec2 uv) { return color; }`,
		);
		try {
			renderer.setBlendMode("normal");
			renderer.setGlobalAlpha(1);
			renderer.setColor("#000000");
			renderer.fillRect(0, 0, SIZE, SIZE);
			renderer.flush();
			renderer.setColor(`rgb(${RED.join(",")})`);
			renderer.fillRect(0, 0, SIZE / 2, SIZE);
			effect.setUniform("uTime", 3.5);
			renderer.fillRect(SIZE / 2, 0, SIZE / 2, SIZE);
			renderer.flush();
			const px = await readPixel(renderer, SIZE / 2 + 4, SIZE / 2);
			expectPixelClose(
				px,
				[...RED, 255],
				3,
				"shape batch after a uniform write",
			);
		} finally {
			effect.destroy();
		}
	});

	it("a batcher still adopts its own shader when it binds", (ctx) => {
		requireWebGL(ctx, renderer);
		// Regression guard for the second defect the fix exposed: `bind()`
		// used the program cache to decide whether to call `useShader`, which
		// is ALSO what assigns `currentShader`. Once the cache told the truth
		// the two questions came apart, and a batcher could bind without ever
		// adopting its shader — `setProjection` then dereferenced undefined.
		for (const name of ["quad", "primitive"]) {
			const batcher = renderer.setBatcher(name);
			expect(batcher.currentShader, `${name} has no shader after bind`).toBe(
				batcher.defaultShader,
			);
			expect(() => {
				batcher.setProjection(renderer.projectionMatrix);
			}, `${name}.setProjection threw`).not.toThrow();
		}
		renderer.setBatcher("quad");
	});

	it("still skips redundant program binds — the cache is not defeated", (ctx) => {
		requireWebGL(ctx, renderer);
		// The cheap fix would have been to drop the cache and re-issue
		// useProgram on every flush. That would pass every test above while
		// adding a state change per batch, so pin the optimisation too:
		// repeating an identical batch must not re-bind the program.
		const gl = renderer.gl;
		const img = solidCanvas(RED);
		const real = gl.useProgram.bind(gl);
		let calls = 0;
		gl.useProgram = (prog) => {
			calls++;
			real(prog);
		};
		try {
			renderer.setBlendMode("normal");
			renderer.setColor("#ffffff");
			renderer.drawImage(img, 0, 0, 8, 8, 0, 0, 8, 8);
			renderer.flush();
			calls = 0;
			for (let i = 0; i < 5; i++) {
				renderer.drawImage(img, 0, 0, 8, 8, 0, 0, 8, 8);
				renderer.flush();
			}
			expect(calls, "the program was re-bound on every flush").toBe(0);
		} finally {
			gl.useProgram = real;
		}
	});
});
