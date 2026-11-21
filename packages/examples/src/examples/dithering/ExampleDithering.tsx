/**
 * melonJS — a dithered scene.
 *
 * One `DitherEffect` on the camera draws the whole scene in a few levels of
 * each color channel, in pixels several screen pixels wide, with an ordered
 * dither wherever a color falls between two levels. Nothing in the scene
 * knows about it: the shapes are plain lit meshes.
 *
 * What gets patterned is what lies between two levels, which is the shading:
 * the turn of a lit surface from light to dark, the soft edge of a shadow.
 * A flat color that is itself a level is left alone, so the sky and the
 * ground, which are given such colors, stay clean (at 6 and 16 levels: try
 * 3). Each shape keeps its own hue.
 *
 * The checkboxes switch the effect, the number of levels and the pixel size.
 * They are drawn by the same camera, so they are dithered with the rest.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	Camera3d,
	type CanvasRenderer,
	DitherEffect,
	Light3d,
	Mesh,
	Renderable,
	Stage,
	state,
	UICheckbox,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// render space is Y-DOWN: the floor is at y = 0 and up is negative
const GROUND_Y = 0;
const UP = new Vector3d(0, 1, 0);
// The sky and the ground are made of fifths of 255, which are levels of a
// channel at 6 levels and at 16: there they are left alone. At 3 levels they
// fall between two, and are patterned like everything else.
const SKY = "#0066cc";
const GROUND = [102, 204, 51] as const;

/** a flat sky behind the scene, in screen space */
class Backdrop extends Renderable {
	constructor() {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.setColor(SKY);
		renderer.fillRect(0, 0, renderer.width, renderer.height);
	}
}

type Geometry = {
	vertices: number[];
	normals: number[];
	indices: number[];
	width: number;
	height: number;
};

/** a mesh of one flat color from a geometry authored Y-UP */
const createShape = (
	geometry: Geometry,
	color: readonly [number, number, number],
	settings: { lit: boolean; castGroundShadow: boolean },
) => {
	const mesh = new Mesh(0, GROUND_Y, {
		vertices: new Float32Array(geometry.vertices),
		normals: new Float32Array(geometry.normals),
		uvs: new Float32Array((geometry.vertices.length / 3) * 2),
		indices: new Uint16Array(geometry.indices),
		normalize: false,
		scale: 1,
		width: geometry.width,
		height: geometry.height,
		cullBackFaces: false,
		shadowGroundY: GROUND_Y,
		shadowOpacity: 0.6,
		shadowScale: 1.3,
		...settings,
	});
	mesh.tint.setColor(color[0], color[1], color[2]);
	return mesh;
};

/** a round floor */
const disc = (radius: number): Geometry => {
	const segments = 64;
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
	return { vertices, normals, indices, width: radius * 2, height: radius * 2 };
};

/** a sphere stretched to three radii, with smooth normals */
const ellipsoid = (rx: number, ry: number, rz: number): Geometry => {
	const rings = 28;
	const segments = 44;
	const vertices: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	for (let r = 0; r <= rings; r++) {
		const phi = (r / rings) * Math.PI;
		for (let s = 0; s <= segments; s++) {
			const theta = (s / segments) * Math.PI * 2;
			const x = Math.sin(phi) * Math.cos(theta);
			const y = Math.cos(phi);
			const z = Math.sin(phi) * Math.sin(theta);
			vertices.push(x * rx, y * ry, z * rz);
			// the normal of a stretched sphere leans away from its long axes
			const n = new Vector3d(x / rx, y / ry, z / rz).normalize();
			normals.push(n.x, n.y, n.z);
			if (r < rings && s < segments) {
				const a = r * (segments + 1) + s;
				const b = a + segments + 1;
				indices.push(a, b, a + 1, b, b + 1, a + 1);
			}
		}
	}
	return { vertices, normals, indices, width: rx * 2, height: ry * 2 };
};

/** a ring standing upright, facing the camera */
const torus = (ring: number, tube: number): Geometry => {
	const around = 56;
	const across = 28;
	const vertices: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];
	for (let i = 0; i <= around; i++) {
		const u = (i / around) * Math.PI * 2;
		for (let j = 0; j <= across; j++) {
			const v = (j / across) * Math.PI * 2;
			const out = ring + tube * Math.cos(v);
			vertices.push(out * Math.cos(u), out * Math.sin(u), tube * Math.sin(v));
			normals.push(
				Math.cos(v) * Math.cos(u),
				Math.cos(v) * Math.sin(u),
				Math.sin(v),
			);
			if (i < around && j < across) {
				const a = i * (across + 1) + j;
				const b = a + across + 1;
				indices.push(a, b, a + 1, b, b + 1, a + 1);
			}
		}
	}
	const size = (ring + tube) * 2;
	return { vertices, normals, indices, width: size, height: size };
};

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 576, {
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

	const buildScene = (app: Application) => {
		const world = app.world;
		world.addChild(new Backdrop(), -10000);

		// a key light from the upper left, and a fill so the dark side of a
		// shape keeps some of its color
		world.addChild(
			new Light3d({
				type: "directional",
				direction: [0.5, 0.6, 0.65],
				color: [1, 1, 1],
				intensity: 1,
			}),
		);
		world.addChild(
			new Light3d({ type: "ambient", color: [1, 1, 1], intensity: 0.35 }),
		);

		// the ground is not lit: it keeps the one color it is given
		world.addChild(
			createShape(disc(2400), GROUND, { lit: false, castGroundShadow: false }),
			0,
		);

		// the shapes: each of one color, lit, with a soft shadow on the ground
		const place = (mesh: Mesh, x: number, y: number, z: number) => {
			mesh.pos.set(x, GROUND_Y - y);
			mesh.depth = z;
			world.addChild(mesh, z);
			return mesh;
		};
		const solid = { lit: true, castGroundShadow: true };
		place(
			createShape(ellipsoid(150, 100, 110), [235, 60, 70], solid),
			-300,
			100,
			-40,
		);
		const ball = place(
			createShape(ellipsoid(95, 95, 95), [170, 110, 80], solid),
			-95,
			250,
			120,
		);
		const ring = place(
			createShape(torus(92, 40), [245, 150, 40], solid),
			150,
			255,
			110,
		);
		place(
			createShape(ellipsoid(125, 70, 105), [175, 195, 220], solid),
			370,
			95,
			-70,
		);

		// ── the effect: on the camera, so on the whole scene ─────────────
		const dither = new DitherEffect(app.renderer as WebGLRenderer, {
			levels: 6,
			size: 3,
		});
		const camera = app.viewport as Camera3d;
		camera.addPostEffect(dither);

		// ── controls ─────────────────────────────────────────────────────
		const label = {
			font: "sans-serif",
			fontSize: 26,
			labelFillStyle: "#ffffff",
		};
		world.addChild(
			new UICheckbox(24, 20, {
				...label,
				label: "dither",
				checked: true,
				onChange: (on) => {
					// switched off rather than removed: it keeps its program
					dither.enabled = on;
				},
			}),
			100,
		);
		[3, 6, 16].forEach((levels, i) => {
			world.addChild(
				new UICheckbox(24, 76 + i * 40, {
					...label,
					group: "levels",
					label: `${levels} levels`,
					checked: levels === 6,
					onChange: (on) => {
						if (on) {
							dither.setLevels(levels);
						}
					},
				}),
				100,
			);
		});
		[2, 3, 5].forEach((size, i) => {
			world.addChild(
				new UICheckbox(24, 212 + i * 40, {
					...label,
					group: "size",
					label: `${size} px`,
					checked: size === 3,
					onChange: (on) => {
						if (on) {
							dither.setSize(size);
						}
					},
				}),
				100,
			);
		});

		// ── camera: a low view, drifting from side to side ───────────────
		camera.setClipPlanes(10, 8000);
		const target = { x: 20, y: GROUND_Y - 140, z: 40 };
		let time = 0;
		const tick = (dt: number) => {
			time += dt / 1000;
			const turn = Math.sin(time * 0.25) * 0.22;
			camera.setPosition(
				target.x + Math.sin(turn) * 730,
				target.y - 150,
				target.z - Math.cos(turn) * 730,
			);
			camera.lookAt(target.x, target.y, target.z);
			// the ring turns and the ball bobs, so their shading moves
			ring.rotate((dt / 1000) * 0.6, UP);
			ball.pos.y = GROUND_Y - 250 - Math.sin(time * 1.3) * 22;
		};
		tick(0);
		return tick;
	};

	class DitheringStage extends Stage {
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

	state.set(state.PLAY, new DitheringStage());
	state.change(state.PLAY);
};

export const ExampleDithering = createExampleComponent(createGame);
