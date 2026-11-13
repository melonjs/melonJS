import { afterEach, describe, expect, it, vi } from "vitest";
import { save } from "../src/index.js";

/**
 * `save.createCloudStorage({ data, write })` makes a storage for
 * `save.setStorage()` out of a platform's cloud save:
 *
 * - it starts from what the platform loaded (an object, its JSON, nothing)
 * - it holds every item in memory, so `save` never waits
 * - changes made together are saved in one `write()`, and writes are made one
 *   at a time, the next with the latest values
 * - a failed write is logged and saved again later; `flush()` saves now
 */

const KEYS = ["cs_score", "cs_level", "cs_name"];

// a write() that records what it is given, and can be held until released
const recorder = () => {
	const rec = {
		writes: [],
		active: 0,
		mostAtOnce: 0,
		held: false,
		release: undefined,
		failures: 0,
		write: async (items) => {
			rec.active++;
			rec.mostAtOnce = Math.max(rec.mostAtOnce, rec.active);
			rec.writes.push(items);
			if (rec.held) {
				await new Promise((resolve) => {
					rec.release = resolve;
				});
			} else {
				await new Promise((resolve) => {
					setTimeout(resolve, 5);
				});
			}
			rec.active--;
			if (rec.failures > 0) {
				rec.failures--;
				throw new Error("offline");
			}
		},
	};
	return rec;
};

const tick = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

describe("save.createCloudStorage()", () => {
	afterEach(() => {
		save.setStorage(localStorage);
		for (const key of KEYS) {
			save.remove(key);
			localStorage.removeItem(`me.save.${key}`);
		}
		vi.restoreAllMocks();
	});

	it("starts from what the platform loaded: an object, its JSON, or nothing", () => {
		const { write } = recorder();
		const items = { "me.save": '["cs_score"]', "me.save.cs_score": "5" };
		expect(
			save
				.createCloudStorage({ data: items, write })
				.getItem("me.save.cs_score"),
		).toBe("5");
		expect(
			save
				.createCloudStorage({ data: JSON.stringify(items), write })
				.getItem("me.save.cs_score"),
		).toBe("5");
		for (const data of [undefined, null, ""]) {
			expect(
				save.createCloudStorage({ data, write }).getItem("me.save"),
			).toBeNull();
		}
	});

	it("takes values a platform handed back already parsed", () => {
		const { write } = recorder();
		const cloud = save.createCloudStorage({
			data: { "me.save": ["cs_score"], "me.save.cs_score": 5 },
			write,
		});
		expect(cloud.getItem("me.save")).toBe('["cs_score"]');
		expect(cloud.getItem("me.save.cs_score")).toBe("5");
	});

	it("starts empty, and says so, from data that is not valid JSON", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { write } = recorder();
		const cloud = save.createCloudStorage({ data: "{not json", write });
		expect(cloud.getItem("me.save")).toBeNull();
		expect(error).toHaveBeenCalled();
	});

	it("save reads the cloud's values, and saves its changes there", async () => {
		const rec = recorder();
		const cloud = save.createCloudStorage({
			data: { "me.save": '["cs_score"]', "me.save.cs_score": "7" },
			write: rec.write,
		});
		save.setStorage(cloud);
		const store = save.add({ cs_score: 0 });
		expect(store.cs_score).toBe(7);
		store.cs_score = 9;
		await cloud.flush();
		expect(rec.writes.at(-1)["me.save.cs_score"]).toBe("9");
		// and not to localStorage
		expect(localStorage.getItem("me.save.cs_score")).toBeNull();
	});

	it("saves the changes made together in one write", async () => {
		const rec = recorder();
		const cloud = save.createCloudStorage({ write: rec.write });
		save.setStorage(cloud);
		save.add({ cs_score: 1, cs_level: 2 });
		await cloud.flush();
		expect(rec.writes.length).toBe(1);
		expect(rec.writes[0]).toMatchObject({
			"me.save.cs_score": "1",
			"me.save.cs_level": "2",
		});
	});

	it("writes one at a time, the next with the latest values", async () => {
		const rec = recorder();
		rec.held = true;
		const cloud = save.createCloudStorage({ write: rec.write });
		cloud.setItem("me.save.cs_name", JSON.stringify("Ada"));
		await tick();
		// the first write is under way, and held
		expect(rec.writes.length).toBe(1);
		cloud.setItem("me.save.cs_name", JSON.stringify("Grace"));
		cloud.setItem("me.save.cs_name", JSON.stringify("Hedy"));
		await tick();
		expect(rec.writes.length).toBe(1);
		rec.held = false;
		rec.release();
		await cloud.flush();
		// one more write, with the latest value, never two at once
		expect(rec.writes.length).toBe(2);
		expect(rec.writes[1]["me.save.cs_name"]).toBe('"Hedy"');
		// each write was handed its own copy: the first kept what it was sent
		expect(rec.writes[0]["me.save.cs_name"]).toBe('"Ada"');
		expect(rec.mostAtOnce).toBe(1);
	});

	it("keeps what a failed write did not save, and saves it again", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const rec = recorder();
		rec.failures = 1;
		const cloud = save.createCloudStorage({ write: rec.write });
		cloud.setItem("me.save.cs_score", "3");
		await cloud.flush();
		expect(error).toHaveBeenCalled();
		expect(rec.writes.length).toBe(1);
		// flush() tries again, with the same items
		await cloud.flush();
		expect(rec.writes.length).toBe(2);
		expect(rec.writes[1]["me.save.cs_score"]).toBe("3");
		// and nothing is left to save
		await cloud.flush();
		expect(rec.writes.length).toBe(2);
	});

	it("flush() resolves at once, and writes nothing, when nothing changed", async () => {
		const rec = recorder();
		const cloud = save.createCloudStorage({
			data: { a: "1" },
			write: rec.write,
		});
		await cloud.flush();
		// removing what is not there is no change either
		cloud.removeItem("me.save.cs_level");
		await cloud.flush();
		expect(rec.writes.length).toBe(0);
	});

	it("is not a key that add() can register", () => {
		save.add({ cs_score: 1, createCloudStorage: 2 });
		expect(typeof save.createCloudStorage).toBe("function");
	});
});
