import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	type Application,
	event,
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
					if (body instanceof Blob) {
						return Promise.resolve(new Response(body, { status: 200 }));
					}
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

	/**
	 * an image file for the test: a PNG of one color
	 * @param size - its width and height
	 * @returns the file's content
	 */
	const png = (size: number) => {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const c = canvas.getContext("2d") as CanvasRenderingContext2D;
		c.fillStyle = "#336699";
		c.fillRect(0, 0, size, size);
		return new Promise<Blob>((resolve) => {
			canvas.toBlob((blob) => {
				resolve(blob as Blob);
			}, "image/png");
		});
	};

	const width = (name: string) => {
		return (loader.getImage(name) as { width: number } | null)?.width;
	};

	it("an image two projects use is freed with the last of them, whichever goes first", async () => {
		served.set("shared-art/held.png", await png(16));
		served.set("holder-a.ldtk", withImage("shared-art/held.png"));
		served.set("holder-b.ldtk", withImage("shared-art/held.png"));
		await preload("holder-a", "holder-a.ldtk");
		await preload("holder-b", "holder-b.ldtk");
		expect(width("held")).toBe(16);
		// the one that loaded it goes first: the other still uses it
		expect(loader.unload({ name: "holder-a", type: "ldtk" })).toBe(true);
		expect(width("held")).toBe(16);
		expect(loader.unload({ name: "holder-b", type: "ldtk" })).toBe(true);
		expect(loader.getImage("held")).toBeNull();
		// and the other way round
		await preload("holder-a", "holder-a.ldtk");
		await preload("holder-b", "holder-b.ldtk");
		loader.unload({ name: "holder-b", type: "ldtk" });
		expect(width("held")).toBe(16);
		loader.unload({ name: "holder-a", type: "ldtk" });
		expect(loader.getImage("held")).toBeNull();
	});

	it("an image a bundle also lists stays while either the bundle or the project holds it", async () => {
		served.set("shared-art/bundled.png", await png(24));
		served.set("with-bundle.ldtk", withImage("shared-art/bundled.png"));
		await preload("with-bundle", "with-bundle.ldtk");
		expect(width("bundled")).toBe(24);
		loader.setBundle("ldtk-art", [
			{ name: "bundled", type: "image", src: beside("shared-art/bundled.png") },
		]);
		await loader.load("ldtk-art");
		// the bundle goes: the project still draws with the image
		loader.unload("ldtk-art");
		expect(width("bundled")).toBe(24);
		// the project goes too: nobody holds it
		loader.unload({ name: "with-bundle", type: "ldtk" });
		expect(loader.getImage("bundled")).toBeNull();

		// the other way round: the project goes, the bundle keeps it
		await preload("with-bundle", "with-bundle.ldtk");
		await loader.load("ldtk-art");
		loader.unload({ name: "with-bundle", type: "ldtk" });
		expect(width("bundled")).toBe(24);
		loader.unload("ldtk-art");
		expect(loader.getImage("bundled")).toBeNull();
	});

	it("an image the game loads by name after the project is the game's too: unloading the project keeps it", async () => {
		served.set("shared-art/claimed.png", await png(8));
		served.set("claimed.ldtk", withImage("shared-art/claimed.png"));
		await preload("claimed", "claimed.ldtk");
		expect(width("claimed")).toBe(8);
		await loader.preload(
			[
				{
					name: "claimed",
					type: "image",
					src: beside("shared-art/claimed.png"),
				},
			],
			undefined,
			false,
		);
		loader.unload({ name: "claimed", type: "ldtk" });
		expect(width("claimed")).toBe(8);
		loader.unload({ name: "claimed", type: "image" });
	});

	it("two images of one file name, in two folders, are each their own", async () => {
		served.set("folder-a/zztiles.png", await png(16));
		served.set("folder-b/zztiles.png", await png(48));
		const both = withImage("folder-a/zztiles.png");
		both.defs.tilesets.push({
			...both.defs.tilesets[0],
			uid: 7777,
			identifier: "Other",
			relPath: "folder-b/zztiles.png",
		});
		served.set("two-folders.ldtk", both);
		await preload("two-folders", "two-folders.ldtk");
		const project = loader.getLDtk("two-folders");
		const first = project?.images.get("folder-a/zztiles.png") ?? "";
		const second = project?.images.get("folder-b/zztiles.png") ?? "";
		expect(first).not.toBe(second);
		expect([width(first), width(second)].sort()).toEqual([16, 48]);
		// both go with the project
		loader.unload({ name: "two-folders", type: "ldtk" });
		expect(loader.getImage(first)).toBeNull();
		expect(loader.getImage(second)).toBeNull();
	});

	it("a project asked for twice at once is loaded once", async () => {
		served.set("at-once.ldtk", good);
		const count = level.levelCount();
		await Promise.all([
			loader.load({
				name: "at-once",
				type: "ldtk",
				src: beside("at-once.ldtk"),
			}),
			loader.load({
				name: "at-once",
				type: "ldtk",
				src: beside("at-once.ldtk"),
			}),
		]);
		expect(level.levelCount()).toBe(count + 2);
		await enter(app, "at-once:AutoLayer", { entities: false });
		// the level in the world is of the project the loader holds
		const loaded = level.getCurrentLevel() as unknown as { project: unknown };
		expect(loaded.project).toBe(loader.getLDtk("at-once"));
	});

	it("unloading the project of the level in the world stops it following the viewport", async () => {
		// loaded by the test before: in the world, following the viewport
		const loaded = level.getCurrentLevel() as unknown as {
			container: unknown;
		};
		expect(loaded.container).toBe(app.world);
		expect(loader.unload({ name: "at-once", type: "ldtk" })).toBe(true);
		expect(loaded.container).toBeUndefined();
		// the viewport is the game's again: a resize leaves its bounds alone
		app.viewport.setBounds(0, 0, 4321, 1234);
		event.emit(
			event.VIEWPORT_ONRESIZE,
			app.viewport.width,
			app.viewport.height,
		);
		expect(app.viewport.bounds.width).toBe(4321);
		expect(app.viewport.bounds.height).toBe(1234);
	});

	it("a project file from before LDtk had worlds, with no list of them, loads", async () => {
		const old = structuredClone(good) as Partial<LDtkProjectJson>;
		delete old.worlds;
		served.set("no-worlds.ldtk", old);
		await preload("no-worlds", "no-worlds.ldtk");
		const project = loader.getLDtk("no-worlds");
		expect(project?.levels).toHaveLength(1);
		expect(project?.worlds).toHaveLength(1);
		loader.unload({ name: "no-worlds", type: "ldtk" });
	});

	it("loader.unloadAll frees the projects, their levels and their images", async () => {
		served.set("shared-art/swept.png", await png(8));
		served.set("swept.ldtk", withImage("shared-art/swept.png"));
		await preload("swept", "swept.ldtk");
		expect(width("swept")).toBe(8);
		expect(level.levelCount()).toBeGreaterThan(0);
		loader.unloadAll();
		expect(loader.getLDtk("swept")).toBeNull();
		expect(loader.getImage("swept")).toBeNull();
		expect(level.levelCount()).toBe(0);
		// and it loads again
		await preload("swept", "swept.ldtk");
		expect(width("swept")).toBe(8);
		loader.unloadAll();
	});
});
