/**
 * The built-in body's rotation pivot honours the renderable's `anchorPoint`.
 *
 * The bug: `Body#_syncAngleTransform` (run by `setAngle()` and by angular
 * integration) pivoted `currentTransform` on `body.bounds.center`, a point
 * measured from the top-left corner of the renderable's DRAWN frame. But
 * `currentTransform` is applied about `pos`, before the drawn frame is
 * shifted by `-size * anchorPoint` (see `Renderable#preDraw` and
 * `updateBounds`). So for anything not anchored at its top-left corner the
 * pivot was off by the anchor offset: a centre-anchored 40x40 renderable at
 * (100, 50) rotated about its bottom-right corner, (120, 70), and after a
 * quarter turn its bounds were centred on (140, 50) instead of staying put.
 *
 * The fix takes the anchor offset off the bounds centre, so a body turns
 * about the centre of its shapes wherever the anchor is.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	Body,
	BuiltinAdapter,
	boot,
	Rect,
	Renderable,
	video,
	World,
} from "../src/index.js";

describe("Body : rotation pivots on the shapes' centre, whatever the anchor", () => {
	let app;
	let adapter;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		adapter = new BuiltinAdapter();
		// eslint-disable-next-line no-new
		new World(0, 0, 800, 600, adapter);
	});

	const make = (anchorX, anchorY, shape) => {
		const r = new Renderable(100, 50, 40, 40);
		r.anchorPoint.set(anchorX, anchorY);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [shape ?? new Rect(0, 0, 40, 40)],
		});
		return r;
	};

	const centreOf = (r) => {
		r.updateBounds();
		const b = r.getBounds();
		return [b.centerX, b.centerY];
	};

	const anchors = [
		["top-left (0, 0)", 0, 0],
		["centre (0.5, 0.5), the default", 0.5, 0.5],
		["bottom-centre (0.5, 1), a platformer actor", 0.5, 1],
		["bottom-right (1, 1)", 1, 1],
	];

	for (const [name, ax, ay] of anchors) {
		describe(`anchor ${name}`, () => {
			for (const angle of [Math.PI / 2, Math.PI / 4, Math.PI, -0.3]) {
				it(`setAngle(${angle.toFixed(3)}) leaves the bounds centred where they were`, () => {
					const r = make(ax, ay);
					const [cx, cy] = centreOf(r);
					// the drawn frame is pos - size * anchor
					expect(cx).toBeCloseTo(100 - 40 * ax + 20, 4);
					expect(cy).toBeCloseTo(50 - 40 * ay + 20, 4);
					r.body.setAngle(angle);
					const [rx, ry] = centreOf(r);
					expect(rx).toBeCloseTo(cx, 4);
					expect(ry).toBeCloseTo(cy, 4);
				});
			}

			it("spinning through integration keeps the centre fixed", () => {
				const r = make(ax, ay);
				const [cx, cy] = centreOf(r);
				r.body.gravityScale = 0;
				r.body.setAngularVelocity(0.37);
				for (let i = 0; i < 25; i++) {
					r.body.update();
					const [rx, ry] = centreOf(r);
					expect(rx).toBeCloseTo(cx, 4);
					expect(ry).toBeCloseTo(cy, 4);
				}
			});
		});
	}

	it("the repro: a default-anchored 40x40 at (100, 50) turned a quarter stays on (100, 50)", () => {
		const r = new Renderable(100, 50, 40, 40);
		r.body = new Body(r, new Rect(0, 0, 40, 40));
		r.body.setAngle(Math.PI / 2);
		r.updateBounds();
		expect(r.getBounds().centerX).toBeCloseTo(100, 4);
		expect(r.getBounds().centerY).toBeCloseTo(50, 4);
	});

	it("an off-centre shape still turns about its own centre (centre anchor)", () => {
		// a 10x10 hitbox in the top-left quarter of the 40x40 frame: its
		// centre is (5, 5) in the frame, (85, 35) in the world
		const r = make(0.5, 0.5, new Rect(0, 0, 10, 10));
		r.body.setAngle(Math.PI / 2);
		// the point of the drawn frame under the shape's centre must not move
		// under the transform: map it the way preDraw does
		const t = r.currentTransform;
		const local = { x: 5 - 20, y: 5 - 20 };
		const v = t.apply({ x: local.x, y: local.y });
		expect(v.x).toBeCloseTo(local.x, 4);
		expect(v.y).toBeCloseTo(local.y, 4);
	});

	it("a renderable that clears applyAnchorTransform pivots on the raw bounds centre", () => {
		const r = make(0.5, 0.5);
		r.applyAnchorTransform = false;
		r.body.setAngle(Math.PI / 2);
		const t = r.currentTransform;
		// such a renderable is drawn at pos with no anchor shift, so the
		// shapes' centre (20, 20) is the fixed point
		const v = t.apply({ x: 20, y: 20 });
		expect(v.x).toBeCloseTo(20, 4);
		expect(v.y).toBeCloseTo(20, 4);
	});
});
