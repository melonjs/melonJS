/**
 * melonJS — an orthographic Camera3d: the isometric look, in real 3D.
 *
 * The Kenney Platformer Kit diorama (CC0), loaded with `level.load` exactly as
 * the glTF Scene example does, viewed through a `Camera3d` whose `projection`
 * is `"orthographic"`: no foreshortening, so parallel edges stay parallel and
 * the back row is as large as the front. That is the look of an isometric
 * tactics or builder game, with none of the 2D isometric tile bookkeeping —
 * depth, lighting, shadows and picking all still come from the 3D scene.
 *
 * - The checkbox switches between orthographic and perspective at run time:
 *   the camera keeps its place, only the projection changes.
 * - The wheel zooms: `orthoHeight` is the orthographic camera's zoom (how
 *   many world units tall the view is); under perspective it moves closer.
 * - Drag to turn the view around the diorama.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	type CanvasRenderer,
	input,
	level,
	loader,
	type Pointer,
	plugin,
	Renderable,
	Stage,
	state,
	UICheckbox,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/gltf/`;

// pixels per glTF unit
const SCALE = 32;
// the classic isometric angles: a quarter turn of 45°, looking down by
// atan(1/√2) ≈ 35.26°, so the three axes come out equally foreshortened
const ISO_YAW = Math.PI / 4;
const ISO_PITCH = Math.atan(1 / Math.SQRT2);
// far enough that the near plane never clips the scene as it turns
const DISTANCE = 1800;

/** a soft vertical gradient behind the scene, in screen space */
class SkyBackdrop extends Renderable {
	private sky: HTMLCanvasElement;

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
		this.sky = document.createElement("canvas");
		this.sky.width = 1;
		this.sky.height = 256;
		const ctx = this.sky.getContext("2d");
		if (ctx) {
			const g = ctx.createLinearGradient(0, 0, 0, 256);
			g.addColorStop(0, "#8fd3ff");
			g.addColorStop(1, "#e9f7ff");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 1, 256);
		}
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.drawImage(
			this.sky,
			0,
			0,
			1,
			256,
			0,
			0,
			renderer.width,
			renderer.height,
		);
	}
}

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			antiAlias: true,
			cameraClass: Camera3d,
		});
		await app.init();
		if (!app.renderer.supportsDepthBuffer) {
			throw new Error("no GPU backend available (Canvas fallback)");
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: it needs WebGL 2 or WebGPU.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	const buildScene = (app: Application) => {
		level.load("diorama", {
			container: app.world,
			scale: SCALE,
			castGroundShadow: true,
		});
		// after the load, which resets the container it loads into
		app.world.addChild(new SkyBackdrop(), -10000);
		const scene = loader.getGLTF("diorama");
		if (!scene) {
			throw new Error('Isometric: "diorama" did not preload.');
		}

		// the scene's centre and size, in render space (Y-down, Z bridged)
		const { min, max } = scene.bounds;
		const cx = ((min[0] + max[0]) / 2) * SCALE;
		const cy = -((min[1] + max[1]) / 2) * SCALE;
		const cz = -((min[2] + max[2]) / 2) * SCALE;
		const span = Math.hypot(max[0] - min[0], max[2] - min[2]) * SCALE;

		const camera = app.viewport as Camera3d;
		camera.setClipPlanes(50, 6000);
		// the switch: everything else about the camera stays as it is
		camera.projection = "orthographic";
		// the whole diorama in view, with a margin: this is the zoom
		camera.orthoHeight = span * 0.8;
		// perspective, when switched to, gets the lens that frames the same
		// height at the camera's distance, so the two views start alike
		camera.fov = 2 * Math.atan(camera.orthoHeight / 2 / DISTANCE);

		let yaw = ISO_YAW;
		// under perspective, the wheel changes the distance instead
		let distance = DISTANCE;
		const place = () => {
			camera.setPosition(
				cx - Math.sin(yaw) * Math.cos(ISO_PITCH) * distance,
				// up is -Y
				cy - Math.sin(ISO_PITCH) * distance,
				cz - Math.cos(yaw) * Math.cos(ISO_PITCH) * distance,
			);
			camera.lookAt(cx, cy, cz);
		};
		place();

		// ── controls ─────────────────────────────────────────────────────
		const toggle = new UICheckbox(24, 24, {
			label: "orthographic",
			checked: true,
			font: "sans-serif",
			fontSize: 20,
			labelFillStyle: "#1d3557",
			onChange: (on) => {
				camera.projection = on ? "orthographic" : "perspective";
			},
		});
		app.world.addChild(toggle, 100);

		// drag to turn round the diorama; screen coordinates, since the
		// camera itself moves (see the input skill)
		let dragging = false;
		let lastX = 0;
		input.registerPointerEvent("pointerdown", camera, (ev: Pointer) => {
			dragging = true;
			lastX = ev.gameScreenX;
		});
		input.registerPointerEvent("pointerup", camera, () => {
			dragging = false;
		});
		input.registerPointerEvent("pointermove", camera, (ev: Pointer) => {
			if (dragging) {
				yaw -= (ev.gameScreenX - lastX) * 0.006;
				lastX = ev.gameScreenX;
				place();
			}
		});
		// the wheel zooms: orthoHeight for the orthographic view, the
		// distance for the perspective one
		input.registerPointerEvent("wheel", camera, (ev: Pointer) => {
			const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
			if (camera.projection === "orthographic") {
				camera.orthoHeight = Math.min(
					Math.max(camera.orthoHeight * factor, span * 0.2),
					span * 2,
				);
			} else {
				distance = Math.min(Math.max(distance * factor, 600), 4000);
				place();
			}
		});

		return () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
			input.releasePointerEvent("wheel", camera);
		};
	};

	class IsometricStage extends Stage {
		#teardown: (() => void) | null = null;

		override onResetEvent(app: Application) {
			this.#teardown = buildScene(app);
		}

		override onDestroyEvent() {
			this.#teardown?.();
			this.#teardown = null;
		}
	}

	await loader.preload([
		{ name: "diorama", type: "glb", src: `${base}platformer-diorama.glb` },
	]);
	state.set(state.PLAY, new IsometricStage());
	state.change(state.PLAY);
};

export const ExampleIsometric3d = createExampleComponent(createGame);
