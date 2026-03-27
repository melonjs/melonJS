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

		it("should handle old JSON format (object-keyed tiles without id)", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "oldfmt",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 8,
				columns: 4,
				image: "animated.png",
				tiles: {
					0: {
						animation: [
							{ tileid: 0, duration: 100 },
							{ tileid: 1, duration: 100 },
						],
					},
				},
			});
			expect(ts.isAnimated).toEqual(true);
			expect(ts.animations.has(0)).toEqual(true);
			expect(ts.getViewTileId(1)).toEqual(0);
		});

		it("should key animations by tile.id, not first frame tileid", () => {
			// tile id=3 has animation starting with frame tileid=0
			const ts = new TMXTileset({
				firstgid: 1,
				name: "anim",
				tilewidth: 32,
				tileheight: 32,
				spacing: 0,
				margin: 0,
				tilecount: 8,
				columns: 4,
				image: "animated.png",
				tiles: [
					{
						id: 3,
						animation: [
							{ tileid: 0, duration: 100 },
							{ tileid: 1, duration: 100 },
						],
					},
				],
			});
			// animation should be keyed by tile.id (3), not anim[0].tileid (0)
			expect(ts.animations.has(3)).toEqual(true);
			expect(ts.animations.has(0)).toEqual(false);
			// getViewTileId for gid 4 (firstgid 1 + local 3) should return animated frame
			expect(ts.getViewTileId(4)).toEqual(0);
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

	// ==============================================================
	// Tile sub-rectangles (Tiled 1.9+, collection tilesets only)
	// ==============================================================
	describe("tile sub-rectangles (Tiled 1.9+)", () => {
		function makeCollectionWithSubRect(tileData) {
			fakeImage("subrect", 64, 64);
			return new TMXTileset({
				firstgid: 1,
				name: "subcollection",
				tilewidth: 32,
				tileheight: 32,
				tilecount: 1,
				columns: 0,
				tiles: [
					{
						id: 0,
						image: "subrect.png",
						imagewidth: 64,
						imageheight: 64,
						...tileData,
					},
				],
			});
		}

		it("should store sub-rectangle from tile entry", () => {
			const ts = makeCollectionWithSubRect({
				x: 10,
				y: 5,
				width: 40,
				height: 30,
			});
			expect(ts.tileSubRects.size).toEqual(1);
			const rect = ts.tileSubRects.get(0);
			expect(rect.x).toEqual(10);
			expect(rect.y).toEqual(5);
			expect(rect.width).toEqual(40);
			expect(rect.height).toEqual(30);
		});

		it("should default width/height to image dimensions when not specified", () => {
			const ts = makeCollectionWithSubRect({ x: 10, y: 5 });
			const rect = ts.tileSubRects.get(0);
			expect(rect.x).toEqual(10);
			expect(rect.y).toEqual(5);
			// defaults to the full image dimensions (64x64)
			expect(rect.width).toEqual(64);
			expect(rect.height).toEqual(64);
		});

		it("should return a cropped image from getTileImage", () => {
			const ts = makeCollectionWithSubRect({
				x: 10,
				y: 10,
				width: 40,
				height: 30,
			});
			const image = ts.getTileImage(1); // gid = firstgid + 0
			expect(image.width).toEqual(40);
			expect(image.height).toEqual(30);
			// should be a canvas (cropped), not the original image
			expect(image.tagName).toEqual("CANVAS");
		});

		it("should return the original image when sub-rect matches full image", () => {
			const ts = makeCollectionWithSubRect({
				x: 0,
				y: 0,
				width: 64,
				height: 64,
			});
			const image = ts.getTileImage(1);
			// no cropping needed, should be the original canvas (not a new one)
			expect(image.width).toEqual(64);
			expect(image.height).toEqual(64);
		});

		it("should use sub-rectangle dimensions for Tile bounds", () => {
			const ts = makeCollectionWithSubRect({
				x: 10,
				y: 10,
				width: 40,
				height: 30,
			});
			const tile = new Tile(0, 0, 1, ts);
			expect(tile.width).toEqual(40);
			expect(tile.height).toEqual(30);
		});

		it("should fall back to image dimensions when sub-rect has no width/height", () => {
			const ts = makeCollectionWithSubRect({ x: 5, y: 5 });
			const tile = new Tile(0, 0, 1, ts);
			// defaults to full image dimensions (64x64)
			expect(tile.width).toEqual(64);
			expect(tile.height).toEqual(64);
		});

		it("should fall back to image dimensions when no sub-rectangle", () => {
			const ts = new TMXTileset({
				firstgid: 1,
				name: "nocollection",
				tilewidth: 32,
				tileheight: 32,
				tilecount: 1,
				columns: 0,
				tiles: [
					{
						id: 0,
						image: "house.png",
						imagewidth: 64,
						imageheight: 80,
					},
				],
			});
			const tile = new Tile(0, 0, 1, ts);
			expect(tile.width).toEqual(64);
			expect(tile.height).toEqual(80);
		});

		it("should parse sub-rectangles from XML object-keyed format", () => {
			fakeImage("xmlsub", 64, 64);
			const ts = new TMXTileset({
				firstgid: 1,
				name: "xmlcollection",
				tilewidth: 32,
				tileheight: 32,
				tilecount: 1,
				columns: 0,
				tiles: {
					0: {
						image: "xmlsub.png",
						imagewidth: 64,
						imageheight: 64,
						x: 5,
						y: 10,
						width: 28,
						height: 30,
					},
				},
			});
			expect(ts.tileSubRects.size).toEqual(1);
			const rect = ts.tileSubRects.get(0);
			expect(rect.x).toEqual(5);
			expect(rect.y).toEqual(10);
			expect(rect.width).toEqual(28);
			expect(rect.height).toEqual(30);
		});

		it("should ignore sub-rectangle attributes on spritesheet tiles", () => {
			// Tiled never generates sub-rects for spritesheet tilesets;
			// sub-rects are only parsed for tiles with a per-tile image
			const ts = new TMXTileset({
				firstgid: 1,
				name: "ground",
				tilewidth: 32,
				tileheight: 32,
				tilecount: 16,
				columns: 4,
				image: "ground.png",
				tiles: [{ id: 0, x: 10, y: 5, width: 20, height: 24 }],
			});
			// no sub-rects stored (no per-tile image)
			expect(ts.tileSubRects.size).toEqual(0);
			const entry = ts.atlas["0"];
			// atlas entry uses grid-based offset
			expect(entry.offset.x).toEqual(0);
			expect(entry.offset.y).toEqual(0);
			expect(entry.width).toEqual(32);
			expect(entry.height).toEqual(32);
		});
	});

	// ==============================================================
	// tilerendersize and fillmode (Tiled 1.9+)
	// ==============================================================
	describe("tilerendersize and fillmode (Tiled 1.9+)", () => {
		function makeTileset(overrides, mapTilewidth, mapTileheight) {
			return new TMXTileset(
				{
					firstgid: 1,
					name: "ground",
					tilewidth: 48,
					tileheight: 48,
					spacing: 0,
					margin: 0,
					tilecount: 4,
					columns: 2,
					image: "large.png",
					...overrides,
				},
				mapTilewidth,
				mapTileheight,
			);
		}

		it("should default tilerendersize to 'tile'", () => {
			const ts = makeTileset({}, 16, 16);
			expect(ts.tilerendersize).toEqual("tile");
		});

		it("should default fillmode to 'stretch'", () => {
			const ts = makeTileset({}, 16, 16);
			expect(ts.fillmode).toEqual("stretch");
		});

		it("should store tilerendersize from tileset data", () => {
			const ts = makeTileset({ tilerendersize: "grid" }, 16, 16);
			expect(ts.tilerendersize).toEqual("grid");
		});

		it("should store fillmode from tileset data", () => {
			const ts = makeTileset({ fillmode: "preserve-aspect-fit" }, 16, 16);
			expect(ts.fillmode).toEqual("preserve-aspect-fit");
		});

		it("should store map grid dimensions", () => {
			const ts = makeTileset({}, 16, 16);
			expect(ts.mapTilewidth).toEqual(16);
			expect(ts.mapTileheight).toEqual(16);
		});

		it("should default map grid to tileset size when not provided", () => {
			const ts = makeTileset({});
			expect(ts.mapTilewidth).toEqual(48);
			expect(ts.mapTileheight).toEqual(48);
		});

		describe("spritesheet with tilerendersize='tile' (default)", () => {
			it("should not scale tiles (scale = 1)", () => {
				const ts = makeTileset({}, 16, 16);
				expect(ts._renderScaleX).toEqual(1);
				expect(ts._renderScaleY).toEqual(1);
				expect(ts._renderDw).toEqual(48);
				expect(ts._renderDh).toEqual(48);
				expect(ts._renderDyOffset).toEqual(0);
			});
		});

		describe("spritesheet with tilerendersize='grid', fillmode='stretch'", () => {
			it("should precompute stretch scale to map grid size", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 16, 16);
				expect(ts._renderScaleX).toBeCloseTo(16 / 48);
				expect(ts._renderScaleY).toBeCloseTo(16 / 48);
				expect(ts._renderDw).toBeCloseTo(16);
				expect(ts._renderDh).toBeCloseTo(16);
			});

			it("should precompute dy offset for bottom-alignment correction", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 16, 16);
				// tileheight(48) - renderDh(16) = 32
				expect(ts._renderDyOffset).toBeCloseTo(32);
			});

			it("should not apply centering offsets", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 16, 16);
				expect(ts._renderDxCenter).toEqual(0);
				expect(ts._renderDyCenter).toEqual(0);
			});

			it("should handle non-square scaling", () => {
				// 48x48 tiles on 32x16 grid
				const ts = makeTileset({ tilerendersize: "grid" }, 32, 16);
				expect(ts._renderScaleX).toBeCloseTo(32 / 48);
				expect(ts._renderScaleY).toBeCloseTo(16 / 48);
				expect(ts._renderDw).toBeCloseTo(32);
				expect(ts._renderDh).toBeCloseTo(16);
			});
		});

		describe("spritesheet with tilerendersize='grid', fillmode='preserve-aspect-fit'", () => {
			it("should use uniform scale (min of x/y)", () => {
				// 48x48 tiles on 32x16 grid → min(32/48, 16/48) = 16/48
				const ts = makeTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					32,
					16,
				);
				const expectedScale = 16 / 48;
				expect(ts._renderScaleX).toBeCloseTo(expectedScale);
				expect(ts._renderScaleY).toBeCloseTo(expectedScale);
				expect(ts._renderDw).toBeCloseTo(16);
				expect(ts._renderDh).toBeCloseTo(16);
			});

			it("should precompute centering offsets", () => {
				// 48x48 tiles on 32x16 grid, uniform scale = 16/48
				// renderDw = 16, renderDh = 16
				// dxCenter = (32 - 16) / 2 = 8
				// dyCenter = -(16 - 16) / 2 = 0
				const ts = makeTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					32,
					16,
				);
				expect(ts._renderDxCenter).toBeCloseTo(8);
				expect(ts._renderDyCenter).toBeCloseTo(0);
			});

			it("should compute centering when tile is smaller than grid on one axis", () => {
				// 48x48 tiles on 16x32 grid, uniform scale = 16/48
				// renderDw = 16, renderDh = 16
				// dxCenter = (16 - 16) / 2 = 0
				// dyCenter = -(32 - 16) / 2 = -8
				const ts = makeTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					16,
					32,
				);
				expect(ts._renderDxCenter).toBeCloseTo(0);
				expect(ts._renderDyCenter).toBeCloseTo(-8);
			});

			it("should use square scale for square grid", () => {
				// 48x48 tiles on 24x24 grid → scale = 0.5
				const ts = makeTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					24,
					24,
				);
				expect(ts._renderScaleX).toBeCloseTo(0.5);
				expect(ts._renderScaleY).toBeCloseTo(0.5);
				expect(ts._renderDw).toBeCloseTo(24);
				expect(ts._renderDh).toBeCloseTo(24);
				expect(ts._renderDxCenter).toBeCloseTo(0);
				expect(ts._renderDyCenter).toBeCloseTo(0);
			});
		});

		describe("collection tileset with tilerendersize", () => {
			function makeCollectionTileset(overrides, mapTw, mapTh) {
				fakeImage("render_tile", 48, 48);
				return new TMXTileset(
					{
						firstgid: 1,
						name: "render_collection",
						tilewidth: 48,
						tileheight: 48,
						tilecount: 1,
						columns: 0,
						tiles: [
							{
								id: 0,
								image: "render_tile.png",
								imagewidth: 48,
								imageheight: 48,
							},
						],
						...overrides,
					},
					mapTw,
					mapTh,
				);
			}

			it("should store tilerendersize and fillmode", () => {
				const ts = makeCollectionTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					16,
					16,
				);
				expect(ts.tilerendersize).toEqual("grid");
				expect(ts.fillmode).toEqual("preserve-aspect-fit");
				expect(ts.isCollection).toEqual(true);
			});

			it("should precompute scale factors for collection tiles", () => {
				const ts = makeCollectionTileset({ tilerendersize: "grid" }, 16, 16);
				expect(ts._renderScaleX).toBeCloseTo(16 / 48);
				expect(ts._renderScaleY).toBeCloseTo(16 / 48);
			});

			it("should use uniform scale with preserve-aspect-fit", () => {
				const ts = makeCollectionTileset(
					{ tilerendersize: "grid", fillmode: "preserve-aspect-fit" },
					32,
					16,
				);
				const expectedScale = 16 / 48;
				expect(ts._renderScaleX).toBeCloseTo(expectedScale);
				expect(ts._renderScaleY).toBeCloseTo(expectedScale);
			});

			it("should default to scale 1 with tilerendersize='tile'", () => {
				const ts = makeCollectionTileset({}, 16, 16);
				expect(ts._renderScaleX).toEqual(1);
				expect(ts._renderScaleY).toEqual(1);
			});

			it("should use tile image dimensions for Tile bounds (not scaled)", () => {
				const ts = makeCollectionTileset({ tilerendersize: "grid" }, 16, 16);
				// Tile bounds should reflect the source image size
				const tile = new Tile(0, 0, 1, ts);
				expect(tile.width).toEqual(48);
				expect(tile.height).toEqual(48);
			});
		});

		describe("no scaling when tile size matches grid size", () => {
			it("should have identity scale for spritesheet", () => {
				const ts = makeTileset({ tilerendersize: "grid" }, 48, 48);
				expect(ts._renderScaleX).toEqual(1);
				expect(ts._renderScaleY).toEqual(1);
				expect(ts._renderDw).toEqual(48);
				expect(ts._renderDh).toEqual(48);
				expect(ts._renderDyOffset).toEqual(0);
			});
		});
	});
});
