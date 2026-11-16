/**
 * The cases meant to break an adapter, on every rigid-body adapter: bodies
 * removed in the middle of a collision dispatch, steps that are not a number,
 * speed caps that are not one, a renderable with no body or with two, an
 * adapter used after it is destroyed, and the sign of a zero in a normal.
 * Lives in this package because it is the one with every adapter available.
 */

import { MatterAdapter } from "@melonjs/matter-adapter";
import { RapierAdapter } from "@melonjs/rapier2d-adapter";
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
import { beforeAll, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const FRAME_MS = 1000 / 60;

type XY = { x: number; y: number };
type AnyAdapter = MatterAdapter | PlanckAdapter | RapierAdapter;
type Response = { normal: XY; depth: number };
type ShapeContact = { normal: XY; overlapN: XY; overlapV: XY };
type Hooked = Renderable & {
	onCollisionStart?: (r: Response, other: Renderable) => void;
	onCollisionActive?: (r: Response, other: Renderable) => void;
	onCollisionEnd?: (r: Response, other: Renderable) => void;
	onShapeCollisionStart?: (c: ShapeContact, other: Renderable) => void;
	onShapeCollisionEnd?: (c: ShapeContact, other: Renderable) => void;
};

interface Backend {
	name: string;
	make(): AnyAdapter;
	/** how many bodies the adapter's engine holds */
	bodyCount(adapter: AnyAdapter): number;
	/** a speed, in this adapter's velocity unit, that gravity 0 keeps */
	speed: number;
	/** whether the shape-level hooks of a pair fire before its own */
	shapeHooksFirst: boolean;
}

const BACKENDS: Backend[] = [
	{
		name: "matter",
		make: () => {
			return new MatterAdapter();
		},
		bodyCount: (adapter) => {
			const matter = adapter as MatterAdapter;
			return matter.matter.Composite.allBodies(matter.engine.world).length;
		},
		// pixels per step
		speed: 3,
		shapeHooksFirst: false,
	},
	{
		name: "planck",
		make: () => {
			return new PlanckAdapter();
		},
		bodyCount: (adapter) => {
			return (adapter as PlanckAdapter).world.getBodyCount();
		},
		// pixels per second
		speed: 180,
		shapeHooksFirst: true,
	},
	{
		name: "rapier",
		// Rapier is loaded in `beforeAll`, so the constructor can be used
		make: () => {
			return new RapierAdapter();
		},
		bodyCount: (adapter) => {
			return (adapter as RapierAdapter).world.bodies.len();
		},
		speed: 180,
		shapeHooksFirst: true,
	},
];

/**
 * a normal with no negative zero in it
 * @param v - the normal
 */
const expectNoNegativeZero = (v: XY | undefined) => {
	expect(v).toBeDefined();
	expect(Object.is(v?.x, -0)).toBe(false);
	expect(Object.is(v?.y, -0)).toBe(false);
};

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

for (const backend of BACKENDS) {
	describe(`${backend.name}, adversarially`, () => {
		let adapter: AnyAdapter;
		let world: World;
		const fresh = () => {
			adapter = backend.make();
			world = new World(0, 0, 800, 600, adapter);
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

		describe("bodies removed in the middle of a dispatch", () => {
			// two boxes overlapping from the first step, with every hook recorded
			const touching = () => {
				fresh();
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
			// one renderable's hooks at one level: the pair's or the shapes'
			const level = (seen: string[], name: string, shape: boolean) => {
				return seen.filter((s) => {
					return s.startsWith(`${name}.`) && s.includes("shape") === shape;
				});
			};
			const count = (events: string[], event: string) => {
				return events.filter((e) => {
					return e === event;
				}).length;
			};
			// at each level: at most one end, after the start, and nothing after it
			const expectBalanced = (seen: string[], name: string) => {
				for (const [shape, start, end] of [
					[true, "shapeStart", "shapeEnd"],
					[false, "start", "end"],
				] as const) {
					const events = level(seen, name, shape);
					const ends = count(events, `${name}.${end}`);
					expect(ends).toBeLessThanOrEqual(count(events, `${name}.${start}`));
					expect(ends).toBeLessThanOrEqual(1);
					if (ends > 0) {
						expect(events.indexOf(`${name}.${end}`)).toBeGreaterThan(
							events.indexOf(`${name}.${start}`),
						);
						expect(events.at(-1)).toBe(`${name}.${end}`);
					}
				}
			};

			// which of the pair the engine names first decides who hears
			// first, so each case runs with either one doing the removing
			for (const remover of ["a", "b"] as const) {
				const partner = remover === "a" ? "b" : "a";

				it(`one that removes itself in its start hook (${remover}): both hear the start, then the end, once`, () => {
					const pair = touching();
					const self = pair[remover];
					self.onCollisionStart = () => {
						pair.seen.push(`${remover}.start`);
						world.removeChildNow(self);
					};
					run(4);
					for (const name of [remover, partner]) {
						expect(level(pair.seen, name, false)).toEqual([
							`${name}.start`,
							`${name}.end`,
						]);
						// where the shape-level hooks fire after the pair's, the
						// one that left in its pair-level start hears neither
						expect(level(pair.seen, name, true)).toEqual(
							name === remover && !backend.shapeHooksFirst
								? []
								: [`${name}.shapeStart`, `${name}.shapeEnd`],
						);
					}
					expect(backend.bodyCount(adapter)).toBe(1);
				});

				it(`one that removes the other in its start hook (${remover}): no end before a start`, () => {
					const pair = touching();
					const other = pair[partner];
					pair[remover].onCollisionStart = () => {
						pair.seen.push(`${remover}.start`);
						world.removeChildNow(other);
					};
					run(4);
					expectBalanced(pair.seen, "a");
					expectBalanced(pair.seen, "b");
					expect(level(pair.seen, remover, false)).toEqual([
						`${remover}.start`,
						`${remover}.end`,
					]);
					expect(pair.seen).not.toContain("a.active");
					expect(pair.seen).not.toContain("b.active");
				});

				it(`one that removes itself while the contact is active (${remover}): the other hears the end last, once`, () => {
					const pair = touching();
					const self = pair[remover];
					let frames = 0;
					self.onCollisionActive = () => {
						pair.seen.push(`${remover}.active`);
						if (++frames === 3) {
							world.removeChildNow(self);
						}
					};
					run(8);
					const heard = level(pair.seen, partner, false);
					expectBalanced(pair.seen, partner);
					expect(heard.at(-1)).toBe(`${partner}.end`);
					expect(count(heard, `${partner}.end`)).toBe(1);
					expect(count(heard, `${partner}.active`)).toBe(3);
				});

				it(`one removed in a shape-level hook (${remover})`, () => {
					const pair = touching();
					const other = pair[partner];
					pair[remover].onShapeCollisionStart = () => {
						pair.seen.push(`${remover}.shapeStart`);
						world.removeChildNow(other);
					};
					expect(() => {
						run(4);
					}).not.toThrow();
					expectBalanced(pair.seen, "a");
					expectBalanced(pair.seen, "b");
				});
			}

			it("one removed again from its partner's end hook is taken out once", () => {
				const { a, b } = touching();
				a.onCollisionStart = () => {
					world.removeChildNow(a);
				};
				b.onCollisionEnd = () => {
					adapter.removeBody(a);
				};
				expect(() => {
					run(3);
				}).not.toThrow();
				expect(backend.bodyCount(adapter)).toBe(1);
			});

			it("three touching, one removed by the first hook: whoever heard it arrive hears it leave", () => {
				fresh();
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
				}
				run(4);
				for (const r of [b, c]) {
					const events = heard.get(r) as string[];
					const start = events.indexOf("start a");
					const end = events.indexOf("end a");
					expect(end >= 0).toBe(start >= 0);
					expect(end >= start).toBe(true);
				}
			});
		});

		describe("inputs that are not numbers", () => {
			it("a step of no length, a negative one, NaN or Infinity simulates nothing and breaks nothing", () => {
				fresh();
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
				expect(b.pos.y).toBeGreaterThan(110);
			});

			it("a cap that is not a number caps nothing; a negative one caps by its size", () => {
				fresh();
				const b = box(100, 100, { gravityScale: 0 });
				const { speed } = backend;
				adapter.setMaxVelocity(b, { x: Number.NaN, y: -speed / 4 });
				adapter.setVelocity(b, new Vector2d(speed, speed));
				run(1);
				const v = adapter.getVelocity(b);
				expect(v.x).toBeCloseTo(speed, 1);
				expect(v.y).toBeCloseTo(speed / 4, 3);
				// a body at rest stays at rest under a negative cap
				adapter.setVelocity(b, new Vector2d(0, 0));
				run(1);
				expect(adapter.getVelocity(b).y).toBeCloseTo(0, 6);
			});
		});

		describe("a renderable with no body, or with two", () => {
			// a renderable with a body definition, not yet in the world
			const unadded = (extra = {}) => {
				const r = new Renderable(100, 100, 32, 32) as Hooked;
				r.anchorPoint.set(0, 0);
				r.alwaysUpdate = true;
				r.bodyDef = {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					gravityScale: 0,
					...extra,
				};
				return r;
			};
			const speedAfterOneFrame = (r: Renderable) => {
				adapter.setVelocity(r, new Vector2d(backend.speed, 0));
				run(1);
				return adapter.getVelocity(r).x;
			};

			it("a cap set before the body is built applies once it is", () => {
				fresh();
				const r = unadded();
				const cap = { x: backend.speed / 4, y: backend.speed / 4 };
				adapter.setMaxVelocity(r, cap);
				// read back as set, and copied
				cap.x = 1;
				expect(adapter.getMaxVelocity(r).x).toBe(backend.speed / 4);
				world.addChild(r);
				expect(speedAfterOneFrame(r)).toBeCloseTo(backend.speed / 4, 3);
			});

			it("the body definition's own cap wins over one set before the body was built", () => {
				fresh();
				const r = unadded({
					maxVelocity: { x: backend.speed / 2, y: backend.speed / 2 },
				});
				adapter.setMaxVelocity(r, { x: 1, y: 1 });
				world.addChild(r);
				expect(speedAfterOneFrame(r)).toBeCloseTo(backend.speed / 2, 3);
			});

			it("added again, a renderable has its body definition's cap, not one set on it before", () => {
				fresh();
				const r = unadded();
				adapter.setMaxVelocity(r, { x: backend.speed / 4, y: 1 });
				world.addChild(r);
				world.removeChildNow(r, true);
				world.addChild(r);
				expect(adapter.getMaxVelocity(r)).toEqual({
					x: Infinity,
					y: Infinity,
				});
				expect(speedAfterOneFrame(r)).toBeCloseTo(backend.speed, 1);
			});

			it("a second addBody replaces the first", () => {
				fresh();
				const r = box(100, 100, { gravityScale: 0 });
				const first = r.body;
				const second = adapter.addBody(r, {
					type: "dynamic",
					shapes: [new Ellipse(16, 16, 16, 16)],
				});
				expect(second).not.toBe(first);
				expect(r.body).toBe(second);
				expect(backend.bodyCount(adapter)).toBe(1);
			});

			it("an addBody that is refused leaves the body the renderable had, and no other", () => {
				fresh();
				const r = box(100, 100, { gravityScale: 0 });
				const first = r.body;
				expect(() => {
					adapter.addBody(r, {
						type: "dynamic",
						shapes: [new Rect(0, 0, 8, 8), new Point(0, 0) as never],
					});
				}).toThrow(/unsupported shape type/);
				expect(r.body).toBe(first);
				expect(backend.bodyCount(adapter)).toBe(1);
			});
		});

		describe("destroyed", () => {
			it("raycast and queryAABB find nothing, rather than throw", () => {
				fresh();
				box(100, 100);
				run(1);
				adapter.destroy();
				expect(
					adapter.raycast(new Vector2d(0, 116), new Vector2d(800, 116)),
				).toBeNull();
				expect(adapter.queryAABB(new Rect(0, 0, 800, 600))).toEqual([]);
			});
		});

		describe("no negative zero in a normal", () => {
			it("at the start and the end of a contact, on both sides", () => {
				fresh();
				const ground = make(0, 300, 800, 40, {
					type: "static",
					shapes: [new Rect(0, 0, 800, 40)],
				});
				const b = box(400, 250, { fixedRotation: true });
				const normals: XY[] = [];
				for (const r of [ground, b]) {
					r.onCollisionStart = (response) => {
						normals.push(response.normal);
					};
					r.onCollisionEnd = (response) => {
						normals.push(response.normal);
					};
					r.onShapeCollisionStart = (contact) => {
						normals.push(contact.normal, contact.overlapN, contact.overlapV);
					};
					r.onShapeCollisionEnd = (contact) => {
						normals.push(contact.normal, contact.overlapN, contact.overlapV);
					};
				}
				run(30);
				adapter.setPosition(b, new Vector2d(400, -500));
				adapter.setVelocity(b, new Vector2d(0, 0));
				run(3);
				// a start and an end on each side, at both levels
				expect(normals).toHaveLength(16);
				for (const n of normals) {
					expectNoNegativeZero(n);
				}
			});

			it("in a sensor contact, on both sides", () => {
				fresh();
				const zone = make(300, 200, 200, 40, {
					type: "static",
					isSensor: true,
					shapes: [new Rect(0, 0, 200, 40)],
				});
				const b = box(400, 100);
				const normals: XY[] = [];
				for (const r of [zone, b]) {
					r.onCollisionStart = (response) => {
						normals.push(response.normal);
					};
				}
				run(120);
				expect(normals).toHaveLength(2);
				for (const n of normals) {
					expectNoNegativeZero(n);
				}
			});
		});
	});
}
