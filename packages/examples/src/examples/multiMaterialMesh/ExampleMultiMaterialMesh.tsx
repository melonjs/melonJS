/**
 * melonJS — Multi-material OBJ mesh example.
 *
 * Loads four Kenney Space Kit (CC0) spacecraft, each with multiple
 * `usemtl` material groups (metal / metalRed / metalDark / dark / …),
 * and renders them side by side rotating in 3D. Every panel of every
 * spacecraft picks up the diffuse color (`Kd`) from its bound MTL
 * material, so the multi-color paint scheme of each model survives —
 * the OBJ parser emits `groups: [{materialName, start, count}, …]`
 * (matching the Three.js / glTF convention) and `Mesh.draw()` iterates
 * those, swapping tint per draw call.
 *
 * Compare with the `mesh3d` example: that one binds a single texture
 * across the whole mesh (checkerboard on cube / sphere / teapot).
 * This one demonstrates the multi-material code path — same Mesh
 * class, no extra wiring beyond passing the MTL name through
 * `material:`.
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

const base = `${import.meta.env.BASE_URL}assets/multiMaterialMesh/`;

// the four Kenney spacecraft to showcase; each .obj has its companion
// .mtl with 3-5 differently-colored materials. Per-ship "team color"
// multipliers are applied on top of the MTL palette so the four ships
// don't all read as the same grey-and-orange blob — the multiplication
// preserves the per-material contrast (orange wings stay brighter than
// the body, dark cockpits stay dark) while tinting the whole craft
// toward its team hue.
const CRAFTS = [
	{ name: "craft_speederA", tint: [1.0, 0.6, 0.55] }, // crimson
	{ name: "craft_speederB", tint: [0.55, 0.75, 1.0] }, // ice blue
	{ name: "craft_racer", tint: [0.55, 1.0, 0.65] }, // jade
	{ name: "craft_miner", tint: [1.0, 0.95, 0.55] }, // gold
];

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		// Multi-material 3D meshes require the WebGL renderer for usable
		// frame rates — Canvas falls back to per-triangle solid-fill in
		// JS, which is correct (per-vertex baked colors, global painter's
		// sort) but is 10-50× slower than the GPU rasterizer for the
		// same scene. Force WebGL here.
		renderer: video.WEBGL,
		scale: "auto",
	});

	app.world.backgroundColor.parseCSS("#0a0a1f");
	plugin.register(DebugPanelPlugin, "debugPanel");

	// preload every craft's OBJ + matching MTL. `type: "mtl"` parses
	// the materials so the Mesh constructor can look them up by name
	// later via `material: <mtl-name>`.
	const assets = [];
	for (const craft of CRAFTS) {
		assets.push({
			name: craft.name,
			type: "obj",
			src: `${base}${craft.name}.obj`,
		});
		assets.push({
			name: craft.name,
			type: "mtl",
			src: `${base}${craft.name}.mtl`,
		});
	}

	loader.preload(assets, () => {
		const axisY = new Vector3d(0, 1, 0);
		const axisX = new Vector3d(1, 0, 0);

		/**
		 * Renderable wrapper for one spinning spacecraft. Owns a single
		 * `Mesh` instance and drives its 3D rotation each frame. The
		 * Mesh sees that the OBJ has multiple material groups + we
		 * passed `material: name`, so it builds an internal
		 * `mesh.groups` array and `draw()` issues one tinted draw call
		 * per material region.
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
				super(0, 0, 1024, 768);
				this.anchorPoint.set(0, 0);
				this.mesh = new Mesh(x, y, {
					model: modelName,
					material: modelName, // MTL name = same as OBJ for Kenney pack
					width: size,
					height: size,
					cullBackFaces: true,
				});
				// Apply the per-ship team color via `mesh.tint`. The
				// per-material Kd values are already baked into the
				// vertex stream at construction time (multi-material
				// tier 2), so `mesh.tint` here is the global
				// multiplier — every panel's baked color × team color.
				// Each material's relative brightness is preserved
				// (orange wings stay brighter than the body, dark
				// cockpits stay dark) while the whole craft shifts
				// toward its team hue. This is the canonical
				// "vertex color × material color × runtime tint"
				// pattern from real-time 3D.
				this.mesh.tint.setColor(
					Math.round(teamTint[0] * 255),
					Math.round(teamTint[1] * 255),
					Math.round(teamTint[2] * 255),
				);
			}

			override update(dt: number): boolean {
				// Y spin + slight X wobble — gives every panel of the
				// model a chance to face camera so the per-material
				// colors are all visible across the animation
				this.mesh.rotate(dt * 0.0008, axisY);
				this.mesh.rotate(dt * 0.0003, axisX);
				return true;
			}

			override draw(renderer: WebGLRenderer | CanvasRenderer): void {
				this.mesh.preDraw(renderer);
				this.mesh.draw(renderer);
				this.mesh.postDraw(renderer);
			}
		}

		// 2x2 grid layout. Y positions are shifted up from cell centers
		// so the per-row labels (placed just above each ship) and any
		// cut-off below the canvas in narrow viewports don't push the
		// bottom row off-screen.
		const cellW = 1024 / 2;
		const meshSize = 240;
		// engine Y for each row's mesh center — top row at ~25% of the
		// 768 canvas, bottom row at ~65%. Labels go just above (~18%
		// below the row top edge).
		const ROW_Y = [200, 530];
		for (let i = 0; i < CRAFTS.length; i++) {
			const col = i % 2;
			const row = Math.floor(i / 2);
			const cx = cellW * col + cellW / 2;
			const craft = CRAFTS[i];
			app.world.addChild(
				new SpinningCraft(craft.name, craft.tint, cx, ROW_Y[row], meshSize),
			);
		}

		// HTML labels positioned above each craft. The canvas is scaled
		// by `scale: "auto"` so we use % of the parent (which wraps the
		// canvas) for both axes — keeps labels aligned regardless of the
		// final display size.
		const labelStyle =
			"position:absolute;color:#e0e0e0;font-family:'Courier New',monospace;" +
			"font-size:14px;font-weight:bold;text-shadow:0 0 4px #000;" +
			"z-index:1000;pointer-events:none;transform:translate(-50%,-50%);";
		// label Y as % of the 768 canvas height, sitting just above the
		// mesh center (mesh half-extent ≈ meshSize/2 → ~125 engine px)
		const LABEL_Y_PCT = [(ROW_Y[0] - 130) / 768, (ROW_Y[1] - 130) / 768];
		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			for (let i = 0; i < CRAFTS.length; i++) {
				const col = i % 2;
				const row = Math.floor(i / 2);
				const label = document.createElement("div");
				label.textContent = CRAFTS[i].name.replace("craft_", "");
				label.style.cssText = `${labelStyle}left:${(col * 0.5 + 0.25) * 100}%;top:${LABEL_Y_PCT[row] * 100}%;`;
				parent.appendChild(label);
			}
		}
	});
};

export const ExampleMultiMaterialMesh = createExampleComponent(createGame);
