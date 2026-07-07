import { afterAll, describe, expect, it } from "vitest";
import { loader } from "../src/index.js";

describe("loader asset descriptor hygiene (audit fixes)", () => {
	afterAll(() => {
		loader.setBaseURL("json", "");
	});

	it("load() leaves asset.src untouched, so retrying the same object never double-prepends baseURL", async () => {
		loader.setBaseURL("json", "missing-fixture-dir/");
		const asset = {
			name: "src-mutation-probe",
			type: "json",
			src: "probe.json",
		};

		// pre-fix: load() wrote the baseURL-prepended url back into asset.src,
		// so loader.reload() (which re-loads the SAME stored object) — or any
		// caller retrying its own manifest entry — fetched base+base+src
		await expect(loader.load(asset)).rejects.toThrow();
		expect(asset.src).toBe("probe.json");

		await expect(loader.load(asset)).rejects.toThrow();
		expect(asset.src).toBe("probe.json");
	});

	it("unload() of a never-loaded fontface returns false instead of throwing", () => {
		// pre-fix: document.fonts.delete(fontList[name]) with undefined threw a
		// WebIDL TypeError — every other asset type guards membership first
		let result;
		expect(() => {
			result = loader.unload({ name: "never-loaded-ff", type: "fontface" });
		}).not.toThrow();
		expect(result).toBe(false);
	});
});
