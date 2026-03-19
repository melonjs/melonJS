import { beforeAll, describe, expect, it } from "vitest";
import { audio, boot, event, loader } from "../src/index.js";

describe("loader", () => {
	let audioURI;
	let imgURI;

	beforeAll(async () => {
		audioURI =
			"data:audio/mpeg;base64,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";

		imgURI =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

		boot();
		audio.init("mp3,ogg");
	});

	it("configure the preloader", async () => {
		loader.setOptions({ crossOrigin: "anonymous" });
		expect(loader.crossOrigin === "anonymous").toEqual(true);
	});

	it("should load supported audio assets", async () => {
		await expect(
			new Promise((resolve, reject) => {
				loader.load(
					{
						name: "silence",
						type: "audio",
						src: "/data/sfx/",
					},
					() => {
						resolve(true);
					},
					() => {
						reject(new Error("Failed to load `rect.png`"));
					},
				);
			}),
		).resolves.toBe(true);
	});

	it("should load base64 encoded audio assets", async () => {
		await expect(
			new Promise((resolve, reject) => {
				loader.load(
					{
						name: "silence2",
						type: "audio",
						src: audioURI,
					},
					() => {
						resolve(true);
					},
					() => {
						reject(new Error("Failed to load `rect.png`"));
					},
				);
			}),
		).resolves.toBe(true);
	});

	it("should load image asset", async () => {
		await expect(
			new Promise((resolve, reject) => {
				loader.load(
					{
						name: "testimage",
						type: "image",
						src: "/data/img/rect.png",
					},
					() => {
						resolve(loader.getImage("testimage") !== null);
					},
					() => {
						reject(new Error("Failed to load `rect.png`"));
					},
				);
			}),
		).resolves.toBe(true);
	});

	it("should load base64 encoded image asset", async () => {
		await expect(
			new Promise((resolve, reject) => {
				loader.load(
					{
						name: "testimage2",
						type: "image",
						src: imgURI,
					},
					() => {
						resolve(loader.getImage("testimage2") !== null);
					},
					() => {
						reject(new Error("Failed to load `rect.png`"));
					},
				);
			}),
		).resolves.toBe(true);
	});

	it("should unload image asset", async () => {
		loader.unload({ name: "testimage", type: "image" });
		loader.unload({ name: "testimage2", type: "image" });

		expect(
			loader.getImage("testimage") === null &&
				loader.getImage("testimage2") === null,
		).toEqual(true);
	});

	it("should preload multiple assets and call completion callback", async () => {
		await expect(
			new Promise((resolve) => {
				loader.preload(
					[
						{
							name: "preload_img1",
							type: "image",
							src: "/data/img/rect.png",
						},
						{
							name: "preload_img2",
							type: "image",
							src: "/data/img/rect.png",
						},
					],
					() => {
						resolve(true);
					},
					false,
				);
			}),
		).resolves.toBe(true);

		// cleanup
		loader.unload({ name: "preload_img1", type: "image" });
		loader.unload({ name: "preload_img2", type: "image" });
	});

	it("should skip already loaded assets without duplicating", async () => {
		// load an image first
		await new Promise((resolve) => {
			loader.load(
				{ name: "dedup_img", type: "image", src: "/data/img/rect.png" },
				() => {
					resolve();
				},
			);
		});

		const firstRef = loader.getImage("dedup_img");
		expect(firstRef).not.toBeNull();

		// loading the same asset again should return 0 (already loaded)
		const count = loader.load(
			{ name: "dedup_img", type: "image", src: "/data/img/rect.png" },
			() => {},
		);
		expect(count).toBe(0);

		// the reference should be the same object
		expect(loader.getImage("dedup_img")).toBe(firstRef);

		// cleanup
		loader.unload({ name: "dedup_img", type: "image" });
	});

	it("should report progress via LOADER_PROGRESS event", async () => {
		const progressValues = [];

		const listener = (progress) => {
			progressValues.push(progress);
		};

		event.on(event.LOADER_PROGRESS, listener);

		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "progress_img1",
						type: "image",
						src: "/data/img/rect.png",
					},
					{
						name: "progress_img2",
						type: "image",
						src: "/data/img/rect.png",
					},
				],
				() => {
					resolve();
				},
				false,
			);
		});

		// should have received progress callbacks
		expect(progressValues.length).toBeGreaterThan(0);

		// last progress value should be 1 (100%)
		expect(progressValues[progressValues.length - 1]).toBe(1);

		// progress should be monotonically increasing
		for (let i = 1; i < progressValues.length; i++) {
			expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
		}

		// cleanup
		event.off(event.LOADER_PROGRESS, listener);
		loader.unload({ name: "progress_img1", type: "image" });
		loader.unload({ name: "progress_img2", type: "image" });
	});

	it("should emit LOADER_PROGRESS events", async () => {
		const events = [];

		const listener = (progress, res) => {
			events.push({ progress, name: res.name });
		};

		event.on(event.LOADER_PROGRESS, listener);

		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "event_img",
						type: "image",
						src: "/data/img/rect.png",
					},
				],
				() => {
					resolve();
				},
				false,
			);
		});

		expect(events.length).toBeGreaterThan(0);
		expect(events[events.length - 1].name).toBe("event_img");

		// cleanup
		event.off(event.LOADER_PROGRESS, listener);
		loader.unload({ name: "event_img", type: "image" });
	});

	it("should set and get base URL for asset types", () => {
		loader.setBaseURL("image", "assets/img/");
		expect(loader.baseURL["image"]).toBe("assets/img/");

		// reset
		loader.setBaseURL("image", "./");
	});

	it("should set base URL for all types with wildcard", () => {
		loader.setBaseURL("*", "https://cdn.example.com/");

		expect(loader.baseURL["image"]).toBe("https://cdn.example.com/");
		expect(loader.baseURL["audio"]).toBe("https://cdn.example.com/");
		expect(loader.baseURL["json"]).toBe("https://cdn.example.com/");
		expect(loader.baseURL["binary"]).toBe("https://cdn.example.com/");
		expect(loader.baseURL["tmx"]).toBe("https://cdn.example.com/");
		expect(loader.baseURL["fontface"]).toBe("https://cdn.example.com/");

		// reset
		loader.setBaseURL("*", "./");
	});

	it("should strip url() wrapper from fontface src before applying baseURL", () => {
		loader.setBaseURL("fontface", "assets/");

		// simulate what load() does: strip url() then prepend baseURL
		const asset1 = {
			name: "font1",
			type: "fontface",
			src: "url(font/test.woff2)",
		};
		const asset2 = { name: "font2", type: "fontface", src: "font/test.woff2" };

		// strip url() wrapper for fontface assets
		if (asset1.src.startsWith("url(")) {
			asset1.src = asset1.src.slice(4, -1);
		}
		if (asset2.src.startsWith("url(")) {
			asset2.src = asset2.src.slice(4, -1);
		}

		// apply baseURL
		asset1.src = loader.baseURL[asset1.type] + asset1.src;
		asset2.src = loader.baseURL[asset2.type] + asset2.src;

		// both should resolve to the same path
		expect(asset1.src).toBe("assets/font/test.woff2");
		expect(asset2.src).toBe("assets/font/test.woff2");

		// reset
		loader.setBaseURL("fontface", "./");
	});

	it("should configure loader options", () => {
		loader.setOptions({
			crossOrigin: "use-credentials",
			withCredentials: true,
		});

		expect(loader.crossOrigin).toBe("use-credentials");
		expect(loader.withCredentials).toBe(true);

		// reset
		loader.setOptions({
			crossOrigin: "anonymous",
			withCredentials: false,
		});
	});

	it("should throw on unknown asset type", () => {
		expect(() => {
			loader.load({ name: "test", type: "unknown", src: "test.xyz" });
		}).toThrow();
	});

	it("should throw on invalid parser function", () => {
		expect(() => {
			loader.setParser("custom", "not a function");
		}).toThrow();
	});

	it("should allow registering a custom parser", async () => {
		loader.setParser("custom", (data, onload) => {
			if (typeof onload === "function") {
				onload();
			}
			return 1;
		});

		await expect(
			new Promise((resolve) => {
				loader.load(
					{ name: "custom_asset", type: "custom", src: "test" },
					() => {
						resolve(true);
					},
				);
			}),
		).resolves.toBe(true);
	});

	it("should return null for non-existent assets", () => {
		expect(loader.getImage("nonexistent")).toBeNull();
		expect(loader.getJSON("nonexistent")).toBeNull();
		expect(loader.getTMX("nonexistent")).toBeNull();
		expect(loader.getBinary("nonexistent")).toBeNull();
		expect(loader.getVideo("nonexistent")).toBeNull();
		expect(loader.getFont("nonexistent")).toBeNull();
	});

	it("should return false when unloading non-existent assets", () => {
		expect(loader.unload({ name: "nope", type: "image" })).toBe(false);
		expect(loader.unload({ name: "nope", type: "json" })).toBe(false);
		expect(loader.unload({ name: "nope", type: "binary" })).toBe(false);
		expect(loader.unload({ name: "nope", type: "tmx" })).toBe(false);
		expect(loader.unload({ name: "nope", type: "video" })).toBe(false);
	});
});
