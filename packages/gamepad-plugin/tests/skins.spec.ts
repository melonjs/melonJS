import {
	Application,
	Camera2d,
	ColorLayer,
	event,
	Stage,
	state,
	TextureAtlas,
	video,
	WebGLRenderer,
} from "melonjs";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { GamepadPlugin, type GamepadPluginOptions } from "../src/index.ts";

/** Four differently colored regions, with no downloaded assets. */
function makeSkin(): TextureAtlas {
	const image = document.createElement("canvas");
	image.width = 128;
	image.height = 32;
	const ctx = image.getContext("2d")!;
	const names = ["base", "thumb", "button", "pressed"];
	["#ff0000", "#00ff00", "#0000ff", "#ffff00"].forEach((color, i) => {
		ctx.fillStyle = color;
		ctx.fillRect(i * 32, 0, 32, 32);
	});
	return new TextureAtlas(
		{
			meta: {
				app: "https://www.codeandweb.com/texturepacker",
				image: "skin",
				size: { w: 128, h: 32 },
			},
			frames: [
				...names.map((filename, i) => ({
					filename,
					frame: { x: i * 32, y: 0, w: 32, h: 32 },
					rotated: false,
					trimmed: false,
					sourceSize: { w: 32, h: 32 },
				})),
				{
					filename: "trimmed",
					frame: { x: 0, y: 0, w: 16, h: 16 },
					trimmed: true,
					rotated: false,
					sourceSize: { w: 32, h: 32 },
					spriteSourceSize: { x: 8, y: 8, w: 16, h: 16 },
					pivot: { x: 0, y: 0 },
				},
				{
					filename: "rotated",
					frame: { x: 0, y: 0, w: 16, h: 32 },
					trimmed: false,
					rotated: true,
					sourceSize: { w: 16, h: 32 },
				},
			],
		},
		image,
	);
}

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
] as const)("gamepad skins (%s)", (_name, renderer) => {
	let app: Application;
	let gamepad: GamepadPlugin;
	let skin: TextureAtlas;
	const realGetGamepads = navigator.getGamepads;

	function create(change: Partial<GamepadPluginOptions> = {}): GamepadPlugin {
		gamepad?.destroy();
		gamepad = new GamepadPlugin(
			{
				enabled: true,
				opacity: 1,
				color: "#ff00ff", // shapes use this; atlas pixels must keep their color
				skin,
				sticks: [
					{
						radius: 40,
						position: { left: 80, top: 100 },
						base: "base",
						thumb: "thumb",
					},
				],
				buttons: [
					{
						radius: 24,
						position: { left: 240, top: 100 },
						region: "button",
						pressed: "pressed",
					},
				],
				...change,
			},
			app,
		);
		app.repaint();
		app.draw();
		return gamepad;
	}

	async function pixel(x: number, y: number): Promise<number[]> {
		app.repaint();
		app.draw();
		// Copy the presented canvas in the same task, before WebGL discards its
		// drawing buffer. The default canvas target is not a WebGL readback FBO.
		const copy = document.createElement("canvas");
		copy.width = copy.height = 1;
		const context = copy.getContext("2d")!;
		context.drawImage(app.renderer.getCanvas(), x, y, 1, 1, 0, 0, 1, 1);
		return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
	}

	function pointer(type: string, x: number, y: number): void {
		const canvas = app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		canvas.dispatchEvent(
			new PointerEvent(type, {
				pointerId: 1,
				pointerType: "touch",
				bubbles: true,
				cancelable: true,
				clientX: rect.left + (x * rect.width) / app.viewport.width,
				clientY: rect.top + (y * rect.height) / app.viewport.height,
			}),
		);
	}

	beforeAll(async () => {
		navigator.getGamepads = () => [];
		app = new Application(320, 200, {
			parent: document.body,
			renderer,
			antiAlias: false,
		});
		await app.init();
		// Each renderer gets its own stage and camera, through the public API.
		const scene = state.USER + (renderer === video.CANVAS ? 1 : 2);
		state.set(scene, new Stage({ cameraClass: Camera2d }));
		state.change(scene, true);
		state.stop();
		if (renderer === video.WEBGL) {
			expect(app.renderer).toBeInstanceOf(WebGLRenderer);
		}
		app.world.addChild(new ColorLayer("background", "#000000"), 0);
	});
	afterAll(() => {
		app.destroy();
		navigator.getGamepads = realGetGamepads;
	});
	beforeEach(() => {
		skin = makeSkin();
		create();
	});
	afterEach(() => {
		gamepad.destroy();
	});

	it("draws the base, thumb and button regions at the requested sizes", async () => {
		expect(await pixel(45, 100)).toEqual([255, 0, 0]);
		expect(await pixel(80, 100)).toEqual([0, 255, 0]);
		expect(await pixel(240, 100)).toEqual([0, 0, 255]);
		expect(await pixel(240, 77)).toEqual([0, 0, 255]);
		expect(await pixel(240, 75)).toEqual([0, 0, 0]);
	});

	it("moves the skinned thumb with the real pointer and reports the same axes", async () => {
		pointer("pointerdown", 80, 100);
		pointer("pointermove", 102, 100);
		expect(gamepad.sticks[0].value.x).toBeCloseTo(1);
		expect(await pixel(102, 100)).toEqual([0, 255, 0]);
		expect(await pixel(75, 100)).toEqual([255, 0, 0]);
		pointer("pointerup", 102, 100);
		expect(gamepad.sticks[0].value.x).toBe(0);
		expect(await pixel(80, 100)).toEqual([0, 255, 0]);
	});

	it("switches to the pressed region and back after the frame has seen the press", async () => {
		pointer("pointerdown", 240, 100);
		expect(gamepad.buttons[0].pressed).toBe(true);
		expect(await pixel(240, 100)).toEqual([255, 255, 0]);
		event.emit(event.GAME_BEFORE_UPDATE, performance.now());
		pointer("pointerup", 240, 100);
		expect(await pixel(240, 100)).toEqual([0, 0, 255]);
	});

	it("preserves opacity, the hold highlight and dimming without a pressed region", async () => {
		create({
			opacity: 0.25,
			buttons: [
				{ radius: 24, position: { left: 240, top: 100 }, region: "button" },
			],
		});
		expect((await pixel(240, 100))[2]).toBeCloseTo(64, -1);
		pointer("pointerdown", 240, 100);
		expect((await pixel(240, 100))[2]).toBeCloseTo(128, -1);
		gamepad.buttons[0].dimmed = true;
		expect((await pixel(240, 100))[2]).toBeCloseTo(51, -1);
	});

	it("shows a press at full opacity without a pressed region, by drawing the region smaller", async () => {
		create({
			opacity: 1,
			buttons: [
				{ radius: 24, position: { left: 240, top: 100 }, region: "button" },
			],
		});
		// at rest the region reaches 23px from the centre
		expect(await pixel(240, 77)).toEqual([0, 0, 255]);
		pointer("pointerdown", 240, 100);
		expect(gamepad.buttons[0].pressed).toBe(true);
		// held, it is drawn smaller: the edge is gone, the middle is still there
		expect(await pixel(240, 77)).toEqual([0, 0, 0]);
		expect(await pixel(240, 80)).toEqual([0, 0, 255]);
		// and the hit area does not shrink with it
		event.emit(event.GAME_BEFORE_UPDATE, performance.now());
		pointer("pointerup", 240, 100);
		expect(await pixel(240, 77)).toEqual([0, 0, 255]);
	});

	it("keeps a pressed region at full size", async () => {
		pointer("pointerdown", 240, 100);
		expect(await pixel(240, 77)).toEqual([255, 255, 0]);
	});

	it("hides and releases a skinned button without changing its hit area", async () => {
		pointer("pointerdown", 265, 100); // just outside the artwork, inside the existing hit area
		expect(gamepad.buttons[0].pressed).toBe(true);
		gamepad.buttons[0].visible = false;
		expect(gamepad.buttons[0].pressed).toBe(false);
		expect(await pixel(240, 100)).toEqual([0, 0, 0]);
	});

	it("keeps the label above the skin", async () => {
		gamepad.buttons[0].label = "I";
		const rgb = await pixel(240, 100);
		expect(rgb[0]).toBeGreaterThan(100);
		expect(rgb[2]).toBeGreaterThan(100);
	});

	it("mixes skinned and shape parts", async () => {
		create({
			sticks: [{ radius: 40, position: { left: 80, top: 100 }, base: "base" }],
		});
		expect(await pixel(45, 100)).toEqual([255, 0, 0]);
		expect(await pixel(80, 100)).toEqual([255, 0, 255]);
	});

	it("keeps floating controls hidden at rest and draws them under the finger", async () => {
		create({
			sticks: [
				{ floating: true, hideAtRest: true, base: "base", thumb: "thumb" },
			],
			buttons: 0,
		});
		expect(await pixel(80, 100)).toEqual([0, 0, 0]);
		pointer("pointerdown", 100, 60);
		expect(await pixel(100, 60)).toEqual([0, 255, 0]);
		pointer("pointerup", 100, 60);
		expect(await pixel(100, 60)).toEqual([0, 0, 0]);
	});

	it("rejects unknown regions before claiming a slot or hooking drawing", () => {
		gamepad.destroy();
		const draw = Stage.prototype.draw;
		for (const region of ["missing", "constructor", "toString"]) {
			expect(() => create({ buttons: [{ region }] })).toThrow(
				`skin region "${region}"`,
			);
		}
		expect(Stage.prototype.draw).toBe(draw);
		create(); // the failed constructor did not claim the slot
	});

	it("draws a floating button's pressed skin where the finger lands", async () => {
		create({
			sticks: 0,
			buttons: [
				{
					floating: true,
					hideAtRest: true,
					region: "button",
					pressed: "pressed",
				},
			],
		});
		expect(await pixel(240, 100)).toEqual([0, 0, 0]);
		pointer("pointerdown", 240, 60);
		expect(gamepad.buttons[0].pressed).toBe(true);
		expect(await pixel(240, 60)).toEqual([255, 255, 0]);
		event.emit(event.GAME_BEFORE_UPDATE, performance.now());
		pointer("pointerup", 240, 60);
		expect(gamepad.buttons[0].pressed).toBe(false);
		expect(await pixel(240, 60)).toEqual([0, 0, 0]);
	});

	it("requires an atlas for named regions", () => {
		gamepad.destroy();
		expect(() => {
			gamepad = new GamepadPlugin(
				{ enabled: true, buttons: [{ region: "button" }] },
				app,
			);
		}).toThrow(/skin atlas/);
	});

	it("keeps the shared atlas usable when the plugin is destroyed", async () => {
		create();
		expect(await pixel(240, 100)).toEqual([0, 0, 255]);
	});

	it("preserves trimmed source bounds and centers artwork independently of its pivot", async () => {
		create({
			buttons: [
				{ radius: 24, position: { left: 240, top: 100 }, region: "trimmed" },
			],
		});
		expect(await pixel(240, 100)).toEqual([255, 0, 0]);
		expect(await pixel(230, 90)).toEqual([255, 0, 0]);
		expect(await pixel(240, 80)).toEqual([0, 0, 0]);
	});

	it("unpacks a rotated non-square region before scaling it to a button", async () => {
		create({
			buttons: [
				{ radius: 24, position: { left: 240, top: 100 }, region: "rotated" },
			],
		});
		expect(await pixel(220, 80)).toEqual([255, 0, 0]);
		expect(await pixel(260, 120)).toEqual([255, 0, 0]);
		expect(await pixel(240, 75)).toEqual([0, 0, 0]);
	});
});
