/**
 * melonJS — Starsweep: shaders, post-processing and the 3D cruiser.
 *
 * - **Nebula**: a custom `ShaderEffect` on a blank full-screen quad paints
 *   drifting space clouds and twinkling stars every frame, tinted to the
 *   level. Written in GLSL and WGSL, so it runs on WebGL and WebGPU.
 * - **Camera post-effects**: bloom makes the powered panels, sparks and
 *   characters glow, a vignette frames the board, and a chromatic
 *   aberration burst kicks in when Bolt gets hit.
 * - **Cruiser**: a Kenney Space Kit ship (`Mesh` from OBJ + MTL) that
 *   flies past now and then, under the station, seen through the gaps.
 *
 * All of it needs a GPU renderer. On the Canvas renderer the effects
 * switch themselves off and the game falls back to its drawn sky.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	BloomEffect,
	ChromaticAberrationEffect,
	Color,
	type Container,
	game,
	getPool,
	Mesh,
	ParticleEmitter,
	Renderable,
	ShaderEffect,
	Sprite,
	Trail,
	Tween,
	timer,
	Vector2d,
	Vector3d,
	VignetteEffect,
} from "melonjs";
import {
	drawPlanet,
	drawSky,
	makeStars,
	type Renderer,
	type Star,
} from "./draw";
import type { Theme } from "./levels";

// ---------------------------------------------------------------------------
// nebula background shader
// ---------------------------------------------------------------------------

const nebulaGlsl = `
uniform float uTime;
uniform float uAspect;
uniform vec3 uSky;
uniform vec3 uColorA;
uniform vec3 uColorB;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

vec4 apply(vec4 color, vec2 uv) {
	vec2 p = vec2(uv.x * uAspect, uv.y) * 3.0;
	float t = uTime * 0.03;
	// domain-warped clouds, two layers drifting at different speeds
	float n = fbm(p + vec2(t, -t * 0.6) + fbm(p * 0.6 - t) * 1.4);
	float m = fbm(p * 1.6 - vec2(t * 1.4, t * 0.4));
	vec3 col = uSky;
	col = mix(col, uColorA, smoothstep(0.42, 0.9, n) * 0.6);
	col = mix(col, uColorB, smoothstep(0.5, 0.95, m) * 0.5);
	// a star field on a grid, one star in a few cells, each twinkling
	vec2 g = p * 26.0;
	vec2 id = floor(g);
	vec2 f = fract(g) - 0.5;
	float h = hash(id);
	float star = step(0.982, h) * smoothstep(0.14, 0.0, length(f));
	star *= 0.55 + 0.45 * sin(uTime * 2.5 + h * 80.0);
	col += vec3(star);
	return vec4(col, 1.0);
}
`;

const nebulaWgsl = `
struct NebulaUniforms {
	uSky : vec3f,
	uTime : f32,
	uColorA : vec3f,
	uAspect : f32,
	uColorB : vec3f,
};
@group(3) @binding(0) var<uniform> fx : NebulaUniforms;

fn hash(q : vec2f) -> f32 {
	var p = fract(q * vec2f(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

fn noise(p : vec2f) -> f32 {
	let i = floor(p);
	let f = fract(p);
	let u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x),
		mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x),
		u.y
	);
}

fn fbm(q : vec2f) -> f32 {
	var p = q;
	var v = 0.0;
	var a = 0.5;
	for (var i = 0; i < 5; i++) {
		v += a * noise(p);
		p *= 2.03;
		a *= 0.5;
	}
	return v;
}

fn apply(color : vec4f, uv : vec2f) -> vec4f {
	let p = vec2f(uv.x * fx.uAspect, uv.y) * 3.0;
	let t = fx.uTime * 0.03;
	let n = fbm(p + vec2f(t, -t * 0.6) + fbm(p * 0.6 - t) * 1.4);
	let m = fbm(p * 1.6 - vec2f(t * 1.4, t * 0.4));
	var col = fx.uSky;
	col = mix(col, fx.uColorA, smoothstep(0.42, 0.9, n) * 0.6);
	col = mix(col, fx.uColorB, smoothstep(0.5, 0.95, m) * 0.5);
	let g = p * 26.0;
	let id = floor(g);
	let f = fract(g) - 0.5;
	let h = hash(id);
	var star = step(0.982, h) * smoothstep(0.14, 0.0, length(f));
	star *= 0.55 + 0.45 * sin(fx.uTime * 2.5 + h * 80.0);
	col += vec3f(star);
	return vec4f(col, 1.0);
}
`;

const rgb = (css: string) => {
	const c = new Color().parseCSS(css);
	return new Float32Array([c.r / 255, c.g / 255, c.b / 255]);
};

const blankQuad = (size: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, size, size);
	}
	return canvas;
};

/**
 * The animated space backdrop: a screen-sized quad whose pixels come
 * entirely from the nebula shader.
 */
export class NebulaBackdrop extends Sprite {
	readonly fx: ShaderEffect;
	private time = Math.random() * 100;

	constructor(width: number, height: number) {
		const QUAD = 16;
		super(0, 0, { image: blankQuad(QUAD) });
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.scale(width / QUAD, height / QUAD);
		this.fx = new ShaderEffect(game.renderer, {
			glsl: nebulaGlsl,
			wgsl: nebulaWgsl,
		});
		this.fx.setUniform("uAspect", width / height);
		this.addPostEffect(this.fx);
	}

	/** false on renderers that cannot run the shader (Canvas) */
	get supported() {
		return this.fx.enabled;
	}

	setTheme(sky: string, a: string, b: string) {
		this.fx.setUniform("uSky", rgb(sky));
		this.fx.setUniform("uColorA", rgb(a));
		this.fx.setUniform("uColorB", rgb(b));
	}

	setLevelTheme(theme: Theme) {
		this.setTheme(theme.sky, theme.litSide, theme.wallSide);
	}

	override update(dt: number) {
		this.time += dt / 1000;
		this.fx.setUniform("uTime", this.time);
		super.update(dt);
		return true;
	}
}

// ---------------------------------------------------------------------------
// camera post-processing
// ---------------------------------------------------------------------------

let bloom: BloomEffect | null = null;
let vignette: VignetteEffect | null = null;
let aberration: ChromaticAberrationEffect | null = null;

/**
 * Bloom, chromatic aberration and a vignette on the camera. Built once and
 * re-added after each screen change (a new screen can bring a new camera).
 */
export const setupScreenFx = (app: Application) => {
	bloom ??= new BloomEffect(app.renderer, {
		threshold: 0.72,
		intensity: 0.55,
		radius: 3,
	});
	aberration ??= new ChromaticAberrationEffect(app.renderer, { offset: 0 });
	vignette ??= new VignetteEffect(app.renderer, { strength: 0.22, size: 22 });
	for (const fx of [bloom, aberration, vignette]) {
		if (!app.viewport.postEffects.includes(fx)) {
			app.viewport.addPostEffect(fx);
		}
	}
};

/** a short colour-split shudder, for hits */
export const aberrationBurst = (peak = 7, duration = 450) => {
	const fx = aberration;
	if (!fx?.enabled) {
		return;
	}
	const driver = { offset: peak };
	fx.setOffset(peak);
	const tween = getPool("tween").get(driver) as Tween;
	tween
		.to({ offset: 0 }, { duration })
		.easing(Tween.Easing.Cubic.Out)
		.onUpdate(() => fx.setOffset(driver.offset))
		.start();
};

// ---------------------------------------------------------------------------
// the 3D cruiser
// ---------------------------------------------------------------------------

export const CRUISER_MODELS = [
	"craft_speederA",
	"craft_racer",
	"craft_miner",
] as const;
export const CRUISER_BASE = "assets/multiMaterialMesh/";

const AXIS_X = new Vector3d(1, 0, 0);
const AXIS_Z = new Vector3d(0, 0, 1);

interface Flight {
	mesh: Mesh;
	x: number;
	y: number;
	vx: number;
	size: number;
	bank: number;
}

/**
 * Space Kit ships cruising across the sky now and then. Drawn between the
 * backdrop and the station, so they pass under the board and show through
 * its gaps.
 */
export class Cruisers extends Renderable {
	private flights: Flight[] = [];
	private wait: number;
	private readonly w: number;
	private readonly h: number;
	private readonly every: [number, number];
	private readonly sizes: [number, number];

	constructor(
		w: number,
		h: number,
		opts: {
			every?: [number, number];
			sizes?: [number, number];
			first?: number;
		} = {},
	) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.w = w;
		this.h = h;
		this.every = opts.every ?? [9, 16];
		this.sizes = opts.sizes ?? [70, 120];
		this.wait = opts.first ?? 2;
	}

	/** whether this renderer can draw 3D meshes at a usable speed */
	static supported() {
		return game.renderer.supportsDepthBuffer === true;
	}

	private launch() {
		const model =
			CRUISER_MODELS[Math.floor(Math.random() * CRUISER_MODELS.length)];
		const size =
			this.sizes[0] + Math.random() * (this.sizes[1] - this.sizes[0]);
		const leftToRight = Math.random() < 0.5;
		const mesh = new Mesh(0, 0, {
			model,
			material: model,
			width: size,
			height: size,
			cullBackFaces: false,
		});
		this.flights.push({
			mesh,
			x: leftToRight ? -size : this.w + size,
			y: 90 + Math.random() * (this.h - 180),
			vx: (leftToRight ? 1 : -1) * (70 + Math.random() * 60),
			size,
			bank: Math.random() * Math.PI * 2,
		});
	}

	override update(dt: number) {
		const s = dt / 1000;
		this.wait -= s;
		if (this.wait <= 0) {
			this.wait =
				this.every[0] + Math.random() * (this.every[1] - this.every[0]);
			this.launch();
		}
		for (const f of this.flights) {
			f.x += f.vx * s;
			f.bank += s;
			// nose along the direction of travel, seen a little from above,
			// rolling gently as it flies
			const m = f.mesh;
			m.currentTransform.identity();
			// each rotate() applies before the ones already set, so read these
			// bottom-up: roll along the hull, tilt it to a three-quarter view
			// from above (the model's nose then points down the screen), then
			// turn the nose to the direction of travel
			m.rotate(f.vx > 0 ? Math.PI / 2 : -Math.PI / 2, AXIS_Z);
			m.rotate(1.15, AXIS_X);
			m.rotate(Math.sin(f.bank * 1.3) * 0.35, AXIS_Z);
			m.pos.set(f.x, f.y + Math.sin(f.bank * 0.9) * 10);
		}
		this.flights = this.flights.filter(
			(f) => f.x > -f.size * 2 && f.x < this.w + f.size * 2,
		);
		return true;
	}

	override draw(r: Renderer) {
		for (const f of this.flights) {
			f.mesh.preDraw(r);
			f.mesh.draw(r);
			f.mesh.postDraw(r);
		}
	}
}

// ---------------------------------------------------------------------------
// particles and trails
// ---------------------------------------------------------------------------

/**
 * Bursts of particles and spark trails, from the engine's `ParticleEmitter`
 * and `Trail`.
 *
 * ONE long-lived emitter serves every burst: it is moved to where the next
 * one happens and given that burst's colour, speed and life just before
 * `burstParticles`. A particle copies those settings when it is born, so
 * changing them never touches the particles already flying, and
 * `referenceSpace: "world"` keeps them where they were born when the
 * emitter moves on.
 */
export class Effects {
	private readonly emitter: ParticleEmitter;
	private readonly trails = new Set<Trail>();

	constructor(
		private readonly world: Container,
		private readonly z: number,
	) {
		const SPAWN = 10;
		this.emitter = new ParticleEmitter(0, 0, {
			width: SPAWN,
			height: SPAWN,
			textureSize: 4,
			totalParticles: 30,
			angle: 0,
			angleVariation: Math.PI, // all the way round
			minStartScale: 0.7,
			maxStartScale: 1.4,
			minEndScale: 0,
			maxEndScale: 0.2,
			blendMode: "additive",
			referenceSpace: "world",
		});
		// level.load clears the world of everything that is not persistent
		this.emitter.isPersistent = true;
		world.addChild(this.emitter, z);
	}

	/**
	 * a burst of particles flying out from (x, y)
	 * @param speed - how fast they leave, in pixels per second
	 * @param life - how long they last, in milliseconds
	 */
	burst(
		x: number,
		y: number,
		color: string,
		count: number,
		speed: number,
		life = 220,
	) {
		const e = this.emitter;
		const s = e.settings;
		s.tint = color;
		// the emitter's speed is in pixels per frame at 60 fps
		s.speed = (speed / 60) * 0.65;
		s.speedVariation = s.speed * 0.6;
		s.minLife = life * 0.6;
		s.maxLife = life * 1.2;
		// the spawn area hangs from the emitter's top left: centre it
		e.pos.set(x - 5, y - 5);
		e.burstParticles(count);
	}

	/**
	 * a glowing ribbon behind something that moves: the `Trail` follows
	 * `target` until `stop` is called
	 */
	trail(target: Vector2d) {
		const trail = new Trail({
			target,
			length: 10,
			width: 9,
			lifetime: 170,
			widthCurve: [1, 0],
			gradient: ["#ffffff", "#fff2a8", "#ffd23d00"],
		});
		trail.blendMode = "additive";
		this.world.addChild(trail, this.z);
		this.trails.add(trail);
		return trail;
	}

	/** let a trail fade out, then take it away */
	stop(trail: Trail) {
		trail.target = null;
		timer.setTimeout(() => this.drop(trail), 200);
	}

	private drop(trail: Trail) {
		if (this.trails.delete(trail) && trail.ancestor) {
			this.world.removeChild(trail);
		}
	}

	/** take everything off the world, for good */
	destroy() {
		for (const trail of [...this.trails]) {
			this.drop(trail);
		}
		if (this.emitter.ancestor) {
			this.world.removeChild(this.emitter);
		}
	}
}

/** a point a trail can follow */
export const trailPoint = (x: number, y: number) => new Vector2d(x, y);

// ---------------------------------------------------------------------------
// the backdrop behind the station
// ---------------------------------------------------------------------------

/**
 * The ringed planet, and the whole sky on a renderer that cannot run the
 * nebula shader. Drawn under the Tiled board.
 */
export class SpaceBackdrop extends Renderable {
	private time = 0;
	private readonly stars: Star[];
	private planet = "#128a87";
	private sky = "#0b0a24";

	constructor(
		w: number,
		h: number,
		/** draw the sky too: false when the nebula shader paints it */
		private readonly drawnSky: boolean,
		private readonly planetAt: { x: number; y: number },
	) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.isPersistent = true;
		this.stars = makeStars(120, w, h);
	}

	setTheme(theme: Theme) {
		this.planet = theme.litSide;
		this.sky = theme.sky;
	}

	override update(dt: number) {
		this.time += dt / 1000;
		return true;
	}

	override draw(r: Renderer) {
		if (this.drawnSky) {
			drawSky(
				r,
				this.sky,
				this.stars,
				this.width,
				this.height,
				this.time,
				this.planet,
			);
		} else {
			drawPlanet(r, this.planetAt.x, this.planetAt.y, this.time, this.planet);
		}
	}
}
