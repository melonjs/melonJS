/**
 * melonJS — What an MTL can carry: three props, three material features.
 *
 * All three are plain OBJ + MTL pairs under a `Camera3d` with one directional
 * `Light3d` and an ambient fill. Nothing is wired by hand — every material
 * property below comes out of the `.mtl`.
 *
 * - **Crate** — three materials, three different `map_Kd` maps (wood boards,
 *   steel plate, a shipping label). The `Mesh` reduces them to the shortest
 *   list of index ranges that need a different texture and the GPU backends
 *   draw one range each, so this costs three draws rather than one per
 *   material (#1573).
 * - **Ball** — `Ks` + `Ns`, a specular highlight on the lit mesh path, which
 *   was previously half-Lambert diffuse plus an ambient floor and read as
 *   chalk whatever the material said (#1575). Its normals are *generated*:
 *   the sphere ships without `vn`, and the parser accumulates them
 *   angle-weighted per source position, which is what makes it smooth rather
 *   than faceted (#1572).
 * - **Panel** — `map_d`, per-texel opacity. `alphaCutoff` on its own can only
 *   threshold uniformly across a material; the map cuts to the shape of the
 *   perforations (#1575).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	Light3d,
	loader,
	Mesh,
	plugin,
	Renderable,
	state,
	Vector3d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

// ─── layout & content ─────────────────────────────────────────────

const CANVAS_W = 1024;
const CANVAS_H = 768;
const ASSET_BASE = `${import.meta.env.BASE_URL}assets/materialTextures/`;
const MESH_BASE = `${import.meta.env.BASE_URL}assets/mesh3d/`;

// the three props, left to right along X at a common depth
const PROP_Y = 0;
const PROP_Z = 520;
const SPACING = 210;

const AXIS_Y = new Vector3d(0, 1, 0);

// ─── entry point ──────────────────────────────────────────────────

const createGame = async () => {
	// Lit meshes need a GPU backend AND a Camera3d: world normals are only
	// written on the 3D path, so a lit mesh under a Camera2d degrades to
	// unlit (melonJS/melonJS#1576) and there would be no highlight to see.
	let app: Application;
	try {
		app = new Application(CANVAS_W, CANVAS_H, {
			parent: "screen",
			renderer: video.AUTO,
			scale: "auto",
			cameraClass: Camera3d,
			// smooth magnification (these maps are stretched across a face
			// several times their own size) plus MSAA on the silhouettes —
			// the cut-out panel in particular has a lot of edge to alias
			antiAlias: true,
		});
		await app.init();
		if (!app.renderer.supportsDepthBuffer) {
			throw new Error("no GPU backend available (Canvas fallback)");
		}
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: no GPU rendering is available in this browser.\n\n" +
				"Lit meshes and per-material textures need a WebGPU- or WebGL-capable " +
				"browser/GPU. Try enabling hardware acceleration in your browser " +
				"settings, or open this example in a different browser.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	app.world.backgroundColor.parseCSS("#0e1117");
	plugin.register(DebugPanelPlugin, "debugPanel");

	// only the models and their .mtl are listed: the MTL loader fetches every
	// map_Kd AND map_d it references, relative to the .mtl
	loader.preload(
		[
			{ name: "crate", type: "obj", src: `${ASSET_BASE}crate.obj` },
			{ name: "crate", type: "mtl", src: `${ASSET_BASE}crate.mtl` },
			{ name: "panel", type: "obj", src: `${ASSET_BASE}panel.obj` },
			{ name: "props", type: "mtl", src: `${ASSET_BASE}props.mtl` },
			// the sphere is shared with the mesh3d example; it carries no `vn`,
			// so its normals are generated at parse
			{ name: "ball", type: "obj", src: `${MESH_BASE}sphere.obj` },
		],
		() => {
			// preload transitions to the loading screen, which pins itself to a
			// Camera2d — come back to the default stage so the app's Camera3d
			// becomes the active viewport again
			state.change(state.DEFAULT, true);
			buildScene(app);
			spawnCaption(app);
		},
	);
};

// ─── the scene ────────────────────────────────────────────────────

function buildScene(app: Application) {
	const world = app.world;

	// One directional key light plus a dim ambient fill. The key is what the
	// specular highlight rides: a highlight needs a direction to reflect, so
	// an ambient-only scene would show none however glossy the material.
	const key = new Light3d(0, 0, {
		type: "directional",
		direction: new Vector3d(-0.45, -0.75, 0.5),
		color: "#fff6e8",
		intensity: 1.15,
	});
	key.name = "key";
	world.addChild(key);
	world.addChild(new Light3d(0, 0, { type: "ambient", color: "#3b4870" }));

	const props: Mesh[] = [];

	// ── crate: three diffuse maps, one per material ──────────────
	const crate = new Mesh(-SPACING, PROP_Y, {
		model: "crate",
		material: "crate",
		width: 150,
		lit: true,
	});
	crate.depth = PROP_Z;
	props.push(crate);

	// ── ball: Ks + Ns, and generated normals ─────────────────────
	const ball = new Mesh(0, PROP_Y, {
		model: "ball",
		// no `usemtl` in sphere.obj, so the first MTL entry wins — `chrome`
		material: "props",
		width: 170,
		lit: true,
	});
	ball.depth = PROP_Z;
	props.push(ball);

	// ── panel: per-texel cutout ──────────────────────────────────
	const panel = new Mesh(SPACING, PROP_Y, {
		model: "panel",
		material: "props",
		width: 150,
		lit: true,
		// `map_d` scales alpha; this is the threshold it is scaled against.
		// Without a cutoff there is nothing to discard and the map does
		// nothing — the two are a pair.
		alphaCutoff: 0.5,
		cullBackFaces: false,
	});
	panel.depth = PROP_Z;
	props.push(panel);

	for (const prop of props) {
		world.addChild(prop);
		// depth is assigned before addChild above; Container.autoDepth would
		// overwrite it otherwise
		prop.depth = PROP_Z;
	}

	// slow turn so the highlight sweeps across the ball and every face of the
	// crate comes round — a static shot would hide both
	world.addChild(new Spinner(props));

	// looking slightly down, so the crate's steel lid is in view alongside
	// its wooden sides — the split is the point, and a level shot hides half
	const camera = app.viewport as Camera3d;
	camera.pos.set(0, -170, 0);
	camera.lookAt(0, 10, PROP_Z);
}

/**
 * Turns the props. A Renderable that draws nothing — the meshes are children
 * of the world in their own right, so this only advances them.
 */
class Spinner extends Renderable {
	props: Mesh[];

	constructor(props: Mesh[]) {
		super(0, 0, 1, 1);
		this.props = props;
		this.alwaysUpdate = true;
	}

	override update(dt: number): boolean {
		for (const prop of this.props) {
			prop.rotate(dt * 0.0004, AXIS_Y);
		}
		return true;
	}
}

// ─── caption ──────────────────────────────────────────────────────

function spawnCaption(app: Application) {
	const parent = app.renderer.getCanvas().parentElement;
	if (!parent) {
		return;
	}
	parent.style.position = "relative";

	const el = document.createElement("div");
	el.innerHTML =
		'<div style="font-size:16px;font-weight:bold">everything below comes out of the .mtl</div>' +
		'<div style="font-size:12px;opacity:0.75;margin-top:6px">' +
		"map_Kd per material · Ks + Ns specular · map_d per-texel cutout" +
		"</div>";
	el.style.cssText =
		"position:absolute;color:#e6e9ef;font-family:'Courier New',monospace;" +
		"text-align:center;text-shadow:0 0 5px #000;z-index:1000;pointer-events:none;" +
		"transform:translate(-50%,-50%);left:50%;top:11%;";
	parent.appendChild(el);
}

export const ExampleMaterialTextures = createExampleComponent(createGame);
