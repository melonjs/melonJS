import { beforeAll, describe, expect, it } from "vitest";
import { boot, TMXTileMap, video } from "../src/index.js";

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

describe("TMXTileMap", () => {
	beforeAll(() => {
		boot();
		video.init(64, 64, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

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
			expect(container.children.length).toBeGreaterThan(0);

			// children should inherit the group blend mode
			for (const child of container.children) {
				if (child.isRenderable === true) {
					expect(child.blendMode).toEqual("multiply");
				}
			}
		});
	});
});
