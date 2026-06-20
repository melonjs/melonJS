/**
 * melonJS — glTF/GLB animated model example.
 * Loads a rigged blocky character (Kenney Blocky Characters, CC0) exported as
 * GLB via the level director via `level.load`. The asset defines node-TRS
 * animation clips (walk, idle, sprint, …) over a rigid node hierarchy — no
 * skinning — driven through the Sprite-aligned animation API
 * (`setCurrentAnimation` / `play` / `pause` / `stop`).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	type GLTFModel,
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

// pixels per glTF unit — the character is ~1.8 units tall, so this puts it at a
// few hundred pixels on screen.
const SCALE = 200;

/**
 * A screen-fixed sky gradient drawn behind the model. `Camera3d` doesn't clear
 * to the world `backgroundColor`, so we paint our own sky as a `floating`
 * (screen-space, perspective-exempt) renderable.
 */
function bakeSky() {
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 512;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 512);
		g.addColorStop(0, "#2b5876");
		g.addColorStop(0.6, "#5b86a8");
		g.addColorStop(1, "#c7dceb");
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

	let domCleanup: (() => void) | null = null;
	let pointerCleanup: (() => void) | null = null;

	// frame the camera + add the sky + wire the animation controls once the
	// model has been instantiated into the world (runs from level.load's
	// onLoaded, after the container reset + model creation)
	const setupScene = () => {
		app.world.addChild(new SkyBackdrop(), -10000);

		const scene = loader.getGLTF("character");
		// the animated asset loads as a single GLTFModel named after the asset
		const model = app.world.getChildByName("character")[0] as GLTFModel;
		if (!scene || !model) {
			return;
		}

		// frame a Camera3d on the model: center on its bounds, look down a touch
		// at a 3/4 yaw, pulled back to fit the model height.
		const { min, max } = scene.bounds;
		const cx = ((min[0] + max[0]) / 2) * SCALE;
		const cy = -((min[1] + max[1]) / 2) * SCALE; // render space: -Y is up
		const cz = -((min[2] + max[2]) / 2) * SCALE;
		const spanY = (max[1] - min[1]) * SCALE;

		const camera = app.viewport as InstanceType<typeof Camera3dClass>;
		camera.setClipPlanes(SCALE * 0.1, 8000);
		const clamp = (v: number, lo: number, hi: number) =>
			Math.max(lo, Math.min(hi, v));

		// orbit state — drag to rotate around the character
		let yaw = 0.5;
		let pitch = -0.12;
		let distance = spanY * 2.4 + 200;
		const updateCam = () => {
			pitch = clamp(pitch, -1.45, 1.45);
			distance = clamp(distance, 120, 4000);
			camera.pos.set(
				cx + Math.sin(yaw) * Math.cos(pitch) * -distance,
				cy + Math.sin(pitch) * distance, // up = -Y
				cz - Math.cos(yaw) * Math.cos(pitch) * distance,
			);
			camera.lookAt(cx, cy, cz);
		};
		updateCam();

		// drag to orbit — radians per pixel dragged. Use the camera-independent
		// screen coords (gameScreenX/Y), NOT gameX/gameY: the latter are
		// projected through the viewport, so since orbiting moves the camera
		// every frame the same pixel would map to a different world point each
		// move — a feedback loop that makes the drag jump. gameScreenX/Y come
		// straight from the canvas/scale transform and stay stable. (Same
		// approach as the glTF Scene example.)
		const ORBIT_SENSITIVITY = 0.0022;
		let dragging = false;
		let lastX = 0;
		let lastY = 0;
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
			pitch -= (ev.gameScreenY - lastY) * ORBIT_SENSITIVITY;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
			updateCam();
		});
		pointerCleanup = () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
		};

		// start walking
		const clips = model.getAnimationNames();
		const initial = clips.includes("walk") ? "walk" : clips[0];
		model.setCurrentAnimation(initial);

		// ── on-screen animation controls ──────────────────────────────────
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;z-index:1000;" +
			"font-family:sans-serif;font-size:13px;color:#e0e0e0;" +
			"background:rgba(20,20,28,0.72);padding:10px 12px;border-radius:8px;" +
			"display:flex;flex-direction:column;gap:8px;min-width:170px;";

		// clip selector — every clip the asset defines
		const select = document.createElement("select");
		select.style.cssText =
			"background:#1a1a1a;color:#e0e0e0;border:1px solid #555;" +
			"border-radius:4px;padding:4px;font-size:13px;";
		for (const name of clips) {
			const opt = document.createElement("option");
			opt.value = name;
			opt.textContent = name;
			select.appendChild(opt);
		}
		select.value = initial;
		select.addEventListener("change", () => {
			model.play(select.value);
		});
		panel.appendChild(select);

		// transport: play / pause / stop (the Sprite-aligned API)
		const row = document.createElement("div");
		row.style.cssText = "display:flex;gap:6px;";
		const mkBtn = (label: string, fn: () => void) => {
			const b = document.createElement("button");
			b.textContent = label;
			b.style.cssText =
				"flex:1;background:#2a2a3a;color:#e0e0e0;border:1px solid #555;" +
				"border-radius:4px;cursor:pointer;padding:5px 0;font-size:13px;";
			b.addEventListener("click", fn);
			row.appendChild(b);
		};
		mkBtn("▶ play", () => model.play(select.value));
		mkBtn("⏸ pause", () => model.pause());
		mkBtn("⏹ stop", () => model.stop());
		panel.appendChild(row);

		// speed multiplier
		const speedLabel = document.createElement("label");
		speedLabel.style.cssText = "display:flex;align-items:center;gap:8px;";
		const speedValue = document.createElement("span");
		speedValue.textContent = "1.0×";
		speedValue.style.minWidth = "34px";
		const speed = document.createElement("input");
		speed.type = "range";
		speed.min = "0";
		speed.max = "3";
		speed.step = "0.1";
		speed.value = "1";
		speed.style.flex = "1";
		speed.addEventListener("input", () => {
			model.animationspeed = Number.parseFloat(speed.value);
			speedValue.textContent = `${model.animationspeed.toFixed(1)}×`;
		});
		speedLabel.append("speed", speed, speedValue);
		panel.appendChild(speedLabel);

		const hint = document.createElement("div");
		hint.textContent = "drag to rotate · pick a clip · play / pause / stop";
		hint.style.cssText = "font-size:11px;color:#9fc3e0;";
		panel.appendChild(hint);

		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(panel);
		}
		domCleanup = () => {
			panel.remove();
		};
	};

	loader.preload(
		// the GLB references an external texture (Textures/texture-a.png),
		// resolved relative to the asset URL by the loader — no repackaging.
		[{ name: "character", type: "glb", src: `${base}character.glb` }],
		() => {
			state.change(state.DEFAULT, true);
			level.load("character", { scale: SCALE, onLoaded: setupScene });
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

export const ExampleGltfCharacter = createExampleComponent(createGame);
