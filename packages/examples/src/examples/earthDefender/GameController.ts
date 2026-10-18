/**
 * melonJS — Earth Defender: the game.
 *
 * A twin-stick-ish shooter played on the OUTSIDE of a planet. The novel
 * part is in `sphereMath.ts`; this file is the ordinary game on top of
 * it, and it is deliberately ordinary, because the point of the
 * prototype is to find out whether the sphere reads as a place to play
 * rather than as a demo of a rotation.
 *
 * What shares the frame, which is the other thing this is here to show:
 * a glTF `Mesh` planet and dome, glTF `Mesh` rocks and saucer, `Sprite3d`
 * bolts and decals, a `ParticleEmitter` per kill, and a screen-space `Text`
 * HUD over all of it. Same world, same sort, one camera.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	type Camera3d,
	ChromaticAberrationEffect,
	Color,
	ColorMatrixEffect,
	Container,
	collision,
	type Gradient,
	getPool,
	input,
	Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	ProgressBar,
	Renderable,
	type ShaderEffect,
	Sphere,
	Sprite,
	Sprite3d,
	save,
	state,
	Text,
	Trail3d,
	Tween,
	Vector2d,
	Vector3d,
} from "melonjs";
import {
	ABERRATION_MS,
	ABERRATION_PEAK,
	ATM_EXPOSURE,
	ATM_FALLOFF,
	ATM_INNER,
	ATM_RADIUS,
	ATM_SHADER,
	ATM_SUN,
	ATM_TEX,
	ATM_TINT,
	AXIS_X,
	AXIS_Z,
	BATTLE_MUSIC,
	BATTLE_MUSIC_VOLUME,
	BEST_COLOR,
	BEST_NEW_COLOR,
	BEST_NEW_MS,
	BEST_SAVE_KEY,
	BOLT_HIT_RADIUS,
	BOLT_IMPACT_BURST,
	BOLT_IMPACT_SHAKE,
	BOLT_IMPACT_SHAKE_MS,
	BOLT_POOL,
	BOMB_HIT_RADIUS,
	BONUS_EMISSIVE,
	BONUS_HUE,
	BONUS_LIGHTNESS,
	BONUS_MULTIPLIERS,
	BONUS_PIERCE_CHANCE,
	BONUS_PULSE,
	BONUS_PULSE_HZ,
	BONUS_SATURATION,
	BONUS_SCORE_MULT,
	BONUS_SPREAD_CHANCE,
	BONUS_WARD_CHANCE,
	BULLET_ALT,
	BULLET_LIFE_MS,
	BULLET_SPEED,
	BURST_AREA_SCALE,
	BURST_FINAL_LIFE,
	BURST_FINAL_SPEED,
	BURST_HIT_MIN,
	BURST_HIT_PER_SIZE,
	BURST_LIFE,
	BURST_SPEED,
	CAM_PAN_DAMP,
	CAM_PAN_X,
	CAM_PAN_Y,
	CRAFT_ALT,
	DAMAGE_FROM,
	DAMAGE_MAX,
	DAMAGE_SHADER,
	DAMAGE_TEX,
	DAMAGE_THROB_HZ,
	DAMAGE_TINT,
	DOME_MODEL,
	DOME_R,
	EARTH_MODEL,
	ENGINE_CORE,
	ENGINE_DAMP,
	ENGINE_EDGE,
	ENGINE_HOT_COLOR,
	ENGINE_LENGTH,
	ENGINE_LIGHT_COLOR,
	ENGINE_LIGHT_INTENSITY,
	ENGINE_LIGHT_RANGE,
	ENGINE_OFFSET,
	ENGINE_TEX_H,
	ENGINE_TEX_W,
	ENGINE_TRAIL_FLARE,
	ENGINE_TRAIL_GRADIENT,
	ENGINE_TRAIL_HOT_FROM,
	ENGINE_TRAIL_IDLE,
	ENGINE_TRAIL_LIFETIME,
	ENGINE_TRAIL_POINTS,
	ENGINE_TRAIL_STEP,
	ENGINE_TRAIL_WIDTH,
	ENGINE_WIDTH,
	FIRE_INTERVAL_MS,
	FLASH_BOULDER_INTENSITY,
	FLASH_BOULDER_MS,
	FLASH_BOULDER_RANGE,
	FLASH_ROCK_INTENSITY,
	FLASH_ROCK_MS,
	FLASH_ROCK_RANGE,
	FLASH_SHIELD_INTENSITY,
	FLASH_SHIELD_MS,
	FLASH_SHIELD_RANGE,
	FRAME_SHININESS,
	FRAME_SPECULAR,
	FREEZE_HIT_MS,
	GLASS_SHININESS,
	GLASS_SPECULAR,
	GLOW_ALPHA,
	GLOW_EXPOSURE,
	GLOW_SHADER,
	GLOW_SIZE,
	GLOW_TINT,
	HALO_ALPHA,
	HALO_SCALE,
	HDR_BOLT_EXPOSURE,
	HEAT_BAR_FRAME,
	HEAT_BAR_H,
	HEAT_COLD_COLOR,
	HEAT_COOL_DELAY_MS,
	HEAT_COOL_PER_S,
	HEAT_HOT_COLOR,
	HEAT_MAX,
	HEAT_OVERHEAT_SHAKE,
	HEAT_OVERHEAT_SHAKE_MS,
	HEAT_OVERHEAT_SHIELD_COST,
	HEAT_PER_S,
	HEAT_RESUME,
	HIT_SHELL,
	HUD_FONT,
	HUNTER_UNSEEN_MARGIN,
	ICE_BOOST_BIG,
	ICE_BOOST_BIG_GRADE,
	ICE_BOOST_MID,
	ICE_BOOST_MID_GRADE,
	ICE_BOOST_SMALL,
	ICE_HUE,
	ICE_LIGHTNESS,
	ICE_SATURATION,
	INVULN_MS,
	LANCE_LENGTH,
	LASER_CORE,
	LASER_EDGE,
	LASER_LENGTH,
	LASER_TEX_H,
	LASER_TEX_W,
	LASER_WIDTH,
	MULTIPLIER_MAX,
	MULTIPLIER_STEP,
	OVER_COLOR,
	OVER_HINT_COLOR,
	OVER_HINT_DELAY_MS,
	OVER_HINT_FADE_MS,
	OVER_MUSIC_FADE_MS,
	OVER_SHAKE,
	OVER_SHAKE_MS,
	OVER_STAMP_FROM,
	OVER_STAMP_MS,
	OVER_WIDTH_RATIO,
	PLANET_R,
	PLANET_Z,
	PRIZE_COLOR,
	ROCK_BIG_CHANCE,
	ROCK_BIG_MAX,
	ROCK_BIG_MIN,
	ROCK_BONUS_CHANCE,
	ROCK_BONUS_EXTRA_HP,
	ROCK_BOUNCE_MARGIN,
	ROCK_BOUNCE_MS,
	ROCK_CEILING,
	ROCK_CLEARANCE,
	ROCK_ENTRY_ALTITUDE,
	ROCK_ENTRY_MS,
	ROCK_FLASH_HIT,
	ROCK_FLASH_LAST,
	ROCK_FLASH_MS,
	ROCK_FLASH_SPLIT,
	ROCK_HP_PER_SIZE,
	ROCK_ICE_CHANCE,
	ROCK_MAX,
	ROCK_MAX_RADIUS,
	ROCK_ON_TRACK_BEHIND,
	ROCK_ON_TRACK_CHANCE,
	ROCK_ON_TRACK_MAX_ARC,
	ROCK_ON_TRACK_MIN_ARC,
	ROCK_ON_TRACK_SPREAD,
	ROCK_PAIR_BOUNCE_MS,
	ROCK_PAIR_MARGIN,
	ROCK_PAIR_MAX_PUSH,
	ROCK_PAIR_RESOLVE,
	ROCK_PAIR_RESTITUTION,
	ROCK_SCALE,
	ROCK_SCALE_MAX,
	ROCK_SCALE_MIN,
	ROCK_SHADOW_LIFT,
	ROCK_SHADOW_OPACITY,
	ROCK_SHADOW_SCALE,
	ROCK_SHADOW_THROW,
	ROCK_SHAPES,
	ROCK_SPAWN_INTERVAL_MS,
	ROCK_SPAWN_MIN_ARC,
	ROCK_SPEED_CEIL,
	ROCK_SPEED_FLOOR,
	ROCK_SPEED_MAX,
	ROCK_SPEED_MIN,
	ROCK_SPIN_MAX,
	ROCK_SPIN_MIN,
	ROCK_SPLIT_COUNT_MAX,
	ROCK_SPLIT_COUNT_MIN,
	ROCK_SPLIT_MIN_GRADE,
	ROCK_SPLIT_SCALE,
	ROCK_SPLIT_SPEED,
	ROCK_SPLIT_SPREAD,
	ROCK_START_COUNT,
	ROCK_STEER_RATE,
	RUMBLE_DEATH,
	RUMBLE_ROCK_BIG,
	RUMBLE_ROCK_SMALL,
	RUMBLE_SHIELD_HIT,
	SCORE_PER_ROCK,
	SCORE_POP_BONUS_COLOR,
	SCORE_POP_COLOR,
	SCORE_POP_END_SCALE,
	SCORE_POP_FADE_FROM,
	SCORE_POP_MAX,
	SCORE_POP_MS,
	SCORE_POP_RISE,
	SCORE_POP_SIZE,
	SCORE_POP_START_SCALE,
	SCORE_POP_STEP,
	SCORE_POP_STEPS_MAX,
	SCORE_POP_Z,
	SHATTER_TIME_SCALE,
	SHIELD_BAR_FRAME,
	SHIELD_BAR_H,
	SHIELD_BAR_RADIUS,
	SHIELD_BAR_W,
	SHIELD_BUBBLE_ALPHA,
	SHIELD_BUBBLE_SCALE,
	SHIELD_BUBBLE_TEX,
	SHIELD_EMPTY_BLINK_MS,
	SHIELD_EMPTY_COLOR,
	SHIELD_EXPOSURE,
	SHIELD_FLASH_MS,
	SHIELD_FULL_COLOR,
	SHIELD_HIT_COST,
	SHIELD_IMPACT_BURST,
	SHIELD_MAX,
	SHIELD_REGEN_DELAY_MS,
	SHIELD_REGEN_PER_S,
	SHIELD_SHADER,
	SHIELD_SPIN_A,
	SHIELD_SPIN_B,
	SHIP_ATTITUDE_DAMP,
	SHIP_BANK,
	SHIP_BOUNCE_ARC,
	SHIP_DEATH_BURST,
	SHIP_DEATH_BURST_LIFE,
	SHIP_DEATH_BURST_SPEED,
	SHIP_HIT_RADIUS,
	SHIP_MODEL,
	SHIP_PITCH,
	SHIP_SHADOW_OPACITY,
	SHIP_SHADOW_SCALE,
	SHIP_SHADOW_THROW,
	SHIP_SHIELD_RADIUS,
	SHIP_SHININESS,
	SHIP_SIZE,
	SHIP_SPECULAR,
	SHIP_SPEED,
	SHIP_SPEED_BOOST,
	SHIP_TURN_RATE,
	SHIP_VIEW_Z,
	SKY_PARALLAX,
	SKY_Z,
	SUN_DIRECTION,
	TERRAIN_SHININESS,
	TERRAIN_SPECULAR,
	TINT_BONUS_EXPLOSION,
	TINT_ICE_EXPLOSION,
	TINT_ROCK_EXPLOSION,
	TINT_SHIP_EXPLOSION,
	UPGRADE_BOLTS,
	UPGRADE_MS,
	UPGRADE_SPREAD,
	WARD_MS,
	WARNING_Z,
} from "./constants";
import { Dome } from "./entities/dome";
import { Hunter } from "./entities/hunter";
import { type Bomb, Raid } from "./entities/raid";
import {
	makeHalo,
	makeRock,
	type RockContacts,
	shapeRadius,
} from "./entities/rocks";
import { BlastFx, bonusRgb, iceRgb, shockRgb } from "./fx/blastFx";
import { buildSky, makeGlobe, type SkyLayer } from "./fx/scenery";
import {
	playAt,
	playBoost,
	playFire,
	playGameOver,
	playMultiplierUp,
	playOverheat,
	playShieldHit,
	playUpgrade,
	rumble,
	rumbleBetween,
	SFX,
} from "./fx/sfx";
import { GLOW_QUAD, makeBlankQuad, makeLaserTexture } from "./fx/textures";
import {
	advance,
	arcBetween,
	bridgeY,
	craftMatrix,
	dot,
	frameAt,
	fromView,
	nudge,
	onGlobe,
	randomSurfacePoint,
	type SurfaceFrame,
	sightlineClearance2,
	steerToward,
	stepToward,
	surfaceMatrixWorld,
	tangentToward,
	turn,
	turnBetween,
	viewBasis,
	viewOrigin,
	viewToSprite3d,
	viewToWorld,
	wrapAngle,
} from "./lib/sphereMath";
import { PauseMenu } from "./ui/pauseMenu";
import { WarningBanner } from "./ui/warningBanner";

/** what a rock is made of */
type RockKind = "rock" | "ice" | "bonus";

/** one drifting rock */
interface Drifter {
	frame: SurfaceFrame;
	model: Mesh;
	/** radians of arc per second */
	speed: number;
	/**
	 * A fixed per-rock phase offset, NOT a rotation rate.
	 *
	 * Only the bonus rocks read it, to stagger their pulse so a cluster does
	 * not breathe in unison. The rock's own turning is `spinPhase` below.
	 */
	spin: number;
	/**
	 * The rock's own turn about its surface normal, and how fast it grows.
	 *
	 * A YAW, not a free tumble, and the ground shadow is what decides that.
	 * A blob's footprint comes from columns 0 and 2 of the caster's model
	 * matrix with Y dropped (`renderable/mesh.js`), which only describes the
	 * caster if it is upright. Turning about a fixed world axis tips those
	 * columns out of the horizontal and the blob shrinks and skews with
	 * them; near a quarter turn one of them projects to almost nothing and
	 * the shadow collapses towards a line. Turning about the frame's own
	 * normal leaves column 1 exactly where it was, so the footprint stays
	 * honest and turns with the rock.
	 *
	 * Held SEPARATELY from the surface frame, and that is the part that
	 * fixes the flip. The frame's tangent is the direction of travel, which
	 * a bounce reverses by design, so a mesh oriented by the frame alone
	 * snapped round with it: measured at 145 degrees in one frame in play.
	 * `deflect` pays each turn of the heading into `spinPhase` instead, so
	 * the orientation that reaches the screen does not move on a bounce.
	 */
	spinPhase: number;
	spinRate: number;
	/** while this is running the rock does not home: it was just bounced */
	bounceMs: number;
	/** its own radius in world units, and the scene radius it is drawn at */
	radius: number;
	altitude: number;
	/** the altitude it is falling TO, and how much of the fall is left */
	restAltitude: number;
	entryMs: number;
	/** how big it is as a multiple of the base size, for the break-up */
	grade: number;
	/**
	 * What it is made of, which decides how it is lit, what it is worth,
	 * and what happens when the craft touches it: rock hurts, ice shatters,
	 * and the radioactive ones pay out when they are SHOT.
	 */
	kind: RockKind;
	/** bolts left in it, and what it started with */
	hp: number;
	hpMax: number;
	/** what is left of the hit flash, and the emission it is driving */
	flashMs: number;
	flashRgb: Float32Array;
	/** the glow it has when it is NOT flashing; ice has one, rock does not */
	baseEmissive: Float32Array | undefined;
	/** the soft disc behind it that gives it its rim, if it has one */
	/**
	 * Its collision shape, held directly rather than read back off the body
	 * every frame: this is the instance handed to `bodyDef`, and moving it is
	 * how the rock's ground track is put on the shared shell.
	 */
	hit: Sphere;
	halo: Sprite3d | undefined;
	/**
	 * The opacity the halo WANTS, before the globe is allowed a say.
	 *
	 * Kept apart from `halo.alpha` because two things drive it from different
	 * places: the radioactive pulse, in the update, and how much of the planet
	 * is in the way, at placement time once the camera is posed. Multiplying
	 * them needs both, and whichever ran second would otherwise erase the
	 * other.
	 */
	haloAlpha: number;
}

/** one bolt, travelling its own great circle */
/**
 * Everything one bolt draws with, built once and lent out per shot: the
 * streak, the pool of light it throws on the glass, and the shader clones
 * that shape both.
 */
interface BoltVisual {
	sprite: Sprite3d;
	quad: Mesh;
	glowFx: ShaderEffect;
	/** the streak's collision shape; see {@link Drifter.hit} */
	hit: Sphere;
}

interface Bolt {
	frame: SurfaceFrame;
	/** borrowed from the pool for as long as the bolt is alive */
	visual: BoltVisual;
	ageMs: number;
	/**
	 * Whether this bolt runs THROUGH what it hits, fixed at the muzzle.
	 *
	 * Read from the prize when the bolt is spawned rather than at the moment
	 * of impact, so a lance already in the air stays a lance when the window
	 * closes behind it. The alternative, asking the controller at impact,
	 * makes a shot change its nature in flight.
	 */
	pierces: boolean;
	/**
	 * Rocks, and the hunter, this bolt has already passed through.
	 *
	 * A lance overlaps the same rock for several frames, and collision is
	 * reported every one of them, so without this one shot takes a boulder's
	 * whole health bar in three frames. A bolt record is built per shot, so
	 * this starts empty without anything having to clear it.
	 */
	through: (Drifter | Hunter)[];
}

/** scratch for the saucer's bridged surface normal; never escapes the frame */
const _bridged = new Vector3d(0, 0, 0);
/** the same bridge applied to a heading, so the tangent matches the normal */
const _bridgedTan = new Vector3d(0, 0, 0);
/**
 * Local up, for a rotation read in a matrix's own space.
 *
 * `Matrix3d.rotate` post-multiplies, so this is not the world y axis: it is
 * whatever the matrix has put on its column 1, which for a surface frame is
 * the normal under the body. Shared and never written.
 */
const _LOCAL_UP = new Vector3d(0, 1, 0);
/** a rebuilt heading for `shove`; consumed by `deflect` before it returns */
const _shoveTo = new Vector3d(0, 0, 0);

/** scratch for `project`; never escapes the call that fills it */
const _at: [number, number, number] = [0, 0, 0];
/** where the camera stands this frame, before the pan is added */
const _origin: [number, number, number] = [0, 0, 0];

/** where the camera ended up this frame, kept while `_at` is reused */
const _camAt: [number, number, number] = [0, 0, 0];
/** scratch for `inView`; never escapes the call that fills it */
const _inViewAt = new Vector3d(0, 0, 0);
const _inViewXY = new Vector2d(0, 0);

/** scratch for the floor a rock's blob shadow lands on */
const _contact: [number, number, number] = [0, 0, 0];
const _shadowAt = new Vector3d();
const _shadowUp = new Vector3d();

/** scratch for projecting a kill into screen space */
const _popWorld = new Vector3d();
const _popScreen = new Vector2d();

/** a score number on its way from the kill to the readout */
interface ScorePop {
	label: Text;
	/** the flight, kept so a teardown can stop it rather than wait it out */
	flight: Tween;
}

/** the camera's own axes, as the engine's vectors, for `setBasis` */
const _camRight = new Vector3d();
const _camUp = new Vector3d();
const _camFwd = new Vector3d();
/** scratch for the orientation matrices; never escapes `placeWorld` */
const _mat = new Matrix3d();
/** and the damage vignette's, which the shader wants as 0..1 */
const _damageTint = new Color().parseCSS(DAMAGE_TINT);
const _damageRgb = new Float32Array(3);
/**
 * The radius the craft and the bolts COLLIDE at, as opposed to the one they
 * fly at.
 *
 * The rocks need no such thing and do not get one: a rock rests on the glass,
 * so its centre is exactly its own radius above it, and for any two rocks that
 * radial difference `|r1 - r2|` is always smaller than `r1 + r2`. Two rocks
 * whose ground tracks meet therefore always meet in 3D as well, and each rock
 * carries its collision sphere exactly where it is drawn. It is also the
 * truer answer: two balls resting on a sphere touch when their ground tracks
 * are `2 * sqrt(r1 * r2)` apart, not when they are `r1 + r2` apart, and that
 * is what their own spheres measure.
 *
 * The craft is the case that does not work out, and the bolts with it. The
 * craft flies a fifth of a planet radius above the glass so that a boulder can
 * pass UNDER it, which puts it 180 units above a pebble's centre while its own
 * collision radius is 23: a sphere test at true altitudes said the craft could
 * not be touched by anything smaller than a boulder, and a bolt could not
 * break a pebble, while both looked like direct hits. So those two collide on
 * a shell instead.
 *
 * Just above the glass, which is not arbitrary: a rock of radius `r` has its
 * centre `r + ROCK_CLEARANCE` above the glass, so a shape on THIS shell is
 * exactly `r` from it, and `r` is always within `r + hitRadius`. One shell
 * that reaches every rock size, from pebble to boulder. The figure itself is
 * `HIT_SHELL`, with the constants, because the hunter's shots land on the
 * same shell and that test has to be this test.
 */
const _hitShell = HIT_SHELL;

/**
 * Move a collision shape so it sits on the shared shell, given where its
 * renderable is drawn.
 *
 * The shape's own `pos` is an offset from the body, which is exactly the
 * lever needed here: the mesh stays at whatever altitude its size and the
 * fall put it at, and the thing that collides sits on one shared radius
 * with everything else. Without that, a sphere test at true altitudes
 * counts the gap between a craft flying above the field and a rock resting
 * on the glass as a reason they did not touch.
 * Written in SCENE coordinates, the same space the renderable and the
 * broadphase are in: placing the shapes in the planet's own frame instead
 * would leave the two halves of the pipeline reasoning about different
 * spaces, with the broadphase filing things by where they are drawn.
 * @param shape - the shape to move, the one handed to `bodyDef`
 * @param renderable - the body's owner, already placed for this frame
 * @param x - scene x of the point on the shell
 * @param y - scene y
 * @param z - scene depth
 */

const shapeToShell = (
	shape: Sphere,
	renderable: Renderable,
	x: number,
	y: number,
	z: number,
): void => {
	// three components, not `set(x, y)`: `pos` is a Vector3d and the
	// two-argument form writes a zero z, which would drop the shape to the
	// renderable's own depth and undo the whole point of this
	shape.pos.set(
		x - renderable.pos.x,
		y - renderable.pos.y,
		z - renderable.depth,
	);
};

/** the shell's colour, as the linear triple its shader wants */
const _shieldRgb = new Float32Array(3);
/** the shield's two ends, and the colour mixed between them each frame */
const _shieldFull = new Color().parseCSS(SHIELD_FULL_COLOR);
const _shieldEmpty = new Color().parseCSS(SHIELD_EMPTY_COLOR);
const _shieldColor = new Color();
const _heatCold = new Color().parseCSS(HEAT_COLD_COLOR);
const _heatHot = new Color().parseCSS(HEAT_HOT_COLOR);
/** the bar re-reads this every frame, so mutating it IS the colour ramp */
const _heatColor = new Color();
const _engineCool = new Color().parseCSS(ENGINE_CORE);
const _engineHot = new Color().parseCSS(ENGINE_HOT_COLOR);
/** the exhaust ribbon's cold end, and the scratch its heat ramp lands in */
const _trailCool = new Color().parseCSS("#ffffff");
const _trailColor = new Color();
const _engineColor = new Color();

/**
 * How much heat a block of ice takes out of the boost when flown through.
 *
 * Three bands, biggest to smallest. `grade` is continuous, so the bands are
 * where its two spawn ranges fall rather than three named sizes; see
 * {@link ICE_BOOST_BIG_GRADE}.
 * @param grade - the block's size, as a multiple of `ROCK_SCALE`
 * @returns heat to remove, on the same 0 to {@link HEAT_MAX} scale
 */
const iceBoostFor = (grade: number): number => {
	if (grade >= ICE_BOOST_BIG_GRADE) {
		return ICE_BOOST_BIG;
	}
	return grade >= ICE_BOOST_MID_GRADE ? ICE_BOOST_MID : ICE_BOOST_SMALL;
};

export class GameController extends Renderable {
	private app: Application;
	private camera: Camera3d;

	/** where the player is on the globe, and which way they face */
	private ship: SurfaceFrame = frameAt(new Vector3d(0.9228, 0.2301, 0.309));
	private shipMesh: Mesh;
	/** the globe, one mesh per terrain material */
	private planetParts: Mesh[] = [];
	/** bolt-on-bomb contacts, applied after the world walk */
	private pendingBombHits: { bolt: Bolt; bomb: Bomb }[] = [];
	/** a bomb the craft flew into, applied after the world walk */
	private pendingBombShipHit: Bomb | undefined;
	/** the glass, and everything that happens to it */
	private dome: Dome;
	/** the saucer and its bombs: the only thing that can end a run outright */
	private raid: Raid;
	/** the second enemy: it chases the player rather than the dome */
	private hunter: Hunter;
	/**
	 * The backdrop: nebula, stars and distant worlds.
	 *
	 * Each one keeps the position it was built at and the share of the
	 * camera slide it takes, worked out once from its depth. See
	 * {@link SKY_PARALLAX}.
	 */
	private sky: SkyLayer[] = [];
	/** current camera slide, damped toward what the player is asking for */
	private panX = 0;
	private panY = 0;
	/**
	 * How far the craft has turned away from the view, in radians.
	 *
	 * The view does not turn with it. `viewBasis` takes a frame's heading as
	 * screen up, so feeding it the ship would nail the ship's nose to the top
	 * of the screen and spin the whole globe underneath instead, which is the
	 * opposite of a craft banking round. The view is therefore given the
	 * ship's POSITION with a heading that is only ever carried along, never
	 * turned, and this is the angle between the two: everything the turn keys
	 * have ever asked for, and exactly what the model is rotated by on screen.
	 */
	private yaw = 0;
	/** the craft's lean, damped toward what the controls are asking for */
	private bank = 0;
	private pitch = 0;
	private drifters: Drifter[] = [];
	private bolts: Bolt[] = [];
	/** the exhaust plume and the light it casts, and the thrust behind both */
	private engine: Sprite3d;
	/** the streak behind the plume; see `ENGINE_TRAIL_POINTS` */
	private exhaust: Trail3d;
	private engineLight: Light3d;
	/** the key light, whose direction is stated in the camera's frame */
	private sun: Light3d;
	private thrust = 0;
	/** engine heat, 0 cold to 1 at the redline */
	private heat = 0;
	/** ms since the boost key was last down, against HEAT_COOL_DELAY_MS */
	private sinceBoostMs = HEAT_COOL_DELAY_MS;
	/** true from the moment heat tops out until it has cooled to HEAT_RESUME */
	private overheated = false;
	/** whether the boost breath is currently sounding, so it starts once */
	private boostAudible = false;
	private heatBar!: ProgressBar;
	private heatLabel!: Text;
	private hudBest!: Text;
	private hudPrize: Text;
	/** the HUD container, kept so a score popup can be put into it */
	private hudLayer!: Container;
	/**
	 * The raid warning currently crossing the screen, if one is.
	 *
	 * Held only to stop a second raid stacking a banner on top of the first;
	 * the banner takes itself away when its word has gone.
	 */
	private warning?: WarningBanner;
	/** score numbers currently flying to the readout */
	private pops: ScorePop[] = [];
	private overLabel!: Text;
	private overHint!: Text;
	/**
	 * The engine's save store, with this game's key registered on it.
	 *
	 * `add` seeds the default on a first run and loads whatever was stored on
	 * every one after, so this single call is both the registration and the
	 * read. It returns `this & T`, so the key is typed from here on and the
	 * store needs no cast to index.
	 */
	private readonly store = save.add({ [BEST_SAVE_KEY]: 0 });
	/** the best score across runs, mirrored from the store */
	private best = 0;
	/** counts down while NEW BEST is lit, then the label settles to the number */
	private newBestMs = 0;
	/** whether this run has already announced beating the best */
	private beatenThisRun = false;
	/**
	 * True until the select key held at the moment of death is released.
	 *
	 * Stops the fire button the player was holding from throwing them back
	 * to the menu on the frame GAME OVER appears.
	 */
	private overSelectHeld = true;
	/** the channel split when the shield gives out, and what is left of it */
	private aberration: ChromaticAberrationEffect;
	/** the aberration pulse in flight, kept so a new hit can restart it */
	private aberrationTween: Tween | undefined;
	/**
	 * The two game-over flourishes, kept for the same reason.
	 *
	 * They were locals, and a tween only unsubscribes on `stop()`, on
	 * completion, or on `GAME_RESET`. Leaving for the menu inside the ~1s
	 * they run for would otherwise leave them writing into a stage that no
	 * longer exists, so `destroy()` stops them.
	 */
	private stampTween: Tween | undefined;
	private hintTween: Tween | undefined;
	/** what the pulse drives, read by the tween's `onUpdate` */
	private readonly aberrationDriver = { k: 0 };
	/** everything an explosion throws off; see `blastFx.ts` */
	private blast: BlastFx;
	/** the frame going red at the edges as the shield goes */
	private damage: Sprite;
	/** idle bolt visuals, waiting for a shot to borrow one */
	private boltPool: BoltVisual[] = [];
	/** seconds since the scene started, for the pools' own shader clock */
	private clock = 0;
	/** every drifter by its renderable, to read a reported contact back */
	private byModel = new Map<Renderable, Drifter>();
	/**
	 * Contacts the engine reported during its own update walk, waiting to be
	 * applied. See {@link GameController.drainHits} for why they wait.
	 */
	private pendingBoltHits: { bolt: Bolt; rock: Drifter }[] = [];
	/**
	 * Everything the craft touched this frame, not just the first of them.
	 *
	 * A single slot dropped every contact after the first, and
	 * `onCollisionStart` is an ENTRY event that never fires again while the
	 * pair stays overlapped, so a dropped contact was gone for good: clip a
	 * rock and a block of ice in the same frame and the craft sailed through
	 * the ice, which survived and paid nothing.
	 */
	private pendingShipHits: Drifter[] = [];
	/**
	 * Work queued to run later, in GAME time.
	 *
	 * The hunter's death is staged over a quarter of a second and the hunter
	 * itself is gone before the last beat lands, so the beats cannot belong
	 * to it. They are queued here instead, where they are ticked by the same
	 * clock as everything else: a `setTimeout` would keep running through a
	 * hit freeze, through a pause, and past the end of the run.
	 */
	private deferred: { ms: number; run: () => void }[] = [];
	/**
	 * The craft's collision shape; see {@link Drifter.hit}.
	 *
	 * Sized to the SHIELD BUBBLE rather than the hull, so a rock bounces off
	 * the shell the player can see rather than passing through it to reach
	 * the ship inside.
	 */
	private shipHit = new Sphere(0, 0, 0, SHIP_SHIELD_RADIUS);
	/** whether the engine is actually giving boost, not whether it was asked for */
	private boosting = false;

	/**
	 * How fast the craft is travelling right now, radians a second.
	 *
	 * Stated once because two things need it and they must agree: the craft's
	 * own advance, and the hunter asking where the craft will be so it can
	 * lead its shots. A second copy of this expression would drift the moment
	 * anything else changed the speed.
	 */
	private shipSpeed(): number {
		return this.boosting ? SHIP_SPEED + SHIP_SPEED_BOOST : SHIP_SPEED;
	}

	private boltTexture: HTMLCanvasElement;
	private fireCooldownMs = 0;
	/** how much of the radioactive rock's spread gun is left, ms */
	private upgradeMs = 0;
	/**
	 * The banner's lines, rebuilt in place.
	 *
	 * Reused rather than reallocated each refresh, which `Text#setText` makes
	 * safe: it copies what it is handed (`value.slice()`) instead of keeping
	 * the reference, and compares by CONTENT, so the same array handed back
	 * with different strings in it still updates.
	 */
	private readonly prizeLines: string[] = [];
	/** what is left of the lance prize, milliseconds */
	private pierceMs = 0;
	/** what is left of the score multiplier prize, milliseconds */
	private scoreMultMs = 0;
	/** the prize total the banner is currently showing, in tenths; -1 = nothing */
	private prizeTenthsShown = -1;
	/** the factor that prize rolled, meaningless while `scoreMultMs` is 0 */
	private scoreMult = 1;
	/**
	 * Hit freeze left to run, ms.
	 *
	 * While this is above zero the frame still DRAWS and every effect still
	 * moves, and only the fight is held: see the gate in `update`.
	 */
	private freezeMs = 0;
	/** the pause overlay while one is up, and the app it was added to */
	private pause: PauseMenu | undefined;
	/**
	 * Whether the pause key is still held from the press that opened it.
	 *
	 * The same guard the game-over screen keeps: `isKeyPressed` reports a key
	 * for as long as it is down, so without this the frame after a resume
	 * would read the same held key and pause again immediately.
	 */
	private pauseHeld = false;
	/** whether the prize banner currently has anything on it */
	private prizeShown = false;
	private spawnTimerMs = ROCK_SPAWN_INTERVAL_MS;
	private invulnMs = 0;

	private score = 0;
	/** 1 is a full shield, 0 is one impact from the end of the run */
	private shield = SHIELD_MAX;
	/** since the last impact, for the regeneration delay */
	private sinceHitMs = SHIELD_REGEN_DELAY_MS;
	/** how much of the impact flash is left on the bubble */
	/** the shield-impact flash in flight, stopped if another hit lands */
	private flashTween: Tween | undefined;
	/** 1 at the moment of impact, eased to 0; read straight into the uniform */
	private readonly flashDriver = { k: 0 };
	private streak = 0;
	private gameOver = false;

	private hudScore: Text;
	/** the bubble around the craft, and the readout for it */
	private shieldBubble: Sprite3d;
	/** the soft ring past the limb; pinned to the view like the craft */
	private airShell!: Sprite3d;
	private shieldFx: ShaderEffect;
	/**
	 * The shield readout.
	 *
	 * One `ProgressBar` rather than a track quad and a fill quad. Two
	 * renderables at the same corner have to be told which is in front, and
	 * the pair this replaces worked around that by making the track a hollow
	 * frame so the question could not come up. A bar draws its own track and
	 * fill in one `draw`, in order, so it cannot come up either way.
	 */
	private shieldBar: ProgressBar;
	private shieldLabel: Text;
	private hudMultiplier: Text;

	/**
	 * @param app - the application
	 * @param sun - the key light the scene is lit by
	 * @param camera - the stage's camera. HANDED IN rather than read back
	 * from `app.viewport`, which is the active stage's camera and so is
	 * typed `Camera2d`; the stage that built this owns the real one.
	 */
	constructor(app: Application, sun: Light3d, camera: Camera3d) {
		super(0, 0, 1, 1);
		this.sun = sun;
		this.app = app;
		this.camera = camera;
		this.alwaysUpdate = true;
		this.boltTexture = makeLaserTexture(
			LASER_TEX_W,
			LASER_TEX_H,
			LASER_CORE,
			LASER_EDGE,
		);
		this.initBoltPool();
		this.blast = new BlastFx(app);
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		// The dome, and the five things it reaches back for. Written out as an
		// object literal rather than handing it `this`: what the glass depends
		// on is then visible here, and anything added to it has to be argued
		// for rather than slipped in.
		this.dome = new Dome(app, {
			blast: this.blast,
			get gameOver() {
				return self.gameOver;
			},
			pulseAberration: () => {
				this.pulseAberration();
			},
			refreshHud: () => {
				this.refreshHud();
			},
			endRun: () => {
				this.gameOver = true;
				this.stampGameOver();
			},
		});

		// The damage vignette: a screen-space quad with a painted gradient,
		// clear in the middle and red at the corners, whose opacity is the
		// only thing that changes. Floating, so it is drawn in screen space
		// over everything the 3D camera has just put down.
		this.damage = new Sprite(0, 0, {
			image: makeBlankQuad(DAMAGE_TEX),
		});
		this.damage.anchorPoint.set(0, 0);
		this.damage.floating = true;
		this.damage.blendMode = "additive";
		this.damage.setOpacity(0);
		this.damage.scale(
			app.renderer.width / DAMAGE_TEX,
			app.renderer.height / DAMAGE_TEX,
		);
		// The gradient is generated per fragment rather than baked, so the
		// quad's texture is blank and nothing has to be repainted when the
		// window changes size. See `impact.ts` for why it is hosted HERE and
		// not on the viewport.
		const damageFx = loader.getShader(DAMAGE_SHADER) as ShaderEffect;
		_damageRgb[0] = _damageTint.r / 255;
		_damageRgb[1] = _damageTint.g / 255;
		_damageRgb[2] = _damageTint.b / 255;
		damageFx.setUniform("uColor", _damageRgb);
		this.damage.addPostEffect(damageFx);
		app.world.addChild(this.damage, 9_500);

		// ── the globe ────────────────────────────────────────────────
		// The Earth, modelled in Blender and loaded as a GLB: an icosphere
		// whose land faces are raised against a coarse continent mask and
		// split across ocean, shelf, grass, forest, desert, rock, snow and
		// polar ice — seven primitives, one per material.
		//
		// It never moves. The camera is posed from the player's own surface
		// point, so the centre stays at `PLANET_Z` for the whole session and
		// the player orbits it rather than it turning underneath them.
		//
		// Built as one plain `Mesh` PER PRIMITIVE rather than as a
		// `GLTFModel`. The loader already flattens a multi-material model
		// into a node per primitive, each with its own geometry and base
		// colour, which is the same shape the rocks and the saucer are built
		// from and places through `pos`/`depth` like everything else here.
		// (`GLTFModel` is a container for an animated rig, and this has no
		// rig; it places by `pos`/`depth` too, so that part is no longer the
		// distinction it once was.)
		//
		// `scale` is the radius, and the same scale goes on the shell, which
		// is why the shell keeps the clearance it was authored with instead
		// of being renormalised to its own extent.
		this.planetParts = makeGlobe(EARTH_MODEL, PLANET_R, {
			specular: TERRAIN_SPECULAR,
			shininess: TERRAIN_SHININESS,
			glassSpecular: TERRAIN_SPECULAR,
			glassShininess: TERRAIN_SHININESS,
		});
		for (const part of this.planetParts) {
			app.world.addChild(part, PLANET_Z);
		}
		// The shell sits at the same centre; its own clearance is authored
		// into the model, so it takes the identical scale.
		// The frustum has to reach the backdrop before anything is put in it.
		// `Camera3d` clips at 1000 by default, and this scene puts the globe's
		// far side past 1900 and the stars at seven times that. Set from here
		// rather than at boot: a stage change resets the camera, so clip
		// planes written before `state.change` are quietly restored.
		this.camera.setClipPlanes(1, SKY_Z + 8000);
		this.sky = buildSky(app);
		this.dome.domeParts = makeGlobe(DOME_MODEL, PLANET_R, {
			specular: FRAME_SPECULAR,
			shininess: FRAME_SHININESS,
			glassSpecular: GLASS_SPECULAR,
			glassShininess: GLASS_SHININESS,
		});
		for (const part of this.dome.domeParts) {
			app.world.addChild(part, PLANET_Z);
		}
		this.dome.initPanes();
		// The raid, and the eleven things it reaches back for. Same shape as
		// the dome's above, and written out for the same reason.
		this.raid = new Raid(app, {
			blast: this.blast,
			dome: this.dome,
			camera: this.camera,
			sun: this.sun,
			// A GETTER, not `this.ship.pos`. `turn`, `advance` and `nudge`
			// each hand back a NEW frame, so a value captured here would pin
			// every raid to wherever the craft stood when the scene loaded.
			get shipPos() {
				return self.ship.pos;
			},
			viewHeading: () => this.viewFrame().heading,
			warnOfRaid: () => {
				this.warnOfRaid();
			},
			layShadow: (mesh, q) => {
				this.layShadow(mesh, q);
			},
			bombTouched: (bomb, other) => {
				if (other === this.shipMesh) {
					// queued like the rocks': this runs inside the world's own
					// update walk, and the response tears renderables out of it
					this.pendingBombShipHit ??= bomb;
					return;
				}
				const bolt = this.bolts.find((b) => b.visual.sprite === other);
				if (bolt !== undefined) {
					this.pendingBombHits.push({ bolt, bomb });
				}
			},
			award: (x, y, z, base) => {
				const points = base * this.multiplier;
				this.score += points;
				this.flyScore(x, y, z, points);
				// the HUD is event-driven, not polled: without this the score
				// sits at its old value until the next rock dies
				this.refreshHud();
			},
			freeze: (ms) => {
				this.freezeMs = ms;
			},
			pulseAberration: () => {
				this.pulseAberration();
			},
		});

		// The hunter. Seven members where the raid needs eleven: somewhere to
		// put its wreck, the key light, where the player is and which way the
		// view faces, the shield path its shots land on, and a way to pay for
		// its own death.
		this.hunter = new Hunter(app, {
			blast: this.blast,
			sun: this.sun,
			shipPos: () => this.ship.pos,
			// the craft's own speed is read here rather than by the caller, so
			// the boost and the overheat lockout are already in it
			shipAfter: (seconds) =>
				advance(this.ship, this.shipSpeed() * seconds).pos,
			// Two tests, because being drawn needs both: inside the frame,
			// and not behind the glass. Both are taken from the REAL camera
			// position, which pans, rather than from the craft.
			inView: (at, alt) => {
				onGlobe(at, alt, PLANET_Z, _at);
				_inViewAt.set(_at[0], _at[1], _at[2]);
				const screen = this.camera.worldToScreen(_inViewAt, _inViewXY);
				if (
					screen === null ||
					screen.x < -HUNTER_UNSEEN_MARGIN ||
					screen.y < -HUNTER_UNSEEN_MARGIN ||
					screen.x > this.camera.width + HUNTER_UNSEEN_MARGIN ||
					screen.y > this.camera.height + HUNTER_UNSEEN_MARGIN
				) {
					return false;
				}
				return (
					sightlineClearance2(
						_camAt[0],
						_camAt[1],
						_camAt[2] - PLANET_Z,
						_at[0],
						_at[1],
						_at[2] - PLANET_Z,
					) >
					DOME_R * DOME_R
				);
			},
			// the view's heading and not the craft's, for the reason the raid
			// gives: its streaks are turned to face where they go ON SCREEN,
			// and the two part company whenever the view swings
			viewHeading: () => this.viewFrame().heading,
			// A frame behind: the camera is posed further down this same
			// update, after the hunter has ticked. The shell it feeds is
			// lifted one hull along this line of sight, and a camera that has
			// moved a single frame's worth tilts that line by far less than
			// the shell's own size.
			eye: () => _camAt,
			// Its bolts hit the sky, not just the player. Bombs first: one
			// bolt cannot be spent on a bomb and a rock in the same frame,
			// which is the rule the player's own bolts follow in `drainHits`.
			strike: (at, radius) => {
				for (const bomb of this.raid.bombs) {
					if (
						bomb.live &&
						arcBetween(at, bomb.at) * _hitShell < BOMB_HIT_RADIUS + radius
					) {
						this.raid.defuse(bomb);
						return true;
					}
				}
				for (const rock of this.drifters) {
					if (
						arcBetween(at, rock.frame.pos) * rock.altitude <
						rock.radius + radius
					) {
						// The same damage the player's gun does, scoring and
						// all. Letting the hunter clear a rock for nothing
						// would make its stray fire a quiet tax on the
						// player's score instead of an opportunity.
						this.breakRockWithBolt(rock);
						return true;
					}
				}
				return false;
			},
			// Shell on shell: the craft is pushed off too, and neither is
			// damaged. `nudge` and not `advance`, because the craft keeps
			// pointing wherever the player left it; being spun round by a
			// collision is the one thing worse than being stopped by one.
			after: (ms, run) => {
				this.deferred.push({ ms, run });
			},
			bounce: (from) => {
				const away = tangentToward(this.ship.pos, from);
				if (away.x !== 0 || away.y !== 0 || away.z !== 0) {
					this.ship = nudge(this.ship, away, -SHIP_BOUNCE_ARC);
				}
				// and the player's own shell flares, the same as the
				// hunter's, so the contact reads from both sides
				this.pulseShieldFlash();
			},
			// Its shots go through the run's OWN shield path, the same one a
			// rock takes. A bolt that spelled out the freeze, the sound and
			// the drain itself would drift from the rock that does the same
			// job the moment either is touched.
			onShot: (at) => {
				// The IMPACT, which the shared path above does not carry: a
				// rock's burst, shake and ring all live in the rock's own
				// handler, so without this a bolt landing was a number
				// changing in the corner and nothing else.
				onGlobe(at, CRAFT_ALT, PLANET_Z, _at);
				this.blast.burst(
					_at[0],
					_at[1],
					_at[2],
					SHIELD_FULL_COLOR,
					BOLT_IMPACT_BURST,
					at,
					BURST_SPEED,
					BURST_LIFE,
					SHIP_HIT_RADIUS * BURST_AREA_SCALE,
				);
				this.blast.flash(
					_at[0],
					_at[1],
					_at[2],
					this.shield > 0 ? SHIELD_FULL_COLOR : SHIELD_EMPTY_COLOR,
					FLASH_SHIELD_INTENSITY,
					FLASH_SHIELD_RANGE,
					FLASH_SHIELD_MS,
				);
				this.blast.ripple(this.ship.pos);
				this.camera.shake(BOLT_IMPACT_SHAKE, BOLT_IMPACT_SHAKE_MS);
				// and the bubble itself flares, the same flare the hunter's
				// own shell gives when the player lands one on it
				this.pulseShieldFlash();
				this.takeShieldHit();
			},
			vulnerable: () => !this.gameOver && this.invulnMs <= 0,
			award: (x, y, z, base) => {
				const points = base * this.multiplier;
				this.score += points;
				this.flyScore(x, y, z, points);
				this.streak += 1;
				this.refreshHud();
			},
		});
		// The ear travels with the view, orientation included. HERE and not in
		// the raid: every placed sound in the game is positioned against this
		// listener, and it only ever lived in the saucer's setup because the
		// drone was the first sound that needed one.
		audio.setListener(this.camera);

		// The air, behind everything: a billboard at the planet's centre,
		// larger than the shell, which the planet and the shell then occlude
		// the middle of. What is left is the ring past the limb.
		// `Sprite3d` with a spherical billboard, not a plain `Sprite`: a 2D
		// sprite only faces the camera while the camera is axis aligned, and
		// this one is posed from the player's surface frame. `transparent: true`
		// because every one of these is additive or soft edged: left unset, a
		// mesh only goes transparent when its draw ALPHA is fractional, so one
		// at full opacity stays in the opaque pass and its soft texels come
		// out black.
		const air = new Sprite3d(0, 0, {
			image: makeBlankQuad(ATM_TEX),
			width: ATM_RADIUS * 2,
			height: ATM_RADIUS * 2,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		air.pos.set(0, 0);
		// a hair further than the planet's centre, so the transparent pass
		// puts the shell in front of the air rather than the other way round
		air.depth = PLANET_Z + 6;
		air.blendMode = "additive";
		const airFx = (loader.getShader(ATM_SHADER) as ShaderEffect).clone();
		airFx.setUniform("uInner", ATM_INNER);
		airFx.setUniform("uFalloff", ATM_FALLOFF);
		airFx.setUniform("uExposure", ATM_EXPOSURE);
		airFx.setUniform("uSun", new Float32Array(ATM_SUN));
		const airTint = new Color().parseCSS(ATM_TINT);
		airFx.setUniform(
			"uColor",
			new Float32Array([airTint.r / 255, airTint.g / 255, airTint.b / 255]),
		);
		air.addPostEffect(airFx);
		app.world.addChild(air, PLANET_Z + 6);
		this.airShell = air;

		// ── the ship ─────────────────────────────────────────────────
		// It never moves either. The player's own surface normal is what
		// the view is built around, so the ship projects to the same
		// point every frame: dead centre, at the near pole.
		// The craft casts too, and it is the one caster high enough for the
		// height fade to read as altitude rather than as contact.
		this.shipMesh = new Mesh(0, 0, {
			model: SHIP_MODEL,
			material: SHIP_MODEL,
			width: SHIP_SIZE,
			height: SHIP_SIZE,
			lit: true,
			cullBackFaces: true,
			// NOT `rightHanded`, unlike the globe and the rocks. It negates Z
			// as well as Y, which reverses the triangle winding, and with
			// back-face culling on that renders the craft inside out: it
			// disappears at most angles. The reflection it would have fixed
			// is handled by the signs in `applyShipAttitude` instead.
			specular: SHIP_SPECULAR,
			shininess: SHIP_SHININESS,
		});
		this.shipMesh.pos.set(0, 0);
		this.shipMesh.castGroundShadow = true;
		this.shipMesh.shadowScale = SHIP_SHADOW_SCALE;
		this.shipMesh.shadowOpacity = SHIP_SHADOW_OPACITY;
		this.shipMesh.shadowLight = this.sun;
		this.shipMesh.shadowOffset = SHIP_SHADOW_THROW;
		this.shipMesh.isKinematic = false;
		this.shipMesh.bodyDef = {
			type: "dynamic",
			gravityScale: 0,
			shapes: [this.shipHit],
			isSensor: true,
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.ENEMY_OBJECT,
		};
		app.world.addChild(this.shipMesh, SHIP_VIEW_Z);

		// The shield itself, as a billboard around the craft. It sits a
		// hair NEARER the camera than the craft so it draws over it: the
		// craft is inside the bubble, and a shell that the nose pokes
		// through is not a shell.
		//
		// The quad is blank. Everything the shell looks like is generated
		// per fragment by its own shader, which is why it can have a clear
		// middle and a bright edge at the same time. See `shield.ts`.
		this.shieldBubble = new Sprite3d(0, 0, {
			image: makeBlankQuad(SHIELD_BUBBLE_TEX),
			width: SHIP_SIZE * SHIELD_BUBBLE_SCALE,
			height: SHIP_SIZE * SHIELD_BUBBLE_SCALE,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		this.shieldBubble.blendMode = "additive";
		this.shieldBubble.pos.set(0, 0);
		this.shieldFx = (loader.getShader(SHIELD_SHADER) as ShaderEffect).clone();
		this.shieldFx.setUniform("uExposure", SHIELD_EXPOSURE);
		this.shieldFx.setUniform("uImpact", 0);
		this.shieldBubble.addPostEffect(this.shieldFx);
		app.world.addChild(this.shieldBubble, SHIP_VIEW_Z - SHIP_SIZE);

		// The exhaust. Behind the craft rather than parented to it: the craft
		// is a mesh turned by a matrix and this is a billboard, so it is
		// easier to place both from the same angle than to hang one off the
		// other.
		// billboard OFF: this one is turned to point down the craft's tail,
		// and a billboard takes its orientation from the camera, which means
		// `currentTransform` is not applied at all. It gets the camera's
		// rotation prepended by hand instead, in `placeWorld`.
		this.engine = new Sprite3d(0, 0, {
			image: makeLaserTexture(
				ENGINE_TEX_W,
				ENGINE_TEX_H,
				ENGINE_CORE,
				ENGINE_EDGE,
			),
			width: ENGINE_TEX_W,
			height: ENGINE_TEX_H,
			billboard: false,
			transparent: true,
			alphaCutoff: 0,
		});
		this.engine.blendMode = "additive";
		this.engine.setOpacity(0);
		app.world.addChild(this.engine, SHIP_VIEW_Z + 1);
		this.engineLight = new Light3d({
			type: "point",
			intensity: 0,
			range: ENGINE_LIGHT_RANGE,
			color: ENGINE_LIGHT_COLOR,
		});
		app.world.addChild(this.engineLight);

		// The streak, laid down in WORLD space behind the craft. `target` is
		// the craft's own mesh, which `placeWorld` already positions in the
		// scene, so there is no placement code here at all: the ribbon
		// samples where the craft IS.
		this.exhaust = new Trail3d(0, 0, {
			// NO `target`. Following the craft would emit from its centre,
			// which puts the widest part of the ribbon under the hull: the
			// head is laid where the craft IS, and at full boost it is wide
			// enough to swallow the ship. Points are fed by hand from the
			// NOZZLE instead, which `placeWorld` already computes for the
			// plume, so the ribbon starts where the flame does.
			length: ENGINE_TRAIL_POINTS,
			lifetime: ENGINE_TRAIL_LIFETIME,
			minDistance: ENGINE_TRAIL_STEP,
			width: ENGINE_TRAIL_WIDTH,
			// Narrow at the head, widest a little behind it, then away. A
			// curve that starts at 1 is a bar cut off square at the nozzle;
			// this one reads as something leaving the engine.
			widthCurve: [0.35, 1, 0.6, 0],
			// White, so the heat tint below has a neutral thing to multiply:
			// a coloured ribbon tinted red comes out muddy.
			gradient: [...ENGINE_TRAIL_GRADIENT],
		});
		this.exhaust.blendMode = "additive";
		// No z argument: a `Trail3d` derives its own position from its
		// points, so one passed here would be overwritten on the next frame.
		app.world.addChild(this.exhaust);

		// and the channel split for when the shield gives out, off until it
		// does. Never removed, since removing destroys it.
		this.aberration = new ChromaticAberrationEffect(app.renderer, {
			offset: 0,
			textureSize: [app.renderer.width, app.renderer.height],
		});
		this.aberration.enabled = false;
		app.viewport.addPostEffect(this.aberration);

		for (let i = 0; i < ROCK_START_COUNT; i++) {
			this.spawnDrifter();
		}

		// ── the HUD ──────────────────────────────────────────────────
		// `floating = true` is the whole trick: the renderable is drawn in
		// screen space while everything above it is drawn through the 3D
		// camera, in the same world and the same frame.
		const { width, height } = app.renderer;

		// One container for the whole readout. Nothing grades it: this camera
		// carries no tone curve, so a label authored at display white still
		// arrives at display white, exactly as it did before this scene had
		// any HDR in it.
		const hud = new Container(0, 0, width, height);
		hud.floating = true;
		hud.name = "hud";
		// A SMALL depth, not a large one. The world sorts on `"depth"`, as every
		// `Camera3d` scene does, where a floating child is ranked by `pos.z`
		// SQUARED and the smaller magnitude draws on top. At 10000 the HUD was
		// the furthest thing in the scene and drew first, behind the globe.
		// Nothing showed it while every label sat in a corner the planet never
		// reaches; a full-width GAME OVER banner put half its letters behind
		// the Earth.
		app.world.addChild(hud, 1);
		this.hudLayer = hud;

		/** put one HUD element into the container */
		const addHud = (element: Renderable, z = 0) => {
			hud.addChild(element, z);
		};
		this.hudScore = this.makeLabel(24, 18, "left", "#ffd98a");
		// Under the live score and dimmer than it: the best is the target, not
		// the thing being played, and a second bright number beside the first
		// is two things competing for the same glance.
		this.hudBest = this.makeLabel(24, 48, "left", BEST_COLOR, 18);

		// GAME OVER, sized to span the viewport.
		//
		// `Text` is canvas-baked at its FONT SIZE, so the size has to be found
		// rather than faked with a transform: a small bake scaled up to fill
		// the screen is blurry, and it would be blurry AT REST, which is where
		// it spends all its time. So measure a throwaway bake and build the
		// real label at the size that lands on the target width, leaving the
		// stamp to animate a transform down to exactly 1, where the softness
		// reads as speed rather than as a fault.
		//
		// Built through `makeLabel` twice rather than by assigning a size,
		// because the neon ramp is baked for one line height and has to be
		// rebuilt with it, and `Text.fillStyle` is typed `Color` even though
		// the constructor takes the `Gradient` this needs.
		// Measured on a label that ALREADY EXISTS, through `Text#measureText`,
		// which is documented for exactly this: a string the label does not
		// currently hold.
		//
		// It used to build a throwaway label at 64 point, bake a canvas and
		// a gradient into it, read the width and drop it — and `destroy()`
		// is `@internal`, so a game cannot free one it owns. This
		// constructor runs on EVERY entry to `state.PLAY`, so each trip
		// through the menu stranded another 64pt bake and its GPU texture.
		//
		// Advance widths scale linearly with the point size for one family,
		// so measuring at the HUD's size and scaling is exact, and costs
		// nothing: `hudScore` is built twenty lines up.
		const BASE_SIZE = this.hudScore.fontSize;
		const baseWidth = this.hudScore.measureText("GAME OVER").width;
		const overSize =
			baseWidth > 0
				? Math.round(BASE_SIZE * ((width * OVER_WIDTH_RATIO) / baseWidth))
				: 64;
		this.overLabel = this.makeLabel(
			width / 2,
			height / 2,
			"center",
			OVER_COLOR,
			overSize,
		);
		this.overLabel.textBaseline = "middle";
		this.overLabel.setText("GAME OVER");
		this.overLabel.setOpacity(0);
		addHud(this.overLabel, 90);

		this.overHint = this.makeLabel(
			width / 2,
			height / 2 + 72,
			"center",
			OVER_HINT_COLOR,
			22,
		);
		this.overHint.textBaseline = "middle";
		this.overHint.setText("SPACE OR ENTER FOR MENU");
		this.overHint.setOpacity(0);
		addHud(this.overHint, 90);
		this.best = this.store[BEST_SAVE_KEY];
		this.hudMultiplier = this.makeLabel(width / 2, 18, "center", "#7fe9ff");
		// Under the score and the best, not under the multiplier where it
		// belongs by meaning. The middle of the top edge is over the planet's
		// lit limb, and an additive label on 18 point is simply not readable
		// there; the left column is dark sky for the whole run.
		this.hudPrize = this.makeLabel(24, 78, "left", PRIZE_COLOR, 18);
		addHud(this.hudScore);
		addHud(this.hudPrize);
		addHud(this.hudBest);
		addHud(this.hudMultiplier);

		// The shield readout: one `ProgressBar`, hollow, so the sky shows
		// through the part that has drained and the frame is the only chrome.
		const barX = width - 24 - SHIELD_BAR_W;
		this.shieldLabel = this.makeLabel(barX, 14, "left", "#9fd7ff", 18);
		this.shieldLabel.setText("SHIELD");
		this.shieldBar = new ProgressBar(barX, 40, {
			width: SHIELD_BAR_W,
			height: SHIELD_BAR_H,
			// hollow, so the frame is the only chrome and the sky shows
			// through the part of the bar that has drained
			trackColor: null,
			borderColor: SHIELD_BAR_FRAME,
			// 2 and not 1, and that is not cosmetic. A rounded border has to
			// be stroked, and the renderers only expand a stroke into
			// triangles ABOVE a line width of 1: at exactly 1 the path goes
			// out as native GL_LINES, which rasterises each segment on its
			// own and drops the shared fragment where two meet, so the border
			// loses a pixel at each arc and loses it asymmetrically between
			// the top and the bottom. A square border is immune, because the
			// bar draws that as four fills.
			borderWidth: 2,
			padding: 2,
			radius: SHIELD_BAR_RADIUS,
			// The `Color` the rest of the shield already mixes, handed over
			// rather than copied: a bar re-reads `fillColor` every frame, so
			// mutating this one is the whole of the value-driven colour. It
			// has to stay the SAME object, because the bubble's shader uniform
			// is fed from it too and the two must agree.
			fillColor: _shieldColor,
		});
		this.shieldBar.floating = true;
		addHud(this.shieldLabel);
		addHud(this.shieldBar);

		// The engine heat, directly under the shield and deliberately the
		// other way round: this one FILLS as it gets worse. Two bars that both
		// drained would read as the same thing twice at a glance, which is the
		// only glance either of them gets while the player is flying.
		// Labelled, because an unlabelled second bar under a labelled first one
		// reads as part of the shield rather than as its own thing. Smaller
		// than SHIELD: this is the secondary gauge and the eye should land on
		// the one that ends the run first.
		this.heatLabel = this.makeLabel(
			barX,
			40 + SHIELD_BAR_H + 9,
			"left",
			HEAT_COLD_COLOR,
			15,
		);
		this.heatLabel.setText("BOOST");
		this.heatBar = new ProgressBar(barX, 40 + SHIELD_BAR_H + 34, {
			width: SHIELD_BAR_W,
			height: HEAT_BAR_H,
			// a track here, unlike the shield: an EMPTY heat bar is the good
			// state, so it needs an outline to read as a gauge at all rather
			// than as an empty frame the player has to interpret
			trackColor: "rgba(10, 20, 30, 0.45)",
			borderColor: HEAT_BAR_FRAME,
			borderWidth: 2,
			padding: 2,
			radius: SHIELD_BAR_RADIUS,
			// same arrangement the shield uses: the bar re-reads this every
			// frame, so the ramp is a matter of mutating it in `tickHeat`
			fillColor: _heatColor,
		});
		this.heatBar.floating = true;
		addHud(this.heatLabel);
		addHud(this.heatBar);
		this.refreshHud();
	}

	/**
	 * One screen-space label.
	 * @param x - screen x
	 * @param y - screen y
	 * @param align - horizontal alignment
	 * @param color - CSS fill
	 */
	private makeLabel(
		x: number,
		y: number,
		align: "left" | "center" | "right",
		color: string,
		size = 26,
	): Text {
		const label = new Text(x, y, {
			font: HUD_FONT,
			size,
			// A vertical ramp rather than a flat colour: `Text.fillStyle`
			// takes a `Gradient`, and its coordinates are the label's OWN
			// bake, so the ramp runs down each glyph wherever the label sits.
			fillStyle: this.neonRamp(size, color),
			textAlign: align,
			textBaseline: "top",
			text: "",
		});
		label.floating = true;
		// The camera's glow pass blooms whatever is brightest, so a hot white
		// top to the ramp is what makes the letters read as lit rather than
		// merely coloured.
		label.blendMode = "additive";
		return label;
	}

	/**
	 * A neon ramp the height of one line: hot at the top, saturated through
	 * the middle, dropping to a dark edge that reads as the tube's shadow.
	 * @param lineHeight - the label's font size, which the ramp spans
	 * @param color - the colour the ramp is built around
	 * @returns the gradient to hand to `fillStyle`
	 */
	private neonRamp(lineHeight: number, color: string): Gradient {
		const ramp = this.app.renderer.createLinearGradient(0, 0, 0, lineHeight);
		ramp.addColorStop(0, "#ffffff");
		ramp.addColorStop(0.35, color);
		ramp.addColorStop(0.75, color);
		ramp.addColorStop(1, "#0b1b33");
		return ramp;
	}

	/**
	 * Put a new drifter somewhere on the globe that is not on top of the
	 * player, and point it at them.
	 */
	private spawnDrifter(): void {
		let at: Vector3d;
		if (Math.random() < ROCK_ON_TRACK_CHANCE) {
			// ON THE CRAFT'S OWN GREAT CIRCLE, which is the only place a rock
			// can threaten a player who never steers. Rocks top out at 0.19
			// radians a second against the craft's 0.3, so homing never
			// closes on a straight runner: it has to be flown into. Seeded
			// uniformly, that was luck, and holding a course was close to
			// safe.
			const back = Math.random() < ROCK_ON_TRACK_BEHIND;
			const along = math.randomFloat(
				ROCK_ON_TRACK_MIN_ARC,
				ROCK_ON_TRACK_MAX_ARC,
			);
			// off the line a little, so a lane is not a queue down one
			// meridian; the rock's own homing takes up the rest
			at = advance(
				turn(advance(this.ship, back ? -along : along), Math.PI / 2),
				math.randomFloat(-ROCK_ON_TRACK_SPREAD, ROCK_ON_TRACK_SPREAD),
			).pos;
		} else {
			at = randomSurfacePoint();
			// Rejection sampling, bounded: a drifter materialising in the
			// player's lap is an unfair hit, and after a few tries any point
			// will do rather than spin here.
			for (let tries = 0; tries < 8; tries++) {
				if (arcBetween(at, this.ship.pos) >= ROCK_SPAWN_MIN_ARC) {
					break;
				}
				at = randomSurfacePoint();
			}
		}
		// mostly ordinary rocks, with the occasional boulder
		const grade =
			Math.random() < ROCK_BIG_CHANCE
				? math.randomFloat(ROCK_BIG_MIN, ROCK_BIG_MAX)
				: math.randomFloat(ROCK_SCALE_MIN, ROCK_SCALE_MAX);
		this.addDrifter(
			frameAt(at),
			grade,
			ROCK_ENTRY_MS * math.randomFloat(0.75, 1.35),
		);
	}

	/**
	 * Build one rock of a given size at a given place on the globe.
	 *
	 * Split out of the spawner because a break-up needs the same thing
	 * without the spawner's two decisions: where it goes, and how big it
	 * is. A fragment inherits both from what it came out of.
	 * @param frame - where it is and which way it faces
	 * @param grade - its size, as a multiple of `ROCK_SCALE`
	 * @param entryMs - how long it spends falling in; 0 to arrive in place
	 * @returns the drifter, already in the world
	 */
	private addDrifter(
		frame: SurfaceFrame,
		grade: number,
		entryMs: number,
		inherit?: RockKind,
	): Drifter {
		const shape = math.random(0, ROCK_SHAPES);
		// Capped so the rock's own TOP stays under the craft's flight
		// altitude, whatever the size tuning says. A rock rests on the glass,
		// so it reaches `DOME_R + 2r`, and one that reaches past the craft
		// flies over it rather than under it. Enforced here rather than left
		// to the constants agreeing with each other, because they are tuned
		// independently and this is the one relationship between them that
		// cannot be allowed to drift.
		// A piece broken off something INHERITS what it came from. Rolling
		// afresh here is what had a block of ice shatter into brown rock: the
		// roll belongs to a rock arriving out of the dark, not to a fragment
		// of one that is already on screen and already a known thing.
		const roll = Math.random();
		const kind: RockKind =
			inherit ??
			(roll < ROCK_ICE_CHANCE
				? "ice"
				: roll < ROCK_ICE_CHANCE + ROCK_BONUS_CHANCE
					? "bonus"
					: "rock");
		const shapeR = shapeRadius(shape);
		const headroom = (ROCK_CEILING - DOME_R - ROCK_CLEARANCE * 2) / 2 / shapeR;
		const size = Math.min(ROCK_SCALE * grade, headroom);
		const model = makeRock(size, shape, kind);
		// Its blob on the glass. The plane it lands on is restated every
		// frame in `placeWorld`, because on a sphere that plane is different
		// for every rock and moves as the rock drifts.
		model.castGroundShadow = true;
		model.shadowScale = ROCK_SHADOW_SCALE;
		model.shadowOpacity = ROCK_SHADOW_OPACITY;
		// The blob throws AWAY from the sun rather than sitting squarely
		// under the rock. `shadowLight` is read every draw, and this scene
		// rewrites `sun.direction` in world terms every frame, so the shadows
		// swing with the terminator the whole scene is lit around.
		model.shadowLight = this.sun;
		model.shadowOffset = ROCK_SHADOW_THROW;
		// a tint on top of the colour map, so two rocks of the same shape at
		// the same size still do not read as the same rock
		if (kind === "ice") {
			model.tint.setHSL(
				ICE_HUE + math.randomFloat(-0.03, 0.03),
				ICE_SATURATION,
				ICE_LIGHTNESS,
			);
		} else if (kind === "bonus") {
			model.tint.setHSL(
				BONUS_HUE + math.randomFloat(-0.02, 0.02),
				BONUS_SATURATION,
				BONUS_LIGHTNESS,
			);
		} else {
			model.tint.setHSL(math.randomFloat(0.02, 0.09), 0.3, 0.62);
		}
		// Into the broadphase: `isKinematic` defaults true, which keeps a
		// renderable out of the Octree, and the 3D narrowphase walks that
		// tree.
		model.isKinematic = false;
		// how much rock there is decides both how high it rides and how many
		// bolts it takes: one number, two consequences the player can see
		// A radioactive one takes the same hits its size earns plus a few: it
		// does not break up, so all of it has to be paid for at once.
		const hp =
			Math.max(1, Math.round(grade * ROCK_HP_PER_SIZE)) +
			(kind === "bonus" ? ROCK_BONUS_EXTRA_HP : 0);
		const radius = size * shapeR;
		const restAltitude = DOME_R + radius + ROCK_CLEARANCE;
		// Its collision shape: a `Sphere`, because a rock tumbles and
		// sits on a curved surface, and a `Box3d` is world-axis-aligned and
		// so fits neither. A SENSOR, because what the contact means here —
		// shield damage, a shatter, two rocks shoving each other apart along
		// a great circle — is a decision this game makes, and a push-out
		// would fight the one place that owns where anything is, which is
		// its `frame` on the unit sphere.
		//
		// Attached BEFORE `addChild`: that is what registers a body with the
		// adapter, and one assigned afterwards never enters the simulation.
		const hit = new Sphere(0, 0, 0, radius);
		// out of collision until it has finished falling in; see the
		// `isActive` note in `update`
		hit.isActive = entryMs <= 0;
		model.bodyDef = {
			type: "dynamic",
			gravityScale: 0,
			shapes: [hit],
			isSensor: true,
			collisionType: collision.types.ENEMY_OBJECT,
			// rocks answer to the craft, to the bolts, and to each other
			collisionMask:
				collision.types.PLAYER_OBJECT |
				collision.types.PROJECTILE_OBJECT |
				collision.types.ENEMY_OBJECT,
		};
		const drifter: Drifter = {
			frame,
			model,
			speed: math.randomFloat(ROCK_SPEED_MIN, ROCK_SPEED_MAX),
			bounceMs: 0,
			spin: math.randomFloat(-1.4, 1.4),
			// anywhere in the turn, so a field of rocks is not all facing
			// the same way on the frame it spawns
			spinPhase: math.randomFloat(0, Math.PI * 2),
			spinRate:
				math.randomFloat(ROCK_SPIN_MIN, ROCK_SPIN_MAX) *
				(Math.random() < 0.5 ? -1 : 1),
			radius,
			// it starts its fall out at `ROCK_ENTRY_ALTITUDE` and settles at
			// its own altitude; a fragment is already there and skips it
			altitude: entryMs > 0 ? ROCK_ENTRY_ALTITUDE : restAltitude,
			restAltitude,
			entryMs,
			grade,
			kind,
			hp,
			hpMax: hp,
			flashMs: 0,
			// its own buffer, hung on the mesh only while it is flashing.
			// `Mesh.emissive` is read per draw, and an all-zero one is
			// normalised away at construction, so there is nothing to write
			// into unless it is supplied from here.
			flashRgb: new Float32Array(3),
			baseEmissive: model.emissive,
			hit,
			// only the radioactive ones. Ice reads as ice from its colour and
			// its glassy highlight alone, and a halo on every glowing rock
			// put more light on the scene than the rocks were worth.
			halo: kind === "bonus" ? makeHalo(kind, radius) : undefined,
			haloAlpha: HALO_ALPHA,
		};
		if (drifter.halo !== undefined) {
			// behind the rock, so the mesh covers the middle of it
			this.app.world.addChild(drifter.halo, PLANET_Z);
		}

		// The contact hooks, now that there is a record for them to close
		// over. Everything that touches a rock is dispatched from here: the
		// engine reports the pair, this decides what it means.
		const contacts = model as RockContacts;
		// One-shot, on the frame a pair first touches, which is what a hit
		// IS. Both sides of a pair are called, and the craft and the bolts
		// carry no hook of their own, so each event arrives exactly once.
		contacts.onCollisionStart = (_response, other) => {
			if (other === this.shipMesh) {
				// queued rather than applied: this runs inside the world's
				// own update walk, and the response tears renderables out of
				// the world. Drained at the top of the next `update`.
				this.pendingShipHits.push(drifter);
				return;
			}
			const bolt = this.bolts.find((b) => {
				return b.visual.sprite === other;
			});
			if (bolt !== undefined) {
				this.pendingBoltHits.push({ bolt, rock: drifter });
			}
		};
		// Rock against rock has to keep shoving while they overlap, so it is
		// the every-frame hook rather than the one-shot one. It only moves a
		// frame on the unit sphere, which is safe to do mid-walk.
		contacts.onCollisionActive = (_response, other) => {
			const partner = this.byModel.get(other);
			if (partner !== undefined) {
				this.separatePair(drifter, partner);
			}
		};

		this.app.world.addChild(model, PLANET_Z);
		this.drifters.push(drifter);
		this.byModel.set(model, drifter);
		return drifter;
	}

	/**
	 * Break a boulder into pieces, thrown outward from where it died.
	 *
	 * The pieces go out along the surface in evenly spaced directions with
	 * a little jitter, so they read as one thing coming apart rather than
	 * as three new rocks appearing. They also keep a moment of bounce
	 * immunity, which here is what stops them turning round and homing back
	 * through each other before they have cleared.
	 * @param parent - the rock that just broke, already out of the world
	 */
	private splitDrifter(parent: Drifter): void {
		const pieces = math.random(ROCK_SPLIT_COUNT_MIN, ROCK_SPLIT_COUNT_MAX + 1);
		const grade = Math.max(ROCK_SCALE_MIN, parent.grade * ROCK_SPLIT_SCALE);
		// How far out to place them. `turn` keeps the parent's POSITION and
		// only rotates the heading, so without this every fragment is born at
		// exactly the same point: `separatePair` then finds a zero gap, takes
		// its coincident branch and throws them apart by their whole combined
		// radius in one frame, which reads as a teleport rather than a break.
		// Placing them already clear means the separation pass has nothing to
		// undo.
		const spread = (ROCK_SCALE * grade * ROCK_SPLIT_SPREAD) / _hitShell;
		for (let n = 0; n < pieces; n++) {
			// The FIRST fragment is not subject to the cap: a boulder that
			// vanishes without debris because the sky happened to be full is
			// the player's biggest shot producing nothing, and it fails
			// exactly when the game is busiest.
			if (n > 0 && this.drifters.length >= ROCK_MAX) {
				return;
			}
			// evenly around the compass at the break point, plus jitter
			const heading = turn(
				parent.frame,
				(n / pieces) * Math.PI * 2 + math.randomFloat(-0.4, 0.4),
			);
			// and stepped out along the way it is going, so the fan is a fan
			const at = nudge(heading, heading.heading, spread);
			const piece = this.addDrifter(at, grade, 0, parent.kind);
			piece.speed += ROCK_SPLIT_SPEED;
			piece.bounceMs = ROCK_BOUNCE_MS;
		}
	}

	/**
	 * Push one reported pair of overlapping rocks apart and send them on
	 * their way.
	 *
	 * The engine finds the pair; this decides what the contact means. What
	 * it means here is a shove along the surface, because where a rock IS
	 * lives in its `frame` on the unit sphere and nothing else may move it:
	 * a solver push-out would write a scene position that the next frame's
	 * projection overwrites, which is why every body in this game is a
	 * sensor.
	 *
	 * Measured as an ARC. Two rocks ride at their own altitudes, and what
	 * the player sees overlapping is their ground tracks.
	 *
	 * Rocks still falling in never reach here: their shape is switched out
	 * of collision until they arrive, so the engine reports nothing for
	 * them.
	 * @param da - one rock of the pair
	 * @param db - the other
	 */
	private separatePair(da: Drifter, db: Drifter): void {
		// No attempt to run this once per pair rather than once per reported
		// side. It resolves the whole pair, and it re-measures the gap first,
		// so a second call for the same pair finds them already clear and
		// returns: self-limiting, and it does not depend on which side of a
		// pair the engine hands over, which a tie-break on the two
		// renderables would.
		//
		// The engine reported the contact against their true radii. The
		// margin here is the game's own: it pushes them until they are
		// CLEAR rather than exactly touching, so the next frame does not
		// report the same pair again.
		const ra = da.radius * ROCK_PAIR_MARGIN;
		const rb = db.radius * ROCK_PAIR_MARGIN;
		const gap = arcBetween(da.frame.pos, db.frame.pos) * _hitShell;
		if (gap >= ra + rb) {
			return;
		}
		if (gap < 1e-4) {
			// Coincident, which two rocks homing on the same craft eventually
			// are: they converge, and once they are within a rounding error
			// of each other there is no line between them left to push along.
			// Giving up here is what left a pair riding as one rock for the
			// rest of its life. Any direction does, so long as it is
			// deterministic, and each rock is already carrying one.
			// A SHARE of the way, not all of it: pushing the whole combined
			// radius in one frame is the teleport this used to produce. The
			// pair is re-reported next frame and converges in a few.
			const half = ((ra + rb) / _hitShell / 2) * ROCK_PAIR_RESOLVE;
			const away = da.frame.heading;
			da.frame = nudge(da.frame, away, half);
			db.frame = nudge(db.frame, away, -half);
			da.bounceMs = Math.max(da.bounceMs, ROCK_PAIR_BOUNCE_MS);
			db.bounceMs = Math.max(db.bounceMs, ROCK_PAIR_BOUNCE_MS);
			return;
		}
		const toB = tangentToward(da.frame.pos, db.frame.pos);
		const toA = tangentToward(db.frame.pos, da.frame.pos);
		if (toB.x === 0 && toB.y === 0 && toB.z === 0) {
			return;
		}
		// AN IMPULSE, not a shove.
		//
		// What was here paid out a share of the overlap as a position change
		// every frame, and the overlap is `ra + rb - gap`, so the correction
		// scaled with the rocks. Measured over 113 contacts: a small pair
		// moved 0.0008 radians a frame, a quarter of its own travel, which
		// reads as a bounce; a big pair moved a median of 0.0044 and up to
		// 0.0299, NINE TIMES its own travel in a single frame, which reads as
		// a teleport. Olivier saw exactly that split, and named the fix: it
		// should be "a tiny impulse ... the result of the two colliding".
		//
		// So this is a real two-body collision. Only the component along the
		// contact line is touched, because that is the only part a collision
		// acts on: whatever each rock was doing sideways slides past
		// untouched, which is what makes a graze a graze.
		//
		// Masses are the CUBE of the radius, as volume. That is the whole
		// reason this looks right where a reflection did not: a reflection
		// turns both rocks equally however big they are, so a boulder was
		// bounced by a pebble. Here the boulder barely notices and the pebble
		// is thrown, which is what the eye expects of two different lumps of
		// the same stone.
		const ma = da.radius * da.radius * da.radius;
		const mb = db.radius * db.radius * db.radius;
		// each rock's speed along the line between them, both measured
		// toward B so they can be compared
		const an = dot(da.frame.heading, toB) * da.speed;
		const bn = -dot(db.frame.heading, toA) * db.speed;
		const closing = an - bn;
		if (closing > 0) {
			// the standard one-dimensional impulse, shared by mass
			const j = ((1 + ROCK_PAIR_RESTITUTION) * closing) / (ma + mb);
			this.shove(da, toB, -j * mb);
			// MINUS on both: `toB` points a->b and `toA` points b->a, so
			// "away from the other" is the negative direction for each of
			// them. Getting this one wrong pushes B back into A, and the
			// pair sticks instead of parting: measured at 21,536 contacts
			// in a run that has 264 when it is right.
			this.shove(db, toA, -j * ma);
		}
		// And the overlap they are ALREADY in, which an impulse cannot undo:
		// it changes where they are going, not where they are. Without this a
		// pair homing on the same target rides along inside itself, measured
		// at 358 frames of unbroken contact.
		//
		// CAPPED, and that is the entire fix for the snap. The old correction
		// paid out a share of the overlap, which scales with the radii, so
		// the bigger the pair the further it jumped. A flat ceiling under the
		// 0.0032 radians a rock covers in a frame at full speed cannot be
		// seen as anything but drift, whatever size the rocks are.
		const sink = Math.min(
			((ra + rb - gap) / _hitShell) * 0.5 * ROCK_PAIR_RESOLVE,
			ROCK_PAIR_MAX_PUSH,
		);
		da.frame = nudge(da.frame, toB, -sink);
		db.frame = nudge(db.frame, toA, -sink);
		da.bounceMs = Math.max(da.bounceMs, ROCK_PAIR_BOUNCE_MS);
		db.bounceMs = Math.max(db.bounceMs, ROCK_PAIR_BOUNCE_MS);
	}

	/**
	 * Add `amount` of speed along `dir` to a drifter, and keep it a drifter.
	 *
	 * A rock carries its motion as a unit `heading` and a scalar `speed`, so
	 * an impulse cannot just be added: the velocity has to be rebuilt, the new
	 * speed read back off it, and the heading renormalised. Going through
	 * {@link deflect} is what keeps the mesh still, since the heading is also
	 * the tangent its orientation is built from.
	 * @param d - the rock being hit
	 * @param dir - unit tangent at the rock, the direction to add along
	 * @param amount - radians per second to add, signed
	 */
	private shove(d: Drifter, dir: Vector3d, amount: number): void {
		const vx = d.frame.heading.x * d.speed + dir.x * amount;
		const vy = d.frame.heading.y * d.speed + dir.y * amount;
		const vz = d.frame.heading.z * d.speed + dir.z * amount;
		const sp = Math.hypot(vx, vy, vz);
		// A dead-on hit between equal rocks can cancel the motion outright,
		// and a zero vector is not a heading. It keeps the one it had and
		// crawls off at the floor speed instead, which the next frame's
		// contact will turn properly.
		if (sp > 1e-6) {
			_shoveTo.set(vx / sp, vy / sp, vz / sp);
			this.deflect(d, _shoveTo);
		}
		d.speed = math.clamp(sp, ROCK_SPEED_FLOOR, ROCK_SPEED_CEIL);
	}

	/**
	 * Give a rock a new heading without letting its mesh notice.
	 *
	 * The mesh is oriented by a surface frame built from the heading, which
	 * is right while the rock is just travelling: the tangent is continuous
	 * because the motion maintaining it is. A bounce breaks that. Reflecting
	 * a heading is a step change by design, and a head-on contact reverses
	 * it, so the frame built from it turns a half circle between two frames
	 * and the rock visibly flips. Measured in play at up to 145 degrees in a
	 * single frame, and every jump recorded had just bounced.
	 *
	 * The orientation that reaches the screen is the frame TIMES the rock's
	 * own turn about the normal, so the fix is to pay the frame's jump into
	 * that turn and let the two cancel. `turnBetween` is signed for exactly
	 * this reason: the correction has to know which way the heading went.
	 *
	 * Smoothing the bounce instead would also hide it, but it would make the
	 * rock pivot over several frames rather than bounce, which is a change to
	 * how the game plays rather than to how it looks.
	 * @param d - the rock being turned
	 * @param heading - its new unit heading, tangent at its current position
	 */
	private deflect(d: Drifter, heading: Vector3d): void {
		// MINUS, and the direction is pinned by a test rather than by this
		// comment: `turnBetween` is signed as `turn` takes its angle, which
		// runs opposite to a rotation about local up. Backwards here doubles
		// the jump instead of cancelling it and looks much the same on screen.
		d.spinPhase -= turnBetween(d.frame.heading, heading, d.frame.pos);
		d.frame = { pos: d.frame.pos, heading };
	}

	private removeDrifter(i: number): void {
		const d = this.drifters[i];
		this.byModel.delete(d.model);
		this.app.world.removeChild(d.model);
		if (d.halo !== undefined) {
			this.app.world.removeChild(d.halo);
		}
		this.drifters[i] = this.drifters[this.drifters.length - 1];
		this.drifters.pop();
	}

	private removeBolt(i: number): void {
		const bolt = this.bolts[i];
		// `removeChildNow`, not `removeChild`, and `keepalive` on both.
		//
		// `removeChild` DEFERS: it queues the removal to run once the update
		// and draw stack has finished. That is safe for something being
		// thrown away and wrong for something going back into a pool, because
		// the next shot in the same frame takes this visual straight back out
		// and re-adds it, and the queued removal then fires and takes the
		// LIVE bolt out of the world. It vanished, and the frame after that
		// its removal threw "Child is not mine".
		//
		// `keepalive` because each of these owns compiled shader programs
		// that the next shot is going to want back.
		this.app.world.removeChildNow(bolt.visual.sprite, true);
		this.app.world.removeChildNow(bolt.visual.quad, true);
		this.boltPool.push(bolt.visual);
		this.bolts[i] = this.bolts[this.bolts.length - 1];
		this.bolts.pop();
	}

	/**
	 * Build every pool of light up front, each with its own clone of the
	 * preloaded shader.
	 *
	 * `loader.getShader` hands back ONE shared instance, and a shared
	 * instance cannot carry a per-bolt phase: set `uPhase` on it and every
	 * pool in the scene takes the new value. `clone` compiles an
	 * independent copy of the same program, which is the point of
	 * preloading a shader rather than building one — the compile happened
	 * behind the loading screen and this is a copy of the result.
	 *
	 * They are built here and never destroyed. `removePostEffect` destroys
	 * the effect it removes, so a pool that were torn down per shot would
	 * take its program with it and the next shot would have to compile
	 * another one, mid-frame.
	 */
	private initBoltPool(): void {
		const glowShader = loader.getShader(GLOW_SHADER) as ShaderEffect;

		// The bolts' energy, as a built-in rather than a shader of our own.
		// It used to be a custom `ShaderEffect` cloned once per bolt, whose
		// one non-trivial part was a `lum * lum` term meant to make the
		// filament pull away from the sheath. Measured against a flat
		// multiplier on this scene, that term moved the emitters by under
		// 2/255 even where they dominate the frame, which is less than the
		// run-to-run noise: the bolt texture is already near-white in its
		// core, so there was nothing left for it to lift.
		//
		// `shared = true` because ONE instance now serves the whole pool,
		// where before each bolt carried its own compiled program.
		const energy = new ColorMatrixEffect(this.app.renderer).brightness(
			HDR_BOLT_EXPOSURE,
		);
		energy.shared = true;
		for (let i = 0; i < BOLT_POOL; i++) {
			// billboard OFF, same as the exhaust: it is turned to face where
			// the bolt is going, and a billboard would ignore that
			const sprite = new Sprite3d(0, 0, {
				image: this.boltTexture,
				width: LASER_TEX_W,
				height: LASER_TEX_H,
				billboard: false,
				transparent: true,
				alphaCutoff: 0,
			});
			sprite.blendMode = "additive";
			sprite.isKinematic = false;
			// Centred on `pos`, with NO anchor term. A 2D `Sprite` draws from
			// the top-left of its frame, so a centre-anchored one needed half
			// the frame added back or its shape sat on the corner. A
			// `Sprite3d` bakes `anchorPoint` into the quad's own vertices and
			// draws at `pos`, like the craft and the rocks, so adding that
			// term now pushes the collision half a frame off the beam.
			const hit = new Sphere(0, 0, 0, BOLT_HIT_RADIUS);
			sprite.bodyDef = {
				type: "dynamic",
				gravityScale: 0,
				shapes: [hit],
				isSensor: true,
				collisionType: collision.types.PROJECTILE_OBJECT,
				collisionMask: collision.types.ENEMY_OBJECT,
			};
			// still exactly ONE effect, so the sprite keeps the renderer's
			// `customShader` fast path and draws straight into the camera's
			// target with its range intact
			sprite.addPostEffect(energy);

			const quad = new Mesh(0, 0, {
				vertices: GLOW_QUAD.vertices,
				uvs: GLOW_QUAD.uvs,
				indices: GLOW_QUAD.indices,
				normalize: false,
				scale: GLOW_SIZE,
				width: GLOW_SIZE,
				height: GLOW_SIZE,
				// the shader IS the shading here: a light pool takes nothing
				// from the scene's own lights
				lit: false,
				// it is a flat quad laid on a curved surface and seen from
				// either side as the world turns
				cullBackFaces: false,
				// blended, back to front, and NO depth write, so it never
				// rejects the glass it is lying on
				transparent: true,
				alphaCutoff: 0,
			});
			quad.tint.parseCSS(GLOW_TINT);
			quad.setOpacity(GLOW_ALPHA);
			quad.blendMode = "additive";
			// One effect on a plain renderable takes the no-FBO path: the
			// effect becomes this mesh's shader for the draw, which is what
			// hosting means.
			const glowFx = glowShader.clone();
			glowFx.setUniform("uExposure", GLOW_EXPOSURE);
			quad.addPostEffect(glowFx);
			this.boltPool.push({ sprite, quad, glowFx, hit });
		}
	}

	/**
	 * Pull the trigger.
	 *
	 * One bolt, or a fan of {@link UPGRADE_BOLTS} while a radioactive rock's
	 * prize is still running. The fan leaves from the same place with its
	 * headings rotated about the surface normal, which is what `turn` does,
	 * so each bolt flies its own great circle and the three diverge as they
	 * go rather than travelling as a rigid row.
	 *
	 * The sound plays once for the volley rather than once per bolt: three
	 * copies of the same clip in the same millisecond is a click, not a
	 * triple shot.
	 */
	private fire(): void {
		// at the craft, so at the listener: no point placing it
		playFire();
		const count = this.upgradeMs > 0 ? UPGRADE_BOLTS : 1;
		for (let i = 0; i < count; i++) {
			// centred on the heading: a lone bolt gets offset 0, and a fan is
			// symmetric about where the nose is actually pointing
			const offset = (i - (count - 1) / 2) * UPGRADE_SPREAD;
			this.spawnBolt(offset === 0 ? this.ship : turn(this.ship, offset));
		}
	}

	/**
	 * Put one bolt in the air on a given frame.
	 * @param from - where it starts and which way it goes
	 */
	private spawnBolt(from: SurfaceFrame): void {
		// The pool is sized from the fire rate and the bolt's life, so it
		// cannot run dry at the gun's own cadence; if something ever changes
		// that, the shot is dropped rather than a program compiled mid-frame.
		const visual = this.boltPool.pop();
		if (visual === undefined) {
			return;
		}
		// its own place in the pulse, so a burst does not strobe as one
		visual.glowFx.setUniform("uPhase", Math.random());
		// the streak's size is set with its rotation, every frame, in
		// `placeWorld`
		this.app.world.addChild(visual.sprite, PLANET_Z);
		this.app.world.addChild(visual.quad, PLANET_Z);

		// A bolt starts where the ship is and inherits its heading, then
		// flies its own great circle from there. It is not parented to
		// the ship, so turning after firing does not drag it round.
		this.bolts.push({
			frame: { pos: from.pos, heading: from.heading },
			visual,
			ageMs: 0,
			pierces: this.pierceMs > 0,
			through: [],
		});
	}

	/**
	 * Hand over a radioactive rock's prize: one of four, rolled.
	 *
	 * The fan, the lance, the shield-and-ward, or the multiplier, never two
	 * of them.
	 * Each is useful in different trouble, so which one arrives changes what
	 * the next few seconds are for, and that is the point of rolling rather
	 * than always giving the same thing or giving all three.
	 *
	 * A gun that is already running is EXTENDED from now rather than topped
	 * up, so two rocks in quick succession do not bank sixteen seconds of it.
	 */
	private awardBonusPrize(): void {
		const roll = Math.random();
		if (roll < BONUS_SPREAD_CHANCE) {
			this.upgradeMs = UPGRADE_MS;
			// One gun at a time: the fan REPLACES the lance rather than
			// running alongside it. They are the same slot, so a shot is
			// either wide or long and never a four-way lance, and the player
			// is told which gun they have instead of reading two rows and
			// guessing how they combine. The other three prizes stack freely,
			// because none of them answers the same question.
			this.pierceMs = 0;
			playUpgrade();
		} else if (roll < BONUS_SPREAD_CHANCE + BONUS_PIERCE_CHANCE) {
			// The other half of the gun question: the fan buys WIDTH and the
			// lance buys DEPTH, which is why they are two prizes and not a
			// single "better gun". A raid laid as a line, and a stack of
			// rocks on one bearing, are exactly what a shot that does not
			// stop at the first thing answers.
			this.pierceMs = UPGRADE_MS;
			// and the same the other way: see the fan above
			this.upgradeMs = 0;
			playUpgrade();
		} else if (
			roll <
			BONUS_SPREAD_CHANCE + BONUS_PIERCE_CHANCE + BONUS_WARD_CHANCE
		) {
			// The shield topped right up AND nothing able to touch it for a
			// while. `invulnMs` is the gate the whole game already checks, so
			// the ward is that same window opened wide rather than a second
			// rule; `Math.max` so a prize never SHORTENS a window a hit just
			// opened.
			this.shield = SHIELD_MAX;
			this.invulnMs = Math.max(this.invulnMs, WARD_MS);
			playUpgrade();
		} else {
			// Rolled on pickup, and EXTENDED from now like the gun rather
			// than topped up, so two rocks in quick succession cannot bank
			// sixteen seconds. A second roll replaces the factor, which is
			// the only honest thing to do with one number.
			this.scoreMult =
				BONUS_MULTIPLIERS[Math.floor(Math.random() * BONUS_MULTIPLIERS.length)];
			this.scoreMultMs = UPGRADE_MS;
			playMultiplierUp();
		}
		this.refreshPrize();
	}

	/**
	 * Count the gun and the prize banner down.
	 *
	 * Its own method because the label has to be rewritten as the number on
	 * it changes, and `refreshHud` is event-driven: nothing else in the frame
	 * would ask.
	 * @param dt - frame time, ms
	 */
	private tickPrize(dt: number): void {
		const warded = this.invulnMs > INVULN_MS;
		if (
			this.upgradeMs <= 0 &&
			this.pierceMs <= 0 &&
			this.scoreMultMs <= 0 &&
			!warded
		) {
			// A prize that has just run out leaves its last tenth on screen:
			// the ward decays through `INVULN_MS` and this return fires on
			// the very next frame, so nothing ever rewrote the label and the
			// HUD went on claiming SHIELDED 1.5 until the next kill happened
			// to refresh it. Cleared once, then quiet.
			if (this.prizeShown) {
				this.prizeTenthsShown = -1;
				this.refreshPrize();
			}
			return;
		}
		// The SUM of every window the banner is showing, which works because
		// they only ever decrease: the total crosses a tenth exactly when one
		// of its parts does, so one number covers all four rows. Reading the
		// highest-priority one instead, as this did while the banner showed a
		// single prize, freezes the digits on every row below it. The ward is
		// counted down by the invulnerability code, not here, but it still
		// belongs in the total because it has a row.
		this.upgradeMs = Math.max(0, this.upgradeMs - dt);
		this.pierceMs = Math.max(0, this.pierceMs - dt);
		this.scoreMultMs = Math.max(0, this.scoreMultMs - dt);
		// Compared against what is ON SCREEN, across frames, rather than
		// across this method's own decrements.
		//
		// The ward is counted down by the invulnerability code, nine lines
		// after this runs, so between the two readings this used to take it
		// never moved. A banner showing ONLY `SHIELDED` therefore never
		// redrew: the digits sat still for the whole ward while the timer
		// behind them ran out normally, and the row vanished mid-count. Any
		// future prize ticked from somewhere else would have done the same.
		const nowTenths = this.prizeTenths();
		// redrawn only when the digit the player can see actually moves, not
		// sixty times a second: `setText` rebakes the label's canvas
		if (nowTenths !== this.prizeTenthsShown) {
			this.prizeTenthsShown = nowTenths;
			this.refreshPrize();
		}
	}

	/**
	 * Every running prize's remaining time, in tenths, added together.
	 * @returns the total, which only ever falls
	 */
	private prizeTenths(): number {
		return Math.ceil(
			(this.upgradeMs +
				this.pierceMs +
				this.scoreMultMs +
				(this.invulnMs > INVULN_MS ? this.invulnMs : 0)) /
				100,
		);
	}

	/**
	 * Say what every running prize is doing, one per line, or nothing.
	 *
	 * ALL of them, not the most important one. The prizes are rolled
	 * independently and each lasts {@link UPGRADE_MS}, so two or three
	 * overlap often, and showing one made the newest pickup look like it had
	 * REPLACED what was already running. It had not: a lance and a score
	 * multiplier both apply, and the player was being told otherwise at the
	 * exact moment the information mattered.
	 *
	 * Stacked down the left column rather than joined along one line,
	 * because that column is dark sky for the whole run while a line long
	 * enough for four prizes would cross the planet's lit limb, which is
	 * where an additive label at this size stops being readable.
	 *
	 * The order is fixed rather than most-recent-first: a reading the player
	 * takes at a glance should not have its rows move around under them.
	 */
	private refreshPrize(): void {
		// one place decides the text, and one place records whether there is
		// any, so `tickPrize` knows when it still owes the HUD a clear
		const lines = this.prizeLines;
		lines.length = 0;
		if (!this.gameOver) {
			if (this.upgradeMs > 0) {
				lines.push(`SPREAD ${(this.upgradeMs / 1000).toFixed(1)}`);
			}
			if (this.pierceMs > 0) {
				lines.push(`LANCE ${(this.pierceMs / 1000).toFixed(1)}`);
			}
			if (this.invulnMs > INVULN_MS) {
				// Longer than the window a hit opens, so it can only be the
				// prize: one counter, no second field to keep in step with it.
				lines.push(`SHIELDED ${(this.invulnMs / 1000).toFixed(1)}`);
			}
			if (this.scoreMultMs > 0) {
				// the same shape as the others, which is the point: every
				// prize is a name and the time left on it
				lines.push(
					`${this.scoreMult}x SCORE ${(this.scoreMultMs / 1000).toFixed(1)}`,
				);
			}
		}
		this.prizeShown = lines.length > 0;
		this.hudPrize.setText(lines.length > 0 ? lines : "");
	}

	private get multiplier(): number {
		// The streak tier, capped, times whatever the prize is worth while it
		// runs. Composed rather than either one winning: the cap belongs to
		// the streak, which is earned and can be lost, and the prize is a
		// short window on top of whatever the player had managed to build.
		const tier = Math.min(
			MULTIPLIER_MAX,
			1 + Math.floor(this.streak / MULTIPLIER_STEP),
		);
		return tier * (this.scoreMultMs > 0 ? this.scoreMult : 1);
	}

	private refreshHud(): void {
		this.noteBest();
		this.hudScore.setText(`SCORE ${String(this.score).padStart(6, "0")}`);
		// the stamp says GAME OVER now, so this one simply goes quiet
		this.hudMultiplier.setText(this.gameOver ? "" : `${this.multiplier}x`);
		// and the banner under it, which has the same rule
		this.refreshPrize();
		// The best is shown as BEATEN the moment it is, mid-run, rather than
		// only on the game-over screen: the point of the number is the pressure
		// it puts on the run still being played.
		if (this.newBestMs > 0) {
			this.hudBest.setText("NEW BEST");
			this.hudBest.fillStyle.parseCSS(BEST_NEW_COLOR);
		} else {
			this.hudBest.setText(`BEST ${String(this.best).padStart(6, "0")}`);
			this.hudBest.fillStyle.parseCSS(BEST_COLOR);
		}
	}

	/**
	 * Fold the run's score into the best, and say so if it is one.
	 *
	 * Called on every score change rather than only at the end, so beating it
	 * is a moment DURING the run. Written through on the spot too: a best that
	 * only persists on a clean game over is lost to a reload, a crash, or a
	 * tab closed in disgust, which is exactly when a player most wants it kept.
	 */
	private noteBest(): void {
		if (this.score <= this.best) {
			return;
		}
		const had = this.best > 0;
		this.best = this.score;
		this.store[BEST_SAVE_KEY] = this.best;
		// ONCE, on the crossing. Re-armed on every scoring event it pinned
		// the readout to the banner for the rest of the run, because a run
		// that is ahead scores far more often than once every
		// `BEST_NEW_MS` — so the number it exists to put pressure on was
		// never actually readable. Not announced at all on the very first
		// run, when every point is a new best.
		if (had && !this.beatenThisRun) {
			this.beatenThisRun = true;
			this.newBestMs = BEST_NEW_MS;
		}
	}

	/**
	 * Send a score number flying from a kill to the readout.
	 *
	 * The label comes from `getPool("text")`: a run throws off a few hundred
	 * of these, each one owning a measurement canvas and a colour, and this is
	 * the case that pool exists for. Removing it from the HUD hands it back,
	 * so there is no release call here to forget.
	 *
	 * One {@link Tween} on the label's own `pos` carries it, eased
	 * `Quintic.In`. That shape is the whole point: `k^5` leaves the number
	 * parked over the wreck for the first half-second, which is when it is
	 * read, and spends the last quarter of its life covering most of the
	 * distance. A number that set off at a constant speed arrived before it
	 * could be read, and easing it by hand in `update` was the same curve
	 * written out longhand.
	 * @param x - the kill, in world units
	 * @param y - the kill, in world units
	 * @param z - the kill, in world units
	 * @param amount - points awarded, already multiplied
	 * @param bonus - a radioactive rock, which gets the bigger green number
	 */
	private flyScore(
		x: number,
		y: number,
		z: number,
		amount: number,
		bonus = false,
	): void {
		// A kill BEHIND the camera projects to null, and one off the edge of
		// the screen would fly in from outside — neither is worth a number.
		_popWorld.set(x, y, z);
		if (!this.camera.worldToScreen(_popWorld, _popScreen)) {
			return;
		}
		const { width, height } = this.app.renderer;
		if (
			_popScreen.x < 0 ||
			_popScreen.x > width ||
			_popScreen.y < 0 ||
			_popScreen.y > height
		) {
			return;
		}
		// A chain of kills can land a dozen of these in one frame; past that
		// they stop reading as individual numbers and the oldest goes.
		if (this.pops.length >= SCORE_POP_MAX) {
			this.retirePop(0);
		}
		// Sized by what it is worth, in whole rocks: one ordinary rock at the
		// current multiplier is the unit, so the number off a boulder is
		// visibly bigger than the one off a pebble and a radioactive rock's
		// six times payout arrives looking like six times. Measured against
		// the live multiplier so the sizes do not all creep up with it.
		const units = Math.max(
			1,
			Math.round(amount / (SCORE_PER_ROCK * this.multiplier)),
		);
		const size =
			SCORE_POP_SIZE +
			Math.min(units - 1, SCORE_POP_STEPS_MAX) * SCORE_POP_STEP;
		const label = getPool("text").get(
			_popScreen.x,
			_popScreen.y - SCORE_POP_RISE,
			{
				font: HUD_FONT,
				size,
				fillStyle: bonus ? SCORE_POP_BONUS_COLOR : SCORE_POP_COLOR,
				textAlign: "center",
				textBaseline: "middle",
				text: `+${amount}`,
			},
		);
		// SET, not assumed: a pooled instance comes back with its renderable
		// state reset, so the flag the last user set is gone. The HUD is a
		// floating container and a non-floating child in it is drawn through
		// the camera, which on this camera means somewhere in space.
		label.floating = true;
		// and lit like the rest of the readout: the camera's glow pass blooms
		// whatever is brightest, which is what makes a HUD number read as lit
		label.blendMode = "additive";
		// ABOVE the score and the best, BELOW the GAME OVER stamp. The
		// container sorts descending and paints in reverse, so the higher z
		// lands on top.
		this.hudLayer.addChild(label, SCORE_POP_Z);

		// the readout's own bounds, so moving the HUD moves the target with it
		const box = this.hudScore.getBounds();
		// From the pool, like the label above it. A run throws off a few
		// hundred of these and each one wanted a `Tween` as well as a `Text`;
		// the pool's reset re-points the instance at the new object, which is
		// the whole of what a fresh one would have done.
		const flight = getPool("tween")
			.get(label.pos)
			.to(
				{ x: box.x + box.width * 0.78, y: box.y + box.height / 2 },
				{ duration: SCORE_POP_MS, easing: Tween.Easing.Quintic.In },
			)
			// `onUpdate` is handed the EASED progress, which is what the size
			// and the fade want: both have to agree with where the number
			// actually is, not with how long it has been in the air.
			.onUpdate((k) => {
				const scale =
					SCORE_POP_START_SCALE +
					(SCORE_POP_END_SCALE - SCORE_POP_START_SCALE) * k;
				label.currentTransform.identity().scale(scale, scale);
				label.setOpacity(
					1 -
						Math.max(0, (k - SCORE_POP_FADE_FROM) / (1 - SCORE_POP_FADE_FROM)),
				);
				label.isDirty = true;
			})
			.onComplete(() => {
				const at = this.pops.findIndex((p) => p.label === label);
				if (at >= 0) {
					this.retirePop(at);
				}
			});
		// the pop-in size, before the first tween tick writes one
		label.currentTransform
			.identity()
			.scale(SCORE_POP_START_SCALE, SCORE_POP_START_SCALE);
		this.pops.push({ label, flight });
		flight.start();
	}

	/**
	 * Take one score number off the HUD.
	 *
	 * `removeChildNow` hands the label back to the pool it came from, so there
	 * is nothing to release here. The tween is stopped rather than left to
	 * finish, since `stop()` does not run `onComplete` and a flight whose
	 * label has gone would otherwise keep writing to it.
	 * @param index - which one, in `pops`
	 */
	private retirePop(index: number): void {
		const pop = this.pops[index];
		pop.flight.stop();
		// Safe from the tween's own `onComplete`, which is one of the three
		// callers: `_unsubscribe()` runs BEFORE that callback and nothing
		// touches the instance after it. Each pop is spliced out here, so it
		// can never be retired, and therefore released, twice.
		getPool("tween").release(pop.flight);
		this.hudLayer.removeChildNow(pop.label);
		this.pops.splice(index, 1);
	}

	/** Take every score number off the HUD, without waiting for it to land. */
	private clearPops(): void {
		for (let i = this.pops.length - 1; i >= 0; i--) {
			this.retirePop(i);
		}
	}

	/**
	 * The craft flew through ice, and the ice loses.
	 *
	 * No shield cost and no bounce: this is the one contact in the game the
	 * player is supposed to go looking for, so it pays like a kill rather
	 * than costing like a collision. The shake is small, because the craft
	 * went through it rather than off it.
	 *
	 * And it PAYS: BOOST back, by how big the block was. That is the whole
	 * reason to go and get one rather than merely not mind hitting it, and it
	 * closes a loop, since boosting is how the craft got there.
	 * @param hit - the ice that was hit
	 */
	private shatterIce(hit: Drifter): void {
		// Where it is in the SCENE, named once. The sound, the burst, the
		// flash and the flying score all want the same three numbers, and
		// each of them used to spell the chain out again.
		const sx = hit.model.pos.x;
		const sy = hit.model.pos.y;
		const sz = hit.model.depth;
		playAt(SFX.iceShatter, sx, sy, sz);
		this.blast.burst(
			sx,
			sy,
			sz,
			TINT_ICE_EXPLOSION,
			// terminal: ice never splits, so all of it goes at once
			this.blast.debrisCount(hit.grade, true),
			hit.frame.pos,
			BURST_SPEED,
			BURST_LIFE,
			hit.radius * BURST_AREA_SCALE,
		);
		this.blast.shock(hit.frame.pos, hit.altitude, hit.radius, iceRgb);
		this.blast.flash(
			sx,
			sy,
			sz,
			TINT_ICE_EXPLOSION,
			FLASH_ROCK_INTENSITY,
			FLASH_ROCK_RANGE,
			FLASH_ROCK_MS,
		);
		this.camera.shake(4, 150);
		// What the craft came for. Subtracted and floored rather than
		// assigned, so a block taken with a cool engine is not a waste of
		// one: it takes out whatever heat is there, and a boulder takes all.
		this.heat = Math.max(0, this.heat - iceBoostFor(hit.grade));
		// and the cut-out lifts the moment it can, rather than on the next
		// cooling tick: the whole point of reaching the ice was to fly again
		if (this.overheated && this.heat <= HEAT_RESUME) {
			this.overheated = false;
		}
		const icePoints = SCORE_PER_ROCK * this.multiplier * hit.hpMax;
		this.score += icePoints;
		this.flyScore(sx, sy, sz, icePoints);
		this.streak += 1;
		this.refreshHud();
		this.removeDrifter(this.drifters.indexOf(hit));
	}

	/**
	 * A rock reached the craft.
	 *
	 * Nothing explodes. The shield takes the damage and the two are thrown
	 * apart along the line the rock came in on, which is the only reading
	 * of a shield that makes sense: it is the thing that stopped them
	 * touching. The run ends only on an impact the shield had nothing left
	 * to absorb.
	 * @param hit - the rock that arrived
	 */
	private onShipHit(hit: Drifter): void {
		// the rock's scene position, named once for the three users below
		const sx = hit.model.pos.x;
		const sy = hit.model.pos.y;
		const sz = hit.model.depth;
		playAt(SFX.rockBurst, sx, sy, sz);
		this.blast.burst(
			sx,
			sy,
			sz,
			TINT_SHIP_EXPLOSION,
			SHIELD_IMPACT_BURST,
			hit.frame.pos,
			BURST_SPEED,
			BURST_LIFE,
			hit.radius * BURST_AREA_SCALE,
		);
		this.streak = 0;
		this.camera.shake(11, 300);
		// and the shell rings under the craft
		this.blast.ripple(this.ship.pos);
		this.blast.flash(
			sx,
			sy,
			sz,
			// the shield's own colour, so the light says what was hit
			this.shield > 0 ? SHIELD_FULL_COLOR : SHIELD_EMPTY_COLOR,
			FLASH_SHIELD_INTENSITY,
			FLASH_SHIELD_RANGE,
			FLASH_SHIELD_MS,
		);
		this.pulseShieldFlash();
		this.sinceHitMs = 0;

		// throw them apart, each along its own side of the line between them
		const away = tangentToward(hit.frame.pos, this.ship.pos);
		const toward = tangentToward(this.ship.pos, hit.frame.pos);
		if (away.x !== 0 || away.y !== 0 || away.z !== 0) {
			// far enough that they are no longer touching, which depends on
			// how big the rock is
			// Cleared off the BUBBLE, the same shell it struck, or the push
			// would leave it inside the shield it just bounced off.
			const clearance =
				(hit.radius + SHIP_SHIELD_RADIUS + ROCK_BOUNCE_MARGIN) / hit.altitude;
			hit.frame = nudge(hit.frame, away, -clearance);
			// And point it away, so it leaves rather than grazing along.
			// `away` is the tangent TOWARD the ship, so the heading that
			// leaves along it is that turned a half circle.
			this.deflect(
				hit,
				turn({ pos: hit.frame.pos, heading: away }, Math.PI).heading,
			);
			hit.bounceMs = ROCK_BOUNCE_MS;
		}
		if (toward.x !== 0 || toward.y !== 0 || toward.z !== 0) {
			this.ship = nudge(this.ship, toward, -SHIP_BOUNCE_ARC);
		}

		this.takeShieldHit();
	}

	/**
	 * One impact on the shield, whatever caused it.
	 *
	 * Lifted out of the rock path so a bomb the craft flew into costs exactly
	 * what a rock does: the same bite, the same end of the run when there is
	 * nothing left to absorb it, and the same invulnerability window after, so
	 * one contact cannot be charged twice.
	 */
	private takeShieldHit(): void {
		// One ending per run. The fatal branch below does NOT open an
		// invulnerability window, so without this a second contact in the
		// same frame passed the `invulnMs <= 0` gate in `drainHits` and ran
		// the whole ending again: two death stings an inch apart, two stamp
		// tweens fighting over one transform, two forced shakes. Two rocks at
		// once is routine, which is why `pendingShipHits` is a list.
		if (this.gameOver) {
			return;
		}
		playShieldHit();
		// the punch, held for a few frames. Set before the branch below, so
		// the hit that ENDS the run freezes too and the stamp lands into it
		this.freezeMs = FREEZE_HIT_MS;
		// and in the hands. The branch below decides whether this was a hit
		// or the end of the run, so the rumble is chosen there rather than
		// here: they are the same event to everything above, and very
		// different things to the player.
		rumble(this.shield <= 0 ? RUMBLE_DEATH : RUMBLE_SHIELD_HIT);
		// an impact with nothing left to absorb it is the end of the run
		if (this.shield <= 0) {
			this.pulseAberration();
			this.gameOver = true;
			// and the window every other shield path respects, so nothing
			// queued behind this contact can charge the run again
			this.invulnMs = INVULN_MS;
			this.stampGameOver();
			// WHERE THE CRAFT IS, which is no longer a constant. `(0, 0,
			// SHIP_VIEW_Z)` is the view-axis form this scene used before the
			// camera was posed: back then the craft sat on the view axis by
			// construction, so its scene position never changed and the
			// explosion could be written as a literal. Now the craft is placed
			// by `onGlobe` like everything else and its position follows the
			// player round the globe, so the literal pointed at a fixed spot
			// in the world instead — generally off-screen, and behind the
			// planet for half of it. Same radius as the craft's own placement
			// in `placeWorld`, where the equivalence of the two forms is set
			// out: a view-axis offset of `cz` is a radius of `PLANET_Z - cz`.
			onGlobe(this.ship.pos, PLANET_Z - SHIP_VIEW_Z, PLANET_Z, _at);
			this.blast.burst(
				_at[0],
				_at[1],
				_at[2],
				TINT_SHIP_EXPLOSION,
				SHIP_DEATH_BURST,
				this.ship.pos,
				SHIP_DEATH_BURST_SPEED,
				SHIP_DEATH_BURST_LIFE,
				SHIP_HIT_RADIUS * BURST_AREA_SCALE,
			);
		} else {
			const before = this.shield;
			this.shield = Math.max(0, this.shield - SHIELD_HIT_COST);
			// the hit that empties it, which is the one worth announcing in
			// the middle of the frame rather than only in the corner
			if (before > 0 && this.shield <= 0) {
				this.pulseAberration();
			}
			this.invulnMs = INVULN_MS;
		}
		this.refreshHud();
	}

	/**
	 * Stop the run and put the overlay up.
	 *
	 * `state.pause` rather than a flag of this class's own: it is what every
	 * world child already consults, so one call freezes the craft, the rocks,
	 * the raid, the hunter and the particles together, and the music with
	 * them. A flag here would have stopped only what this method remembered
	 * to check.
	 */
	private openPause(): void {
		this.pause = new PauseMenu(this.app, {
			isFullscreen: () => this.app.isFullscreen(),
			audio: () => {
				if (audio.muted()) {
					audio.unmuteAll();
				} else {
					audio.muteAll();
				}
			},
			isAudioOn: () => !audio.muted(),
			fullscreen: () => {
				if (this.app.isFullscreen()) {
					this.app.exitFullscreen();
				} else {
					this.app.requestFullscreen();
				}
			},
			resume: () => {
				this.closePause();
			},
			quit: () => {
				this.closePause();
				state.change(state.MENU);
			},
		});
		this.pause.open(this.app);
		state.pause(true);
		// `state.pause` reaches the current music track and nothing else, so
		// the saucer's looping drone would play straight through the menu.
		this.raid.setSilenced(true);
	}

	/**
	 * Take the overlay away and let the run carry on.
	 *
	 * Resumed BEFORE anything else: `state.change` needs a running loop, and
	 * leaving a paused state behind would carry the freeze into the title
	 * screen.
	 */
	private closePause(): void {
		state.resume(true);
		this.raid.setSilenced(false);
		if (this.pause !== undefined) {
			this.pause.close(this.app);
			this.pause = undefined;
		}
		// the key that chose an entry is still down
		this.pauseHeld = true;
	}

	/**
	 * Engine heat: the cost of the boost, and the only thing stopping it being
	 * held all game.
	 *
	 * Heat climbs while boosting and cools once the key has been off for
	 * `HEAT_COOL_DELAY_MS`. That delay is what makes tapping pointless, which
	 * matters more than the rates do: without it the optimal input is a rapid
	 * stutter, which is both uglier to play and strictly better than choosing
	 * when to sprint.
	 *
	 * Topping out locks the boost until it has cooled back to `HEAT_RESUME`,
	 * not to zero. Overspending should cost a short next sprint rather than
	 * several seconds as a passenger, because the moment it bites is usually
	 * the moment a panel is about to be hit.
	 * @param wantBoost - whether the player is asking for it
	 * @param dt - frame time, ms
	 * @returns whether the engine actually delivers it
	 */
	private tickHeat(wantBoost: boolean, dt: number) {
		const dts = dt / 1000;
		const boosting = wantBoost && !this.overheated;

		if (boosting) {
			if (!this.boostAudible) {
				// the EDGE, not the state: the breath is half a second long
				// and re-triggering it every frame would be a roar
				this.boostAudible = true;
				playBoost();
			}
			this.sinceBoostMs = 0;
			this.heat = Math.min(HEAT_MAX, this.heat + HEAT_PER_S * dts);
			if (this.heat >= HEAT_MAX && !this.overheated) {
				// The transition, not the state: this runs ONCE per redline,
				// so sitting at the top costs the same as touching it.
				this.overheated = true;
				playOverheat();
				this.camera.shake(HEAT_OVERHEAT_SHAKE, HEAT_OVERHEAT_SHAKE_MS);
				// Not `takeShieldHit`, on purpose. That one ends the run when
				// there is nothing left to absorb it, and dying to a key held
				// too long reads as the interface killing the player. This
				// floors at empty instead: the cost is real and the run
				// remembers it, but the kill still has to come from the world.
				const before = this.shield;
				this.shield = Math.max(0, this.shield - HEAT_OVERHEAT_SHIELD_COST);
				if (before > 0 && this.shield <= 0) {
					// the same announcement a rock gets for emptying it
					this.pulseAberration();
				}
				// And the regen delay restarts, which is the half that makes
				// it a cost at all. Without this the shield simply carries on
				// regenerating through the overheat and the bite is paid back
				// in about a second, which is shorter than the lockout: the
				// player would be spending nothing to redline over and over.
				this.sinceHitMs = 0;
				this.refreshHud();
			}
		} else {
			// armed again, so the next burn is heard starting
			this.boostAudible = false;
			// The clock runs off the KEY, not off `boosting`. Holding the key
			// through an overheat must not be rewarded with an early cooldown,
			// or the punishment is no punishment at all.
			if (wantBoost) {
				this.sinceBoostMs = 0;
			} else {
				this.sinceBoostMs += dt;
			}
			if (this.sinceBoostMs >= HEAT_COOL_DELAY_MS) {
				this.heat = Math.max(0, this.heat - HEAT_COOL_PER_S * dts);
			}
			if (this.overheated && this.heat <= HEAT_RESUME) {
				this.overheated = false;
			}
		}

		// Full red at HEAT_RESUME rather than at the top, because that is the
		// threshold the player has to act on: red means the boost is locked
		// out, out of the red means it is usable again. Above HEAT_RESUME the
		// colour stays put and the FILL carries on, which reads as how deep
		// into the red you are.
		const ramp = Math.min(1, this.heat / HEAT_RESUME);
		_heatColor.copy(_heatCold).lerp(_heatHot, ramp);
		this.heatBar.value = this.heat;
		// Locked out, and the bar says so rather than leaving the player to
		// work out why the key has stopped working: it blinks on the same
		// clock the empty shield uses, so the two read as one language.
		this.heatBar.setOpacity(
			this.overheated &&
				Math.floor((this.clock * 1000) / SHIELD_EMPTY_BLINK_MS) % 2 !== 0
				? 0.3
				: 1,
		);
		return boosting;
	}

	/**
	 * Flash the shield shell on impact.
	 *
	 * The curve used to be written out as `(flashMs / SHIELD_FLASH_MS) ** 2`
	 * at the point the uniform was fed, which is a quadratic ease spelled by
	 * hand. `Quadratic.In` is the same curve, named.
	 */
	private pulseShieldFlash(): void {
		this.flashTween?.stop();
		this.flashDriver.k = 1;
		const tween = new Tween(this.flashDriver);
		tween.updateWhenPaused = true;
		this.flashTween = tween
			.to({ k: 0 }, { duration: SHIELD_FLASH_MS })
			.easing(Tween.Easing.Quadratic.In)
			.onComplete(() => {
				this.flashTween = undefined;
			})
			.start();
	}

	/**
	 * Kick the chromatic aberration, which then decays on its own.
	 *
	 * A `Tween` rather than a countdown in `update`: this is a one-shot with a
	 * fixed duration and a known endpoint, which is exactly what a tween is,
	 * and the curve that used to be a hand-written `k * k` is now the easing.
	 *
	 * Re-triggering STOPS the one in flight rather than letting two tweens
	 * write the same uniform: a second hit during the first pulse should
	 * restart it from the peak, not fight over it.
	 */
	private pulseAberration(): void {
		this.aberrationTween?.stop();
		this.aberrationDriver.k = 1;
		this.aberration.enabled = true;
		const tween = new Tween(this.aberrationDriver);
		// the death pulse has to play out past the end of the run
		tween.updateWhenPaused = true;
		this.aberrationTween = tween
			.to({ k: 0 }, { duration: ABERRATION_MS })
			.easing(Tween.Easing.Quadratic.In)
			.onUpdate(() => {
				this.aberration.setOffset(ABERRATION_PEAK * this.aberrationDriver.k);
			})
			.onComplete(() => {
				this.aberration.enabled = false;
				this.aberrationTween = undefined;
			})
			.start();
	}

	/**
	 * Stamp GAME OVER onto the screen.
	 *
	 * A `Tween` on `Back.Out` rather than a hand-rolled curve: on a scale
	 * coming DOWN to 1 that easing overshoots past the target and springs
	 * back, which IS the stamp. Written by hand it was a fall, an overshoot
	 * and a settle as three phases that had to be kept in step with each
	 * other; the curve already knows how to do that.
	 *
	 * The scale is applied by resetting the transform and reapplying it,
	 * because `Renderable.scale` MULTIPLIES into `currentTransform`: fed an
	 * absolute figure once a frame it would compound away to nothing.
	 *
	 * `updateWhenPaused`, because the run is over and the fight has stopped:
	 * this has to keep running when nothing else does.
	 */
	private stampGameOver(): void {
		// see `overSelectHeld`: the player is probably still firing
		this.overSelectHeld = true;
		// The fight's music goes with the fight: faded out from here rather
		// than left to the stage's teardown, because the run ends HERE and
		// the player sits on GAME OVER for as long as they like. A hard cut
		// would also read as a bug rather than as an ending, hence the fade.
		audio.fade(BATTLE_MUSIC, BATTLE_MUSIC_VOLUME, 0, OVER_MUSIC_FADE_MS);
		// The saucer goes home. Both endings pass through here, which is the
		// only reason it is this method's business: `updateUfo` sits BELOW
		// the game-over gate, so left alone the saucer freezes mid-raid at
		// whatever phase it held and its looping drone, which only
		// `showUfo(false)` ever pauses, plays on over the whole game-over
		// screen. A raid is in the sky for roughly half of all deaths.
		this.raid.recall();
		this.hunter.recall();
		// Both endings come through here, the emptied shield and the breached
		// dome, so this is the one place the last sound belongs.
		playGameOver();
		const driver = { scale: OVER_STAMP_FROM, alpha: 0 };
		this.overLabel.currentTransform.identity();
		this.overLabel.scale(OVER_STAMP_FROM);
		this.overLabel.setOpacity(0);
		this.overHint.setOpacity(0);

		const stamp = new Tween(driver);
		this.stampTween = stamp;
		stamp.updateWhenPaused = true;
		stamp
			.to({ scale: 1, alpha: 1 }, { duration: OVER_STAMP_MS })
			.easing(Tween.Easing.Back.Out)
			.onUpdate(() => {
				this.overLabel.currentTransform.identity();
				this.overLabel.scale(driver.scale);
				// clamped, because `Back.Out` overshoots and an opacity past 1
				// is not a thing: the word simply arrives fully opaque a little
				// before it lands, which is what you want anyway
				this.overLabel.setOpacity(math.clamp(driver.alpha, 0, 1));
			})
			.onComplete(() => {
				// the thump, on the frame it touches down
				// `force`, the fifth argument: a shake already in flight makes
				// `shake()` return without doing anything, and the hit that
				// ended the run has usually just fired one of its own.
				this.camera.shake(
					OVER_SHAKE,
					OVER_SHAKE_MS,
					undefined,
					undefined,
					true,
				);
				this.fadeInHint();
			})
			.start();
	}

	/**
	 * Bring the menu prompt up after the stamp, so the two do not arrive
	 * together.
	 */
	private fadeInHint(): void {
		const driver = { alpha: 0 };
		const fade = new Tween(driver);
		this.hintTween = fade;
		fade.updateWhenPaused = true;
		fade
			.to(
				{ alpha: 1 },
				{ duration: OVER_HINT_FADE_MS, delay: OVER_HINT_DELAY_MS },
			)
			.easing(Tween.Easing.Cubic.Out)
			.onUpdate(() => {
				this.overHint.setOpacity(math.clamp(driver.alpha, 0, 1));
			})
			.start();
	}

	/**
	 * Count the NEW BEST banner down.
	 *
	 * Its own method because it has to keep running past the game-over gate,
	 * while everything it used to sit inside must not.
	 * @param dt - frame time, ms
	 */
	private tickNewBest(dt: number): void {
		if (this.newBestMs > 0) {
			this.newBestMs -= dt;
			if (this.newBestMs <= 0) {
				this.newBestMs = 0;
				// the HUD redraws only when something asks it to, and nothing
				// else in this path does: without it the banner stays lit
				this.refreshHud();
			}
		}
	}

	/**
	 * The shield's own frame: what it has left, and how that reads.
	 *
	 * Regeneration is on a delay rather than continuous, so a hit actually
	 * costs something: fly clear for a couple of seconds and it starts
	 * coming back, stay in the rocks and it does not.
	 *
	 * Empty is a state, not an end. The bar blinks red and the bubble goes
	 * with it, which is the warning that the next contact is the last one.
	 * @param dt - frame time in milliseconds
	 */
	private tickShield(dt: number): void {
		this.sinceHitMs += dt;
		if (this.sinceHitMs >= SHIELD_REGEN_DELAY_MS && this.shield < SHIELD_MAX) {
			this.shield = Math.min(
				SHIELD_MAX,
				this.shield + (SHIELD_REGEN_PER_S * dt) / 1000,
			);
		}
		// Red at the edges once the shield is genuinely low, throbbing once
		// it is gone. Driven from the same number the bar reads, so the two
		// can never disagree about how much trouble the player is in.
		const low = Math.max(0, DAMAGE_FROM - this.shield) / DAMAGE_FROM;
		const throb =
			this.shield > 0
				? 1
				: 0.72 + 0.28 * Math.sin(this.clock * DAMAGE_THROB_HZ);
		this.damage.setOpacity(low * DAMAGE_MAX * throb);

		// the channel split, decaying and then switched off again

		// empty blinks; anything else holds steady
		const empty = this.shield <= 0;
		const lit =
			!empty || Math.floor(this.sinceHitMs / SHIELD_EMPTY_BLINK_MS) % 2 === 0;

		// One colour for the shield, wherever it is shown: the bubble around
		// the craft and the bar in the corner take the same mix, so the
		// readout is the thing on the ship rather than a gauge about it
		_shieldColor.copy(_shieldEmpty).lerp(_shieldFull, this.shield);
		// The colour is already in `_shieldColor`, which the bar holds, so the
		// value is the whole of it. The old code wrote `currentTransform` by
		// hand to resize the fill, bypassing `Renderable.scale`, which left
		// the quad's BOUNDS at full width however far the shield had drained.
		this.shieldBar.value = this.shield;
		this.shieldBar.setOpacity(lit ? 1 : 0.18);

		const flash = this.flashDriver.k;
		// the shell reads the same colour the bar does, as a linear triple
		_shieldRgb[0] = _shieldColor.r / 255;
		_shieldRgb[1] = _shieldColor.g / 255;
		_shieldRgb[2] = _shieldColor.b / 255;
		// Wrapped HERE, in double precision, rather than in the shader from a
		// clock that only grows: see `shield.ts`.
		this.shieldFx.setUniform("uSpinA", wrapAngle(this.clock * SHIELD_SPIN_A));
		this.shieldFx.setUniform("uSpinB", wrapAngle(this.clock * SHIELD_SPIN_B));
		this.shieldFx.setUniform("uColor", _shieldRgb);
		this.shieldFx.setUniform("uImpact", flash);
		this.shieldFx.setTime(this.clock);
		// the impact lifts the quad's alpha, but nowhere near to 1: that is a
		// second multiplier on top of the shader's own flood, and the two
		// together are what turned a hit into a white ring
		this.shieldBubble.setOpacity(
			lit ? SHIELD_BUBBLE_ALPHA + (0.82 - SHIELD_BUBBLE_ALPHA) * flash : 0.22,
		);
	}

	override update(dt: number): boolean {
		// The breach runs on the REAL frame delta, and everything else on a
		// slowed one. Taken in that order deliberately: the sequence has to
		// last the wall-clock time it was written for, while the scene it is
		// tearing apart hangs.
		this.dome.tickShatter(dt);
		if (this.dome.shatterMs > 0) {
			dt *= SHATTER_TIME_SCALE;
		}
		const dts = dt / 1000;
		// What the engine reported while it was walking the world, applied
		// now that nothing is mid-walk. First thing in the frame, so a hit
		// lands before the thing that took it is moved again.
		this.drainHits();
		// the pools' shader clock, advanced whether or not the game is over
		// so a bolt in flight at the last frame does not freeze mid pulse
		this.clock += dts;
		this.tickNewBest(dt);
		// Effects that are already DECAYING carry on past the gate, because a
		// flash caught halfway reads as a freeze rather than as an ending.
		// Everything that is a live system stops below.
		this.blast.tickFlashes(dt);
		this.blast.tickShocks(dt);

		if (this.gameOver) {
			// Back to the menu on a FRESH press of either select key.
			//
			// The edge matters more here than anywhere: the player is almost
			// certainly holding fire at the moment they die, so reading the
			// key level would bounce them past the GAME OVER screen on the
			// very frame it appeared. `overSelectHeld` starts true for that
			// reason and only clears once both keys are up.
			//
			// `fire` and `menuSelect` are the same pair the title screen
			// treats as one "select", so space and enter both work and
			// neither needs rebinding on the way in or out.
			const select =
				input.isKeyPressed("fire") || input.isKeyPressed("menuSelect");
			if (!select) {
				this.overSelectHeld = false;
			} else if (!this.overSelectHeld) {
				this.overSelectHeld = true;
				state.change(state.MENU);
				return true;
			}
			this.placeWorld();
			return true;
		}

		// ── pause ────────────────────────────────────────────────────
		// After the game-over gate on purpose: a finished run has nothing to
		// pause, and the key that leaves it is already spoken for there.
		if (this.pause !== undefined) {
			// The overlay drives itself, which it can only do because it sets
			// `updateWhenPaused`; everything here is frozen until it calls
			// back. Nothing else in this method may run while it is up.
			return true;
		}
		if (input.isKeyPressed("menuBack")) {
			if (!this.pauseHeld) {
				this.pauseHeld = true;
				this.openPause();
				return true;
			}
		} else {
			this.pauseHeld = false;
		}

		// ── hit freeze ───────────────────────────────────────────────
		// The same split the game-over gate makes, for a few frames: the
		// clock, the flashes, the shocks and the score numbers above have
		// already run, the particles are world children and keep going on
		// their own, and the camera shake is a camera effect the engine
		// drives. What stops is the fight, which is the whole point. Taking
		// the existing early return rather than scaling `dt` down, because a
		// slowed step still MOVES everything, and a freeze that drifts is
		// not a freeze.
		if (this.freezeMs > 0) {
			this.freezeMs = Math.max(0, this.freezeMs - dt);
			this.placeWorld();
			return true;
		}

		// ── past here is the fight, and the fight is over ────────────
		// The rocks already stopped here, further down, and these four used
		// to run above the gate and carry on without them: warning panes
		// pulsing on a dome that no longer exists, bombs counting down to
		// crack glass that `crackPane` would refuse anyway, a shield shell
		// still turning around a craft with nothing left to defend, and a
		// saucer running a bombing raid on a finished run. `tickPanes` was
		// the visible one: it writes the pulse opacity over the fade
		// `tickShatter` had just put on the same decals, in the same frame,
		// so the warnings came back to full brightness as the dome went.
		this.tickShield(dt);
		this.tickPrize(dt);
		this.dome.tickPanes(dt);
		this.raid.tick(dt);
		this.hunter.tick(dt);
		this.runDeferred(dt);

		if (this.invulnMs > 0) {
			this.invulnMs -= dt;
			// Blink only over the last stretch, which is the length of the
			// window a HIT opens. A prize ward runs for seconds, and a craft
			// strobing for eight of them reads as a fault rather than as
			// protection; it still blinks as the ward runs out, which is the
			// warning the player wants.
			this.shipMesh.setOpacity(
				this.invulnMs <= INVULN_MS && Math.floor(this.invulnMs / 90) % 2
					? 0.25
					: 1,
			);
			if (this.invulnMs <= 0) {
				this.shipMesh.setOpacity(1);
			}
		}

		// ── fly ──────────────────────────────────────────────────────
		// Left and right apply a turn RATE rather than a target heading, so
		// holding one rotates the craft continuously: through a full circle
		// and on round, with no limit to stop against. That is what lets the
		// ship reach any direction on the globe, since its heading can be
		// anything and it always flies where it points.
		let turning = 0;
		if (input.isKeyPressed("left")) {
			turning -= SHIP_TURN_RATE * dts;
		}
		if (input.isKeyPressed("right")) {
			turning += SHIP_TURN_RATE * dts;
		}
		if (turning !== 0) {
			this.ship = turn(this.ship, turning);
			// the same angle the model is drawn at, kept in (-PI, PI] so a
			// long flight cannot walk it off into a range where the sine
			// and cosine below lose their precision
			this.yaw = wrapAngle(this.yaw + turning);
		}

		// What the player ASKED for, against what the engine will give them.
		// The two differ while it is overheated, and every reader below wants
		// the second one: the plume, the speed, the nose-down pitch and the
		// camera push all have to agree that nothing is happening.
		const wantBoost = input.isKeyPressed("boost");
		const boosting = this.tickHeat(wantBoost, dt);
		// the plume follows the key rather than matching it: see ENGINE_DAMP
		this.thrust = math.damp(this.thrust, boosting ? 1 : 0, ENGINE_DAMP, dts);
		this.boosting = boosting;
		this.ship = advance(this.ship, this.shipSpeed() * dts);

		// Attitude follows what the craft is doing: it banks into the turn it
		// is making and pitches the nose down under thrust, which is the only
		// cue the speed gives over open ocean.
		const wantBank = -SHIP_BANK * Math.sign(turning);
		const wantPitch = boosting ? SHIP_PITCH : 0;
		this.bank = math.damp(this.bank, wantBank, SHIP_ATTITUDE_DAMP, dts);
		this.pitch = math.damp(this.pitch, wantPitch, SHIP_ATTITUDE_DAMP, dts);
		// the attitude is applied in `placeWorld`, built from the SAME basis
		// the camera is posed with, so the two cannot drift apart by a frame

		// ── shoot ────────────────────────────────────────────────────
		this.fireCooldownMs -= dt;
		if (input.isKeyPressed("fire") && this.fireCooldownMs <= 0) {
			this.fire();
			this.fireCooldownMs = FIRE_INTERVAL_MS;
		}

		for (let i = this.bolts.length - 1; i >= 0; i--) {
			const b = this.bolts[i];
			b.ageMs += dt;
			b.frame = advance(b.frame, BULLET_SPEED * dts);
			// The hunter is shot by an ARC test rather than a body, unlike
			// the rocks and the bombs. It is the only target that is never
			// hit by anything except a bolt, so a shape in the broadphase
			// would be carried every frame to answer one question this loop
			// is already in the right place to ask.
			const quarry = this.hunter.at;
			if (
				quarry !== undefined &&
				arcBetween(b.frame.pos, quarry) * _hitShell <
					this.hunter.hitRadius + BOLT_HIT_RADIUS
			) {
				if (!b.pierces) {
					this.removeBolt(i);
					this.hunter.hit();
					continue;
				}
				// A lance flies on and counts once, as it does against a
				// rock: it overlaps the hunter for several frames, and
				// without the record one shot took all seven of its hits in
				// as many frames.
				if (!b.through.includes(this.hunter)) {
					b.through.push(this.hunter);
					this.hunter.hit();
				}
			}
			if (b.ageMs >= BULLET_LIFE_MS) {
				this.removeBolt(i);
			}
		}

		// ── drift ────────────────────────────────────────────────────
		for (const d of this.drifters) {
			// a rock that was just bounced off the shield flies straight for
			// a moment; homing the instant it is thrown clear just turns it
			// round and grinds it against the bubble
			if (d.bounceMs > 0) {
				d.bounceMs -= dt;
			} else {
				d.frame = steerToward(d.frame, this.ship.pos, ROCK_STEER_RATE * dts);
			}
			d.frame = advance(d.frame, d.speed * dts);
			// its own turning, independent of where it is going
			d.spinPhase += d.spinRate * dts;

			// Out of collision until it arrives. A rock's shape sits on the
			// shared shell so its ground track is what collides, and while it
			// is still falling its ground track is not in the field yet: a
			// bolt would break a rock a thousand units overhead, and the
			// craft would take a hit from one. `isActive` is the engine's own
			// per-shape switch for exactly this.
			d.hit.isActive = d.entryMs <= 0;

			// still falling in: accelerating, the way something falling does
			if (d.entryMs > 0) {
				d.entryMs -= dt;
				const t = Math.max(0, d.entryMs / ROCK_ENTRY_MS);
				const fall = 1 - t * t;
				d.altitude =
					ROCK_ENTRY_ALTITUDE + (d.restAltitude - ROCK_ENTRY_ALTITUDE) * fall;
				if (d.entryMs <= 0) {
					d.altitude = d.restAltitude;
				}
			}

			// the radioactive ones breathe, so they are the thing the eye
			// finds first. Skipped while a hit flash owns the emissive.
			if (d.kind === "bonus" && d.flashMs <= 0 && d.baseEmissive) {
				const k =
					1 + BONUS_PULSE * Math.sin(this.clock * BONUS_PULSE_HZ + d.spin);
				d.baseEmissive[0] = BONUS_EMISSIVE[0] * k;
				d.baseEmissive[1] = BONUS_EMISSIVE[1] * k;
				d.baseEmissive[2] = BONUS_EMISSIVE[2] * k;
				d.haloAlpha = HALO_ALPHA * k;
			}

			// the hit flash, burning off
			if (d.flashMs > 0) {
				d.flashMs -= dt;
				if (d.flashMs <= 0) {
					// back to whatever it glows with normally, which for ice
					// is its own blue and for rock is nothing at all. Cleared
					// rather than faded out, so a rock cannot spend the rest
					// of its life glowing a few percent.
					d.model.emissive = d.baseEmissive;
				} else {
					const k = (d.flashMs / ROCK_FLASH_MS) ** 1.4;
					// WHERE on the ramp this hit sits: 0 at full health, 1 on
					// the one that leaves a single hit in it. A one hit rock
					// has no ramp to climb and goes straight to the hot end.
					const spent = d.hpMax > 1 ? 1 - (d.hp - 1) / (d.hpMax - 1) : 1;
					// and WHICH hot end, by what the next hit will do. Amber
					// is more targets, red is gone: a radioactive rock never
					// splits, so red is the only one it can reach.
					const hot =
						d.kind !== "bonus" && d.grade >= ROCK_SPLIT_MIN_GRADE
							? ROCK_FLASH_SPLIT
							: ROCK_FLASH_LAST;
					for (let c = 0; c < 3; c++) {
						d.flashRgb[c] =
							(ROCK_FLASH_HIT[c] + (hot[c] - ROCK_FLASH_HIT[c]) * spent) * k;
					}
					d.model.emissive = d.flashRgb;
				}
			}
		}

		this.spawnTimerMs -= dt;
		if (this.spawnTimerMs <= 0) {
			if (this.drifters.length < ROCK_MAX) {
				this.spawnDrifter();
			}
			this.spawnTimerMs = ROCK_SPAWN_INTERVAL_MS;
		}

		// Positions last: the narrowphase measures collision shapes in scene
		// coordinates, so everything has to be where it now is before the
		// world update that follows this asks what is touching what.
		this.tickCamera(dt);
		this.placeWorld();
		return true;
	}

	/**
	 * Lay the craft flat on the globe and lean it into what it is doing.
	 *
	 * The ship is the one thing in the scene that never has to be projected:
	 * the view is BUILT from its own surface frame, so it sits at the near
	 * pole every frame, so its orientation is a constant, plus how far it has
	 * turned away from the view, plus whatever lean the controls ask for.
	 *
	 * The constant is the part that was missing. Left alone the model keeps
	 * the orientation it was authored in, nose toward the camera, and reads
	 * as a craft hovering nose-on rather than one flying over a surface. The
	 * first rotation tips it onto its belly with the nose up the screen; the
	 * second turns it the right way up, since the first leaves the canopy
	 * pointing into the planet.
	 */
	private applyShipAttitude(): void {
		const ct = this.shipMesh.currentTransform;
		// Built from the craft's OWN surface frame, in world terms, the same
		// way every rock is. It used to be worked out in screen terms and
		// then carried round to wherever the camera stood, which made the
		// craft the only thing in the scene whose orientation depended on
		// where the camera was looking.
		//
		// The explicit `-yaw` turn is gone with it: `this.ship`'s heading
		// already carries the steering, and the view swings the other way by
		// the same amount, so the craft comes out pointing where it is going
		// without anything being told about the view at all.
		craftMatrix(this.ship, ct);
		// bank rolls about the nose and pitch about the wing line, both in
		// the craft's own frame, which is what `rotate` post-multiplying means
		ct.rotate(this.bank, AXIS_Z);
		ct.rotate(this.pitch, AXIS_X);
	}

	/**
	 * Slide the camera toward what the player is asking the ship to do.
	 *
	 * The ship holds the middle of the frame by construction, so without
	 * this the view is rigid: steering rolls the globe and nothing else
	 * moves. Sliding the camera instead swings the near geometry across the
	 * far geometry, and the gap between the two is what the eye reads as
	 * depth. The planet takes the whole slide; the backdrop takes the
	 * fraction of it {@link SKY_PARALLAX} allows, which is what makes the
	 * two read as being at different distances.
	 *
	 * Damped rather than snapped, or the backdrop jitters on every tap.
	 * @param dt - frame time in milliseconds
	 */
	private tickCamera(dt: number): void {
		const dts = dt / 1000;
		// The craft's OWN axes, on screen. Everything the camera does is
		// stated in these rather than in screen x and y, because the craft
		// turns as it steers: "up" and "left" name a different direction
		// every moment, so a pan written that way slid the globe the same
		// way whichever way the player was actually flying. Boosting east
		// swung the view south.
		//
		// The nose sits at `(sin yaw, -cos yaw)` — the same expression the
		// exhaust negates for the tail — and the side axis is a quarter turn
		// from it. At `yaw = 0` these are exactly screen up and screen right,
		// so flying straight is unchanged.
		const noseX = Math.sin(this.yaw);
		const noseY = -Math.cos(this.yaw);
		const sideX = -noseY;
		const sideY = noseX;

		let wantX = 0;
		let wantY = 0;
		// the lean into a turn, across the craft rather than across the screen
		const lean =
			(input.isKeyPressed("right") ? 1 : 0) -
			(input.isKeyPressed("left") ? 1 : 0);
		wantX += CAM_PAN_X * lean * sideX;
		wantY += CAM_PAN_X * lean * sideY;
		// `thrust`, not the key: while overheated the key is down and nothing
		// is happening, and a camera that pushed anyway would promise a speed
		// the craft is not making.
		if (this.thrust > 0.5) {
			// along the nose, in proportion to it, so the globe slides the
			// opposite way: the shift the player reads is the INVERSE of
			// where the craft is going, whichever way that happens to be.
			wantX += CAM_PAN_Y * noseX;
			wantY += CAM_PAN_Y * noseY;
		}
		// `math.damp` is the engine's exponential approach, frame-rate
		// independent: the same curve this used to spell out by hand, and
		// the same one the title screen's saucer leans with.
		this.panX = math.damp(this.panX, wantX, CAM_PAN_DAMP, dts);
		this.panY = math.damp(this.panY, wantY, CAM_PAN_DAMP, dts);
		// The camera itself is placed in `placeWorld`, which runs straight
		// after this: where it stands depends on the player's surface frame,
		// and the backdrop has to be carried round with it.
	}

	/**
	 * The surface frame the view is built on: where the player is, turned by
	 * however far the view has swung off the craft's own heading.
	 * @returns the viewer's frame
	 */
	private viewFrame(): SurfaceFrame {
		return turn(this.ship, -this.yaw);
	}

	/**
	 * Put the WARNING banner up for a committed bombing run.
	 *
	 * One at a time. Raids do not overlap today, but a banner that stacked
	 * would draw the word twice at two different offsets, which reads as a
	 * bug rather than as emphasis.
	 */
	private warnOfRaid(): void {
		if (this.warning !== undefined && !this.warning.finished) {
			return;
		}
		const banner = new WarningBanner(this.app);
		this.warning = banner;
		this.hudLayer.addChild(banner, WARNING_Z);
	}

	/**
	 * Tell a caster which patch of glass its blob lands on.
	 *
	 * On a sphere "down" is RADIAL, so the floor is a different plane for
	 * every caster and it moves as the caster drifts: the point on the dome
	 * directly below it, and the outward normal there, restated every frame.
	 * `shadowGroundPoint` is what lets the blob leave the caster's own
	 * vertical column to follow it.
	 *
	 * The surface point is already a unit vector, so the normal is free.
	 * Both setters copy, so one pair of scratch vectors serves every caster.
	 * @param mesh - the caster
	 * @param q - its unit surface point
	 */
	private layShadow(mesh: Mesh, q: Vector3d): void {
		// The PANE under it, not the sphere through it.
		//
		// The dome is a geodesic polyhedron: its corners are on the sphere,
		// but every pane is a flat chord plane strung between them and sunk
		// below it by a sagitta, 9.3 units on a hexagon and 5.6 on a pentagon
		// (measured in `Dome`). A contact computed on the SPHERE is wrong
		// twice over. It hangs above the glass by that sagitta, which runs
		// from zero at a pane's corner to its full value at the middle, so no
		// single lift can cancel it; and its normal is the sphere's, tilted
		// off the pane's own by up to half a pane, so the blob lies at an
		// angle to the glass it is supposed to be resting on. Olivier saw
		// both: "some are angled, and they dont lie flat on the dome".
		//
		// The pane states its own plane, so ask it. `paneDist` is that
		// plane's distance from the centre and `panes[i]` is its normal, both
		// recovered from the model's real geometry, so this cannot drift from
		// what is drawn.
		const pane = this.dome.paneAt(q);
		const n = this.dome.panes[pane];
		// where the ray along `q` meets that plane
		const reach = this.dome.paneDist[pane] / dot(q, n);
		onGlobe(q, reach + ROCK_SHADOW_LIFT, PLANET_Z, _contact);
		_shadowAt.set(_contact[0], _contact[1], _contact[2]);
		_shadowUp.set(n.x, n.y, n.z);
		mesh.shadowGroundPoint = _shadowAt;
		mesh.shadowGroundNormal = _shadowUp;
	}

	/**
	 * Tear the run down on the way back to the menu.
	 *
	 * A death now returns to the title and a new game builds a fresh scene,
	 * so this runs once per game rather than never. The stage's own reset
	 * destroys world CHILDREN; what it cannot see is everything sitting idle
	 * in a pool, the tweens still in flight, and a looping audio voice.
	 */
	destroy(): void {
		this.stampTween?.stop();
		this.hintTween?.stop();
		this.flashTween?.stop();
		this.aberrationTween?.stop();
		this.clearPops();
		this.raid.destroy();
		this.hunter.destroy();
		this.blast.destroy();
		// Idle bolts and bombs, which are in no container. Only the shader
		// clones are freed: see the note in `BlastFx.destroy` about
		// `Renderable#destroy` being `@internal`.
		for (const v of this.boltPool) {
			v.glowFx.destroy();
		}
		this.boltPool.length = 0;
	}

	/**
	 * Pose the camera and write every renderable's scene position. This is
	 * the only place the sphere meets the engine.
	 *
	 * The camera is POSED from the player's surface frame rather than the
	 * world being counter-rotated into a fixed camera. The globe is then a
	 * fixed object in a fixed place, which is what it is, and the rotation
	 * that used to be applied by hand to every single renderable is carried
	 * once by the view matrix.
	 */
	private placeWorld(): void {
		const view = this.viewFrame();
		const basis = viewBasis(view);
		// where the camera stands: straight out from the player's own point
		// on the surface, which puts the craft at the middle of the screen at
		// every point on the sphere with no special case anywhere
		viewOrigin(view, PLANET_Z, PLANET_Z, _origin);

		// `up` and `out` negated: `setBasis` takes the camera's OWN columns,
		// and its +Y runs DOWN the screen under this engine's Y-down space
		// while its +Z runs away from it. Both are the opposite of how the
		// game states them.
		_camRight.set(basis.right.x, basis.right.y, basis.right.z);
		_camUp.set(-basis.up.x, -basis.up.y, -basis.up.z);
		_camFwd.set(-basis.out.x, -basis.out.y, -basis.out.z);
		this.camera.setBasis(_camRight, _camUp, _camFwd);
		// the pan slides the camera PAST everything pinned to the view, which
		// is what swings the near geometry across the far geometry
		fromView(basis, _origin, this.panX, this.panY, 0, _at);
		this.camera.setPosition(_at[0], _at[1], _at[2]);
		// kept, because `_at` is scratch and everything below writes over it,
		// and because `camera.pos` is typed 2D even though it holds three
		// components. These are the same numbers, with no cast to read `z`.
		_camAt[0] = _at[0];
		_camAt[1] = _at[1];
		_camAt[2] = _at[2];

		// and the sun with it. `SUN_DIRECTION` is over the viewer's shoulder,
		// which is a fact about the VIEW, so it is turned into the world here
		// rather than being a fixed direction the player flies out of.
		viewToWorld(basis, _mat);
		const [sx, sy, sz] = SUN_DIRECTION;
		// `.val` because this reads the matrix rather than handing it to a
		// renderable: `Matrix3d` keeps its sixteen numbers there.
		const m = _mat.val;
		this.sun.direction.set(
			m[0] * sx + m[4] * sy + m[8] * sz,
			m[1] * sx + m[5] * sy + m[9] * sz,
			m[2] * sx + m[6] * sy + m[10] * sz,
		);

		this.applyShipAttitude();

		// The craft and everything stuck to it sit ON THE SPHERE, placed the
		// same way as the globe and the rocks. They used to be placed from
		// the camera's own frame, which made them the only things in the
		// scene whose world position depended on where the camera was
		// looking; `onGlobe` takes a surface point and a radius and nothing
		// else. Algebraically it is the same point — a view-axis offset of
		// `cz` is a radius of `PLANET_Z - cz` — but it no longer routes the
		// craft's position through the view basis to get there.
		onGlobe(view.pos, PLANET_Z - SHIP_VIEW_Z, PLANET_Z, _at);
		this.shipMesh.setPosition(_at[0], _at[1], _at[2]);
		// and the craft's own blob on the glass directly below it, by the
		// same rule the rocks use
		this.layShadow(this.shipMesh, view.pos);
		// the craft's collision sphere rides on the shell, not at its own
		// altitude: that is the surface a rock has to reach to hit it
		onGlobe(view.pos, _hitShell, PLANET_Z, _at);
		shapeToShell(this.shipHit, this.shipMesh, _at[0], _at[1], _at[2]);
		// The shell goes on the craft and a hull NEARER the camera, which is a
		// change in DEPTH and nothing else.
		//
		// It used to ask `onGlobe` for a bigger radius, the way everything
		// else here gets its altitude. A radius scales all three components,
		// so that slid the shell a whole SHIP_SIZE across the screen as well
		// as out, and left it four units BEHIND the craft rather than in
		// front. It passed for correct because the quad is
		// {@link SHIELD_BUBBLE_SCALE} times the hull, so a shell a hull off
		// centre still had the craft inside it, and additive blending hides a
		// depth error. The hunter wears the same shell well off-axis, where
		// the same offset was plainly visible, which is how it was caught.
		//
		// Toward the CAMERA, not along any world axis. Perspective puts two
		// points at the same screen position only when they share a ray from
		// the eye, so lifting the shell straight toward the screen plane
		// moved it off the hull again, just less.
		onGlobe(view.pos, PLANET_Z - SHIP_VIEW_Z, PLANET_Z, _at);
		stepToward(_at, _camAt, SHIP_SIZE, _at);
		this.shieldBubble.setPosition(_at[0], _at[1], _at[2]);
		// A hair BEHIND the planet's centre — note the negative radius, which
		// puts it 6 units the other side — so the transparent pass sorts the
		// globe in front of it rather than the other way about. The band of
		// lit air is what shows past the limb, and it only reads as
		// atmosphere while the planet is covering its middle.
		onGlobe(view.pos, -6, PLANET_Z, _at);
		this.airShell.setPosition(_at[0], _at[1], _at[2]);

		// The globe and its shell no longer turn: they are a fixed object at
		// a fixed place and the CAMERA goes round them, which is what is
		// actually happening. Five per-frame matrix writes gone.

		// the starfield, pinned to the view and parallaxed by a fraction of
		// the pan, so it drifts against the globe instead of sitting behind
		// it like a painted flat
		for (const layer of this.sky) {
			fromView(
				basis,
				_origin,
				layer.baseX + this.panX * layer.pan,
				layer.baseY + this.panY * layer.pan,
				layer.baseZ,
				_at,
			);
			layer.sprite.setPosition(_at[0], _at[1], _at[2]);
		}

		for (const d of this.drifters) {
			onGlobe(d.frame.pos, d.altitude, PLANET_Z, _at);
			d.model.setPosition(_at[0], _at[1], _at[2]);
			// The floor this rock's blob lands on: the point on the dome
			// RADIALLY below it, and the outward normal there. Both change
			// per rock and per frame, which is the whole difference between
			// a sphere and a floor, and `shadowGroundPoint` is what lets the
			// blob leave the caster's vertical column to follow it.
			//
			// The surface point is the drifter's own `frame.pos`, already a
			// unit vector, so the normal costs nothing to state.
			this.layShadow(d.model, d.frame.pos);
			// Bridged, because the rock mesh is `rightHanded` and so renders
			// through `diag(1, -1, -1)`. Fed the raw surface point, the frame
			// that reached the screen stood the rock on `(q.x, -q.y, -q.z)`,
			// which is `q` turned a half circle about the x axis: the error is
			// `acos(2*q.x^2 - 1)`, so a rock anywhere near the `x = 0` meridian
			// was simply upside down. Hard to catch by eye on an irregular
			// lump, which is why it survived; it is the same defect as the
			// glow pool below and the saucer above.
			bridgeY(d.frame.pos, true, _bridged);
			// Its own heading as the tangent, bridged the same way so the two
			// agree. Without it the basis falls back on a world axis chosen by
			// `|q.y| < 0.9`, and a rock drifting over that boundary is handed a
			// different tangent from one frame to the next: measured, the jump
			// runs to a HALF TURN depending on where it crosses. A heading is
			// continuous because the motion that maintains it is.
			_bridgedTan.x = d.frame.heading.x;
			_bridgedTan.y = -d.frame.heading.y;
			_bridgedTan.z = -d.frame.heading.z;
			surfaceMatrixWorld(_bridged, d.model.currentTransform, _bridgedTan);
			// And its own turn on top, about LOCAL up.
			//
			// `Matrix3d.rotate` post-multiplies, so the axis it is handed is
			// read in the matrix's own space, and the frame above has just put
			// the surface normal on local Y. Rotating about it mixes columns 0
			// and 2 with each other and leaves column 1 untouched, which is
			// exactly the invariant the ground shadow needs: the rock stays
			// upright, so its blob keeps a full footprint and turns with it.
			//
			// This is also what makes the mesh immune to a bounce. The frame
			// below it is built from the heading and does jump when the
			// heading is reflected; `deflect` adds that same jump to
			// `spinPhase`, and the two cancel in the product.
			d.model.currentTransform.rotate(d.spinPhase, _LOCAL_UP);
			if (d.halo !== undefined) {
				// ON the rock, with no offset at all. It used to be pushed
				// along the view axis so the rock's mesh would cover its
				// middle, and near the limb that pushed it behind the globe,
				// which clipped the quad along a hard straight line. The
				// rock's own mesh covers the middle anyway: it is opaque, it
				// writes depth, and it is bigger than the halo's bright core.
				d.halo.setPosition(_at[0], _at[1], _at[2]);
				// Hidden by the globe, by hand, because the halo is
				// `depthTest: false` and so nothing else will hide it. That
				// flag is not the bug: a depth-tested billboard is sliced
				// along a hard straight line at the limb, which is why it was
				// turned off. The answer is to ask whether the planet is in
				// the way, which is a sphere test, and fade rather than
				// switch, over the halo's own radius, so it sinks behind the
				// limb instead of blinking out on it.
				const clear = Math.sqrt(
					sightlineClearance2(
						_camAt[0],
						_camAt[1],
						_camAt[2] - PLANET_Z,
						_at[0],
						_at[1],
						_at[2] - PLANET_Z,
					),
				);
				const band = d.radius * HALO_SCALE;
				const seen = math.clamp((clear - PLANET_R) / band, 0, 1);
				d.halo.setOpacity(d.haloAlpha * seen);
			}
		}
		// The exhaust, behind the craft along its nose line: the nose is at
		// `(sin yaw, -cos yaw)` on screen, so the tail is the negative.
		const tailX = -Math.sin(this.yaw);
		const tailY = Math.cos(this.yaw);
		const reach = ENGINE_OFFSET + (ENGINE_LENGTH * this.thrust) / 2;
		fromView(
			basis,
			_origin,
			tailX * reach,
			tailY * reach,
			SHIP_VIEW_Z + 1,
			_at,
		);
		this.engine.setPosition(_at[0], _at[1], _at[2]);
		// and the ribbon starts from the same point, so it trails out of the
		// plume rather than out of the hull. `reach` grows with the thrust,
		// so a boosting craft also lays its ribbon further back, which is
		// exactly when it is widest.
		this.exhaust.addPoint(_at[0], _at[1], _at[2]);
		// same trick as the craft: the turn below is worked out on screen,
		// and starting from the camera's rotation carries it out to the world
		viewToSprite3d(basis, this.engine.currentTransform);
		// `rotate` BEFORE `scale`, and BOTH arguments to `atan2` negated. Both
		// halves are explained at length over the bolt streak below, which
		// carried the same two bugs: the order is what stops a non-uniform
		// scale shearing an already-turned card, and the signs are what make
		// the card point along `(tailX, tailY)` rather than somewhere that
		// happens to be right only when the craft is not turning.
		this.engine.currentTransform.rotate(Math.atan2(-tailX, -tailY));
		this.engine.currentTransform.scale(
			ENGINE_WIDTH / ENGINE_TEX_W,
			(ENGINE_LENGTH * this.thrust) / ENGINE_TEX_H,
		);
		this.engine.setOpacity(this.thrust);
		// The plume runs hot as the heat climbs, so the warning is on the thing
		// the player is already looking AT rather than only in the corner. The
		// bar is the number; this is the feel.
		// the SAME ramp the bar uses, so the plume and the gauge say the same
		// thing at the same moment rather than two things that nearly agree
		_engineColor
			.copy(_engineCool)
			.lerp(_engineHot, Math.min(1, this.heat / HEAT_RESUME));
		this.engine.tint.copy(_engineColor);
		// The streak takes the same heat ramp, so plume, ribbon and gauge all
		// say the same thing at the same moment. `tint` is the per-frame
		// lever on a `Trail3d` and it reaches the mesh; the gradient itself
		// is left alone, since rebuilding one allocates.
		// The ribbon's own heat ramp, which is NOT the plume's. The plume runs
		// hot from `HEAT_RESUME` as an early warning; this one stays white
		// until `ENGINE_TRAIL_HOT_FROM` and turns over as the limit arrives,
		// so the two say different things. Full red for the whole lockout,
		// where red means the boost is still gone rather than merely warm.
		const heatK = this.overheated
			? 1
			: Math.min(
					1,
					Math.max(
						0,
						(this.heat - ENGINE_TRAIL_HOT_FROM) /
							(HEAT_MAX - ENGINE_TRAIL_HOT_FROM),
					),
				);
		_trailColor.copy(_trailCool).lerp(_engineHot, heatK);
		this.exhaust.tint.copy(_trailColor);
		// Size and opacity follow the thrust OR the heat, whichever is higher.
		//
		// Thrust alone put the ribbon at its thinnest and faintest exactly
		// when it turns red, because topping out LOCKS the boost: thrust
		// damps to zero, and the one moment the colour has something to say
		// is the one moment nobody can see it. Carrying the heat through
		// keeps it wide and bright for the whole lockout, so red reads as
		// "the boost is gone" and then shrinks away as it cools.
		const drive = Math.max(this.thrust, heatK);
		this.exhaust.width = ENGINE_TRAIL_WIDTH * (1 + drive * ENGINE_TRAIL_FLARE);
		this.exhaust.setOpacity(
			ENGINE_TRAIL_IDLE + drive * (1 - ENGINE_TRAIL_IDLE),
		);
		this.engineLight.position.set(_at[0], _at[1], _at[2]);
		this.engineLight.color.copy(_engineColor);
		this.engineLight.intensity = ENGINE_LIGHT_INTENSITY * this.thrust;

		this.blast.place();

		for (const b of this.bolts) {
			const streak = b.visual.sprite;
			onGlobe(b.frame.pos, PLANET_R + BULLET_ALT, PLANET_Z, _at);
			streak.setPosition(_at[0], _at[1], _at[2]);

			// Turn the streak to face where it is going. `project` is linear
			// in the point, so the screen direction of travel is the heading
			// put through the same basis: no second projection, and exact
			// rather than a difference between two frames.
			//
			const dx = dot(basis.right, b.frame.heading);
			const dy = -dot(basis.up, b.frame.heading);
			//
			// TWO separate things are being got right here, and this went
			// wrong three times because only the first was understood.
			//
			// ONE: call `rotate` BEFORE `scale`, which is the opposite of the
			// order it reads in. `Matrix3d.scale` multiplies the matrix's
			// COLUMNS and `rotate` likewise builds `M · R`: both POST-multiply,
			// so the call made LAST sits nearest the vertex and happens FIRST
			// to it. Scaling then rotating composes `V · S · R`, which turns
			// the 24x128 card and then stretches it 0.35 across and 0.26 along
			// — a non-uniform scale on an already-turned rectangle, which is a
			// shear. Measured on a 45 degree shot: 107.8 degree corners and a
			// card 39.5 long instead of 32.9. Rotating then scaling composes
			// `V · R · S`, which sizes the card first and then turns a shape
			// that is already right: 90.0 degrees and 32.9.
			//
			// TWO: negate BOTH arguments to `atan2`. An unsheared card still
			// has to POINT somewhere, and that is a separate property that
			// being rectangular says nothing about. `viewToSprite3d` lands the
			// card's local +Y up the screen, so a screen direction `(a, b)` is
			// `atan2(-a, -b)`. With `atan2(-dx, dy)` the bolt was up to 84
			// degrees off its own line of travel, with as much as 94% of its
			// length pointing INTO the screen instead of across it — and it
			// came out exactly right at zero turn, which is why every check of
			// it passed.
			//
			// Both are rebuilt from the matrix every frame rather than
			// accumulated, because `Renderable.scale` writes into this same
			// matrix: an earlier version turned the bolt by resetting the
			// matrix and threw the size away with it, so every shot drew at
			// the texture's full 128 units, which is a continuous beam.
			viewToSprite3d(basis, streak.currentTransform);
			// `-dx`, the same reflection the craft takes: it is what puts the
			// streak on the axis the bolt actually travels along, which is
			// also the axis the craft points down.
			streak.currentTransform.rotate(Math.atan2(-dx, -dy));
			streak.currentTransform.scale(
				LASER_WIDTH / LASER_TEX_W,
				(b.pierces ? LANCE_LENGTH : LASER_LENGTH) / LASER_TEX_H,
			);
			// No shell projection: the bolt flies at an altitude from which
			// its own sphere already reaches every rock size, so the shape
			// stays centred on the streak where the player can see it. See
			// BULLET_ALT for the arithmetic.

			// the pool sits on the SHELL, under the bolt, not at the bolt's
			// own altitude: it is where the light lands
			onGlobe(b.frame.pos, DOME_R + 1, PLANET_Z, _at);
			b.visual.quad.setPosition(_at[0], _at[1], _at[2]);
			// Bridged, and with the PLAIN form `(x, -y, z)`: this quad is a
			// bare `Mesh`, not a `Sprite3d`, so it renders through
			// `diag(1, -1, 1)` rather than the `diag(1, -1, -1)` the bomb, the
			// saucer and the rocks get. Unbridged, the pool's normal came out
			// as `(q.x, -q.y, q.z)` and the patch of light tilted off the
			// glass by `acos(1 - 2*q.y^2)`: 27 degrees at the starting point,
			// edge-on by `|q.y| = 0.707`, and facing away past that. Same
			// treatment as the shock quads above, which are the same kind of
			// mesh and carry the same note.
			bridgeY(b.frame.pos, false, _bridged);
			surfaceMatrixWorld(_bridged, b.visual.quad.currentTransform);
			b.visual.glowFx.setTime(this.clock);
		}
	}

	/**
	 * One bolt's worth of damage to a rock, and everything that follows from
	 * it: the flash, the debris, the score, the split.
	 *
	 * Lifted out of `drainHits` so the HUNTER's bolts can do it too. Its
	 * shots are not special-cased to the player, so a rock in the way stops
	 * one and takes the damage, which is a tactic the player can set up
	 * rather than a detail. The bookkeeping that differs between the two
	 * sources, which bolt is spent and whether a lance flies on, stays with
	 * the caller; everything from the damage down is the same event whoever
	 * fired it.
	 * @param struck - the rock, already confirmed to still exist
	 */
	private breakRockWithBolt(struck: Drifter): void {
		// Scaled by size: this is the one explosion that happens several
		// times a second, so a single setting is either nothing for a boulder
		// or a permanent buzz for pebbles. `grade` is the rock's size step.
		rumbleBetween(
			RUMBLE_ROCK_SMALL,
			RUMBLE_ROCK_BIG,
			struck.radius / ROCK_MAX_RADIUS,
		);
		struck.hp -= 1;
		const bonus = struck.kind === "bonus";
		const ice = struck.kind === "ice";
		// What it is MADE OF decides how it comes apart, and this is the
		// one place that was only asking whether it was radioactive. An
		// ice rock hit by a bolt therefore sprayed brown rock, whether the
		// hit broke it or not, while the SAME rock cleared by the craft
		// came apart as ice in `shatterIce`. Resolved once, above the
		// survived/destroyed split, rather than as a third condition on
		// each effect below: that is how these drifted apart in the first
		// place.
		const debrisTint = bonus
			? TINT_BONUS_EXPLOSION
			: ice
				? TINT_ICE_EXPLOSION
				: TINT_ROCK_EXPLOSION;
		const waveRgb = bonus ? bonusRgb : ice ? iceRgb : shockRgb;
		if (struck.hp > 0) {
			// It survived, and the player has to be told: a hit on a big
			// rock that neither breaks it nor shows anything reads as the
			// guns missing. White while there is room left, red on the
			// last one.
			struck.flashMs = ROCK_FLASH_MS;
			// a hit that did not break it: metal, not an explosion
			playAt(
				SFX.hit,
				struck.model.pos.x,
				struck.model.pos.y,
				struck.model.depth,
			);
			this.blast.burst(
				struck.model.pos.x,
				struck.model.pos.y,
				struck.model.depth,
				debrisTint,
				Math.max(BURST_HIT_MIN, Math.round(BURST_HIT_PER_SIZE * struck.grade)),
				struck.frame.pos,
				BURST_SPEED,
				BURST_LIFE,
				struck.radius * BURST_AREA_SCALE,
			);
			// `return`, not `continue`: this was the body of a loop over
			// pending hits and is now a method, and the rock surviving ends
			// the work for THIS bolt either way.
			return;
		}
		// A radioactive rock is destroyed outright however big it is.
		// Fragments of one would pay the bonus per piece, which already
		// handed back a whole shield from a single rock before the ladder
		// got any deeper; and a rare thing that multiplies itself when you
		// shoot it is not rare. It costs extra bolts instead, which is
		// `ROCK_BONUS_EXTRA_HP`.
		const splits =
			struck.kind !== "bonus" && struck.grade >= ROCK_SPLIT_MIN_GRADE;
		const boulder = struck.grade >= ROCK_SPLIT_MIN_GRADE;
		const x = struck.model.pos.x;
		const y = struck.model.pos.y;
		const z = struck.model.depth;
		// and it is heard as what it is, and as what is left of it: a rock
		// that BREAKS leaves pieces to carry the moment, so it gets the
		// short cut of the blast, where the last fragment gets all of it.
		// The same split the burst above makes, for the same reason.
		playAt(
			ice ? SFX.iceShatter : splits ? SFX.rockSplit : SFX.rockBurst,
			x,
			y,
			z,
		);
		// A rock that BREAKS leaves pieces behind to carry the moment, so
		// its burst only has to punctuate. The last fragment leaves nothing
		// at all, so it gets the real explosion: more debris, thrown
		// harder, lasting longer. That difference is the whole reason the
		// size ladder has a floor.
		const terminal = !splits;
		this.blast.burst(
			x,
			y,
			z,
			debrisTint,
			this.blast.debrisCount(struck.grade, terminal),
			struck.frame.pos,
			terminal ? BURST_FINAL_SPEED : BURST_SPEED,
			terminal ? BURST_FINAL_LIFE : BURST_LIFE,
			// over the rock's own silhouette, so a boulder's debris comes
			// off a boulder-sized body rather than out of a point
			struck.radius * BURST_AREA_SCALE,
		);
		// and a real light at it, so the burst lands on the glass and on
		// whatever else is nearby instead of lighting nothing
		this.blast.flash(
			x,
			y,
			z,
			debrisTint,
			boulder ? FLASH_BOULDER_INTENSITY : FLASH_ROCK_INTENSITY,
			boulder ? FLASH_BOULDER_RANGE : FLASH_ROCK_RANGE,
			boulder ? FLASH_BOULDER_MS : FLASH_ROCK_MS,
		);
		// the wave, laid on the curvature and sized to what made it
		this.blast.shock(struck.frame.pos, struck.altitude, struck.radius, waveRgb);
		// every kill moves the frame a little; a boulder moves it properly
		this.camera.shake(boulder ? 9 : 3.5, boulder ? 260 : 130);
		// paid by the bolt, so a boulder is worth what it cost to break,
		// and a radioactive one pays several times over and throws in a
		// prize on top
		const points =
			SCORE_PER_ROCK *
			this.multiplier *
			struck.hpMax *
			(bonus ? BONUS_SCORE_MULT : 1);
		this.score += points;
		this.flyScore(x, y, z, points, bonus);
		// Exactly one payout per radioactive rock, guaranteed by the fact
		// that they never split rather than by a flag on the fragments.
		if (bonus) {
			this.awardBonusPrize();
		}
		this.streak += 1;
		this.refreshHud();
		const remains = splits ? struck : undefined;
		this.removeDrifter(this.drifters.indexOf(struck));
		if (remains !== undefined) {
			this.splitDrifter(remains);
		}
	}

	/**
	 * Run anything whose wait is up.
	 *
	 * Walked backwards so an entry can be removed in place, and the callback
	 * is invoked AFTER it leaves the list: one of these queues more work of
	 * its own, and a callback that re-entered the array it was being walked
	 * out of is the kind of thing that only shows up once a second beat is
	 * added.
	 * @param dt - frame time, ms
	 */
	private runDeferred(dt: number): void {
		for (let i = this.deferred.length - 1; i >= 0; i--) {
			const job = this.deferred[i];
			job.ms -= dt;
			if (job.ms <= 0) {
				this.deferred.splice(i, 1);
				job.run();
			}
		}
	}

	/**
	 * Apply the contacts the engine reported during the last world update.
	 *
	 * Drained here rather than handled in the callbacks because the
	 * callbacks run INSIDE the world's update walk, and what a hit does is
	 * tear renderables out of the world: a bolt goes back to its pool the
	 * moment it lands, and `removeChildNow` mid-walk is how a container
	 * loses track of its own children. A frame of latency is invisible, and
	 * it puts every structural change in one place.
	 */
	private drainHits(): void {
		// Nothing lands after the run has ended.
		//
		// This runs ABOVE the game-over gate in `update`, because the queues
		// have to be emptied on every frame whatever else happens, and the
		// craft is thrown clear by `SHIP_BOUNCE_ARC` on the frame it dies, so
		// fresh contacts are reported precisely then. Applied, they played a
		// kill, a flying score, a prize arpeggio and a camera shake over the
		// top of GAME OVER; they are also what let a second contact run the
		// ending twice. Cleared and dropped.
		if (this.gameOver) {
			this.pendingBombHits.length = 0;
			this.pendingBoltHits.length = 0;
			this.pendingShipHits.length = 0;
			this.pendingBombShipHit = undefined;
			return;
		}
		// bolts that found a bomb, first: a defused bomb is off the glass
		// before anything else is considered, so one bolt cannot be spent on
		// a bomb and a rock in the same frame
		for (const { bolt, bomb } of this.pendingBombHits) {
			const i = this.bolts.indexOf(bolt);
			// either may already be gone: one bolt can be reported against
			// two things in a frame, and two bolts against one bomb
			if (i < 0 || !bomb.live) {
				continue;
			}
			this.removeBolt(i);
			this.raid.defuse(bomb);
		}
		this.pendingBombHits.length = 0;

		for (const { bolt, rock: struck } of this.pendingBoltHits) {
			const i = this.bolts.indexOf(bolt);
			// Both may already be gone: one bolt can be reported against two
			// rocks in a frame, and two bolts against one rock.
			if (i < 0 || this.drifters.indexOf(struck) < 0) {
				continue;
			}
			if (bolt.pierces) {
				// A lance overlaps the same rock for several frames and is
				// reported on each of them, so without this one shot eats a
				// boulder's whole health bar. One hit per rock per bolt; the
				// bolt itself flies on and retires on its own age.
				if (bolt.through.includes(struck)) {
					continue;
				}
				bolt.through.push(struck);
			} else {
				this.removeBolt(i);
			}
			this.breakRockWithBolt(struck);
		}

		this.pendingBoltHits.length = 0;

		// a bomb the craft flew into: it goes off, which costs a pane AND the
		// shield, exactly as walking into a rock costs the shield. Gated on
		// the same invulnerability window, so one contact is one hit.
		const struckBomb = this.pendingBombShipHit;
		this.pendingBombShipHit = undefined;
		if (struckBomb?.live) {
			this.raid.detonate(struckBomb);
			if (this.invulnMs <= 0) {
				this.streak = 0;
				this.pulseShieldFlash();
				this.sinceHitMs = 0;
				// the shell rings under the craft, same as a rock strike
				this.blast.ripple(this.ship.pos);
				this.takeShieldHit();
			}
		}

		// The craft's own contacts. ICE FIRST, whatever order they arrived
		// in. It no longer changes the shield, so this is not about surviving
		// the frame; it is that a block and a rock taken together should read
		// as "cleared the ice, then took the hit", and a rock that ENDS the
		// run would otherwise drop the ice contact on the floor unscored.
		const touched = this.pendingShipHits;
		this.pendingShipHits = [];
		for (const pass of ["ice", "rock"] as const) {
			for (const hit of touched) {
				// gated on the rock still existing: a bolt may have broken it
				// in the same frame, which is a rock the player got to first
				if (
					(hit.kind === "ice") !== (pass === "ice") ||
					this.drifters.indexOf(hit) < 0
				) {
					continue;
				}
				if (pass === "ice") {
					// Ice is NOT gated on the invulnerability window, and that
					// is the difference between the two passes. Ice costs
					// nothing and gives BOOST back: it is the one thing in
					// the sky the craft clears by flying INTO it.
					//
					// Ungated DELIBERATELY: the window after a hit is exactly
					// when a player is trying to get away, which is what the
					// boost is for, and that is the worst moment to refuse
					// the one pickup that pays for it.
					// Inside the gate, flying into ice during the window after
					// a hit did nothing at all, and since `onCollisionStart`
					// is an ENTRY event it never fired again while the two
					// overlapped, so the craft sailed through and the ice
					// survived.
					this.shatterIce(hit);
				} else if (this.invulnMs <= 0) {
					// one damaging hit per frame, enforced by the window the
					// first of them opens rather than by counting
					this.onShipHit(hit);
				}
			}
		}
	}
}

export { makeLaserTexture };
