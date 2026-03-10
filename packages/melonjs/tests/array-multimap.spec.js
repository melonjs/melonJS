import { beforeEach, describe, expect, it } from "vitest";
import { ArrayMultimap } from "../src/utils/array-multimap.js";

describe("ArrayMultimap", () => {
	let map;

	beforeEach(() => {
		map = new ArrayMultimap();
	});

	describe("put / get", () => {
		it("should store and retrieve a single value", () => {
			map.put("a", 1);
			expect(map.get("a")).toEqual([1]);
		});

		it("should store multiple values under the same key", () => {
			map.put("a", 1);
			map.put("a", 2);
			map.put("a", 3);
			expect(map.get("a")).toEqual([1, 2, 3]);
		});

		it("should keep values separate per key", () => {
			map.put("a", 1);
			map.put("b", 2);
			expect(map.get("a")).toEqual([1]);
			expect(map.get("b")).toEqual([2]);
		});

		it("should return an empty array for a non-existent key", () => {
			expect(map.get("missing")).toEqual([]);
		});

		it("should support object keys", () => {
			const key = { id: 1 };
			map.put(key, "value");
			expect(map.get(key)).toEqual(["value"]);
		});

		it("should preserve insertion order for values", () => {
			map.put("k", "c");
			map.put("k", "a");
			map.put("k", "b");
			expect(map.get("k")).toEqual(["c", "a", "b"]);
		});
	});

	describe("has", () => {
		it("should return true for an existing key", () => {
			map.put("a", 1);
			expect(map.has("a")).toEqual(true);
		});

		it("should return false for a non-existent key", () => {
			expect(map.has("a")).toEqual(false);
		});

		it("should return false after key is deleted", () => {
			map.put("a", 1);
			map.delete("a");
			expect(map.has("a")).toEqual(false);
		});
	});

	describe("delete", () => {
		it("should remove all values for a key", () => {
			map.put("a", 1);
			map.put("a", 2);
			map.delete("a");
			expect(map.get("a")).toEqual([]);
		});

		it("should not affect other keys", () => {
			map.put("a", 1);
			map.put("b", 2);
			map.delete("a");
			expect(map.get("b")).toEqual([2]);
		});

		it("should not throw when deleting a non-existent key", () => {
			expect(() => {
				return map.delete("missing");
			}).not.toThrow();
		});
	});

	describe("forEach", () => {
		it("should iterate over all value-key pairs", () => {
			map.put("a", 1);
			map.put("b", 2);
			const pairs = [];
			map.forEach((value, key) => {
				pairs.push([key, value]);
			});
			expect(pairs).toEqual([
				["a", 1],
				["b", 2],
			]);
		});

		it("should iterate over each value when a key has multiple values", () => {
			map.put("a", 1);
			map.put("a", 2);
			map.put("a", 3);
			const values = [];
			map.forEach((value, key) => {
				expect(key).toEqual("a");
				values.push(value);
			});
			expect(values).toEqual([1, 2, 3]);
		});

		it("should not call callback on empty map", () => {
			let called = false;
			map.forEach(() => {
				called = true;
			});
			expect(called).toEqual(false);
		});
	});

	describe("clear", () => {
		it("should remove all entries", () => {
			map.put("a", 1);
			map.put("b", 2);
			map.put("a", 3);
			map.clear();
			expect(map.get("a")).toEqual([]);
			expect(map.get("b")).toEqual([]);
			expect(map.has("a")).toEqual(false);
			expect(map.has("b")).toEqual(false);
		});

		it("should allow adding entries after clear", () => {
			map.put("a", 1);
			map.clear();
			map.put("a", 2);
			expect(map.get("a")).toEqual([2]);
		});
	});
});
