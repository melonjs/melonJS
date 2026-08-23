/**
 * `createGUID()` and the collision pair identity built on it.
 *
 * The bug: `createGUID` returned `index || GUID_index` with `index` defaulting
 * to `1`, so the counter it had just advanced was discarded and the no-argument
 * call returned the literal string "-1" every time. Every renderable added to a
 * container shared one GUID.
 *
 * GUID's only consumer is `Detector._pairKey`, so every colliding pair in the
 * world collapsed onto one key: the second simultaneous collision was treated
 * as already-seen that frame and its `onCollisionStart` / `onCollisionActive` /
 * `onCollisionEnd` never fired. `onCollision` was unaffected, which is how it
 * survived unnoticed, since the legacy handler is dispatched outside the
 * first-visit guard.
 *
 * The fix is deliberately minimal and preserves the string FORMAT: a caller
 * that supplies an id still gets `<base>-<id>`, which is what keeps a Tiled
 * object's GUID readable. Only the absent-id path changed, and there the old
 * values ("-1" for everyone) were not something anyone could have relied on.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	collision,
	Rect,
	Renderable,
	utils,
	video,
	World,
} from "../src/index.js";

const T = collision.types;

describe("Renderable GUID and collision pair identity", () => {
	/** @type {World} */
	let world;
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		world = new World(0, 0, 800, 600);
	});

	// ── the generator ───────────────────────────────────────────────────

	describe("createGUID", () => {
		it("no longer returns the same string for every anonymous call", () => {
			const made = Array.from({ length: 50 }, () => {
				return utils.createGUID();
			});
			expect(new Set(made).size).toBe(made.length);
		});

		it("still embeds a supplied id, so a Tiled GUID stays readable", () => {
			// the format is deliberately preserved on this branch
			utils.resetGUID("level1", 100);
			expect(utils.createGUID(42)).toMatch(/-42$/);
			expect(utils.createGUID(7)).toMatch(/-7$/);
		});

		it("treats a null or zero id as absent and uses the counter", () => {
			// `Container.addChild` passes `child.id`, which is null by default
			const made = [
				utils.createGUID(null),
				utils.createGUID(0),
				utils.createGUID(undefined),
				utils.createGUID(),
			];
			expect(new Set(made).size).toBe(made.length);
		});

		it("documented limitation: duplicate explicit ids share a GUID", () => {
			// Pinned rather than fixed. Embedding the id IS the point of that
			// branch, and deduplicating it would change the string format for
			// every Tiled object. Two renderables sharing an explicit `id` are
			// a caller error, and this was equally true before the fix.
			expect(utils.createGUID(5)).toBe(utils.createGUID(5));
		});
	});

	// ── a Tiled-style level load ────────────────────────────────────────

	describe("a Tiled level load (resetGUID + authored ids)", () => {
		it("never lets a generated GUID collide with an authored Tiled id", () => {
			// `level.load()` calls `resetGUID(levelId, level.nextobjectid)`,
			// which seeds the counter PAST every object id in the map. That is
			// what lets the two branches coexist: authored objects keep their
			// id, dynamically spawned ones continue above them.
			const nextobjectid = 12;
			utils.resetGUID("dungeon-01", nextobjectid);

			// the map's authored objects, ids 1..11 as Tiled would emit
			const authored = Array.from({ length: nextobjectid - 1 }, (_, i) => {
				return utils.createGUID(i + 1);
			});
			// then a burst of runtime spawns with no id of their own
			const spawned = Array.from({ length: 40 }, () => {
				return utils.createGUID();
			});

			expect(new Set(authored).size).toBe(authored.length);
			expect(new Set(spawned).size).toBe(spawned.length);
			// the important one: no runtime spawn ever reuses an authored GUID
			const overlap = spawned.filter((g) => {
				return authored.includes(g);
			});
			expect(overlap).toEqual([]);
		});

		it("namespaces two levels apart", () => {
			utils.resetGUID("level-a", 5);
			const a = [utils.createGUID(), utils.createGUID()];
			utils.resetGUID("level-b", 5);
			const b = [utils.createGUID(), utils.createGUID()];
			// same counter positions, different base, so no cross-level clash
			expect(
				a.filter((g) => {
					return b.includes(g);
				}),
			).toEqual([]);
		});
	});

	// ── a manually populated world ──────────────────────────────────────

	describe("a manually populated world", () => {
		it("gives every child a distinct GUID", () => {
			const made = Array.from({ length: 60 }, () => {
				const r = new Renderable(0, 0, 8, 8);
				world.addChild(r);
				return r.GUID;
			});
			expect(new Set(made).size).toBe(made.length);
		});

		it("keeps them distinct through reparenting and removal", () => {
			// `addChild` only allocates when the child has no previous ancestor,
			// so a reparented child KEEPS its GUID. Removing and re-adding is
			// the case that must not hand out a duplicate.
			const kept = new Renderable(0, 0, 8, 8);
			world.addChild(kept);
			const original = kept.GUID;

			const other = new World(0, 0, 800, 600);
			other.addChild(kept);
			expect(kept.GUID).toBe(original); // reparent preserves identity

			world.removeChildNow(kept);
			const fresh = Array.from({ length: 10 }, () => {
				const r = new Renderable(0, 0, 8, 8);
				world.addChild(r);
				return r.GUID;
			});
			expect(fresh).not.toContain(original);
			expect(new Set(fresh).size).toBe(fresh.length);
		});
	});

	// ── what the bug actually broke ─────────────────────────────────────

	describe("collision lifecycle across simultaneous pairs", () => {
		const mk = (x, y, type) => {
			const r = new Renderable(x, y, 32, 32);
			r.alwaysUpdate = true;
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				collisionType: type,
				collisionMask: T.ALL_OBJECT,
				gravityScale: 0,
			};
			world.addChild(r);
			return r;
		};

		it("fires Start and Active for EVERY simultaneously colliding pair", () => {
			// three independent pairs, far apart. Before the fix only the first
			// was reported, because all three keyed to "-1|-1".
			const started = [];
			const active = [];
			for (const [i, y] of [100, 300, 500].entries()) {
				const a = mk(100, y, T.PLAYER_OBJECT);
				mk(108, y, T.ENEMY_OBJECT);
				a.onCollisionStart = () => {
					return started.push(i);
				};
				a.onCollisionActive = () => {
					return active.push(i);
				};
			}
			world.update(16);

			expect(started.sort()).toEqual([0, 1, 2]);
			expect([...new Set(active)].sort()).toEqual([0, 1, 2]);
		});

		it("fires End for every pair that separates", () => {
			const ended = [];
			const movers = [];
			for (const [i, y] of [100, 400].entries()) {
				const a = mk(100, y, T.PLAYER_OBJECT);
				mk(108, y, T.ENEMY_OBJECT);
				a.onCollisionEnd = () => {
					return ended.push(i);
				};
				movers.push(a);
			}
			world.update(16);
			for (const a of movers) {
				a.pos.x = 600;
				a.body.getBounds().translate(500, 0);
			}
			world.update(16);

			expect(ended.sort()).toEqual([0, 1]);
		});

		it("keeps pairs distinct when the renderables carry explicit ids", () => {
			// the id branch feeds the GUID, so distinct ids must still give
			// distinct pair identities
			const started = [];
			for (const [i, y] of [100, 400].entries()) {
				const a = mk(100, y, T.PLAYER_OBJECT);
				const b = mk(108, y, T.ENEMY_OBJECT);
				a.GUID = utils.createGUID(1000 + i * 2);
				b.GUID = utils.createGUID(1001 + i * 2);
				a.onCollisionStart = () => {
					return started.push(i);
				};
			}
			world.update(16);
			expect(started.sort()).toEqual([0, 1]);
		});
	});
});
