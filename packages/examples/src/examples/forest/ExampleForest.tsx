/**
 * melonJS — mesh instancing example (#1508).
 *
 * A forest of 100 000 trees drawn from ONE copy of the geometry, in a single
 * draw call. Nothing here builds the instances: the `.glb` carries them as
 * `EXT_mesh_gpu_instancing` per-instance transforms, so `level.load()`
 * produces an `InstancedMesh` on its own — the same one call a Tiled map
 * takes.
 *
 * The `visibleInstanceCount` slider is the cheap level-of-detail knob:
 * moving it changes how many trees are drawn without re-uploading anything.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	type InstancedMesh,
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

// pixels per glTF unit
const SCALE = 26;

// The forest floor: the glb's ground plane sits at y = 0, and the trees stand
// on it, so every blob in the scene lands here.
const GROUND_Y = 0;

/** A dusk sky, drawn screen-fixed behind the scene. */
function bakeSky() {
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 512;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 512);
		g.addColorStop(0, "#1b3a63");
		g.addColorStop(0.55, "#6f8fb5");
		g.addColorStop(1, "#e5c9a3");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 1, 512);
	}
	return c;
}

class SkyBackdrop extends Renderable {
	private sky = bakeSky();

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true; // screen-space — exempt from the perspective camera
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

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			cameraClass: Camera3dClass,
			antiAlias: true,
		});
		await app.init();
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: no GPU renderer is available.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	let torndown = false;
	let pointerCleanup: (() => void) | null = null;
	let domCleanup: (() => void) | null = null;

	const setupScene = () => {
		if (torndown) {
			return;
		}
		// The sky is a screen-space backdrop, so it has to be drawn BEFORE
		// the meshes. Under `Camera3d` the world sorts on depth, and this
		// camera looks along +Z — so "behind everything" is the largest
		// depth, not the smallest. A negative z here reads as *nearest* and
		// paints the whole forest over, which looks exactly like nothing
		// rendering at all.
		app.world.addChild(new SkyBackdrop(), 100000);

		// the loader turned the instanced node into an InstancedMesh — find it
		// so the slider can drive `visibleInstanceCount`
		const trees = app.world.getChildByName("Trees")[0] as
			| InstancedMesh
			| undefined;

		const camera = app.viewport as InstanceType<typeof Camera3dClass>;
		// the ground runs to ±12 000 px at this scale, so the far plane has
		// to reach past the diagonal or the tree line is clipped mid-scene
		camera.setClipPlanes(SCALE, 70000);

		// Framed from INSIDE the forest rather than above it. The trees are
		// only ~3 units tall against a scatter 300 units across, so a camera
		// placed by "distance from the centre" ends up tens of tree-heights
		// up and the whole thing reads as a lawn seen from a plane. Eye
		// height and horizontal distance are therefore separate: the eye sits
		// just under the canopy and looks level, which is what makes it a
		// forest view.
		let yaw = -0.54;
		let eyeHeight = 420; // px — just above the canopy, looking out over it
		let distance = 9000; // px out from the centre, horizontally
		const clamp = (v: number, lo: number, hi: number) =>
			Math.max(lo, Math.min(hi, v));

		const updateCam = () => {
			distance = clamp(distance, 900, 18000);
			eyeHeight = clamp(eyeHeight, 60, 4000);
			// up is -Y in render space
			camera.pos.set(Math.sin(yaw) * -distance, -eyeHeight);
			camera.depth = -Math.cos(yaw) * distance;
			// look level, at the far tree line rather than down at the floor
			camera.lookAt(0, -eyeHeight * 0.92, 0);
		};
		updateCam();

		// drag to orbit — screen coordinates, not world ones: orbiting moves
		// the camera every frame, so a world-projected pixel would map
		// somewhere new on each move and the drag would jump
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
			// vertical drag rises above the canopy instead of tilting, so the
			// view stays a forest view at every height
			eyeHeight += (ev.gameScreenY - lastY) * 6;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
			updateCam();
		});
		pointerCleanup = () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
		};

		// the LOD knob: how many of the instances to draw
		const total = trees?.instanceCount ?? 0;
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;z-index:1000;" +
			"font-family:sans-serif;font-size:12px;color:#f0e6d8;" +
			"text-shadow:0 1px 2px rgba(0,0,0,0.7);";
		const readout = document.createElement("div");
		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = String(total);
		slider.value = String(total);
		slider.style.cssText = "width:220px;display:block;margin-top:6px;";
		const render = () => {
			readout.textContent =
				`${slider.value} / ${total} trees · 1 geometry · 1 draw call` +
				(trees ? "" : " (instanced node not found)");
		};
		slider.addEventListener("input", () => {
			if (trees) {
				// no re-upload: the records stay put, the draw is just shorter
				trees.visibleInstanceCount = Number(slider.value);
			}
			render();
		});
		render();
		panel.appendChild(readout);
		panel.appendChild(slider);

		const hint = document.createElement("div");
		hint.textContent = "drag to orbit";
		hint.style.cssText = "margin-top:8px;opacity:0.75;";
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
		[{ name: "forest", type: "glb", src: `${base}forest.glb` }],
		() => {
			state.change(state.DEFAULT, true);
			// one call — the instanced node becomes an InstancedMesh, the
			// ground stays an ordinary Mesh, and the authored sun lights both
			// Instanced ground shadows (#1515) come from the load option: ONE
			// extra draw for the whole scatter, however many trees are visible,
			// read from the same instance buffer the trees draw from. The
			// scene's ground plane is skipped automatically — it has no height
			// to cast, and shadowing it with itself would smear the floor.
			level.load("forest", {
				scale: SCALE,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
				onLoaded: setupScene,
			});
		},
	);

	return () => {
		// Deliberately NOT app.destroy(): the example host re-parents the
		// existing canvas on a same-example remount and assumes the engine is
		// still alive, so destroying here leaves a dead canvas and a blank
		// screen on the second visit. `torndown` covers the other order — an
		// unmount while the 3 MB glb is still loading, after which setupScene
		// must not register handlers nobody will ever remove.
		torndown = true;
		pointerCleanup?.();
		domCleanup?.();
	};
};

export const ExampleForest = createExampleComponent(createGame);
