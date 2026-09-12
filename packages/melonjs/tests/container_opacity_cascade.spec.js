import { beforeAll, describe, expect, it } from "vitest";
import { boot, Color, Container, Renderable } from "../src/index.js";
import CanvasRenderer from "../src/video/canvas/canvas_renderer.js";
import WebGLRenderer from "../src/video/webgl/webgl_renderer.js";

/**
 * Opacity cascades down the container tree.
 *
 * `Renderable#alpha` is applied in `preDraw` by multiplying into the alpha
 * already on the renderer, so fading a container fades everything under it.
 * The machinery that makes this safe is already there and is exercised here
 * too: `preDraw` calls `renderer.save()` and `postDraw` calls
 * `renderer.restore()`, and the render state stacks the tint — so a child
 * cannot leak its own fade onto the sibling drawn after it.
 *
 * This is deliberately NOT `Container.setChildsProperty("alpha", …)`, which
 * writes a value onto each child and is a different feature: it changes the
 * children's own `alpha`, where this composes at draw time and leaves every
 * renderable's own value alone.
 */
describe("opacity cascades through a container tree", () => {
	/**
	 * A renderer stub with the two behaviours that matter: `setTint` copies
	 * the tint (alpha included) then multiplies by the given alpha, and
	 * `save`/`restore` stack the tint. Both mirror `Renderer.setTint` and
	 * `RenderState`.
	 * @returns {object} the stub, plus the alphas it was handed in order
	 */
	function makeRenderer() {
		const seen = [];
		const stack = [];
		return {
			seen,
			currentTint: new Color(255, 255, 255, 1),
			currentColor: new Color(255, 255, 255, 1),
			save() {
				stack.push(this.currentTint.clone());
			},
			restore() {
				const top = stack.pop();
				if (top !== undefined) {
					this.currentTint.copy(top);
				}
			},
			setTint(tint, alpha = tint.alpha) {
				this.currentTint.copy(tint);
				this.currentTint.alpha *= alpha;
				seen.push(Number(this.currentTint.alpha.toFixed(4)));
			},
			clearTint() {
				this.currentTint.setColor(255, 255, 255, 1);
			},
			translate() {},
			transform() {},
			scale() {},
			resetTransform() {},
			setDepth() {},
			setDepthValue() {},
			setBlendMode() {},
			getBlendMode() {
				return "normal";
			},
			setMask() {},
			clearMask() {},
			clipRect() {},
			beginPostEffect() {},
			endPostEffect() {},
			setGlobalAlpha(a) {
				this.currentColor.alpha = a;
			},
			getGlobalAlpha() {
				return this.currentColor.alpha;
			},
			globalAlpha() {
				return this.currentColor.alpha;
			},
		};
	}

	/**
	 * Run one renderable's draw lifecycle.
	 * @param {object} renderer - the stub
	 * @param {object} obj - the renderable
	 * @param {Function} [inner] - what to do between pre and post
	 */
	function drawOne(renderer, obj, inner) {
		obj.preDraw(renderer);
		inner?.();
		obj.postDraw(renderer);
	}

	it("a child of a faded container draws at the container's alpha", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const child = new Renderable(0, 0, 10, 10);
		parent.addChild(child);

		drawOne(renderer, parent, () => {
			drawOne(renderer, child);
		});

		// parent pushed 0.5; the child inherits it rather than replacing it
		expect(renderer.seen).toEqual([0.5, 0.5]);
	});

	it("the child's own alpha multiplies with its parent's", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const child = new Renderable(0, 0, 10, 10);
		child.alpha = 0.5;
		parent.addChild(child);

		drawOne(renderer, parent, () => {
			drawOne(renderer, child);
		});

		expect(renderer.seen).toEqual([0.5, 0.25]);
	});

	it("composes through nesting", () => {
		const renderer = makeRenderer();
		const outer = new Container(0, 0, 100, 100);
		outer.alpha = 0.5;
		const inner = new Container(0, 0, 50, 50);
		inner.alpha = 0.5;
		const leaf = new Renderable(0, 0, 10, 10);
		leaf.alpha = 0.5;
		outer.addChild(inner);
		inner.addChild(leaf);

		drawOne(renderer, outer, () => {
			drawOne(renderer, inner, () => {
				drawOne(renderer, leaf);
			});
		});

		expect(renderer.seen).toEqual([0.5, 0.25, 0.125]);
	});

	it("does not leak one child's fade onto the next", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const faded = new Renderable(0, 0, 10, 10);
		faded.alpha = 0.2;
		const plain = new Renderable(0, 0, 10, 10);
		parent.addChild(faded);
		parent.addChild(plain);

		drawOne(renderer, parent, () => {
			drawOne(renderer, faded);
			drawOne(renderer, plain);
		});

		// the second child sees the PARENT's 0.5, not 0.5 × 0.2
		expect(renderer.seen).toEqual([0.5, 0.1, 0.5]);
	});

	it("restores the parent's alpha once a child is done", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const child = new Renderable(0, 0, 10, 10);
		child.alpha = 0.25;
		parent.addChild(child);

		parent.preDraw(renderer);
		drawOne(renderer, child);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.5, 5);
		parent.postDraw(renderer);
	});

	it("an opaque tree is unchanged — every alpha stays 1", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		const child = new Renderable(0, 0, 10, 10);
		parent.addChild(child);

		drawOne(renderer, parent, () => {
			drawOne(renderer, child);
		});

		expect(renderer.seen).toEqual([1, 1]);
	});

	it("the renderable's own alpha still reaches it with no parent fade", () => {
		const renderer = makeRenderer();
		const solo = new Renderable(0, 0, 10, 10);
		solo.alpha = 0.4;

		drawOne(renderer, solo);

		expect(renderer.seen).toEqual([0.4]);
	});

	it("a tint's own alpha is honoured alongside the cascade", () => {
		const renderer = makeRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const child = new Renderable(0, 0, 10, 10);
		// a tint carrying its own alpha multiplies in as well
		child.tint.setColor(255, 255, 255, 0.5);
		parent.addChild(child);

		drawOne(renderer, parent, () => {
			drawOne(renderer, child);
		});

		expect(renderer.seen).toEqual([0.5, 0.25]);
	});
});

/**
 * The same contract, against a REAL renderer.
 *
 * The suite above drives a stub whose `setTint` / `save` / `restore` mirror
 * the engine's. That proves `preDraw` computes the right argument, but only
 * against a reimplementation — if the stub drifted from
 * `Renderer.setTint`, every test could pass while the engine misbehaved.
 *
 * These run the real `CanvasRenderer`, so the real `setTint` (which copies
 * the tint over `currentTint`, alpha included), the real `RenderState` tint
 * stack, and the real `Color.copy` are all in the loop. `copy()` overwriting
 * alpha is the exact reason the cascade did not work before, so it is the one
 * thing worth exercising for real.
 */
describe("opacity cascades — against a real CanvasRenderer", () => {
	beforeAll(async () => {
		await boot();
	});

	/**
	 * @returns {object} a real renderer, 8x8, off-screen
	 */
	function realRenderer() {
		return new CanvasRenderer({ width: 8, height: 8 });
	}

	it("a child inherits its parent's fade", () => {
		const renderer = realRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const child = new Renderable(0, 0, 10, 10);
		parent.addChild(child);

		parent.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.5, 5);
		child.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.5, 5);
		child.postDraw(renderer);
		parent.postDraw(renderer);

		renderer.destroy?.();
	});

	it("nested fades multiply", () => {
		const renderer = realRenderer();
		const outer = new Container(0, 0, 100, 100);
		outer.alpha = 0.5;
		const inner = new Container(0, 0, 50, 50);
		inner.alpha = 0.5;
		const leaf = new Renderable(0, 0, 10, 10);
		leaf.alpha = 0.5;
		outer.addChild(inner);
		inner.addChild(leaf);

		outer.preDraw(renderer);
		inner.preDraw(renderer);
		leaf.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.125, 5);
		leaf.postDraw(renderer);
		inner.postDraw(renderer);
		outer.postDraw(renderer);

		renderer.destroy?.();
	});

	it("the parent's fade is restored for the next sibling", () => {
		const renderer = realRenderer();
		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const first = new Renderable(0, 0, 10, 10);
		first.alpha = 0.2;
		const second = new Renderable(0, 0, 10, 10);
		parent.addChild(first);
		parent.addChild(second);

		parent.preDraw(renderer);
		first.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.1, 5);
		first.postDraw(renderer);
		// the real RenderState stack has to have put the parent's value back
		second.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.5, 5);
		second.postDraw(renderer);
		parent.postDraw(renderer);

		renderer.destroy?.();
	});

	it("an opaque tree still draws at full alpha", () => {
		const renderer = realRenderer();
		const parent = new Container(0, 0, 100, 100);
		const child = new Renderable(0, 0, 10, 10);
		parent.addChild(child);

		parent.preDraw(renderer);
		child.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(1, 5);
		child.postDraw(renderer);
		parent.postDraw(renderer);

		renderer.destroy?.();
	});
});

/**
 * And on the backend games actually ship on.
 *
 * WebGL keeps its own render state and its own `setGlobalAlpha`, so the
 * cascade is worth walking there rather than inferring it from the Canvas
 * result. This descends a three-deep tree and reads the accumulated alpha at
 * every level, then unwinds it.
 */
describe("opacity cascades — walking the tree on a WebGL renderer", () => {
	beforeAll(async () => {
		await boot();
	});

	it("accumulates going down and unwinds coming back up", (ctx) => {
		let renderer;
		try {
			renderer = new WebGLRenderer({
				width: 8,
				height: 8,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			ctx.skip("WebGL unavailable in this environment");
			return;
		}

		// root 0.8 → mid 0.5 → leaf 0.5, so the leaf lands on 0.2
		const root = new Container(0, 0, 100, 100);
		root.alpha = 0.8;
		const mid = new Container(0, 0, 50, 50);
		mid.alpha = 0.5;
		const leaf = new Renderable(0, 0, 10, 10);
		leaf.alpha = 0.5;
		root.addChild(mid);
		mid.addChild(leaf);

		const alpha = () => {
			return renderer.currentTint.alpha;
		};

		expect(alpha()).toBeCloseTo(1, 5);
		root.preDraw(renderer);
		expect(alpha()).toBeCloseTo(0.8, 5);
		mid.preDraw(renderer);
		expect(alpha()).toBeCloseTo(0.4, 5);
		leaf.preDraw(renderer);
		expect(alpha()).toBeCloseTo(0.2, 5);

		// and back up: each postDraw restores what its parent had
		leaf.postDraw(renderer);
		expect(alpha()).toBeCloseTo(0.4, 5);
		mid.postDraw(renderer);
		expect(alpha()).toBeCloseTo(0.8, 5);
		root.postDraw(renderer);
		expect(alpha()).toBeCloseTo(1, 5);

		renderer.destroy?.();
	});

	it("a second child of the same parent starts from the parent's alpha", (ctx) => {
		let renderer;
		try {
			renderer = new WebGLRenderer({
				width: 8,
				height: 8,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			ctx.skip("WebGL unavailable in this environment");
			return;
		}

		const parent = new Container(0, 0, 100, 100);
		parent.alpha = 0.5;
		const first = new Renderable(0, 0, 10, 10);
		first.alpha = 0.25;
		const second = new Renderable(0, 0, 10, 10);
		second.alpha = 0.25;
		parent.addChild(first);
		parent.addChild(second);

		parent.preDraw(renderer);
		first.preDraw(renderer);
		expect(renderer.currentTint.alpha).toBeCloseTo(0.125, 5);
		first.postDraw(renderer);
		second.preDraw(renderer);
		// 0.125 again, NOT 0.125 × 0.25 — the first child's fade was unwound
		expect(renderer.currentTint.alpha).toBeCloseTo(0.125, 5);
		second.postDraw(renderer);
		parent.postDraw(renderer);

		renderer.destroy?.();
	});
});
