import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Container, video } from "../src/index.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";
import RenderState from "../src/video/renderstate.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

/**
 * `clipRect` regression guards for issue #1349. Three classes of bug
 * are covered, all now fixed:
 *
 * 1. Coordinate-space mismatch at the call site — `Container.draw`
 *    used to pass `getBounds()` (world space) to a `clipRect` API
 *    interpreted as local to the current transform, so a translated
 *    parent double-counted its own translate. Affected both Canvas
 *    and WebGL.
 * 2. WebGL `clipRect` honored only translation (`currentTransform.tx/ty`),
 *    ignoring scale and rotation, so a scaled parent produced a
 *    wrong-sized scissor box. Canvas's `context.rect` was already
 *    matrix-aware.
 * 3. WebGL `restore()` reverted the scissor without flushing pending
 *    PrimitiveBatcher vertices, so vertices queued inside a deeper
 *    clipping container could leak out and flush later under a more
 *    permissive scissor.
 */

// ---------------- WebGLRenderer ----------------

describe("WebGLRenderer.clipRect (#1349)", () => {
	let renderer;
	let gl;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		isWebGL = renderer instanceof WebGLRenderer;
		if (isWebGL) {
			gl = renderer.gl;
		}
	});

	afterAll(() => {
		// hand the world back to the default renderer for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	/**
	 * Spy on `gl.scissor` for the duration of `fn`, returning the
	 * captured argument lists in call order.
	 */
	function captureScissor(fn) {
		const orig = gl.scissor.bind(gl);
		const calls = [];
		gl.scissor = (x, y, w, h) => {
			calls.push({ x, y, w, h });
			orig(x, y, w, h);
		};
		try {
			fn();
		} finally {
			gl.scissor = orig;
		}
		return calls;
	}

	it("clipRect under identity transform: scissor matches the input rect", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		const calls = captureScissor(() => {
			renderer.clipRect(100, 100, 50, 60);
		});
		renderer.restore();

		expect(calls.length).toBe(1);
		const canvas = renderer.getCanvas();
		// GL scissor uses bottom-left origin, so y is flipped:
		// glY = canvasH - h - y.
		expect(calls[0].x).toBe(100);
		expect(calls[0].y).toBe(canvas.height - 60 - 100);
		expect(calls[0].w).toBe(50);
		expect(calls[0].h).toBe(60);
	});

	it("clipRect under a translated transform: scissor honors the translation", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		renderer.translate(50, 30);

		const calls = captureScissor(() => {
			renderer.clipRect(200, 200, 100, 100);
		});
		renderer.restore();

		expect(calls.length).toBe(1);
		const canvas = renderer.getCanvas();
		// input is local-to-current-transform: with translate(50, 30) the
		// local (200, 200, 100, 100) rect lives at screen (250, 230, 100, 100).
		expect(calls[0].x).toBe(250);
		expect(calls[0].y).toBe(canvas.height - 100 - 230);
		expect(calls[0].w).toBe(100);
		expect(calls[0].h).toBe(100);
	});

	// ---- Fixed bugs (flipped from `it.fails` after #1349 fix) ----

	it("Bug #1349 (fixed): clipRect under a scaled transform produces a scaled scissor box", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		renderer.scale(2, 1);

		const calls = captureScissor(() => {
			renderer.clipRect(100, 100, 50, 60);
		});
		renderer.restore();

		expect(calls.length).toBe(1);
		// With scale(2, 1), local (100, 100, 50, 60) lives at screen
		// (200, 100, 100, 60).
		expect(calls[0].x).toBe(200);
		expect(calls[0].w).toBe(100);
		expect(calls[0].h).toBe(60);
	});

	it("Bug #1349 (fixed): clipRect under a rotated transform produces the rotated AABB", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		// rotate 45° around the origin
		renderer.rotate(Math.PI / 4);

		const calls = captureScissor(() => {
			renderer.clipRect(100, 0, 50, 50);
		});
		renderer.restore();

		expect(calls.length).toBe(1);
		// A 50×50 rect rotated 45° has a √2 × side AABB ≈ 70.71 wide/tall.
		expect(calls[0].w).toBeGreaterThanOrEqual(70);
		expect(calls[0].h).toBeGreaterThanOrEqual(70);
	});

	// ---- Bug #1 (call site) — Container nested in a translated wrapper ----

	it("Bug #1349 (fixed): Container nested in a translated wrapper produces a correctly-placed scissor", () => {
		if (!isWebGL) {
			return;
		}
		// reproducer matches the visual demo in the Clipping example:
		// wrapper at world (280, 80) → inner clipping container at LOCAL (0, 0).
		// Inner's world bounds are (280, 80, 180, 160), so the *expected*
		// scissor screen rect is (280, 80, 180, 160). Today, by the time
		// `Container.draw` calls `clipRect(bounds.left, ...)`, the wrapper's
		// own `translate(280, 80)` has already been pushed onto
		// `currentTransform` (via wrapper's draw line 948). The WebGL impl
		// adds `currentTransform.tx` again on top of the world-space input
		// → scissor lands at screen (560, 160) instead of (280, 80).
		const wrapper = new Container(280, 80, 180, 160);
		wrapper.clipping = false;
		const inner = new Container(0, 0, 180, 160);
		inner.clipping = true;
		wrapper.addChild(inner);
		// Container's child draw loop skips children with `inViewport === false`;
		// our test driver doesn't run the engine's visibility update, so we
		// have to flip the flag manually. Without this `inner.draw` never
		// runs and `clipRect` is never called.
		inner.inViewport = true;

		renderer.save();
		renderer.resetTransform();
		let calls;
		try {
			wrapper.preDraw(renderer);
			calls = captureScissor(() => {
				wrapper.draw(renderer, { isDefault: true });
			});
			wrapper.postDraw(renderer);
		} finally {
			renderer.restore();
		}

		// Find the scissor call belonging to the inner clipping container —
		// width/height match its bounds. Other scissor calls (FBO, camera
		// viewport, etc.) won't match the (180, 160) dimensions.
		const innerCall = calls.find((c) => {
			return c.w === 180 && c.h === 160;
		});
		expect(innerCall).toBeDefined();

		const canvas = renderer.getCanvas();
		// Expected screen rect (280, 80, 180, 160).
		expect(innerCall.x).toBe(280);
		expect(innerCall.y).toBe(canvas.height - 160 - 80);
	});

	// ---- Regression guard: full-canvas input is an explicit "no clip" signal ----

	it("clipRect with input matching the canvas size disables the scissor without running transform math", () => {
		if (!isWebGL) {
			return;
		}
		// Reproduces the `ColorLayer.draw` contract: ColorLayer is a
		// `Renderable(0, 0, Infinity, Infinity)` with the default
		// 0.5-anchor, so by the time its `draw` runs the renderer's
		// `currentTransform.tx/ty` are `-Infinity`. The clipRect call
		// `clipRect(0, 0, viewport.w, viewport.h)` must be treated as
		// an explicit no-op without ever feeding those `-Infinity`
		// values through the transform — the previous implementation
		// avoided this via an early return on the input args, and the
		// fix preserves that fast path.
		renderer.save();
		renderer.resetTransform();
		// poison currentTransform with a value that would produce NaN/
		// Infinity corners if the transform path ran (mirrors the
		// ColorLayer setup).
		renderer.translate(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

		const canvas = renderer.getCanvas();
		const calls = captureScissor(() => {
			renderer.clipRect(0, 0, canvas.width, canvas.height);
		});
		renderer.restore();

		// No `gl.scissor` call should have happened; SCISSOR_TEST is
		// disabled instead.
		expect(calls.length).toBe(0);
		expect(renderer._scissorActive).toBe(false);
	});

	// ---- Regression guard: vertices queued under a tighter clip
	// flush *under that clip's scissor*, not under whatever scissor is
	// active at end-of-frame. The pre-fix `restore()` reverted the GL
	// scissor box without draining the batcher, so vertices queued
	// inside a deeply nested clipping container would survive past
	// `restore()` and flush later under a more permissive scissor.

	/**
	 * Spy on `gl.drawArrays` / `gl.drawElements` and capture the
	 * renderer's tracked scissor state at the moment each draw is
	 * issued. Internal `_scissorActive` / `currentScissor` mirror the
	 * GL state we set, so reading them is equivalent to and cheaper
	 * than calling `gl.getParameter(gl.SCISSOR_BOX)`.
	 */
	function captureDrawScissors(fn) {
		const drawArrays = gl.drawArrays.bind(gl);
		const drawElements = gl.drawElements.bind(gl);
		const calls = [];
		const snapshot = () => {
			const s = renderer.currentScissor;
			calls.push({
				active: renderer._scissorActive === true,
				x: s[0],
				y: s[1],
				w: s[2],
				h: s[3],
			});
		};
		gl.drawArrays = function (...args) {
			snapshot();
			return drawArrays(...args);
		};
		gl.drawElements = function (...args) {
			snapshot();
			return drawElements(...args);
		};
		try {
			fn();
		} finally {
			gl.drawArrays = drawArrays;
			gl.drawElements = drawElements;
		}
		return calls;
	}

	it("vertices queued inside a nested clip flush under that clip's scissor", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		// reset cache so each clipRect call below actually issues a
		// fresh `gl.scissor`.
		renderer.currentScissor[0] = -1;

		const calls = captureDrawScissors(() => {
			// outer clip: (10, 10, 100, 100) — vertices issued here
			// must end up under this scissor.
			renderer.clipRect(10, 10, 100, 100);
			renderer.fillRect(10, 10, 100, 100);

			renderer.save();
			// inner clip — narrower box. fillRect underneath must end
			// up under THIS scissor, not the outer one or no scissor.
			renderer.clipRect(20, 20, 50, 50);
			renderer.fillRect(20, 20, 50, 50);
			// pre-fix: this `restore()` reverts the scissor without
			// flushing, leaving inner vertices in the batcher.
			renderer.restore();

			renderer.restore();
			// any pending vertices are now flushed at end-of-frame.
			renderer.flush();
		});

		// each fillRect produces at least one draw call (PrimitiveBatcher
		// flushes on scissor change in clipRect / restore). Find the
		// call whose scissor box matches the inner clip.
		const innerDraw = calls.find((c) => {
			return c.active && c.x === 20 && c.w === 50;
		});
		expect(innerDraw).toBeDefined();
		expect(innerDraw.y).toBe(20);
		expect(innerDraw.h).toBe(50);

		// outer clip's vertices must also have flushed under the outer
		// scissor (they were drained by the inner clipRect's flush).
		const outerDraw = calls.find((c) => {
			return c.active && c.x === 10 && c.w === 100;
		});
		expect(outerDraw).toBeDefined();
	});

	// ---- Regression guard: nested save/restore correctly snapshots the scissor box ----

	it("nested save/restore restores the outer scissor box after an inner clipRect", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();

		// outer scissor
		renderer.clipRect(10, 10, 100, 100);
		const outer = Int32Array.from(renderer.currentScissor);

		renderer.save();
		// inner scissor — different box
		renderer.clipRect(20, 20, 50, 50);
		expect(renderer.currentScissor[0]).toBe(20);
		expect(renderer.currentScissor[2]).toBe(50);
		renderer.restore();

		// outer scissor must be back in place
		expect(renderer.currentScissor[0]).toBe(outer[0]);
		expect(renderer.currentScissor[1]).toBe(outer[1]);
		expect(renderer.currentScissor[2]).toBe(outer[2]);
		expect(renderer.currentScissor[3]).toBe(outer[3]);

		renderer.restore();
	});

	// ---- Regression guard: AABB ≥ canvas under a non-identity transform
	// disables the scissor (transform-aware fast path).

	it("clipRect whose screen-space AABB covers the canvas disables the scissor", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		// huge scale → the (0..50, 0..50) input rect maps to a screen
		// AABB of (0..1000, 0..1000), well past the 800×600 canvas.
		// The fast path should disable the scissor outright.
		renderer.scale(20, 20);
		renderer.currentScissor[0] = -1; // bust cache so the call is observable

		const calls = captureScissor(() => {
			renderer.clipRect(0, 0, 50, 50);
		});
		renderer.restore();

		// no `gl.scissor` call should have been issued; the scissor
		// state should be off.
		expect(calls.length).toBe(0);
		expect(renderer._scissorActive).toBe(false);
	});

	// ---- Regression guard: primitive draw-mode change inside a clip
	// (TRIANGLES → LINES) forces a `PrimitiveBatcher` flush; that flush
	// must happen under the active scissor.

	it("primitive mode switch (fillRect → strokeLine) inside a clip stays clipped", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		renderer.currentScissor[0] = -1;

		const calls = captureDrawScissors(() => {
			renderer.clipRect(40, 40, 80, 80);
			// fillRect uses TRIANGLES via PrimitiveBatcher.
			renderer.fillRect(40, 40, 80, 80);
			// strokeLine uses LINES via the same batcher — the mode
			// change forces an internal flush. That flush must occur
			// while the (40, 40, 80, 80) scissor is still active.
			renderer.strokeLine(50, 50, 100, 100);
			renderer.flush();
		});
		renderer.restore();

		// At least two draw calls (one TRIANGLES, one LINES). Both must
		// have happened under the (40, 40, 80, 80) scissor.
		const underClip = calls.filter((c) => {
			return c.active && c.x === 40 && c.y === 40 && c.w === 80 && c.h === 80;
		});
		expect(underClip.length).toBeGreaterThanOrEqual(2);
	});

	// ---- Regression guard: batcher swap inside a clip flushes the
	// outgoing batcher under the active scissor (primitive ↔ quad).

	it("alternating fillRect ↔ drawImage inside a clip stays clipped across batcher swaps", () => {
		if (!isWebGL) {
			return;
		}
		// build a 4×4 image source (HTMLCanvasElement) for drawImage.
		const src = document.createElement("canvas");
		src.width = 4;
		src.height = 4;
		const ctx = src.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 4, 4);

		renderer.save();
		renderer.resetTransform();
		renderer.currentScissor[0] = -1;

		const calls = captureDrawScissors(() => {
			renderer.clipRect(60, 60, 120, 120);
			// PrimitiveBatcher
			renderer.fillRect(60, 60, 40, 40);
			// QuadBatcher — swap forces flush of PrimitiveBatcher.
			renderer.drawImage(src, 80, 80);
			// back to PrimitiveBatcher — swap forces flush of QuadBatcher.
			renderer.fillRect(100, 100, 40, 40);
			renderer.flush();
		});
		renderer.restore();

		// every captured draw must have happened under the active clip.
		expect(calls.length).toBeGreaterThanOrEqual(2);
		for (const c of calls) {
			expect(c.active).toBe(true);
			expect(c.x).toBe(60);
			expect(c.y).toBe(60);
			expect(c.w).toBe(120);
			expect(c.h).toBe(120);
		}
	});

	// ---- Regression guard: pending vertices queued *outside* any clip
	// must drain BEFORE a subsequent `clipRect` activates a new scissor
	// — symmetric to the `restore()` flush-ordering fix.

	it("pre-clip vertices flush under no scissor, post-clip vertices flush under the new scissor", () => {
		if (!isWebGL) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		// ensure scissor is disabled at start.
		if (renderer._scissorActive) {
			renderer.gl.disable(renderer.gl.SCISSOR_TEST);
			renderer._scissorActive = false;
		}
		renderer.currentScissor[0] = -1;

		const calls = captureDrawScissors(() => {
			// 1. fillRect outside any clip — must drain under "no scissor".
			renderer.fillRect(10, 10, 20, 20);
			// 2. clipRect activates a new scissor — pre-clip vertices
			//    must have flushed BEFORE the new gl.scissor() call.
			renderer.clipRect(200, 200, 100, 100);
			// 3. fillRect inside the clip — must flush under (200, 200, 100, 100).
			renderer.fillRect(200, 200, 100, 100);
			renderer.flush();
		});
		renderer.restore();

		// Find the "no-clip" draw (active=false) — this is the pre-clip
		// fillRect, drained by the clipRect's flush.
		const preClip = calls.find((c) => {
			return !c.active;
		});
		expect(preClip).toBeDefined();

		// Find the post-clip draw under the (200, 200, 100, 100) scissor.
		const postClip = calls.find((c) => {
			return (
				c.active && c.x === 200 && c.y === 200 && c.w === 100 && c.h === 100
			);
		});
		expect(postClip).toBeDefined();
	});
});

// ---------------- RenderState.peekScissor (unit) ----------------

describe("RenderState.peekScissor", () => {
	it("returns null on empty stack", () => {
		const rs = new RenderState();
		expect(rs.peekScissor()).toBe(null);
	});

	it("returns null when the saved state had scissor disabled", () => {
		const rs = new RenderState();
		rs.save(false);
		expect(rs.peekScissor()).toBe(null);
	});

	it("returns the saved scissor box (live ref) when scissor was active at save time", () => {
		const rs = new RenderState();
		rs.currentScissor[0] = 11;
		rs.currentScissor[1] = 22;
		rs.currentScissor[2] = 33;
		rs.currentScissor[3] = 44;
		rs.save(true);

		// mutate currentScissor after save — peek must still return
		// the snapshot from the time of `save`.
		rs.currentScissor[0] = 999;

		const peek = rs.peekScissor();
		expect(peek).not.toBe(null);
		expect(peek[0]).toBe(11);
		expect(peek[1]).toBe(22);
		expect(peek[2]).toBe(33);
		expect(peek[3]).toBe(44);
	});

	it("does not mutate the stack (idempotent)", () => {
		const rs = new RenderState();
		rs.currentScissor[0] = 1;
		rs.currentScissor[1] = 2;
		rs.currentScissor[2] = 3;
		rs.currentScissor[3] = 4;
		rs.save(true);
		const depthBefore = rs._stackDepth;
		rs.peekScissor();
		rs.peekScissor();
		expect(rs._stackDepth).toBe(depthBefore);
	});
});

// ---------------- CanvasRenderer ----------------

describe("CanvasRenderer.clipRect (#1349)", () => {
	let renderer;
	let isCanvas;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		renderer = video.renderer;
		isCanvas = renderer instanceof CanvasRenderer;
	});

	afterAll(() => {
		// hand the world back to the default renderer for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	/**
	 * Spy on `context.rect` for the duration of `fn`. Captures both the
	 * raw args and the canvas matrix at call time so tests can assert
	 * the *effective* (post-transform) screen-space rect, regardless of
	 * how the call was decomposed.
	 */
	function captureRectCalls(fn) {
		const ctx = renderer.getContext();
		const orig = ctx.rect.bind(ctx);
		const calls = [];
		ctx.rect = function (x, y, w, h) {
			const m = ctx.getTransform();
			calls.push({
				args: { x, y, w, h },
				transform: { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f },
			});
			return orig(x, y, w, h);
		};
		try {
			fn();
		} finally {
			ctx.rect = orig;
		}
		return calls;
	}

	/**
	 * Map the raw rect args + matrix-at-call-time into the effective
	 * top-left screen-space coords (x, y). Useful for asserting the
	 * final clip position regardless of which fix approach is taken.
	 */
	function effectiveScreenXY(call) {
		const { args, transform } = call;
		return {
			x: args.x * transform.a + args.y * transform.c + transform.e,
			y: args.x * transform.b + args.y * transform.d + transform.f,
		};
	}

	it("clipRect under identity transform: clip path matches the input rect", () => {
		if (!isCanvas) {
			return;
		}
		// reset the scissor cache so the call doesn't get short-circuited
		// by an identical rect from a prior test.
		renderer.currentScissor[0] = -1;
		const calls = captureRectCalls(() => {
			renderer.clipRect(100, 100, 50, 60);
		});

		expect(calls.length).toBe(1);
		expect(calls[0].args).toEqual({ x: 100, y: 100, w: 50, h: 60 });
		const screen = effectiveScreenXY(calls[0]);
		expect(screen.x).toBe(100);
		expect(screen.y).toBe(100);
	});

	it("clipRect under a translated transform: clip lands at translated screen rect", () => {
		if (!isCanvas) {
			return;
		}
		renderer.save();
		renderer.resetTransform();
		renderer.translate(50, 30);
		// reset cache
		renderer.currentScissor[0] = -1;

		const calls = captureRectCalls(() => {
			renderer.clipRect(200, 200, 100, 100);
		});
		renderer.restore();

		expect(calls.length).toBe(1);
		// Canvas's `context.rect` operates in the current matrix. With
		// translate(50, 30), the input local rect (200, 200) lives at
		// screen (250, 230). This is the API contract; the spec tests
		// *just* this baseline so the integration-level bug below is
		// unambiguous.
		const screen = effectiveScreenXY(calls[0]);
		expect(screen.x).toBe(250);
		expect(screen.y).toBe(230);
	});

	it("Bug #1349 (fixed): Container nested in a translated wrapper produces a correctly-placed clip path", () => {
		if (!isCanvas) {
			return;
		}
		// reproducer mirrors the WebGL Bug #1 test above, and the visual
		// demo in the Clipping example. Same Container shapes, same
		// expected screen rect (280, 80, 180, 160), same root cause:
		// `Container.draw` passes world-space `bounds.left/top` to a
		// matrix-local API that already has the wrapper's translate baked
		// in.
		const wrapper = new Container(280, 80, 180, 160);
		wrapper.clipping = false;
		const inner = new Container(0, 0, 180, 160);
		inner.clipping = true;
		wrapper.addChild(inner);
		inner.inViewport = true;

		renderer.save();
		renderer.resetTransform();
		// reset cache so the call doesn't get short-circuited.
		renderer.currentScissor[0] = -1;
		let calls;
		try {
			wrapper.preDraw(renderer);
			calls = captureRectCalls(() => {
				wrapper.draw(renderer, { isDefault: true });
			});
			wrapper.postDraw(renderer);
		} finally {
			renderer.restore();
		}

		// inner clip's args are 180×160 — unique among the rect calls
		// driven by the draw walk.
		const innerCall = calls.find((c) => {
			return c.args.w === 180 && c.args.h === 160;
		});
		expect(innerCall).toBeDefined();

		// Effective screen rect should be (280, 80) — matching the
		// inner container's world position.
		const screen = effectiveScreenXY(innerCall);
		expect(screen.x).toBe(280);
		expect(screen.y).toBe(80);
	});
});
