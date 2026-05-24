/**
 * melonJS — Camera3d (perspective + orbit) example.
 *
 * A grid of sprite billboards floats in 3D space. The Camera3d orbits
 * around the center under mouse drag (and auto-rotates when idle).
 * Proves the new capabilities end-to-end:
 * - Per-sprite depth gets projected through the camera's frustum
 *   (closer sprites render larger, farther sprites smaller)
 * - The camera's pitch / yaw rotates the world view correctly
 *
 * Demonstrates the simplest opt-in path for Camera3d — the
 * `cameraClass: Camera3d` Application setting. Every stage the app
 * runs (including the default stage created automatically when none
 * is registered) gets a Camera3d as its default camera.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	type Camera3d,
	Camera3d as Camera3dClass,
	event,
	input,
	type Pointer,
	Sprite,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const createGame = () => {
	// Opt-in to Camera3d at the Application level — every stage in this
	// app gets a Camera3d as its default camera. DefaultLoadingScreen
	// stays Camera2d (hardcoded protection in its constructor).
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.WEBGL,
		scale: "auto",
		cameraClass: Camera3dClass,
	});

	app.world.backgroundColor.parseCSS("#0a0a14");

	// build a 64×64 colored tile per grid cell (procedural — no asset preload)
	const makeTile = (hue: number) => {
		const c = video.createCanvas(64, 64);
		const ctx = c.getContext("2d");
		if (ctx) {
			ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
			ctx.fillRect(0, 0, 64, 64);
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 4;
			ctx.strokeRect(2, 2, 60, 60);
		}
		return c;
	};

	// 5×5 grid of sprite billboards spanning x ∈ [-400, 400] and
	// z ∈ [200, 600] (within Camera3d's default near=0.1, far=1000).
	// We set sprite.depth AFTER addChild because Container.autoDepth
	// (default true) would otherwise overwrite our explicit z.
	const GRID = 5;
	const SPAN_X = 200;
	const SPAN_Z = 100;
	const Z_BASE = 200;
	for (let row = 0; row < GRID; row++) {
		for (let col = 0; col < GRID; col++) {
			const x = (col - (GRID - 1) / 2) * SPAN_X;
			const y = 0;
			const z = Z_BASE + row * SPAN_Z;
			const hue = (col / GRID) * 360;
			const sprite = new Sprite(x, y, {
				framewidth: 64,
				frameheight: 64,
				image: makeTile(hue),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			app.world.addChild(sprite);
			sprite.depth = z;
		}
	}

	// the app's default camera is now a Camera3d (via cameraClass).
	// Type-narrow for the perspective-specific calls.
	const camera = app.viewport as Camera3d;

	// orbit state — yaw / pitch / distance. updated by mouse drag,
	// applied to the camera each GAME_UPDATE tick.
	let yaw = 0;
	let pitch = -0.25; // slight downward tilt
	const distance = 600;
	const centerZ = Z_BASE + ((GRID - 1) * SPAN_Z) / 2; // center of the grid

	const updateCameraPos = () => {
		// orbit around (0, 0, centerZ): place the camera on a sphere of
		// `distance` around that point, then aim back at it.
		camera.pos.set(
			Math.sin(yaw) * Math.cos(pitch) * -distance,
			Math.sin(pitch) * distance,
			centerZ - Math.cos(yaw) * Math.cos(pitch) * distance,
		);
		camera.lookAt(0, 0, centerZ);
	};
	updateCameraPos();

	// drag-to-orbit
	let dragging = false;
	let lastX = 0;
	let lastY = 0;
	const onDown = (ev: Pointer) => {
		dragging = true;
		lastX = ev.gameX;
		lastY = ev.gameY;
	};
	const onUp = () => {
		dragging = false;
	};
	const onMove = (ev: Pointer) => {
		if (!dragging) {
			return;
		}
		const dx = ev.gameX - lastX;
		const dy = ev.gameY - lastY;
		lastX = ev.gameX;
		lastY = ev.gameY;
		yaw += dx * 0.005;
		pitch = Math.max(
			-Math.PI / 2 + 0.1,
			Math.min(Math.PI / 2 - 0.1, pitch - dy * 0.005),
		);
		updateCameraPos();
	};
	input.registerPointerEvent("pointerdown", camera, onDown);
	input.registerPointerEvent("pointerup", camera, onUp);
	input.registerPointerEvent("pointermove", camera, onMove);

	// gentle auto-rotate while no input. `GAME_UPDATE` emits the
	// absolute `performance.now()` timestamp — derive a frame delta
	// ourselves so the rotation rate stays constant regardless of
	// session duration.
	let lastTime = 0;
	event.on(event.GAME_UPDATE, (time: number) => {
		const dt = lastTime > 0 ? time - lastTime : 0;
		lastTime = time;
		if (!dragging) {
			yaw += dt * 0.0003;
			updateCameraPos();
		}
	});
};

export const ExampleCamera3d = createExampleComponent(createGame);
