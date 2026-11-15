/**
 * melonJS — toon shading and outlines.
 *
 * Two mesh settings give the cartoon look:
 *
 * - `toonBands` cuts the lit shading into that many flat bands, from shadow
 *   to fully lit, and turns a specular highlight into a hard-edged spot (see
 *   the penguin, which is given one).
 * - `outlineWidth` / `outlineColor` draw an ink line round the silhouette: an
 *   "inverted hull", a copy of the mesh pushed out along its normals and
 *   turned inside out. It follows the model as it moves — the character's
 *   outline waves with its arms.
 *
 * Both are per mesh, and a `GLTFModel` or a `level.load` takes them as options
 * for every part at once. The radio buttons switch the band count, the
 * checkbox the outlines, on everything in the scene.
 *
 * The character (Blocky Characters) and the pets (Cube Pets) are Kenney's,
 * CC0 (see `packages/examples/LICENSE.md`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	type CanvasRenderer,
	GLTFModel,
	Light3d,
	loader,
	Mesh,
	plugin,
	Renderable,
	Stage,
	state,
	UICheckbox,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { addKenneyCredit, KENNEY_LOGO } from "../kenneyCredit";
import { createExampleComponent } from "../utils";

const GLTF_BASE = `${import.meta.env.BASE_URL}assets/gltf/`;
const PETS_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/kenney/`;

// render space is Y-DOWN: the floor is at y = 0 and up is negative
const GROUND_Y = 0;
const INK = "#1d1a2b";
const UP = new Vector3d(0, 1, 0);

/** a flat, pastel sky behind the scene, in screen space */
class Backdrop extends Renderable {
	constructor() {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.setColor("#fde8c8");
		renderer.fillRect(0, 0, renderer.width, renderer.height);
	}
}

/** a round lit floor, authored Y-UP like any mesh geometry */
const createFloor = (radius: number) => {
	const segments = 48;
	const vertices = [0, 0, 0];
	const normals = [0, 1, 0];
	const indices: number[] = [];
	for (let i = 0; i <= segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		vertices.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
		normals.push(0, 1, 0);
		if (i > 0) {
			indices.push(0, i + 1, i);
		}
	}
	const floor = new Mesh(0, GROUND_Y, {
		vertices: new Float32Array(vertices),
		normals: new Float32Array(normals),
		uvs: new Float32Array((vertices.length / 3) * 2),
		indices: new Uint16Array(indices),
		normalize: false,
		scale: 1,
		width: radius * 2,
		height: radius * 2,
		cullBackFaces: false,
		lit: true,
		castGroundShadow: false,
	});
	floor.tint.setColor(150, 205, 170);
	return floor;
};

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			cameraClass: Camera3d,
			antiAlias: true,
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
		const world = app.world;
		world.addChild(new Backdrop(), -10000);

		// a key light from the upper left and a cool fill: toon shading needs
		// a light with a direction, or there is no terminator to band
		world.addChild(
			new Light3d({
				type: "directional",
				// travelling away from the camera (+Z), down (+Y) and to the
				// right: it lights the faces the camera sees
				direction: [0.45, 0.5, 0.75],
				color: [1, 0.96, 0.9],
				intensity: 1,
			}),
		);
		world.addChild(
			new Light3d({
				type: "ambient",
				color: [0.6, 0.65, 0.9],
				intensity: 0.6,
			}),
		);

		const floor = createFloor(420);
		world.addChild(floor, 0);

		// everything that takes the look, so the controls can switch it
		const styled: Mesh[] = [floor];

		// ── the character: one GLTFModel, the look given once for every part
		const data = loader.getGLTF("character");
		if (!data) {
			throw new Error('Toon: "character" did not preload.');
		}
		const { min, max } = data.bounds;
		const scale = 230 / (max[1] - min[1]);
		const hero = new GLTFModel(data, {
			scale,
			lit: true,
			toonBands: 3,
			outlineWidth: 3,
			outlineColor: INK,
			castGroundShadow: true,
			shadowGroundY: GROUND_Y,
		});
		hero.pos.set(0, GROUND_Y - min[1] * scale);
		hero.depth = 110;
		world.addChild(hero, 110);
		hero.setCurrentAnimation("emote-yes");
		for (const part of hero.getChildren()) {
			if (part instanceof Mesh) {
				styled.push(part);
			}
		}

		// ── two pets either side; the penguin gets a highlight to band ────
		const pet = (name: string, x: number, z: number, glossy: boolean) => {
			const mesh = new Mesh(x, GROUND_Y - 70, {
				model: name,
				material: name,
				texture: "colormap",
				width: 140,
				height: 140,
				lit: true,
				toonBands: 3,
				outlineWidth: 3,
				outlineColor: INK,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
				...(glossy ? { specular: [1, 1, 1], shininess: 24 } : {}),
			});
			mesh.depth = z;
			// face the front of the turntable
			mesh.rotate(Math.PI, UP);
			world.addChild(mesh, z);
			styled.push(mesh);
			return mesh;
		};
		pet("animal-cat", -250, -60, false);
		pet("animal-penguin", 250, -60, true);

		// ── controls ─────────────────────────────────────────────────────
		const label = { font: "sans-serif", fontSize: 18, labelFillStyle: INK };
		[
			["smooth", 0],
			["2 bands", 2],
			["3 bands", 3],
			["4 bands", 4],
		].forEach(([text, bands], i) => {
			world.addChild(
				new UICheckbox(24, 24 + i * 32, {
					...label,
					group: "bands",
					label: text as string,
					checked: bands === 3,
					onChange: (on) => {
						if (on) {
							for (const m of styled) {
								m.toonBands = bands as number;
							}
						}
					},
				}),
				100,
			);
		});
		world.addChild(
			new UICheckbox(24, 24 + 4 * 32 + 12, {
				...label,
				label: "outlines",
				checked: true,
				onChange: (on) => {
					// the floor stays un-inked: an outline round the ground
					// would ring the whole scene
					for (const m of styled) {
						if (m !== floor) {
							m.outlineWidth = on ? 3 : 0;
						}
					}
				},
			}),
			100,
		);
		// the floor is never outlined, but it does band
		floor.outlineWidth = 0;

		// dark lettering on the pale backdrop
		addKenneyCredit(app, INK);

		// ── camera: a low three-quarter view of the turntable ────────────
		const camera = app.viewport as Camera3d;
		camera.setClipPlanes(10, 6000);
		const target = { x: 0, y: GROUND_Y - 90, z: 60 };
		let turn = 0;
		const tick = (dt: number) => {
			turn += dt * 0.00018;
			camera.setPosition(
				target.x + Math.sin(turn) * 760,
				target.y - 260,
				target.z - Math.cos(turn) * 760,
			);
			camera.lookAt(target.x, target.y, target.z);
		};
		tick(0);
		return tick;
	};

	class ToonStage extends Stage {
		#tick: ((dt: number) => void) | null = null;

		override onResetEvent(app: Application) {
			this.#tick = buildScene(app);
		}

		override update(dt: number) {
			this.#tick?.(dt);
			return super.update(dt);
		}

		override onDestroyEvent() {
			this.#tick = null;
		}
	}

	await loader.preload([
		{ name: "character", type: "glb", src: `${GLTF_BASE}character.glb` },
		{
			name: "colormap",
			type: "image",
			src: `${PETS_BASE}Textures/colormap.png`,
		},
		...["animal-cat", "animal-penguin"].flatMap((name) => {
			return [
				{ name, type: "obj", src: `${PETS_BASE}${name}.obj` },
				{ name, type: "mtl", src: `${PETS_BASE}${name}.mtl` },
			];
		}),
		KENNEY_LOGO,
	]);
	state.set(state.PLAY, new ToonStage());
	state.change(state.PLAY);
};

export const ExampleToon = createExampleComponent(createGame);
