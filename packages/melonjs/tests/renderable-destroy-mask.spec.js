import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Color,
	Ellipse,
	Line,
	Polygon,
	Rect,
	Renderable,
	RoundRect,
	Vector2d,
} from "../src/index.js";

/**
 * Destroying a renderable that carries a mask.
 *
 * `destroy()` used to hand the mask to the legacy object pool, which throws
 * for any class never registered with it — and no geometry class ever is, so
 * this threw for EVERY type `mask` is documented to accept. It also failed
 * destructively: the bounds had already gone back to `boundsPool` by then, so
 * the throw left them recycled, skipped the tint release below it, and escaped
 * into whatever was tearing the scene down.
 *
 * A mask is game-owned, so it is simply dropped now rather than recycled: the
 * same instance may still be masking another renderable.
 */
describe("Renderable#destroy with a mask", () => {
	beforeAll(() => {
		boot();
	});

	/** every type the `mask` property documents */
	const masks = () => {
		return [
			["Rect", new Rect(0, 0, 16, 16)],
			["RoundRect", new RoundRect(0, 0, 16, 16, 4)],
			[
				"Polygon",
				new Polygon(0, 0, [
					new Vector2d(0, 0),
					new Vector2d(8, 0),
					new Vector2d(8, 8),
				]),
			],
			["Line", new Line(0, 0, [new Vector2d(0, 0), new Vector2d(8, 0)])],
			["Ellipse", new Ellipse(0, 0, 16, 16)],
		];
	};

	it("does not throw for any documented mask type", () => {
		for (const [name, mask] of masks()) {
			const r = new Renderable(0, 0, 32, 32);
			r.mask = mask;
			expect(() => {
				return r.destroy();
			}, `${name} mask`).not.toThrow();
		}
	});

	it("runs destroy to completion instead of aborting partway", () => {
		// the tint release sits AFTER the mask in `destroy()`, so it is the
		// evidence that the teardown got past the mask rather than throwing
		const r = new Renderable(0, 0, 32, 32);
		r.tint = new Color(255, 0, 0);
		r.mask = new Rect(0, 0, 16, 16);
		r.destroy();

		expect(r.mask).toBeUndefined();
		expect(r._tint).toBeUndefined();
		expect(r._bounds).toBeUndefined();
	});

	it("leaves the mask instance usable, since the game still owns it", () => {
		// two renderables masked by ONE shape: destroying the first must not
		// recycle a shape the second is still using
		const shared = new Rect(0, 0, 16, 16);
		const a = new Renderable(0, 0, 32, 32);
		const b = new Renderable(0, 0, 32, 32);
		a.mask = shared;
		b.mask = shared;

		a.destroy();

		expect(b.mask).toBe(shared);
		expect(shared.width).toBe(16);
		expect(shared.height).toBe(16);
		b.destroy();
	});

	it("still destroys cleanly with no mask at all", () => {
		const r = new Renderable(0, 0, 32, 32);
		expect(() => {
			return r.destroy();
		}).not.toThrow();
	});
});
