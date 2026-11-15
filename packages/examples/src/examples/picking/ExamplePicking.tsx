/**
 * melonJS — picking in 3D.
 *
 * Under a perspective camera, a pixel is not a point in the world but a whole
 * line of them, so "what did I click" is a ray question. This example asks it
 * three ways:
 *
 * - **Pointer events on meshes.** `input.registerPointerEvent` works on a
 *   `Mesh` under a `Camera3d` exactly as on a 2D sprite: the crates highlight
 *   on `pointerenter`, dim on `pointerleave` and hop on `pointerdown`. The
 *   hit-test is the ray through the pointer against each crate's triangles,
 *   and `pointer.hit3d` says where it landed (point, normal, distance,
 *   triangle) — shown in the corner.
 * - **The floor is a mesh too.** Clicking it hands `pointer.hit3d.point` to
 *   the ball, which rolls there. A crate's handler returns `false`, so a click
 *   on a crate is not also a click on the floor behind it.
 * - **`camera.screenToWorld`** turns the pointer position into the point on
 *   the floor under it, every move, with no event registered on anything:
 *   that is what the ring is following.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	event,
	input,
	Light3d,
	loader,
	Mesh,
	type Pointer,
	plugin,
	Stage,
	state,
	Text,
	Tween,
	Vector3d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/materialTextures/`;
const MESH_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/`;

// render space is Y-DOWN: the floor is at y = 0 and up is negative
const GROUND_Y = 0;
const CRATE = 110;
const SPACING = 220;
const BALL = 60;

/** a flat quad lying on the floor, authored Y-UP like any mesh geometry */
const createFloor = (half: number) => {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#d9d4c7";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#cbc5b6";
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillRect(32, 32, 32, 32);
	}
	const reps = (half * 2) / 120;
	return new Mesh(0, GROUND_Y, {
		vertices: new Float32Array([
			-half,
			0,
			-half,
			half,
			0,
			-half,
			half,
			0,
			half,
			-half,
			0,
			half,
		]),
		uvs: new Float32Array([0, 0, reps, 0, reps, reps, 0, reps]),
		normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		texture: c,
		textureRepeat: "repeat",
		normalize: false,
		scale: 1,
		width: half * 2,
		height: half * 2,
		cullBackFaces: false,
		lit: true,
		castGroundShadow: false,
	});
};

/** a thin flat ring lying on the floor, the cursor's footprint */
const createRing = (radius: number, thickness: number) => {
	const segments = 48;
	const vertices = new Float32Array(segments * 2 * 3);
	const indices = new Uint16Array(segments * 6);
	for (let i = 0; i < segments; i++) {
		const a = (i / segments) * Math.PI * 2;
		const cos = Math.cos(a);
		const sin = Math.sin(a);
		vertices.set(
			[
				cos * radius,
				0,
				sin * radius,
				cos * (radius - thickness),
				0,
				sin * (radius - thickness),
			],
			i * 6,
		);
		const o = i * 2;
		const n = ((i + 1) % segments) * 2;
		indices.set([o, n, o + 1, o + 1, n, n + 1], i * 6);
	}
	const ring = new Mesh(0, GROUND_Y, {
		vertices,
		uvs: new Float32Array(segments * 4),
		indices,
		normalize: false,
		scale: 1,
		width: radius * 2,
		height: radius * 2,
		cullBackFaces: false,
		castGroundShadow: false,
		// drawn after the opaque scene, so a crate in front of it still hides it
		transparent: true,
	});
	ring.tint.setColor(255, 120, 40);
	return ring;
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
		app.world.backgroundColor.setColor(46, 52, 64);

		world.addChild(
			new Light3d({
				type: "directional",
				direction: [-0.4, 0.8, 0.45],
				color: "#fff4e6",
				intensity: 1.1,
			}),
		);
		world.addChild(
			new Light3d({ type: "ambient", color: "#6f7a94", intensity: 0.7 }),
		);

		const floor = createFloor(900);
		floor.isKinematic = false; // listen to the pointer
		world.addChild(floor, 0);

		// what the pointer is over, written by the handlers below
		const readout = new Text(16, 16, {
			font: "monospace",
			size: 16,
			fillStyle: "#f2f2f2",
			text: "hover a crate · click the floor",
		});
		readout.floating = true;
		world.addChild(readout, 100);
		const describe = (what: string, pointer: Pointer) => {
			const hit = pointer.hit3d;
			if (hit === null) {
				return;
			}
			const p = hit.point;
			const n = hit.normal;
			readout.setText([
				what,
				`point    ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`,
				`normal   ${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)}`,
				`distance ${hit.distance.toFixed(0)}  triangle ${hit.triangle}`,
			]);
		};

		// ── the crates: pointer events straight on the meshes ────────────
		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 3; col++) {
				const crate = new Mesh((col - 1) * SPACING, GROUND_Y - CRATE / 2, {
					model: "crate",
					material: "crate",
					width: CRATE,
					lit: true,
					castGroundShadow: true,
					shadowGroundY: GROUND_Y,
				});
				crate.rotate((row * 3 + col) * 0.35, new Vector3d(0, 1, 0));
				crate.isKinematic = false;
				world.addChild(crate, (row - 1) * SPACING);
				const name = `crate ${row * 3 + col + 1}`;
				const restY = crate.pos.y;
				let hopping = false;

				input.registerPointerEvent("pointerenter", crate, (pointer) => {
					crate.tint.setColor(255, 214, 120);
					describe(name, pointer);
				});
				input.registerPointerEvent("pointermove", crate, (pointer) => {
					describe(name, pointer);
				});
				input.registerPointerEvent("pointerleave", crate, () => {
					crate.tint.setColor(255, 255, 255);
				});
				input.registerPointerEvent("pointerdown", crate, () => {
					if (!hopping) {
						hopping = true;
						new Tween(crate.pos)
							.to(
								{ y: restY - 90 },
								{
									duration: 220,
									easing: Tween.Easing.Quadratic.Out,
									yoyo: true,
									repeat: 1,
								},
							)
							.onComplete(() => {
								hopping = false;
							})
							.start();
					}
					// handled: the floor behind the crate is not clicked too
					return false;
				});
			}
		}

		// ── the ball rolls to wherever the floor is clicked ──────────────
		const ball = new Mesh(0, GROUND_Y - BALL / 2, {
			model: "ball",
			material: "props",
			width: BALL,
			lit: true,
			castGroundShadow: true,
			shadowGroundY: GROUND_Y,
		});
		world.addChild(ball, -SPACING * 2);
		let roll: Tween | null = null;
		input.registerPointerEvent("pointerdown", floor, (pointer) => {
			const hit = pointer.hit3d;
			if (hit === null) {
				return;
			}
			// the hit record is reused by the next event: copy what we keep
			const from = { x: ball.pos.x, z: ball.depth };
			const to = { x: hit.point.x, z: hit.point.z };
			const distance = Math.hypot(to.x - from.x, to.z - from.z);
			roll?.stop();
			roll = new Tween(from)
				.to(to, {
					duration: 300 + distance * 0.9,
					easing: Tween.Easing.Quadratic.InOut,
				})
				.onUpdate(() => {
					ball.pos.x = from.x;
					ball.depth = from.z;
				})
				.start();
			describe("floor", pointer);
		});

		// ── the ring follows the floor point under the pointer ───────────
		const ring = createRing(46, 7);
		world.addChild(ring, 0);
		const camera = app.viewport as Camera3d;
		const onFloor = new Vector3d();
		const followPointer = (pointer: Pointer) => {
			// no event on anything: just "where does this pixel meet y = 0"
			const p = camera.screenToWorld(
				pointer.gameScreenX,
				pointer.gameScreenY,
				GROUND_Y,
				onFloor,
			);
			ring.alpha = p === null ? 0 : 1;
			if (p !== null) {
				// just above the floor (up is -y), so the two do not fight for depth
				ring.pos.set(p.x, p.y - 2);
				ring.depth = p.z;
			}
		};
		event.on(event.POINTERMOVE, followPointer);

		// ── camera: high and to the front, looking down at the grid ──────
		camera.setClipPlanes(10, 10000);
		camera.setPosition(0, -620, -880);
		camera.lookAt(0, 0, 0);

		return () => {
			event.off(event.POINTERMOVE, followPointer);
		};
	};

	class PickingStage extends Stage {
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
		{ name: "crate", type: "obj", src: `${ASSET_BASE}crate.obj` },
		{ name: "crate", type: "mtl", src: `${ASSET_BASE}crate.mtl` },
		{ name: "props", type: "mtl", src: `${ASSET_BASE}props.mtl` },
		{ name: "ball", type: "obj", src: `${MESH_BASE}sphere.obj` },
	]);
	state.set(state.PLAY, new PickingStage());
	state.change(state.PLAY);
};

export const ExamplePicking = createExampleComponent(createGame);
