/**
 * melonJS — Per-material diffuse textures on a multi-material OBJ.
 *
 * One supply crate, built from a `crate.obj` + `crate.mtl` pair whose three
 * materials each declare their own `map_Kd`: wooden boards on the sides,
 * steel plate on the lid and floor, a shipping label on the front. All the
 * example does is preload the pair and construct a `Mesh` — the `Mesh`
 * resolves each material's own texture and reduces them to the shortest list
 * of index ranges that need switching (`mesh.textureGroups`), which the GPU
 * batchers draw as one indexed range each over the same buffers. Adjacent
 * materials sharing a map are merged, so this crate costs three draws rather
 * than one per material.
 *
 * Companion to the `multiMaterialMesh` example, which shows the other half of
 * the multi-material path: per-material diffuse *colour* (`Kd`), baked into a
 * per-vertex colour buffer at construction and multiplied by a runtime tint.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import type { CanvasRenderer, WebGLRenderer } from "melonjs";
import {
	Application,
	loader,
	Mesh,
	plugin,
	Renderable,
	Vector3d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

// ─── layout & content ─────────────────────────────────────────────

const CANVAS_W = 1024;
const CANVAS_H = 768;
const CRATE_SIZE = 250;
const CRATE_Y = 400;
// caption sits in the empty band above the crate
const CAPTION_Y_PCT = 13;

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/materialTextures/`;

// ─── entry point ──────────────────────────────────────────────────

const createGame = async () => {
	// per-material texture switching is a GPU-backend feature: the Canvas
	// renderer solid-fills multi-material meshes per triangle and never
	// samples a texture at all, so there would be nothing to see.
	let app: Application;
	try {
		app = new Application(CANVAS_W, CANVAS_H, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
		});
		await app.init();
		if (!app.renderer.supportsDepthBuffer) {
			throw new Error("no GPU backend available (Canvas fallback)");
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: no GPU rendering is available in this browser.\n\n" +
				"Per-material mesh textures need a WebGPU- or WebGL-capable " +
				"browser/GPU. Try enabling hardware acceleration in your browser " +
				"settings, or open this example in a different browser.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	app.world.backgroundColor.parseCSS("#12161d");
	plugin.register(DebugPanelPlugin, "debugPanel");

	// only the .obj and .mtl are listed: the MTL loader fetches the three
	// `map_Kd` images itself, relative to the .mtl
	loader.preload(
		[
			{ name: "crate", type: "obj", src: `${ASSET_BASE}crate.obj` },
			{ name: "crate", type: "mtl", src: `${ASSET_BASE}crate.mtl` },
		],
		() => {
			app.world.addChild(new SpinningCrate(CANVAS_W / 2, CRATE_Y));
			spawnCaption(app);
		},
	);
};

// ─── per-crate renderable ─────────────────────────────────────────

const AXIS_Y = new Vector3d(0, 1, 0);
const AXIS_X = new Vector3d(1, 0, 0);

/**
 * The slowly turning crate. No texture wiring at all: `material:` names the
 * preloaded MTL, and each material's `map_Kd` follows from it. Passing an
 * explicit `texture:` here would pin one binding over the whole model
 * instead — that is how a caller opts out of the split.
 */
class SpinningCrate extends Renderable {
	mesh: Mesh;

	constructor(x: number, y: number) {
		super(0, 0, CANVAS_W, CANVAS_H);
		this.anchorPoint.set(0, 0);
		this.mesh = new Mesh(x, y, {
			model: "crate",
			material: "crate",
			width: CRATE_SIZE,
			height: CRATE_SIZE,
			cullBackFaces: true,
		});
		// tilted forward so the steel lid is in view alongside the boards and
		// the label — all three materials on screen from the first frame
		this.mesh.rotate(0.5, AXIS_X);
	}

	override update(dt: number): boolean {
		this.mesh.rotate(dt * 0.0005, AXIS_Y);
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer): void {
		this.mesh.preDraw(renderer);
		this.mesh.draw(renderer);
		this.mesh.postDraw(renderer);
	}
}

// ─── caption ──────────────────────────────────────────────────────

/**
 * An HTML caption over the canvas, naming the three materials in view. The
 * canvas is scaled by `scale: "auto"`, so the position is a percentage of
 * the wrapper element and stays put at any display size.
 */
function spawnCaption(app: Application) {
	const parent = app.renderer.getCanvas().parentElement;
	if (!parent) {
		return;
	}
	parent.style.position = "relative";

	const el = document.createElement("div");
	el.innerHTML =
		'<div style="font-size:16px;font-weight:bold">three materials, three diffuse maps</div>' +
		'<div style="font-size:12px;opacity:0.72;margin-top:5px">' +
		"wood boards · steel plate · shipping label — one .obj, one .mtl, three draw ranges" +
		"</div>";
	el.style.cssText =
		"position:absolute;color:#e6e9ef;font-family:'Courier New',monospace;" +
		"text-align:center;text-shadow:0 0 5px #000;z-index:1000;pointer-events:none;" +
		`transform:translate(-50%,-50%);left:50%;top:${CAPTION_Y_PCT}%;`;
	parent.appendChild(el);
}

export const ExampleMaterialTextures = createExampleComponent(createGame);
