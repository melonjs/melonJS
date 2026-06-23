/**
 * melonJS — Sprite3d billboard showcase.
 * The SAME frame-animated character is shown three times side by side, one per
 * billboard mode, under a Camera3d that continuously orbits, pitches and dollies
 * — so the difference is obvious in motion:
 *  - FIXED      → a flat quad; goes edge-on as the camera orbits.
 *  - UPRIGHT    → cylindrical: turns to face the camera but stays vertical.
 *  - FACE       → spherical: always fully faces the camera.
 * A spherical name tag floats above each so its mode always reads. The character
 * uses the shared cityscene atlas (CC0, also used by the TexturePacker example),
 * whose walk frames are rotated AND trimmed — so this also shows Sprite3d
 * mapping rotated/trimmed atlas regions onto the quad.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d as Camera3dClass,
	type CanvasRenderer,
	loader,
	Mesh,
	plugin,
	Renderable,
	Sprite3d,
	TextureAtlas,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// the cityscene atlas (shared with the TexturePacker example) — its capguy/walk
// frames are packer-rotated AND trimmed, so the animated character also exercises
// Sprite3d's rotated/trimmed atlas-region mapping
const ATLAS_BASE = `${import.meta.env.BASE_URL}assets/texturePacker/img/`;
const WALK_FRAMES = [
	"capguy/walk/0001",
	"capguy/walk/0002",
	"capguy/walk/0003",
	"capguy/walk/0004",
	"capguy/walk/0005",
	"capguy/walk/0006",
	"capguy/walk/0007",
	"capguy/walk/0008",
];

// a small label "tag" texture (rounded dark pill + accent border + title) shown
// floating above each character to name its billboard mode
function bakeLabel(title: string, accent: string) {
	const w = 256;
	const h = 72;
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (ctx) {
		const r = 16;
		ctx.beginPath();
		ctx.moveTo(r, 2);
		ctx.arcTo(w - 2, 2, w - 2, h - 2, r);
		ctx.arcTo(w - 2, h - 2, 2, h - 2, r);
		ctx.arcTo(2, h - 2, 2, 2, r);
		ctx.arcTo(2, 2, w - 2, 2, r);
		ctx.closePath();
		ctx.fillStyle = "#12141d";
		ctx.fill();
		ctx.lineWidth = 6;
		ctx.strokeStyle = accent;
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 38px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(title, w / 2, h / 2 + 2);
	}
	return c;
}

// a power-of-two grid texture for the floor (so REPEAT tiling reads the motion)
function bakeGrid() {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#161a24";
		ctx.fillRect(0, 0, 64, 64);
		ctx.strokeStyle = "#2c3550";
		ctx.lineWidth = 2;
		ctx.strokeRect(0, 0, 64, 64);
	}
	return c;
}

function bakeSky() {
	const c = document.createElement("canvas");
	c.width = 1;
	c.height = 256;
	const ctx = c.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, 256);
		g.addColorStop(0, "#10131f");
		g.addColorStop(1, "#27314a");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 1, 256);
	}
	return c;
}

class SkyBackdrop extends Renderable {
	private sky = bakeSky();
	constructor() {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
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

const createGame = () => {
	let app: Application;
	try {
		app = new Application(1024, 768, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "auto",
			cameraClass: Camera3dClass,
			antiAlias: true,
		});
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		globalThis.alert(
			"This example needs WebGL.\n\n" +
				"Sprite3d / Camera3d rendering requires a WebGL-capable browser/GPU.\n\n" +
				`Details: ${reason}`,
		);
		throw err;
	}
	plugin.register(DebugPanelPlugin, "debugPanel");

	let domCleanup: (() => void) | null = null;

	app.world.addChild(new SkyBackdrop(), -10000);

	// ── floor grid (a horizontal quad, for spatial reference) ───────────────
	const G = 600; // floor half-size
	const T = 12; // grid tiles across
	const floor = new Mesh(0, 0, {
		// quad in the XZ plane (y = 0)
		vertices: new Float32Array([-G, 0, -G, G, 0, -G, G, 0, G, -G, 0, G]),
		uvs: new Float32Array([0, 0, T, 0, T, T, 0, T]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
		texture: bakeGrid(),
		width: G * 2 * Math.SQRT2,
		height: G * 2 * Math.SQRT2,
		scale: 1,
		normalize: false,
		rightHanded: true,
		textureRepeat: "repeat",
		cullBackFaces: false,
	});
	floor.pos.set(0, 0);
	floor.depth = 0;
	app.world.addChild(floor);

	// ── the SAME animated character, shown in all three billboard modes ──────
	// side by side, with a name tag floating above each — so the difference is
	// obvious: as the camera orbits, FIXED goes edge-on while UPRIGHT/FACE keep
	// turning toward you. The character is loaded from a packed atlas whose walk
	// frames are rotated + trimmed (also exercising that mapping). `preload`'s
	// third arg is `false` so it does NOT switch to the built-in loading state
	// (this example builds its scene manually rather than through a Stage).
	const GY = -112; // character center (feet near the floor, render space Y-down)
	const modes: Array<
		[number, boolean | "cylindrical" | "spherical", string, string]
	> = [
		[-280, false, "FIXED", "#c061d6"],
		[0, "cylindrical", "UPRIGHT", "#5fd0ff"],
		[280, "spherical", "FACE", "#8fe060"],
	];
	loader.preload(
		[
			{ name: "cityscene", type: "json", src: `${ATLAS_BASE}cityscene.json` },
			{ name: "cityscene", type: "image", src: `${ATLAS_BASE}cityscene.png` },
		],
		() => {
			const atlas = new TextureAtlas(
				loader.getJSON("cityscene"),
				loader.getImage("cityscene"),
			);
			for (const [x, mode, label, accent] of modes) {
				// the character — same art + animation, one per billboard mode
				const guy = new Sprite3d(x, GY, {
					...atlas.getAnimationSettings(WALK_FRAMES),
					width: 130,
					height: 225,
					z: 0,
					billboard: mode,
				});
				guy.addAnimation("walk", WALK_FRAMES, 90);
				guy.setCurrentAnimation("walk");
				app.world.addChild(guy);

				// a name tag above the head — spherical so it always reads, whatever
				// the camera is doing
				const tag = new Sprite3d(x, GY - 150, {
					image: bakeLabel(label, accent),
					width: 150,
					height: 42,
					z: 0,
					billboard: "spherical",
				});
				app.world.addChild(tag);
			}
		},
		false,
	);

	// ── auto-orbiting / pitching / dollying camera ──────────────────────────
	const camera = app.viewport as InstanceType<typeof Camera3dClass>;
	camera.fov = (55 * Math.PI) / 180;
	camera.setClipPlanes(8, 6000);
	const TARGET = { x: 0, y: GY * 0.6, z: 0 };

	let t = 0;
	let paused = false;
	const place = () => {
		const yaw = t * 0.55; // continuous orbit
		// elevation sweep — kept positive so the camera always stays above the
		// floor plane (y = 0) and never clips below it
		const pitch = 0.35 + 0.3 * Math.sin(t * 0.5);
		const dist = 620 + 220 * Math.sin(t * 0.37); // dolly in/out
		// render space: up = -Y
		camera.pos.set(
			TARGET.x + Math.sin(yaw) * Math.cos(pitch) * dist,
			TARGET.y - Math.sin(pitch) * dist,
			TARGET.z + Math.cos(yaw) * Math.cos(pitch) * dist,
		);
		camera.lookAt(TARGET.x, TARGET.y, TARGET.z);
	};
	place();

	class FlyDriver extends Renderable {
		constructor() {
			super(0, 0, 1, 1);
			this.alwaysUpdate = true;
		}
		override update(dt: number) {
			if (!paused) {
				t += dt / 1000;
				place();
			}
			return true;
		}
		override draw() {}
	}
	app.world.addChild(new FlyDriver());

	// ── on-screen controls ──────────────────────────────────────────────────
	const parent = app.renderer.getCanvas().parentElement;
	const btn = document.createElement("button");
	btn.textContent = "⏸ Pause";
	btn.style.cssText =
		"position:absolute;top:16px;left:16px;z-index:1000;padding:8px 14px;" +
		"background:#11131c;color:#cfe0ff;border:1px solid #38406a;border-radius:6px;" +
		"cursor:pointer;font-family:sans-serif;font-size:14px;font-weight:600;";
	btn.addEventListener("click", () => {
		paused = !paused;
		btn.textContent = paused ? "▶ Resume" : "⏸ Pause";
	});
	const hint = document.createElement("div");
	hint.textContent =
		"Same animated character in three Sprite3d billboard modes — FIXED (flat, goes edge-on) · UPRIGHT (cylindrical) · FACE (spherical). Tags always face you. Camera auto-orbits / pitches / zooms.";
	hint.style.cssText =
		"position:absolute;top:58px;left:16px;right:16px;color:#9fb6e8;" +
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

export const ExampleBillboard = createExampleComponent(createGame);
