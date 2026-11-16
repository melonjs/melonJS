/**
 * melonJS — a slingshot game on 3D physics.
 *
 * Pull a pet back in the slingshot and let go: it flies along the dotted arc
 * and crashes into towers of wood and stone, which topple and tumble in three
 * dimensions. Knock every golden orb to the ground with the pets you have.
 *
 * What it shows:
 *
 * - **`@melonjs/rapier3d-adapter`**, passed as the `physic` option with a
 *   `Camera3d`. Every block, orb and pet is a `Mesh` with a `bodyDef`; the
 *   adapter writes each body's position and turn back onto its mesh.
 * - **The 3D shapes.** Blocks are `Box3d`, orbs `Sphere`, and each pet the
 *   `ConvexHull3d` of its own model, built with `ConvexHull3d.fromMesh()`, so
 *   it tumbles as the shape it is drawn.
 * - **The `Vector3d` adapter API.** The pet waits in the pouch as a static
 *   body, moved with `setPosition` while it is pulled (from a press anywhere,
 *   which a phone needs: a pet is a small target under a finger); letting go makes it
 *   dynamic (`setStatic(false)`) and launches it with `setVelocity` and
 *   `setAngularVelocity`, with Rapier's continuous collision on so a fast pet
 *   cannot pass through a thin plank.
 * - **Collision hooks**: an orb's `onCollisionStart` tells when it reaches the
 *   ground.
 *
 * The pets are Kenney's Cube Pets (CC0, see `packages/examples/LICENSE.md`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Rapier3dAdapter } from "@melonjs/rapier3d-adapter";
import {
	Application,
	Box3d,
	Camera3d,
	ConvexHull3d,
	event,
	input,
	Light3d,
	loader,
	Mesh,
	type Pointer,
	plugin,
	Renderable,
	Sphere,
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
const MESH_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/`;
// launched in this order, one per shot
const PETS = [
	"animal-chick",
	"animal-bunny",
	"animal-penguin",
	"animal-panda",
	"animal-elephant",
];

// render space is Y-DOWN: the ground's top is at y = 0 and up is negative
const GROUND_Y = 0;
// in the physics too: gravity pulls along +Y, in pixels per second²
const GRAVITY = 980;
const PET = 64;
const ORB = 36;
// the raised deck the slingshot stands on, and the next pets wait on
const DECK_TOP = -70;
// where the pet waits in the pouch, how far it can be pulled, and how hard;
// in from the left edge, so a full pull still has room on screen
const POUCH = new Vector3d(-400, -250, 0);
// how far apart the waiting pets stand, in line behind the slingshot
const QUEUE_GAP = 58;
const MAX_PULL = 120;
const POWER = 11;
// a pet is done once it rests, leaves the field, or after this long
const SHOT_SECONDS = 7;
const AXIS_Y = new Vector3d(0, 1, 0);
const AXIS_Z = new Vector3d(0, 0, 1);

/** a canvas texture: wood planks, stone, grass, or plain white */
const paint = (kind: "wood" | "stone" | "grass" | "white") => {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		if (kind === "wood") {
			ctx.fillStyle = "#c98b4f";
			ctx.fillRect(0, 0, 64, 64);
			ctx.fillStyle = "#b07440";
			for (let y = 0; y < 64; y += 16) {
				ctx.fillRect(0, y, 64, 3);
			}
			ctx.fillStyle = "#dca267";
			ctx.fillRect(0, 6, 64, 2);
			ctx.fillRect(0, 38, 64, 2);
		} else if (kind === "grass") {
			ctx.fillStyle = "#7cb85a";
			ctx.fillRect(0, 0, 64, 64);
			ctx.fillStyle = "#6fab4e";
			ctx.fillRect(0, 0, 32, 32);
			ctx.fillRect(32, 32, 32, 32);
		} else if (kind === "white") {
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, 64, 64);
		} else {
			ctx.fillStyle = "#9aa0a8";
			ctx.fillRect(0, 0, 64, 64);
			ctx.fillStyle = "#868c94";
			ctx.fillRect(0, 31, 64, 3);
			ctx.fillRect(31, 0, 3, 31);
			ctx.fillRect(12, 34, 3, 30);
			ctx.fillRect(48, 34, 3, 30);
		}
	}
	return c;
};

/**
 * A box mesh `w` × `h` × `d` pixels, centred on its position, so that a
 * `Box3d(0, 0, 0, w, h, d)` is exactly its outline. Authored Y-UP like any
 * mesh geometry; a box looks the same either way.
 */
const createBox = (
	w: number,
	h: number,
	d: number,
	texture: HTMLCanvasElement | string,
) => {
	const x = w / 2;
	const y = h / 2;
	const z = d / 2;
	// each face: its four corners and its normal
	const faces: [number[][], number[]][] = [
		[
			[
				[x, -y, -z],
				[x, y, -z],
				[x, y, z],
				[x, -y, z],
			],
			[1, 0, 0],
		],
		[
			[
				[-x, -y, z],
				[-x, y, z],
				[-x, y, -z],
				[-x, -y, -z],
			],
			[-1, 0, 0],
		],
		[
			[
				[-x, y, -z],
				[-x, y, z],
				[x, y, z],
				[x, y, -z],
			],
			[0, 1, 0],
		],
		[
			[
				[-x, -y, z],
				[-x, -y, -z],
				[x, -y, -z],
				[x, -y, z],
			],
			[0, -1, 0],
		],
		[
			[
				[-x, -y, z],
				[x, -y, z],
				[x, y, z],
				[-x, y, z],
			],
			[0, 0, 1],
		],
		[
			[
				[x, -y, -z],
				[-x, -y, -z],
				[-x, y, -z],
				[x, y, -z],
			],
			[0, 0, -1],
		],
	];
	const vertices: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	faces.forEach(([corners, normal], f) => {
		for (const c of corners) {
			vertices.push(...c);
			normals.push(...normal);
		}
		// one texture tile per 64 pixels, along the face's two longest sides
		const [a, b] = [w, h, d]
			.filter((_, i) => {
				return normal[i] === 0;
			})
			.map((size) => {
				return size / 64;
			});
		uvs.push(0, 0, a, 0, a, b, 0, b);
		const o = f * 4;
		indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
	});
	return new Mesh(0, 0, {
		vertices: new Float32Array(vertices),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
		texture,
		textureRepeat: "repeat",
		normalize: false,
		scale: 1,
		width: w,
		height: h,
		cullBackFaces: false,
		lit: true,
		castGroundShadow: true,
		shadowGroundY: GROUND_Y,
	});
};

/**
 * The painted backdrop: one upright quad far behind the field, its horizon
 * level with the far edge of the ground, the picture repeated across it so
 * its trees stay small. Unlit, so it keeps its own colours.
 */
const createBackdrop = (w: number, h: number) => {
	const x = w / 2;
	const y = h / 2;
	// the picture is 4:3: how many times it fits across
	const across = w / ((h * 4) / 3);
	return new Mesh(0, 0, {
		// Y-UP like any mesh geometry: the top edge takes the image's top row
		vertices: new Float32Array([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]),
		uvs: new Float32Array([0, 1, across, 1, across, 0, 0, 0]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		texture: "backdrop",
		textureRepeat: "repeat",
		normalize: false,
		scale: 1,
		width: w,
		height: h,
		cullBackFaces: false,
		castGroundShadow: false,
	});
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
			// Rapier's WebAssembly downloads and compiles before the game starts
			physic: await Rapier3dAdapter.create({
				gravity: { x: 0, y: GRAVITY, z: 0 },
				pixelsPerMeter: 50,
			}),
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

	const wood = paint("wood");
	const stone = paint("stone");
	const grass = paint("grass");
	const white = paint("white");

	/**
	 * Build a round: the field, the towers, the slingshot.
	 * @param app - the running application
	 * @param restart - builds a new round, once this frame is done
	 * @returns what to undo when the round goes
	 */
	const buildScene = (app: Application, restart: () => void) => {
		const world = app.world;
		const adapter = world.adapter as Rapier3dAdapter;
		const camera = app.viewport as Camera3d;
		// the sky above the backdrop, in the colour of its top edge
		world.backgroundColor.setColor(135, 206, 235);

		world.addChild(
			new Light3d({
				type: "directional",
				direction: [-0.5, 0.8, 0.35],
				color: "#fff4e6",
				intensity: 1.1,
			}),
		);
		world.addChild(
			new Light3d({ type: "ambient", color: "#8fa3c2", intensity: 0.75 }),
		);

		// ── the backdrop, and the ground running back to meet it ─────────
		// the backdrop's horizon is 55% of the way down the picture
		const BACK_Z = 1700;
		// tall enough that its top edge stays above the view
		const backdrop = createBackdrop(9600, 3600);
		backdrop.pos.set(0, 3600 * (0.5 - 0.55));
		world.addChild(backdrop, BACK_Z);

		// a thick static slab, its top at y = 0
		const ground = createBox(6000, 40, BACK_Z * 2, grass);
		ground.pos.set(0, GROUND_Y + 20);
		ground.castGroundShadow = false;
		ground.bodyDef = {
			type: "static",
			shapes: [new Box3d(0, 0, 0, 6000, 40, BACK_Z * 2)],
			friction: 0.8,
		};
		world.addChild(ground, 0);

		// ── the deck: a raised stone platform for the slingshot and the
		// pets waiting their turn
		const DECK_LEFT = POUCH.x - 70 - QUEUE_GAP * (PETS.length - 1) - 40;
		const DECK_RIGHT = POUCH.x + 60;
		const deckW = DECK_RIGHT - DECK_LEFT;
		const deck = createBox(deckW, -DECK_TOP, 120, stone);
		deck.pos.set((DECK_LEFT + DECK_RIGHT) / 2, DECK_TOP / 2);
		deck.bodyDef = {
			type: "static",
			shapes: [new Box3d(0, 0, 0, deckW, -DECK_TOP, 120)],
			friction: 0.8,
		};
		world.addChild(deck, 0);

		// ── the slingshot: a post and two prongs, one in front, one behind
		const prongTop = POUCH.y - 20;
		// from the deck up to just inside the prongs
		const postTop = prongTop + 60;
		const post = createBox(18, DECK_TOP - postTop, 18, wood);
		post.pos.set(POUCH.x, (DECK_TOP + postTop) / 2);
		world.addChild(post, 0);
		const prongs = [-40, 40].map((z) => {
			const prong = createBox(14, 70, 14, wood);
			prong.pos.set(POUCH.x, prongTop + 35);
			world.addChild(prong, z);
			return prong;
		});
		// the two bands, from each prong's tip to the pet: a box stretched
		// and turned along the band, every frame
		const bands = prongs.map((prong) => {
			const band = createBox(1, 6, 6, wood);
			band.tint.setColor(90, 40, 30);
			band.castGroundShadow = false;
			world.addChild(band, prong.depth);
			return band;
		});
		const tipY = prongTop;
		const stretch = (band: Mesh, to: { x: number; y: number }) => {
			const dx = to.x - POUCH.x;
			const dy = to.y - tipY;
			const length = Math.max(Math.hypot(dx, dy), 1);
			band.pos.set(POUCH.x + dx / 2, tipY + dy / 2);
			// the mesh turns in its model's Y-up space, where the Y-down
			// angle runs the other way
			band.currentTransform
				.identity()
				.rotate(-Math.atan2(dy, dx), AXIS_Z)
				.scale(length, 1, 1);
		};

		// ── the towers, and the orbs to knock off them ───────────────────
		const blocks: Mesh[] = [];
		const block = (
			x: number,
			y: number,
			w: number,
			h: number,
			material: "wood" | "stone",
			z = 0,
		) => {
			const d = 70;
			const b = createBox(w, h, d, material === "wood" ? wood : stone);
			b.pos.set(x, y);
			b.bodyDef = {
				type: "dynamic",
				shapes: [new Box3d(0, 0, 0, w, h, d)],
				density: material === "wood" ? 0.6 : 2,
				friction: 0.7,
			};
			world.addChild(b, z);
			blocks.push(b);
			return b;
		};
		// a two-storey wooden tower: posts, a plank, smaller posts, a plank
		const tower = (x: number, z: number) => {
			block(x - 60, -65, 22, 130, "wood", z);
			block(x + 60, -65, 22, 130, "wood", z);
			block(x, -141, 180, 22, "wood", z);
			block(x - 45, -202, 20, 100, "wood", z);
			block(x + 45, -202, 20, 100, "wood", z);
			block(x, -263, 140, 22, "wood", z);
			return [
				{ x, y: -152 - ORB / 2, z },
				{ x, y: -274 - ORB / 2, z },
			];
		};
		// stone columns with a wooden lintel
		const gate = (x: number, z: number) => {
			for (const side of [-55, 55]) {
				for (let i = 0; i < 3; i++) {
					block(x + side, -30 - i * 60, 60, 60, "stone", z);
				}
			}
			block(x, -191, 200, 22, "wood", z);
			return [{ x, y: -202 - ORB / 2, z }];
		};

		const orbs: Mesh[] = [];
		let orbsDown = 0;
		const knock = (orb: Mesh) => {
			if (orb.tint.r < 255) {
				return;
			}
			orbsDown++;
			orb.tint.setColor(120, 110, 100);
			camera.shake(5, 220);
			refresh();
		};
		const spots = [...tower(180, 10), ...gate(470, -15), ...tower(720, 20)];
		for (const spot of spots) {
			const orb = new Mesh(spot.x, spot.y, {
				model: "sphere",
				texture: white,
				width: ORB,
				height: ORB,
				lit: true,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
			});
			orb.tint.setColor(255, 205, 60);
			orb.bodyDef = {
				type: "dynamic",
				shapes: [new Sphere(0, 0, 0, ORB / 2)],
				density: 0.8,
				friction: 0.5,
			};
			// golden until it reaches the ground
			Object.assign(orb, {
				onCollisionStart: (_response: unknown, other: Renderable) => {
					if (other === ground) {
						knock(orb);
					}
				},
			});
			world.addChild(orb, spot.z);
			orbs.push(orb);
		}

		// ── the dotted arc the pet will fly along ────────────────────────
		const dots = Array.from({ length: 18 }, () => {
			const dot = new Mesh(0, 0, {
				model: "sphere",
				texture: white,
				width: 9,
				height: 9,
				castGroundShadow: false,
				transparent: true,
			});
			dot.alpha = 0;
			world.addChild(dot, 0);
			return dot;
		});
		const showArc = (from: Vector3d, v: Vector3d | null) => {
			dots.forEach((dot, i) => {
				if (v === null) {
					dot.alpha = 0;
					return;
				}
				// where it is after t seconds under gravity alone
				const t = (i + 1) * 0.05;
				dot.pos.set(from.x + v.x * t, from.y + v.y * t + 0.5 * GRAVITY * t * t);
				dot.depth = from.z + v.z * t;
				dot.alpha = 0.85 - i * 0.04;
			});
		};

		// ── the HUD ──────────────────────────────────────────────────────
		const hud = new Text(16, 16, {
			font: "sans-serif",
			size: 20,
			fillStyle: "#1d2a3a",
			text: "",
		});
		hud.floating = true;
		world.addChild(hud, 100);
		let shotsLeft = PETS.length;
		let over = false;
		const refresh = () => {
			const lines = [
				`orbs down ${orbsDown} / ${orbs.length}    pets left ${shotsLeft}`,
			];
			if (orbsDown === orbs.length) {
				over = true;
				lines.push("every orb is down! click to play again");
			} else if (over) {
				lines.push("out of pets: click to try again");
			} else {
				lines.push("press anywhere, drag back and let go");
			}
			hud.setText(lines);
		};

		// ── the pet in the pouch, and the one in flight ──────────────────
		let loaded: Mesh | null = null;
		let flying: Mesh | null = null;
		let flightTime = 0;
		let aiming = false;
		const pull = new Vector3d();
		// where the pull started, on the plane of the slingshot
		const grab = new Vector3d();
		const launchVelocity = new Vector3d();

		/** a pet's mesh, facing the towers, turned a little toward the camera */
		const petMesh = (name: string, x: number, y: number) => {
			const pet = new Mesh(x, y, {
				model: name,
				material: name,
				texture: "colormap",
				width: PET,
				height: PET,
				lit: true,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
			});
			pet.rotate((Math.PI * 2) / 3, AXIS_Y);
			return pet;
		};

		// the pets after the first wait in line on the deck, nearest first;
		// they are only drawn until their turn comes
		const waiting = PETS.slice(1).map((name, i) => {
			const pet = petMesh(
				name,
				POUCH.x - 70 - QUEUE_GAP * i,
				DECK_TOP - PET / 2,
			);
			// on the deck, whose top is not the ground their shadows fall on
			pet.castGroundShadow = false;
			world.addChild(pet, POUCH.z);
			return pet;
		});

		// the next pet into the pouch: the first straight there, the others
		// with a hop from the front of the line
		const load = () => {
			const name = PETS[PETS.length - shotsLeft];
			const queued = waiting.shift();
			const from = queued
				? { x: queued.pos.x, y: queued.pos.y }
				: { x: POUCH.x, y: POUCH.y };
			if (queued) {
				world.removeChildNow(queued);
			}
			const pet = petMesh(name, from.x, from.y);
			pet.bodyDef = {
				// still in the pouch: moved by hand until it is let go
				type: "static",
				// the model's own outline, as it is turned and scaled
				shapes: [ConvexHull3d.fromMesh(pet)],
				density: name === "animal-elephant" ? 6 : 2.5,
				friction: 0.6,
				restitution: 0.15,
			};
			world.addChild(pet, POUCH.z);
			const ready = () => {
				loaded = pet;
				for (const band of bands) {
					band.alpha = 1;
					stretch(band, { x: POUCH.x - PET / 2, y: POUCH.y });
				}
			};
			if (!queued) {
				ready();
				return;
			}
			const hop = { t: 0 };
			const spot = new Vector3d();
			new Tween(hop)
				.to({ t: 1 }, { duration: 450 })
				.onUpdate(() => {
					// one arc up out of the line and down into the pouch
					spot.set(
						from.x + (POUCH.x - from.x) * hop.t,
						from.y +
							(POUCH.y - from.y) * hop.t -
							Math.sin(hop.t * Math.PI) * 70,
						POUCH.z,
					);
					adapter.setPosition(pet, spot);
				})
				.onComplete(ready)
				.start();
		};

		// the point under the pointer on the plane of the slingshot (z = 0)
		const onPlane = (pointer: Pointer, out: Vector3d) => {
			const ray = camera.screenToRay(pointer.gameScreenX, pointer.gameScreenY);
			if (Math.abs(ray.direction.z) < 1e-6) {
				return null;
			}
			const t = (POUCH.z - ray.origin.z) / ray.direction.z;
			return out.set(
				ray.origin.x + ray.direction.x * t,
				ray.origin.y + ray.direction.y * t,
				POUCH.z,
			);
		};
		// a press anywhere takes hold of the loaded pet: a pet is a small
		// target under a finger, and a finger on it would hide it. The pull is
		// how far the pointer has moved since the press.
		input.registerPointerEvent("pointerdown", app.viewport, (pointer) => {
			if (loaded !== null && !over && onPlane(pointer, grab) !== null) {
				aiming = true;
				pull.set(0, 0, 0);
			}
		});
		const at = new Vector3d();
		const onMove = (pointer: Pointer) => {
			if (!aiming || loaded === null || onPlane(pointer, at) === null) {
				return;
			}
			pull.set(at.x - grab.x, at.y - grab.y, 0);
			const length = pull.length();
			if (length > MAX_PULL) {
				pull.scale(MAX_PULL / length);
			}
			const p = new Vector3d(POUCH.x + pull.x, POUCH.y + pull.y, POUCH.z);
			adapter.setPosition(loaded, p);
			for (const band of bands) {
				stretch(band, { x: p.x - PET / 2, y: p.y });
			}
			// released now, it would leave opposite the pull
			launchVelocity.set(-pull.x * POWER, -pull.y * POWER, 0);
			showArc(p, launchVelocity);
		};
		event.on(event.POINTERMOVE, onMove);

		const release = () => {
			if (over) {
				// the round is over: a click starts another, once this frame
				// is done with the world
				event.once(event.GAME_AFTER_UPDATE, restart);
				return;
			}
			if (!aiming || loaded === null) {
				return;
			}
			aiming = false;
			showArc(POUCH, null);
			const pet = loaded;
			if (pull.length() < 15) {
				// barely pulled: back into the pouch
				adapter.setPosition(pet, POUCH);
				return;
			}
			loaded = null;
			flying = pet;
			flightTime = 0;
			shotsLeft--;
			adapter.setStatic(pet, false);
			(pet.body as Rapier3dAdapter.Body).enableCcd(true);
			adapter.setVelocity(pet, launchVelocity);
			// a forward roll, and a little twist out of the plane
			adapter.setAngularVelocity(
				pet,
				new Vector3d(0, (Math.random() - 0.5) * 3, 6),
			);
			// the bands go slack, out of sight, until the next pet is in
			for (const band of bands) {
				band.alpha = 0;
			}
			refresh();
		};
		input.registerPointerEvent("pointerup", app.viewport, release);
		// a pull often ends past the edge of the canvas, where the game sees
		// no pointer event: the page still does, and lets the pet go
		const releaseOutside = () => {
			if (aiming) {
				release();
			}
		};
		globalThis.addEventListener("pointerup", releaseOutside);

		// ── follows the pet in flight, and loads the next one ────────────
		class Referee extends Renderable {
			constructor() {
				super(0, 0, 1, 1);
				this.alwaysUpdate = true;
			}

			override update(dt: number) {
				for (const orb of orbs) {
					// one that left the field counts as down too
					if (orb.pos.y > 400) {
						knock(orb);
					}
				}
				const pet = flying;
				if (pet === null) {
					return false;
				}
				flightTime += dt / 1000;
				const body = pet.body as Rapier3dAdapter.Body;
				const gone = pet.pos.y > 400 || Math.abs(pet.pos.x) > 1700;
				if (body.isSleeping() || gone || flightTime > SHOT_SECONDS) {
					flying = null;
					if (orbsDown === orbs.length) {
						return false;
					}
					if (shotsLeft > 0) {
						load();
					} else {
						over = true;
						refresh();
					}
				}
				return false;
			}
		}
		world.addChild(new Referee(), 0);

		load();
		refresh();

		// ── a side view of the field, from just above the deck ───────────
		camera.setClipPlanes(10, 10000);
		camera.setPosition(0, -240, -1120);
		camera.lookAt(0, -210, 0);

		addKenneyCredit(app, "#1d2a3a");

		return () => {
			event.off(event.POINTERMOVE, onMove);
			globalThis.removeEventListener("pointerup", releaseOutside);
			input.releasePointerEvent("pointerdown", app.viewport);
			input.releasePointerEvent("pointerup", app.viewport);
		};
	};

	class SlingshotStage extends Stage {
		#teardown: (() => void) | null = null;

		override onResetEvent(app: Application) {
			const build = () => {
				this.#teardown = buildScene(app, () => {
					// a new round: everything out of the world, bodies too
					this.#teardown?.();
					app.world.reset();
					build();
				});
			};
			build();
		}

		override onDestroyEvent() {
			this.#teardown?.();
			this.#teardown = null;
		}
	}

	await loader.preload([
		{ name: "sphere", type: "obj", src: `${MESH_BASE}sphere.obj` },
		{ name: "backdrop", type: "image", src: `${PETS_BASE}jungle_bg.png` },
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
	state.set(state.PLAY, new SlingshotStage());
	state.change(state.PLAY);
};

export const ExampleSlingshot = createExampleComponent(createGame);
