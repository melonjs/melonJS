/**
 * melonJS — Water Overworld example (shader builtins showcase).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Scene and water shader contributed by the melonJS editor team; pixel art
 * from GandalfHardcore's free 32x32 side-scroller asset pack (itch.io,
 * free to reuse).
 */
import * as me from "melonjs";

/* the shared sprite atlas (texture_image_0), created once after preload */
let gameTexture: me.TextureAtlas | null = null;
export const getGameTexture = () => {
	if (gameTexture === null) {
		gameTexture = new me.TextureAtlas(
			me.loader.getJSON("texture_image_0"),
			me.loader.getImage("texture_image_0"),
		);
	}
	return gameTexture;
};

/* one animation strip packed as a single atlas region: slice it into
 * frameW x frameH sub-frames (row-major), registering per-frame UVs on the
 * atlas — the runtime equivalent of packing each frame separately */
type StripDef = {
	region: string;
	frameW: number;
	frameH: number;
	count: number;
	anim: string;
	delay: number;
};

const buildStripSettings = (texture: me.TextureAtlas, strips: StripDef[]) => {
	/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- atlas region internals are untyped */
	const atlas: unknown[] = [];
	const atlasIndices: Record<string, number> = {};
	const animations: Record<string, { name: string; delay: number }[]> = {};
	let framewidth = 0;
	let frameheight = 0;
	const source = (texture as any).getTexture();

	for (const strip of strips) {
		const base = (texture as any).getRegion(strip.region);
		if (!base) {
			throw new Error(`region "${strip.region}" not found in atlas`);
		}
		const cols = Math.max(1, Math.floor(base.width / strip.frameW));
		const frames: { name: string; delay: number }[] = [];
		for (let i = 0; i < strip.count; i++) {
			const key = `${strip.region}#${i}`;
			const fx = (i % cols) * strip.frameW;
			const fy = Math.floor(i / cols) * strip.frameH;
			const entry: Record<string, unknown> = {};
			entry[key] = Object.assign({}, base, {
				name: key,
				offset: new me.Vector2d(base.offset.x + fx, base.offset.y + fy),
				width: strip.frameW,
				height: strip.frameH,
				trimmed: false,
				trim: undefined,
				sourceSize: { w: strip.frameW, h: strip.frameH },
				angle: 0,
			});
			(texture as any).addUVs(entry, key, source.width, source.height);
			atlasIndices[key] = atlas.length;
			atlas.push(entry[key]);
			frames.push({ name: key, delay: strip.delay });
		}
		animations[strip.anim] = frames;
		framewidth = Math.max(framewidth, strip.frameW);
		frameheight = Math.max(frameheight, strip.frameH);
	}
	/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
	return { atlas, atlasIndices, framewidth, frameheight, animations };
};

/* register the animations built by buildStripSettings on a sprite */
const addStripAnimations = (
	sprite: me.Sprite,
	animations: Record<string, { name: string; delay: number }[]>,
	initial: string,
) => {
	for (const name of Object.keys(animations)) {
		sprite.addAnimation(name, animations[name]);
	}
	sprite.setCurrentAnimation(initial);
};

/**
 * Static decor placed by the TMX object layers (trees, statue, sun, …):
 * a centered sprite showing one atlas region named by the object's
 * `region` property.
 */
export class SpriteTP extends me.Sprite {
	constructor(x: number, y: number, settings: any = {}) {
		settings.image = getGameTexture();
		// the editor stores anchorPoint as a "json:..." string — decor is
		// always centered on its placement point, same as the original
		settings.anchorPoint = { x: 0.5, y: 0.5 };
		super(x, y, settings);
		this.floating = false;
	}
}

/**
 * Static world collision from the TMX `collision` layer (the TMX parser
 * pre-builds `settings.shapes` from the rect objects).
 */
export class CollisionTP extends me.Renderable {
	constructor(x: number, y: number, settings: any = {}) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.body = new me.Body(this, settings.shapes);
		this.body.collisionType = me.collision.types.WORLD_SHAPE;
		this.body.setStatic(true);
	}
}

/** a drifting-sky cloud — a single centered atlas frame */
export class Cloud extends me.Sprite {
	private speed = 1 + Math.random();
	private startX = -141;

	constructor(x: number, y: number, settings: any = {}) {
		settings.image = getGameTexture();
		settings.region = "cloud5";
		settings.anchorPoint = { x: 0.5, y: 0.5 };
		super(x, y, settings);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		super.update(dt);
		// drift right, respawn off the left edge (original demo behavior)
		this.pos.x += this.speed;
		if (this.pos.x >= 1040) {
			this.pos.x = this.startX - (50 + Math.random() * 200);
		}
		return true;
	}
}

/* animated one-strip props (campfire food, portal, cooking area) */
const makeStripProp = (strip: StripDef) => {
	return class StripProp extends me.Sprite {
		constructor(x: number, y: number, settings: any = {}) {
			const texture = getGameTexture();
			const built = buildStripSettings(texture, [strip]);
			settings.image = texture;
			settings.atlas = built.atlas;
			settings.atlasIndices = built.atlasIndices;
			settings.framewidth = built.framewidth;
			settings.frameheight = built.frameheight;
			settings.anchorPoint = { x: 0.5, y: 0.5 };
			super(x, y, settings);
			addStripAnimations(this, built.animations, strip.anim);
		}
	};
};

export const Foodie = makeStripProp({
	region: "Campfire with food sheet",
	frameW: 32,
	frameH: 32,
	count: 40,
	anim: "camp",
	delay: 100,
});

export const Portal = makeStripProp({
	region: "GandalfHardcore Portal sheet",
	frameW: 64,
	frameH: 64,
	count: 10,
	anim: "portal",
	delay: 100,
});

export const CookingArea = makeStripProp({
	region: "Cooking area",
	frameW: 64,
	frameH: 64,
	count: 12,
	anim: "cook",
	delay: 100,
});

/**
 * The playable character: A/D walk, W jump, hold Shift to run.
 * (Plain melonJS input/body code with the same tuning as the original
 * demo's controller: maxVel (2, 15) — 5 while running — friction 0.5.)
 */
export class Male extends me.Sprite {
	private running = false;

	constructor(x: number, y: number, settings: any = {}) {
		const texture = getGameTexture();
		const built = buildStripSettings(texture, [
			{
				region: "male_idle",
				frameW: 80,
				frameH: 64,
				count: 5,
				anim: "idle",
				delay: 180,
			},
			{
				region: "male_walk",
				frameW: 80,
				frameH: 64,
				count: 8,
				anim: "walk",
				delay: 80,
			},
			{
				region: "male_run",
				frameW: 80,
				frameH: 64,
				count: 8,
				anim: "run",
				delay: 80,
			},
		]);
		settings.image = texture;
		settings.atlas = built.atlas;
		settings.atlasIndices = built.atlasIndices;
		settings.framewidth = built.framewidth;
		settings.frameheight = built.frameheight;
		settings.anchorPoint = { x: 0.5, y: 0.5 };
		super(x, y, settings);
		addStripAnimations(this, built.animations, "idle");

		// hit box authored in frame-local (top-left) space; the sprite is
		// center-anchored, so shift it by half the frame like the original
		this.body = new me.Body(
			this,
			new me.Rect(35 - this.width * 0.5, 21 - this.height * 0.5, 9, 43),
		);
		this.body.collisionType = me.collision.types.PLAYER_OBJECT;
		this.body.setMaxVelocity(2, 15);
		this.body.setFriction(0.5, 0);

		me.input.bindKey(me.input.KEY.A, "left");
		me.input.bindKey(me.input.KEY.LEFT, "left");
		me.input.bindKey(me.input.KEY.D, "right");
		me.input.bindKey(me.input.KEY.RIGHT, "right");
		me.input.bindKey(me.input.KEY.W, "jump", true);
		me.input.bindKey(me.input.KEY.UP, "jump", true);
		me.input.bindKey(me.input.KEY.SHIFT, "runLock");

		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		const body = this.body;

		this.running = me.input.isKeyPressed("runLock");
		body.maxVel.x = this.running ? 5 : 2;

		if (me.input.isKeyPressed("left")) {
			body.force.x = -body.maxVel.x;
		} else if (me.input.isKeyPressed("right")) {
			body.force.x = body.maxVel.x;
		} else {
			body.force.x = 0;
		}

		if (me.input.isKeyPressed("jump")) {
			if (!body.jumping && !body.falling) {
				body.vel.y = -body.maxVel.y;
				body.jumping = true;
			}
		}

		// idle / walk / run + facing, mirroring the original demo
		if (body.vel.x === 0 && body.vel.y === 0) {
			if (!this.isCurrentAnimation("idle")) {
				this.setCurrentAnimation("idle");
			}
		} else {
			const anim = this.running ? "run" : "walk";
			if (!this.isCurrentAnimation(anim)) {
				this.setCurrentAnimation(anim);
			}
		}
		if (body.vel.x < 0) {
			this.flipX(false);
		} else if (body.vel.x > 0) {
			this.flipX(true);
		}

		return super.update(dt) || body.vel.x !== 0 || body.vel.y !== 0;
	}

	override onDeactivateEvent() {
		me.input.unbindKey(me.input.KEY.A);
		me.input.unbindKey(me.input.KEY.LEFT);
		me.input.unbindKey(me.input.KEY.D);
		me.input.unbindKey(me.input.KEY.RIGHT);
		me.input.unbindKey(me.input.KEY.W);
		me.input.unbindKey(me.input.KEY.UP);
		me.input.unbindKey(me.input.KEY.SHIFT);
	}
}

/**
 * The pond — an animated water sprite whose post effect refracts
 * EVERYTHING drawn behind it, using the shader builtins:
 *
 * - `screenTex : screen_texture` — the engine keeps this sampler filled
 *   with a capture of the screen so far (no JS plumbing)
 * - `screen_uv` — this fragment's position in that capture
 * - `noise_uv`  — 0..1 across the water sprite itself, so the seamless
 *   noise textures tile independently of where the frame sits in the atlas
 *
 * Shader and tuning by the melonJS editor team (ported verbatim).
 */
export class WaterTextureObj extends me.Sprite {
	private water: me.ShaderEffect;

	constructor(x: number, y: number, settings: any = {}) {
		const texture = getGameTexture();
		// the two water frames, used verbatim (no trim/re-align — the 2dWater
		// art carries its own transparent sky band above the water surface)
		const built = buildStripSettings(texture, [
			{
				region: "2dWater",
				frameW: 480,
				frameH: 480,
				count: 1,
				anim: "water",
				delay: 100,
			},
			{
				region: "water2ds",
				frameW: 740,
				frameH: 523,
				count: 1,
				anim: "water2",
				delay: 100,
			},
		]);
		settings.image = texture;
		settings.atlas = built.atlas;
		settings.atlasIndices = built.atlasIndices;
		settings.framewidth = built.framewidth;
		settings.frameheight = built.frameheight;
		settings.anchorPoint = { x: 0.5, y: 0.5 };
		super(x, y, settings);
		addStripAnimations(this, built.animations, "water");

		const scale = settings.inspectors?.scale ?? { x: 1, y: 1 };
		this.scale(scale.x, scale.y);

		const noise = new me.NoiseTexture2d({
			type: "cellular",
			fractalType: "fbm",
			width: 512,
			height: 512,
			frequency: 0.05,
			octaves: 4,
			gain: 0.5,
			pingPongStrength: 2,
			lacunarity: 2,
			cellularJitter: 1,
			seamlessBlendSkirt: 0.1,
			domainWarpAmp: 30,
			domainWarpFrequency: 0.01,
			speed: 0.5,
			seamless: true,
			seed: 0,
		});
		const noise2 = new me.NoiseTexture2d({
			type: "cellular",
			fractalType: "fbm",
			width: 512,
			height: 512,
			frequency: 0.005,
			octaves: 4,
			gain: 0.5,
			pingPongStrength: 2,
			lacunarity: 2,
			cellularJitter: 1,
			seamlessBlendSkirt: 0.1,
			domainWarpAmp: 30,
			domainWarpFrequency: 0.01,
			speed: 0.5,
			seamless: true,
			seed: 0,
		});

		const fragment = `
			uniform sampler2D uNoise;
			uniform sampler2D uNoise2;
			uniform sampler2D screenTex : screen_texture;
			uniform float rangeWater;
			uniform float uTime;

			uniform float uEdgeAmp;
			uniform float uEdgeFreq;
			uniform float uScreenAmp;
			uniform float uScreenFreq;
			uniform float uFlowAmp;
			uniform float uNoiseAmp;

			vec4 apply(vec4 color, vec2 uv) {
				float t = mod(uTime, 6283.18);

				vec2 flow1 = texture2D(uNoise, noise_uv * 1.0 + t * 0.05).rg;
				vec2 flow2 = texture2D(uNoise, noise_uv * 2.3 - t * 0.03).rg;
				vec2 flow = (flow1 + flow2 * 0.5) - 0.75;
				vec2 noise = 2.0 * texture2D(uNoise2, noise_uv + vec2(0.5, 0.2) * t).rg - vec2(1.0);

				float n = texture2D(uNoise, vec2(noise_uv.x * 3.0, t * 0.1)).r;
				float edgeWave = sin(noise_uv.x * uEdgeFreq + t * 1.8) * uEdgeAmp
								+ sin(noise_uv.x * uEdgeFreq * 2.2 - t * 2.6) * uEdgeAmp * 0.5
								+ (n - 0.5) * uEdgeAmp * 0.6;
				vec2 edgeOffset = vec2(0.0, edgeWave);

				float screenEdgeWave = sin(screen_uv.x * uScreenFreq + t * 1.4) * uScreenAmp
									  + sin(screen_uv.x * uScreenFreq * 2.2 - t * 2.1) * uScreenAmp * 0.5;
				float dynamicRange = rangeWater + screenEdgeWave;

				vec2 normalizedUV = screen_uv;
				normalizedUV.y = dynamicRange - normalizedUV.y;

				vec4 refractedScreen = texture2D(screenTex, normalizedUV + flow * uFlowAmp);
				refractedScreen *= texture2D(uSampler, uv + edgeOffset + noise * uNoiseAmp);
				return refractedScreen;
			}
		`;

		const water = new me.ShaderEffect(me.video.renderer, fragment);
		water.setTexture("uNoise", noise.getTexture(), "repeat");
		water.setTexture("uNoise2", noise2.getTexture(), "repeat");

		// default amplitudes (original demo values)
		water.setUniform("uEdgeAmp", 0.002);
		water.setUniform("uEdgeFreq", 60.0);
		water.setUniform("uScreenAmp", 0.0008);
		water.setUniform("uScreenFreq", 45.0);
		water.setUniform("uFlowAmp", 0.03);
		water.setUniform("uNoiseAmp", 0.0015);
		water.setUniform("rangeWater", 1.02);

		this.water = water;
		this.addPostEffect(water);
		this.alwaysUpdate = true;
	}

	override update(dt: number) {
		this.water.setTime(me.timer.getTime() / 1000);
		super.update(dt);
		return true;
	}
}

/** register every TMX-spawnable entity in the object pool */
export const registerEntities = () => {
	me.pool.register("spriteTP", SpriteTP);
	me.pool.register("collisionTP", CollisionTP);
	me.pool.register("cloud", Cloud);
	me.pool.register("foodie", Foodie);
	me.pool.register("portal", Portal);
	me.pool.register("cookingArea", CookingArea);
	me.pool.register("male", Male);
	me.pool.register("waterTextureObj", WaterTextureObj);
};
