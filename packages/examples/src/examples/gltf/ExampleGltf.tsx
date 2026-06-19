/**
 * melonJS — glTF/GLB scene loader example (Tier 1).
 * Loads a Blender-authored scene (Kenney Platformer Kit, CC0) exported as
 * GLB via the level director (`me.level.load`), then frames a Camera3d on it
 * with Blender-style orbit controls.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	input,
	level,
	loader,
	type Pointer,
	plugin,
	Renderable,
	state,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/gltf/`;

// pixels per glTF unit — scales the whole scene up to screen size. Kept
// small so the framed camera distance stays inside Camera3d's far plane.
const SCALE = 32;

/**
 * A screen-fixed sky gradient drawn behind the scene. `Camera3d` doesn't
 * clear to the world `backgroundColor`, so we paint our own sky as a
 * `floating` (screen-space, perspective-exempt) renderable.
 */
function bakeSky() {
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 512;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 512);
		g.addColorStop(0, "#3a8ee6"); // zenith blue
		g.addColorStop(0.62, "#8ec7ff"); // mid sky
		g.addColorStop(1, "#e7f4ff"); // pale horizon
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 1, 512);
	}
	return c;
}

class SkyBackdrop extends Renderable {
	private sky = bakeSky();

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true; // screen-space — ignore the perspective camera
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.drawImage(
			this.sky,
			0,
			0,
			1,
			512,
			0,
			0,
			renderer.width,
			renderer.height,
		);
	}
}

const createGame = () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.WEBGL, // Mesh rendering requires WebGL
			scale: "auto",
			cameraClass: Camera3dClass,
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: WebGL isn't available.\n\n" +
				"glTF mesh rendering requires a WebGL-capable browser/GPU.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	let pointerCleanup: (() => void) | null = null;
	let domCleanup: (() => void) | null = null;

	// frame the camera + add the sky + wire orbit controls, once the scene
	// has been instantiated into the world (runs from level.load's onLoaded,
	// after the container reset + mesh creation)
	const setupScene = () => {
		// sky behind everything (Camera3d doesn't clear to backgroundColor)
		app.world.addChild(new SkyBackdrop(), -10000);

		// the parsed descriptor — used here only for camera framing
		const scene = loader.getGLTF("diorama");
		if (!scene) {
			return;
		}
		const { min, max } = scene.bounds;
		// render space: glTF (x,y,z) → (x, -y, -z) * SCALE (rightHanded rotation)
		const cx = ((min[0] + max[0]) / 2) * SCALE;
		const cy = -((min[1] + max[1]) / 2) * SCALE;
		const cz = -((min[2] + max[2]) / 2) * SCALE;
		const spanX = (max[0] - min[0]) * SCALE;

		const camera = app.viewport as InstanceType<typeof Camera3dClass>;
		const clamp = (v: number, lo: number, hi: number) =>
			Math.max(lo, Math.min(hi, v));

		// Tighten the clip planes to the scene's actual depth range. Camera3d
		// defaults to near=0.1 / far=1000 (a 10000:1 ratio) which wastes nearly
		// all depth-buffer precision up close — distant props then z-fight with
		// the platform they rest on (a fence's base vanishing into the dirt).
		// A near plane sized to the scene scale restores precision.
		camera.setClipPlanes(SCALE, 4000);

		// Match the authored field of view — Camera3d defaults to 60°, but
		// Kenney/Blender scenes are framed with a much narrower lens (~29°
		// here). A wide lens exaggerates near-field perspective so the rounded
		// grass front-lip looms over and visually swallows props behind it;
		// matching the glTF `yfov` reproduces the Blender look.
		if (scene.cameras.length > 0 && scene.cameras[0].perspective?.yfov) {
			camera.fov = scene.cameras[0].perspective.yfov;
		}

		// Showcase framing: a Blender-style 3/4 bird's-eye. The embedded glTF
		// camera is a shallow gameplay angle that hides props on the back
		// blocks of this stepped diorama behind the front ones — so instead of
		// inheriting it we frame the whole scene: a steep look-down (clears the
		// platform fronts) at a 3/4 yaw, pulled back far enough that the full
		// row fits the (narrow-FOV) view.
		let yaw = 0.15;
		let pitch = -0.5; // negative = camera above, looking down (~30°)
		// distance so the scene's horizontal span fits the camera's
		// FOV-derived horizontal field, with headroom
		const hfov =
			2 * Math.atan(Math.tan(camera.fov / 2) * (camera.width / camera.height));
		let distance = clamp((spanX * 0.5) / Math.tan(hfov / 2) + 200, 120, 3000);
		const initYaw = yaw;
		const initPitch = pitch;
		const initDistance = distance;

		const updateCam = () => {
			distance = clamp(distance, 120, 3000);
			camera.pos.set(
				cx + Math.sin(yaw) * Math.cos(pitch) * -distance,
				cy + Math.sin(pitch) * distance, // up = -Y
				cz - Math.cos(yaw) * Math.cos(pitch) * distance,
			);
			camera.lookAt(cx, cy, cz);
		};
		updateCam();

		// drag to orbit (yaw = around Y axis, pitch = around X axis).
		// radians of rotation per pixel dragged — kept low so a full-width
		// drag is roughly a quarter turn rather than a full spin.
		const ORBIT_SENSITIVITY = 0.0022;
		let dragging = false;
		let lastX = 0;
		let lastY = 0;
		// Use the camera-independent screen coordinates (gameScreenX/Y), NOT
		// gameX/gameY: the latter are projected through the viewport, and since
		// orbiting moves the camera every frame, the same pixel would map to a
		// different world point each move — a feedback loop that makes the
		// drag jump wildly. gameScreenX/Y come straight from the canvas/scale
		// transform and stay stable while the camera moves.
		input.registerPointerEvent("pointerdown", camera, (ev: Pointer) => {
			dragging = true;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
		});
		input.registerPointerEvent("pointerup", camera, () => {
			dragging = false;
		});
		input.registerPointerEvent("pointermove", camera, (ev: Pointer) => {
			if (!dragging) {
				return;
			}
			yaw += (ev.gameScreenX - lastX) * ORBIT_SENSITIVITY;
			pitch = clamp(
				pitch - (ev.gameScreenY - lastY) * ORBIT_SENSITIVITY,
				-1.45,
				1.45,
			);
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
			updateCam();
		});
		pointerCleanup = () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
		};

		// on-screen control grid: yaw ◀▶ · pitch ▲▼ · zoom ± · reset
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;display:grid;" +
			"grid-template-columns:repeat(3,40px);grid-template-rows:repeat(3,40px);" +
			"gap:4px;z-index:1000;font-family:sans-serif;";
		const mk = (label: string, area: string, fn: () => void) => {
			const b = document.createElement("button");
			b.textContent = label;
			b.style.cssText =
				"background:#1a1a1a;color:#e0e0e0;border:1px solid #444;" +
				`border-radius:4px;cursor:pointer;font-size:16px;grid-area:${area};`;
			b.addEventListener("click", fn);
			panel.appendChild(b);
		};
		mk("▲", "1 / 2 / 2 / 3", () => {
			pitch = clamp(pitch + 0.15, -1.45, 1.45);
			updateCam();
		});
		mk("◀", "2 / 1 / 3 / 2", () => {
			yaw -= 0.2;
			updateCam();
		});
		mk("⟲", "2 / 2 / 3 / 3", () => {
			yaw = initYaw;
			pitch = initPitch;
			distance = initDistance;
			updateCam();
		});
		mk("▶", "2 / 3 / 3 / 4", () => {
			yaw += 0.2;
			updateCam();
		});
		mk("▼", "3 / 2 / 4 / 3", () => {
			pitch = clamp(pitch - 0.15, -1.45, 1.45);
			updateCam();
		});
		mk("＋", "1 / 1 / 2 / 2", () => {
			distance -= 70;
			updateCam();
		});
		mk("－", "1 / 3 / 2 / 4", () => {
			distance += 70;
			updateCam();
		});

		const hint = document.createElement("div");
		hint.textContent = "drag to orbit · buttons to rotate / zoom";
		hint.style.cssText =
			"position:absolute;top:188px;left:16px;color:#cfe8ff;" +
			"font-family:sans-serif;font-size:12px;z-index:1000;" +
			"text-shadow:0 1px 2px rgba(0,0,0,0.6);";

		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(panel);
			parent.appendChild(hint);
		}
		domCleanup = () => {
			panel.remove();
			hint.remove();
		};
	};

	loader.preload(
		[{ name: "diorama", type: "glb", src: `${base}platformer-diorama.glb` }],
		() => {
			state.change(state.DEFAULT, true);
			// load the whole glTF scene into the world in one call — the glb
			// auto-registered with the level director on preload, exactly like
			// a Tiled map. `rightHanded` defaults to true for glTF scenes.
			level.load("diorama", { scale: SCALE, onLoaded: setupScene });
		},
	);

	return () => {
		if (pointerCleanup) {
			pointerCleanup();
		}
		if (domCleanup) {
			domCleanup();
		}
	};
};

export const ExampleGltf = createExampleComponent(createGame);
