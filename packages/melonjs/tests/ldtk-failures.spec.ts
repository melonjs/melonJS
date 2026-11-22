import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Application,
	type LDtkProjectJson,
	level,
	loader,
	video,
} from "../src/index.js";
import { enter, makeApp, sampleURL } from "./helpers/ldtk-harness.ts";

/**
 * A project that cannot be loaded says why, leaves nothing behind, and does
 * not stand in the way of the next one: an image that is missing, a level
 * file that is missing, a file that is not a project.
 */
describe("an LDtk project that fails to load", () => {
	let app: Application;
	let good: LDtkProjectJson;
	const served = new Map<string, unknown>();
	const realFetch = globalThis.fetch.bind(globalThis);

	beforeAll(async () => {
		app = await makeApp(video.CANVAS);
		good = (await (
			await realFetch(sampleURL("AutoLayers_1_basic.ldtk"))
		).json()) as LDtkProjectJson;
		// files that exist for the test alone, beside the samples
		vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
			const url = typeof input === "string" ? input : (input as Request).url;
			for (const [file, body] of served) {
				if (url.endsWith(file)) {
					return Promise.resolve(
						body === undefined
							? new Response("not found", { status: 404 })
							: new Response(JSON.stringify(body), {
									status: 200,
									headers: { "Content-Type": "application/json" },
								}),
					);
				}
			}
			return realFetch(input, init);
		});
		vi.spyOn(console, "error").mockImplementation(() => {
			// the loader reports the asset that failed
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
		app.destroy();
	});

	/**
	 * the sample, naming another image for its tileset
	 * @param relPath - the image, relative to the project file
	 * @returns the project
	 */
	const withImage = (relPath: string): LDtkProjectJson => {
		const project = structuredClone(good);
		project.defs.tilesets[0].relPath = relPath;
		for (const entry of project.levels) {
			for (const layer of entry.layerInstances ?? []) {
				layer.__tilesetRelPath = relPath;
			}
		}
		return project;
	};

	// a file beside the samples that is not there: the bundler resolves
	// `sampleURL` against the files that are, so the name is put in by hand
	const beside = (file: string) => {
		return sampleURL("AutoLayers_1_basic.ldtk").replace(
			"AutoLayers_1_basic.ldtk",
			file,
		);
	};

	const preload = (name: string, file: string) => {
		return loader.preload(
			[{ name, type: "ldtk", src: beside(file) }],
			undefined,
			false,
		);
	};

	it("a tileset image that is missing: the load fails, naming it, and nothing is registered", async () => {
		served.set("missing-image.ldtk", withImage("atlas/ldtk-no-such-image.png"));
		const count = level.levelCount();
		let message = "";
		await preload("missing-image", "missing-image.ldtk").catch(
			(error: unknown) => {
				const cause = (error as { cause?: unknown }).cause;
				message = `${String(error)} ${String(cause)}`;
			},
		);
		expect(message).toContain("ldtk-no-such-image");
		expect(loader.getLDtk("missing-image")).toBeNull();
		expect(level.levelCount()).toBe(count);
		expect(loader.getImage("ldtk-no-such-image")).toBeNull();
	});

	it("does not stand in the way of a project that names the same image, once it is there", async () => {
		// the game loads an image under that name itself
		await loader.load({
			name: "ldtk-no-such-image",
			type: "image",
			src: beside("atlas/Cavernas_by_Adam_Saltsman.png"),
		});
		served.set("found-image.ldtk", withImage("atlas/ldtk-no-such-image.png"));
		await preload("found-image", "found-image.ldtk");
		expect(loader.getLDtk("found-image")?.levels).toHaveLength(1);
		await enter(app, "found-image:AutoLayer", { entities: false });
		const loaded = level.getCurrentLevel() as unknown as {
			layers: unknown[];
		};
		expect(loaded.layers.length).toBeGreaterThan(0);
		// the game's image is the game's: unloading the project leaves it
		expect(loader.unload({ name: "found-image", type: "ldtk" })).toBe(true);
		expect(loader.getImage("ldtk-no-such-image")).not.toBeNull();
		loader.unload({ name: "ldtk-no-such-image", type: "image" });
	});

	it("a failed project frees the images it had loaded before failing", async () => {
		// two tilesets: one there, one missing
		const project = withImage("atlas/Inca_back2_by_Kronbits.png");
		project.defs.tilesets.push({
			...project.defs.tilesets[0],
			uid: 9999,
			identifier: "Missing",
			relPath: "atlas/ldtk-another-missing.png",
		});
		served.set("half.ldtk", project);
		expect(loader.getImage("Inca_back2_by_Kronbits")).toBeNull();
		await expect(preload("half", "half.ldtk")).rejects.toThrow();
		expect(loader.getLDtk("half")).toBeNull();
		// the image that is there may still have been on its way when the
		// other failed: give it the time to arrive
		await new Promise((resolve) => {
			setTimeout(resolve, 500);
		});
		// nobody uses it: not left in the cache by a project that is not there
		expect(loader.getImage("Inca_back2_by_Kronbits")).toBeNull();
	});

	it("a level file that is missing: the load fails, naming the level", async () => {
		const project = structuredClone(good);
		project.externalLevels = true;
		project.levels[0].layerInstances = null;
		project.levels[0].externalRelPath = "no-such-folder/Level.ldtkl";
		served.set("missing-level.ldtk", project);
		served.set("no-such-folder/Level.ldtkl", undefined);
		const count = level.levelCount();
		let message = "";
		await preload("missing-level", "missing-level.ldtk").catch(
			(error: unknown) => {
				const cause = (error as { cause?: unknown }).cause;
				message = `${String(error)} ${String(cause)}`;
			},
		);
		expect(message).toContain("no-such-folder/Level.ldtkl");
		expect(loader.getLDtk("missing-level")).toBeNull();
		expect(level.levelCount()).toBe(count);
	});

	it("a project loaded again under the same name is loaded once", async () => {
		served.set("twice.ldtk", good);
		await preload("twice", "twice.ldtk");
		const project = loader.getLDtk("twice");
		const count = level.levelCount();
		await preload("twice", "twice.ldtk");
		expect(loader.getLDtk("twice")).toBe(project);
		expect(level.levelCount()).toBe(count);
		expect(loader.unload({ name: "twice", type: "ldtk" })).toBe(true);
		expect(level.levelCount()).toBe(count - 2);
	});
});
