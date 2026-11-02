/**
 * melonJS — Starsweep: shaders, post-processing and 3D space.
 *
 * - **Nebula**: a custom `ShaderEffect` on a blank full-screen quad paints
 *   drifting space clouds and twinkling stars every frame, tinted to the
 *   level. Written in GLSL and WGSL, so it runs on WebGL and WebGPU.
 * - **Post-effects**: bloom makes the powered panels, sparks and
 *   characters glow, a vignette frames the screen, and a chromatic
 *   aberration burst kicks in when Bolt gets hit.
 * - **Deep space**: star dust streaming past and far-off novas, 3D
 *   particles drawn by a second, perspective camera under the game's own.
 *
 * All of it needs a GPU renderer. On the Canvas renderer the effects
 * switch themselves off and the game falls back to its drawn sky.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	BloomEffect,
	Camera3d,
	ChromaticAberrationEffect,
	Color,
	type Container,
	game,
	getPool,
	ParticleEmitter,
	Renderable,
	ShaderEffect,
	Sprite,
	Trail,
	Tween,
	timer,
	Vector2d,
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

/** the aberration of the screen on now, for `aberrationBurst` */
let aberration: ChromaticAberrationEffect | null = null;

/**
 * Bloom and the chromatic aberration of hits, on the container that holds a
 * screen's game. They go on the container rather than on the camera: a
 * camera's post-effect pass replaces the whole frame, which would wipe out
 * the space the 3D camera drew before it, while a renderable's pass is
 * blended over what is behind it.
 *
 * Each screen makes its own: a container destroys its effects with it.
 */
export const addLayerFx = (layer: Renderable) => {
	const renderer = game.renderer;
	layer.addPostEffect(
		new BloomEffect(renderer, { threshold: 0.72, intensity: 0.55, radius: 3 }),
	);
	aberration = new ChromaticAberrationEffect(renderer, { offset: 0 });
	layer.addPostEffect(aberration);
};

/**
 * A vignette, on the camera that draws first. A stage's own camera lives as
 * long as the stage, so it is added once.
 */
export const addVignette = (target: Renderable) => {
	if (!target.postEffects.some((fx) => fx instanceof VignetteEffect)) {
		target.addPostEffect(
			new VignetteEffect(game.renderer, { strength: 0.22, size: 22 }),
		);
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
// the 3D space behind the station
// ---------------------------------------------------------------------------

/**
 * The visibility layer of the space behind the game. Only the space camera
 * draws it, and the game's own camera leaves it out.
 */
export const SPACE_LAYER = 2;
/**
 * The visibility layer of the container that holds the game, which the
 * space camera leaves out.
 *
 * Particles are on the default layer (1) whatever their emitter is on, and
 * a camera draws something only if it AND every container above it are on
 * a layer the camera draws. So the space camera draws layer 1 too, and the
 * game is kept out of it by its container's layer instead.
 */
export const GAME_LAYER = 4;

/**
 * A second camera, a perspective `Camera3d`, that draws only the space
 * behind the game. Give it to a `Stage` with `super({ cameras: [...] })`: a
 * stage's own cameras draw before its default one, so space ends up under
 * everything the game's 2D camera draws.
 *
 * Its eye sits at the origin looking down +Z, deeper into the screen.
 * @returns the camera, or null on a renderer without 3D (Canvas, WebGL 1)
 */
export const makeSpaceCamera = (w: number, h: number) => {
	if (game.renderer?.supportsDepthBuffer !== true) {
		return null;
	}
	const camera = new Camera3d(0, 0, w, h, {
		fov: Math.PI / 3,
		near: 1,
		far: 6000,
	});
	camera.name = "space";
	camera.cullMask = SPACE_LAYER | 1;
	return camera;
};

/** a soft white dot, for the particles to be tinted from */
const softDot = (size = 64) => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const r = size / 2;
		const g = ctx.createRadialGradient(r, r, 0, r, r, r);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.25, "rgba(255,255,255,0.75)");
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	}
	return canvas;
};

/** where the dust is born, in front of the camera */
const DUST = { near: 900, far: 4200, halfWidth: 1700, halfHeight: 2800 };
/** how far away the novas go off */
const NOVA_DEPTH = 2200;

/**
 * Space, in 3D: star dust streaming past the camera, and novas, spheres of
 * sparks, going off far away, in the level's colours. Both are plain
 * `ParticleEmitter`s placed in depth: `elevation` sends particles along Z,
 * and the `Camera3d` draws them in perspective, so near dust is big and
 * fast and far dust small and slow. The camera drifts a little too, which
 * is what makes the depth read.
 */
export class DeepSpace extends Renderable {
	private readonly dust: ParticleEmitter;
	/** a few, so one can be aimed elsewhere while the last one fades */
	private readonly novas: ParticleEmitter[] = [];
	private colors: string[] = ["#ffffff", "#2ee6d6", "#b8fff6"];
	private time = Math.random() * 100;
	private next = 0;
	private nextNova = 0;

	constructor(
		private readonly world: Container,
		private readonly camera: Camera3d,
	) {
		super(0, 0, 1, 1);
		this.alwaysUpdate = true;
		this.isPersistent = true;
		// drawn by no camera: this only drives the scene
		this.visibilityLayer = 0;
		camera.setPosition(0, 0, 0);
		const image = softDot();

		const depth = DUST.far - DUST.near;
		// the constructor centres the spawn area on (x, y)
		this.dust = new ParticleEmitter(0, 0, {
			image,
			width: DUST.halfWidth * 2,
			height: DUST.halfHeight * 2,
			depth,
			totalParticles: 500,
			frequency: 20,
			// straight at the camera, give or take
			elevation: -Math.PI / 2,
			elevationVariation: 0.12,
			speed: 3.2,
			speedVariation: 1.6,
			minLife: 9000,
			maxLife: 16000,
			minStartScale: 0.2,
			maxStartScale: 0.55,
			minEndScale: 0.45,
			maxEndScale: 0.9,
			blendMode: "additive",
			// measured from the emitter, which is what puts them at its depth
			referenceSpace: "local",
			onlyInViewport: false,
		});

		for (let i = 0; i < 3; i++) {
			this.novas.push(this.makeNova(image));
		}

		for (const emitter of [this.dust, ...this.novas]) {
			emitter.isPersistent = true;
			emitter.visibilityLayer = SPACE_LAYER;
		}
		world.addChild(this.dust, DUST.near + depth / 2);
		for (const nova of this.novas) {
			world.addChild(nova, NOVA_DEPTH);
		}
		this.dust.streamParticles();
	}

	private makeNova(image: HTMLCanvasElement) {
		return new ParticleEmitter(0, 0, {
			image,
			width: 30,
			height: 30,
			depth: 30,
			totalParticles: 220,
			// every way at once: a sphere
			maxSpread: Math.PI,
			speed: 5,
			speedVariation: 2.5,
			minLife: 1600,
			maxLife: 2800,
			minStartScale: 0.5,
			maxStartScale: 1.1,
			minEndScale: 0,
			maxEndScale: 0.2,
			blendMode: "additive",
			referenceSpace: "local",
			onlyInViewport: false,
		});
	}

	/** take on a level's colours: new dust is born in them */
	setColors(colors: string[]) {
		this.colors = colors;
	}

	/**
	 * a nova far away, somewhere on screen
	 * @param size - 1 for a big one
	 */
	burst(color: string, size = 1) {
		const e = this.novas[this.nextNova];
		this.nextNova = (this.nextNova + 1) % this.novas.length;
		e.settings.tint = color;
		e.settings.speed = 5 * size;
		// somewhere in view at that depth, kept clear of the very edges
		const halfH = Math.tan(this.camera.fov / 2) * NOVA_DEPTH * 0.6;
		const halfW = halfH * (this.camera.width / this.camera.height);
		e.pos.x = (Math.random() * 2 - 1) * halfW - 15;
		e.pos.y = (Math.random() * 2 - 1) * halfH - 15;
		e.burstParticles(Math.round(70 + 150 * size));
	}

	override update(dt: number) {
		this.time += dt / 1000;
		// each new particle takes the tint of the moment: cycle through the
		// colours so the dust is a mix of them
		this.next = (this.next + 1) % this.colors.length;
		this.dust.settings.tint = this.colors[this.next];
		// drift the camera a little, so near and far dust part
		this.camera.yaw = Math.sin(this.time * 0.11) * 0.16;
		this.camera.pitch = Math.sin(this.time * 0.07) * 0.12;
		this.camera.roll = Math.sin(this.time * 0.05) * 0.08;
		return false;
	}

	/** take everything off the world, for good */
	destroy() {
		for (const r of [this.dust, ...this.novas, this]) {
			if (r.ancestor) {
				this.world.removeChild(r);
			}
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
