/**
 * Lifecycle leak stress tests for `@melonjs/matter-adapter`.
 *
 * Counterpart to `builtin-adapter-stress.spec.js`. Pins the invariant
 * that internal maps (`bodyMap`, `renderableMap`, `velocityLimits`,
 * `defMap`, `bodyGravityScale`, `posOffsets`) and the
 * `_matterListeners` array return to their initial sizes after N
 * add/remove cycles or init→destroy→init cycles.
 *
 * Past bugs this guards against:
 *  - matter event listeners not unregistered on destroy
 *  - posOffsets not cleared on destroy
 *  - body maps growing across updateShape (remove + add)
 */

import * as Matter from "matter-js";
import { boot, Rect, Renderable, video, World } from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

const STRESS_CYCLES = 100;

// MatterAdapter's internal maps are `private readonly` for type safety —
// poke through the private shield only for leak observation.
type InternalsView = {
	bodyMap: Map<unknown, unknown>;
	renderableMap: Map<unknown, unknown>;
	velocityLimits: Map<unknown, unknown>;
	defMap: Map<unknown, unknown>;
	bodyGravityScale: Map<unknown, unknown>;
	posOffsets: Map<unknown, unknown>;
	_matterListeners: Array<unknown>;
};

const internals = (adapter: MatterAdapter): InternalsView =>
	adapter as unknown as InternalsView;

const snapshot = (adapter: MatterAdapter) => {
	const i = internals(adapter);
	return {
		bodyMap: i.bodyMap.size,
		renderableMap: i.renderableMap.size,
		velocityLimits: i.velocityLimits.size,
		defMap: i.defMap.size,
		bodyGravityScale: i.bodyGravityScale.size,
		posOffsets: i.posOffsets.size,
		matterListeners: i._matterListeners.length,
		matterBodies: Matter.Composite.allBodies(adapter.engine.world).length,
	};
};

describe("MatterAdapter — lifecycle leak stress", () => {
	let world: World;
	let adapter: MatterAdapter;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
	});

	beforeEach(() => {
		adapter = new MatterAdapter({ gravity: { x: 0, y: 1 } });
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

	it("addBody with gravityScale: bodyGravityScale drains on removeBody", () => {
		for (let i = 0; i < STRESS_CYCLES; i++) {
			const r = new Renderable(i, i, 32, 32);
			adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				gravityScale: 0.5,
			});
			adapter.removeBody(r);
		}
		expect(internals(adapter).bodyGravityScale.size).toEqual(0);
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

	// Regression: matter event listeners used to leak across destroy →
	// re-init cycles, doubling dispatch counts each round. Guard the
	// invariant that destroy+init returns _matterListeners to its
	// post-first-init size.
	it("init → destroy → init x10: _matterListeners count stays bounded", () => {
		const expectedListenerCount = internals(adapter)._matterListeners.length;
		for (let i = 0; i < 10; i++) {
			const w = adapter.world;
			adapter.destroy();
			adapter.init(w);
			expect(internals(adapter)._matterListeners.length).toEqual(
				expectedListenerCount,
			);
		}
	});

	// Regression: destroy() must clear posOffsets, otherwise stale
	// renderable→offset mappings accumulate across re-inits.
	it("addBody → destroy clears posOffsets", () => {
		const r = new Renderable(0, 0, 32, 32);
		adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
		});
		expect(internals(adapter).posOffsets.size).toEqual(1);
		adapter.destroy();
		expect(internals(adapter).posOffsets.size).toEqual(0);
	});

	// Regression: updateShape replaces the body via removeBody + addBody.
	// If the old maps weren't drained, every shape change would leak one
	// stale entry per internal map.
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
		// also confirm the underlying matter engine isn't accumulating
		// stale body references.
		expect(afterN.matterBodies).toEqual(1);
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
			for (const r of bag) {
				world.removeChildNow(r, true);
			}
			expect(internals(adapter).bodyMap.size).toEqual(0);
		}
		expect(snapshot(adapter)).toEqual(before);
	});
});
