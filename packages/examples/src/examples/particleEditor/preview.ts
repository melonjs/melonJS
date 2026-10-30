/**
 * melonJS — particle editor: the live preview.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	Camera2d,
	Camera3d,
	type CanvasRenderer,
	Mesh,
	math,
	ParticleEmitter,
	Renderable,
	Stage,
	state,
	video,
	type WebGLRenderer,
} from "melonjs";
import { type CameraKind, type EditorState, emitterSettings } from "./state";

type Renderer = CanvasRenderer | WebGLRenderer;

const STATE_2D = state.USER;
const STATE_3D = state.USER + 1;

/** length of the angle handle */
const ARM = 90;
/**
 * How far below the emitter the 3D floor lies. A mesh is authored Y-up and
 * the scene is drawn Y-down, hence the minus on its vertices.
 */
const FLOOR_Y = 320;
const FOV = math.degToRad(50);
/** particles are flat sprites facing the screen: stop before edge-on */
const MAX_YAW = math.degToRad(75);
/** never under the floor */
const MIN_PITCH = math.degToRad(-6);
const MAX_PITCH = math.degToRad(60);
const START_YAW = 0.5;
const START_PITCH = 0.22;

/** the 3D camera looks at the emitter's resting place */
const ORIGIN = { x: 0, y: 0, z: 0 };

/** 2D grid spacing, in pixels */
const GRID = 40;
/** where the 2D floor starts, as a share of the preview's height */
const FLOOR_2D = 0.9;

const BACKGROUNDS = { dark: "#15151d", light: "#e9e9ef" };

export interface PreviewEvents {
	/** the angle handle was dragged (degrees) */
	angle(degrees: number): void;
	/** the emitter was dragged (share of the preview, from its center) */
	offset(x: number, y: number): void;
	/** the emitter rejected the settings; undefined once it accepts them */
	error(message: string | undefined): void;
}

/** an emitter that can be frozen on a frame */
class PreviewEmitter extends ParticleEmitter {
	paused = false;

	override update(dt: number): boolean {
		return this.paused ? true : super.update(dt);
	}
}

const checker = (() => {
	let tile: HTMLCanvasElement | undefined;
	return () => {
		if (!tile) {
			tile = document.createElement("canvas");
			tile.width = 256;
			tile.height = 256;
			const ctx = tile.getContext("2d");
			if (ctx) {
				for (let y = 0; y < 8; y++) {
					for (let x = 0; x < 8; x++) {
						ctx.fillStyle = (x + y) % 2 === 0 ? "#3a3a44" : "#5a5a66";
						ctx.fillRect(x * 32, y * 32, 32, 32);
					}
				}
			}
		}
		return tile;
	};
})();

const gridTexture = () => {
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const ctx = c.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#1c1d28";
		ctx.fillRect(0, 0, 64, 64);
		ctx.strokeStyle = "#343850";
		ctx.lineWidth = 2;
		ctx.strokeRect(0, 0, 64, 64);
	}
	return c;
};

const floorMesh = () => {
	const size = 1600;
	const tiles = 20;
	const y = -FLOOR_Y;
	return new Mesh(0, 0, {
		vertices: new Float32Array([
			-size,
			y,
			-size,
			size,
			y,
			-size,
			size,
			y,
			size,
			-size,
			y,
			size,
		]),
		uvs: new Float32Array([0, 0, tiles, 0, tiles, tiles, 0, tiles]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
		texture: gridTexture(),
		width: size * 2 * Math.SQRT2,
		height: size * 2 * Math.SQRT2,
		scale: 1,
		normalize: false,
		rightHanded: true,
		textureRepeat: "repeat",
		cullBackFaces: false,
	});
};

/** background color or checkerboard, and the 2D grid */
class Backdrop extends Renderable {
	constructor(private readonly preview: Preview) {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: Renderer) {
		const background = this.preview.state.background;
		const w = renderer.width;
		const h = renderer.height;
		if (background === "checker") {
			const tile = checker();
			for (let y = 0; y < h; y += tile.height) {
				for (let x = 0; x < w; x += tile.width) {
					renderer.drawImage(
						tile,
						0,
						0,
						tile.width,
						tile.height,
						x,
						y,
						tile.width,
						tile.height,
					);
				}
			}
		} else {
			renderer.setColor(BACKGROUNDS[background]);
			renderer.fillRect(0, 0, w, h);
		}
		if (this.preview.state.grid && this.preview.flat) {
			this.drawGrid(renderer, w, h, background === "light");
		}
	}

	/** graph paper, with a floor along the bottom colored like the 3D one */
	private drawGrid(renderer: Renderer, w: number, h: number, light: boolean) {
		const floor = Math.round(h * FLOOR_2D);
		renderer.setColor(light ? "#30303a" : "#ffffff");
		renderer.setGlobalAlpha(light ? 0.1 : 0.07);
		renderer.lineWidth = 1;
		for (let x = GRID; x < w; x += GRID) {
			renderer.strokeLine(x, 0, x, floor);
		}
		for (let y = floor - GRID; y > 0; y -= GRID) {
			renderer.strokeLine(0, y, w, y);
		}
		renderer.setGlobalAlpha(1);
		renderer.setColor(light ? "#c9cad6" : "#1c1d28");
		renderer.fillRect(0, floor, w, h - floor);
		renderer.setColor(light ? "#9a9cb0" : "#343850");
		for (let x = GRID; x < w; x += GRID) {
			renderer.strokeLine(x, floor, x, h);
		}
		renderer.lineWidth = 2;
		renderer.strokeLine(0, floor, w, floor);
		renderer.lineWidth = 1;
	}
}

/** 2D only: the spawn area outline and the angle handle */
class Handles extends Renderable {
	constructor(private readonly preview: Preview) {
		super(0, 0, 1, 1);
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: Renderer) {
		const { x, y } = this.preview.center;
		const effect = this.preview.state.effect;
		const ink = this.preview.state.background === "light" ? "#30303a" : "#fff";
		const active = "#ffd166";
		renderer.setBlendMode("normal");

		renderer.setGlobalAlpha(0.35);
		renderer.setColor(ink);
		renderer.lineWidth = 1;
		renderer.strokeRect(
			x - effect.width / 2,
			y - effect.height / 2,
			Math.max(effect.width, 1),
			Math.max(effect.height, 1),
		);

		const angle = math.degToRad(effect.angle);
		const spread = math.degToRad(effect.angleVariation);
		if (spread > 0 && effect.maxSpread === 0) {
			renderer.setGlobalAlpha(0.25);
			for (const side of [-1, 1]) {
				const s = angle + side * Math.min(spread, Math.PI);
				renderer.strokeLine(
					x,
					y,
					x + Math.cos(s) * ARM * 0.8,
					y - Math.sin(s) * ARM * 0.8,
				);
			}
		}

		const tip = this.preview.tip;
		renderer.setGlobalAlpha(0.8);
		renderer.lineWidth = 2;
		renderer.setColor(this.preview.dragging === "angle" ? active : ink);
		renderer.strokeLine(x, y, tip.x, tip.y);
		renderer.fillEllipse(tip.x, tip.y, 7, 7);
		renderer.setColor(this.preview.dragging === "move" ? active : ink);
		renderer.strokeEllipse(x, y, 6, 6);
		renderer.setGlobalAlpha(1);
		renderer.lineWidth = 1;
	}
}

class PreviewStage extends Stage {
	constructor(
		private readonly preview: Preview,
		private readonly kind: CameraKind,
	) {
		super({ cameraClass: kind === "3d" ? Camera3d : Camera2d });
	}

	override onResetEvent(app: Application) {
		this.preview.build(app, this.kind);
	}

	override onDestroyEvent() {
		this.preview.leave();
	}

	override update(dt: number) {
		this.preview.tick(dt);
		super.update(dt);
		// the backdrop and handles follow the editor, not the world: redraw
		return true;
	}
}

/** one emitter in a 2D or 3D scene, following the editor's state */
export class Preview {
	readonly app: Application;
	readonly supports3d: boolean;
	readonly rendererName: string;
	state: EditorState;
	image: HTMLCanvasElement | HTMLImageElement | undefined;
	dragging: "angle" | "move" | "orbit" | undefined;
	/** where the emitter is drawn, and the end of the angle handle (2D) */
	readonly center = { x: 0, y: 0 };
	readonly tip = { x: 0, y: 0 };
	private emitter: PreviewEmitter | undefined;
	/** the stage that is built; undefined while switching */
	private kind: CameraKind | undefined;
	/** the stage asked for last */
	private target: CameraKind = "2d";
	/** made once, and taken out of the world before a stage switch */
	private floor: Mesh | undefined;
	private camera3d: Camera3d | undefined;
	private paused = false;
	private time = 0;
	/** ms since the effect ended, to play it again */
	private idle = 0;
	private yaw = START_YAW;
	private pitch = START_PITCH;
	private zoom = 1;
	private readonly pointers = new Map<number, { x: number; y: number }>();
	private pinch = 0;
	/** where the pointer took hold of the emitter, from its offset */
	private grab = { x: 0, y: 0 };

	constructor(
		app: Application,
		initial: EditorState,
		image: HTMLCanvasElement | HTMLImageElement | undefined,
		private readonly events: PreviewEvents,
	) {
		this.app = app;
		this.state = initial;
		this.image = image;
		this.supports3d = app.renderer.supportsDepthBuffer;
		this.rendererName = app.renderer.type;
		state.set(STATE_2D, new PreviewStage(this, "2d"));
		state.set(STATE_3D, new PreviewStage(this, "3d"));
		this.listen();
		this.show(this.wanted());
	}

	/** whether the 2D stage is the one built */
	get flat() {
		return this.kind !== "3d";
	}

	/** the camera the state asks for, if the renderer can do it */
	private wanted(): CameraKind {
		return this.state.camera === "3d" && this.supports3d ? "3d" : "2d";
	}

	private show(kind: CameraKind) {
		this.kind = undefined;
		this.target = kind;
		state.change(kind === "3d" ? STATE_3D : STATE_2D);
	}

	/**
	 * Fill the stage that just started.
	 * @param app - the application
	 * @param kind - the stage's camera
	 */
	build(app: Application, kind: CameraKind) {
		this.kind = kind;
		this.emitter = undefined;
		const world = app.world;
		world.addChild(new Backdrop(this), -10000);
		if (kind === "3d") {
			const camera = app.viewport;
			if (camera instanceof Camera3d) {
				this.camera3d = camera;
				camera.fov = FOV;
				camera.setClipPlanes(4, 8000);
			}
			this.floor ??= floorMesh();
			this.syncFloor();
			// Camera3d sorts the world by distance to each child's position,
			// and the floor's center is no measure of the whole floor: from the
			// side it comes nearer than the emitter and covers the particles.
			// Layers give the right order here; the emitter still sorts its
			// own particles by distance.
			world.sortOn = "z";
		} else {
			this.camera3d = undefined;
			world.addChild(new Handles(this), 100);
		}
		this.place();
		this.restart();
		// the camera was toggled again while this stage was on its way
		if (this.wanted() !== kind) {
			this.show(this.wanted());
		}
	}

	/** before a stage switch: keep the floor out of the world reset */
	leave() {
		if (this.floor && this.app.world.hasChild(this.floor)) {
			this.app.world.removeChildNow(this.floor, true);
		}
	}

	private syncFloor() {
		const floor = this.floor;
		if (this.kind !== "3d" || !floor) {
			return;
		}
		const world = this.app.world;
		const shown = world.hasChild(floor);
		if (this.state.grid && !shown) {
			world.addChild(floor, -1);
		} else if (!this.state.grid && shown) {
			world.removeChildNow(floor, true);
		}
	}

	/** the preview's size, in world units at the emitter's depth */
	private get size() {
		const viewport = this.app.viewport;
		return { w: viewport.width, h: viewport.height };
	}

	/** place the emitter (offset and motion) and the 3D camera */
	private place() {
		const { w, h } = this.size;
		const { offset, motion } = this.state;
		// the 2D world starts at the top left; the 3D camera looks at 0, 0
		let x = (this.kind === "3d" ? 0 : w / 2) + offset.x * w;
		let y = (this.kind === "3d" ? 0 : h / 2) + offset.y * h;
		const t = this.time / 1000;
		if (motion === "sway") {
			x += Math.sin(t * 1.4) * w * 0.3;
		} else if (motion === "circle") {
			const r = Math.min(w, h) * 0.28;
			x += Math.cos(t * 1.8) * r;
			y += Math.sin(t * 1.8) * r;
		}
		this.center.x = x;
		this.center.y = y;
		const angle = math.degToRad(this.state.effect.angle);
		this.tip.x = x + Math.cos(angle) * ARM;
		this.tip.y = y - Math.sin(angle) * ARM;
		this.emitter?.centerOn(x, y);

		const camera = this.camera3d;
		if (camera) {
			// at this distance, a particle at the emitter's depth has its 2D size
			const distance = h / 2 / Math.tan(FOV / 2) / this.zoom;
			// `pos.set` is typed for x and y; `depth` is the camera's z
			camera.pos.set(
				Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
				-Math.sin(this.pitch) * distance,
			);
			camera.depth = -Math.cos(this.yaw) * Math.cos(this.pitch) * distance;
			camera.lookAt(ORIGIN);
		}
	}

	/**
	 * One frame of the preview.
	 * @param dt - ms since the last frame
	 */
	tick(dt: number) {
		// placed even while paused: the preview may have been resized
		this.place();
		if (this.paused) {
			return;
		}
		this.time += dt;
		const emitter = this.emitter;
		if (!emitter) {
			return;
		}
		// play the effect again once it is over
		const over =
			emitter.getChildren().length === 0 &&
			(this.state.mode === "burst" || !emitter.isRunning());
		this.idle = over ? this.idle + dt : 0;
		if (this.idle > 500) {
			this.idle = 0;
			this.start(emitter);
		}
	}

	private start(emitter: PreviewEmitter) {
		if (this.state.mode === "burst") {
			emitter.burstParticles();
		} else {
			emitter.streamParticles();
		}
	}

	private settings() {
		return emitterSettings(this.state, this.image);
	}

	/** start the effect over, with a new emitter */
	restart() {
		const world = this.app.world;
		if (this.emitter) {
			world.removeChildNow(this.emitter);
			this.emitter = undefined;
		}
		let emitter: PreviewEmitter;
		try {
			emitter = new PreviewEmitter(0, 0, this.settings());
		} catch (e) {
			this.events.error(e instanceof Error ? e.message : String(e));
			return;
		}
		this.events.error(undefined);
		emitter.paused = this.paused;
		this.emitter = emitter;
		world.addChild(emitter, 0);
		this.place();
		this.start(emitter);
	}

	/**
	 * Follow the editor's state.
	 * @param next - the new state
	 * @param image - the particle image
	 */
	apply(
		next: EditorState,
		image: HTMLCanvasElement | HTMLImageElement | undefined,
	) {
		const previous = this.state;
		const previousImage = this.image;
		this.state = next;
		this.image = image;
		const kind = this.wanted();
		if (kind !== (this.kind ?? this.target)) {
			// the other camera: a new stage, built from the new state
			this.show(kind);
			return;
		}
		if (this.kind === undefined) {
			// the stage being switched to builds from this state
			return;
		}
		this.syncFloor();
		const emitter = this.emitter;
		if (!emitter || previous.mode !== next.mode) {
			this.restart();
			return;
		}
		// the background, grid or offset alone leave the emitter as it is
		if (
			previous.effect !== next.effect ||
			previous.texture !== next.texture ||
			previous.sprite !== next.sprite ||
			previousImage !== image
		) {
			try {
				emitter.reset(this.settings());
				this.events.error(undefined);
			} catch (e) {
				this.events.error(e instanceof Error ? e.message : String(e));
				return;
			}
			emitter.resize(next.effect.width, next.effect.height);
		}
		this.place();
		if (
			previous.motion !== next.motion ||
			previous.effect.duration !== next.effect.duration
		) {
			this.time = 0;
			this.start(emitter);
		}
	}

	/**
	 * Freeze the effect on its current frame, or let it run.
	 * @param paused - whether to freeze it
	 */
	setPaused(paused: boolean) {
		this.paused = paused;
		if (this.emitter) {
			this.emitter.paused = paused;
		}
	}

	/** back to the 3D camera's starting view */
	resetView() {
		this.yaw = START_YAW;
		this.pitch = START_PITCH;
		this.zoom = 1;
		this.place();
	}

	/** the point under the pointer, in world units (2D) */
	private toWorld(event: PointerEvent | WheelEvent) {
		const rect = this.app.renderer.getCanvas().getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * this.size.w) / rect.width,
			y: ((event.clientY - rect.top) * this.size.h) / rect.height,
		};
	}

	/**
	 * DOM pointer events on the canvas rather than `input.registerPointerEvent`:
	 * a pinch needs both fingers at once, and the engine reports a pointer per
	 * renderable. The canvas lives as long as the engine, and so do these.
	 */
	private listen() {
		const canvas = this.app.renderer.getCanvas();
		canvas.style.touchAction = "none";

		const down = (event: PointerEvent) => {
			const p = this.toWorld(event);
			if (this.kind !== "3d" && this.pointers.size > 0) {
				// one drag at a time in 2D
				return;
			}
			this.pointers.set(event.pointerId, p);
			canvas.setPointerCapture(event.pointerId);
			if (this.kind === "3d") {
				this.dragging = "orbit";
				this.pinch = this.pointers.size === 2 ? this.spread() : 0;
				return;
			}
			const { w, h } = this.size;
			const effect = this.state.effect;
			const onTip = Math.hypot(p.x - this.tip.x, p.y - this.tip.y) <= 20;
			const onEmitter =
				Math.abs(p.x - this.center.x) <= Math.max(effect.width / 2, 24) &&
				Math.abs(p.y - this.center.y) <= Math.max(effect.height / 2, 24);
			if (onTip) {
				this.dragging = "angle";
			} else if (onEmitter && this.state.motion === "still") {
				this.dragging = "move";
			} else {
				this.dragging = undefined;
			}
			this.grab = {
				x: p.x - (this.center.x - w / 2),
				y: p.y - (this.center.y - h / 2),
			};
		};

		const move = (event: PointerEvent) => {
			const last = this.pointers.get(event.pointerId);
			if (!last) {
				return;
			}
			const p = this.toWorld(event);
			this.pointers.set(event.pointerId, p);
			if (this.dragging === "orbit") {
				if (this.pointers.size === 2) {
					const spread = this.spread();
					if (this.pinch > 0) {
						this.zoomBy(spread / this.pinch);
					}
					this.pinch = spread;
				} else {
					this.yaw = math.clamp(
						this.yaw - (p.x - last.x) * 0.006,
						-MAX_YAW,
						MAX_YAW,
					);
					this.pitch = math.clamp(
						this.pitch + (p.y - last.y) * 0.006,
						MIN_PITCH,
						MAX_PITCH,
					);
				}
				this.place();
			} else if (this.dragging === "angle") {
				const angle = Math.atan2(-(p.y - this.center.y), p.x - this.center.x);
				this.events.angle(Math.round(math.radToDeg(angle)));
			} else if (this.dragging === "move") {
				const { w, h } = this.size;
				this.events.offset(
					math.round((p.x - this.grab.x) / w, 2),
					math.round((p.y - this.grab.y) / h, 2),
				);
			}
		};

		const up = (event: PointerEvent) => {
			this.pointers.delete(event.pointerId);
			this.pinch = this.pointers.size === 2 ? this.spread() : 0;
			if (this.pointers.size === 0) {
				this.dragging = undefined;
			}
		};

		const wheel = (event: WheelEvent) => {
			if (this.kind === "3d") {
				event.preventDefault();
				this.zoomBy(Math.exp(-event.deltaY * 0.001));
			}
		};

		canvas.addEventListener("pointerdown", down);
		canvas.addEventListener("pointermove", move);
		canvas.addEventListener("pointerup", up);
		canvas.addEventListener("pointercancel", up);
		canvas.addEventListener("wheel", wheel, { passive: false });
	}

	private spread() {
		const [a, b] = [...this.pointers.values()];
		return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
	}

	private zoomBy(factor: number) {
		this.zoom = math.clamp(this.zoom * factor, 0.3, 4);
		this.place();
	}
}

/**
 * The renderer named in the address (`#/particle-editor?renderer=webgl`), so
 * each backend can be tried.
 * @returns "auto", "webgpu", "webgl" or "canvas"
 */
export const rendererChoice = () => {
	const query = globalThis.location.hash.split("?")[1] ?? "";
	const name = new URLSearchParams(query).get("renderer");
	return name === "webgpu" || name === "webgl" || name === "canvas"
		? name
		: "auto";
};

const RENDERERS = {
	auto: video.AUTO,
	webgpu: video.WEBGPU,
	webgl: video.WEBGL,
	canvas: video.CANVAS,
} as const;

/**
 * Start the engine and the preview.
 * @param initial - the state to show first
 * @param image - its particle image
 * @param events - what the editor listens to
 * @returns the preview
 */
export const createPreview = async (
	initial: EditorState,
	image: HTMLCanvasElement | HTMLImageElement | undefined,
	events: PreviewEvents,
) => {
	const app = new Application(960, 640, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "flex",
		renderer: RENDERERS[rendererChoice()],
		antiAlias: true,
	});
	await app.init();
	return new Preview(app, initial, image, events);
};
