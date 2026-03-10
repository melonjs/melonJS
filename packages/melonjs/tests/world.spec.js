import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Body, boot, Rect, Renderable, video, World } from "../src/index.js";

describe("Physics : World", () => {
	let world;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	describe("constructor", () => {
		it("should have default properties", () => {
			expect(world.name).toEqual("rootContainer");
			expect(world.physic).toEqual("builtin");
			expect(world.fps).toEqual(60);
			expect(world.preRender).toEqual(false);
		});

		it("should have default gravity", () => {
			expect(world.gravity.x).toEqual(0);
			expect(world.gravity.y).toEqual(0.98);
		});

		it("should have an empty bodies set", () => {
			expect(world.bodies.size).toEqual(0);
		});

		it("should have a broadphase quadtree", () => {
			expect(world.broadphase).toBeDefined();
		});

		it("should have a collision detector", () => {
			expect(world.detector).toBeDefined();
		});
	});

	describe("addBody", () => {
		it("should add a body when physic is builtin", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			expect(world.bodies.size).toEqual(1);
			expect(world.bodies.has(body)).toEqual(true);
		});

		it("should not add a body when physic is none", () => {
			world.physic = "none";
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			expect(world.bodies.size).toEqual(0);
		});

		it("should return the world instance", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			const result = world.addBody(body);
			expect(result).toBe(world);
		});
	});

	describe("removeBody", () => {
		it("should remove a body when physic is builtin", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			expect(world.bodies.size).toEqual(1);

			world.removeBody(body);
			expect(world.bodies.size).toEqual(0);
		});

		it("should not remove when physic is none", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			world.physic = "none";
			world.removeBody(body);
			expect(world.bodies.size).toEqual(1);
		});

		it("should return the world instance", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			const result = world.removeBody(body);
			expect(result).toBe(world);
		});
	});

	describe("reset", () => {
		it("should clear all non-persistent bodies", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));

			world.addBody(body);
			expect(world.bodies.size).toEqual(1);

			world.reset();
			expect(world.bodies.size).toEqual(0);
		});

		it("should preserve bodies with persistent ancestors", () => {
			const persistent = new Renderable(0, 0, 32, 32);
			persistent.isPersistent = true;
			const persistentBody = new Body(persistent, new Rect(0, 0, 32, 32));

			const nonPersistent = new Renderable(0, 0, 16, 16);
			const nonPersistentBody = new Body(nonPersistent, new Rect(0, 0, 16, 16));

			world.addBody(persistentBody);
			world.addBody(nonPersistentBody);
			expect(world.bodies.size).toEqual(2);

			world.reset();
			expect(world.bodies.size).toEqual(1);
			expect(world.bodies.has(persistentBody)).toEqual(true);
			expect(world.bodies.has(nonPersistentBody)).toEqual(false);
		});

		it("should preserve multiple persistent bodies", () => {
			const p1 = new Renderable(0, 0, 32, 32);
			p1.isPersistent = true;
			const body1 = new Body(p1, new Rect(0, 0, 32, 32));

			const p2 = new Renderable(0, 0, 64, 64);
			p2.isPersistent = true;
			const body2 = new Body(p2, new Rect(0, 0, 64, 64));

			const nonPersistent = new Renderable(0, 0, 16, 16);
			const body3 = new Body(nonPersistent, new Rect(0, 0, 16, 16));

			world.addBody(body1);
			world.addBody(body2);
			world.addBody(body3);
			expect(world.bodies.size).toEqual(3);

			world.reset();
			expect(world.bodies.size).toEqual(2);
			expect(world.bodies.has(body1)).toEqual(true);
			expect(world.bodies.has(body2)).toEqual(true);
		});

		it("should not re-add persistent bodies when physic is none", () => {
			const persistent = new Renderable(0, 0, 32, 32);
			persistent.isPersistent = true;
			const body = new Body(persistent, new Rect(0, 0, 32, 32));

			world.addBody(body);
			expect(world.bodies.size).toEqual(1);

			world.physic = "none";
			world.reset();
			expect(world.bodies.size).toEqual(0);
		});

		it("should reset anchorPoint to (0, 0)", () => {
			world.anchorPoint.set(0.5, 0.5);
			world.reset();
			expect(world.anchorPoint.x).toEqual(0);
			expect(world.anchorPoint.y).toEqual(0);
		});
	});

	describe("bodyApplyGravity", () => {
		it("should apply gravity to a body", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));
			body.force.set(0, 0);

			world.bodyApplyGravity(body);
			expect(body.force.x).toEqual(0);
			expect(body.force.y).toEqual(body.mass * world.gravity.y);
		});

		it("should not apply gravity when ignoreGravity is true", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));
			body.ignoreGravity = true;
			body.force.set(0, 0);

			world.bodyApplyGravity(body);
			expect(body.force.x).toEqual(0);
			expect(body.force.y).toEqual(0);
		});

		it("should not apply gravity when gravityScale is 0", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));
			body.gravityScale = 0;
			body.force.set(0, 0);

			world.bodyApplyGravity(body);
			expect(body.force.x).toEqual(0);
			expect(body.force.y).toEqual(0);
		});

		it("should respect custom gravityScale", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));
			body.gravityScale = 2;
			body.force.set(0, 0);

			world.bodyApplyGravity(body);
			expect(body.force.y).toEqual(body.mass * world.gravity.y * 2);
		});

		it("should apply custom world gravity", () => {
			world.gravity.set(0.5, 1.5);
			const renderable = new Renderable(0, 0, 32, 32);
			const body = new Body(renderable, new Rect(0, 0, 32, 32));
			body.force.set(0, 0);

			world.bodyApplyGravity(body);
			expect(body.force.x).toEqual(body.mass * 0.5);
			expect(body.force.y).toEqual(body.mass * 1.5);
		});
	});
});
