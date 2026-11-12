/**
 * `world.addJoint()` / `world.removeJoint()`, the same on every adapter that
 * has joints (planck and Rapier). On those without (the built-in and matter)
 * the adapter returns `null` and the world throws, naming it. Lives in this
 * package because it is the one with every adapter available.
 *
 * - each joint type does what its definition says, in pixels and radians:
 *   a hinge pins, its limits bound b's angle minus a's, a rope caps the
 *   distance and goes slack, a weld holds the pose the bodies had, a slider
 *   keeps its axis, angle and limits
 * - anchors are in the renderable's own space, whatever its anchorPoint
 * - `collideConnected` decides whether the joined bodies collide
 * - the world removes a joint with either body, and `removeJoint()` is safe
 *   to repeat
 * - `updateShape()` and `world.setAdapter()` rebuild the joints, at the
 *   angle each body had, and the handle game code holds gets the new engine
 *   joint; switching to an adapter without joints drops them, then throws
 * - planck refuses to change its world during a step: a joint made or
 *   removed from a collision handler takes effect when the step ends
 */

import { MatterAdapter } from "@melonjs/matter-adapter";
import { RapierAdapter } from "@melonjs/rapier2d-adapter";
import {
	Application,
	BuiltinAdapter,
	boot,
	type JointDefinition,
	type PhysicsAdapter,
	type PhysicsJoint,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const PPM = 32;
const FRAME_MS = 16;
const GRAVITY = { x: 0, y: 500 };

interface JointBackend {
	name: string;
	make(): PlanckAdapter | RapierAdapter;
	/** how many joints the engine holds */
	jointCount(adapter: PhysicsAdapter): number;
	/** a body's origin, in pixels, and its angle, read from the engine */
	pose(r: Renderable): { x: number; y: number; angle: number };
	/**
	 * how far a fast body may pass a slider limit for a frame, in pixels:
	 * planck allows Box2D's slop, and Rapier's limits are soft, pushing the
	 * body back once it is past
	 */
	limitSlack: number;
}

const JOINT_BACKENDS: JointBackend[] = [
	{
		name: "planck",
		make: () => {
			return new PlanckAdapter({ gravity: GRAVITY });
		},
		jointCount: (adapter) => {
			return (adapter as PlanckAdapter).world.getJointCount();
		},
		pose: (r) => {
			const body = r.body as PlanckAdapter.Body;
			const p = body.getPosition();
			return { x: p.x * PPM, y: p.y * PPM, angle: body.getAngle() };
		},
		limitSlack: 3,
	},
	{
		name: "rapier",
		make: () => {
			return new RapierAdapter({ gravity: GRAVITY });
		},
		jointCount: (adapter) => {
			return (adapter as RapierAdapter).world.impulseJoints.len();
		},
		pose: (r) => {
			const body = r.body as RapierAdapter.Body;
			const t = body.translation();
			return { x: t.x * PPM, y: t.y * PPM, angle: body.rotation() };
		},
		limitSlack: 8,
	},
];

// A renderable anchored at its top-left corner, so `pos` is the corner of
// its body, with one rectangle filling it.
const box = (
	x: number,
	y: number,
	w: number,
	h: number,
	type: "static" | "dynamic",
): Renderable => {
	const r = new Renderable(x, y, w, h);
	r.anchorPoint.set(0, 0);
	r.alwaysUpdate = true;
	r.bodyDef = { type, shapes: [new Rect(0, 0, w, h)] };
	return r;
};

const run = (world: World, frames: number, each?: () => void) => {
	for (let i = 0; i < frames; i++) {
		world.update(FRAME_MS);
		each?.();
	}
};

// where a point given in a box's own space is in the world: the body turns
// about its origin, the centre of its one rectangle
const worldPoint = (
	backend: JointBackend,
	r: Renderable,
	p: { x: number; y: number },
) => {
	const { x, y, angle } = backend.pose(r);
	const dx = p.x - r.width / 2;
	const dy = p.y - r.height / 2;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return { x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos };
};

const distance = (p: { x: number; y: number }, q: { x: number; y: number }) => {
	return Math.hypot(p.x - q.x, p.y - q.y);
};

// a static 16 px hook at (392, 100), its bottom centre at (400, 116), and an
// 8 x 40 link hanging from it by its top centre
const hangingLink = (world: World, extra: Partial<JointDefinition> = {}) => {
	const hook = box(392, 100, 16, 16, "static");
	const link = box(396, 116, 8, 40, "dynamic");
	world.addChild(hook);
	world.addChild(link);
	const joint = world.addJoint({
		type: "hinge",
		a: hook,
		b: link,
		anchorA: { x: 8, y: 16 },
		anchorB: { x: 4, y: 0 },
		...extra,
	});
	return { hook, link, joint };
};

beforeAll(async () => {
	// Rapier's WebAssembly, compiled once for the whole file
	await RapierAdapter.load();
	boot();
	const app = new Application(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
	await app.init();
});

describe.each(JOINT_BACKENDS)("$name: world.addJoint()", (backend) => {
	it("reports joints in its capabilities", () => {
		expect(backend.make().capabilities.constraints).toBe(true);
	});

	it("a hinge pins the two bodies together while they swing", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const { link, joint } = hangingLink(world);
		expect(joint.native).not.toBeNull();
		expect(backend.jointCount(world.adapter)).toBe(1);

		world.adapter.setVelocity(link, new Vector2d(150, 0));
		let gap = 0;
		let swing = 0;
		run(world, 90, () => {
			const top = worldPoint(backend, link, { x: 4, y: 0 });
			gap = Math.max(gap, distance(top, { x: 400, y: 116 }));
			swing = Math.max(swing, Math.abs(backend.pose(link).angle));
		});
		// it swung, about the pin
		expect(swing).toBeGreaterThan(0.3);
		expect(gap).toBeLessThan(1.5);
	});

	it("hinge limits bound b's angle minus a's", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const hook = box(392, 100, 16, 16, "static");
		const link = box(396, 116, 8, 40, "dynamic");
		world.addChild(hook);
		world.addChild(link);
		// turn the hook first: a limit on a's angle minus b's, or on b's own
		// angle, would put the link elsewhere
		world.adapter.setAngle?.(hook, 1);
		world.addJoint({
			type: "hinge",
			a: hook,
			b: link,
			anchorA: { x: 8, y: 8 },
			anchorB: { x: 4, y: 0 },
			limits: { min: 0, max: 0.5 },
		});
		let low = Infinity;
		let high = -Infinity;
		const track = () => {
			const relative = backend.pose(link).angle - backend.pose(hook).angle;
			low = Math.min(low, relative);
			high = Math.max(high, relative);
		};
		// made outside its limits (b's angle minus a's is -1): let it settle
		run(world, 30);
		world.adapter.setAngularVelocity?.(link, 20);
		run(world, 40, track);
		world.adapter.setAngularVelocity?.(link, -20);
		run(world, 40, track);
		expect(low).toBeGreaterThan(-0.06);
		expect(high).toBeLessThan(0.56);
		// pushed both ways, it reached both limits
		expect(low).toBeLessThan(0.06);
		expect(high).toBeGreaterThan(0.44);
	});

	it("a rope stops the bodies at maxLength, and lets them come closer", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		// centres 60 px apart, a 100 px rope between them
		const hook = box(392, 100, 16, 16, "static");
		const ball = box(392, 160, 16, 16, "dynamic");
		world.addChild(hook);
		world.addChild(ball);
		world.addJoint({ type: "rope", a: hook, b: ball, maxLength: 100 });
		const apart = () => {
			return distance(backend.pose(hook), backend.pose(ball));
		};
		let longest = 0;
		run(world, 60, () => {
			longest = Math.max(longest, apart());
		});
		// it fell until the rope went taut, and no further
		expect(longest).toBeLessThan(101.5);
		expect(apart()).toBeGreaterThan(97);

		// thrown back up, nothing holds it apart
		world.adapter.setVelocity(ball, new Vector2d(0, -400));
		let shortest = Infinity;
		run(world, 10, () => {
			shortest = Math.min(shortest, apart());
		});
		expect(shortest).toBeLessThan(90);
	});

	it("a rope's maxLength defaults to the distance when it is made", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const hook = box(392, 100, 16, 16, "static");
		const ball = box(392, 160, 16, 16, "dynamic");
		world.addChild(hook);
		world.addChild(ball);
		world.addJoint({ type: "rope", a: hook, b: ball });
		run(world, 60);
		expect(distance(backend.pose(hook), backend.pose(ball))).toBeLessThan(61.5);
	});

	it("a weld holds the two bodies as they stood when it was made", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const a = box(300, 100, 32, 32, "dynamic");
		const b = box(340, 100, 32, 32, "dynamic");
		world.addChild(a);
		world.addChild(b);
		world.adapter.setAngle?.(b, 0.4);
		world.addJoint({ type: "weld", a, b });
		world.adapter.setAngularVelocity?.(a, 3);
		run(world, 60);
		const pa = backend.pose(a);
		const pb = backend.pose(b);
		// they fell and turned, together
		expect(pa.y).toBeGreaterThan(140);
		expect(Math.abs(pa.angle)).toBeGreaterThan(0.2);
		expect(pb.angle - pa.angle).toBeCloseTo(0.4, 1);
		expect(distance(pa, pb)).toBeGreaterThan(39);
		expect(distance(pa, pb)).toBeLessThan(41);
	});

	it("a slider keeps b on its axis and at its angle, within its limits", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		// centres 100 px apart, on a vertical axis
		const shaft = box(392, 100, 16, 16, "static");
		const cabin = box(384, 200, 32, 16, "dynamic");
		world.addChild(shaft);
		world.addChild(cabin);
		// travel counted from where the cabin starts: 40 to 160 px below the
		// shaft's centre
		world.addJoint({
			type: "slider",
			a: shaft,
			b: cabin,
			axis: { x: 0, y: 1 },
			limits: { min: -60, max: 60 },
		});
		world.adapter.setVelocity(cabin, new Vector2d(300, 0));
		world.adapter.setAngularVelocity?.(cabin, 5);
		let drift = 0;
		let turn = 0;
		let longest = 0;
		let shortest = Infinity;
		const track = () => {
			const p = backend.pose(cabin);
			drift = Math.max(drift, Math.abs(p.x - 400));
			turn = Math.max(turn, Math.abs(p.angle));
			longest = Math.max(longest, p.y - 108);
			shortest = Math.min(shortest, p.y - 108);
		};
		// gravity takes it down to the far limit
		run(world, 90, track);
		expect(longest).toBeGreaterThan(155);
		expect(longest).toBeLessThan(161.5);
		// thrown up, it stops at the near one
		world.adapter.setVelocity(cabin, new Vector2d(0, -1500));
		run(world, 8, track);
		expect(shortest).toBeLessThan(45);
		expect(shortest).toBeGreaterThan(40 - backend.limitSlack);
		// and is back within it a few frames on
		run(world, 3, track);
		expect(backend.pose(cabin).y - 108).toBeGreaterThan(39);
		expect(drift).toBeLessThan(1);
		expect(turn).toBeLessThan(0.02);
	});

	it("anchors are in the renderable's own space, whatever its anchorPoint", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		// both anchored at their centre: the hook spans 390..410 x 90..110,
		// the link 396..404 x 110..150
		const hook = new Renderable(400, 100, 20, 20);
		hook.bodyDef = { type: "static", shapes: [new Rect(0, 0, 20, 20)] };
		const link = new Renderable(400, 130, 8, 40);
		link.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 8, 40)] };
		world.addChild(hook);
		world.addChild(link);
		// the hook's bottom centre and the link's top centre: the same point
		world.addJoint({
			type: "hinge",
			a: hook,
			b: link,
			anchorA: { x: 10, y: 20 },
			anchorB: { x: 4, y: 0 },
		});
		run(world, 30);
		// so it hangs where it was, as placed
		expect(link.pos.x).toBeCloseTo(400, 0);
		expect(link.pos.y).toBeCloseTo(130, 0);
		expect(Math.abs(backend.pose(link).angle)).toBeLessThan(0.02);
	});

	it("collideConnected decides whether the joined bodies collide", () => {
		for (const collideConnected of [false, true]) {
			const world = new World(0, 0, 800, 600, backend.make());
			const floor = box(200, 400, 400, 32, "static");
			const ball = box(392, 350, 16, 16, "dynamic");
			world.addChild(floor);
			world.addChild(ball);
			world.addJoint({
				type: "rope",
				a: floor,
				b: ball,
				maxLength: 1000,
				collideConnected,
			});
			run(world, 120);
			if (collideConnected) {
				// it landed on the floor
				expect(ball.pos.y + 16).toBeGreaterThan(397);
				expect(ball.pos.y + 16).toBeLessThan(403);
			} else {
				// it fell through it
				expect(ball.pos.y).toBeGreaterThan(432);
			}
		}
	});

	it("removeJoint() lets the bodies go, and is safe to repeat", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const { link, joint } = hangingLink(world);
		run(world, 10);
		const held = link.pos.y;
		expect(world.removeJoint(joint)).toBe(world);
		expect(joint.native).toBeNull();
		expect(backend.jointCount(world.adapter)).toBe(0);
		run(world, 30);
		expect(link.pos.y).toBeGreaterThan(held + 20);
		expect(() => {
			world.removeJoint(joint);
		}).not.toThrow();
	});

	it("a body leaving the world takes its joints with it", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const { link, joint } = hangingLink(world);
		world.removeChildNow(link, true);
		expect(backend.jointCount(world.adapter)).toBe(0);
		expect(joint.native).toBeNull();
		expect(() => {
			world.removeJoint(joint);
		}).not.toThrow();
		// coming back, it comes back unjoined
		world.addChild(link);
		expect(backend.jointCount(world.adapter)).toBe(0);
	});

	it("updateShape() rebuilds the body as it stood, and the world its joints", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const { link, joint } = hangingLink(world);
		// swung out, so the body is turned when it is rebuilt
		world.adapter.setVelocity(link, new Vector2d(200, 0));
		run(world, 6);
		const turned = backend.pose(link).angle;
		expect(Math.abs(turned)).toBeGreaterThan(0.2);
		const before = joint.native;
		world.adapter.updateShape?.(link, [new Rect(0, 0, 8, 40)]);
		expect(backend.pose(link).angle).toBeCloseTo(turned, 5);
		expect(joint.native).not.toBeNull();
		expect(joint.native).not.toBe(before);
		expect(backend.jointCount(world.adapter)).toBe(1);
		let gap = 0;
		run(world, 30, () => {
			const top = worldPoint(backend, link, { x: 4, y: 0 });
			gap = Math.max(gap, distance(top, { x: 400, y: 116 }));
		});
		expect(gap).toBeLessThan(1.5);
	});

	it("a joint made or removed in a collision handler takes effect after the step", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const floor = box(200, 400, 400, 32, "static");
		// one ball sticks to the floor when it lands, the other is let go
		const sticky = box(300, 300, 16, 16, "dynamic") as Renderable & {
			onCollisionStart?: () => void;
		};
		const tethered = box(500, 300, 16, 16, "dynamic") as Renderable & {
			onCollisionStart?: () => void;
		};
		world.addChild(floor);
		world.addChild(sticky);
		world.addChild(tethered);
		const tether = world.addJoint({
			type: "rope",
			a: floor,
			b: tethered,
			maxLength: 1000,
			collideConnected: true,
		});
		let weld: PhysicsJoint | null = null;
		sticky.onCollisionStart = () => {
			weld ??= world.addJoint({ type: "weld", a: floor, b: sticky });
		};
		tethered.onCollisionStart = () => {
			world.removeJoint(tether);
		};
		run(world, 90);
		expect(weld).not.toBeNull();
		expect(tether.native).toBeNull();
		expect(backend.jointCount(world.adapter)).toBe(1);
	});
});

describe("world.setAdapter() and joints", () => {
	it.each([
		{ from: JOINT_BACKENDS[0], to: JOINT_BACKENDS[1] },
		{ from: JOINT_BACKENDS[1], to: JOINT_BACKENDS[0] },
	])("$from.name to $to.name: the joint is built again", ({ from, to }) => {
		const world = new World(0, 0, 800, 600, from.make());
		const { link, joint } = hangingLink(world);
		// swung out, so the link is turned when the adapter changes: built
		// upright, it would be wrenched back to the pin
		world.adapter.setVelocity(link, new Vector2d(200, 0));
		run(world, 6);
		const turned = from.pose(link).angle;
		expect(Math.abs(turned)).toBeGreaterThan(0.2);
		const before = joint.native;
		world.setAdapter(to.make());
		expect(to.pose(link).angle).toBeCloseTo(turned, 5);
		expect(joint.native).not.toBeNull();
		expect(joint.native).not.toBe(before);
		expect(to.jointCount(world.adapter)).toBe(1);
		let gap = 0;
		run(world, 30, () => {
			const top = worldPoint(to, link, { x: 4, y: 0 });
			gap = Math.max(gap, distance(top, { x: 400, y: 116 }));
		});
		expect(gap).toBeLessThan(1.5);
		// and removed through the same handle
		world.removeJoint(joint);
		expect(to.jointCount(world.adapter)).toBe(0);
	});

	it.each([
		{ from: JOINT_BACKENDS[0], to: JOINT_BACKENDS[1] },
		{ from: JOINT_BACKENDS[1], to: JOINT_BACKENDS[0] },
	])(
		"$from.name to $to.name: the defaults resolved at first are kept",
		({ from, to }) => {
			const world = new World(0, 0, 800, 600, from.make());
			const hook = box(392, 100, 16, 16, "static");
			const ball = box(392, 160, 16, 16, "dynamic");
			world.addChild(hook);
			world.addChild(ball);
			const definition: JointDefinition = { type: "rope", a: hook, b: ball };
			const joint = world.addJoint(definition);
			// the handle holds a completed copy; the definition given is untouched
			expect(definition.maxLength).toBeUndefined();
			expect(joint.definition.maxLength).toBeCloseTo(60, 3);
			expect(joint.definition.anchorA).toEqual({ x: 8, y: 8 });
			// thrown up, the rope is slack when the adapter changes
			world.adapter.setVelocity(ball, new Vector2d(0, -300));
			run(world, 6);
			expect(distance(from.pose(hook), from.pose(ball))).toBeLessThan(50);
			world.setAdapter(to.make());
			run(world, 60);
			// still a 60 px rope, not one as long as the slack it had
			const apart = distance(to.pose(hook), to.pose(ball));
			expect(apart).toBeGreaterThan(58);
			expect(apart).toBeLessThan(61.5);
		},
	);

	it("a turned body keeps its angle from one adapter to the next", () => {
		const world = new World(0, 0, 800, 600, JOINT_BACKENDS[0].make());
		const plank = box(300, 300, 80, 10, "static");
		world.addChild(plank);
		world.adapter.setAngle?.(plank, 0.5);
		for (const next of [
			() => {
				return new MatterAdapter();
			},
			() => {
				return JOINT_BACKENDS[1].make();
			},
			() => {
				return JOINT_BACKENDS[0].make();
			},
		]) {
			world.setAdapter(next());
			expect(world.adapter.getAngle?.(plank)).toBeCloseTo(0.5, 5);
		}
	});

	it("to an adapter without joints: the switch completes, then throws", () => {
		const world = new World(0, 0, 800, 600, JOINT_BACKENDS[0].make());
		const { joint } = hangingLink(world);
		expect(() => {
			world.setAdapter(new MatterAdapter());
		}).toThrow(/dropped 1 joint: the matter adapter has none/);
		// the switch went through, without the joint
		expect(world.adapter).toBeInstanceOf(MatterAdapter);
		expect(joint.native).toBeNull();
		// for good: switching back does not bring it back
		world.setAdapter(JOINT_BACKENDS[0].make());
		expect(JOINT_BACKENDS[0].jointCount(world.adapter)).toBe(0);
	});

	it("to an adapter without joints, once they are removed: no error", () => {
		const world = new World(0, 0, 800, 600, JOINT_BACKENDS[1].make());
		const { joint } = hangingLink(world);
		world.removeJoint(joint);
		expect(() => {
			world.setAdapter(new BuiltinAdapter());
		}).not.toThrow();
	});
});

describe.each([
	{
		name: "builtin",
		make: () => {
			return new BuiltinAdapter();
		},
	},
	{
		name: "matter",
		make: () => {
			return new MatterAdapter();
		},
	},
])("$name: no joints", ({ name, make }) => {
	it("reports none, and addJoint() throws, naming the adapter", () => {
		const adapter: PhysicsAdapter = make();
		expect(adapter.capabilities.constraints).toBe(false);
		const world = new World(0, 0, 800, 600, adapter);
		const hook = box(392, 100, 16, 16, "static");
		const link = box(396, 116, 8, 40, "dynamic");
		world.addChild(hook);
		world.addChild(link);
		expect(() => {
			world.addJoint({ type: "hinge", a: hook, b: link });
		}).toThrow(new RegExp(`the ${name} adapter has none`));
		// the adapter's own methods: null, and nothing to remove
		expect(adapter.addJoint?.({ type: "hinge", a: hook, b: link })).toBeNull();
		expect(() => {
			adapter.removeJoint?.(null);
		}).not.toThrow();
		// nothing was joined: the link falls
		run(world, 30);
		expect(link.pos.y).toBeGreaterThan(130);
	});
});
