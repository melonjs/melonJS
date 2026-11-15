/**
 * melonJS — skinned glTF character with crossfaded animation.
 *
 * The Khronos "Fox" sample (see `packages/examples/LICENSE.md` for credits):
 * one mesh bound to a 24-joint skeleton through `JOINTS_0` / `WEIGHTS_0`,
 * the format Mixamo, Quaternius and most rigged character packs ship in.
 * `GLTFModel` deforms the skin from its joints every frame, and
 * `setCurrentAnimation(name, { crossfade })` blends from one clip to the next
 * instead of snapping between them.
 *
 * The fox trots around a circle, so the walk cycle visibly plays wherever the
 * model is placed and however it is turned. Its ground speed follows the clip
 * with a `Tween` over the same duration as the crossfade, so the feet and the
 * body change pace together.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	Camera3d,
	type CanvasRenderer,
	event,
	GLTFModel,
	input,
	Light3d,
	loader,
	Mesh,
	math,
	type Pointer,
	plugin,
	Renderable,
	Stage,
	state,
	Tween,
	UICheckbox,
	Vector3d,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/skinnedCharacter/`;

// the fox stands this many pixels tall, whatever units the asset uses
const FOX_HEIGHT = 220;
// render space is Y-DOWN: the floor is at y = 0 and up is negative
const GROUND_Y = 0;
// the circle the fox trots around
const TRACK_RADIUS = 520;
// floor extent and checker size, in pixels
const FLOOR_HALF = 1600;
const CHECK = 160;
// how long a clip change blends for, when crossfading is on
const CROSSFADE_MS = 350;

/**
 * Each clip's ground speed, in fox lengths per second, matched by eye to its
 * stride so the paws do not skate. Survey is the fox standing and looking
 * around.
 */
const CLIPS = [
	{ name: "Survey", speed: 0 },
	{ name: "Walk", speed: 0.55 },
	{ name: "Run", speed: 2.1 },
] as const;

/** A screen-fixed sky gradient behind the scene. */
class SkyBackdrop extends Renderable {
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
			g.addColorStop(0, "#f0a35e");
			g.addColorStop(0.55, "#f7d9a8");
			g.addColorStop(1, "#fff4e0");
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

/** a two-tone meadow check, tiled across the floor */
const bakeChecker = () => {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#7fa65a";
		ctx.fillRect(0, 0, 64, 64);
		ctx.fillStyle = "#6f9750";
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillRect(32, 32, 32, 32);
	}
	return c;
};

/** one lit quad lying on the floor, authored Y-UP like any mesh geometry */
const createFloor = () => {
	const h = FLOOR_HALF;
	const reps = (FLOOR_HALF * 2) / CHECK;
	return new Mesh(0, GROUND_Y, {
		vertices: new Float32Array([-h, 0, -h, h, 0, -h, h, 0, h, -h, 0, h]),
		uvs: new Float32Array([0, 0, reps, 0, reps, reps, 0, reps]),
		normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		texture: bakeChecker(),
		normalize: false,
		scale: 1,
		width: FLOOR_HALF * 2,
		height: FLOOR_HALF * 2,
		textureRepeat: "repeat",
		cullBackFaces: false,
		lit: true,
		// a floor does not cast a shadow onto itself
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
		});
		await app.init();
		// Camera3d needs a depth buffer, which the Canvas fallback lacks
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

	/**
	 * Build the scene into `app.world`.
	 * @returns the per-frame tick and the teardown for the pointer and keys
	 */
	const buildScene = (app: Application) => {
		const world = app.world;
		world.addChild(new SkyBackdrop(), -10000);
		world.addChild(createFloor(), 0);

		// a low warm sun (render space is Y-down, so travelling DOWN is +y)
		// and a sky fill, so the shadow side of the fox is not black
		const sun = new Light3d({
			type: "directional",
			direction: [-0.5, 0.75, 0.45],
			color: [1, 0.93, 0.82],
			intensity: 1,
		});
		world.addChild(sun);
		world.addChild(
			new Light3d({ type: "ambient", color: [0.75, 0.8, 1], intensity: 0.45 }),
		);

		// size the fox from the asset's own bounds, then build it as a game
		// object: the skin, the joints and the three clips come with it
		const data = loader.getGLTF("fox");
		if (!data) {
			throw new Error('Skinned character: "fox" did not preload.');
		}
		const { min, max } = data.bounds;
		const scale = FOX_HEIGHT / (max[1] - min[1]);
		const foxLength = (max[2] - min[2]) * scale;
		const fox = new GLTFModel(data, {
			scale,
			lit: true,
			castGroundShadow: true,
			shadowGroundY: GROUND_Y,
			shadowLight: sun,
		});
		world.addChild(fox, 0);

		// ── trotting around the track ───────────────────────────────────
		// `pace` is the ground speed in fox lengths per second. A tween moves
		// it over the crossfade, so the body speeds up as the legs do.
		const pace = { value: 0 };
		let heading = 0;
		let crossfade = true;
		let paceTween: Tween | null = null;
		const UP = new Vector3d(0, 1, 0);

		const play = (index: number) => {
			const clip = CLIPS[index];
			fox.setCurrentAnimation(
				clip.name,
				crossfade ? { crossfade: CROSSFADE_MS } : undefined,
			);
			paceTween?.stop();
			if (crossfade) {
				paceTween = new Tween(pace)
					.to({ value: clip.speed }, { duration: CROSSFADE_MS })
					.start();
			} else {
				pace.value = clip.speed;
			}
		};

		// move the fox along the circle at the current pace, turned to face
		// its way. `rotate` is relative, so it is fed this frame's turn only:
		// turning by exactly the heading's step keeps the fox on the tangent
		const tick = (dt: number) => {
			const step = ((pace.value * foxLength) / TRACK_RADIUS) * (dt / 1000);
			heading += step;
			fox.pos.set(Math.sin(heading) * TRACK_RADIUS, GROUND_Y - min[1] * scale);
			fox.depth = Math.cos(heading) * TRACK_RADIUS;
			fox.rotate(step, UP);
		};
		// stand the fox at the start of the track, facing along it: its nose
		// (glTF +Z) points down engine -Z, and the track starts heading +X
		fox.rotate(-Math.PI / 2, UP);
		play(1);

		// ── controls: one radio button per clip, and crossfade on/off ────
		const radios = CLIPS.map((clip, i) => {
			const radio = new UICheckbox(24, 24 + i * 34, {
				group: "clip",
				label: `${i + 1}  ${clip.name}`,
				checked: i === 1,
				font: "sans-serif",
				fontSize: 18,
				labelFillStyle: "#3a2a1a",
				onChange: (on) => {
					if (on) {
						play(i);
					}
				},
			});
			world.addChild(radio, 100);
			return radio;
		});
		const blend = new UICheckbox(24, 24 + CLIPS.length * 34 + 12, {
			label: `crossfade (${CROSSFADE_MS} ms)`,
			checked: true,
			font: "sans-serif",
			fontSize: 18,
			labelFillStyle: "#3a2a1a",
			onChange: (on) => {
				crossfade = on;
			},
		});
		world.addChild(blend, 100);

		// the number keys pick a clip too
		const DIGITS = [
			input.KEY.NUM1,
			input.KEY.NUM2,
			input.KEY.NUM3,
			input.KEY.NUM4,
			input.KEY.NUM5,
			input.KEY.NUM6,
			input.KEY.NUM7,
			input.KEY.NUM8,
			input.KEY.NUM9,
		].slice(0, CLIPS.length);
		DIGITS.forEach((key, i) => {
			input.bindKey(key, `clip${i}`, true);
		});
		const onKey = (action?: string) => {
			const i = CLIPS.findIndex((_, n) => action === `clip${n}`);
			if (i >= 0 && !radios[i].checked) {
				radios[i].checked = true;
				play(i);
			}
		};
		event.on(event.KEYDOWN, onKey);

		// ── camera: framed on the track, drag to orbit ───────────────────
		const camera = app.viewport as Camera3d;
		camera.setClipPlanes(10, 12000);
		let yaw = 0.35;
		let pitch = 0.42;
		const distance = TRACK_RADIUS * 3.1;
		const target = { x: 0, y: GROUND_Y - FOX_HEIGHT * 0.4, z: 0 };
		const updateCam = () => {
			pitch = math.clamp(pitch, 0.08, 1.3);
			camera.pos.set(
				target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
				target.y - Math.sin(pitch) * distance,
				target.z - Math.cos(yaw) * Math.cos(pitch) * distance,
			);
			camera.lookAt(target.x, target.y, target.z);
		};
		updateCam();

		let dragging = false;
		let lastX = 0;
		let lastY = 0;
		input.registerPointerEvent("pointerdown", camera, (ev: Pointer) => {
			dragging = true;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
		});
		input.registerPointerEvent("pointerup", camera, () => {
			dragging = false;
		});
		input.registerPointerEvent("pointermove", camera, (ev: Pointer) => {
			if (!dragging) {
				return;
			}
			yaw += (ev.gameScreenX - lastX) * 0.004;
			pitch += (ev.gameScreenY - lastY) * 0.004;
			lastX = ev.gameScreenX;
			lastY = ev.gameScreenY;
			updateCam();
		});
		const teardown = () => {
			input.releasePointerEvent("pointerdown", camera);
			input.releasePointerEvent("pointerup", camera);
			input.releasePointerEvent("pointermove", camera);
			event.off(event.KEYDOWN, onKey);
			for (const key of DIGITS) {
				input.unbindKey(key);
			}
		};
		return { tick, teardown };
	};

	/**
	 * The scene's own stage: `loader.preload()` leaves the app in the
	 * transitional loading state, and a stage of its own is what gives the
	 * pointer and key handlers an `onDestroyEvent` to be released in.
	 */
	class FoxStage extends Stage {
		#scene: ReturnType<typeof buildScene> | null = null;

		override onResetEvent(app: Application) {
			this.#scene = buildScene(app);
		}

		override update(dt: number) {
			this.#scene?.tick(dt);
			return super.update(dt);
		}

		override onDestroyEvent() {
			this.#scene?.teardown();
			this.#scene = null;
		}
	}

	await loader.preload([{ name: "fox", type: "glb", src: `${base}fox.glb` }]);
	state.set(state.PLAY, new FoxStage());
	state.change(state.PLAY);
};

export const ExampleSkinnedCharacter = createExampleComponent(createGame);
