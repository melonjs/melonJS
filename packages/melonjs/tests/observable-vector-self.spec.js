/**
 * Every mutating method of ObservableVector2d / ObservableVector3d returns the
 * observable vector itself and fires its callback once, with the whole result.
 *
 * `negateSelf`, `floorSelf`, `ceilSelf` and `clampSelf` (and, on the 3D one,
 * `normalize` and `perp`) forwarded to the wrapped vector inside the proxy.
 * That returned the INTERNAL proxied vector rather than `this`, so chaining
 * off the result (`pos.floorSelf().add(v)`) wrote to a plain vector the
 * observable no longer watched through its own API, and identity checks
 * failed. And the wrapped vector writes its components one at a time, each
 * write firing the callback: two (three) callbacks per call, the first one
 * seeing a half-updated vector, which is exactly what a renderable's
 * `pos` callback (bounds update) must not see.
 *
 * They now all go through `set()`, which writes every component and then
 * fires once. And a pooled `clone()` without a callback used to keep the
 * callback of whoever released that vector: the pool's reset only replaced
 * it when one was given.
 */
import { describe, expect, it } from "vitest";
import { ObservableVector2d, ObservableVector3d } from "../src/index.js";
import { observableVector2dPool } from "../src/math/observableVector2d.ts";
import { observableVector3dPool } from "../src/math/observableVector3d.ts";
import { Vector2d } from "../src/math/vector2d.ts";
import { Vector3d } from "../src/math/vector3d.ts";

// a vector whose callback records every call and what it saw
const observed2d = (x, y) => {
	const calls = [];
	const v = new ObservableVector2d(x, y, () => {
		calls.push([v.x, v.y]);
	});
	return { v, calls };
};
const observed3d = (x, y, z) => {
	const calls = [];
	const v = new ObservableVector3d(x, y, z, () => {
		calls.push([v.x, v.y, v.z]);
	});
	return { v, calls };
};

// [name, call, expected result] — run on a vector starting at (2.5, -3.5)
const methods2d = [
	[
		"negateSelf",
		(v) => {
			return v.negateSelf();
		},
		[-2.5, 3.5],
	],
	[
		"floorSelf",
		(v) => {
			return v.floorSelf();
		},
		[2, -4],
	],
	[
		"ceilSelf",
		(v) => {
			return v.ceilSelf();
		},
		[3, -3],
	],
	[
		"clampSelf",
		(v) => {
			return v.clampSelf(-1, 1);
		},
		[1, -1],
	],
	[
		"set",
		(v) => {
			return v.set(1, 2);
		},
		[1, 2],
	],
	[
		"setZero",
		(v) => {
			return v.setZero();
		},
		[0, 0],
	],
	[
		"setV",
		(v) => {
			return v.setV(new Vector2d(4, 5));
		},
		[4, 5],
	],
	[
		"copy",
		(v) => {
			return v.copy(new Vector2d(4, 5));
		},
		[4, 5],
	],
	[
		"add",
		(v) => {
			return v.add(new Vector2d(1, 1));
		},
		[3.5, -2.5],
	],
	[
		"sub",
		(v) => {
			return v.sub(new Vector2d(1, 1));
		},
		[1.5, -4.5],
	],
	[
		"scale",
		(v) => {
			return v.scale(2);
		},
		[5, -7],
	],
	[
		"scaleV",
		(v) => {
			return v.scaleV(new Vector2d(2, 3));
		},
		[5, -10.5],
	],
	[
		"div",
		(v) => {
			return v.div(0.5);
		},
		[5, -7],
	],
	[
		"abs",
		(v) => {
			return v.abs();
		},
		[2.5, 3.5],
	],
	[
		"minV",
		(v) => {
			return v.minV(new Vector2d(0, 0));
		},
		[0, -3.5],
	],
	[
		"maxV",
		(v) => {
			return v.maxV(new Vector2d(0, 0));
		},
		[2.5, 0],
	],
	[
		"toIso",
		(v) => {
			return v.toIso();
		},
		[6, -0.5],
	],
	[
		"to2d",
		(v) => {
			return v.to2d();
		},
		[-2.25, -4.75],
	],
	[
		"perp",
		(v) => {
			return v.perp();
		},
		[-3.5, -2.5],
	],
	[
		"rotate",
		(v) => {
			return v.rotate(Math.PI);
		},
		[-2.5, 3.5],
	],
	[
		"lerp",
		(v) => {
			return v.lerp(new Vector2d(4.5, -1.5), 0.5);
		},
		[3.5, -2.5],
	],
	[
		"damp",
		(v) => {
			return v.damp(new Vector2d(2.5, -3.5), 10, 1);
		},
		[2.5, -3.5],
	],
	[
		"moveTowards",
		(v) => {
			return v.moveTowards(new Vector2d(2.5, 0.5), 10);
		},
		[2.5, 0.5],
	],
	// melonJS scales THIS by the ratio (see obsvervableVector2d.spec.ts)
	[
		"project",
		(v) => {
			return v.project(new Vector2d(2, 0));
		},
		[3.125, -4.375],
	],
	[
		"projectN",
		(v) => {
			return v.projectN(new Vector2d(0, 1));
		},
		[-8.75, 12.25],
	],
];

// [name, call, expected result] — run on a vector starting at (2.5, -3.5, 1.5)
const methods3d = [
	[
		"negateSelf",
		(v) => {
			return v.negateSelf();
		},
		[-2.5, 3.5, -1.5],
	],
	[
		"floorSelf",
		(v) => {
			return v.floorSelf();
		},
		[2, -4, 1],
	],
	[
		"ceilSelf",
		(v) => {
			return v.ceilSelf();
		},
		[3, -3, 2],
	],
	[
		"clampSelf",
		(v) => {
			return v.clampSelf(-1, 1);
		},
		[1, -1, 1],
	],
	[
		"perp",
		(v) => {
			return v.perp();
		},
		[-3.5, -2.5, 1.5],
	],
	[
		"set",
		(v) => {
			return v.set(1, 2, 3);
		},
		[1, 2, 3],
	],
	[
		"setZero",
		(v) => {
			return v.setZero();
		},
		[0, 0, 0],
	],
	[
		"setV",
		(v) => {
			return v.setV(new Vector3d(4, 5, 6));
		},
		[4, 5, 6],
	],
	[
		"copy",
		(v) => {
			return v.copy(new Vector3d(4, 5, 6));
		},
		[4, 5, 6],
	],
	[
		"add",
		(v) => {
			return v.add(new Vector3d(1, 1, 1));
		},
		[3.5, -2.5, 2.5],
	],
	[
		"sub",
		(v) => {
			return v.sub(new Vector3d(1, 1, 1));
		},
		[1.5, -4.5, 0.5],
	],
	[
		"scale",
		(v) => {
			return v.scale(2, 2, 2);
		},
		[5, -7, 3],
	],
	[
		"scaleV",
		(v) => {
			return v.scaleV(new Vector3d(2, 3, 4));
		},
		[5, -10.5, 6],
	],
	[
		"div",
		(v) => {
			return v.div(0.5);
		},
		[5, -7, 3],
	],
	[
		"abs",
		(v) => {
			return v.abs();
		},
		[2.5, 3.5, 1.5],
	],
	[
		"minV",
		(v) => {
			return v.minV(new Vector3d(0, 0, 0));
		},
		[0, -3.5, 0],
	],
	[
		"maxV",
		(v) => {
			return v.maxV(new Vector3d(0, 0, 0));
		},
		[2.5, 0, 1.5],
	],
	[
		"toIso",
		(v) => {
			return v.toIso();
		},
		[6, -0.5, 1.5],
	],
	[
		"to2d",
		(v) => {
			return v.to2d();
		},
		[-2.25, -4.75, 1.5],
	],
	[
		"rotate",
		(v) => {
			return v.rotate(Math.PI);
		},
		[-2.5, 3.5, 1.5],
	],
	[
		"cross",
		(v) => {
			return v.cross(new Vector3d(0, 0, 1));
		},
		[-3.5, -2.5, 0],
	],
	[
		"lerp",
		(v) => {
			return v.lerp(new Vector3d(4.5, -1.5, 3.5), 0.5);
		},
		[3.5, -2.5, 2.5],
	],
	[
		"damp",
		(v) => {
			return v.damp(new Vector3d(2.5, -3.5, 1.5), 10, 1);
		},
		[2.5, -3.5, 1.5],
	],
	[
		"moveTowards",
		(v) => {
			return v.moveTowards(new Vector3d(2.5, 0.5, 1.5), 10);
		},
		[2.5, 0.5, 1.5],
	],
	[
		"project",
		(v) => {
			return v.project(new Vector3d(2, 0, 0));
		},
		[3.125, -4.375, 1.875],
	],
	[
		"projectN",
		(v) => {
			return v.projectN(new Vector3d(0, 1, 0));
		},
		[-8.75, 12.25, -5.25],
	],
];

describe("ObservableVector2d : mutating methods", () => {
	for (const [name, call, expected] of methods2d) {
		it(`${name} returns this, fires once, with the whole result`, () => {
			const { v, calls } = observed2d(2.5, -3.5);
			expect(call(v)).toBe(v);
			expect(v.x).toBeCloseTo(expected[0], 10);
			expect(v.y).toBeCloseTo(expected[1], 10);
			expect(calls.length).toBe(1);
			expect(calls[0][0]).toBeCloseTo(expected[0], 10);
			expect(calls[0][1]).toBeCloseTo(expected[1], 10);
		});
	}

	it("normalize returns this and fires once with a unit vector", () => {
		const { v, calls } = observed2d(3, -4);
		expect(v.normalize()).toBe(v);
		expect(calls).toEqual([[0.6, -0.8]]);
	});

	it("slerp returns this and fires once", () => {
		const { v, calls } = observed2d(1, 0);
		expect(v.slerp(new Vector2d(0, 1), 1)).toBe(v);
		expect(calls.length).toBe(1);
		expect(calls[0][0]).toBeCloseTo(0, 10);
		expect(calls[0][1]).toBeCloseTo(1, 10);
	});

	it("chaining off a *Self result keeps notifying the observer", () => {
		const { v, calls } = observed2d(2.5, -3.5);
		v.floorSelf().add(new Vector2d(1, 1)).negateSelf().ceilSelf();
		expect([v.x, v.y]).toEqual([-3, 3]);
		expect(calls.length).toBe(4);
		expect(calls[3]).toEqual([-3, 3]);
	});

	it("the allocating forms still return a new plain vector and do not fire", () => {
		const { v, calls } = observed2d(2.5, -3.5);
		for (const out of [v.negate(), v.floor(), v.ceil(), v.clamp(-1, 1)]) {
			expect(out).toBeInstanceOf(Vector2d);
			expect(out).not.toBe(v);
		}
		expect(calls.length).toBe(0);
		expect([v.x, v.y]).toEqual([2.5, -3.5]);
	});
});

describe("ObservableVector3d : mutating methods", () => {
	for (const [name, call, expected] of methods3d) {
		it(`${name} returns this, fires once, with the whole result`, () => {
			const { v, calls } = observed3d(2.5, -3.5, 1.5);
			expect(call(v)).toBe(v);
			for (let i = 0; i < 3; i++) {
				expect([v.x, v.y, v.z][i]).toBeCloseTo(expected[i], 10);
			}
			expect(calls.length).toBe(1);
			for (let i = 0; i < 3; i++) {
				expect(calls[0][i]).toBeCloseTo(expected[i], 10);
			}
		});
	}

	it("normalize returns this and fires once with a unit vector", () => {
		const { v, calls } = observed3d(0, 3, -4);
		expect(v.normalize()).toBe(v);
		expect(calls.length).toBe(1);
		expect(calls[0][0]).toBeCloseTo(0, 10);
		expect(calls[0][1]).toBeCloseTo(0.6, 10);
		expect(calls[0][2]).toBeCloseTo(-0.8, 10);
	});

	it("normalize leaves a zero vector at zero", () => {
		const { v } = observed3d(0, 0, 0);
		v.normalize();
		expect([v.x, v.y, v.z]).toEqual([0, 0, 0]);
	});

	it("slerp returns this and fires once", () => {
		const { v, calls } = observed3d(1, 0, 0);
		expect(v.slerp(new Vector3d(0, 0, 1), 1)).toBe(v);
		expect(calls.length).toBe(1);
		expect(calls[0][2]).toBeCloseTo(1, 10);
	});

	it("the allocating forms still return a new plain vector and do not fire", () => {
		const { v, calls } = observed3d(2.5, -3.5, 1.5);
		for (const out of [v.negate(), v.floor(), v.ceil(), v.clamp(-1, 1)]) {
			expect(out).toBeInstanceOf(Vector3d);
			expect(out).not.toBe(v);
		}
		expect(calls.length).toBe(0);
		expect([v.x, v.y, v.z]).toEqual([2.5, -3.5, 1.5]);
	});
});

describe("Observable vector pools : clone() callbacks", () => {
	it("a pooled 2D clone() without a callback does not call the previous owner's", () => {
		let staleCalls = 0;
		const src = new ObservableVector2d(1, 2);
		const first = src.clone(() => {
			staleCalls++;
		});
		observableVector2dPool.release(first);
		const second = src.clone();
		expect(second).toBe(first); // the recycled instance
		second.x = 10;
		second.set(3, 4);
		expect(staleCalls).toBe(0);
		expect([second.x, second.y]).toEqual([3, 4]);
		observableVector2dPool.release(second);
	});

	it("a pooled 3D clone() without a callback does not call the previous owner's", () => {
		let staleCalls = 0;
		const src = new ObservableVector3d(1, 2, 3);
		const first = src.clone(() => {
			staleCalls++;
		});
		observableVector3dPool.release(first);
		const second = src.clone();
		expect(second).toBe(first);
		second.z = 10;
		second.set(3, 4, 5);
		expect(staleCalls).toBe(0);
		observableVector3dPool.release(second);
	});

	it("a pooled clone() with a callback gets that callback, and not on the reset", () => {
		let oldCalls = 0;
		let newCalls = 0;
		const src = new ObservableVector2d(1, 2);
		const first = src.clone(() => {
			oldCalls++;
		});
		observableVector2dPool.release(first);
		const second = src.clone(() => {
			newCalls++;
		});
		expect(newCalls).toBe(0); // the reset itself is muted
		expect([second.x, second.y]).toEqual([1, 2]);
		second.x = 5;
		expect(oldCalls).toBe(0);
		expect(newCalls).toBe(1);
		observableVector2dPool.release(second);
	});

	it("setCallback(undefined) removes the callback", () => {
		let calls = 0;
		const v = new ObservableVector2d(0, 0, () => {
			calls++;
		});
		v.setCallback(undefined);
		v.set(1, 1);
		expect(calls).toBe(0);
	});
});
