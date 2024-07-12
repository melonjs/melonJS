import { beforeAll, describe, expect, it } from "vitest";
import { Entity, Rect, Sprite, boot, loader, video } from "../src/index.js";

describe("Entity", () => {
	let entity;
	let defaultRectShape;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		loader.setOptions({ crossOrigin: "anonymous" });

		// a dummy sprite object
		const entity_sprite = new Sprite(0, 0, {
			framewidth: 32,
			frameheight: 64,
			image: video.createCanvas(32, 64),
			anchorPoint: { x: 0, y: 0 },
		});

		// a test entity object
		entity = new Entity(0, 0, {
			width: 32,
			height: 64,
			image: entity_sprite,
			shapes: [],
		});

		// all current test are based on anchorpoint being 0, 0
		entity.renderable.anchorPoint.set(0, 0);

		// a default rect shape
		defaultRectShape = new Rect(10, 10, 32, 64);
	});

	it("has an empty set of shapes", async () => {
		expect(entity.body.shapes.length).toEqual(0);
	});

	it("has a first shape", async () => {
		entity.body.addShape(defaultRectShape);
		expect(entity.body.shapes.length).toEqual(1);
	});

	it("has the correct body bounds: A", async () => {
		const bounds = entity.body.getBounds();
		expect(
			bounds.x === 10 &&
				bounds.y === 10 &&
				bounds.width === 32 &&
				bounds.height === 64,
		).toEqual(true);
	});

	it("has the correct renderable bounds: A", async () => {
		const bounds = entity.renderable.getBounds();
		expect(
			bounds.x === 0 &&
				bounds.y === 0 &&
				bounds.width === 32 &&
				bounds.height === 64,
		).toEqual(true);
	});

	it("has the correct entity bounds: A", async () => {
		const bounds = entity.getBounds();
		expect(
			bounds.x === 0 &&
				bounds.y === 0 &&
				bounds.width === 42 &&
				bounds.height === 74,
		).toEqual(true);
	});

	it("has a second shape", async () => {
		entity.body.addShape(defaultRectShape.clone().setShape(-10, -10, 32, 64));
		expect(entity.body.shapes.length).toEqual(2);
	});

	it("has the correct body bounds: B", async () => {
		const bounds = entity.body.getBounds();
		expect(
			bounds.x === -10 &&
				bounds.y === -10 &&
				bounds.width === 42 &&
				bounds.height === 74,
		).toEqual(true);
	});

	it("has the correct renderable bounds: B", async () => {
		const { renderable } = entity;
		expect(
			renderable.pos.x === 0 &&
				renderable.pos.y === 0 &&
				renderable.width === 32 &&
				renderable.height === 64,
		).toEqual(true);
	});

	it("has the correct entity bounds: B", async () => {
		const bounds = entity.getBounds();
		expect(
			bounds.x === -10 &&
				bounds.y === -10 &&
				bounds.width === 42 &&
				bounds.height === 74,
		).toEqual(true);
	});

	it("removes the second shape", async () => {
		expect(entity.body.removeShapeAt(1)).toEqual(1);
	});

	it("has the correct body bounds: C", async () => {
		const bounds = entity.body.getBounds();
		expect(
			bounds.x === 10 &&
				bounds.y === 10 &&
				bounds.width === 32 &&
				bounds.height === 64,
		).toEqual(true);
	});

	it("has the correct renderable bounds: C", async () => {
		const { renderable } = entity;
		expect(
			renderable.pos.x === 0 &&
				renderable.pos.y === 0 &&
				renderable.width === 32 &&
				renderable.height === 64,
		).toEqual(true);
	});

	it("has the correct entity bounds: C", async () => {
		const bounds = entity.getBounds();
		expect(
			bounds.x === 0 &&
				bounds.y === 0 &&
				bounds.width === 42 &&
				bounds.height === 74,
		).toEqual(true);
	});

	it("has the correct entity geometry: C", async () => {
		expect(
			entity.pos.x === 0 &&
				entity.pos.y === 0 &&
				entity.width === 32 &&
				entity.height === 64,
		).toEqual(true);
	});

	it("moves properly", async () => {
		entity.pos.set(120, 150);
		expect(entity.pos.x === 120 && entity.pos.y === 150).toEqual(true);
	});

	it("has the correct body bounds: D", async () => {
		const bounds = entity.body.getBounds();
		expect(
			bounds.x === 10 &&
				bounds.y === 10 &&
				bounds.width === 32 &&
				bounds.height === 64,
		).toEqual(true);
	});

	it("has the correct renderable bounds: D", async () => {
		const renderable = entity.renderable;
		expect(
			renderable.pos.x === 0 &&
				renderable.pos.y === 0 &&
				renderable.width === 32 &&
				renderable.height === 64,
		).toEqual(true);
	});

	it("has the correct entity bounds: D", async () => {
		const bounds = entity.getBounds();
		expect(
			bounds.x === 120 &&
				bounds.y === 150 &&
				bounds.width === 42 &&
				bounds.height === 74,
		).toEqual(true);
	});
});
