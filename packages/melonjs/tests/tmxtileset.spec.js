import { beforeAll, describe, expect, it } from "vitest";
import { boot, video } from "../src/index.js";
import Tile from "../src/level/tiled/TMXTile.js";
import TMXTileset from "../src/level/tiled/TMXTileset.js";
import { imgList } from "../src/loader/cache.js";

// create a small canvas to use as a fake tile image
function fakeImage(name, w = 64, h = 64) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
	return canvas;
}

describe("TMXTileset", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		// pre-register fake images of various sizes
		fakeImage("ground", 128, 128);
		fakeImage("large", 256, 256);
		fakeImage("spaced", 136, 136);
		fakeImage("tree", 32, 48);
		fakeImage("rock", 24, 24);
		fakeImage("house", 64, 80);
		fakeImage("crate", 16, 16);
		fakeImage("props", 32, 32);
		fakeImage("animated", 128, 64);
		fakeImage("offset", 64, 64);
		fakeImage("single", 32, 32);
	});

	// ==============================================================
	// Regular tileset (spritesheet)
	// ==============================================================
	describe("regular tileset (spritesheet)", () => {
		const data = {
			firstgid: 1,
			name: "ground",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			tilecount: 16,
			columns: 4,
			image: "ground.png",
		};

		it("should read basic properties", () => {
			const ts = new TMXTileset(data);
			expect(ts.name).toEqual("ground");
			expect(ts.tilewidth).toEqual(32);
			expect(ts.tileheight).toEqual(32);
			expect(ts.spacing).toEqual(0);
			expect(ts.margin).toEqual(0);
		});

		it("should compute firstgid and lastgid", () => {
			const ts = new TMXTileset(data);
			expect(ts.firstgid).toEqual(1);
			// 4 columns * 4 rows = 16 tiles
			expect(ts.lastgid).toEqual(16);
		});

		it("should not be a collection", () => {
			const ts = new TMXTileset(data);
			expect(ts.isCollection).toEqual(false);
		});

		it("should not be animated", () => {
			const ts = new TMXTileset(data);
			expect(ts.isAnimated).toEqual(false);
		});

		it("should store a reference to the tileset image", () => {
			const ts = new TMXTileset(data);
			expect(ts.image).toBeDefined();
			expect(ts.image.width).toEqual(128);
		});

		it("should create a texture atlas", () => {
			const ts = new TMXTileset(data);
			expect(ts.atlas).toBeDefined();
		});
	});

	// ==============================================================
	// Regular tileset with spacing and margin
	// ==============================================================
	describe("regular tileset with spacing and margin", () => {
		const data = {
			firstgid: 1,
			name: "spaced",
			tilewidth: 32,
			tileheight: 32,
			spacing: 2,
			margin: 1,
			tilecount: 16,
			columns: 4,
			image: "spaced.png",
		};

		it("should read spacing and margin", () => {
			const ts = new TMXTileset(data);
			expect(ts.spacing).toEqual(2);
			expect(ts.margin).toEqual(1);
		});

		it("should compute correct lastgid with spacing", () => {
			const ts = new TMXTileset(data);
			expect(ts.firstgid).toEqual(1);
			expect(ts.lastgid).toEqual(16);
		});
	});

	// ==============================================================
	// Explicit zero spacing and margin
	// ==============================================================
	describe("explicit zero spacing and margin", () => {
		it("should preserve explicit zero spacing", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "zero",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
			expect(ts.spacing).toEqual(0);
			expect(ts.margin).toEqual(0);
		});

		it("should default spacing and margin when not specified", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "nospacemargin",
				tilewidth: 32,
				tileheight: 32,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
			expect(ts.spacing).toEqual(0);
			expect(ts.margin).toEqual(0);
		});
	});

	// ==============================================================
	// Large tileset (many tiles, high firstgid)
	// ==============================================================
	describe("large tileset with non-zero firstgid", () => {
		const data = {
			firstgid: 100,
			name: "large",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			tilecount: 64,
			columns: 8,
			image: "large.png",
		};

		it("should handle high firstgid", () => {
			const ts = new TMXTileset(data);
			expect(ts.firstgid).toEqual(100);
			expect(ts.lastgid).toEqual(163);
		});

		it("contains() should work with high gids", () => {
			const ts = new TMXTileset(data);
			expect(ts.contains(99)).toEqual(false);
			expect(ts.contains(100)).toEqual(true);
			expect(ts.contains(163)).toEqual(true);
			expect(ts.contains(164)).toEqual(false);
		});

		it("getViewTileId() should return local id", () => {
			const ts = new TMXTileset(data);
			expect(ts.getViewTileId(100)).toEqual(0);
			expect(ts.getViewTileId(108)).toEqual(8);
			expect(ts.getViewTileId(163)).toEqual(63);
		});
	});

	// ==============================================================
	// Single tile tileset
	// ==============================================================
	describe("single tile tileset", () => {
		const data = {
			firstgid: 50,
			name: "single",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			tilecount: 1,
			columns: 1,
			image: "single.png",
		};

		it("firstgid should equal lastgid", () => {
			const ts = new TMXTileset(data);
			expect(ts.firstgid).toEqual(50);
			expect(ts.lastgid).toEqual(50);
		});

		it("contains() should only match the single gid", () => {
			const ts = new TMXTileset(data);
			expect(ts.contains(49)).toEqual(false);
			expect(ts.contains(50)).toEqual(true);
			expect(ts.contains(51)).toEqual(false);
		});
	});

	// ==============================================================
	// Collection of images tileset
	// ==============================================================
	describe("collection of images tileset", () => {
		const data = {
			firstgid: 10,
			name: "objects",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			tilecount: 3,
			columns: 0,
			tiles: [
				{ id: 0, image: "tree.png" },
				{ id: 1, image: "rock.png" },
				{ id: 2, image: "house.png" },
			],
		};

		it("should be a collection", () => {
			const ts = new TMXTileset(data);
			expect(ts.isCollection).toEqual(true);
		});

		it("should use Map for imageCollection", () => {
			const ts = new TMXTileset(data);
			expect(ts.imageCollection).toBeInstanceOf(Map);
			expect(ts.imageCollection.size).toEqual(3);
		});

		it("should use Map for tileProperties", () => {
			const ts = new TMXTileset(data);
			expect(ts.tileProperties).toBeInstanceOf(Map);
		});

		it("should not have a tileset image", () => {
			const ts = new TMXTileset(data);
			expect(ts.image).toBeUndefined();
		});

		it("getTileImage() should return images by gid", () => {
			const ts = new TMXTileset(data);
			expect(ts.getTileImage(10)).toBeDefined();
			expect(ts.getTileImage(10).width).toEqual(32);
			expect(ts.getTileImage(11)).toBeDefined();
			expect(ts.getTileImage(11).width).toEqual(24);
			expect(ts.getTileImage(12)).toBeDefined();
			expect(ts.getTileImage(12).width).toEqual(64);
		});

		it("getTileImage() should return undefined for invalid gids", () => {
			const ts = new TMXTileset(data);
			expect(ts.getTileImage(0)).toBeUndefined();
			expect(ts.getTileImage(9)).toBeUndefined();
			expect(ts.getTileImage(13)).toBeUndefined();
			expect(ts.getTileImage(99)).toBeUndefined();
		});
	});

	// ==============================================================
	// Collection with isCollection flag (Tiled 1.10+)
	// ==============================================================
	describe("isCollection flag", () => {
		it("should use explicit isCollection=true", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "flagged",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 0,
				columns: 0,
				isCollection: true,
				image: "ground.png",
			});
			expect(ts.isCollection).toEqual(true);
		});

		it("should use explicit isCollection=false even with tiles", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "flagged",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 1,
				columns: 1,
				isCollection: false,
				image: "ground.png",
				tiles: [{ id: 0, image: "tree.png" }],
			});
			expect(ts.isCollection).toEqual(false);
		});
	});

	// ==============================================================
	// Collection with properties on tiles
	// ==============================================================
	describe("collection tiles with properties", () => {
		const data = {
			firstgid: 10,
			name: "mixed",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			columns: 0,
			tiles: [
				{
					id: 0,
					image: "tree.png",
					properties: [{ name: "climbable", type: "bool", value: true }],
				},
				{
					id: 1,
					image: "rock.png",
					properties: [
						{ name: "destructible", type: "bool", value: false },
						{ name: "weight", type: "int", value: 50 },
					],
				},
				{ id: 2, image: "crate.png" },
			],
		};

		it("should read properties on collection tiles", () => {
			const ts = new TMXTileset(data);
			const treeProps = ts.getTileProperties(10);
			expect(treeProps).toBeDefined();
			expect(treeProps.climbable).toEqual(true);
		});

		it("should support multiple properties per tile", () => {
			const ts = new TMXTileset(data);
			const rockProps = ts.getTileProperties(11);
			expect(rockProps.destructible).toEqual(false);
			expect(rockProps.weight).toEqual(50);
		});

		it("should return undefined for tiles without properties", () => {
			const ts = new TMXTileset(data);
			expect(ts.getTileProperties(12)).toBeUndefined();
		});
	});

	// ==============================================================
	// Tile properties (JSON array and old flat formats)
	// ==============================================================
	describe("tile properties", () => {
		it("should read JSON array format properties", () => {
			const ts = new TMXTileset({
				firstgid: 20,
				name: "props",
				tilewidth: 16,
				tileheight: 16,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "props.png",
				tiles: [
					{
						id: 0,
						properties: [
							{ name: "solid", type: "bool", value: true },
							{ name: "type", type: "string", value: "wall" },
						],
					},
				],
			});
			const props = ts.getTileProperties(20);
			expect(props.solid).toEqual(true);
			expect(props.type).toEqual("wall");
		});

		it("should read old flat format (tileproperties)", () => {
			const ts = new TMXTileset({
				firstgid: 20,
				name: "props",
				tilewidth: 16,
				tileheight: 16,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "props.png",
				tileproperties: {
					0: { solid: true, type: "wall" },
					2: { solid: false },
				},
			});
			const props0 = ts.getTileProperties(20);
			expect(props0.solid).toEqual(true);
			const props2 = ts.getTileProperties(22);
			expect(props2.solid).toEqual(false);
		});

		it("should read XML flat object format properties", () => {
			const ts = new TMXTileset({
				firstgid: 20,
				name: "props",
				tilewidth: 16,
				tileheight: 16,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "props.png",
				tiles: [
					{
						id: 1,
						properties: { damage: 10, breakable: true },
					},
				],
			});
			const props = ts.getTileProperties(21);
			expect(props.damage).toEqual(10);
			expect(props.breakable).toEqual(true);
		});
	});

	// ==============================================================
	// Animated tileset
	// ==============================================================
	describe("animated tileset", () => {
		const data = {
			firstgid: 30,
			name: "animated",
			tilewidth: 32,
			tileheight: 32,
			spacing: 0,
			margin: 0,
			tilecount: 8,
			columns: 4,
			image: "animated.png",
			tiles: [
				{
					id: 0,
					animation: [
						{ tileid: 0, duration: 100 },
						{ tileid: 1, duration: 200 },
						{ tileid: 2, duration: 100 },
					],
				},
				{
					id: 4,
					animation: [
						{ tileid: 4, duration: 150 },
						{ tileid: 5, duration: 150 },
					],
				},
			],
		};

		it("should detect animated tiles", () => {
			const ts = new TMXTileset(data);
			expect(ts.isAnimated).toEqual(true);
		});

		it("should store multiple animations", () => {
			const ts = new TMXTileset(data);
			expect(ts.animations.size).toEqual(2);
		});

		it("getViewTileId() should return initial frame for animated tiles", () => {
			const ts = new TMXTileset(data);
			expect(ts.getViewTileId(30)).toEqual(0);
		});

		it("getViewTileId() should return local id for non-animated tiles", () => {
			const ts = new TMXTileset(data);
			expect(ts.getViewTileId(32)).toEqual(2);
			expect(ts.getViewTileId(33)).toEqual(3);
		});

		it("update() should advance animation frames", () => {
			const ts = new TMXTileset(data);
			// advance by 150ms — first anim (100ms duration) should move to frame 1
			const changed = ts.update(150);
			expect(changed).toEqual(true);
			expect(ts.getViewTileId(30)).toEqual(1);
		});

		it("update() should return false when no frames change", () => {
			const ts = new TMXTileset(data);
			// advance by 1ms — not enough to trigger any change
			const changed = ts.update(1);
			expect(changed).toEqual(false);
		});
	});

	// ==============================================================
	// Tile offset
	// ==============================================================
	describe("tile offset", () => {
		it("should read tile offset", () => {
			const ts = new TMXTileset({
				firstgid: 40,
				name: "offset",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "offset.png",
				tileoffset: { x: 8, y: -16 },
			});
			expect(ts.tileoffset.x).toEqual(8);
			expect(ts.tileoffset.y).toEqual(-16);
		});

		it("should default offset to (0,0) when not specified", () => {
			const ts = new TMXTileset({
				firstgid: 40,
				name: "nooffset",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "offset.png",
			});
			expect(ts.tileoffset.x).toEqual(0);
			expect(ts.tileoffset.y).toEqual(0);
		});
	});

	// ==============================================================
	// Tileset class property
	// ==============================================================
	describe("tileset class", () => {
		it("should read class property", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "classed",
				class: "terrain",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
			expect(ts.class).toEqual("terrain");
		});

		it("should be undefined when not set", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "noclassed",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
			expect(ts.class).toBeUndefined();
		});
	});

	// ==============================================================
	// contains() edge cases
	// ==============================================================
	describe("contains() edge cases", () => {
		it("should handle firstgid === lastgid (single tile)", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "single",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 1,
				columns: 1,
				image: "single.png",
			});
			expect(ts.contains(0)).toEqual(false);
			expect(ts.contains(1)).toEqual(true);
			expect(ts.contains(2)).toEqual(false);
		});

		it("should handle negative gids", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "ground",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
			expect(ts.contains(-1)).toEqual(false);
		});
	});

	// ==============================================================
	// Tile (TMXTile)
	// ==============================================================
	describe("Tile", () => {
		// helper to create a regular tileset for tile tests
		function makeRegularTileset() {
			return new TMXTileset({
				firstgid: 1,
				name: "ground",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 4,
				columns: 2,
				image: "ground.png",
			});
		}

		// helper to create a collection tileset
		function makeCollectionTileset() {
			return new TMXTileset({
				firstgid: 10,
				name: "objects",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				columns: 0,
				tiles: [
					{ id: 0, image: "tree.png" },
					{ id: 1, image: "rock.png" },
				],
			});
		}

		describe("basic construction", () => {
			it("should set col and row from constructor", () => {
				const tile = new Tile(3, 5, 1, makeRegularTileset());
				expect(tile.col).toEqual(3);
				expect(tile.row).toEqual(5);
			});

			it("should reference the tileset", () => {
				const ts = makeRegularTileset();
				const tile = new Tile(0, 0, 1, ts);
				expect(tile.tileset).toBe(ts);
			});

			it("should use tileset dimensions for regular tilesets", () => {
				const tile = new Tile(0, 0, 1, makeRegularTileset());
				expect(tile.width).toEqual(32);
				expect(tile.height).toEqual(32);
			});

			it("should use image dimensions for collection tilesets", () => {
				const tile = new Tile(0, 0, 10, makeCollectionTileset());
				// tree.png is 32x48
				expect(tile.width).toEqual(32);
				expect(tile.height).toEqual(48);
			});
		});

		describe("tileId and flip bit clearing", () => {
			it("should clear flip bits from tileId", () => {
				const ts = makeRegularTileset();
				// gid 2 with horizontal flip bit set
				const gid = 2 | 0x80000000;
				const tile = new Tile(0, 0, gid, ts);
				expect(tile.tileId).toEqual(2);
			});

			it("should preserve tileId when no flip bits", () => {
				const tile = new Tile(0, 0, 3, makeRegularTileset());
				expect(tile.tileId).toEqual(3);
			});
		});

		describe("flip flags", () => {
			it("should detect no flip", () => {
				const tile = new Tile(0, 0, 1, makeRegularTileset());
				expect(tile.flipped).toEqual(false);
				expect(tile.flippedX).toEqual(false);
				expect(tile.flippedY).toEqual(false);
				expect(tile.flippedAD).toEqual(false);
				expect(tile.currentTransform).toBeNull();
			});

			it("should detect horizontal flip", () => {
				const gid = 1 | 0x80000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.flipped).toEqual(true);
				expect(tile.flippedX).toEqual(true);
				expect(tile.flippedY).toEqual(false);
				expect(tile.flippedAD).toEqual(false);
			});

			it("should detect vertical flip", () => {
				const gid = 1 | 0x40000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.flipped).toEqual(true);
				expect(tile.flippedX).toEqual(false);
				expect(tile.flippedY).toEqual(true);
				expect(tile.flippedAD).toEqual(false);
			});

			it("should detect anti-diagonal flip", () => {
				const gid = 1 | 0x20000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.flipped).toEqual(true);
				expect(tile.flippedX).toEqual(false);
				expect(tile.flippedY).toEqual(false);
				expect(tile.flippedAD).toEqual(true);
			});

			it("should detect combined H+V flip", () => {
				const gid = 1 | 0x80000000 | 0x40000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.flipped).toEqual(true);
				expect(tile.flippedX).toEqual(true);
				expect(tile.flippedY).toEqual(true);
				expect(tile.flippedAD).toEqual(false);
			});

			it("should detect all three flips", () => {
				const gid = 1 | 0x80000000 | 0x40000000 | 0x20000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.flipped).toEqual(true);
				expect(tile.flippedX).toEqual(true);
				expect(tile.flippedY).toEqual(true);
				expect(tile.flippedAD).toEqual(true);
			});
		});

		describe("transform matrix", () => {
			it("should not create transform for non-flipped tiles", () => {
				const tile = new Tile(0, 0, 1, makeRegularTileset());
				expect(tile.currentTransform).toBeNull();
			});

			it("should create transform for flipped tiles", () => {
				const gid = 1 | 0x80000000;
				const tile = new Tile(0, 0, gid, makeRegularTileset());
				expect(tile.currentTransform).not.toBeNull();
				expect(tile.currentTransform.isIdentity()).toEqual(false);
			});

			it("should create different transforms for different flip combos", () => {
				const ts = makeRegularTileset();
				const hFlip = new Tile(0, 0, 1 | 0x80000000, ts);
				const vFlip = new Tile(0, 0, 1 | 0x40000000, ts);
				// transforms should be different
				expect(hFlip.currentTransform.val).not.toEqual(
					vFlip.currentTransform.val,
				);
			});
		});
	});
});
