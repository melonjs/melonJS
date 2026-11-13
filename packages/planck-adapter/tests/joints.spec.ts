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
 * - default anchors hold the bodies as they stand, turned or not, whatever
 *   the shape, and are kept: a rebuild makes the same joint
 * - the world removes a joint with either body, however it leaves (removed,
 *   in a removed container, `world.reset()`, even joined again by a
 *   collision-end handler on its way out), and `removeJoint()` is safe to
 *   repeat; a body moved to another container of the world keeps its joints
 * - `updateShape()` and `world.setAdapter()` rebuild the joints, with each
 *   body where it stood and at its angle, and the handle game code holds gets
 *   the new engine joint; switching to an adapter without joints drops them,
 *   then throws, and so does one that refuses a body or fails a joint
 * - planck refuses to change its world during a step: a joint made or
 *   removed, or a shape changed, from a collision handler takes effect when
 *   the step ends
 */

import { MatterAdapter } from "@melonjs/matter-adapter";
import { RapierAdapter } from "@melonjs/rapier2d-adapter";
import {
	Application,
	BuiltinAdapter,
	boot,
	Container,
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
			// walked rather than getJointCount(): a joint destroyed before it
			// was ever created, then created, is listed but not counted
			let count = 0;
			for (
				let joint = (adapter as PlanckAdapter).world.getJointList();
				joint;
				joint = joint.getNext()
			) {
				count++;
			}
			return count;
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

// the same for any renderable, given the centre of its body in its own space
const worldPointOf = (
	backend: JointBackend,
	r: Renderable,
	p: { x: number; y: number },
	centre: { x: number; y: number },
) => {
	const { x, y, angle } = backend.pose(r);
	const dx = p.x - centre.x;
	const dy = p.y - centre.y;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return { x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos };
};

const otherBackend = (backend: JointBackend) => {
	return backend === JOINT_BACKENDS[0] ? JOINT_BACKENDS[1] : JOINT_BACKENDS[0];
};

type Handled = Renderable & {
	onCollisionStart?: () => void;
	onCollisionEnd?: () => void;
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
	it("a default anchorA is the point under b's anchor on turned, off-centre bodies, and is kept", () => {
		const other = otherBackend(backend);
		const world = new World(0, 0, 800, 600, backend.make());
		// the hook's one shape sits 8 px in from its frame's left edge: the
		// centre of its body is (16, 8) in its own space
		const hook = new Renderable(380, 100, 32, 32);
		hook.anchorPoint.set(0, 0);
		hook.bodyDef = { type: "static", shapes: [new Rect(8, 0, 16, 16)] };
		const link = box(396, 130, 8, 40, "dynamic");
		world.addChild(hook);
		world.addChild(link);
		world.adapter.setAngle?.(hook, 0.7);
		world.adapter.setAngle?.(link, 0.3);
		const top = (be: JointBackend) => {
			return worldPointOf(be, link, { x: 4, y: 0 }, { x: 4, y: 20 });
		};
		const pin = top(backend);
		const joint = world.addJoint({
			type: "hinge",
			a: hook,
			b: link,
			anchorB: { x: 4, y: 0 },
		});
		// written back in the hook's own space: the point of it under the
		// link's top
		const anchorA = joint.definition.anchorA ?? { x: Number.NaN, y: 0 };
		expect(
			distance(worldPointOf(backend, hook, anchorA, { x: 16, y: 8 }), pin),
		).toBeLessThan(0.01);
		let gap = 0;
		run(world, 30, () => {
			gap = Math.max(gap, distance(top(backend), pin));
		});
		expect(gap).toBeLessThan(1.5);
		// built again from it on the other adapter: pinned at the same point
		world.setAdapter(other.make());
		gap = 0;
		run(world, 30, () => {
			gap = Math.max(gap, distance(top(other), pin));
		});
		expect(gap).toBeLessThan(1.5);
	});

	it("a default anchorB stays where it was made when updateShape() moves b's centre", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const hook = box(392, 100, 16, 16, "static");
		const link = box(396, 116, 8, 40, "dynamic");
		world.addChild(hook);
		world.addChild(link);
		// no anchors: held at the link's centre, (400, 136) in the world
		const joint = world.addJoint({ type: "hinge", a: hook, b: link });
		expect(joint.definition.anchorB?.x).toBeCloseTo(4, 5);
		expect(joint.definition.anchorB?.y).toBeCloseTo(20, 5);
		// the link becomes its top half: the centre of its body moves up to
		// (4, 10), and the joint still holds (4, 20)
		world.adapter.updateShape?.(link, [new Rect(0, 0, 8, 20)]);
		let gap = 0;
		run(world, 30, () => {
			const held = worldPointOf(
				backend,
				link,
				{ x: 4, y: 20 },
				{ x: 4, y: 10 },
			);
			gap = Math.max(gap, distance(held, { x: 400, y: 136 }));
		});
		expect(gap).toBeLessThan(1.5);
	});

	it("updateShape() leaves a turned body where it stood when the new shape moves its centre", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const crate = box(300, 300, 32, 32, "dynamic");
		world.addChild(crate);
		world.adapter.setAngle?.(crate, 0.8);
		// its top-left corner, before and after: the centre of the new 16 px
		// shape is (8, 8) rather than (16, 16)
		const corner = worldPointOf(
			backend,
			crate,
			{ x: 0, y: 0 },
			{ x: 16, y: 16 },
		);
		world.adapter.updateShape?.(crate, [new Rect(0, 0, 16, 16)]);
		const after = worldPointOf(backend, crate, { x: 0, y: 0 }, { x: 8, y: 8 });
		expect(distance(after, corner)).toBeLessThan(0.01);
		expect(backend.pose(crate).angle).toBeCloseTo(0.8, 5);
	});

	it("updateShape() from a collision handler reshapes the body", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const floor = box(200, 400, 400, 32, "static");
		const ball = box(392, 300, 16, 16, "dynamic") as Handled;
		world.addChild(floor);
		world.addChild(ball);
		let reshaped = false;
		ball.onCollisionStart = () => {
			if (!reshaped) {
				reshaped = true;
				// its top half only
				world.adapter.updateShape?.(ball, [new Rect(0, 0, 16, 8)]);
			}
		};
		expect(() => {
			run(world, 90);
		}).not.toThrow();
		expect(reshaped).toBe(true);
		// it landed again, on the bottom of its new shape
		expect(ball.pos.y + 8).toBeGreaterThan(397);
		expect(ball.pos.y + 8).toBeLessThan(403);
	});

	it("a slider rebuilt after travelling keeps its limits; with no axis nor limits it slides freely along x", () => {
		const other = otherBackend(backend);
		const world = new World(0, 0, 800, 600, backend.make());
		const shaft = box(392, 100, 16, 16, "static");
		const cabin = box(384, 200, 32, 16, "dynamic");
		world.addChild(shaft);
		world.addChild(cabin);
		world.addJoint({
			type: "slider",
			a: shaft,
			b: cabin,
			axis: { x: 0, y: 1 },
			limits: { min: -60, max: 60 },
		});
		// down at its far limit when the adapter changes
		run(world, 90);
		world.setAdapter(other.make());
		let longest = 0;
		run(world, 60, () => {
			longest = Math.max(longest, other.pose(cabin).y - 108);
		});
		// still counted from where it started: about 220 px if counted from
		// where it was at the switch
		expect(longest).toBeLessThan(161.5);

		const rail = box(100, 400, 16, 16, "static");
		const cart = box(200, 400, 16, 16, "dynamic");
		world.addChild(rail);
		world.addChild(cart);
		world.addJoint({ type: "slider", a: rail, b: cart });
		world.adapter.setVelocity(cart, new Vector2d(300, 0));
		run(world, 30);
		expect(other.pose(cart).x - 208).toBeGreaterThan(100);
		expect(Math.abs(other.pose(cart).y - 408)).toBeLessThan(1);
	});

	it("addJoint() throws for a renderable without a body, and for an unknown type", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const hook = box(392, 100, 16, 16, "static");
		const link = box(396, 116, 8, 40, "dynamic");
		const stray = box(500, 116, 8, 40, "dynamic");
		world.addChild(hook);
		world.addChild(link);
		expect(() => {
			world.addJoint({ type: "hinge", a: hook, b: stray });
		}).toThrow(/needs both renderables to have a body/);
		expect(() => {
			world.addJoint({
				type: "spring" as JointDefinition["type"],
				a: hook,
				b: link,
			});
		}).toThrow(/unknown joint type "spring"/);
		expect(backend.jointCount(world.adapter)).toBe(0);
		// and the world kept neither: nothing to drop on a switch to matter
		expect(() => {
			world.setAdapter(new MatterAdapter());
		}).not.toThrow();
	});

	it("removing a, a nested body, a body with two joints, or reset(), removes their joints", () => {
		const other = otherBackend(backend);
		const world = new World(0, 0, 800, 600, backend.make());
		const hook = box(392, 100, 16, 16, "static");
		const l1 = box(396, 116, 8, 40, "dynamic");
		const l2 = box(396, 156, 8, 40, "dynamic");
		const group = new Container(0, 0, 800, 600);
		const l3 = box(396, 196, 8, 40, "dynamic");
		group.addChild(l3);
		for (const r of [hook, l1, l2, group]) {
			world.addChild(r);
		}
		const hinge = (a: Renderable, b: Renderable, y: number) => {
			return world.addJoint({
				type: "hinge",
				a,
				b,
				anchorA: { x: a === hook ? 8 : 4, y },
				anchorB: { x: 4, y: 0 },
			});
		};
		const j1 = hinge(hook, l1, 16);
		const j2 = hinge(l1, l2, 40);
		const j3 = hinge(l2, l3, 40);
		// a body in a container that leaves
		world.removeChildNow(group, true);
		expect(j3.native).toBeNull();
		// the `a` side
		world.removeChildNow(hook, true);
		expect(j1.native).toBeNull();
		// a body holding two joints
		const l0 = box(396, 76, 8, 40, "dynamic");
		world.addChild(l0);
		const j0 = hinge(l0, l1, 40);
		world.removeChildNow(l1, true);
		expect([j0.native, j2.native]).toEqual([null, null]);
		expect(backend.jointCount(world.adapter)).toBe(0);

		// reset(): what stays keeps its joints, what goes takes its own
		const p1 = box(100, 100, 16, 16, "static");
		const p2 = box(100, 160, 16, 16, "dynamic");
		const q = box(300, 160, 16, 16, "dynamic");
		p1.isPersistent = true;
		p2.isPersistent = true;
		for (const r of [p1, p2, q]) {
			world.addChild(r);
		}
		const kept = world.addJoint({ type: "rope", a: p1, b: p2 });
		const lost = world.addJoint({ type: "rope", a: p1, b: q });
		world.reset();
		expect(lost.native).toBeNull();
		expect(kept.native).not.toBeNull();
		expect(() => {
			world.setAdapter(other.make());
		}).not.toThrow();
		expect(other.jointCount(world.adapter)).toBe(1);
		expect(() => {
			world.destroy();
		}).not.toThrow();
	});

	it("a body moved to another container of the world keeps its joints, its motion and its angle", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const { link, joint } = hangingLink(world);
		const layer = new Container(0, 0, 800, 600);
		world.addChild(layer);
		world.adapter.setVelocity(link, new Vector2d(200, 0));
		run(world, 6);
		const native = joint.native;
		const body = link.body;
		const angle = backend.pose(link).angle;
		const speed = world.adapter.getVelocity(link).length();
		expect(Math.abs(angle)).toBeGreaterThan(0.2);
		layer.addChild(link);
		expect(link.ancestor).toBe(layer);
		// the same body, still swinging, on the same joint
		expect(link.body).toBe(body);
		expect(joint.native).toBe(native);
		expect(backend.pose(link).angle).toBeCloseTo(angle, 5);
		expect(world.adapter.getVelocity(link).length()).toBeCloseTo(speed, 3);
		expect(backend.jointCount(world.adapter)).toBe(1);
		let gap = 0;
		run(world, 30, () => {
			const top = worldPoint(backend, link, { x: 4, y: 0 });
			gap = Math.max(gap, distance(top, { x: 400, y: 116 }));
		});
		expect(gap).toBeLessThan(1.5);
		// and back, by index
		world.addChildAt(link, 0);
		expect(joint.native).toBe(native);
		// out of the world, it goes
		const offstage = new Container(0, 0, 800, 600);
		offstage.addChild(link);
		expect(joint.native).toBeNull();
		expect(backend.jointCount(world.adapter)).toBe(0);
	});

	it("a joint a collision-end handler makes as its body leaves goes with the body", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const floor = box(200, 400, 400, 32, "static") as Handled;
		const hook = box(392, 100, 16, 16, "static");
		const ball = box(392, 370, 16, 16, "dynamic");
		world.addChild(floor);
		world.addChild(hook);
		world.addChild(ball);
		// resting on the floor
		run(world, 30);
		// removing the ball ends its contact with the floor, whose handler
		// joins it again on its way out
		const made: PhysicsJoint[] = [];
		floor.onCollisionEnd = () => {
			if (made.length === 0) {
				made.push(world.addJoint({ type: "rope", a: hook, b: ball }));
			}
		};
		world.removeChildNow(ball, true);
		expect(made.length).toBe(1);
		expect(made[0].native).toBeNull();
		expect(backend.jointCount(world.adapter)).toBe(0);
		// and the world holds no joint: nothing to drop on a switch to matter
		expect(() => {
			world.setAdapter(new MatterAdapter());
		}).not.toThrow();
	});

	it("in a collision handler, a joint added then removed never exists, and a body removed takes its joints", () => {
		const world = new World(0, 0, 800, 600, backend.make());
		const floor = box(100, 400, 600, 32, "static");
		const top = box(400, 100, 16, 16, "static");
		const a = box(200, 300, 16, 16, "dynamic") as Handled;
		const b = box(400, 300, 16, 16, "dynamic") as Handled;
		const c = box(600, 300, 16, 16, "dynamic") as Handled;
		for (const r of [floor, top, a, b, c]) {
			world.addChild(r);
		}
		const live = world.addJoint({
			type: "rope",
			a: top,
			b: c,
			maxLength: 1000,
		});
		const made: PhysicsJoint[] = [];
		const done = new Set<Renderable>();
		const once = (r: Renderable, f: () => void) => {
			return () => {
				if (!done.has(r)) {
					done.add(r);
					f();
				}
			};
		};
		a.onCollisionStart = once(a, () => {
			const joint = world.addJoint({
				type: "rope",
				a: floor,
				b: a,
				maxLength: 1000,
			});
			world.removeJoint(joint);
			made.push(joint);
		});
		b.onCollisionStart = once(b, () => {
			made.push(world.addJoint({ type: "weld", a: floor, b }));
			world.removeChildNow(b, true);
		});
		c.onCollisionStart = once(c, () => {
			world.removeChildNow(c, true);
		});
		run(world, 90);
		expect(done.size).toBe(3);
		for (const joint of [...made, live]) {
			expect(joint.native).toBeNull();
		}
		expect(backend.jointCount(world.adapter)).toBe(0);
		// no stale joint left in the world
		expect(() => {
			world.setAdapter(new MatterAdapter());
		}).not.toThrow();
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
				return new BuiltinAdapter();
			},
			() => {
				return JOINT_BACKENDS[0].make();
			},
		]) {
			world.setAdapter(next());
			expect(world.adapter.getAngle?.(plank)).toBeCloseTo(0.5, 5);
		}
	});

	it.each([
		{ from: JOINT_BACKENDS[0], to: JOINT_BACKENDS[1] },
		{ from: JOINT_BACKENDS[1], to: JOINT_BACKENDS[0] },
	])(
		"$from.name to $to.name: a joint on a body it refuses is dropped, and said so",
		({ from, to }) => {
			const world = new World(0, 0, 800, 600, from.make());
			const { link, joint } = hangingLink(world);
			const picky: PhysicsAdapter = to.make();
			const addBody = picky.addBody.bind(picky);
			picky.addBody = (renderable, def) => {
				if (renderable === link) {
					throw new Error("not this one");
				}
				return addBody(renderable, def);
			};
			expect(() => {
				world.setAdapter(picky);
			}).toThrow(
				/could not build 1 body[\s\S]*It also dropped 1 joint on a body it could not build/,
			);
			expect(world.adapter).toBe(picky);
			expect(joint.native).toBeNull();
			expect(to.jointCount(world.adapter)).toBe(0);
		},
	);

	it.each([
		{ from: JOINT_BACKENDS[0], to: JOINT_BACKENDS[1] },
		{ from: JOINT_BACKENDS[1], to: JOINT_BACKENDS[0] },
	])(
		"$from.name to $to.name: a joint it fails to build does not stop the switch",
		({ from, to }) => {
			const world = new World(0, 0, 800, 600, from.make());
			const { link, joint } = hangingLink(world);
			const broken: PhysicsAdapter = to.make();
			broken.addJoint = () => {
				throw new Error("no joints today");
			};
			expect(() => {
				world.setAdapter(broken);
			}).toThrow(/could not build 1 joint\. The first: no joints today/);
			// the switch went through: the bodies are built, the joint is gone
			expect(world.adapter).toBe(broken);
			expect(world.adapter.getVelocity(link)).toBeDefined();
			expect(link.body).toBeDefined();
			expect(joint.native).toBeNull();
			expect(() => {
				world.setAdapter(new MatterAdapter());
			}).not.toThrow();
		},
	);

	it("a turned body the new adapter refuses is reported, not turned", () => {
		const world = new World(0, 0, 800, 600, JOINT_BACKENDS[0].make());
		const plank = box(300, 300, 80, 10, "static");
		world.addChild(plank);
		world.adapter.setAngle?.(plank, 0.5);
		const picky: PhysicsAdapter = new BuiltinAdapter();
		const addBody = picky.addBody.bind(picky);
		picky.addBody = (renderable, def) => {
			if (renderable === plank) {
				throw new Error("not this one");
			}
			return addBody(renderable, def);
		};
		expect(() => {
			world.setAdapter(picky);
		}).toThrow(/could not build 1 body/);
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
