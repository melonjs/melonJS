/**
 * Per-shape collision settings under `PlanckAdapter` (melonjs#1590).
 *
 * A shape may carry its own `collisionType` / `collisionMask` / `isTrigger` /
 * `isActive`, overriding the body-level values. This backend needed no
 * structural change to support them: it already builds one fixture per shape,
 * and Box2D filters and flags sensors per *fixture*.
 *
 * The adapter's CHANGELOG advertises that support, so it needs to be pinned —
 * including the documented limitation that body-wide setters flatten it.
 */
import {
	Application,
	boot,
	collision,
	Rect,
	Renderable,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const T = collision.types;

interface TestFixture {
	getFilterCategoryBits(): number;
	getFilterMaskBits(): number;
	isSensor(): boolean;
	getNext(): TestFixture | null;
}

/**
 * Every fixture on a body, in list order.
 *
 * Box2D's list head is the LAST shape added, which is why the assertions below
 * compare sets rather than positions.
 * @param body the planck body to walk
 * @returns its fixtures
 */
function fixtures(body: unknown): TestFixture[] {
	const out: TestFixture[] = [];
	for (
		let f = (body as { getFixtureList(): TestFixture | null }).getFixtureList();
		f;
		f = f.getNext()
	) {
		out.push(f);
	}
	return out;
}

/** the per-shape collision settings, which live on a shape as optional fields */
interface ShapeSettings {
	collisionType?: number;
	collisionMask?: number;
	isTrigger?: boolean;
	isActive?: boolean;
}

/**
 * A Rect carrying per-shape collision settings.
 * @param x shape x
 * @param y shape y
 * @param w shape width
 * @param h shape height
 * @param settings the per-shape collision settings to attach
 * @returns the configured shape
 */
function shapeWith(
	x: number,
	y: number,
	w: number,
	h: number,
	settings: ShapeSettings = {},
): Rect {
	return Object.assign(new Rect(x, y, w, h), settings);
}

describe("PlanckAdapter — per-shape collision settings", () => {
	let adapter: PlanckAdapter;

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
		adapter = new PlanckAdapter();
		// the World constructor is what runs `adapter.init()` and gives it a
		// planck world to create bodies in
		new World(0, 0, 800, 600, adapter);
	});

	it("gives each fixture its own filter from the shape", () => {
		const feet = shapeWith(0, 0, 32, 8, { collisionType: T.WORLD_SHAPE });
		const torso = shapeWith(0, 8, 32, 24, { collisionType: T.ENEMY_OBJECT });

		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [feet, torso],
			collisionType: T.PLAYER_OBJECT,
		});

		const cats = fixtures(body).map((f) => f.getFilterCategoryBits());
		expect(cats).toHaveLength(2);
		// two shapes, two DIFFERENT categories — neither is the body's
		expect(new Set(cats).size).toBe(2);
		expect(cats).toContain(T.WORLD_SHAPE);
		expect(cats).toContain(T.ENEMY_OBJECT);
	});

	it("falls back to the body's values for a shape that sets nothing", () => {
		// the backward-compatibility guarantee, at the adapter level
		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [new Rect(0, 0, 32, 32), new Rect(0, 0, 16, 16)],
			collisionType: T.PLAYER_OBJECT,
			collisionMask: T.WORLD_SHAPE,
		});
		for (const f of fixtures(body)) {
			expect(f.getFilterCategoryBits()).toBe(T.PLAYER_OBJECT);
			expect(f.getFilterMaskBits()).toBe(T.WORLD_SHAPE);
		}
	});

	it("mixes a shape override with an inherited sibling", () => {
		const overridden = shapeWith(0, 0, 16, 32, {
			collisionMask: T.WORLD_SHAPE,
		});
		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [overridden, new Rect(16, 0, 16, 32)],
			collisionType: T.PLAYER_OBJECT,
			collisionMask: T.ALL_OBJECT,
		});
		const masks = fixtures(body).map((f) => f.getFilterMaskBits());
		expect(masks).toContain(T.WORLD_SHAPE); // the override
		expect(masks).toContain(T.ALL_OBJECT); // the inherited sibling
	});

	it("maps isTrigger onto a sensor fixture, per shape", () => {
		const solid = new Rect(0, 0, 16, 32);
		const trigger = shapeWith(16, 0, 16, 32, { isTrigger: true });

		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [solid, trigger],
		});
		const sensors = fixtures(body).map((f) => f.isSensor());
		// exactly one sensor — the trigger shape only
		expect(sensors.filter(Boolean)).toHaveLength(1);
		expect(sensors.filter((v) => !v)).toHaveLength(1);
	});

	it("skips fixture creation for an inactive shape", () => {
		const active = new Rect(0, 0, 16, 32);
		const inactive = shapeWith(16, 0, 16, 32, { isActive: false });

		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [active, inactive],
		});
		// the shape is still on the def, but Box2D never sees it
		expect(fixtures(body)).toHaveLength(1);
	});

	it("a body whose every shape is inactive still constructs and steps", () => {
		const s1 = shapeWith(0, 0, 16, 32, { isActive: false });
		const s2 = shapeWith(16, 0, 16, 32, { isActive: false });

		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [s1, s2],
		});
		expect(fixtures(body)).toHaveLength(0);
		// a zero-fixture body must not throw the simulation
		expect(() => {
			adapter.step(16.6667);
			adapter.syncFromPhysics();
		}).not.toThrow();
	});

	// The documented limitation, pinned so it cannot change silently. Box2D has
	// no body-level filter, so the adapter's body-wide setters write EVERY
	// fixture — which necessarily discards per-shape values.
	it("body-wide setters overwrite per-shape filters (documented limitation)", () => {
		const shape = shapeWith(0, 0, 16, 32, { collisionType: T.WORLD_SHAPE });
		const r = new Renderable(100, 100, 32, 32);
		const body = adapter.addBody(r, {
			type: "dynamic",
			shapes: [shape, new Rect(16, 0, 16, 32)],
			collisionType: T.PLAYER_OBJECT,
		});
		expect(
			new Set(fixtures(body).map((f) => f.getFilterCategoryBits())).size,
		).toBe(2);

		(body as unknown as { setCollisionType(v: number): void }).setCollisionType(
			T.ENEMY_OBJECT,
		);

		// every fixture now carries the body-wide value — the per-shape override
		// is gone, and there is no way back to it
		const after = fixtures(body).map((f) => f.getFilterCategoryBits());
		expect(new Set(after).size).toBe(1);
		expect(after[0]).toBe(T.ENEMY_OBJECT);
	});
});
