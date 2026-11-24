import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	level,
	loader,
	Renderable,
	Trigger,
	utils,
	video,
} from "../src/index.js";

/**
 * The level director made a level from one of two formats it knew by name,
 * a Tiled map or a glTF scene, and threw for any other. A loader for another
 * map editor's files had no way in.
 *
 * `level.registerFormat(format, { create, loadOptions })` adds one: the levels
 * it makes are loaded, stepped through, reloaded and removed as a Tiled map's
 * are, and the options it names reach it from a `Trigger`'s settings. And a
 * loader type of the game's own (`loader.setParser`) can now free what it
 * kept, so unloading its bundle takes its levels with it.
 */

/** a level that is one renderable, and remembers what the director did */
class Room {
	constructor(levelId, log) {
		this.id = levelId;
		this.log = log;
		this.nextobjectid = undefined;
	}
	addTo(container, options) {
		this.log.push(`addTo:${this.id}`);
		this.options = options;
		this.marker = new Renderable(0, 0, 8, 8);
		this.marker.name = this.id;
		container.addChild(this.marker);
	}
	destroy() {
		this.log.push(`destroy:${this.id}`);
	}
}

describe("a level format registered with the director", () => {
	let app;
	const log = [];
	const made = [];

	const load = (id, options) => {
		return level.load(id, { container: app.world, async: true, ...options });
	};

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		level.registerFormat("rooms", {
			create: (levelId) => {
				made.push(levelId);
				return new Room(levelId, log);
			},
			loadOptions: ["roomLight", "flatten"],
		});
	});

	afterAll(() => {
		for (const id of ["room-a", "room-b", "room-c"]) {
			level.remove(id);
		}
		app?.destroy();
	});

	it("still refuses a format nobody registered, as before", () => {
		expect(() => {
			level.add("no-such-format", "x");
		}).toThrow("no level loader defined for format no-such-format");
	});

	it("refuses a format registered twice, and one with no create", () => {
		expect(() => {
			level.registerFormat("rooms", { create: () => {} });
		}).toThrow(/already registered/);
		expect(() => {
			level.registerFormat("tmx", { create: () => {} });
		}).toThrow(/already registered/);
		expect(() => {
			level.registerFormat("nothing", {});
		}).toThrow(/needs a create/);
	});

	it("makes the level when it is added, once", () => {
		const before = level.levelCount();
		expect(level.add("rooms", "room-a")).toBe(true);
		expect(level.add("rooms", "room-b")).toBe(true);
		expect(level.add("rooms", "room-c")).toBe(true);
		// the same id again: left as it is
		expect(level.add("rooms", "room-a")).toBe(false);
		expect(made).toEqual(["room-a", "room-b", "room-c"]);
		expect(level.levelCount()).toBe(before + 3);
	});

	it("loads it into the container, with the options given", async () => {
		log.length = 0;
		await load("room-a", { roomLight: 0.5 });
		expect(level.getCurrentLevelId()).toBe("room-a");
		expect(log.at(-1)).toBe("addTo:room-a");
		expect(level.getCurrentLevel().options.roomLight).toBe(0.5);
		expect(
			app.world.getChildren().some((child) => {
				return child.name === "room-a";
			}),
		).toBe(true);
	});

	it("destroys it when another is loaded, and empties the container", async () => {
		await load("room-a");
		log.length = 0;
		await load("room-b");
		expect(log).toEqual(["destroy:room-a", "addTo:room-b"]);
		const names = app.world.getChildren().map((child) => {
			return child.name;
		});
		expect(names).toContain("room-b");
		expect(names).not.toContain("room-a");
	});

	it("steps through its levels in the order they were added", async () => {
		await load("room-a");
		await level.next({ container: app.world, async: true });
		expect(level.getCurrentLevelId()).toBe("room-b");
		await level.next({ container: app.world, async: true });
		expect(level.getCurrentLevelId()).toBe("room-c");
		await level.previous({ container: app.world, async: true });
		expect(level.getCurrentLevelId()).toBe("room-b");
	});

	it("reloads it", async () => {
		await load("room-c");
		log.length = 0;
		await level.reload({ container: app.world, async: true });
		expect(log).toEqual(["destroy:room-c", "addTo:room-c"]);
		expect(level.getCurrentLevelId()).toBe("room-c");
	});

	it("seeds the ids of run-time objects past a level's own, when it says where", async () => {
		await load("room-a");
		const room = level.getCurrentLevel();
		expect(room.nextobjectid).toBeUndefined();
		room.nextobjectid = 4200;
		await load("room-a");
		// the room's own marker was added first, then this one: both take
		// ids from where the level said, under the level's name
		const later = new Renderable(0, 0, 1, 1);
		app.world.addChild(later);
		const index = Number(later.GUID.split("-").pop());
		expect(index).toBeGreaterThanOrEqual(4200);
		expect(index).toBeLessThan(4210);
		expect(later.GUID.startsWith(utils.string.toHex("ROOM-A"))).toBe(true);
		room.nextobjectid = undefined;
	});

	it("a Trigger forwards the format's own options from its settings", () => {
		const trigger = new Trigger(0, 0, {
			width: 8,
			height: 8,
			to: "room-b",
			roomLight: 0.25,
			notAnOption: true,
		});
		expect(trigger.triggerSettings.roomLight).toBe(0.25);
		expect(trigger.triggerSettings.to).toBe("room-b");
		expect("notAnOption" in trigger.triggerSettings).toBe(false);
	});

	it("an option named by a format registered later is forwarded too", () => {
		level.registerFormat("late-rooms", {
			create: (levelId) => {
				return new Room(levelId, log);
			},
			loadOptions: ["lateOption"],
		});
		const trigger = new Trigger(0, 0, {
			width: 8,
			height: 8,
			to: "room-b",
			lateOption: "yes",
		});
		expect(trigger.triggerSettings.lateOption).toBe("yes");
	});

	it("is unregistered with level.remove", async () => {
		await load("room-a");
		const before = level.levelCount();
		expect(level.remove("room-c")).toBe(true);
		expect(level.remove("room-c")).toBe(false);
		expect(level.levelCount()).toBe(before - 1);
		expect(() => {
			level.load("room-c");
		}).toThrow("level room-c not found");
		level.add("rooms", "room-c");
	});
});

describe("a loader type of the game's own that frees what it kept", () => {
	const kept = new Map();
	const freed = [];

	beforeAll(() => {
		boot();
		loader.setParser(
			"fmt-keeper",
			(asset, onload) => {
				kept.set(asset.name, { from: asset.src });
				onload();
				return 1;
			},
			{
				unload: (asset) => {
					freed.push(asset.name);
					return kept.delete(asset.name);
				},
			},
		);
		loader.setParser("fmt-no-unload", (asset, onload) => {
			onload();
			return 1;
		});
	});

	it("is asked to free an asset when its bundle is unloaded", async () => {
		loader.setBundle("fmt-bundle", [
			{ name: "fmt-one", type: "fmt-keeper", src: "one" },
			{ name: "fmt-two", type: "fmt-keeper", src: "two" },
		]);
		await loader.load("fmt-bundle");
		expect([...kept.keys()].sort()).toEqual(["fmt-one", "fmt-two"]);
		freed.length = 0;
		expect(loader.unload("fmt-bundle")).toBe(true);
		expect(freed.sort()).toEqual(["fmt-one", "fmt-two"]);
		expect(kept.size).toBe(0);
	});

	it("keeps an asset another bundle still holds", async () => {
		const shared = { name: "fmt-shared", type: "fmt-keeper", src: "s" };
		loader.setBundle("fmt-first", [shared]);
		loader.setBundle("fmt-second", [shared]);
		await loader.load("fmt-first");
		await loader.load("fmt-second");
		freed.length = 0;
		loader.unload("fmt-first");
		expect(freed).toEqual([]);
		expect(kept.has("fmt-shared")).toBe(true);
		loader.unload("fmt-second");
		expect(freed).toEqual(["fmt-shared"]);
	});

	it("is asked for a descriptor given to loader.unload, and says if it had it", async () => {
		await loader.preload(
			[{ name: "fmt-single", type: "fmt-keeper", src: "x" }],
			undefined,
			false,
		);
		expect(loader.unload({ name: "fmt-single", type: "fmt-keeper" })).toBe(
			true,
		);
		expect(loader.unload({ name: "fmt-single", type: "fmt-keeper" })).toBe(
			false,
		);
	});

	it("a type that gave no unload is left to the game, as before", async () => {
		loader.setBundle("fmt-plain", [
			{ name: "fmt-plain-one", type: "fmt-no-unload", src: "p" },
		]);
		await loader.load("fmt-plain");
		expect(loader.unload("fmt-plain")).toBe(true);
		expect(() => {
			loader.unload({ name: "fmt-plain-one", type: "fmt-no-unload" });
		}).toThrow(/unknown or invalid resource type/);
	});
});
