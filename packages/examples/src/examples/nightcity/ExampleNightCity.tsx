/**
 * melonJS — procedural night-city flythrough (emissive material showcase).
 *
 * A downtown generated entirely from raw mesh data (no asset file): dark
 * moonlit building shells plus thousands of individual emissive window panes.
 * Because each lit window is real geometry carrying a `Mesh.emissive` color,
 * windows glow individually at night — a few flicker — while the walls stay
 * dark. A looping camera flythrough sweeps over and around the skyline, and a
 * vignette post-effect frames it cinematically.
 *
 * Showcases the 19.8 `Mesh.emissive` material feature (self-illumination,
 * independent of scene lighting) together with `Camera3d`.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	Color,
	Light3d,
	Mesh,
	plugin,
	Renderable,
	VignetteEffect,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";
import { generateCity } from "./city";

// pixels per authored unit — scales the whole city up to screen size.
const SCALE = 18;

// authored (Y-up) → melonJS render space (Y-down, rightHanded): negate Y and Z,
// then ×SCALE. Applied inline in the camera path (kept allocation-free — no
// intermediate arrays per frame).

/** A night sky: gradient + stars + a soft moon, drawn screen-fixed. */
function bakeNightSky() {
	const c = document.createElement("canvas");
	c.width = 256;
	c.height = 256;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 256);
		g.addColorStop(0, "#04060f");
		g.addColorStop(0.65, "#0a1230");
		g.addColorStop(1, "#1d2c52"); // light-polluted horizon
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 256);
		// stars, denser toward the top
		for (let i = 0; i < 260; i++) {
			const y = Math.random() ** 1.8 * 256;
			const x = Math.random() * 256;
			ctx.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.6})`;
			ctx.fillRect(x, y, Math.random() < 0.12 ? 2 : 1, 1);
		}
		// soft moon
		const mg = ctx.createRadialGradient(198, 46, 4, 198, 46, 30);
		mg.addColorStop(0, "rgba(245,247,255,0.95)");
		mg.addColorStop(0.4, "rgba(210,222,255,0.45)");
		mg.addColorStop(1, "rgba(210,222,255,0)");
		ctx.fillStyle = mg;
		ctx.fillRect(168, 16, 60, 60);
	}
	return c;
}

class SkyBackdrop extends Renderable {
	private sky = bakeNightSky();

	constructor() {
		super(0, 0, 1, 1);
		this.floating = true; // screen-space — ignore the perspective camera
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		renderer.drawImage(
			this.sky,
			0,
			0,
			256,
			256,
			0,
			0,
			renderer.width,
			renderer.height,
		);
	}
}

const createGame = () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.WEBGL, // Mesh rendering requires WebGL
			scale: "auto",
			cameraClass: Camera3dClass,
			// Showcase the decoupled antiAlias / textureFilter combo:
			//  - antiAlias: true     → MSAA smooths the building silhouettes and
			//                          calms the shimmer of the hundreds of tiny
			//                          bright emissive window quads in motion.
			//  - textureFilter: "nearest" → textures stay crisp (independent of
			//                          MSAA). A combination a single `antiAlias`
			//                          boolean couldn't express. (The buildings are
			//                          untextured here, so this is mainly to model
			//                          the API; on a textured pixel-art scene it
			//                          keeps the texels sharp while MSAA still
			//                          smooths the polygon edges.)
			antiAlias: true,
			textureFilter: "nearest",
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example couldn't start: WebGL isn't available.\n\n" +
				"3D mesh rendering requires a WebGL-capable browser/GPU.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}

	plugin.register(DebugPanelPlugin, "debugPanel");

	let domCleanup: (() => void) | null = null;

	// ── build the city geometry → meshes ───────────────────────────────────
	// a big downtown (26×26 plots) — the merged meshes are drawn in full every
	// frame (no frustum culling), so this pushes a lot of geometry through the
	// batcher's chunked draw path: a light stress test you can watch on the
	// debug panel's FPS / draw-call counters.
	const city = generateCity(26, 7);
	const cityBox = (city.radius + 4) * 2 * SCALE; // generous bounds (no cull-to-point)

	const makeMesh = (
		geo: {
			vertices: number[];
			normals: number[];
			indices: number[];
			colors?: number[];
		},
		opts: { lit: boolean; tint?: Color; emissive?: [number, number, number] },
	) => {
		const m = new Mesh(0, 0, {
			vertices: new Float32Array(geo.vertices),
			normals: new Float32Array(geo.normals),
			uvs: new Float32Array((geo.vertices.length / 3) * 2), // white-pixel: UVs unused
			indices: Uint32Array.from(geo.indices),
			width: cityBox,
			height: cityBox,
			scale: SCALE,
			normalize: false,
			rightHanded: true,
			cullBackFaces: false,
			lit: opts.lit,
			emissive: opts.emissive,
		});
		if (opts.tint) {
			m.tint.copy(opts.tint);
		}
		// per-vertex colors (ground: asphalt vs road) — multiplied by tint
		if (geo.colors) {
			m.vertexColors = Uint32Array.from(geo.colors);
		}
		return m;
	};

	// ground plane + street grid (per-vertex colored), shaded by the moon
	app.world.addChild(makeMesh(city.ground, { lit: true }));
	// dark concrete shells, shaded by the moon (lit)
	app.world.addChild(
		makeMesh(city.walls, { lit: true, tint: new Color(34, 40, 58) }),
	);
	// lit windows: one emissive mesh per glow color. Near-black tint so the
	// (untextured) pane shows ONLY its emissive color — a glowing window.
	for (const grp of city.glow) {
		if (grp.indices.length === 0) {
			continue;
		}
		const m = makeMesh(grp, {
			lit: false,
			tint: new Color(0, 0, 0),
			emissive: grp.color,
		});
		app.world.addChild(m);
	}

	// ── lighting: a dim cool moon + low blue ambient so the shells read as
	// shadowed shapes while the emissive windows do the talking ─────────────
	app.world.addChild(
		new Light3d({
			type: "directional",
			direction: [0.5, 1, 0.3],
			color: "#9fb4ff",
			intensity: 0.22,
		}),
	);
	app.world.addChild(
		new Light3d({ type: "ambient", color: "#1a2444", intensity: 0.6 }),
	);

	// sky behind everything (Camera3d doesn't clear to backgroundColor)
	app.world.addChild(new SkyBackdrop(), -10000);

	// cinematic vignette (graceful no-op on Canvas)
	app.viewport.addPostEffect(new VignetteEffect(app.renderer as WebGLRenderer));

	// ── camera + looping flythrough ─────────────────────────────────────────
	const camera = app.viewport as InstanceType<typeof Camera3dClass>;
	camera.fov = (55 * Math.PI) / 180;
	camera.setClipPlanes(SCALE * 0.4, SCALE * 240);

	// the flythrough is a SEAMLESS loop: a breathing orbit whose radius and
	// height oscillate, so the camera swoops from a high establishing shot down
	// to a low pass skimming the skyline and back. Every term is a sin/cos of an
	// INTEGER multiple of the loop angle `a` (which wraps every PERIOD seconds),
	// so position and aim are continuous across the t: 1 → 0 wrap — no snap.
	const PERIOD = 26; // seconds per loop
	let paused = false;
	let t = 0.15; // start mid-swoop for a nice first frame

	// capture just the two scalars the camera path needs, so the (large) `city`
	// geometry object — including its source `number[]` arrays — can be GC'd
	// after setup instead of being pinned by the per-frame closure.
	const cityRadius = city.radius;
	const cityMaxH = city.maxHeight;

	const placeCamera = () => {
		const a = t * Math.PI * 2;
		// keep the orbit radius just OUTSIDE the city footprint (min ≈ 1.15·radius)
		// so the low passes skim the skyline edge instead of plunging through walls
		const r = cityRadius * (1.65 + 0.5 * Math.sin(a));
		const y = Math.max(
			cityMaxH * 0.55 + cityMaxH * 0.5 * Math.sin(a * 2 + 1.2),
			2.5,
		);
		// authored (Y-up) → render (Y-down): negate Y and Z, ×SCALE. Written
		// straight into pos/depth as scalars — zero allocations per frame. (x/y
		// via pos, z via `depth` — `pos.set` is typed 2-arg; `depth` is pos.z.)
		camera.pos.set(r * Math.cos(a) * SCALE, -y * SCALE);
		camera.depth = -r * Math.sin(a) * SCALE;
		// aim drifts gently around the center at mid-height; frequency 1 (not 0.5)
		// so the aim returns to its start as the loop wraps (seamless).
		camera.lookAt(
			cityRadius * 0.16 * Math.sin(a) * SCALE,
			-cityMaxH * 0.42 * SCALE,
			-cityRadius * 0.16 * Math.cos(a) * SCALE,
		);
	};
	placeCamera();

	// a tiny driver renderable: advances the looping flythrough each frame.
	// Draws nothing.
	class FlyDriver extends Renderable {
		constructor() {
			super(0, 0, 1, 1);
			this.alwaysUpdate = true;
		}
		override update(dt: number) {
			if (!paused) {
				t = (t + dt / 1000 / PERIOD) % 1;
				placeCamera();
			}
			return true;
		}
		override draw() {}
	}
	app.world.addChild(new FlyDriver());

	// ── on-screen controls ──────────────────────────────────────────────────
	const parent = app.renderer.getCanvas().parentElement;
	const btn = document.createElement("button");
	btn.textContent = "⏸ Pause flythrough";
	btn.style.cssText =
		"position:absolute;top:16px;left:16px;z-index:1000;padding:8px 14px;" +
		"background:#11131c;color:#cfe0ff;border:1px solid #38406a;border-radius:6px;" +
		"cursor:pointer;font-family:sans-serif;font-size:14px;font-weight:600;";
	btn.addEventListener("click", () => {
		paused = !paused;
		btn.textContent = paused ? "▶ Resume flythrough" : "⏸ Pause flythrough";
	});

	// concrete scene size for the perf story (20 verts/building, 4/window pane)
	const buildingCount = Math.round(city.walls.vertices.length / 3 / 20);
	const litWindowCount = city.glow.reduce(
		(n, g) => n + g.vertices.length / 3 / 4,
		0,
	);

	const hint = document.createElement("div");
	hint.textContent =
		`${buildingCount} buildings · ${litWindowCount.toLocaleString()} emissive ` +
		"windows · looping flythrough · press S for stats";
	hint.style.cssText =
		"position:absolute;top:58px;left:16px;color:#9fb6e8;" +
		"font-family:sans-serif;font-size:12px;z-index:1000;" +
		"text-shadow:0 1px 2px rgba(0,0,0,0.7);";

	if (parent) {
		parent.style.position = "relative";
		parent.appendChild(btn);
		parent.appendChild(hint);
	}
	domCleanup = () => {
		btn.remove();
		hint.remove();
	};

	return () => {
		if (domCleanup) {
			domCleanup();
		}
	};
};

export const ExampleNightCity = createExampleComponent(createGame);
