/**
 * melonJS — an isometric tactics board, in real 3D.
 *
 * Kenney's Platformer Kit blocks and props and a Blocky Characters hero
 * (all CC0), on an 8 × 8 board seen through an orthographic `Camera3d`: the
 * isometric look, with none of the 2D isometric tile bookkeeping. Depth,
 * lighting, shadows and picking all come from the 3D scene.
 *
 * - **The board is one `InstancedMesh`** of grass blocks, stacked where the
 *   ground is raised. A pointer event on it says which INSTANCE the ray hit
 *   (`pointer.hit3d.instance`), which is the tile under the pointer: hover to
 *   highlight it, click to send the hero there.
 * - **The hero is a `GLTFModel`** that walks the path
 *   `@melonjs/pathfinding-plugin` finds: A* on a `Grid` of the board's tiles,
 *   round the trees, rocks and crates, with raised ground costing more to
 *   climb onto. It crossfades between its idle and walk clips and turns to
 *   face each step; toon bands and an outline make it read at any zoom.
 * - **The camera** is orthographic, a true isometric angle; Q / E (or the
 *   buttons) turn the view a quarter at a time, the wheel zooms by changing
 *   `orthoHeight`, and the checkbox switches to perspective for comparison.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Grid } from "@melonjs/pathfinding-plugin";
import {
	Application,
	Camera3d,
	type CanvasRenderer,
	Color,
	event,
	GLTFModel,
	InstancedMesh,
	input,
	Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	type Pointer,
	plugin,
	Renderable,
	Stage,
	state,
	Text,
	Tween,
	UICheckbox,
	UITextButton,
	Vector2d,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { addKenneyCredit, KENNEY_LOGO } from "../kenneyCredit";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/gltf/`;

// pixels per glTF unit
const SCALE = 40;
// the board: N × N tiles, each a 2 × 2-unit Kenney grass block
const N = 8;
const PITCH = 2;
// ground height per tile, in blocks: rows run toward the back of the board
const HEIGHTS = [
	"00000000",
	"00000110",
	"00100110",
	"00100000",
	"00000000",
	"01100000",
	"01100001",
	"00000011",
];
// props, by tile; `block` ones cannot be walked through
const PROPS: Record<string, { piece: string; block: boolean }> = {
	"1,1": { piece: "tree-pine", block: true },
	"2,2": { piece: "tree-pine-small", block: true },
	"6,0": { piece: "tree-pine", block: true },
	"5,1": { piece: "rocks", block: true },
	"3,5": { piece: "rocks", block: true },
	"5,3": { piece: "crate", block: true },
	"4,3": { piece: "barrel", block: true },
	"0,6": { piece: "tree-pine-small", block: true },
	"6,6": { piece: "flowers-tall", block: false },
	"1,4": { piece: "flowers", block: false },
	"7,7": { piece: "flag", block: false },
	"4,6": { piece: "mushrooms", block: false },
};
const START = { x: 0, z: 0 };
// the classic isometric angles: a quarter turn of 45°, looking down by
// atan(1/√2) ≈ 35.26°, so the three axes come out equally foreshortened
const ISO_PITCH = Math.atan(1 / Math.SQRT2);
const DISTANCE = 1600;
const STEP_MS = 260;
const INK = "#1d2433";
const UP = new Vector3d(0, 1, 0);

const height = (x: number, z: number) => {
	return Number(HEIGHTS[z][x]);
};

/**
 * The render-space centre of a tile's TOP face. glTF is Y-up and the scene is
 * bridged right-handed, so glTF y becomes -y and glTF z becomes -z.
 */
const tileTop = (x: number, z: number) => {
	return {
		x: (x - (N - 1) / 2) * PITCH * SCALE,
		y: -(height(x, z) + 1) * SCALE,
		z: -(z - (N - 1) / 2) * PITCH * SCALE,
	};
};

/**
 * The board as a pathfinding grid: one cell per tile, the cell's `x` its
 * column and `y` its row (the board's z). The props that block are solid,
 * and stepping onto raised ground costs more, so the hero takes the flat way
 * round when there is one. Diagonals are off (the plugin's default): a
 * tactics unit moves along the grid.
 */
const grid = new Grid({
	cols: N,
	rows: N,
	tileWidth: 1,
	tileHeight: 1,
	solid: (col, row) => {
		return PROPS[`${col},${row}`]?.block === true;
	},
	weight: (col, row) => {
		return 1 + height(col, row);
	},
});
const _from = new Vector2d();
const _to = new Vector2d();

/** the tiles to step through to reach `to`, or null when it cannot be reached */
const findPath = (
	from: { x: number; z: number },
	to: { x: number; z: number },
) => {
	const cells = grid.getIdPath(_from.set(from.x, from.z), _to.set(to.x, to.z));
	if (cells.length === 0) {
		return null;
	}
	// the path starts where the hero stands
	return cells.slice(1).map((cell) => {
		return { x: cell.x, z: cell.y };
	});
};

/** a soft sky behind the board, in screen space */
class Sky extends Renderable {
	private sky: HTMLCanvasElement;

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
		this.sky = document.createElement("canvas");
		this.sky.width = 1;
		this.sky.height = 256;
		const ctx = this.sky.getContext("2d");
		if (ctx) {
			const g = ctx.createLinearGradient(0, 0, 0, 256);
			g.addColorStop(0, "#8fd3ff");
			g.addColorStop(1, "#e9f7ff");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 1, 256);
		}
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.drawImage(
			this.sky,
			0,
			0,
			1,
			256,
			0,
			0,
			renderer.width,
			renderer.height,
		);
	}
}

const createGame = async () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			antiAlias: true,
			cameraClass: Camera3d,
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
		world.addChild(new Sky(), -10000);
		world.addChild(
			new Light3d({
				type: "directional",
				direction: [0.35, 0.8, 0.5],
				color: [1, 0.97, 0.9],
			}),
		);
		world.addChild(
			new Light3d({
				type: "ambient",
				color: [0.7, 0.75, 0.95],
				intensity: 0.55,
			}),
		);

		// ── the Kenney pieces, read out of the platformer diorama ─────────
		const kit = loader.getGLTF("diorama");
		const hero = loader.getGLTF("character");
		if (!kit || !hero) {
			throw new Error("Isometric: the Kenney assets did not preload.");
		}
		const piece = (name: string) => {
			const node = kit.nodes.find((n) => {
				return n.name === name || n.name?.startsWith(`${name}.`);
			});
			if (node === undefined) {
				throw new Error(`Isometric: no "${name}" in the kit.`);
			}
			return {
				vertices: node.vertices,
				uvs: node.uvs,
				normals: node.normals,
				indices: node.indices,
				texture: node.image ?? undefined,
				textureRepeat: node.textureRepeat,
				baseColorFactor: node.baseColorFactor,
				normalize: false,
				scale: SCALE,
				rightHanded: true,
				lit: true,
			};
		};

		// ── the board: every block one instance of one mesh ──────────────
		const instanceTile: number[] = [];
		const topInstance: number[] = [];
		for (let z = 0; z < N; z++) {
			for (let x = 0; x < N; x++) {
				for (let level = 0; level <= height(x, z); level++) {
					instanceTile.push(z * N + x);
				}
				topInstance[z * N + x] = instanceTile.length - 1;
			}
		}
		const board = new InstancedMesh(0, 0, {
			...piece("block-grass-large"),
			width: N * PITCH * SCALE,
			height: N * PITCH * SCALE,
			instanceCount: instanceTile.length,
			instanceColors: true,
			castGroundShadow: false,
		});
		const at = new Matrix3d();
		instanceTile.forEach((tile, i) => {
			const x = tile % N;
			const z = Math.floor(tile / N);
			const below = topInstance[tile] - i;
			at.identity().translate(
				(x - (N - 1) / 2) * PITCH,
				height(x, z) - below,
				(z - (N - 1) / 2) * PITCH,
			);
			board.setInstance(i, at);
		});
		board.isKinematic = false; // listen to the pointer
		world.addChild(board, 0);

		// ── props, toon-shaded and inked to match the hero ────────────────
		for (const [k, prop] of Object.entries(PROPS)) {
			const [x, z] = k.split(",").map(Number);
			const top = tileTop(x, z);
			const mesh = new Mesh(top.x, top.y, {
				...piece(prop.piece),
				toonBands: 3,
				outlineWidth: 1.5,
				outlineColor: INK,
				castGroundShadow: true,
				shadowGroundY: top.y,
			});
			mesh.depth = top.z;
			mesh.rotate(((x * 7 + z * 3) % 4) * (Math.PI / 2), UP);
			world.addChild(mesh, top.z);
		}

		// ── the hero ──────────────────────────────────────────────────────
		const heroScale = (1.5 * SCALE) / (hero.bounds.max[1] - hero.bounds.min[1]);
		const unit = new GLTFModel(hero, {
			scale: heroScale,
			lit: true,
			toonBands: 3,
			outlineWidth: 1.5,
			outlineColor: INK,
			castGroundShadow: true,
		});
		const place = { ...START };
		const placeAt = (p: { x: number; y: number; z: number }) => {
			unit.pos.set(p.x, p.y);
			unit.depth = p.z;
			for (const part of unit.getChildren()) {
				if (part instanceof Mesh) {
					part.shadowGroundY = p.y;
				}
			}
		};
		placeAt(tileTop(START.x, START.z));
		world.addChild(unit, 0);
		unit.setCurrentAnimation("idle");
		// the model faces glTF +Z, which the bridge turns into engine -Z
		let facing = 0;
		const face = (dx: number, dz: number) => {
			const target = Math.atan2(-dx, dz);
			let turn = target - facing;
			turn = Math.atan2(Math.sin(turn), Math.cos(turn));
			unit.rotate(turn, UP);
			facing = target;
		};

		// walk the path a tile at a time; a new click re-plans from the
		// next tile instead of cutting a corner
		let path: { x: number; z: number }[] = [];
		let walking = false;
		const step = () => {
			const next = path.shift();
			if (next === undefined) {
				walking = false;
				unit.setCurrentAnimation("idle", { crossfade: 200 });
				return;
			}
			face(next.x - place.x, next.z - place.z);
			const from = tileTop(place.x, place.z);
			const to = tileTop(next.x, next.z);
			const pos = { ...from };
			new Tween(pos)
				.to(to, { duration: STEP_MS })
				.onUpdate(() => {
					placeAt(pos);
				})
				.onComplete(() => {
					place.x = next.x;
					place.z = next.z;
					step();
				})
				.start();
		};
		const walkTo = (x: number, z: number) => {
			const found = findPath(place, { x, z });
			if (found === null || found.length === 0) {
				return;
			}
			path = found;
			if (!walking) {
				walking = true;
				unit.setCurrentAnimation("walk", { crossfade: 150 });
				step();
			}
		};

		// ── the pointer: the ray's instance is the tile ───────────────────
		const readout = new Text(20, 20, {
			font: "sans-serif",
			size: 18,
			fillStyle: INK,
			text: "click a tile to walk there · Q / E turn · wheel zoom",
		});
		readout.floating = true;
		world.addChild(readout, 100);

		const white = new Color(255, 255, 255);
		const reachable = new Color(255, 236, 140);
		const unreachable = new Color(255, 190, 185);
		let hovered = -1;
		const hover = (tile: number) => {
			if (tile === hovered) {
				return;
			}
			if (hovered >= 0) {
				board.setInstanceColor(topInstance[hovered], white);
			}
			hovered = tile;
			if (tile >= 0) {
				const x = tile % N;
				const z = Math.floor(tile / N);
				const ok =
					(x === place.x && z === place.z) ||
					findPath(place, { x, z }) !== null;
				board.setInstanceColor(topInstance[tile], ok ? reachable : unreachable);
				readout.setText(
					`tile ${x}, ${z} · height ${height(x, z)}${ok ? "" : " · blocked"}`,
				);
			}
		};
		input.registerPointerEvent("pointermove", board, (pointer: Pointer) => {
			if (pointer.hit3d !== null) {
				hover(instanceTile[pointer.hit3d.instance]);
			}
		});
		input.registerPointerEvent("pointerleave", board, () => {
			hover(-1);
		});
		input.registerPointerEvent("pointerdown", board, (pointer: Pointer) => {
			if (pointer.hit3d !== null) {
				const tile = instanceTile[pointer.hit3d.instance];
				walkTo(tile % N, Math.floor(tile / N));
			}
			return false;
		});

		// ── the camera ────────────────────────────────────────────────────
		const camera = app.viewport as Camera3d;
		camera.setClipPlanes(50, 5000);
		camera.projection = "orthographic";
		camera.orthoHeight = 860;
		camera.fov = 2 * Math.atan(camera.orthoHeight / 2 / DISTANCE);
		const view = { yaw: Math.PI / 4 };
		const aim = () => {
			camera.setPosition(
				-Math.sin(view.yaw) * Math.cos(ISO_PITCH) * DISTANCE,
				-Math.sin(ISO_PITCH) * DISTANCE - SCALE,
				-Math.cos(view.yaw) * Math.cos(ISO_PITCH) * DISTANCE,
			);
			camera.lookAt(0, -SCALE, 0);
		};
		aim();
		let turning: Tween | null = null;
		const turn = (quarter: number) => {
			turning?.stop();
			// round to the nearest quarter so repeated presses stay aligned
			const target =
				Math.round((view.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) +
				Math.PI / 4 +
				quarter * (Math.PI / 2);
			turning = new Tween(view)
				.to({ yaw: target }, { duration: 350 })
				.easing(Tween.Easing.Quadratic.Out)
				.onUpdate(aim)
				.start();
		};
		input.registerPointerEvent("wheel", camera, (ev: Pointer) => {
			const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
			camera.orthoHeight = math.clamp(camera.orthoHeight * factor, 300, 1600);
			camera.fov = 2 * Math.atan(camera.orthoHeight / 2 / DISTANCE);
		});
		// Q and E turn the board; locked, so holding a key turns it once
		input.bindKey(input.KEY.Q, "turnLeft", true);
		input.bindKey(input.KEY.E, "turnRight", true);
		const onKey = (action?: string) => {
			if (action === "turnLeft") {
				turn(-1);
			} else if (action === "turnRight") {
				turn(1);
			}
		};
		event.on(event.KEYDOWN, onKey);

		// ── controls ──────────────────────────────────────────────────────
		const button = (x: number, text: string, onClick: () => void) => {
			world.addChild(
				new UITextButton(x, 56, {
					font: "sans-serif",
					size: 16,
					text,
					width: 110,
					height: 32,
					labelFillStyle: INK,
					hoverOffColor: "#ffffff",
					hoverOnColor: "#ffe48a",
					borderColor: INK,
					onClick,
				}),
				100,
			);
		};
		button(20, "◀ turn (Q)", () => {
			turn(-1);
		});
		button(140, "turn (E) ▶", () => {
			turn(1);
		});
		world.addChild(
			new UICheckbox(270, 60, {
				label: "orthographic",
				checked: true,
				font: "sans-serif",
				fontSize: 18,
				labelFillStyle: INK,
				onChange: (on) => {
					camera.projection = on ? "orthographic" : "perspective";
				},
			}),
			100,
		);

		addKenneyCredit(app, INK);

		return () => {
			input.releasePointerEvent("wheel", camera);
			event.off(event.KEYDOWN, onKey);
			input.unbindKey(input.KEY.Q);
			input.unbindKey(input.KEY.E);
		};
	};

	class TacticsStage extends Stage {
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
		{ name: "diorama", type: "glb", src: `${base}platformer-diorama.glb` },
		{ name: "character", type: "glb", src: `${base}character.glb` },
		KENNEY_LOGO,
	]);
	state.set(state.PLAY, new TacticsStage());
	state.change(state.PLAY);
};

export const ExampleIsometric3d = createExampleComponent(createGame);
