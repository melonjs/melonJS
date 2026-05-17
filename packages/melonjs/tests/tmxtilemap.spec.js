import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Container,
	collision,
	pool,
	Renderable,
	registerTiledObjectClass,
	registerTiledObjectFactory,
	Text,
	TMXLayer,
	TMXTileMap,
	video,
} from "../src/index.js";
import {
	applyObjectOpacity,
	parseTintColor,
	propagateBlendMode,
	tiledBlendMode,
} from "../src/level/tiled/TMXUtils.js";
import { imgList } from "../src/loader/cache.js";

// create a small canvas to use as a fake tile image
function fakeImage(name, w = 64, h = 64) {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	imgList[name] = canvas;
	return canvas;
}

// tileset JSON for tile object tests
const tilesetData = {
	firstgid: 1,
	name: "testtiles",
	tilewidth: 32,
	tileheight: 32,
	spacing: 0,
	margin: 0,
	tilecount: 4,
	columns: 2,
	image: "testtiles.png",
};

// map with a tile object (gid reference)
const tileObjectMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [tilesetData],
	layers: [
		{
			type: "objectgroup",
			name: "TileObjects",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 200,
					name: "",
					type: "",
					gid: 1,
					x: 64,
					y: 96,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with a tile layer nested inside an object group (TMXLayer passthrough)
const nestedLayerMap = {
	width: 2,
	height: 2,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [tilesetData],
	layers: [
		{
			type: "objectgroup",
			name: "GroupWithLayer",
			opacity: 0.7,
			visible: true,
			mode: "multiply",
			objects: [],
			layers: [
				{
					type: "tilelayer",
					name: "NestedTileLayer",
					width: 2,
					height: 2,
					data: [1, 2, 1, 2],
					visible: true,
					opacity: 1,
				},
			],
		},
	],
};

// minimal JSON map with an object group that has a blend mode
const minimalMap = {
	width: 2,
	height: 2,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "TestGroup",
			opacity: 0.8,
			visible: true,
			mode: "multiply",
			objects: [
				{
					id: 1,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
				{
					id: 2,
					name: "",
					type: "",
					x: 32,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
		{
			type: "objectgroup",
			name: "NormalGroup",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 3,
					name: "",
					type: "",
					x: 0,
					y: 32,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with text objects
const textMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "TextGroup",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 10,
					name: "label",
					type: "",
					x: 10,
					y: 20,
					width: 100,
					height: 32,
					text: {
						text: "Hello World",
						fontfamily: "Arial",
						pixelsize: 24,
						color: "#ff0000",
						halign: "center",
						valign: "top",
					},
				},
			],
		},
	],
};

// map with named objects (pulled from pool by name)
const namedObjectMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "Entities",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 20,
					name: "TestEntity",
					type: "enemy",
					x: 50,
					y: 100,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with collision group
const collisionMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "collision",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 30,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 64,
					height: 16,
				},
				{
					id: 31,
					name: "",
					type: "platform",
					x: 0,
					y: 64,
					width: 128,
					height: 16,
				},
			],
		},
	],
};

// map with per-object opacity and visibility
const opacityVisibilityMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "Objects",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 40,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
					opacity: 0.5,
					visible: true,
				},
				{
					id: 41,
					name: "",
					type: "",
					x: 32,
					y: 0,
					width: 32,
					height: 32,
					visible: false,
				},
				{
					id: 42,
					name: "",
					type: "",
					x: 64,
					y: 0,
					width: 32,
					height: 32,
					opacity: 1,
					visible: true,
				},
			],
		},
	],
};

// map with multiple groups for flatten=false testing
const multiGroupMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "GroupA",
			opacity: 0.5,
			visible: true,
			mode: "screen",
			objects: [
				{
					id: 50,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
		{
			type: "objectgroup",
			name: "GroupB",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 51,
					name: "",
					type: "",
					x: 32,
					y: 0,
					width: 32,
					height: 32,
				},
				{
					id: 52,
					name: "",
					type: "",
					x: 64,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with case-insensitive collision group name
const collisionCaseMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "CollisionShapes",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 60,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with a named object inside a collision group
const collisionNamedMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "collision",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 70,
					name: "TestEntity",
					type: "enemy",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with tint color on objects
const tintMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "TintGroup",
			opacity: 1,
			visible: true,
			tintcolor: "#ff0000",
			objects: [
				{
					id: 80,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with invisible group (visible=false)
const invisibleGroupMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "HiddenGroup",
			opacity: 1,
			visible: false,
			objects: [
				{
					id: 90,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with per-object opacity combined with group opacity
const combinedOpacityMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "SemiGroup",
			opacity: 0.5,
			visible: true,
			objects: [
				{
					id: 100,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
					opacity: 0.5,
					visible: true,
				},
			],
		},
	],
};

// map with an empty group (no objects)
const emptyGroupMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "EmptyGroup",
			opacity: 1,
			visible: true,
			objects: [],
		},
		{
			type: "objectgroup",
			name: "NonEmptyGroup",
			opacity: 1,
			visible: true,
			objects: [
				{
					id: 110,
					name: "",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// map with an object that already has a non-normal blend mode set
const presetBlendMap = {
	width: 4,
	height: 4,
	tilewidth: 32,
	tileheight: 32,
	orientation: "orthogonal",
	renderorder: "right-down",
	infinite: false,
	version: "1.10",
	tiledversion: "1.12.0",
	tilesets: [],
	layers: [
		{
			type: "objectgroup",
			name: "BlendGroup",
			opacity: 1,
			visible: true,
			mode: "multiply",
			objects: [
				{
					id: 120,
					name: "PresetBlendEntity",
					type: "",
					x: 0,
					y: 0,
					width: 32,
					height: 32,
				},
			],
		},
	],
};

// simple test class for named object pool registration
class TestEntity extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.settings = settings;
	}
}

// entity with a child renderable to test blend/opacity propagation
class EntityWithRenderable extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.renderable = new Renderable(0, 0, settings.width, settings.height);
		this.renderable.isRenderable = true;
	}
}

// entity with a preset non-normal blend mode
class PresetBlendEntity extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.blendMode = "screen";
	}
}

describe("TMXTileMap", () => {
	beforeAll(() => {
		boot();
		video.init(128, 128, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		// pre-register fake images for tileset tests
		fakeImage("testtiles", 64, 64);
		// register test classes as Tiled object classes
		registerTiledObjectClass("TestEntity", TestEntity);
		registerTiledObjectClass("EntityWithRenderable", EntityWithRenderable);
		registerTiledObjectClass("PresetBlendEntity", PresetBlendEntity);
	});

	// ---------------------------------------------------------------
	// Unnamed shape objects
	// ---------------------------------------------------------------
	describe("getObjects: unnamed shape objects", () => {
		it("should create Renderable instances for unnamed objects", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(3);
			for (const obj of objects) {
				expect(obj.isRenderable).toEqual(true);
			}
		});

		it("should assign a static body definition to unnamed objects", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			for (const obj of objects) {
				expect(obj.bodyDef).toBeDefined();
				expect(obj.bodyDef.type).toEqual("static");
				// the body itself is constructed when the renderable is
				// added to a World (adapter auto-registration). At this
				// point we only have the declarative definition.
			}
		});

		it("should set position from settings", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			// first object at (0,0), second at (32,0)
			expect(objects[0].pos.x).toEqual(0);
			expect(objects[0].pos.y).toEqual(0);
			expect(objects[1].pos.x).toEqual(32);
			expect(objects[1].pos.y).toEqual(0);
		});

		it("should preserve object type and class", () => {
			const map = new TMXTileMap("test", collisionMap);
			const objects = map.getObjects(true);

			const platform = objects.find((obj) => {
				return obj.type === "platform";
			});
			expect(platform).toBeDefined();
			expect(platform.class).toEqual("platform");
		});

		it("should set anchorPoint to (0,0)", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			for (const obj of objects) {
				expect(obj.anchorPoint.x).toEqual(0);
				expect(obj.anchorPoint.y).toEqual(0);
			}
		});
	});

	// ---------------------------------------------------------------
	// Text objects
	// ---------------------------------------------------------------
	describe("getObjects: text objects", () => {
		it("should create Text instances for text objects", () => {
			const map = new TMXTileMap("test", textMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0]).toBeInstanceOf(Text);
		});

		it("should position text objects correctly", () => {
			const map = new TMXTileMap("test", textMap);
			const objects = map.getObjects(true);

			expect(objects[0].pos.x).toEqual(10);
			expect(objects[0].pos.y).toEqual(20);
		});
	});

	// ---------------------------------------------------------------
	// Named objects (pool.pull by name)
	// ---------------------------------------------------------------
	describe("getObjects: named objects", () => {
		it("should pull named objects from the pool", () => {
			const map = new TMXTileMap("test", namedObjectMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0]).toBeInstanceOf(TestEntity);
		});

		it("should pass settings to the named object constructor", () => {
			const map = new TMXTileMap("test", namedObjectMap);
			const objects = map.getObjects(true);

			const entity = objects[0];
			expect(entity.settings.type).toEqual("enemy");
			expect(entity.settings.width).toEqual(32);
			expect(entity.settings.height).toEqual(32);
		});

		it("should position named objects correctly", () => {
			const map = new TMXTileMap("test", namedObjectMap);
			const objects = map.getObjects(true);

			expect(objects[0].pos.x).toEqual(50);
			expect(objects[0].pos.y).toEqual(100);
		});
	});

	// ---------------------------------------------------------------
	// Collision group handling
	// ---------------------------------------------------------------
	describe("getObjects: collision groups", () => {
		it("should set WORLD_SHAPE collision type on unnamed collision objects", () => {
			const map = new TMXTileMap("test", collisionMap);
			const objects = map.getObjects(true);

			for (const obj of objects) {
				expect(obj.bodyDef.collisionType).toEqual(collision.types.WORLD_SHAPE);
			}
		});

		it("should mark collision objects as static", () => {
			const map = new TMXTileMap("test", collisionMap);
			const objects = map.getObjects(true);

			for (const obj of objects) {
				expect(obj.bodyDef.type).toEqual("static");
			}
		});
	});

	// ---------------------------------------------------------------
	// Per-object opacity & visibility (Tiled 1.12+)
	// ---------------------------------------------------------------
	describe("getObjects: per-object opacity and visibility", () => {
		it("should apply per-object opacity", () => {
			const map = new TMXTileMap("test", opacityVisibilityMap);
			const objects = map.getObjects(true);

			// object with opacity 0.5
			const halfOpaque = objects.find((obj) => {
				return obj.pos.x === 0;
			});
			expect(halfOpaque.getOpacity()).toBeCloseTo(0.5);
		});

		it("should set opacity to 0 for invisible objects", () => {
			const map = new TMXTileMap("test", opacityVisibilityMap);
			const objects = map.getObjects(true);

			// object with visible=false
			const hidden = objects.find((obj) => {
				return obj.pos.x === 32;
			});
			expect(hidden.getOpacity()).toEqual(0);
		});

		it("should keep full opacity for visible objects with opacity 1", () => {
			const map = new TMXTileMap("test", opacityVisibilityMap);
			const objects = map.getObjects(true);

			const full = objects.find((obj) => {
				return obj.pos.x === 64;
			});
			expect(full.getOpacity()).toBeCloseTo(1);
		});
	});

	// ---------------------------------------------------------------
	// flatten=false (Container mode)
	// ---------------------------------------------------------------
	describe("getObjects: flatten=false", () => {
		it("should return Container instances for each group", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			expect(objects.length).toEqual(2);
			for (const obj of objects) {
				expect(obj).toBeInstanceOf(Container);
			}
		});

		it("should name containers after groups", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			expect(objects[0].name).toEqual("GroupA");
			expect(objects[1].name).toEqual("GroupB");
		});

		it("should set container opacity from group", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			const groupA = objects.find((obj) => {
				return obj.name === "GroupA";
			});
			expect(groupA.getOpacity()).toBeCloseTo(0.5);
		});

		it("should set container blend mode from group", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			const groupA = objects.find((obj) => {
				return obj.name === "GroupA";
			});
			expect(groupA.blendMode).toEqual("screen");
		});

		it("should add objects as children of the container", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			const groupB = objects.find((obj) => {
				return obj.name === "GroupB";
			});
			expect(groupB.children.length).toEqual(2);
		});

		it("should propagate blend mode to children", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects(false);

			const groupA = objects.find((obj) => {
				return obj.name === "GroupA";
			});
			for (const child of groupA.children) {
				if (child.isRenderable === true) {
					expect(child.blendMode).toEqual("screen");
				}
			}
		});
	});

	// ---------------------------------------------------------------
	// Group blend mode (original tests, flatten=true)
	// ---------------------------------------------------------------
	describe("getObjects with group blend mode (flatten=true)", () => {
		it("should propagate group blend mode to children when flattened", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			// objects from TestGroup should inherit "multiply" blend mode
			const groupObjects = objects.filter((obj) => {
				return obj.blendMode === "multiply";
			});
			expect(groupObjects.length).toEqual(2);
		});

		it("should not set blend mode on children of groups without mode", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			// object from NormalGroup should have default "normal" blend mode
			const normalObjects = objects.filter((obj) => {
				return obj.blendMode === "normal";
			});
			expect(normalObjects.length).toBeGreaterThanOrEqual(1);
		});

		it("should apply group opacity multiplied with blend mode", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(true);

			// TestGroup has opacity 0.8, objects should have opacity <= 0.8
			const blendedObjects = objects.filter((obj) => {
				return obj.blendMode === "multiply";
			});
			for (const obj of blendedObjects) {
				expect(obj.getOpacity()).toBeLessThanOrEqual(0.8);
			}
		});
	});

	// ---------------------------------------------------------------
	// Group blend mode (original tests, flatten=false)
	// ---------------------------------------------------------------
	describe("getObjects with group blend mode (flatten=false)", () => {
		it("should set blend mode on the container", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(false);

			const container = objects.find((obj) => {
				return obj.name === "TestGroup";
			});
			expect(container).toBeDefined();
			expect(container.blendMode).toEqual("multiply");
		});

		it("should set opacity on the container", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(false);

			const container = objects.find((obj) => {
				return obj.name === "TestGroup";
			});
			expect(container.getOpacity()).toBeCloseTo(0.8);
		});

		it("should propagate blend mode to children in non-flattened mode", () => {
			const map = new TMXTileMap("test", minimalMap);
			const objects = map.getObjects(false);

			const container = objects.find((obj) => {
				return obj.name === "TestGroup";
			});
			expect(container).toBeDefined();
			expect(container.children.length).toBeGreaterThan(0);

			// children should inherit the group blend mode
			for (const child of container.children) {
				if (child.isRenderable === true) {
					expect(child.blendMode).toEqual("multiply");
				}
			}
		});
	});

	// ---------------------------------------------------------------
	// Collision group name detection (case-insensitive, includes)
	// ---------------------------------------------------------------
	describe("getObjects: collision group name detection", () => {
		it("should detect collision group with mixed case", () => {
			const map = new TMXTileMap("test", collisionCaseMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0].bodyDef.collisionType).toEqual(
				collision.types.WORLD_SHAPE,
			);
		});

		it("should NOT set WORLD_SHAPE on named objects in collision groups", () => {
			const map = new TMXTileMap("test", collisionNamedMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			// named objects should not have their collision type overridden
			expect(objects[0].body).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// Tint color conversion
	// ---------------------------------------------------------------
	describe("getObjects: tint color", () => {
		it("should convert tintcolor to a tint Color object on settings", () => {
			const map = new TMXTileMap("test", tintMap);
			// access objectGroups after parsing to inspect settings
			map.getObjects(true);
			const settings = map.objectGroups[0].objects[0];
			expect(settings.tint).toBeDefined();
		});
	});

	// ---------------------------------------------------------------
	// Invisible group
	// ---------------------------------------------------------------
	describe("getObjects: invisible group", () => {
		it("should apply zero group opacity to objects in invisible groups", () => {
			const map = new TMXTileMap("test", invisibleGroupMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0].getOpacity()).toEqual(0);
		});
	});

	// ---------------------------------------------------------------
	// Per-object + group opacity combination
	// ---------------------------------------------------------------
	describe("getObjects: combined object and group opacity", () => {
		it("should multiply per-object opacity with group opacity", () => {
			const map = new TMXTileMap("test", combinedOpacityMap);
			const objects = map.getObjects(true);

			// object opacity 0.5 * group opacity 0.5 = 0.25
			expect(objects[0].getOpacity()).toBeCloseTo(0.25);
		});
	});

	// ---------------------------------------------------------------
	// Empty group in flatten=false
	// ---------------------------------------------------------------
	describe("getObjects: empty groups", () => {
		it("should not create containers for empty groups (flatten=false)", () => {
			const map = new TMXTileMap("test", emptyGroupMap);
			const objects = map.getObjects(false);

			// only NonEmptyGroup should produce a container
			expect(objects.length).toEqual(1);
			expect(objects[0].name).toEqual("NonEmptyGroup");
		});

		it("should return no objects for empty groups (flatten=true)", () => {
			const map = new TMXTileMap("test", {
				...emptyGroupMap,
				layers: [emptyGroupMap.layers[0]], // only the empty group
			});
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(0);
		});
	});

	// ---------------------------------------------------------------
	// Default flatten behavior (no argument)
	// ---------------------------------------------------------------
	describe("getObjects: default flatten behavior", () => {
		it("should default to flatten=true when no argument is passed", () => {
			const map = new TMXTileMap("test", multiGroupMap);
			const objects = map.getObjects();

			// should return flat array of renderables, not containers
			expect(objects.length).toEqual(3);
			for (const obj of objects) {
				expect(obj).not.toBeInstanceOf(Container);
			}
		});
	});

	// ---------------------------------------------------------------
	// Child renderable blend mode and opacity propagation
	// ---------------------------------------------------------------
	describe("getObjects: child renderable propagation", () => {
		it("should propagate group blend mode to child renderable", () => {
			const childRenderableMap = {
				width: 4,
				height: 4,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "BlendGroup",
						opacity: 0.5,
						visible: true,
						mode: "multiply",
						objects: [
							{
								id: 130,
								name: "EntityWithRenderable",
								type: "",
								x: 0,
								y: 0,
								width: 32,
								height: 32,
							},
						],
					},
				],
			};

			const map = new TMXTileMap("test", childRenderableMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			const entity = objects[0];

			// blend mode should propagate to both entity and its child renderable
			expect(entity.blendMode).toEqual("multiply");
			expect(entity.renderable).toBeDefined();
			expect(entity.renderable.blendMode).toEqual("multiply");

			// group opacity should propagate to child renderable
			expect(entity.renderable.getOpacity()).toBeCloseTo(0.5);
		});

		it("should set child renderable opacity to 0 for invisible objects", () => {
			const invisibleEntityMap = {
				width: 4,
				height: 4,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "Objects",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 140,
								name: "EntityWithRenderable",
								type: "",
								x: 0,
								y: 0,
								width: 32,
								height: 32,
								visible: false,
							},
						],
					},
				],
			};

			const map = new TMXTileMap("test", invisibleEntityMap);
			const objects = map.getObjects(true);

			expect(objects[0].getOpacity()).toEqual(0);
			expect(objects[0].renderable.getOpacity()).toEqual(0);
		});

		it("should apply per-object opacity to child renderable", () => {
			const semiEntityMap = {
				width: 4,
				height: 4,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "Objects",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 150,
								name: "EntityWithRenderable",
								type: "",
								x: 0,
								y: 0,
								width: 32,
								height: 32,
								opacity: 0.6,
								visible: true,
							},
						],
					},
				],
			};

			const map = new TMXTileMap("test", semiEntityMap);
			const objects = map.getObjects(true);

			expect(objects[0].getOpacity()).toBeCloseTo(0.6);
			expect(objects[0].renderable.getOpacity()).toBeCloseTo(0.6);
		});
	});

	// ---------------------------------------------------------------
	// Blend mode should not override non-normal blend mode on objects
	// ---------------------------------------------------------------
	describe("getObjects: blend mode should not override preset", () => {
		it("should not override an object's non-normal blend mode with group blend mode", () => {
			const map = new TMXTileMap("test", presetBlendMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			// PresetBlendEntity sets blendMode = "screen" in constructor
			// group has "multiply" — should NOT override since entity already has non-normal
			expect(objects[0].blendMode).toEqual("screen");
		});
	});

	// ---------------------------------------------------------------
	// Object id assignment
	// ---------------------------------------------------------------
	describe("getObjects: object id", () => {
		it("should assign object id from settings on unnamed objects", () => {
			const map = new TMXTileMap("test", collisionMap);
			const objects = map.getObjects(true);

			// collisionMap has objects with id 30 and 31
			expect(objects[0].id).toEqual(30);
			expect(objects[1].id).toEqual(31);
		});
	});

	// ---------------------------------------------------------------
	// Tile objects (with gid)
	// ---------------------------------------------------------------
	describe("getObjects: tile objects (gid)", () => {
		it("should create a renderable from tile gid", () => {
			const map = new TMXTileMap("test", tileObjectMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0].isRenderable).toEqual(true);
		});

		it("should assign a static body definition to tile objects", () => {
			const map = new TMXTileMap("test", tileObjectMap);
			const objects = map.getObjects(true);

			expect(objects[0].bodyDef).toBeDefined();
			expect(objects[0].bodyDef.type).toEqual("static");
		});

		it("should position tile objects correctly", () => {
			const map = new TMXTileMap("test", tileObjectMap);
			const objects = map.getObjects(true);

			expect(objects[0].pos.x).toEqual(64);
			// Tiled tile objects have y adjusted (anchor at bottom-left)
			expect(objects[0].pos.y).toBeDefined();
		});
	});

	// ---------------------------------------------------------------
	// TMXLayer passthrough
	// ---------------------------------------------------------------
	describe("getObjects: TMXLayer passthrough", () => {
		it("should pass TMXLayer instances through directly", () => {
			const map = new TMXTileMap("test", nestedLayerMap);
			const objects = map.getObjects(true);

			// the nested layer should be included as-is
			const layer = objects.find((obj) => {
				return obj instanceof TMXLayer;
			});
			expect(layer).toBeDefined();
			expect(layer.name).toEqual("NestedTileLayer");
		});

		it("should skip per-object opacity but apply group opacity to TMXLayer", () => {
			const map = new TMXTileMap("test", nestedLayerMap);
			const objects = map.getObjects(true);

			const layer = objects.find((obj) => {
				return obj instanceof TMXLayer;
			});
			// TMXLayer skips per-object opacity processing but still gets
			// group opacity applied in flatten mode (group opacity is 0.7)
			expect(layer.getOpacity()).toBeCloseTo(0.7);
		});

		it("should include TMXLayer in container when flatten=false", () => {
			const map = new TMXTileMap("test", nestedLayerMap);
			const objects = map.getObjects(false);

			expect(objects.length).toEqual(1);
			expect(objects[0]).toBeInstanceOf(Container);
			expect(objects[0].name).toEqual("GroupWithLayer");

			// the container should have the layer as a child
			const layer = objects[0].getChildren().find((child) => {
				return child instanceof TMXLayer;
			});
			expect(layer).toBeDefined();
			expect(layer.name).toEqual("NestedTileLayer");
		});

		it("should propagate group blend mode to TMXLayer in flatten mode", () => {
			const map = new TMXTileMap("test", nestedLayerMap);
			const objects = map.getObjects(true);

			const layer = objects.find((obj) => {
				return obj instanceof TMXLayer;
			});
			// TMXLayer is Renderable but is skipped for per-object opacity
			// Group blend mode should still propagate since flatten=true
			// However, TMXLayer already has its own blendMode from its data
			// The group has "multiply" mode, layer has "normal" → should inherit "multiply"
			expect(layer.blendMode).toEqual("multiply");
		});
	});

	// ---------------------------------------------------------------
	// registerTiledObjectFactory API
	// ---------------------------------------------------------------
	describe("registerTiledObjectFactory", () => {
		it("should dispatch to a custom factory based on object class", () => {
			let factoryCalled = false;

			// register a factory for the "CustomClass" Tiled class
			registerTiledObjectFactory("CustomClass", (settings) => {
				factoryCalled = true;
				const obj = new Renderable(
					settings.x,
					settings.y,
					settings.width,
					settings.height,
				);
				obj.name = "custom";
				obj.pos.z = settings.z;
				return obj;
			});

			const customClassMap = {
				width: 4,
				height: 4,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "Objects",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 200,
								name: "myObject",
								type: "CustomClass",
								class: "CustomClass",
								x: 10,
								y: 20,
								width: 32,
								height: 32,
							},
						],
					},
				],
			};

			const map = new TMXTileMap("test", customClassMap);
			const objects = map.getObjects(true);

			expect(factoryCalled).toEqual(true);
			expect(objects.length).toEqual(1);
			expect(objects[0].name).toEqual("custom");
		});

		it("should fall through to named factory when class has no registered factory", () => {
			const map = new TMXTileMap("test", namedObjectMap);
			const objects = map.getObjects(true);

			// namedObjectMap uses name "TestEntity" with no class-based factory
			// should still use the "named" factory and pull from pool
			expect(objects.length).toEqual(1);
			expect(objects[0]).toBeInstanceOf(TestEntity);
		});

		it("should throw when registering a non-function factory", () => {
			expect(() => {
				registerTiledObjectFactory("bad", "not a function");
			}).toThrow("invalid factory function for bad");
		});

		it("should allow overriding a built-in factory", () => {
			let shapeFactoryCalled = false;

			// save original behavior via a wrapper
			const originalShapeFactory = (settings) => {
				const obj = pool.pull(
					"Renderable",
					settings.x,
					settings.y,
					settings.width,
					settings.height,
				);
				obj.anchorPoint.set(0, 0);
				obj.pos.z = settings.z;
				return obj;
			};

			registerTiledObjectFactory("shape", (settings) => {
				shapeFactoryCalled = true;
				return originalShapeFactory(settings);
			});

			const map = new TMXTileMap("test", collisionMap);
			map.getObjects(true);

			expect(shapeFactoryCalled).toEqual(true);

			// restore default
			registerTiledObjectFactory("shape", originalShapeFactory);
		});
	});

	// ---------------------------------------------------------------
	// pool.register auto-registration
	// ---------------------------------------------------------------
	describe("pool.register auto-registration", () => {
		it("should auto-register pool classes as Tiled object factories", () => {
			class PoolRegisteredEntity extends Renderable {
				constructor(x, y, settings) {
					super(x, y, settings.width, settings.height);
					this.isPoolEntity = true;
				}
			}

			// register via pool (should auto-register Tiled factory)
			pool.register("PoolRegisteredEntity", PoolRegisteredEntity);

			const poolEntityMap = {
				width: 4,
				height: 4,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "Objects",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 300,
								name: "PoolRegisteredEntity",
								type: "",
								x: 50,
								y: 75,
								width: 32,
								height: 32,
							},
						],
					},
				],
			};

			const map = new TMXTileMap("test", poolEntityMap);
			const objects = map.getObjects(true);

			expect(objects.length).toEqual(1);
			expect(objects[0]).toBeInstanceOf(PoolRegisteredEntity);
			expect(objects[0].isPoolEntity).toEqual(true);
			expect(objects[0].pos.x).toEqual(50);
			expect(objects[0].pos.y).toEqual(75);
		});
	});

	// ---------------------------------------------------------------
	// registerTiledObjectClass safeguards
	// ---------------------------------------------------------------
	describe("registerTiledObjectClass", () => {
		it("should silently ignore duplicate registration with same constructor", () => {
			// TestEntity is already registered in beforeAll — re-registering should not throw
			expect(() => {
				registerTiledObjectClass("TestEntity", TestEntity);
			}).not.toThrow();
		});

		it("should throw when registering a different constructor for the same name", () => {
			// TestEntity is already registered — registering a different class should throw
			expect(() => {
				registerTiledObjectClass("TestEntity", Renderable);
			}).toThrow(
				"a different class is already registered for Tiled type: TestEntity",
			);
		});
	});

	// ---------------------------------------------------------------
	// pool.autoRegisterTiled flag
	// ---------------------------------------------------------------
	describe("pool.autoRegisterTiled", () => {
		it("should not register Tiled factory when autoRegisterTiled is false", () => {
			class NonTiledClass extends Renderable {
				constructor(x, y, settings) {
					super(x, y, settings.width, settings.height);
				}
			}

			pool.autoRegisterTiled = false;
			pool.register("NonTiledClass", NonTiledClass);
			pool.autoRegisterTiled = true;

			const map = new TMXTileMap("test", {
				width: 2,
				height: 2,
				tilewidth: 32,
				tileheight: 32,
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				version: "1.10",
				tiledversion: "1.12.0",
				tilesets: [],
				layers: [
					{
						type: "objectgroup",
						name: "Objects",
						opacity: 1,
						visible: true,
						objects: [
							{
								id: 400,
								name: "NonTiledClass",
								type: "",
								x: 0,
								y: 0,
								width: 32,
								height: 32,
							},
						],
					},
				],
			});
			const objects = map.getObjects(true);

			expect(objects[0]).not.toBeInstanceOf(NonTiledClass);
		});
	});

	// ---------------------------------------------------------------
	// TMXUtils: tiledBlendMode
	// ---------------------------------------------------------------
	describe("tiledBlendMode", () => {
		it("should return 'normal' for undefined", () => {
			expect(tiledBlendMode(undefined)).toEqual("normal");
		});

		it("should return 'normal' for 'normal'", () => {
			expect(tiledBlendMode("normal")).toEqual("normal");
		});

		it("should convert 'add' to 'lighter'", () => {
			expect(tiledBlendMode("add")).toEqual("lighter");
		});

		it("should pass through other blend modes", () => {
			expect(tiledBlendMode("multiply")).toEqual("multiply");
			expect(tiledBlendMode("screen")).toEqual("screen");
		});
	});

	// ---------------------------------------------------------------
	// TMXUtils: parseTintColor
	// ---------------------------------------------------------------
	describe("parseTintColor", () => {
		it("should return a Color object for valid hex", () => {
			const color = parseTintColor("#ff0000");
			expect(color).toBeDefined();
			expect(color.r).toEqual(255);
			expect(color.g).toEqual(0);
			expect(color.b).toEqual(0);
		});

		it("should return undefined when tintcolor is undefined", () => {
			expect(parseTintColor(undefined)).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// TMXUtils: applyObjectOpacity
	// ---------------------------------------------------------------
	describe("applyObjectOpacity", () => {
		it("should multiply opacity on object", () => {
			const obj = new Renderable(0, 0, 32, 32);
			obj.setOpacity(1);
			applyObjectOpacity(obj, 0.5);
			expect(obj.getOpacity()).toBeCloseTo(0.5);
		});

		it("should multiply opacity on child renderable", () => {
			const obj = new Renderable(0, 0, 32, 32);
			obj.renderable = new Renderable(0, 0, 32, 32);
			obj.renderable.isRenderable = true;
			applyObjectOpacity(obj, 0.4);
			expect(obj.getOpacity()).toBeCloseTo(0.4);
			expect(obj.renderable.getOpacity()).toBeCloseTo(0.4);
		});

		it("should skip child renderable when isRenderable is false", () => {
			const obj = new Renderable(0, 0, 32, 32);
			obj.renderable = {
				isRenderable: false,
				getOpacity: () => {
					return 1;
				},
			};
			applyObjectOpacity(obj, 0.5);
			expect(obj.getOpacity()).toBeCloseTo(0.5);
		});
	});

	// ---------------------------------------------------------------
	// TMXUtils: propagateBlendMode
	// ---------------------------------------------------------------
	describe("propagateBlendMode", () => {
		it("should set blend mode on object with 'normal' default", () => {
			const obj = new Renderable(0, 0, 32, 32);
			propagateBlendMode(obj, "multiply");
			expect(obj.blendMode).toEqual("multiply");
		});

		it("should not override existing non-normal blend mode", () => {
			const obj = new Renderable(0, 0, 32, 32);
			obj.blendMode = "screen";
			propagateBlendMode(obj, "multiply");
			expect(obj.blendMode).toEqual("screen");
		});

		it("should not propagate 'normal' blend mode", () => {
			const obj = new Renderable(0, 0, 32, 32);
			propagateBlendMode(obj, "normal");
			expect(obj.blendMode).toEqual("normal");
		});

		it("should not override child renderable with non-normal blend mode", () => {
			const obj = new Renderable(0, 0, 32, 32);
			obj.renderable = new Renderable(0, 0, 32, 32);
			obj.renderable.isRenderable = true;
			obj.renderable.blendMode = "screen";
			propagateBlendMode(obj, "multiply");
			expect(obj.blendMode).toEqual("multiply");
			expect(obj.renderable.blendMode).toEqual("screen");
		});
	});

	// ---------------------------------------------------------------
	// registerTiledObjectFactory validation
	// ---------------------------------------------------------------
	describe("registerTiledObjectFactory validation", () => {
		it("should throw when registering a non-function", () => {
			expect(() => {
				registerTiledObjectFactory("invalid", "not a function");
			}).toThrow("invalid factory function for invalid");
		});
	});
});
