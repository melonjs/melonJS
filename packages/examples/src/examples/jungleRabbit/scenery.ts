/**
 * melonJS — Jungle Rabbit: the still backdrop the menus sit on.
 *
 * The title and the game-over screen both look at the river. Sharing this
 * keeps them identical to each other and to the run itself — a menu built from
 * different scenery than the game reads as a separate screen bolted on.
 *
 * Nothing here moves or recycles: the stages that use it are static, so the
 * instances are placed once and left, which is all `InstancedMesh` needs.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type Camera3d,
	type Container as ContainerType,
	InstancedMesh,
	Light3d,
	Matrix3d,
	Mesh,
	math,
	Sprite,
	Sprite3d,
	Vector2d,
	Vector3d,
} from "melonjs";
import {
	getFlare,
	getGround,
	getPalette,
	getPuff,
	getRipples,
	getSun,
	getWater,
	geometry as modelGeometry,
} from "./assets";
import {
	CAM_FOV,
	CAM_PITCH,
	FLARE_EDGE_FADE,
	FOG_COLOR,
	FOG_FAR,
	FOG_HEIGHT_FALLOFF,
	FOG_NEAR,
	GROUND_Y,
	HALF_W,
	HUD_Z,
	MODEL_SCALE,
	SKY,
	SUN_AHEAD,
	TILE_LEN,
	TITLE_CARROT_SCALE,
	TITLE_CARROT_X,
	TITLE_CARROT_Y,
	TITLE_CARROT_Z,
	VIEW_H,
	VIEW_W,
	WATER_LEVEL,
} from "./constants";
import type { Geometry } from "./props";
import { createTerrainTile, createWaterPlane, valleyY } from "./terrain";

/** the axis a planted instance turns about — Y, so a plant spins where it stands */
const AXIS_Y = new Vector3d(0, 1, 0);

/* Scratch for `aimFlare`, which runs every frame: reused so projecting the sun
   allocates nothing. */
const _sunAt = new Vector3d();
const _sunScreen = new Vector2d();

/**
 * The sun billboard and the screen-space quad its lens flare runs on.
 *
 * Shared by the run and the menu screens: a title built from a different sky
 * reads as a separate screen bolted on, which is the same argument the scenery
 * beds and the spinning carrots already make.
 * @param world - the container to add both to
 * @returns the billboard, so a caller that moves it can, and the quad
 */
export const createSun = (world: ContainerType) => {
	// A billboard parked far up the gorge. `fog: false` is the whole trick:
	// everything else dissolves into the haze at this distance, and a sun that
	// dissolved with it would just be a pale smudge.
	const sunDisc = new Sprite3d(0, GROUND_Y - 1500, {
		image: getSun(),
		width: 620,
		height: 620,
		lit: false,
		// `transparent` is what makes a soft-edged texture composite at all
		// here: the opaque mesh path disables blending, so the halo came out as
		// a grey disc with a hard rim. Additive on top of that adds light to
		// the sky instead of sitting on it.
		transparent: true,
		fog: false,
		castGroundShadow: false,
	});
	// a PROPERTY, not a setting: only the renderer reads a `blendMode` setting,
	// so in the literal above it would have done nothing
	sunDisc.blendMode = "additive";
	world.addChild(sunDisc, 0);

	// The flare. ONE screen-filling quad hosting a shader, not a stack of
	// sprites: additive light saturates to white over a bright sky, and a soft
	// disc has no shape to survive that. A starburst does, and spikes are an
	// angular function no arrangement of quads can express.
	//
	// `floating` puts it in screen space, and the depth is the whole ordering
	// argument: BELOW `HUD_Z`, so the pass lands after the world and before any
	// label. Above it, the flare tints the text instead — exactly the failure a
	// camera post-effect would have had, since a camera's pass brackets the
	// whole world draw including floating children.
	const puff = getPuff();
	const flare = new Sprite(0, 0, { image: puff });
	// the image is never sampled — the effect ignores the incoming colour — so
	// the puff is here only to give the shader a quad of the right size
	flare.anchorPoint.set(0, 0);
	flare.scale(VIEW_W / puff.width, VIEW_H / puff.height);
	flare.floating = true;
	flare.blendMode = "additive";
	flare.addPostEffect(getFlare());
	world.addChild(flare, HUD_Z - 10);

	return { sunDisc, flare };
};

/**
 * Point the lens flare at wherever the sun currently lands on screen.
 *
 * Call once per frame, AFTER the camera has moved, or the flare trails the
 * frame by one update. The effect is shared between stages, so whichever one is
 * running has to keep claiming it — a stage that sets these once would show the
 * previous stage's aim after a return to the menu.
 * @param camera - the 3D camera the sun is projected through
 * @param sunDisc - the billboard to aim at
 */
export const aimFlare = (camera: Camera3d, sunDisc: Sprite3d) => {
	const sun = camera.worldToScreen(
		_sunAt.set(sunDisc.pos.x, sunDisc.pos.y, sunDisc.depth),
		_sunScreen,
	);
	const fx = getFlare();
	// `null` means the sun is at or behind the camera — nothing to scatter
	if (sun === null) {
		fx.setUniform("uIntensity", 0);
		return;
	}

	// How far inside the frame the sun is, as a fraction of the fade band,
	// taken from whichever edge it is nearest so it dims on the way out
	// whichever way the view turned.
	const bandX = VIEW_W * FLARE_EDGE_FADE;
	const bandY = VIEW_H * FLARE_EDGE_FADE;
	const inset = Math.min(
		(sun.x + bandX) / bandX,
		(VIEW_W - sun.x + bandX) / bandX,
		(sun.y + bandY) / bandY,
		(VIEW_H - sun.y + bandY) / bandY,
	);

	// the quad fills the frame, so screen space over its size IS its uv
	fx.setUniform("uSunX", sun.x / VIEW_W);
	fx.setUniform("uSunY", sun.y / VIEW_H);
	fx.setUniform("uIntensity", Math.max(0, Math.min(1, inset - 1)));
};

export const buildBackdrop = (app: Application) => {
	const world = app.world;
	world.autoDepth = false;
	app.renderer.backgroundColor.parseCSS(SKY);

	world.addChild(
		new Light3d({
			type: "directional",
			direction: [-0.35, 0.82, 0.45],
			color: "#fff6df",
			intensity: 0.85,
		}),
		0,
	);
	world.addChild(new Light3d({ type: "ambient", color: "#6f9179" }), 0);

	const ground = getGround();
	const water = getWater();
	// Starts one tile BEHIND the origin, because the menu camera does: it sits
	// at z = -620, and tiles laid from z = 0 leave the near field — the bottom
	// of the frame — with no ground under it at all. The river covers that gap,
	// so it went unnoticed while the water was opaque; the moment the surface
	// was transparent enough to see through, the background showed as a pale
	// wedge in each bottom corner.
	for (let i = -1; i < 3; i++) {
		const tile = createTerrainTile(ground);
		tile.depth = i * TILE_LEN;
		world.addChild(tile, tile.depth);
	}
	// The same travelling crests the run has. Without them the menu river is
	// a still photograph — the texture is baked, so every bit of motion here
	// is either the UV scroll `TitleStage` drives or this effect's clock.
	const waterPlane = createWaterPlane(water);
	waterPlane.addPostEffect(getRipples());
	world.addChild(waterPlane, 0);

	const palette = getPalette();
	const placement = new Matrix3d();
	// The same authored models the run uses, planted the same way: a menu
	// built from different scenery reads as a separate screen bolted on.
	const beds: [string, number, [number, number]][] = [
		["fern", 330, [0.55, 1.34]],
		["bigleaf", 175, [0.68, 1.52]],
		["flower-red", 75, [0.58, 1.3]],
		["flower-pink", 75, [0.58, 1.3]],
		["palm", 170, [0.6, 1.64]],
	];
	for (const [asset, count, band] of beds) {
		const geometry: Geometry = modelGeometry(asset);
		const mesh = new InstancedMesh(0, GROUND_Y, {
			...geometry,
			texture: palette,
			normalize: false,
			scale: MODEL_SCALE,
			width: 120,
			height: 200,
			textureFilter: "nearest",
			cullBackFaces: false,
			lit: true,
			instanceCount: count,
			castGroundShadow: false,
		});
		world.addChild(mesh, 0);
		for (let i = 0; i < count; i++) {
			const x =
				math.randomFloat(HALF_W * band[0], HALF_W * band[1]) *
				(Math.random() < 0.5 ? -1 : 1);
			const y = GROUND_Y + valleyY(x);
			const z = math.random(200, TILE_LEN * 3);
			placement
				.identity()
				.translate(x / MODEL_SCALE, -y / MODEL_SCALE, z / MODEL_SCALE)
				// each plant faces its own way, so one model does not read as
				// one plant copied a hundred times
				.rotate(math.randomFloat(0, Math.PI * 2), AXIS_Y);
			const jitter = math.randomFloat(0.82, 1.18);
			placement.scale(jitter, jitter, jitter);
			mesh.setInstance(i, placement);
		}
	}

	const camera = app.viewport as Camera3d;
	camera.setClipPlanes?.(1, 9000);
	camera.setFog?.({
		near: FOG_NEAR,
		far: FOG_FAR,
		color: FOG_COLOR,
		fogHeight: WATER_LEVEL,
		heightFalloff: FOG_HEIGHT_FALLOFF,
	});
	camera.colorMatrix.contrast(1.06).saturate(1.14);
	camera.fov = CAM_FOV;
	camera.pitch = CAM_PITCH;
	camera.pos.set(0, WATER_LEVEL - 230);
	camera.depth = -620;

	// A carrot turning on each side of the logo. The pickup is the thing the
	// whole game is about, and two of them framing the title say so faster
	// than any amount of menu copy — the same model the run uses, at the same
	// palette, so the menu reads as part of the game rather than a front end
	// bolted onto it.
	const carrots = [-1, 1].map((side) => {
		const carrot = new Mesh(side * TITLE_CARROT_X, TITLE_CARROT_Y, {
			...modelGeometry("carrot"),
			texture: palette,
			normalize: false,
			scale: TITLE_CARROT_SCALE,
			width: 120,
			height: 200,
			textureFilter: "nearest",
			cullBackFaces: false,
			// unlit like the run's pickups: lighting a carrot from this sun
			// turns its sloped sides into a dark brown lump
			lit: false,
			castGroundShadow: false,
		});
		carrot.depth = TITLE_CARROT_Z;
		world.addChild(carrot, 0);
		return carrot;
	});

	const { sunDisc } = createSun(world);
	sunDisc.depth = SUN_AHEAD;

	// handed back so the stage can animate what it owns: nothing in here runs
	// a clock of its own
	return { waterPlane, carrots, sunDisc };
};
