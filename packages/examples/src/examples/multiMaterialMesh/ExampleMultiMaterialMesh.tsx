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
import type { CanvasRenderer, WebGLRenderer } from "melonjs";
import {
	Application,
	loader,
	Mesh,
	Renderable,
	Vector3d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/multiMaterialMesh/`;

// the four Kenney spacecraft to showcase; each .obj has its companion
// .mtl with 3-5 differently-colored materials
const CRAFTS = [
	"craft_speederA",
	"craft_speederB",
	"craft_racer",
	"craft_miner",
];

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
	});

	app.world.backgroundColor.parseCSS("#0a0a1f");

	// preload every craft's OBJ + matching MTL. `type: "mtl"` parses
	// the materials so the Mesh constructor can look them up by name
	// later via `material: <mtl-name>`.
	const assets = [];
	for (const name of CRAFTS) {
		assets.push({ name, type: "obj", src: `${base}${name}.obj` });
		assets.push({ name, type: "mtl", src: `${base}${name}.mtl` });
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

			constructor(modelName: string, x: number, y: number, size: number) {
				super(0, 0, 1024, 768);
				this.anchorPoint.set(0, 0);
				this.mesh = new Mesh(x, y, {
					model: modelName,
					material: modelName, // MTL name = same as OBJ for Kenney pack
					width: size,
					height: size,
					cullBackFaces: true,
				});
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

		// 2x2 grid layout
		const cellW = 1024 / 2;
		const cellH = 768 / 2;
		const meshSize = 280;
		for (let i = 0; i < CRAFTS.length; i++) {
			const col = i % 2;
			const row = Math.floor(i / 2);
			const cx = cellW * col + cellW / 2;
			const cy = cellH * row + cellH / 2;
			app.world.addChild(new SpinningCraft(CRAFTS[i], cx, cy, meshSize));
		}

		// labels for each craft — HTML overlay since the grid is fixed
		const labelStyle =
			"position:absolute;color:#e0e0e0;font-family:'Courier New',monospace;" +
			"font-size:14px;font-weight:bold;text-shadow:0 0 4px #000;" +
			"z-index:1000;pointer-events:none;";
		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			for (let i = 0; i < CRAFTS.length; i++) {
				const col = i % 2;
				const row = Math.floor(i / 2);
				const label = document.createElement("div");
				label.textContent = CRAFTS[i].replace("craft_", "");
				// approximate engine→screen position; close enough for
				// labels (renderer.getCanvas().getBoundingClientRect()
				// would be exact but this is fine for a static layout)
				label.style.cssText = `${labelStyle}left:${(col * 0.5 + 0.25) * 100}%;top:${(row * 0.5 + 0.45) * 100}%;transform:translate(-50%,0);`;
				parent.appendChild(label);
			}
		}
	});
};

export const ExampleMultiMaterialMesh = createExampleComponent(createGame);
