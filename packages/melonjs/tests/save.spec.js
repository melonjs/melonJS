import { describe, expect, it } from "vitest";
import { device, save } from "../src/index.js";

describe("local Storage", () => {
	it("add and retrieve keys", () => {
		if (device.localStorage === true) {
			save.add({ testKey1: 1, testKey2: 2 });
			expect(save.testKey1).toBe(1);
			expect(device.getStorage().testKey2).toBe(2);
		} else {
			// localStorage not supported in the testing environment
			expect(true).toBe(true);
		}
	});

	it("remove keys", () => {
		if (device.localStorage === true) {
			// access through getStorage
			const localStorage = device.getStorage("local");
			// both value should still be there
			expect(localStorage.testKey1).toBe(1);
			expect(localStorage.testKey2).toBe(2);
			localStorage.remove("testKey1");
			localStorage.remove("testKey2");
			expect(localStorage.testKey1).toBeUndefined();
			expect(localStorage.testKey2).toBeUndefined();
		} else {
			// localStorage not supported in the testing environment
			expect(true).toBe(true);
		}
	});
});
