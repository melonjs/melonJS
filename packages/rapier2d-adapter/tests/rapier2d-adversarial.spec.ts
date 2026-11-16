/**
 * The Rapier 2D adapter under the cases meant to break it: bodies removed in
 * the middle of a collision dispatch, steps that are not a number, speed caps
 * that are not one, a renderable with no body or with two, an adapter used
 * after it is destroyed, and the sign of a zero normal.
 */

import {
	Application,
	boot,
	Ellipse,
	Point,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RapierAdapter } from "../src/index";

const FRAME_MS = 1000 / 60;

type XY = { x: number; y: number };
type Response = { a: Renderable; b: Renderable; normal: XY; depth: number };
type ShapeContact = {
	normal: XY;
	overlapN: XY;
	overlapV: XY;
	depth: number;
};
type Hooked = Renderable & {
	onCollisionStart?: (r: Response, other: Renderable) => void;
	onCollisionActive?: (r: Response, other: Renderable) => void;
	onCollisionEnd?: (r: Response, other: Renderable) => void;
	onShapeCollisionStart?: (c: ShapeContact, other: Renderable) => void;
	onShapeCollisionEnd?: (c: ShapeContact, other: Renderable) => void;
};
type Body = RapierAdapter.Body;
/** the adapter's own records, to check none is left behind */
type Internals = {
	activePairs: Map<string, [number, number]>;
	colliderMap: Map<number, unknown>;
	velocityLimits: Map<Renderable, unknown>;
	bodyMap: Map<Renderable, unknown>;
};

/**
 * a zero, not a negative zero, on both axes
 * @param v - the vector that should be zero
 */
const expectPositiveZero = (v: XY | undefined) => {
	expect(v).toEqual({ x: 0, y: 0 });
	expect(Object.is(v?.x, 0)).toBe(true);
	expect(Object.is(v?.y, 0)).toBe(true);
};

describe("RapierAdapter, adversarially", () => {
	let adapter: RapierAdapter;
	let world: World;

	beforeAll(async () => {
		await RapierAdapter.load();
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new RapierAdapter();
		world = new World(0, 0, 800, 600, adapter);
	});

	const internals = () => {
		return adapter as unknown as Internals;
	};
	// anchored at its top-left corner, so `pos` is the corner of its body
	const make = (
		x: number,
		y: number,
		w: number,
		h: number,
		def: Renderable["bodyDef"],
	): Hooked => {
		const r = new Renderable(x, y, w, h) as Hooked;
		r.anchorPoint.set(0, 0);
		r.alwaysUpdate = true;
		r.bodyDef = def;
		world.addChild(r);
		return r;
	};
	const box = (x: number, y: number, extra = {}) => {
		return make(x, y, 32, 32, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32)],
			...extra,
		});
	};
	const run = (frames: number) => {
		for (let i = 0; i < frames; i++) {
			world.update(FRAME_MS);
		}
	};
	const bodyOf = (r: Renderable) => {
		return r.body as Body;
	};

	describe("bodies removed in the middle of a dispatch", () => {
		// two boxes overlapping from the first step, with every hook recorded
		const touching = () => {
			const a = box(100, 100, { gravityScale: 0 });
			const b = box(120, 100, { gravityScale: 0 });
			const seen: string[] = [];
			for (const [name, r] of [
				["a", a],
				["b", b],
			] as const) {
				r.onShapeCollisionStart = () => {
					seen.push(`${name}.shapeStart`);
				};
				r.onCollisionStart = () => {
					seen.push(`${name}.start`);
				};
				r.onCollisionActive = () => {
					seen.push(`${name}.active`);
				};
				r.onShapeCollisionEnd = () => {
					seen.push(`${name}.shapeEnd`);
				};
				r.onCollisionEnd = () => {
					seen.push(`${name}.end`);
				};
			}
			return { a, b, seen };
		};
		const of = (seen: string[], name: string) => {
			return seen.filter((s) => {
				return s.startsWith(`${name}.`);
			});
		};
		const count = (events: string[], event: string) => {
			return events.filter((e) => {
				return e === event;
			}).length;
		};
		// every end follows its own start, and nothing follows the end
		const expectBalanced = (events: string[], name: string) => {
			for (const [start, end] of [
				["shapeStart", "shapeEnd"],
				["start", "end"],
			]) {
				const starts = count(events, `${name}.${start}`);
				const ends = count(events, `${name}.${end}`);
				expect(ends).toBeLessThanOrEqual(starts);
				if (ends > 0) {
					expect(events.indexOf(`${name}.${end}`)).toBeGreaterThan(
						events.indexOf(`${name}.${start}`),
					);
				}
			}
			if (events.includes(`${name}.end`)) {
				expect(events.at(-1)).toBe(`${name}.end`);
			}
		};
		const expectNoStalePair = () => {
			for (const [h1, h2] of internals().activePairs.values()) {
				expect(internals().colliderMap.has(h1)).toBe(true);
				expect(internals().colliderMap.has(h2)).toBe(true);
			}
		};

		// which of the pair Rapier names first decides who hears first, so
		// each case runs with either one doing the removing
		for (const remover of ["a", "b"] as const) {
			const partner = remover === "a" ? "b" : "a";

			it(`one that removes itself in its start hook (${remover}): the other hears the start, then the end, once`, () => {
				const pair = touching();
				const { seen } = pair;
				const self = pair[remover];
				self.onCollisionStart = () => {
					seen.push(`${remover}.start`);
					world.removeChildNow(self);
				};
				run(1);
				expectNoStalePair();
				expect(internals().activePairs.size).toBe(0);
				run(3);
				expect(of(seen, partner)).toEqual([
					`${partner}.shapeStart`,
					`${partner}.start`,
					`${partner}.shapeEnd`,
					`${partner}.end`,
				]);
				// and so does the one that left
				expect(of(seen, remover)).toEqual([
					`${remover}.shapeStart`,
					`${remover}.start`,
					`${remover}.shapeEnd`,
					`${remover}.end`,
				]);
				expect(adapter.world.bodies.len()).toBe(1);
			});

			it(`one that removes the other in its start hook (${remover}): neither hears an end before a start`, () => {
				const pair = touching();
				const { seen } = pair;
				const other = pair[partner];
				pair[remover].onCollisionStart = () => {
					seen.push(`${remover}.start`);
					world.removeChildNow(other);
				};
				run(4);
				expectBalanced(of(seen, "a"), "a");
				expectBalanced(of(seen, "b"), "b");
				expect(of(seen, remover)).toContain(`${remover}.end`);
				expect(seen).not.toContain("a.active");
				expect(seen).not.toContain("b.active");
				expect(internals().activePairs.size).toBe(0);
			});

			it(`one that removes itself while the contact is active (${remover}): the other hears the end last, once`, () => {
				const pair = touching();
				const { seen } = pair;
				const self = pair[remover];
				let frames = 0;
				self.onCollisionActive = () => {
					seen.push(`${remover}.active`);
					if (++frames === 3) {
						world.removeChildNow(self);
					}
				};
				run(8);
				const heard = of(seen, partner);
				expectBalanced(heard, partner);
				expect(heard.at(-1)).toBe(`${partner}.end`);
				expect(count(heard, `${partner}.end`)).toBe(1);
				expect(count(heard, `${partner}.active`)).toBe(3);
			});

			it(`one removed in a shape-level hook (${remover})`, () => {
				const pair = touching();
				const { seen } = pair;
				const other = pair[partner];
				pair[remover].onShapeCollisionStart = () => {
					seen.push(`${remover}.shapeStart`);
					world.removeChildNow(other);
				};
				expect(() => {
					run(4);
				}).not.toThrow();
				expectBalanced(of(seen, "a"), "a");
				expectBalanced(of(seen, "b"), "b");
				expect(internals().activePairs.size).toBe(0);
			});

			it(`a body taken out with adapter.removeBody (${remover}), its renderable still in the world, hears its own end`, () => {
				const pair = touching();
				const { seen } = pair;
				const self = pair[remover];
				self.onCollisionStart = () => {
					seen.push(`${remover}.start`);
					adapter.removeBody(self);
				};
				run(3);
				expect(of(seen, remover)).toEqual([
					`${remover}.shapeStart`,
					`${remover}.start`,
					`${remover}.shapeEnd`,
					`${remover}.end`,
				]);
				expectBalanced(of(seen, partner), partner);
				expect(of(seen, partner)).toContain(`${partner}.end`);
			});
		}

		it("one that removes itself again in its partner's end hook is taken out once", () => {
			const { a, b, seen } = touching();
			a.onCollisionStart = () => {
				seen.push("a.start");
				world.removeChildNow(a);
			};
			b.onCollisionEnd = () => {
				seen.push("b.end");
				adapter.removeBody(a);
			};
			expect(() => {
				run(3);
			}).not.toThrow();
			expect(adapter.world.bodies.len()).toBe(1);
			expect(internals().bodyMap.size).toBe(1);
		});

		it("three touching, one removed by the first hook: no pair is left that names a collider long gone", () => {
			const a = box(100, 100, { gravityScale: 0 });
			const b = box(120, 100, { gravityScale: 0 });
			const c = box(80, 100, { gravityScale: 0 });
			const heard = new Map<Renderable, string[]>();
			let removed = false;
			for (const r of [a, b, c]) {
				heard.set(r, []);
				r.onCollisionStart = (_r, other) => {
					heard.get(r)?.push(other === a ? "start a" : "start");
					if (!removed) {
						removed = true;
						world.removeChildNow(a);
					}
				};
				r.onCollisionEnd = (_r, other) => {
					heard.get(r)?.push(other === a ? "end a" : "end");
				};
				r.onCollisionActive = (_r, other) => {
					expect(other).not.toBe(a);
				};
			}
			run(1);
			expectNoStalePair();
			run(3);
			expectNoStalePair();
			for (const r of [b, c]) {
				const events = heard.get(r) as string[];
				// whoever heard of a touching it heard of it leaving, after
				const start = events.indexOf("start a");
				const end = events.indexOf("end a");
				expect(end >= 0).toBe(start >= 0);
				expect(end >= start).toBe(true);
			}
		});

		it("both removed by one hook, and the world goes on", () => {
			const { a, b, seen } = touching();
			const bystander = box(400, 100, { gravityScale: 0 });
			for (const [name, r] of [
				["a", a],
				["b", b],
			] as const) {
				r.onCollisionStart = () => {
					seen.push(`${name}.start`);
					world.removeChildNow(b);
					world.removeChildNow(a);
				};
			}
			adapter.setVelocity(bystander, new Vector2d(60, 0));
			expect(() => {
				run(60);
			}).not.toThrow();
			expect(seen).not.toContain("a.active");
			// whoever heard the start heard the end, after it
			for (const name of ["a", "b"]) {
				expectBalanced(of(seen, name), name);
				expect(seen.includes(`${name}.end`)).toBe(
					seen.includes(`${name}.start`),
				);
			}
			expect(adapter.world.bodies.len()).toBe(1);
			expect(bystander.pos.x).toBeCloseTo(460, 0);
			expect(internals().activePairs.size).toBe(0);
			expect(internals().colliderMap.size).toBe(1);
		});
	});

	describe("the sign of a zero normal", () => {
		it("an end carries a zero normal, not a negative zero, on both sides", () => {
			const ground = make(0, 300, 800, 40, {
				type: "static",
				shapes: [new Rect(0, 0, 800, 40)],
			});
			const b = box(400, 250, { fixedRotation: true });
			const ends = new Map<Renderable, Response>();
			const shapeEnds = new Map<Renderable, ShapeContact>();
			for (const r of [ground, b]) {
				r.onCollisionEnd = (response) => {
					ends.set(r, response);
				};
				r.onShapeCollisionEnd = (contact) => {
					shapeEnds.set(r, contact);
				};
			}
			run(30);
			adapter.setPosition(b, new Vector2d(400, -500));
			adapter.setVelocity(b, new Vector2d(0, 0));
			run(3);
			for (const r of [ground, b]) {
				expectPositiveZero(ends.get(r)?.normal);
				expect(ends.get(r)?.depth).toBe(0);
				expectPositiveZero(shapeEnds.get(r)?.normal);
				expectPositiveZero(shapeEnds.get(r)?.overlapN);
				expectPositiveZero(shapeEnds.get(r)?.overlapV);
			}
		});

		it("a sensor contact carries a zero normal, not a negative zero, on both sides", () => {
			const zone = make(300, 200, 200, 40, {
				type: "static",
				isSensor: true,
				shapes: [new Rect(0, 0, 200, 40)],
			});
			const b = box(400, 100);
			const starts = new Map<Renderable, Response>();
			const shapeStarts = new Map<Renderable, ShapeContact>();
			for (const r of [zone, b]) {
				r.onCollisionStart = (response) => {
					starts.set(r, response);
				};
				r.onShapeCollisionStart = (contact) => {
					shapeStarts.set(r, contact);
				};
			}
			run(120);
			for (const r of [zone, b]) {
				expectPositiveZero(starts.get(r)?.normal);
				expect(starts.get(r)?.depth).toBe(0);
				expectPositiveZero(shapeStarts.get(r)?.normal);
				expectPositiveZero(shapeStarts.get(r)?.overlapN);
				expectPositiveZero(shapeStarts.get(r)?.overlapV);
			}
			// it stops nothing
			expect(b.pos.y).toBeGreaterThan(400);
		});
	});

	describe("inputs that are not numbers", () => {
		it("a step of no length, a negative one, NaN or Infinity simulates nothing and breaks nothing", () => {
			const b = box(100, 100);
			for (const dt of [0, -FRAME_MS, Number.NaN, Infinity, -Infinity]) {
				expect(() => {
					adapter.step(dt);
					adapter.syncFromPhysics();
				}).not.toThrow();
				expect(b.pos.y).toBe(100);
				expect(adapter.getVelocity(b).y).toBe(0);
			}
			// and the body falls as before
			run(60);
			expect(b.pos.y).toBeGreaterThan(250);
		});

		it("a cap that is not a number caps nothing; a negative one caps by its size; the definition's is copied", () => {
			const limit = { x: 50, y: 50 };
			const b = box(100, 100, { gravityScale: 0, maxVelocity: limit });
			limit.x = 1;
			adapter.getMaxVelocity(b).y = 1;
			adapter.setVelocity(b, new Vector2d(400, 400));
			run(1);
			expect(adapter.getVelocity(b).x).toBeCloseTo(50, 3);
			expect(adapter.getVelocity(b).y).toBeCloseTo(50, 3);
			adapter.setMaxVelocity(b, { x: Number.NaN, y: -20 });
			adapter.setVelocity(b, new Vector2d(400, 400));
			run(1);
			const v = adapter.getVelocity(b);
			expect(v.x).toBeCloseTo(400, 2);
			expect(v.y).toBeCloseTo(20, 3);
			// a body at rest stays at rest under a negative cap
			adapter.setVelocity(b, new Vector2d(0, 0));
			run(1);
			expect(adapter.getVelocity(b).y).toBeCloseTo(0, 6);
			adapter.setVelocity(b, new Vector2d(0, -400));
			run(1);
			expect(adapter.getVelocity(b).y).toBeCloseTo(-20, 3);
		});
	});

	describe("a renderable with no body", () => {
		it("setMaxVelocity keeps its cap for the body to come, without holding on to the renderable", () => {
			const loose = new Renderable(10, 20, 1, 1);
			expect(() => {
				adapter.setMaxVelocity(loose, { x: 1, y: 1 });
			}).not.toThrow();
			expect(adapter.getMaxVelocity(loose)).toEqual({ x: 1, y: 1 });
			// not in the map of live caps, which holds its renderables
			expect(internals().velocityLimits.size).toBe(0);
		});
	});

	describe("a body made twice", () => {
		it("a second addBody replaces the first, which is freed", () => {
			const r = box(100, 100, { gravityScale: 0 });
			const first = bodyOf(r);
			const second = adapter.addBody(r, {
				type: "dynamic",
				shapes: [new Ellipse(16, 16, 16, 16)],
			});
			expect(second).not.toBe(first);
			expect(first.isValid()).toBe(false);
			expect(r.body).toBe(second);
			expect(adapter.world.bodies.len()).toBe(1);
			expect(adapter.world.colliders.len()).toBe(1);
			expect(internals().colliderMap.size).toBe(1);
			expect(internals().bodyMap.size).toBe(1);
		});

		it("an addBody that is refused leaves the body the renderable had, and no other", () => {
			const r = box(100, 100, { gravityScale: 0 });
			const first = bodyOf(r);
			expect(() => {
				adapter.addBody(r, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 8, 8), new Point(0, 0) as never],
				});
			}).toThrow(/unsupported shape type/);
			expect(first.isValid()).toBe(true);
			expect(r.body).toBe(first);
			expect(adapter.world.bodies.len()).toBe(1);
			expect(adapter.world.colliders.len()).toBe(1);
		});
	});

	describe("destroyed", () => {
		it("raycast and queryAABB find nothing, rather than throw", () => {
			box(100, 100);
			run(1);
			adapter.destroy();
			expect(
				adapter.raycast(new Vector2d(0, 116), new Vector2d(800, 116)),
			).toBeNull();
			expect(adapter.queryAABB(new Rect(0, 0, 800, 600))).toEqual([]);
		});
	});
});
