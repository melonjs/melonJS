/**
 * Lifecycle leak stress tests for `@melonjs/planck-adapter`.
 *
 * Counterpart to `matter-adapter-stress.spec.ts`. Pins the invariant
 * that internal maps (`bodyMap`, `renderableMap`, `velocityLimits`,
 * `defMap`, `posOffsets`) return to their initial sizes after N
 * add/remove cycles or init→destroy→init cycles, and that the
 * underlying `planck.World` body count tracks them.
 *
 * Past bugs this guards against:
 *  - bodyMap / renderableMap not drained on removeBody
 *  - posOffsets not cleared on destroy
 *  - body maps growing across updateShape (remove + add)
 *  - planck bodies left in the world after the adapter loses track
 */

import { boot, Rect, Renderable, video, World } from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const STRESS_CYCLES = 100;

// PlanckAdapter's internal maps are `private readonly` for type safety —
// poke through the private shield only for leak observation.
type InternalsView = {
	bodyMap: Map<unknown, unknown>;
	renderableMap: Map<unknown, unknown>;
	velocityLimits: Map<unknown, unknown>;
	defMap: Map<unknown, unknown>;
	posOffsets: Map<unknown, unknown>;
};

const internals = (adapter: PlanckAdapter): InternalsView =>
	adapter as unknown as InternalsView;

// Count bodies the planck world is actively simulating — direct
// passthrough to planck's native `getBodyCount()`.
const planckBodyCount = (adapter: PlanckAdapter): number =>
	adapter.world.getBodyCount();

const snapshot = (adapter: PlanckAdapter) => {
	const i = internals(adapter);
	return {
		bodyMap: i.bodyMap.size,
		renderableMap: i.renderableMap.size,
		velocityLimits: i.velocityLimits.size,
		defMap: i.defMap.size,
		posOffsets: i.posOffsets.size,
		planckBodies: planckBodyCount(adapter),
	};
};

describe("PlanckAdapter — lifecycle leak stress", () => {
	let world: World;
	let adapter: PlanckAdapter;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		adapter = new PlanckAdapter({ gravity: { x: 0, y: 1 } });
		world = new World(0, 0, 800, 600, adapter);
	});

	it("addBody/removeBody x100: every internal map returns to zero", () => {
		const before = snapshot(adapter);
		for (let i = 0; i < STRESS_CYCLES; i++) {
			const r = new Renderable(i, i, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			});
			adapter.removeBody(r);
		}
		expect(snapshot(adapter)).toEqual(before);
	});

	it("addBody with maxVelocity: velocityLimits drains on removeBody", () => {
		for (let i = 0; i < STRESS_CYCLES; i++) {
			const r = new Renderable(i, i, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				maxVelocity: { x: 5, y: 10 },
			});
			adapter.removeBody(r);
		}
		expect(internals(adapter).velocityLimits.size).toEqual(0);
	});

	it("addChild/removeChildNow via world x100: no leak", () => {
		const before = snapshot(adapter);
		for (let i = 0; i < STRESS_CYCLES; i++) {
			const r = new Renderable(i, i, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
			};
			world.addChild(r);
			world.removeChildNow(r, true);
		}
		expect(snapshot(adapter)).toEqual(before);
	});

	// Regression: destroy() must clear every internal map, otherwise
	// stale renderable→body mappings accumulate across re-inits.
	it("addBody → destroy clears every map", () => {
		const r = new Renderable(0, 0, 32, 32);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		expect(internals(adapter).bodyMap.size).toEqual(1);
		expect(internals(adapter).renderableMap.size).toEqual(1);
		expect(internals(adapter).defMap.size).toEqual(1);
		expect(internals(adapter).posOffsets.size).toEqual(1);
		expect(planckBodyCount(adapter)).toEqual(1);
		adapter.destroy();
		expect(internals(adapter).bodyMap.size).toEqual(0);
		expect(internals(adapter).renderableMap.size).toEqual(0);
		expect(internals(adapter).defMap.size).toEqual(0);
		expect(internals(adapter).posOffsets.size).toEqual(0);
		expect(planckBodyCount(adapter)).toEqual(0);
	});

	// Regression: init() after destroy() must restore a usable world,
	// not double-register listeners on the previous world. Planck's
	// `init` creates a fresh `planck.World` instance per call so
	// listeners don't accumulate, but the bookkeeping maps need to
	// stay clean across cycles too.
	it("init → destroy → init x10: maps stay at zero after each cycle", () => {
		for (let i = 0; i < 10; i++) {
			const w = adapter.melonWorld;
			adapter.destroy();
			adapter.init(w);
			expect(internals(adapter).bodyMap.size).toEqual(0);
			expect(internals(adapter).renderableMap.size).toEqual(0);
			expect(internals(adapter).defMap.size).toEqual(0);
			expect(internals(adapter).posOffsets.size).toEqual(0);
			expect(planckBodyCount(adapter)).toEqual(0);
		}
	});

	// Regression: updateShape replaces the body via removeBody + addBody.
	// If the old maps weren't drained, every shape change would leak one
	// stale entry per internal map. Also verify the planck world doesn't
	// accumulate orphan body instances.
	it("updateShape x100 on the same renderable: maps stay at size 1", () => {
		const r = new Renderable(0, 0, 32, 32);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		const after1 = snapshot(adapter);
		for (let i = 0; i < STRESS_CYCLES; i++) {
			const size = 16 + (i % 16);
			adapter.updateShape(r, [new Rect(0, 0, size, size)]);
		}
		const afterN = snapshot(adapter);
		expect(afterN).toEqual(after1);
		expect(afterN.planckBodies).toEqual(1);
	});

	it("addChild/removeChildNow alternating: high-water + zero parity", () => {
		const before = snapshot(adapter);
		for (let sweep = 0; sweep < 3; sweep++) {
			const bag: Renderable[] = [];
			for (let i = 0; i < 50; i++) {
				const r = new Renderable(i * 10, 0, 16, 16);
				r.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 16, 16)],
				};
				world.addChild(r);
				bag.push(r);
			}
			expect(internals(adapter).bodyMap.size).toEqual(50);
			expect(planckBodyCount(adapter)).toEqual(50);
			for (const r of bag) {
				world.removeChildNow(r, true);
			}
			expect(internals(adapter).bodyMap.size).toEqual(0);
			expect(planckBodyCount(adapter)).toEqual(0);
		}
		expect(snapshot(adapter)).toEqual(before);
	});
});
