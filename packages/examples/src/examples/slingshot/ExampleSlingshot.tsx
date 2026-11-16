/**
 * melonJS — a slingshot game on 3D physics.
 *
 * Pull a pet back in the slingshot and let go: it flies along the dotted arc
 * and crashes into towers of wood and stone, which topple and tumble in three
 * dimensions. Knock out every rival perched on the towers, with a hard hit or
 * a fall to the ground, using the pets you have; pets left over score a bonus.
 *
 * What it shows:
 *
 * - **Everything through the preloader.** Rapier's WebAssembly is an asset
 *   type of its own (`loader.setParser`), loaded behind the loading screen
 *   with the models and the textures, which are painted in code and handed
 *   to the loader as images; the world then switches to Rapier with
 *   `world.setAdapter()`.
 * - **`@melonjs/rapier3d-adapter`**, with a `Camera3d`. Every block, pet and rival is a `Mesh` with a `bodyDef`; the
 *   adapter writes each body's position and turn back onto its mesh.
 * - **The 3D shapes.** Blocks are `Box3d`, and each pet and rival the
 *   `ConvexHull3d` of its own model, built with `ConvexHull3d.fromMesh()`, so
 *   it tumbles as the shape it is drawn.
 * - **The `Vector3d` adapter API.** The pet waits in the pouch as a static
 *   body, moved with `setPosition` while it is pulled (from a press anywhere,
 *   which a phone needs: a pet is a small target under a finger); letting go makes it
 *   dynamic (`setStatic(false)`) and launches it with `setVelocity` and
 *   `setAngularVelocity`, with Rapier's continuous collision on so a fast pet
 *   cannot pass through a thin plank.
 * - **Collision hooks**: a rival's `onCollisionStart` tells when it lands on
 *   the ground or is struck hard, from the speed of the two bodies
 *   (`getVelocity3d`).
 * - **The UI widgets**: the end-of-round card is a `UIPanel` with a
 *   `UITextButton`, and the score pops come up with a `Tween`.
 * - **A camera that orbits the field**: the turn buttons, the arrow keys and
 *   the VIEW button (side on, or behind the slingshot) turn a `Camera3d`, and
 *   the aim follows it, so a shot from behind can go anywhere in 3D. The
 *   slingshot's bands are turned in 3D with a `Quaternion`.
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
	Quaternion,
	Renderable,
	Stage,
	state,
	Text,
	Tween,
	UIPanel,
	UITextButton,
	Vector2d,
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
// the rivals perched on the towers, and how big they are
const RIVALS = [
	"animal-fox",
	"animal-crab",
	"animal-monkey",
	"animal-lion",
	"animal-tiger",
];
const RIVAL = 56;
// a rival struck at this speed or more (pixels per second, the two bodies'
// speed relative to each other) is knocked out
const KNOCKOUT_SPEED = 260;
const RIVAL_POINTS = 5000;
const SPARE_PET_POINTS = 10000;
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
// the camera orbits this point, the middle of the field, at this distance
const PIVOT = new Vector3d(100, -210, 0);
const ORBIT_DISTANCE = 1150;
// a press of a turn button turns the camera this far; a held arrow key, this
// fast (radians per second)
const ORBIT_STEP = Math.PI / 6;
const ORBIT_SPEED = 1.6;

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
const createBox = (w: number, h: number, d: number, texture: string) => {
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

// whether the loader has been taught the "rapier3d" asset type yet
let rapierParserSet = false;

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

	// the painted textures, by the names they are preloaded under
	const wood = "wood" as const;
	const stone = "stone" as const;
	const grass = "grass" as const;
	const white = "white" as const;

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

		// ── the backdrop all round, and the ground running out to meet it
		const BACK_Z = 1700;
		const SIDE_X = 3000;
		// one wall per side, so the camera finds trees whichever way it turns;
		// tall enough that a wall's top edge stays above the view, and placed
		// so the picture's horizon, 55% of the way down it, meets the ground
		const WALL_H = 4200;
		for (const [x, z, width, turn] of [
			[0, BACK_Z, SIDE_X * 2, 0],
			[0, -BACK_Z, SIDE_X * 2, 0],
			[-SIDE_X, 0, BACK_Z * 2, Math.PI / 2],
			[SIDE_X, 0, BACK_Z * 2, Math.PI / 2],
		]) {
			const wall = createBackdrop(width, WALL_H);
			wall.pos.set(x, WALL_H * (0.5 - 0.55));
			if (turn !== 0) {
				wall.rotate(turn, AXIS_Y);
			}
			world.addChild(wall, z);
		}

		// a thick static slab, its top at y = 0
		const ground = createBox(SIDE_X * 2, 40, BACK_Z * 2, grass);
		ground.pos.set(0, GROUND_Y + 20);
		ground.castGroundShadow = false;
		ground.bodyDef = {
			type: "static",
			shapes: [new Box3d(0, 0, 0, SIDE_X * 2, 40, BACK_Z * 2)],
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
		const turn = new Quaternion();
		const turnAxis = new Vector3d();
		// a band from its prong's tip to `to`, in 3D: a unit box along X,
		// turned onto the band and stretched to its length
		const stretch = (band: Mesh, to: { x: number; y: number; z: number }) => {
			const dx = to.x - POUCH.x;
			const dy = to.y - tipY;
			const dz = to.z - band.depth;
			const length = Math.max(Math.hypot(dx, dy, dz), 1);
			band.pos.set(POUCH.x + dx / 2, tipY + dy / 2);
			// the mesh turns in its model's Y-up space: Y the other way
			const ux = dx / length;
			const uy = -dy / length;
			const uz = dz / length;
			// the turn that takes +X onto the band: about X × u
			turnAxis.set(0, -uz, uy);
			if (turnAxis.length() < 1e-6) {
				turn.setFromAxisAngle(AXIS_Y, ux < 0 ? Math.PI : 0);
			} else {
				turn.setFromAxisAngle(turnAxis.normalize(), Math.acos(ux));
			}
			band.currentTransform.identity();
			turn.toMatrix3d(band.currentTransform);
			band.currentTransform.scale(length, 1, 1);
		};
		// where the bands hold the pet: just behind it, away from the shot
		const pouchBack = (at: Vector3d, pulled: Vector3d) => {
			const length = pulled.length();
			const back =
				length > 1e-6
					? { x: pulled.x / length, y: pulled.y / length, z: pulled.z / length }
					: { x: -1, y: 0, z: 0 };
			return {
				x: at.x + (back.x * PET) / 2,
				y: at.y + (back.y * PET) / 2,
				z: at.z + (back.z * PET) / 2,
			};
		};

		// ── the towers ───────────────────────────────────────────────────
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
				{ x, y: -152 - RIVAL / 2, z },
				{ x, y: -274 - RIVAL / 2, z },
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
			return [{ x, y: -202 - RIVAL / 2, z }];
		};

		// ── the rivals: Kenney animals perched on the towers ────────────
		const rivals = new Set<Mesh>();
		let score = 0;
		const popPoints = (at: Mesh, points: number) => {
			const screen = camera.worldToScreen(
				new Vector3d(at.pos.x, at.pos.y - RIVAL, at.depth),
				new Vector2d(),
			);
			if (screen === null) {
				return;
			}
			const label = new Text(screen.x, screen.y, {
				font: "sans-serif",
				size: 30,
				fillStyle: "#ffffff",
				strokeStyle: "#1d2a3a",
				lineWidth: 5,
				textAlign: "center",
				text: `+${points}`,
			});
			label.floating = true;
			world.addChild(label, 2);
			const rise = { y: screen.y, a: 1 };
			new Tween(rise)
				.to({ y: screen.y - 70, a: 0 }, { duration: 900 })
				.onUpdate(() => {
					label.pos.y = rise.y;
					label.alpha = rise.a;
				})
				.onComplete(() => {
					world.removeChild(label);
				})
				.start();
		};
		const knockOut = (rival: Mesh) => {
			if (!rivals.delete(rival)) {
				return;
			}
			score += RIVAL_POINTS;
			popPoints(rival, RIVAL_POINTS);
			camera.shake(6, 250);
			// a flash, then it fades away and leaves the field
			rival.tint.setColor(255, 120, 120);
			const fade = { a: 1 };
			new Tween(fade)
				.to({ a: 0 }, { duration: 450, delay: 150 })
				.onUpdate(() => {
					rival.alpha = fade.a;
				})
				.onComplete(() => {
					world.removeChild(rival);
				})
				.start();
			refresh();
		};
		const speedBetween = (a: Renderable, b: Renderable) => {
			const va = adapter.getVelocity3d(a);
			const vb = adapter.getVelocity3d(b);
			return Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z);
		};
		const spots = [...tower(180, 10), ...gate(470, -15), ...tower(720, 20)];
		spots.forEach((spot, i) => {
			const name = RIVALS[i % RIVALS.length];
			const rival = new Mesh(spot.x, spot.y, {
				model: name,
				material: name,
				texture: "colormap",
				width: RIVAL,
				height: RIVAL,
				lit: true,
				castGroundShadow: true,
				shadowGroundY: GROUND_Y,
			});
			// facing the slingshot, turned a little toward the camera
			rival.rotate((Math.PI * 4) / 3, AXIS_Y);
			rival.bodyDef = {
				type: "dynamic",
				shapes: [ConvexHull3d.fromMesh(rival)],
				density: 1,
				friction: 0.6,
			};
			// out once it lands on the ground, or is struck hard
			Object.assign(rival, {
				onCollisionStart: (_response: unknown, other: Renderable) => {
					if (
						other === ground ||
						speedBetween(rival, other) >= KNOCKOUT_SPEED
					) {
						knockOut(rival);
					}
				},
			});
			world.addChild(rival, spot.z);
			rivals.add(rival);
		});
		const rivalCount = rivals.size;

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

		// ── the HUD: the score, the rivals left, and a first-shot hint ────
		const hudStyle = {
			font: "sans-serif",
			size: 30,
			fillStyle: "#ffffff",
			strokeStyle: "#1d2a3a",
			lineWidth: 5,
		};
		const scoreText = new Text(20, 16, { ...hudStyle, text: "" });
		scoreText.floating = true;
		world.addChild(scoreText, 3);
		const rivalsText = new Text(app.viewport.width - 20, 16, {
			...hudStyle,
			textAlign: "right",
			text: "",
		});
		rivalsText.floating = true;
		world.addChild(rivalsText, 3);
		const hint = new Text(app.viewport.width / 2, app.viewport.height - 70, {
			...hudStyle,
			size: 22,
			lineWidth: 4,
			textAlign: "center",
			text: "press anywhere, drag back and let go",
		});
		hint.floating = true;
		world.addChild(hint, 3);

		let shotsLeft = PETS.length;
		let over = false;
		const refresh = () => {
			scoreText.setText(`SCORE ${score}`);
			rivalsText.setText(`RIVALS ${rivals.size} / ${rivalCount}`);
		};

		// the end-of-round card: the result, the stars, and a button to go again
		const endRound = (cleared: boolean) => {
			if (over) {
				return;
			}
			over = true;
			hint.alpha = 0;
			// every pet not launched is a bonus, once the towers are cleared
			const spare = cleared ? shotsLeft : 0;
			const bonus = spare * SPARE_PET_POINTS;
			score += bonus;
			refresh();
			const best =
				rivalCount * RIVAL_POINTS + (PETS.length - 1) * SPARE_PET_POINTS;
			const stars = !cleared
				? 0
				: score >= best * 0.7
					? 3
					: score >= best * 0.5
						? 2
						: 1;
			const w = 420;
			const h = 300;
			const card = new UIPanel(
				(app.viewport.width - w) / 2,
				(app.viewport.height - h) / 2,
				{
					width: w,
					height: h,
					fillColor: "#1d3b57",
					borderColor: "#f6c445",
					borderWidth: 4,
					radius: 22,
					shadowColor: "rgba(0, 0, 0, 0.35)",
					shadowOffsetY: 8,
					shadowBlur: 16,
					blocking: true,
				},
			);
			const line = (
				y: number,
				text: string,
				size: number,
				fill = "#ffffff",
			) => {
				card.addChild(
					new Text(w / 2, y, {
						font: "sans-serif",
						size,
						fillStyle: fill,
						strokeStyle: "#10243a",
						lineWidth: size > 30 ? 6 : 0,
						textAlign: "center",
						text,
					}),
				);
			};
			line(26, cleared ? "TOWERS CLEARED!" : "OUT OF PETS", 38);
			line(
				84,
				"\u2605".repeat(stars) + "\u2606".repeat(3 - stars),
				56,
				"#f6c445",
			);
			line(160, `score ${score}`, 26);
			line(
				194,
				bonus > 0
					? `${spare} spare pet${spare > 1 ? "s" : ""}: +${bonus}`
					: " ",
				18,
				"#bcd3e6",
			);
			card.addChild(
				new UITextButton(w / 2 - 110, 228, {
					width: 220,
					height: 52,
					font: "sans-serif",
					fontSize: 24,
					text: "PLAY AGAIN",
					labelFillStyle: "#ffffff",
					hoverOffColor: "#e8892c",
					hoverOnColor: "#f6a23f",
					pressedColor: "#c86e1c",
					borderColor: "#7a3f0c",
					hoverScale: 1.05,
					pressScale: 0.95,
					// a new round, once this frame is done with the world
					onClick: () => {
						event.once(event.GAME_AFTER_UPDATE, restart);
					},
				}),
			);
			world.addChild(card, 0);
		};

		// ── the pet in the pouch, and the one in flight ──────────────────
		let loaded: Mesh | null = null;
		let flying: Mesh | null = null;
		let flightTime = 0;
		let aiming = false;
		const pull = new Vector3d();
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
					// at rest: no pull, so held from just behind
					stretch(band, pouchBack(POUCH, new Vector3d()));
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

		// ── the camera: it orbits the field; `yaw` 0 is the side view, a
		// quarter turn is from behind the slingshot ──────────────────────
		let yaw = 0;
		let targetYaw = 0;
		// the camera's forward and right, along the ground
		const forward = new Vector3d();
		const right = new Vector3d();
		const placeCamera = () => {
			forward.set(Math.sin(yaw), 0, Math.cos(yaw));
			right.set(Math.cos(yaw), 0, -Math.sin(yaw));
			// further back and higher behind the slingshot, to see over the
			// pets waiting in line
			const behind = Math.abs(Math.sin(yaw));
			const height = 30 + 260 * behind;
			const distance = ORBIT_DISTANCE + 380 * behind;
			camera.setPosition(
				PIVOT.x - forward.x * distance,
				PIVOT.y - height,
				PIVOT.z - forward.z * distance,
			);
			camera.lookAt(PIVOT.x, PIVOT.y, PIVOT.z);
		};

		// a press anywhere takes hold of the loaded pet: a pet is a small
		// target under a finger, and a finger on it would hide it. The pull
		// follows the pointer from there, relative to the camera: sideways on
		// screen is sideways to the view, and down on screen is down from the
		// side, back toward the camera from behind.
		const pressed = { x: 0, y: 0 };
		// world pixels per screen pixel, at the pouch, for this press
		let perPixel = 1;
		const onButtons = (pointer: Pointer) => {
			return buttons.some((b) => {
				return b.getBounds().contains(pointer.gameScreenX, pointer.gameScreenY);
			});
		};
		input.registerPointerEvent("pointerdown", app.viewport, (pointer) => {
			if (loaded === null || over || onButtons(pointer)) {
				return;
			}
			const a = camera.worldToScreen(POUCH, new Vector2d());
			const b = camera.worldToScreen(
				new Vector3d(POUCH.x + right.x * 100, POUCH.y, POUCH.z + right.z * 100),
				new Vector2d(),
			);
			perPixel =
				a && b ? 100 / Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1) : 1;
			pressed.x = pointer.gameScreenX;
			pressed.y = pointer.gameScreenY;
			aiming = true;
			pull.set(0, 0, 0);
		});
		const onMove = (pointer: Pointer) => {
			if (!aiming || loaded === null) {
				return;
			}
			const dx = (pointer.gameScreenX - pressed.x) * perPixel;
			const dy = (pointer.gameScreenY - pressed.y) * perPixel;
			// 0 from the side, 1 from behind
			const behind = Math.abs(Math.sin(yaw));
			pull.set(
				right.x * dx - forward.x * dy * behind,
				dy * (1 - behind),
				right.z * dx - forward.z * dy * behind,
			);
			const length = pull.length();
			if (length > MAX_PULL) {
				pull.scale(MAX_PULL / length);
			}
			const p = new Vector3d(
				POUCH.x + pull.x,
				POUCH.y + pull.y,
				POUCH.z + pull.z,
			);
			adapter.setPosition(loaded, p);
			const held = pouchBack(p, pull);
			for (const band of bands) {
				stretch(band, held);
			}
			// released now, it would leave opposite the pull; from behind, a
			// pull straight back is lofted upward too
			launchVelocity.set(
				-pull.x * POWER,
				-pull.y * POWER - behind * pull.length() * POWER * 0.45,
				-pull.z * POWER,
			);
			showArc(p, launchVelocity);
		};
		event.on(event.POINTERMOVE, onMove);

		// ── the turn buttons, and the arrow keys ─────────────────────────
		const buttonStyle = {
			width: 60,
			height: 60,
			font: "sans-serif",
			fontSize: 26,
			labelFillStyle: "#ffffff",
			hoverOffColor: "#1d3b57cc",
			hoverOnColor: "#2c5a82",
			pressedColor: "#16324a",
			borderColor: "#f6c445",
			hoverScale: 1.06,
			pressScale: 0.94,
		};
		const bottom = app.viewport.height - 80;
		const buttons = [
			new UITextButton(20, bottom, {
				...buttonStyle,
				text: "\u25C0",
				onClick: () => {
					targetYaw += ORBIT_STEP;
				},
			}),
			new UITextButton(90, bottom, {
				...buttonStyle,
				text: "\u25B6",
				onClick: () => {
					targetYaw -= ORBIT_STEP;
				},
			}),
			new UITextButton(160, bottom, {
				...buttonStyle,
				width: 96,
				fontSize: 20,
				text: "VIEW",
				// between the side view and the view from behind the slingshot
				onClick: () => {
					const behindNow = Math.abs(Math.sin(targetYaw)) > 0.5;
					targetYaw = behindNow ? 0 : Math.PI / 2;
				},
			}),
		];
		for (const button of buttons) {
			world.addChild(button, 1);
		}
		input.bindKey(input.KEY.LEFT, "turnLeft");
		input.bindKey(input.KEY.A, "turnLeft");
		input.bindKey(input.KEY.RIGHT, "turnRight");
		input.bindKey(input.KEY.D, "turnRight");

		const release = () => {
			if (over || !aiming || loaded === null) {
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
			// a forward roll about the axis across the shot, and a little twist
			const across = Math.hypot(launchVelocity.x, launchVelocity.z) || 1;
			adapter.setAngularVelocity(
				pet,
				new Vector3d(
					(-launchVelocity.z / across) * 6,
					(Math.random() - 0.5) * 3,
					(launchVelocity.x / across) * 6,
				),
			);
			// the bands go slack, out of sight, until the next pet is in
			for (const band of bands) {
				band.alpha = 0;
			}
			hint.alpha = 0;
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
				// the camera: arrow keys turn it, and it eases to where it is
				// asked to be
				if (input.isKeyPressed("turnLeft")) {
					targetYaw += (ORBIT_SPEED * dt) / 1000;
				}
				if (input.isKeyPressed("turnRight")) {
					targetYaw -= (ORBIT_SPEED * dt) / 1000;
				}
				if (Math.abs(targetYaw - yaw) > 1e-4) {
					yaw += (targetYaw - yaw) * (1 - Math.exp(-dt / 120));
					placeCamera();
				}
				for (const rival of rivals) {
					// one that left the field is out too
					if (rival.pos.y > 400) {
						knockOut(rival);
					}
				}
				if (!over && rivals.size === 0) {
					endRound(true);
				}
				const pet = flying;
				if (pet === null) {
					return false;
				}
				flightTime += dt / 1000;
				const body = pet.body as Rapier3dAdapter.Body;
				const gone =
					pet.pos.y > 400 ||
					Math.abs(pet.pos.x) > SIDE_X ||
					Math.abs(pet.depth) > BACK_Z;
				if (body.isSleeping() || gone || flightTime > SHOT_SECONDS) {
					flying = null;
					if (over) {
						return false;
					}
					if (shotsLeft > 0) {
						load();
					} else {
						endRound(false);
					}
				}
				return false;
			}
		}
		world.addChild(new Referee(), 0);

		load();
		refresh();

		// ── it opens on the side view ────────────────────────────────────
		camera.setClipPlanes(10, 10000);
		placeCamera();

		addKenneyCredit(app, "#1d2a3a");

		return () => {
			event.off(event.POINTERMOVE, onMove);
			globalThis.removeEventListener("pointerup", releaseOutside);
			input.releasePointerEvent("pointerdown", app.viewport);
			input.releasePointerEvent("pointerup", app.viewport);
			for (const key of [
				input.KEY.LEFT,
				input.KEY.A,
				input.KEY.RIGHT,
				input.KEY.D,
			]) {
				input.unbindKey(key);
			}
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

	// Rapier's WebAssembly as an asset type of its own, so that it downloads
	// and compiles behind the loading screen with everything else. Taught to
	// the loader once: the example can be started again in the same page.
	if (!rapierParserSet) {
		rapierParserSet = true;
		loader.setParser("rapier3d", (_asset, onload, onerror) => {
			Rapier3dAdapter.load().then(() => {
				onload();
			}, onerror);
			return 1;
		});
	}

	await loader.preload([
		{ name: "rapier3d", type: "rapier3d", src: "" },
		// the textures painted in code go through the loader as images too,
		// and the meshes ask for them by name
		...([wood, stone, grass, white] as const).map((name) => {
			return { name, type: "image", src: paint(name).toDataURL() };
		}),
		{ name: "sphere", type: "obj", src: `${MESH_BASE}sphere.obj` },
		{ name: "backdrop", type: "image", src: `${PETS_BASE}jungle_bg.png` },
		{
			name: "colormap",
			type: "image",
			src: `${PETS_BASE}Textures/colormap.png`,
		},
		...[...PETS, ...RIVALS].flatMap((name) => {
			return [
				{ name, type: "obj", src: `${PETS_BASE}${name}.obj` },
				{ name, type: "mtl", src: `${PETS_BASE}${name}.mtl` },
			];
		}),
		KENNEY_LOGO,
	]);
	// Rapier is compiled now: the world moves onto it before the first round
	app.world.setAdapter(
		new Rapier3dAdapter({
			gravity: { x: 0, y: GRAVITY, z: 0 },
			pixelsPerMeter: 50,
		}),
	);
	state.set(state.PLAY, new SlingshotStage());
	state.change(state.PLAY);
};

export const ExampleSlingshot = createExampleComponent(createGame);
