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

/** the length of the angle handle, from the emitter's center */
const ARM = 90;
/**
 * How far below the emitter the 3D floor lies. A mesh is authored Y-up and
 * the scene is drawn Y-down, so the floor's vertices take the opposite sign.
 */
const FLOOR_Y = 320;
const FLOOR_MESH_Y = -FLOOR_Y;
const FOV = (50 * Math.PI) / 180;
/** the orbit stops short of edge-on: particles are flat, facing the screen */
const MAX_YAW = (75 * Math.PI) / 180;
/** from just below the emitter, never under the floor, to high above */
const MIN_PITCH = (-6 * Math.PI) / 180;
const MAX_PITCH = (60 * Math.PI) / 180;

/** what the 3D camera looks at: the emitter's resting place */
const ORIGIN = { x: 0, y: 0, z: 0 };

/** the 2D grid's spacing, and its floor, as a share of the preview's height */
const GRID = 40;
const FLOOR_2D = 0.9;

const BACKGROUNDS = { dark: "#15151d", light: "#e9e9ef" };

/** what the preview tells the editor */
export interface PreviewEvents {
	/** the angle handle was dragged, in degrees */
	angle(degrees: number): void;
	/** the emitter was dragged, as a share of the preview from its center */
	offset(x: number, y: number): void;
	/** the emitter refused the settings, or accepted them again */
	error(message: string | undefined): void;
}

/** an emitter that can be held still, for a look at a moment of the effect */
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

/** the color, or the checkerboard, behind the effect */
class Backdrop extends Renderable {
	constructor(private readonly preview: Preview) {
		super(0, 0, 1, 1);
		this.floating = true;
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override update() {
		return true;
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

	/**
	 * The 2D grid: graph paper over the whole preview, and a floor along the
	 * bottom, in the colors of the 3D floor. Fixed to the preview, so it
	 * shows how far and how fast the particles travel.
	 */
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

/** the spawn area, and the handle that sets the angle (2D only) */
class Handles extends Renderable {
	constructor(private readonly preview: Preview) {
		super(0, 0, 1, 1);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override update() {
		return true;
	}

	override draw(renderer: Renderer) {
		const { x, y } = this.preview.center;
		const effect = this.preview.state.effect;
		const light = this.preview.state.background === "light";
		const ink = light ? "#30303a" : "#ffffff";
		renderer.setBlendMode("normal");

		// the spawn area
		renderer.setGlobalAlpha(0.35);
		renderer.setColor(ink);
		renderer.lineWidth = 1;
		renderer.strokeRect(
			x - effect.width / 2,
			y - effect.height / 2,
			Math.max(effect.width, 1),
			Math.max(effect.height, 1),
		);

		// the spread either side of the angle
		const a = (effect.angle * Math.PI) / 180;
		const spread = (effect.angleVariation * Math.PI) / 180;
		if (spread > 0 && effect.maxSpread === 0) {
			renderer.setGlobalAlpha(0.25);
			for (const side of [-1, 1]) {
				const s = a + side * Math.min(spread, Math.PI);
				renderer.strokeLine(
					x,
					y,
					x + Math.cos(s) * ARM * 0.8,
					y - Math.sin(s) * ARM * 0.8,
				);
			}
		}

		// the angle, with its handle
		const tip = this.preview.tip;
		renderer.setGlobalAlpha(0.8);
		renderer.lineWidth = 2;
		renderer.setColor(this.preview.dragging === "angle" ? "#ffd166" : ink);
		renderer.strokeLine(x, y, tip.x, tip.y);
		renderer.fillEllipse(tip.x, tip.y, 7, 7);
		renderer.setColor(this.preview.dragging === "move" ? "#ffd166" : ink);
		renderer.strokeEllipse(x, y, 6, 6);
		renderer.setGlobalAlpha(1);
		renderer.lineWidth = 1;
	}
}

/** moves the emitter, repeats the effect and flies the 3D camera */
class Driver extends Renderable {
	constructor(private readonly preview: Preview) {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		this.preview.tick(dt);
		return true;
	}

	override draw() {}
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
}

/**
 * The preview: one emitter in a 2D or a 3D scene, rebuilt to the editor's
 * state as it changes.
 */
export class Preview {
	readonly app: Application;
	readonly supports3d: boolean;
	readonly rendererName: string;
	state: EditorState;
	image: HTMLCanvasElement | HTMLImageElement | undefined;
	/** which handle is being dragged */
	dragging: "angle" | "move" | "orbit" | undefined;
	/** where the emitter is drawn (2D), refreshed each frame */
	readonly center = { x: 0, y: 0 };
	readonly tip = { x: 0, y: 0 };
	private emitter: PreviewEmitter | undefined;
	private kind: CameraKind | undefined;
	private floorMesh: Mesh | undefined;
	private camera3d: Camera3d | undefined;
	private paused = false;
	private time = 0;
	/** ms the effect has been over, before it plays again */
	private idle = 0;
	private yaw = 0.5;
	private pitch = 0.22;
	private zoom = 1;
	private readonly pointers = new Map<number, { x: number; y: number }>();
	private pinch = 0;
	private readonly unlisten: () => void;

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
		this.unlisten = this.listen();
		this.show(initial.camera);
	}

	private show(kind: CameraKind) {
		const target = kind === "3d" && this.supports3d ? "3d" : "2d";
		this.kind = undefined;
		state.change(target === "3d" ? STATE_3D : STATE_2D);
	}

	/**
	 * Fill the stage that just started.
	 * @param app - the application
	 * @param kind - which camera the stage has
	 */
	build(app: Application, kind: CameraKind) {
		this.kind = kind;
		this.emitter = undefined;
		const world = app.world;
		world.addChild(new Backdrop(this), -10000);
		world.addChild(new Driver(this));
		if (kind === "3d") {
			const camera = app.viewport;
			if (camera instanceof Camera3d) {
				this.camera3d = camera;
				camera.fov = FOV;
				camera.setClipPlanes(4, 8000);
			}
			this.floorMesh = this.floor();
			this.syncFloor();
			// The 3D camera sorts the world by distance to each child's
			// position, and one point cannot stand for a floor: seen from
			// the side, its center comes nearer than the emitter and it is
			// drawn over the particles. With only the backdrop, the floor and
			// the emitter in this world, their layers are the right order;
			// the emitter still sorts its own particles by distance.
			world.sortOn = "z";
		} else {
			this.camera3d = undefined;
			world.addChild(new Handles(this), 100);
		}
		this.place();
		this.restart();
	}

	private floor() {
		const size = 1600;
		const tiles = 20;
		const floor = new Mesh(0, 0, {
			vertices: new Float32Array([
				-size,
				FLOOR_MESH_Y,
				-size,
				size,
				FLOOR_MESH_Y,
				-size,
				size,
				FLOOR_MESH_Y,
				size,
				-size,
				FLOOR_MESH_Y,
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
		floor.pos.set(0, 0);
		return floor;
	}

	/** whether the preview is the 2D one */
	get flat() {
		return this.kind !== "3d";
	}

	/** show or hide the 3D floor with the grid */
	private syncFloor() {
		const mesh = this.floorMesh;
		if (this.kind !== "3d" || !mesh) {
			return;
		}
		const world = this.app.world;
		const shown = world.hasChild(mesh);
		if (this.state.grid && !shown) {
			world.addChild(mesh, -1);
		} else if (!this.state.grid && shown) {
			// kept, to be added back
			world.removeChildNow(mesh, true);
		}
	}

	/** the size of the preview, in world units at the emitter's depth */
	private get size() {
		const viewport = this.app.viewport;
		return { w: viewport.width, h: viewport.height };
	}

	/** put the emitter where the offset and the motion say, and the camera */
	private place() {
		const { w, h } = this.size;
		const { offset, motion } = this.state;
		// in 2D the world starts at the top left; in 3D the camera looks at 0
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
		const a = (this.state.effect.angle * Math.PI) / 180;
		this.tip.x = x + Math.cos(a) * ARM;
		this.tip.y = y - Math.sin(a) * ARM;
		this.emitter?.centerOn(x, y);

		const camera = this.camera3d;
		if (camera) {
			// framed so a particle at the emitter's depth is drawn at the size
			// it has in 2D
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
	 * @param dt - the time since the last frame, in ms
	 */
	tick(dt: number) {
		if (this.paused) {
			return;
		}
		this.time += dt;
		this.place();
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
	 * @param image - the particle image, undefined for the emitter's own square
	 */
	apply(
		next: EditorState,
		image: HTMLCanvasElement | HTMLImageElement | undefined,
	) {
		const previous = this.state;
		this.state = next;
		this.image = image;
		const kind = next.camera === "3d" && this.supports3d ? "3d" : "2d";
		if (this.kind !== undefined && kind !== this.kind) {
			// a new stage, with the other camera: built from the new state
			this.show(kind);
			return;
		}
		this.syncFloor();
		const emitter = this.emitter;
		if (!emitter || previous.mode !== next.mode) {
			this.restart();
			return;
		}
		try {
			emitter.reset(this.settings());
			this.events.error(undefined);
		} catch (e) {
			this.events.error(e instanceof Error ? e.message : String(e));
			return;
		}
		emitter.resize(next.effect.width, next.effect.height);
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
	 * Hold the effect still, or let it go on.
	 * @param paused - whether to hold it
	 */
	setPaused(paused: boolean) {
		this.paused = paused;
		if (this.emitter) {
			this.emitter.paused = paused;
		}
	}

	/** back to the starting view of the 3D camera */
	resetView() {
		this.yaw = 0.5;
		this.pitch = 0.22;
		this.zoom = 1;
		this.place();
	}

	/** the point under the pointer, in world units (2D) */
	private toWorld(event: PointerEvent | WheelEvent) {
		const canvas = this.app.renderer.getCanvas();
		const rect = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) * this.size.w) / rect.width,
			y: ((event.clientY - rect.top) * this.size.h) / rect.height,
		};
	}

	private listen() {
		const canvas = this.app.renderer.getCanvas();
		canvas.style.touchAction = "none";

		const down = (event: PointerEvent) => {
			const p = this.toWorld(event);
			this.pointers.set(event.pointerId, p);
			canvas.setPointerCapture(event.pointerId);
			if (this.kind === "3d") {
				this.dragging = "orbit";
				this.pinch = this.pointers.size === 2 ? this.spread() : 0;
				return;
			}
			const { w, h } = this.size;
			const tip = Math.hypot(p.x - this.tip.x, p.y - this.tip.y);
			const effect = this.state.effect;
			const near =
				Math.abs(p.x - this.center.x) <= Math.max(effect.width / 2, 24) &&
				Math.abs(p.y - this.center.y) <= Math.max(effect.height / 2, 24);
			if (tip <= 20) {
				this.dragging = "angle";
			} else if (near && this.state.motion === "still") {
				this.dragging = "move";
			} else {
				this.dragging = undefined;
			}
			// drag from where the pointer took hold, not from the center
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
					this.yaw = clamp(this.yaw - (p.x - last.x) * 0.006, MAX_YAW);
					this.pitch = Math.min(
						MAX_PITCH,
						Math.max(MIN_PITCH, this.pitch + (p.y - last.y) * 0.006),
					);
				}
				this.place();
			} else if (this.dragging === "angle") {
				const degrees = Math.round(
					(Math.atan2(-(p.y - this.center.y), p.x - this.center.x) * 180) /
						Math.PI,
				);
				this.events.angle(degrees);
			} else if (this.dragging === "move") {
				const { w, h } = this.size;
				this.events.offset(
					round2((p.x - this.grab.x) / w),
					round2((p.y - this.grab.y) / h),
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
		return () => {
			canvas.removeEventListener("pointerdown", down);
			canvas.removeEventListener("pointermove", move);
			canvas.removeEventListener("pointerup", up);
			canvas.removeEventListener("pointercancel", up);
			canvas.removeEventListener("wheel", wheel);
		};
	}

	private grab = { x: 0, y: 0 };

	private spread() {
		const [a, b] = [...this.pointers.values()];
		return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
	}

	private zoomBy(factor: number) {
		this.zoom = Math.min(4, Math.max(0.3, this.zoom * factor));
		this.place();
	}

	/** stop listening to the canvas */
	destroy() {
		this.unlisten();
	}
}

const clamp = (value: number, limit: number) => {
	return Math.min(limit, Math.max(-limit, value));
};

const round2 = (n: number) => {
	return Math.round(n * 100) / 100;
};

/**
 * The renderer asked for in the address, `#/particle-editor?renderer=webgl`,
 * so each backend can be tried.
 * @returns a `video` renderer constant
 */
export const requestedRenderer = () => {
	const query = globalThis.location.hash.split("?")[1] ?? "";
	const name = new URLSearchParams(query).get("renderer");
	switch (name) {
		case "canvas":
			return video.CANVAS;
		case "webgl":
			return video.WEBGL;
		case "webgpu":
			return video.WEBGPU;
		default:
			return video.AUTO;
	}
};

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
		renderer: requestedRenderer(),
		antiAlias: true,
	});
	await app.init();
	return new Preview(app, initial, image, events);
};
