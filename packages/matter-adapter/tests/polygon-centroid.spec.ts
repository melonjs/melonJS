/**
 * Where a polygon body actually ends up.
 *
 * `Matter.Bodies.fromVertices` places the polygon's AREA CENTROID at the
 * position it is handed, so that position has to be the centroid for the
 * vertices to land where they were authored. The adapter used to hand it the
 * arithmetic mean of the points instead, which shifted every polygon by
 * `mean - centroid`.
 *
 * The difference is exactly zero for a rectangle and for any triangle, so
 * symmetric fixtures cannot see this at all. It grows with how unevenly the
 * vertices are spread, which makes a traced outline from a shape editor the
 * worst case: such a tool puts vertices densely along curves and sparsely
 * along straights. The visible symptom is collision geometry sitting off the
 * artwork it was drawn on.
 */

import {
	Application,
	boot,
	Polygon,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

/**
 * `Polygon` takes a tuple of at least three points. The engine's own
 * `PolygonVertices` is not exported from the package root, so it is spelled
 * out here rather than asserted away with `any`.
 */
type PolygonPoints = [Vector2d, Vector2d, Vector2d, ...Vector2d[]];

describe("MatterAdapter — a polygon lands where it was authored", () => {
	let world: World;
	let adapter: MatterAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new MatterAdapter({ gravity: { x: 0, y: 0 } });
		world = new World(0, 0, 800, 600, adapter);
	});

	/**
	 * @param points - the polygon outline, in renderable-local coordinates
	 * @returns the renderable carrying the body
	 */
	const polygonBody = (points: PolygonPoints) => {
		const r = new Renderable(100, 100, 220, 220);
		r.anchorPoint.set(0, 0);
		world.addChild(r);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Polygon(0, 0, points)],
		});
		return r;
	};

	/**
	 * @param r - the renderable to read back
	 * @returns the axis-aligned extent of every shape the adapter reports
	 */
	const extent = (r: Renderable) => {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const shape of adapter.getBodyShapes(r)) {
			for (const p of (shape as Polygon).points) {
				const x = p.x + (shape as Polygon).pos.x;
				const y = p.y + (shape as Polygon).pos.y;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		return { minX, minY, maxX, maxY };
	};

	it("keeps an irregular convex polygon on its authored vertices", () => {
		// a lopsided quad: mean and centroid are ~8px apart
		const points: PolygonPoints = [
			new Vector2d(10, 0),
			new Vector2d(190, 40),
			new Vector2d(150, 260),
			new Vector2d(40, 200),
		];
		const r = polygonBody(points);
		const got = extent(r);

		expect(got.minX).toBeCloseTo(10, 6);
		expect(got.minY).toBeCloseTo(0, 6);
		expect(got.maxX).toBeCloseTo(190, 6);
		expect(got.maxY).toBeCloseTo(260, 6);
	});

	it("keeps a traced outline on its authored vertices", () => {
		// the shape-editor case: vertices crowded along a curve, then one
		// lone point far away. Mean and centroid are ~39px apart here.
		const arc: Vector2d[] = [];
		for (let a = 0; a <= Math.PI; a += Math.PI / 24) {
			arc.push(new Vector2d(100 + 100 * Math.cos(a), 100 - 60 * Math.sin(a)));
		}
		arc.push(new Vector2d(-60, 190));
		const points = arc as PolygonPoints;

		const r = polygonBody(points);
		const got = extent(r);

		// a concave outline is reported as its hull, which has the same
		// axis-aligned extent as the outline itself
		expect(got.minX).toBeCloseTo(-60, 6);
		expect(got.minY).toBeCloseTo(40, 6);
		expect(got.maxX).toBeCloseTo(200, 6);
		expect(got.maxY).toBeCloseTo(190, 6);
	});
});
