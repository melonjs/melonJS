/**
 * melonJS — Multi-material OBJ mesh showcase.
 *
 * Loads four Kenney Space Kit (CC0) spacecraft, each with 3-5 named
 * MTL materials (metal / metalRed / metalDark / dark / …), and renders
 * them rotating in a 2×2 grid. The OBJ parser emits a Three.js / glTF
 * style `groups[]` array keyed by `materialName`; the `Mesh`
 * constructor bakes each material's diffuse color (`Kd`) into a
 * per-vertex color buffer so the whole mesh draws in a single GPU
 * call. `mesh.tint` then multiplies on top at render time — used here
 * to give each ship its own team color while keeping the per-material
 * palette intact (orange wings stay bright, dark cockpits stay dark).
 *
 * Compare with the `mesh3d` example: that one binds a single texture
 * across the whole mesh (checkerboard on cube / sphere / teapot).
 * This one exercises the multi-material code path — same `Mesh` API,
 * the only extra wiring is preloading the matching `.mtl` and passing
 * its name through `material:`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits
 * (Kenney Space Kit 2.0, CC0).
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
const MESH_SIZE = 240;

// engine-space Y for each row's mesh center. Top row ≈ 26% of the
// canvas, bottom row ≈ 69% — shifted up from cell centers so the
// per-row labels (drawn just above each ship) and any sub-pixel
// canvas cropping don't push the bottom row off-screen.
const ROW_Y = [200, 530];

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/multiMaterialMesh/`;

// The four Kenney spacecraft to showcase. Per-ship `tint` is a
// 0..1 RGB multiplier applied via `mesh.tint` after the MTL palette
// is baked into the vertex stream — multiplicative, so each
// material's contrast survives and the whole craft just shifts hue.
const CRAFTS = [
	{ name: "craft_speederA", tint: [1.0, 0.6, 0.55] }, // crimson
	{ name: "craft_speederB", tint: [0.55, 0.75, 1.0] }, // ice blue
	{ name: "craft_racer", tint: [0.55, 1.0, 0.65] }, // jade
	{ name: "craft_miner", tint: [1.0, 0.95, 0.55] }, // gold
];

// ─── entry point ──────────────────────────────────────────────────

const createGame = () => {
	const app = new Application(CANVAS_W, CANVAS_H, {
		parent: "screen",
		// Multi-material 3D meshes need the WebGL renderer for usable
		// frame rates — Canvas would solid-fill per triangle in JS,
		// correct but 10-50× slower than the GPU rasterizer.
		renderer: video.WEBGL,
		scale: "auto",
	});

	app.world.backgroundColor.parseCSS("#0a0a1f");
	plugin.register(DebugPanelPlugin, "debugPanel");

	loader.preload(buildAssetList(), () => {
		spawnCrafts(app);
		spawnLabels(app);
	});
};

// Build the list of (.obj, .mtl) pairs for every craft. `type: "mtl"`
// runs the MTL parser, populating the material cache so the Mesh
// constructor can look entries up by name via `material:`.
function buildAssetList() {
	const assets = [];
	for (const craft of CRAFTS) {
		assets.push({
			name: craft.name,
			type: "obj",
			src: `${ASSET_BASE}${craft.name}.obj`,
		});
		assets.push({
			name: craft.name,
			type: "mtl",
			src: `${ASSET_BASE}${craft.name}.mtl`,
		});
	}
	return assets;
}

// ─── per-craft renderable ─────────────────────────────────────────

const AXIS_Y = new Vector3d(0, 1, 0);
const AXIS_X = new Vector3d(1, 0, 0);

/**
 * One spinning spacecraft. Owns a `Mesh` constructed from the OBJ +
 * MTL pair — the Mesh detects multi-material from the OBJ's `groups`
 * array and bakes per-material colors into its vertex stream. The
 * team color is then applied via `mesh.tint` (multiplicative against
 * the baked palette).
 */
class SpinningCraft extends Renderable {
	mesh: Mesh;

	constructor(
		modelName: string,
		teamTint: number[],
		x: number,
		y: number,
		size: number,
	) {
		super(0, 0, CANVAS_W, CANVAS_H);
		this.anchorPoint.set(0, 0);
		this.mesh = new Mesh(x, y, {
			model: modelName,
			material: modelName, // MTL name matches OBJ name in the Kenney pack
			width: size,
			height: size,
			cullBackFaces: true,
		});
		this.mesh.tint.setColor(
			Math.round(teamTint[0] * 255),
			Math.round(teamTint[1] * 255),
			Math.round(teamTint[2] * 255),
		);
	}

	override update(dt: number): boolean {
		// Y spin + slight X wobble so every face of the model rotates
		// into view across the animation, exercising the per-material
		// color separation from all sides.
		this.mesh.rotate(dt * 0.0008, AXIS_Y);
		this.mesh.rotate(dt * 0.0003, AXIS_X);
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer): void {
		this.mesh.preDraw(renderer);
		this.mesh.draw(renderer);
		this.mesh.postDraw(renderer);
	}
}

// ─── scene helpers ────────────────────────────────────────────────

function spawnCrafts(app: Application) {
	const cellW = CANVAS_W / 2;
	for (let i = 0; i < CRAFTS.length; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const cx = cellW * col + cellW / 2;
		const craft = CRAFTS[i];
		app.world.addChild(
			new SpinningCraft(craft.name, craft.tint, cx, ROW_Y[row], MESH_SIZE),
		);
	}
}

/**
 * HTML labels positioned just above each craft. The canvas is scaled
 * by `scale: "auto"`, so positions are expressed as a percentage of
 * the parent element (the canvas wrapper) — they stay aligned with
 * the meshes regardless of the displayed canvas size.
 */
function spawnLabels(app: Application) {
	const parent = app.renderer.getCanvas().parentElement;
	if (!parent) {
		return;
	}
	parent.style.position = "relative";

	// label Y sits just above the mesh center (mesh half-extent ≈ MESH_SIZE/2)
	const labelOffsetY = MESH_SIZE / 2 + 10;
	const labelYPct = [
		(ROW_Y[0] - labelOffsetY) / CANVAS_H,
		(ROW_Y[1] - labelOffsetY) / CANVAS_H,
	];

	const baseStyle =
		"position:absolute;color:#e0e0e0;font-family:'Courier New',monospace;" +
		"font-size:14px;font-weight:bold;text-shadow:0 0 4px #000;" +
		"z-index:1000;pointer-events:none;transform:translate(-50%,-50%);";

	for (let i = 0; i < CRAFTS.length; i++) {
		const col = i % 2;
		const row = Math.floor(i / 2);
		const label = document.createElement("div");
		label.textContent = CRAFTS[i].name.replace("craft_", "");
		label.style.cssText = `${baseStyle}left:${(col * 0.5 + 0.25) * 100}%;top:${labelYPct[row] * 100}%;`;
		parent.appendChild(label);
	}
}

export const ExampleMultiMaterialMesh = createExampleComponent(createGame);
