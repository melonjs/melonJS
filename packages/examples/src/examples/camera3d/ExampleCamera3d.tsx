/**
 * melonJS — Camera3d (perspective) minimal example.
 *
 * Three monster sprites stacked along the camera's forward axis at
 * z = 200 / 400 / 600. Under perspective, the front one renders
 * largest, the back one smallest — proving:
 *   - per-sprite depth flows from `sprite.depth` to the GPU vertex
 *     stream (PR A)
 *   - the Camera3d's perspective matrix scales sprites by their z
 *     (PR B)
 *   - painter-algorithm z-sorting puts the front sprite on top of
 *     the ones behind it (visible occlusion order)
 *
 * On-screen controls rotate the camera (yaw / pitch) and zoom in/out.
 * Drag the canvas to orbit. Demonstrates the simplest opt-in path —
 * the Application-level `cameraClass: Camera3d` setting.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	type Camera3d,
	Camera3d as Camera3dClass,
	input,
	loader,
	type Pointer,
	Sprite,
	state,
	video,
} from "melonjs";
import monsterImg from "../shaderEffects/assets/monster.png";
import { createExampleComponent } from "../utils";

const createGame = () => {
	// opt in to Camera3d at the Application level — every stage in this
	// app gets a Camera3d as its default camera (the loader screen pins
	// to Camera2d via its own constructor regardless).
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.WEBGL,
		scale: "auto",
		cameraClass: Camera3dClass,
	});

	app.world.backgroundColor.parseCSS("#0a0a14");

	loader.preload([{ name: "monster", type: "image", src: monsterImg }], () => {
		// loader.preload internally transitions to state.LOADING (the
		// DefaultLoadingScreen). Transition back to the default game
		// stage so its Camera3d becomes the active viewport.
		state.change(state.DEFAULT, true);

		// three monsters along the camera's forward axis at increasing
		// depth. Same x, same y — only z differs. Perspective scales
		// each one inversely to z.
		const depths = [200, 400, 600];
		for (const z of depths) {
			const sprite = new Sprite(0, 0, { image: "monster" });
			sprite.scale(0.5);
			app.world.addChild(sprite);
			// set depth AFTER addChild — Container.autoDepth (default
			// true) would otherwise overwrite our intended z
			sprite.depth = z;
		}

		// the app's default camera is now a Camera3d (via cameraClass).
		const camera = app.viewport as Camera3d;

		// orbit state: yaw / pitch / distance. Driven by drag + buttons.
		let yaw = 0;
		let pitch = 0;
		let distance = 700;

		const updateCameraPos = () => {
			// orbit around the middle sprite (z = 400). When yaw/pitch
			// are 0, the camera sits at z = 400 - distance (behind the
			// middle sprite) and looks at it.
			const target = 400;
			camera.pos.set(
				Math.sin(yaw) * Math.cos(pitch) * -distance,
				Math.sin(pitch) * distance,
				target - Math.cos(yaw) * Math.cos(pitch) * distance,
			);
			camera.lookAt(0, 0, target);
		};
		updateCameraPos();

		// drag-to-orbit
		let dragging = false;
		let lastX = 0;
		let lastY = 0;
		input.registerPointerEvent("pointerdown", camera, (ev: Pointer) => {
			dragging = true;
			lastX = ev.gameX;
			lastY = ev.gameY;
		});
		input.registerPointerEvent("pointerup", camera, () => {
			dragging = false;
		});
		input.registerPointerEvent("pointermove", camera, (ev: Pointer) => {
			if (!dragging) {
				return;
			}
			yaw += (ev.gameX - lastX) * 0.005;
			pitch = Math.max(
				-Math.PI / 2 + 0.1,
				Math.min(Math.PI / 2 - 0.1, pitch - (ev.gameY - lastY) * 0.005),
			);
			lastX = ev.gameX;
			lastY = ev.gameY;
			updateCameraPos();
		});

		// on-screen HTML control panel — yaw / pitch / zoom / reset.
		// HTML buttons live above the canvas; `#screen > *` already
		// has `pointer-events: auto` (PR A's CSS fix) so they're
		// clickable.
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;display:grid;" +
			"grid-template-columns:repeat(3,40px);grid-template-rows:repeat(4,40px);" +
			"gap:4px;z-index:1000;font-family:sans-serif;";
		const mkButton = (label: string, gridArea: string, handler: () => void) => {
			const b = document.createElement("button");
			b.textContent = label;
			b.style.cssText =
				"background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
				"border-radius:4px;cursor:pointer;font-size:18px;" +
				`grid-area:${gridArea};`;
			b.addEventListener("click", handler);
			panel.appendChild(b);
		};
		const YAW_STEP = 0.15;
		const PITCH_STEP = 0.1;
		const ZOOM_STEP = 60;
		mkButton("▲", "1 / 2 / 2 / 3", () => {
			pitch = Math.min(Math.PI / 2 - 0.1, pitch + PITCH_STEP);
			updateCameraPos();
		});
		mkButton("◀", "2 / 1 / 3 / 2", () => {
			yaw -= YAW_STEP;
			updateCameraPos();
		});
		mkButton("●", "2 / 2 / 3 / 3", () => {
			yaw = 0;
			pitch = 0;
			distance = 700;
			updateCameraPos();
		});
		mkButton("▶", "2 / 3 / 3 / 4", () => {
			yaw += YAW_STEP;
			updateCameraPos();
		});
		mkButton("▼", "3 / 2 / 4 / 3", () => {
			pitch = Math.max(-Math.PI / 2 + 0.1, pitch - PITCH_STEP);
			updateCameraPos();
		});
		mkButton("−", "4 / 1 / 5 / 2", () => {
			distance = Math.min(1500, distance + ZOOM_STEP);
			updateCameraPos();
		});
		mkButton("+", "4 / 3 / 5 / 4", () => {
			distance = Math.max(150, distance - ZOOM_STEP);
			updateCameraPos();
		});

		const hint = document.createElement("div");
		hint.textContent = "Drag or use controls";
		hint.style.cssText =
			"position:absolute;top:240px;left:16px;color:#888;" +
			"font-family:sans-serif;font-size:12px;z-index:1000;";

		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(panel);
			parent.appendChild(hint);
		}
	});
};

export const ExampleCamera3d = createExampleComponent(createGame);
