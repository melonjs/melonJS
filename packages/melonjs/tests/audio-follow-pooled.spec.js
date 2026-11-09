import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetSpatialTracking } from "../src/audio/spatial.ts";
import { getSoundOrThrow } from "../src/audio/state.ts";
import { audio, Container, createPool, Renderable } from "../src/index.js";
import { emit, GAME_AFTER_UPDATE } from "../src/system/event.ts";
import {
	loadClip,
	settle,
	startEngine,
	stopEngine,
} from "./helpers/audio-output.js";

/**
 * A sound following a POOLED renderable outlived it.
 *
 * `follow` / `stopWithTarget` only noticed a target that had been destroyed
 * (`pos` set to undefined). A renderable built by `createPool` is not
 * destroyed when it leaves the world: the container hands it back to its pool
 * instead. So the sound kept following it, and a looping one with
 * `stopWithTarget` kept playing; once the pool lent the object out again, as
 * a bullet pool does on the next shot, the old sound followed the new bullet.
 *
 * Being returned to its pool is now treated as the end of the target, like
 * being destroyed. Only that: a renderable moved to another container, or
 * removed with `keepalive` to be added again, is the same object carrying on,
 * and its sound carries on with it.
 *
 * The engine is run as on a live context (see `helpers/audio-output.js`).
 */

/** one frame of the engine's post-update hook, where follows are re-read */
const frame = () => {
	emit(GAME_AFTER_UPDATE, 16);
};

class Ufo extends Renderable {
	constructor(x, y) {
		super(x, y, 8, 8);
	}
}

const ufoPool = createPool((x, y) => {
	const ufo = new Ufo(x, y);
	return {
		instance: ufo,
		reset(nx, ny) {
			ufo.pos.set(nx, ny, 0);
		},
	};
});

/**
 * where the engine last placed a voice, in world coordinates
 * @param {string} name - the clip
 * @param {number} id - the playback id
 * @returns {number[]} `[x, y]`
 */
const placed = (name, id) => {
	const pos = getSoundOrThrow(name)._soundById(id)._pos;
	return [pos[0], -pos[1]];
};

describe("a followed renderable returned to its pool", () => {
	let world;

	beforeAll(startEngine);
	afterAll(stopEngine);

	afterEach(() => {
		resetSpatialTracking();
		audio.stop();
		audio.unloadAll();
		world.destroy();
	});

	const spawn = (x, y) => {
		const ufo = ufoPool.get(x, y);
		world.addChild(ufo);
		return ufo;
	};

	const newWorld = () => {
		world = new Container(0, 0, 2000, 2000);
	};

	describe("proof", () => {
		it("stopWithTarget stops the sound when the renderable goes back to its pool", async () => {
			newWorld();
			await loadClip("fp-hum", {}, 3);
			const ufo = spawn(100, 50);
			const id = audio.play("fp-hum", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			await settle();
			expect(audio.playing("fp-hum", id)).toBe(true);
			world.removeChildNow(ufo);
			frame();
			await settle();
			// pre-fix: still looping, the renderable was pooled, not destroyed
			expect(audio.playing("fp-hum", id)).toBe(false);
		});

		it("it stops through the usual deferred removeChild too", async () => {
			newWorld();
			await loadClip("fp-deferred", {}, 3);
			const ufo = spawn(100, 50);
			const id = audio.play("fp-deferred", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChild(ufo);
			await settle();
			frame();
			await settle();
			expect(audio.playing("fp-deferred", id)).toBe(false);
		});

		it("it stops even when the pool lends the object out again before the next frame", async () => {
			// a bullet pool: one bullet removed, the next shot takes the same
			// object in the same update, before follows are re-read
			newWorld();
			await loadClip("fp-relent", {}, 3);
			const first = spawn(100, 50);
			const id = audio.play("fp-relent", {
				follow: first,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChildNow(first);
			const second = spawn(900, 700);
			expect(second).toBe(first);
			frame();
			await settle();
			expect(audio.playing("fp-relent", id)).toBe(false);
		});

		it("without stopWithTarget the sound stops following, and does not follow the recycled object", async () => {
			newWorld();
			await loadClip("fp-free", {}, 3);
			const first = spawn(100, 50);
			const id = audio.play("fp-free", { follow: first, loop: true });
			frame();
			expect(placed("fp-free", id)).toEqual([100, 50]);
			world.removeChildNow(first);
			const second = spawn(900, 700);
			frame();
			await settle();
			// the game's to stop, but it stays where the first one was
			expect(audio.playing("fp-free", id)).toBe(true);
			expect(placed("fp-free", id)).toEqual([100, 50]);
			expect(second).toBe(first);
		});
	});

	describe("what must not change", () => {
		it("a pooled renderable in the world is followed every frame", async () => {
			newWorld();
			await loadClip("fp-follow", {}, 3);
			const ufo = spawn(100, 50);
			const id = audio.play("fp-follow", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			ufo.pos.set(300, 200, 0);
			frame();
			await settle();
			expect(placed("fp-follow", id)).toEqual([300, 200]);
			expect(audio.playing("fp-follow", id)).toBe(true);
		});

		it("a renderable moved to another container keeps its sound", async () => {
			newWorld();
			await loadClip("fp-move", {}, 3);
			const other = new Container(0, 0, 2000, 2000);
			world.addChild(other);
			const ufo = spawn(100, 50);
			const id = audio.play("fp-move", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			other.addChild(ufo);
			ufo.pos.set(400, 60, 0);
			frame();
			await settle();
			expect(audio.playing("fp-move", id)).toBe(true);
			expect(placed("fp-move", id)).toEqual([400, 60]);
		});

		it("a renderable removed with keepalive keeps its sound", async () => {
			newWorld();
			await loadClip("fp-keep", {}, 3);
			const ufo = new Ufo(100, 50);
			world.addChild(ufo);
			const id = audio.play("fp-keep", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChildNow(ufo, true);
			frame();
			world.addChild(ufo);
			frame();
			await settle();
			expect(audio.playing("fp-keep", id)).toBe(true);
		});

		it("a pooled renderable removed with keepalive keeps its sound", async () => {
			newWorld();
			await loadClip("fp-pool-keep", {}, 3);
			const ufo = spawn(100, 50);
			const id = audio.play("fp-pool-keep", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChildNow(ufo, true);
			frame();
			await settle();
			expect(audio.playing("fp-pool-keep", id)).toBe(true);
		});

		it("a pooled renderable followed before it is added to the world", async () => {
			newWorld();
			await loadClip("fp-early", {}, 3);
			const ufo = ufoPool.get(10, 20);
			const id = audio.play("fp-early", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.addChild(ufo);
			ufo.pos.set(30, 40, 0);
			frame();
			await settle();
			expect(audio.playing("fp-early", id)).toBe(true);
			expect(placed("fp-early", id)).toEqual([30, 40]);
		});

		it("a sound started on the recycled object follows it", async () => {
			newWorld();
			await loadClip("fp-second", {}, 3);
			const first = spawn(100, 50);
			audio.play("fp-second", {
				follow: first,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChildNow(first);
			const second = spawn(900, 700);
			const id = audio.play("fp-second", {
				follow: second,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			second.pos.set(950, 720, 0);
			frame();
			await settle();
			expect(audio.playing("fp-second", id)).toBe(true);
			expect(placed("fp-second", id)).toEqual([950, 720]);
		});

		it("a destroyed renderable still stops its sound", async () => {
			newWorld();
			await loadClip("fp-destroyed", {}, 3);
			const ufo = new Ufo(100, 50);
			world.addChild(ufo);
			const id = audio.play("fp-destroyed", {
				follow: ufo,
				loop: true,
				stopWithTarget: true,
			});
			frame();
			world.removeChildNow(ufo);
			frame();
			await settle();
			expect(audio.playing("fp-destroyed", id)).toBe(false);
		});
	});
});
