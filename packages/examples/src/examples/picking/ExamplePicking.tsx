/**
 * melonJS — picking in 3D.
 *
 * Under a perspective camera, a pixel is not a point in the world but a whole
 * line of them, so "what did I click" is a ray question. This example asks it
 * three ways:
 *
 * - **Pointer events on meshes.** `input.registerPointerEvent` works on a
 *   `Mesh` under a `Camera3d` exactly as on a 2D sprite: the pets highlight
 *   on `pointerenter` and dim on `pointerleave`; a click selects one and
 *   makes it hop. The hit-test is the ray through the pointer against each
 *   pet's triangles, and `pointer.hit3d` says where it landed (point,
 *   normal, distance, triangle) — shown in the corner.
 * - **Drag and drop.** Hold a pet and move the pointer: it lifts off the
 *   floor and follows the point under the pointer (`camera.screenToWorld`
 *   again), until it is let go and lands there.
 * - **The floor is a mesh too.** Clicking it hands `pointer.hit3d.point` to
 *   the selected pet, which hops over there. A pet's handler returns
 *   `false`, so a click on a pet is not also a click on the floor behind it.
 * - **`camera.screenToWorld`** turns the pointer position into the point on
 *   the floor under it, every move, with no event registered on anything:
 *   that is what the ring is following.
 *
 * The pets are Kenney's Cube Pets (CC0, see `packages/examples/LICENSE.md`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	Color,
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
import { addKenneyCredit, KENNEY_LOGO } from "../kenneyCredit";
import { createExampleComponent } from "../utils";

const PETS_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/kenney/`;
// three rows of three, left to right, back to front
const PETS = [
	"animal-elephant",
	"animal-giraffe",
	"animal-lion",
	"animal-panda",
	"animal-fox",
	"animal-tiger",
	"animal-penguin",
	"animal-pig",
	"animal-bunny",
];

// render space is Y-DOWN: the floor is at y = 0 and up is negative
const GROUND_Y = 0;
const PET = 130;
const SPACING = 220;
// how far a held pet is lifted off the floor
const LIFT = 45;
// how far (in screen pixels) the pointer moves before a press becomes a drag
const DRAG_SLOP = 6;

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
			text: "hover a pet · drag it around · click it, then the floor, to send it there",
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

		// a hop on the spot, or across the floor to (x, z)
		const restY = GROUND_Y - PET / 2;
		const hop = (pet: Mesh, x = pet.pos.x, z = pet.depth) => {
			const from = { x: pet.pos.x, z: pet.depth, t: 0 };
			const distance = Math.hypot(x - from.x, z - from.z);
			new Tween(from)
				.to({ x, z, t: 1 }, { duration: 260 + distance * 0.8 })
				.onUpdate(() => {
					pet.pos.x = from.x;
					pet.depth = from.z;
					// one arc, higher for a longer hop
					pet.pos.y =
						restY - Math.sin(from.t * Math.PI) * (70 + distance * 0.15);
				})
				.start();
		};

		// ── the pet being held, from press to release ────────────────────
		let held: Mesh | null = null;
		let dragged = false;
		let pressX = 0;
		let pressY = 0;
		// let go: a click makes it hop, a drag sets it down where it is
		const release = () => {
			const pet = held;
			if (pet === null) {
				return;
			}
			held = null;
			if (!dragged) {
				hop(pet);
				return;
			}
			const fall = { y: pet.pos.y };
			new Tween(fall)
				.to({ y: restY }, { duration: 260, easing: Tween.Easing.Bounce.Out })
				.onUpdate(() => {
					pet.pos.y = fall.y;
				})
				.start();
		};

		// ── the pets: pointer events straight on the meshes ──────────────
		const highlight = new Color(255, 220, 140);
		const selectedTint = new Color(205, 240, 255);
		const white = new Color(255, 255, 255);
		let selected: Mesh | null = null;
		PETS.forEach((name, i) => {
			const row = Math.floor(i / 3);
			const col = i % 3;
			const pet = new Mesh((col - 1) * SPACING, restY, {
				model: name,
				material: name,
				width: PET,
				height: PET,
				lit: true,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
			});
			// turned toward the camera, a little each
			pet.rotate(Math.PI + (col - 1) * 0.35, new Vector3d(0, 1, 0));
			pet.isKinematic = false;
			world.addChild(pet, (1 - row) * SPACING);
			const label = name.replace("animal-", "");
			const rest = () => {
				pet.tint.copy(pet === selected ? selectedTint : white);
			};

			input.registerPointerEvent("pointerenter", pet, (pointer) => {
				pet.tint.copy(highlight);
				describe(label, pointer);
			});
			input.registerPointerEvent("pointermove", pet, (pointer) => {
				describe(label, pointer);
			});
			input.registerPointerEvent("pointerleave", pet, rest);
			// the fox, in the middle, starts selected: a floor click works at once
			if (name === "animal-fox") {
				selected = pet;
				rest();
			}
			input.registerPointerEvent("pointerdown", pet, (pointer) => {
				const previous = selected;
				selected = pet;
				if (previous !== null && previous !== pet) {
					previous.tint.copy(white);
				}
				// held: a drag if the pointer moves, a click if it does not
				held = pet;
				dragged = false;
				pressX = pointer.gameScreenX;
				pressY = pointer.gameScreenY;
				describe(`${label} (selected)`, pointer);
				// handled: the floor behind the pet is not clicked too
				return false;
			});
		});

		// let go anywhere: the pointer is rarely still over the pet it lifted,
		// so the release is caught by the viewport, which every press reaches
		input.registerPointerEvent("pointerup", app.viewport, release);

		// ── the selected pet hops to wherever the floor is clicked ───────
		input.registerPointerEvent("pointerdown", floor, (pointer) => {
			const hit = pointer.hit3d;
			if (hit === null || selected === null) {
				return;
			}
			// the hit record is reused by the next event: copy what we keep
			hop(selected, hit.point.x, hit.point.z);
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
			// a held pet becomes a drag once the pointer has really moved, and
			// is carried over the floor point under it, lifted off the ground
			if (held !== null && p !== null) {
				if (
					!dragged &&
					Math.hypot(
						pointer.gameScreenX - pressX,
						pointer.gameScreenY - pressY,
					) > DRAG_SLOP
				) {
					dragged = true;
				}
				if (dragged) {
					held.pos.x = p.x;
					held.pos.y = restY - LIFT;
					held.depth = p.z;
				}
			}
		};
		event.on(event.POINTERMOVE, followPointer);

		// ── camera: high and to the front, looking down at the grid ──────
		camera.setClipPlanes(10, 10000);
		camera.setPosition(0, -620, -880);
		camera.lookAt(0, 0, 0);

		// dark lettering: the floor behind it is light
		addKenneyCredit(app, "#2e3440");

		return () => {
			event.off(event.POINTERMOVE, followPointer);
			input.releasePointerEvent("pointerup", app.viewport);
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
		{
			name: "colormap",
			type: "image",
			src: `${PETS_BASE}Textures/colormap.png`,
		},
		...PETS.flatMap((name) => {
			return [
				{ name, type: "obj", src: `${PETS_BASE}${name}.obj` },
				{ name, type: "mtl", src: `${PETS_BASE}${name}.mtl` },
			];
		}),
		KENNEY_LOGO,
	]);
	state.set(state.PLAY, new PickingStage());
	state.change(state.PLAY);
};

export const ExamplePicking = createExampleComponent(createGame);
