/**
 * melonJS — Earth Defender: the hunter.
 *
 * A second enemy craft that chases the player around the globe, between and
 * during the saucer's bombing runs.
 *
 * It exists because every threat before it aimed at the DOME. Rocks fall on
 * it, bombs crack it, and the player is only ever incidentally in the way.
 * Nothing pursued the player, so nothing made the player's own position
 * matter, and the boost was a travel tool with one use: reach the far side of
 * a formation before its fuses run out.
 *
 * The hunter turns the boost into an answer. At {@link HUNTER_SPEED} it is
 * faster than a cruising craft and far slower than a boosting one, so being
 * chased is a question about heat: spend it and escape, or keep it and fight.
 * And it turns worse than the player ({@link HUNTER_TURN_RATE}), so a tight
 * cut across its nose costs it ground. One is a resource decision, the other
 * is a piloting one, and a chase with only the first cannot be played well.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	Color,
	type Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	type ShaderEffect,
	Sprite3d,
	Trail3d,
	Vector3d,
} from "melonjs";
import {
	BURST_FINAL_LIFE,
	BURST_FINAL_SPEED,
	FLASH_ROCK_INTENSITY,
	FLASH_ROCK_MS,
	FLASH_ROCK_RANGE,
	HIT_SHELL,
	HUNTER_AIM_SCATTER,
	HUNTER_ALT,
	HUNTER_BOLT_CORE,
	HUNTER_BOLT_EDGE,
	HUNTER_BOLT_H,
	HUNTER_BOLT_HIT_RADIUS,
	HUNTER_BOLT_LEN,
	HUNTER_BOLT_LIFE_MS,
	HUNTER_BOLT_POOL,
	HUNTER_BOLT_SPEED,
	HUNTER_BOLT_W,
	HUNTER_BOLT_WIDTH,
	HUNTER_BREAK_ARC,
	HUNTER_BREAK_LEAD,
	HUNTER_CANNON_FORWARD,
	HUNTER_CANNON_SPREAD,
	HUNTER_CANNON_TRAVERSE,
	HUNTER_DEATH_FUEL_BURST,
	HUNTER_DEATH_FUEL_LIFE,
	HUNTER_DEATH_FUEL_MS,
	HUNTER_DEATH_FUEL_SPEED,
	HUNTER_DEATH_FUEL_TINT,
	HUNTER_DEATH_HULL_BURST,
	HUNTER_DEATH_HULL_MS,
	HUNTER_DEATH_HULL_TINT,
	HUNTER_DEATH_SHELL_BURST,
	HUNTER_DEPART_MAX_MS,
	HUNTER_DROP_FROM,
	HUNTER_DROP_MS,
	HUNTER_EMISSIVE,
	HUNTER_FADE_MS,
	HUNTER_FIRE_ARC,
	HUNTER_FIRE_INTERVAL_MS,
	HUNTER_FLASH_HIT,
	HUNTER_FLASH_LAST,
	HUNTER_FLASH_MS,
	HUNTER_HIT_ARC,
	HUNTER_HIT_RADIUS,
	HUNTER_HP,
	HUNTER_HUNT_MS,
	HUNTER_IDLE_MAX_MS,
	HUNTER_IDLE_MIN_MS,
	HUNTER_LEAD,
	HUNTER_LOST_ARC,
	HUNTER_LOST_MS,
	HUNTER_MODEL,
	HUNTER_RAM_ARC,
	HUNTER_RAM_COOLDOWN_MS,
	HUNTER_RAM_PUSH,
	HUNTER_RAM_PUSH_MS,
	HUNTER_REATTACK_ARC,
	HUNTER_RETURN_SPREAD,
	HUNTER_SCORE,
	HUNTER_SHIELD_ALPHA,
	HUNTER_SHIELD_EXPOSURE,
	HUNTER_SHIELD_FLASH_ALPHA,
	HUNTER_SHIELD_FLASH_MS,
	HUNTER_SHIELD_FLASH_WHITEN,
	HUNTER_SHIELD_FULL_COLOR,
	HUNTER_SHIELD_HITS,
	HUNTER_SHIELD_REGEN_DELAY_MS,
	HUNTER_SHIELD_REGEN_PER_S,
	HUNTER_SHIELD_SCALE,
	HUNTER_SHININESS,
	HUNTER_SIZE,
	HUNTER_SPAWN_ARC,
	HUNTER_SPECULAR,
	HUNTER_SPEED,
	HUNTER_STANDOFF_ARC,
	HUNTER_TINT,
	HUNTER_TRAIL_GRADIENT,
	HUNTER_TRAIL_LIFETIME,
	HUNTER_TRAIL_OFFSET,
	HUNTER_TRAIL_POINTS,
	HUNTER_TRAIL_SPREAD,
	HUNTER_TRAIL_STEP,
	HUNTER_TRAIL_WIDTH,
	HUNTER_TURN_RATE,
	HUNTER_UNSEEN_MS,
	PLANET_R,
	PLANET_Z,
	RUMBLE_BOUNCE,
	RUMBLE_HUNTER_FUEL,
	RUMBLE_HUNTER_HULL,
	RUMBLE_HUNTER_SHELL,
	SHIELD_BUBBLE_TEX,
	SHIELD_EMPTY_COLOR,
	SHIELD_SHADER,
	SHIELD_SPIN_A,
	SHIELD_SPIN_B,
	SHIP_HIT_RADIUS,
	SHIP_SHADOW_OPACITY,
	SHIP_SHADOW_SCALE,
	SHIP_SHADOW_THROW,
} from "../constants";
import type { BlastFx } from "../fx/blastFx";
import { playAt, playHunterFire, playHunterHit, rumble, SFX } from "../fx/sfx";
import { makeBlankQuad, makeLaserTexture } from "../fx/textures";
import {
	advance,
	arcBetween,
	craftMatrix,
	dot,
	frameAt,
	onGlobe,
	type SurfaceFrame,
	sightlineClearance2,
	steerToward,
	stepToward,
	tangentToward,
	turn,
	turnBetween,
	viewBasis,
	viewToSprite3d,
	wrapAngle,
} from "../lib/sphereMath";

/**
 * The shell's two ends and the mix between them, built once.
 *
 * The same three-colour arrangement the player's shell uses, for the same
 * reason: a shield whose colour is the whole readout cannot allocate one per
 * frame to say so.
 */

const _shellFull = new Color().parseCSS(HUNTER_SHIELD_FULL_COLOR);
const _shellEmpty = new Color().parseCSS(SHIELD_EMPTY_COLOR);
const _shellMix = new Color();

/** what the hunter needs from the rest of the run */
export interface HunterHost {
	/** the shared blast pool, for the wreck it leaves */
	readonly blast: BlastFx;
	/** the key light its blob shadow is cast from */
	readonly sun: Light3d;
	/** where the craft is on the unit sphere: what it steers at */
	shipPos(): Vector3d;
	/**
	 * Where the craft will be in `seconds`, if it holds its course.
	 *
	 * The craft is ALWAYS travelling: `SHIP_SPEED` is 0.3 radians a second
	 * with no input at all, and the boost takes it to 0.85. A gunner firing
	 * at {@link shipPos} is therefore firing at where the craft WAS by the
	 * time the bolt arrives, and over a measured mean flight of 0.71 seconds
	 * that is 0.21 radians, three and a half times the craft's own width.
	 * Measured mean closest approach before this existed: 0.19 radians, which
	 * is that number and nothing else.
	 *
	 * Asked of the host rather than worked out here, because the speed is the
	 * controller's business: the boost, the overheat lockout and anything
	 * later that changes it are all already folded in over there.
	 */
	shipAfter(seconds: number): Vector3d;
	/**
	 * Whether a point `alt` above the globe is somewhere the player can SEE it.
	 *
	 * Not a range test, because the frame is not round and no single arc can
	 * stand in for one. Measured against this camera: the hunter leaves the top
	 * or bottom of the frame at 0.49 radians but NEVER leaves the sides, since
	 * its track peaks at a 36.2 degree screen half-angle against a 45.7 degree
	 * side edge. A constant would therefore be either 0.49, which fades it in
	 * plain view whenever it goes sideways, or 1.87, which is where the dome
	 * finally hides it and is five seconds of flight away.
	 *
	 * Asked of the host because the camera belongs to the controller, and
	 * because `onScreen()` here answers a different question: whether the
	 * PLANET is in the way, from the craft's position rather than the camera's.
	 * @param at - a unit surface vector
	 * @param alt - the radius it sits at
	 */
	inView(at: Vector3d, alt: number): boolean;
	/**
	 * The direction that is up on screen, so a shot can be turned to face
	 * where it is going. The VIEW's heading and not the craft's, for the
	 * reason the raid gives: the two part company whenever the view swings.
	 */
	viewHeading(): Vector3d;
	/**
	 * Where the camera stands, in world units.
	 *
	 * Needed to lift the shell off the hull: under perspective that offset
	 * only leaves the screen position alone if it runs along the line of
	 * sight. The run poses the camera AFTER the hunter ticks, so this is a
	 * frame behind, which at the rate the camera moves is well under a pixel
	 * of the shell's own size.
	 */
	eye(): readonly [number, number, number];
	/** award the kill, through the run's own multiplier */
	award(x: number, y: number, z: number, base: number): void;
	/**
	 * A shot has reached the craft.
	 *
	 * The run's OWN shield path, not a second one: it already does the
	 * freeze, the sound, the drain and the ending, and a bolt that spelled
	 * those out again would drift from the rock that does the same job.
	 */
	onShot(at: Vector3d): void;
	/**
	 * Offer a bolt of the hunter's to everything else in the sky.
	 *
	 * Its shots are not special-cased to the player: a rock or a bomb in the
	 * way stops one, and takes the damage. That is a tactic rather than a
	 * detail, because the hunter arrives between bombing runs and a player
	 * who lines it up on a falling bomb gets it defused for free.
	 * @param at - where the bolt is, as a unit surface direction
	 * @param radius - the bolt's own hit radius, world units
	 * @returns whether it was spent
	 */
	strike(at: Vector3d, radius: number): boolean;
	/**
	 * Run something later, in game time.
	 *
	 * The hunter's death outlives the hunter: it is staged over a quarter of
	 * a second and `goAway` has already cleared the frame by then. The run
	 * owns the clock and pauses with the game, which a raw `setTimeout` would
	 * not, so the beats cannot land during a freeze or after the run ends.
	 * @param ms - how long to wait
	 * @param run - what to do then
	 */
	after(ms: number, run: () => void): void;
	/**
	 * Shove the craft away from a point, shield on shield.
	 * @param from - what it is being pushed away from
	 */
	bounce(from: Vector3d): void;
	/** whether the craft can be hit at all right now */
	vulnerable(): boolean;
}

/** one of its shots: the streak, where it is, and how long it has left */
interface Shot {
	sprite: Sprite3d;
	frame: SurfaceFrame;
	ageMs: number;
	live: boolean;
}

/** scratch, so placing it allocates nothing @ignore */
const _at: [number, number, number] = [0, 0, 0];
/** scratch for the shell's own world point, so `_at` keeps the hull's */
const _shellAt: [number, number, number] = [0, 0, 0];
/** the view's basis as a card transform, shared by every streak in a frame */
const _view = new Matrix3d();

/**
 * One hunter, reused for the whole run.
 *
 * Built once and hidden rather than created per appearance: it is a mesh with
 * a material, and a run spawns one every ten seconds or so. The same reason
 * the bombs and the bolts are pooled.
 */
export class Hunter {
	private readonly host: HunterHost;
	private mesh: Mesh | undefined;

	/**
	 * Where it is and which way it points, the same shape the player's craft
	 * uses. Undefined while it is away.
	 */
	frame: SurfaceFrame | undefined;

	/** away, arriving (fading in), hunting, or leaving (fading out) */
	private phase: "away" | "arrive" | "hunt" | "depart" | "leave" = "away";
	private phaseMs = 0;
	private hp = HUNTER_HP;
	/** what is left of the descent, milliseconds; 0 once it has landed */
	private dropMs = 0;
	/** how long it has been continuously out of sight while departing */
	private unseenMs = 0;
	/** what is left of the hit flash, milliseconds */
	private flashMs = 0;
	/** the flash colour, written in place so a hit allocates nothing */
	private readonly flashRgb = new Float32Array(3);
	/** its shots, pooled */
	private readonly bolts: Shot[] = [];
	private fireMs = 0;
	/** how long before it can collide with the craft again */
	private ramMs = 0;
	/** how long the player has been out of reach, ms */
	private lostMs = 0;
	/** arc still owed to the bounce, and how long is left to deliver it */
	private pushLeft = 0;
	private pushMs = 0;
	/** closing with its nose on the craft, or swinging back out of range */
	private pass: "attack" | "break" = "attack";
	/**
	 * Where it is running to, fixed for the whole break.
	 *
	 * Latched rather than recomputed, which is the difference between a break
	 * and a spiral. Steering at "away from the craft" every frame is chasing
	 * a bearing that rotates fastest exactly when the two are closest, and a
	 * craft that cannot turn that fast follows it inwards: measured, the
	 * hunter itself supplied 0.86 of the 1.17 radians of closing inside a
	 * quarter radian, while the player was moving AWAY. Against a fixed point
	 * the same steering is an ordinary constant-radius turn, and what it
	 * misses by can be worked out in advance.
	 */
	private breakTo: Vector3d | undefined;
	/** where it was when it last faded out, so it can come back from there */
	private lastSeen: Vector3d | undefined;
	/** one streak per reactor: the miner has two at the back */
	private readonly exhausts: Trail3d[] = [];
	/**
	 * What the shell has left, counted in BOLTS: full at
	 * {@link HUNTER_SHIELD_HITS}, down and the hull exposed at 0.
	 *
	 * In bolts rather than as a 0..1 fraction because that is the unit it is
	 * spent in, and subtracting a whole one from a whole one is exact.
	 * Measured as a fraction it was not: five subtractions of a fifth leave
	 * 5.55e-17, which is `> 0` by every test, so the shell went on eating
	 * bolts for ever and the hull underneath could never be reached. Regen
	 * puts fractions of a bolt in it, which is fine, and a hit can only ever
	 * carry it to zero or past it from there.
	 */
	private shellLeft = HUNTER_SHIELD_HITS;
	/** since a bolt last landed on the shell, ms; gates the regen */
	private sinceShellHitMs = 0;
	/** what is left of the shell's own flare, ms */
	private shellFlashMs = 0;
	/** the shell, and the shader that is all of what it looks like */
	private bubble: Sprite3d | undefined;
	private shellFx: ShaderEffect | undefined;
	/** its colour as a linear triple, written in place */
	private readonly shellRgb = new Float32Array(3);
	/** the shell's own clock, seconds, for the two drifting arcs */
	private shellClock = 0;

	constructor(app: Application, host: HunterHost) {
		this.host = host;
		this.mesh = new Mesh(0, 0, {
			model: HUNTER_MODEL,
			material: HUNTER_MODEL,
			width: HUNTER_SIZE,
			height: HUNTER_SIZE,
			lit: true,
			cullBackFaces: true,
			// the same omission as the player's craft, for the same reason:
			// `rightHanded` negates Z as well as Y and renders it inside out
			specular: HUNTER_SPECULAR,
			shininess: HUNTER_SHININESS,
		});
		this.mesh.setTint(HUNTER_TINT);
		// a constant warm glow so it stays legible on the night side, which
		// is half of every lap it flies
		this.mesh.emissive = new Float32Array(HUNTER_EMISSIVE);
		this.mesh.castGroundShadow = true;
		this.mesh.shadowScale = SHIP_SHADOW_SCALE;
		this.mesh.shadowOpacity = SHIP_SHADOW_OPACITY;
		this.mesh.shadowLight = host.sun;
		this.mesh.shadowOffset = SHIP_SHADOW_THROW;
		this.mesh.setOpacity(0);
		app.world.addChild(this.mesh, PLANET_Z);

		// Its shell, the same construction as the player's and from the same
		// shader: a blank quad whose whole appearance is generated per
		// fragment, so it can have a clear middle and a bright edge at once.
		// Sharing the shader is the point. The player already reads that
		// pattern as "a shield", so an enemy wearing the same one needs no
		// explaining, and the hue is what says whose it is.
		this.bubble = new Sprite3d(0, 0, {
			image: makeBlankQuad(SHIELD_BUBBLE_TEX),
			width: HUNTER_SIZE * HUNTER_SHIELD_SCALE,
			height: HUNTER_SIZE * HUNTER_SHIELD_SCALE,
			billboard: "spherical",
			transparent: true,
			alphaCutoff: 0,
		});
		this.bubble.blendMode = "additive";
		this.bubble.setOpacity(0);
		// A clone, not the loaded shader: the player's shell holds its own
		// clone and the two carry different colours, spins and flares every
		// frame, which one shared effect could not.
		this.shellFx = (loader.getShader(SHIELD_SHADER) as ShaderEffect).clone();
		this.shellFx.setUniform("uExposure", HUNTER_SHIELD_EXPOSURE);
		this.shellFx.setUniform("uImpact", 0);
		this.bubble.addPostEffect(this.shellFx);
		app.world.addChild(this.bubble, PLANET_Z);

		// Fed by hand rather than given a `target`, for the same reason the
		// craft's is: a target emits from the centre, which lays the widest
		// part of the ribbon under the hull. The point comes from behind it.
		for (let i = 0; i < 2; i++) {
			const streak = new Trail3d(0, 0, {
				length: HUNTER_TRAIL_POINTS,
				lifetime: HUNTER_TRAIL_LIFETIME,
				minDistance: HUNTER_TRAIL_STEP,
				width: HUNTER_TRAIL_WIDTH,
				widthCurve: [0.4, 1, 0.55, 0],
				gradient: [...HUNTER_TRAIL_GRADIENT],
			});
			streak.blendMode = "additive";
			app.world.addChild(streak);
			this.exhausts.push(streak);
		}
		this.phaseMs = math.random(HUNTER_IDLE_MIN_MS, HUNTER_IDLE_MAX_MS);

		// One texture for every shot, one sprite apiece, built once. A hunter
		// fires every second and a half for seventeen seconds, so building
		// these per shot would put the allocation exactly where the chase is.
		const tex = makeLaserTexture(
			HUNTER_BOLT_W,
			HUNTER_BOLT_H,
			HUNTER_BOLT_CORE,
			HUNTER_BOLT_EDGE,
		);
		for (let i = 0; i < HUNTER_BOLT_POOL; i++) {
			// Billboard OFF, same as the player's streak: it is turned to
			// face where it is going every frame, and a billboard keeps a
			// transform's scale but drops its rotation, which drew every
			// shot as an upright dash whichever way it flew.
			const sprite = new Sprite3d(0, 0, {
				image: tex,
				width: HUNTER_BOLT_WIDTH,
				height: HUNTER_BOLT_LEN,
				billboard: false,
				transparent: true,
				alphaCutoff: 0,
			});
			sprite.blendMode = "additive";
			sprite.setOpacity(0);
			app.world.addChild(sprite, PLANET_Z);
			this.bolts.push({
				sprite,
				frame: { pos: new Vector3d(0, 1, 0), heading: new Vector3d(1, 0, 0) },
				ageMs: 0,
				live: false,
			});
		}
	}

	/**
	 * Whether a bolt can hit it this frame.
	 *
	 * `depart` counts. A departing hunter is still a solid craft flying away
	 * under its own power, and it is on screen for as long as the player can
	 * keep up with it, so a shot that passed through it would read as the
	 * game cheating. It stops counting at `leave`, which only begins once the
	 * player cannot see it.
	 */
	get alive(): boolean {
		return (
			(this.phase === "hunt" || this.phase === "depart") &&
			this.frame !== undefined
		);
	}

	/**
	 * Where it is, for the collision test, and nothing while it cannot be
	 * hit: a bolt that met it on the way down or the way out was spent on a
	 * craft `hit` then refused, which is a shot eaten by a ghost.
	 */
	get at(): Vector3d | undefined {
		return this.alive ? this.frame?.pos : undefined;
	}

	/** the arc a bolt has to come within */
	get hitRadius(): number {
		return HUNTER_HIT_RADIUS;
	}

	/**
	 * Take a bolt. Returns true if that was the last one.
	 * @returns whether it died
	 */
	hit(): boolean {
		// `alive` already implies a frame; spelled out so the compiler can
		// see it too, rather than asserted past
		const frame = this.frame;
		if (!this.alive || frame === undefined) {
			return false;
		}
		// The shell takes the WHOLE bolt while it has anything left. A shot
		// that also reached the hull would make the shell a coat of paint
		// over a health bar rather than something to get past, and the
		// player could not tell which of the two their shots were going
		// into.
		if (this.shellLeft > 0) {
			this.shellLeft = Math.max(0, this.shellLeft - 1);
			this.sinceShellHitMs = 0;
			this.shellFlashMs = HUNTER_SHIELD_FLASH_MS;
			// The HULL flashes as well, not just the shell. A bolt stopped by
			// a shield still arrives, and lighting only the shell left the
			// craft inside it sitting there unmoved, which read as the shot
			// going past rather than into something. The hull is at full
			// health here, so `writeFlash` picks the white end of its own
			// ramp, which is the white flash this wanted all along.
			this.flashMs = HUNTER_FLASH_MS;
			this.writeFlash(1);
			playHunterHit(true);
			return false;
		}
		this.hp -= 1;
		this.flashMs = HUNTER_FLASH_MS;
		playHunterHit(false);
		// the flash climbs from white toward red as the hits mount, the
		// rocks' own ramp, so a player already reads how close it is
		this.writeFlash(1);
		if (this.hp > 0) {
			return false;
		}
		const p = frame.pos;
		onGlobe(p, HUNTER_ALT, PLANET_Z, _at);
		// The kill, in three beats rather than one puff.
		//
		// A rock gets a single burst because a rock is a lump. This took
		// seven hits and shot back the whole way, and one burst read as the
		// shot having missed. It comes apart instead: the shell fails, then
		// the hull, then the fuel. Staged on a timer because everything on
		// one frame is one event however many particles are in it, and a
		// fifth of a second between beats is long enough to read as a
		// sequence and short enough to still be one death.
		//
		// The frame is about to be thrown away by `goAway`, so the three
		// beats are given the WORLD POINT they happen at rather than the
		// hunter: an explosion is not attached to the thing that caused it,
		// and a craft that has stopped existing cannot be asked where it is
		// a quarter of a second later.
		const bx = _at[0];
		const by = _at[1];
		const bz = _at[2];
		const where = new Vector3d(p.x, p.y, p.z);
		this.host.blast.shock(where, HUNTER_ALT, HUNTER_SIZE * 1.9);
		// The shell letting go, in the shell's own colour and with no
		// debris: energy, not wreckage. It is the first thing to go because
		// it is the outermost, and it is what the player has been shooting.
		this.host.blast.flash(
			bx,
			by,
			bz,
			HUNTER_SHIELD_FULL_COLOR,
			FLASH_ROCK_INTENSITY * 1.3,
			FLASH_ROCK_RANGE,
			FLASH_ROCK_MS,
		);
		this.host.blast.burst(
			bx,
			by,
			bz,
			HUNTER_SHIELD_FULL_COLOR,
			HUNTER_DEATH_SHELL_BURST,
			where,
			BURST_FINAL_SPEED * 1.25,
			BURST_FINAL_LIFE * 0.55,
			HUNTER_SIZE * 1.3,
		);
		playAt(SFX.rockBurst, bx, by, bz);
		rumble(RUMBLE_HUNTER_SHELL);
		// the hull, in its own plating rather than rock brown
		this.host.after(HUNTER_DEATH_HULL_MS, () => {
			this.host.blast.burst(
				bx,
				by,
				bz,
				HUNTER_DEATH_HULL_TINT,
				HUNTER_DEATH_HULL_BURST,
				where,
				BURST_FINAL_SPEED,
				BURST_FINAL_LIFE,
				HUNTER_SIZE * 0.9,
			);
			this.host.blast.shock(where, HUNTER_ALT, HUNTER_SIZE * 1.2);
			playAt(SFX.rockSplit, bx, by, bz);
			rumble(RUMBLE_HUNTER_HULL);
		});
		// and the fuel, thrown hardest and burning longest, which is what
		// makes the last beat the big one
		this.host.after(HUNTER_DEATH_FUEL_MS, () => {
			this.host.blast.flash(
				bx,
				by,
				bz,
				HUNTER_DEATH_FUEL_TINT,
				FLASH_ROCK_INTENSITY * 1.6,
				FLASH_ROCK_RANGE * 1.3,
				FLASH_ROCK_MS * 1.4,
			);
			this.host.blast.burst(
				bx,
				by,
				bz,
				HUNTER_DEATH_FUEL_TINT,
				HUNTER_DEATH_FUEL_BURST,
				where,
				HUNTER_DEATH_FUEL_SPEED,
				HUNTER_DEATH_FUEL_LIFE,
				HUNTER_SIZE * 0.6,
			);
			playAt(SFX.bombBlast, bx, by, bz);
			rumble(RUMBLE_HUNTER_FUEL);
		});
		// and the streak it was laying dies with it, rather than hanging in
		// the air pointing at where it used to be
		for (const streak of this.exhausts) {
			streak.clear();
		}
		this.host.award(_at[0], _at[1], _at[2], HUNTER_SCORE);
		this.goAway();
		return true;
	}

	/**
	 * Carry it forward one frame.
	 * @param dt - milliseconds since the last frame
	 */
	tick(dt: number): void {
		this.phaseMs -= dt;
		this.burnFlash(dt);
		this.tickShell(dt);
		this.flyBolts(dt);
		switch (this.phase) {
			case "away":
				if (this.phaseMs <= 0) {
					this.arrive();
				}
				return;
			case "arrive":
				this.dropMs = Math.max(0, this.dropMs - dt);
				this.chase(dt);
				// faded in over the FIRST part of the fall, so it is solid
				// well before it touches down
				this.mesh?.setOpacity(
					Math.min(1, (HUNTER_DROP_MS - this.dropMs) / HUNTER_FADE_MS),
				);
				if (this.phaseMs <= 0) {
					this.phase = "hunt";
					this.phaseMs = HUNTER_HUNT_MS;
				}
				return;
			case "hunt":
				this.chase(dt);
				this.tryFire(dt);
				// Shaken off: see HUNTER_LOST_ARC. A plain range test rather
				// than asking whether the planet is in the way. At this
				// altitude the arc is past the dome anyway, so the two
				// questions no longer overlap: this one is about a player
				// who outran it, and being hidden is `depart`'s business.
				// Counted rather than acted on at once, so one long break
				// does not end a visit that is still a fight.
				// `chase` may have ended the frame, so the frame is read
				// again rather than assumed: it is undefined once the hunter
				// has been thrown away, and a visit that just ended is not
				// one to measure the range of.
				//
				// Only while it is CHASING. A break is the hunter flying away
				// from the player on purpose, and `HUNTER_BREAK_ARC` (1.1)
				// plus the turn at the end of it carries the range past
				// `HUNTER_LOST_ARC` (1.2) by itself: measured at 1.37 against
				// a player who never moved once. Counting that as shaken off
				// meant the hunter gave up on ITSELF, two visits out of two in
				// a 60 second idle test and not one ending on its hunt timer.
				// It then faded out where the break had left it, past the
				// limb, which is what "it flew to space and disappeared" was.
				this.lostMs =
					this.pass === "attack" &&
					this.frame !== undefined &&
					arcBetween(this.frame.pos, this.host.shipPos()) > HUNTER_LOST_ARC
						? this.lostMs + dt
						: 0;
				if (this.phaseMs <= 0 || this.lostMs >= HUNTER_LOST_MS) {
					// Gives up rather than hounding a player who cannot shake
					// it. The threat is a passage of play, not a state.
					//
					// It does not start fading here. It FLIES OFF first, and
					// the fade waits until the player cannot see it: giving
					// up mid-pass put the fade at a measured 0.58 and 0.74
					// radians, which is the middle of the screen, and the
					// craft dissolved in front of the player. `depart` is
					// that departure run.
					this.depart();
				}
				return;
			case "depart":
				// Still a craft while it leaves: it flies, it can be shot,
				// and the traverse gate means it only fires at something that
				// crosses its nose on the way out. What it does NOT do is
				// turn back, which `chase` is prevented from doing by the
				// phase test on its standoff flip.
				this.chase(dt);
				this.tryFire(dt);
				// Out of sight for a WHILE, not for a frame. The hunter
				// crosses the top of the view often enough during an ordinary
				// pass that a single off-frame reading is no evidence it has
				// left; the dwell is what separates a blink past the edge
				// from a departure.
				this.unseenMs =
					this.frame !== undefined &&
					!this.host.inView(this.frame.pos, HUNTER_ALT)
						? this.unseenMs + dt
						: 0;
				if (this.phaseMs <= 0 || this.unseenMs >= HUNTER_UNSEEN_MS) {
					this.phase = "leave";
					this.phaseMs = HUNTER_FADE_MS;
				}
				return;
			case "leave":
				// Course held, nothing steered, nothing rammed. By here the
				// player cannot see it, so the only thing left to do is carry
				// it out of the way while the alpha runs down. Calling
				// `chase` here is what let a craft at 20% opacity shove the
				// player and flare both shells.
				if (this.frame !== undefined) {
					this.frame = advance(this.frame, HUNTER_SPEED * (dt / 1000));
					this.place();
				}
				this.mesh?.setOpacity(Math.max(0, this.phaseMs) / HUNTER_FADE_MS);
				if (this.phaseMs <= 0) {
					this.lastSeen = this.frame?.pos.clone();
					this.goAway();
				}
		}
	}

	/** Put it over the horizon, pointed at the player, and fade it in. */
	private arrive(): void {
		// Out along a RANDOM bearing from the craft, then turned to face
		// back down the same great circle, which is the way to the craft.
		// It enters as a shape growing in the distance, from a different
		// side each time; dropped on top of the player it would be a hit
		// rather than a warning. `frameAt` alone is not random: it picks
		// the one tangent at a point that leans on a world axis, so every
		// arrival came from the same quarter of the sky, and a heading taken
		// from it at the far end pointed anywhere but back.
		//
		// Not a FRESH random bearing, which is what this was: a visit ends
		// wherever the hunter is and the next one opened anywhere at all, so
		// the craft disappeared on one side of the globe and returned from
		// another. It comes back on roughly the bearing it left by instead,
		// which reads as the same craft circling round.
		const base = frameAt(this.host.shipPos());
		let bearing = Math.random() * Math.PI * 2;
		if (this.lastSeen !== undefined) {
			const back = tangentToward(base.pos, this.lastSeen);
			if (back.x !== 0 || back.y !== 0 || back.z !== 0) {
				bearing =
					turnBetween(base.heading, back, base.pos) +
					(Math.random() * 2 - 1) * HUNTER_RETURN_SPREAD;
			}
		}
		const start = turn(base, bearing);
		this.frame = turn(advance(start, HUNTER_SPAWN_ARC), Math.PI);
		this.hp = HUNTER_HP;
		// A full shell every time. It arrives whole however the last one
		// ended, including shot down: a hunter that remembered its damage
		// across a seventeen-second absence would be a boss fight in
		// instalments, which is not what this is.
		this.shellLeft = HUNTER_SHIELD_HITS;
		this.sinceShellHitMs = 0;
		// Which way it circles, picked once per visit rather than per frame:
		// chosen every frame it would dither on the spot, and chosen once for
		// the whole run every hunter would come at the player the same way.
		// Every visit opens with a run in, from wherever it came over the
		// horizon: arriving already broken off would read as a craft that
		// turned up and then thought better of it.
		this.pass = "attack";
		this.breakTo = undefined;
		this.shellFlashMs = 0;
		this.phase = "arrive";
		// the fade is only long enough to not pop; the DESCENT is what the
		// eye follows, and it outlasts it
		this.phaseMs = HUNTER_DROP_MS;
		this.dropMs = HUNTER_DROP_MS;
		this.lostMs = 0;
		this.flashMs = 0;
		this.lastSeen = undefined;
		this.mesh?.setOpacity(0);
		// Put it where it belongs NOW. `place` is otherwise first called from
		// the next frame's `chase`, which left the mesh for one frame
		// wherever it last was, and on the very first arrival that is the
		// position it was constructed at: the planet's centre. Invisible,
		// because the fade starts at zero, but a mesh inside the earth is not
		// something to leave sitting there on the strength of an alpha.
		this.place();
	}

	/** Steer at the player and move, then place the mesh. */
	private chase(dt: number): void {
		if (this.frame === undefined) {
			return;
		}
		const dts = dt / 1000;
		const ship = this.host.shipPos();
		// The attack run, in two halves with a band between them.
		//
		// Closing, it steers at the craft itself: the gun fires along the
		// hunter's own heading, so pointing at the player is the only way its
		// shots are aimed at anything, and the whole approach is a threat.
		// At HUNTER_STANDOFF_ARC it breaks, and the break is what stops it
		// arriving ON the player the way pure pursuit did.
		const range = arcBetween(this.frame.pos, ship);
		// Only while HUNTING. A departure is a break that must not end, and
		// this flip would turn it back toward the player at
		// `HUNTER_REATTACK_ARC`, which is the whole thing `depart` exists to
		// stop.
		if (this.phase === "hunt") {
			if (this.pass === "attack") {
				if (range <= HUNTER_STANDOFF_ARC) {
					this.pass = "break";
					this.breakTo = this.escapeTo(ship);
				}
			} else if (range >= HUNTER_REATTACK_ARC) {
				this.pass = "attack";
				this.breakTo = undefined;
			}
		}
		const aim = this.breakTo ?? ship;
		this.frame = steerToward(this.frame, aim, HUNTER_TURN_RATE * dts);
		this.frame = advance(this.frame, HUNTER_SPEED * dts);
		this.ramMs = Math.max(0, this.ramMs - dt);
		this.ram();
		this.burnPush(dt);
		this.place();
	}

	/**
	 * Pick the point it runs to when it breaks off.
	 *
	 * Out along its own bearing from the craft and then turned aside by
	 * {@link HUNTER_BREAK_LEAD}, so it leaves on an arc rather than reversing
	 * back down the line it came in on and each run arrives from a new angle.
	 *
	 * Both sides are offered and the nearer one wins. The two are mirror
	 * images about dead astern, so a side chosen any other way is the long way
	 * round half the time, and the long way round is a wider turn, which is
	 * exactly the thing the break exists to avoid.
	 * @param ship - where the craft is now
	 * @returns the point to run to, or undefined if there is no direction
	 */
	private escapeTo(
		ship: Vector3d,
		lead = HUNTER_BREAK_LEAD,
	): Vector3d | undefined {
		if (this.frame === undefined) {
			return undefined;
		}
		const toShip = tangentToward(this.frame.pos, ship);
		// `tangentToward` hands back a zero vector when the two points
		// coincide, and a frame with no heading is no longer a frame. Only
		// reachable if the player flies exactly onto it, where steering at
		// them for a frame is harmless: `ram` is about to throw them apart.
		if (toShip.x === 0 && toShip.y === 0 && toShip.z === 0) {
			return undefined;
		}
		const out: SurfaceFrame = {
			pos: this.frame.pos,
			heading: new Vector3d(-toShip.x, -toShip.y, -toShip.z),
		};
		let best: Vector3d | undefined;
		let nearest = -2;
		for (const side of [1, -1]) {
			const at = advance(turn(out, side * lead), HUNTER_BREAK_ARC).pos;
			// how far off the nose it already is, as a cosine: bigger is less
			// turning to do
			const toward = dot(tangentToward(this.frame.pos, at), this.frame.heading);
			if (toward > nearest) {
				nearest = toward;
				best = at;
			}
		}
		return best;
	}

	/**
	 * Pay out what is left of a bounce.
	 *
	 * Eased out, so the craft leaves fast and settles: a linear push for the
	 * same distance reads as the hunter being towed away from the contact
	 * rather than thrown off it. Backwards along its own heading, which is
	 * the direction it came from, and it keeps steering the whole time, so a
	 * bounce bleeds off into the next pass instead of interrupting it.
	 * @param dt - frame time, ms
	 */
	private burnPush(dt: number): void {
		if (this.pushMs <= 0 || this.frame === undefined) {
			return;
		}
		const before = this.pushMs;
		this.pushMs = Math.max(0, this.pushMs - dt);
		// the share of what is LEFT that this frame carries, on a square ease
		const was = (before / HUNTER_RAM_PUSH_MS) ** 2;
		const now = (this.pushMs / HUNTER_RAM_PUSH_MS) ** 2;
		const step = this.pushLeft * (was - now);
		this.frame = advance(this.frame, -step);
	}

	/**
	 * Whether the globe is between the camera and the hunter.
	 *
	 * The same test the saucer uses, for the same reason and with the same
	 * camera assumption: it stands straight out from the player at
	 * `PLANET_Z`, because the pan is no part of whether the planet hides
	 * something.
	 *
	 * It matters because a hunter chases, so it can end up on the far side
	 * whenever the player outruns it, and a craft shooting from a place the
	 * player cannot see is not a threat they can answer.
	 * @returns true while the camera can see it
	 */
	private onScreen(): boolean {
		if (this.frame === undefined) {
			return false;
		}
		const c = this.host.shipPos();
		const r = HUNTER_ALT;
		const p = this.frame.pos;
		const clear2 = sightlineClearance2(
			c.x * PLANET_Z,
			c.y * PLANET_Z,
			c.z * PLANET_Z,
			p.x * r,
			p.y * r,
			p.z * r,
		);
		// a little inside the surface, so it stops shooting a moment before
		// the limb rather than at the exact tangent
		return clear2 > PLANET_R * PLANET_R * 1.02;
	}

	/**
	 * Shells touching: both craft bounce, and neither is hurt.
	 *
	 * It used to cost the player a hit, on the reasoning that flying into an
	 * enemy should hurt. It plays badly. The hunter is the one doing the
	 * chasing, so the contact is usually its doing rather than the player's,
	 * and being damaged for something you did not initiate reads as the game
	 * cheating. Worse, it made closing to point-blank strictly bad, which is
	 * the one place a slower-turning pursuer can be beaten.
	 *
	 * Now they repel. Both shells flare and both craft are pushed off, which
	 * is what two shields meeting should look like, and the hunter cannot be
	 * caught and ridden.
	 *
	 * {@link HUNTER_RAM_ARC} is the sum of the two SHELL radii, so this fires
	 * when the bubbles meet rather than when the hulls do. The hulls never
	 * touch at all now, which is the point: the shields are what is in
	 * contact, and that is what the screen shows.
	 */
	private ram(): void {
		if (
			// not while arriving or leaving. `chase` runs in every phase, so
			// without this a craft at 20% opacity could still shove the
			// player and flare both shells, and an arriving one could ram
			// from 1.18x altitude against an arc measured at `HUNTER_ALT`.
			!this.alive ||
			this.frame === undefined ||
			this.ramMs > 0 ||
			arcBetween(this.frame.pos, this.host.shipPos()) > HUNTER_RAM_ARC
		) {
			return;
		}
		this.ramMs = HUNTER_RAM_COOLDOWN_MS;
		// Owed, not applied. Landing the whole push on one frame moved it 95
		// units between two frames, which the eye reads as a cut rather than
		// a collision; `burnPush` pays it out over HUNTER_RAM_PUSH_MS.
		this.pushLeft = HUNTER_RAM_PUSH;
		this.pushMs = HUNTER_RAM_PUSH_MS;
		// its shell lights up: this IS a shield impact, and one that showed
		// nothing read as the two craft passing through each other
		this.shellFlashMs = HUNTER_SHIELD_FLASH_MS;
		playHunterHit(this.shellLeft > 0);
		rumble(RUMBLE_BOUNCE);
		// and the player is pushed the other way, by the run, which is the
		// only thing that may touch the craft's frame
		this.host.bounce(this.frame.pos);
	}

	/**
	 * Fire, if it is close enough and pointed the right way.
	 *
	 * The cone is the part that matters. Without it a hunter shoots at the
	 * player's back from across the globe, and a shot that arrives from
	 * off-screen with no warning is not something the player can answer.
	 * @param dt - frame time, ms
	 */
	private tryFire(dt: number): void {
		this.fireMs -= dt;
		if (this.fireMs > 0 || this.frame === undefined) {
			return;
		}
		// Not from behind the planet. It is hidden there, and a shot whose
		// source the player never saw is indistinguishable from the game
		// cheating. The cooldown is left running so it does not fire the
		// instant it reappears either.
		if (!this.onScreen()) {
			return;
		}
		// Where the craft will BE, not where it is.
		//
		// The flight time depends on the range and the range depends on the
		// lead, so it is solved by stepping: the first pass uses the present
		// range, the second uses the one the first predicted. Two is plenty
		// here, since the craft turns slowly next to the bolt's flight.
		let flight = arcBetween(this.frame.pos, this.host.shipPos());
		let quarry = this.host.shipPos();
		for (let i = 0; i < 2; i++) {
			quarry = this.host.shipAfter((flight / HUNTER_BOLT_SPEED) * HUNTER_LEAD);
			flight = arcBetween(this.frame.pos, quarry);
		}
		const range = flight;
		if (range > HUNTER_FIRE_ARC) {
			return;
		}
		// Can the guns be brought onto the craft at all?
		//
		// Measured from the MUZZLES rather than from the hull's middle: they
		// sit `HUNTER_CANNON_FORWARD` ahead of it, 0.039 rad against a standoff
		// range of 0.48, so the bearing from one is not the bearing from the
		// other.
		//
		// This replaces a cone test on the hull's own heading. No cone could
		// fix the aim, because the bolt left along that heading whatever the
		// answer was: the test only ever chose how far off the shot went.
		const nose = advance(this.frame, HUNTER_CANNON_FORWARD);
		const want = tangentToward(nose.pos, quarry);
		const bearing = turnBetween(nose.heading, want, nose.pos);
		if (Math.abs(bearing) > HUNTER_CANNON_TRAVERSE) {
			return;
		}
		// A PAIR, one from each barrel. The model has two cannons running
		// along the nose and firing one bolt from the centre line drew it
		// coming out of the gap between them, the same mistake the single
		// reactor streak made at the other end.
		//
		// They fly PARALLEL, each straight down its own barrel, so they
		// straddle whatever the guns are aimed at: a volley thrown half a
		// craft wide by the scatter still puts one of the two on it, and dead
		// on, both land. That is the whole reason two is worth more than one
		// here rather than being twice the same shot.
		const pair = this.bolts.filter((b) => !b.live).slice(0, 2);
		if (pair.length < 2) {
			return;
		}
		this.fireMs = HUNTER_FIRE_INTERVAL_MS;
		playHunterFire();
		// The barrels, swung onto the craft and then thrown off it a little.
		//
		// The scatter is converted from a LATERAL error into an angle by the
		// range it has to cover, which is why it is divided here: one angle
		// is a certain miss from close in and nothing at all from across the
		// globe, and the error that decides a hit is the one at the target.
		const scatter =
			((Math.random() * 2 - 1) * HUNTER_HIT_ARC * HUNTER_AIM_SCATTER) /
			Math.max(range, HUNTER_HIT_ARC);
		const aimed = turn(nose, bearing + scatter);
		const basis = this.cardBasis();
		for (let i = 0; i < 2; i++) {
			const side = i === 0 ? 1 : -1;
			// out to the barrel and then turned back, so the bolt leaves
			// along the AIMED line and not along the step that put it there.
			// The pair stays parallel, so it straddles what it is pointed at
			// rather than converging both shots onto one point.
			const muzzle = turn(
				advance(turn(aimed, (side * Math.PI) / 2), HUNTER_CANNON_SPREAD),
				(-side * Math.PI) / 2,
			);
			const shot = pair[i];
			shot.frame = { pos: muzzle.pos, heading: muzzle.heading };
			shot.ageMs = 0;
			shot.live = true;
			shot.sprite.setOpacity(1);
			// placed NOW, not on the next frame's flight: the card is drawn
			// this frame, and left where its last flight ended it showed one
			// frame of a shot somewhere else on the globe
			this.placeShot(shot, basis);
		}
	}

	/**
	 * Move every live shot, and see whether one has reached the craft.
	 * @param dt - frame time, ms
	 */
	private flyBolts(dt: number): void {
		const dts = dt / 1000;
		let basis: ReturnType<typeof viewBasis> | undefined;
		for (const shot of this.bolts) {
			if (!shot.live) {
				continue;
			}
			shot.ageMs += dt;
			shot.frame = advance(shot.frame, HUNTER_BOLT_SPEED * dts);
			if (shot.ageMs >= HUNTER_BOLT_LIFE_MS) {
				this.retire(shot);
				continue;
			}
			// The run's own test for a bolt against the hunter, with the
			// roles swapped: the arc between them laid on the shared
			// collision shell, against the two radii. Retired BEFORE the
			// host is told, because telling it can end the run, and the
			// recall that follows walks this same list.
			if (
				this.host.vulnerable() &&
				arcBetween(shot.frame.pos, this.host.shipPos()) * HIT_SHELL <
					SHIP_HIT_RADIUS + HUNTER_BOLT_HIT_RADIUS
			) {
				const where = shot.frame.pos;
				this.retire(shot);
				this.host.onShot(where);
				continue;
			}
			// and then to everything else in the sky. After the craft, so a
			// bolt that could reach both is spent on the player: the rock is
			// a bonus, not a shield the player did not ask for.
			if (this.host.strike(shot.frame.pos, HUNTER_BOLT_HIT_RADIUS)) {
				this.retire(shot);
				continue;
			}
			// the view's basis once per frame, and only on a frame with a
			// shot in the air
			basis ??= this.cardBasis();
			this.placeShot(shot, basis);
		}
	}

	/**
	 * The view's three axes, as the card transform every streak starts from.
	 *
	 * Written into `_view` as a side effect, so that one shot or eight pay
	 * for it once.
	 * @returns the basis, for the turn each streak then adds
	 */
	private cardBasis(): ReturnType<typeof viewBasis> {
		const basis = viewBasis({
			pos: this.host.shipPos(),
			heading: this.host.viewHeading(),
		});
		viewToSprite3d(basis, _view);
		return basis;
	}

	/**
	 * Put a shot where its frame says, turned to face where it is going.
	 *
	 * The same construction as the player's streak in `placeWorld`: the
	 * view's basis as the card's transform, then a turn by the heading's
	 * screen direction, `atan2(-dx, -dy)` for the reasons set out there. No
	 * scale follows the turn here, since this card is already its own size.
	 * @param shot - the shot to place
	 * @param basis - from {@link Hunter.cardBasis}, this frame
	 */
	private placeShot(shot: Shot, basis: ReturnType<typeof viewBasis>): void {
		onGlobe(shot.frame.pos, HUNTER_ALT, PLANET_Z, _at);
		shot.sprite.setPosition(_at[0], _at[1], _at[2]);
		shot.sprite.currentTransform.copy(_view);
		const dx = dot(basis.right, shot.frame.heading);
		const dy = -dot(basis.up, shot.frame.heading);
		shot.sprite.currentTransform.rotate(Math.atan2(-dx, -dy));
	}

	/** Take a shot out of the air and give it back to the pool. */
	private retire(shot: Shot): void {
		shot.live = false;
		shot.sprite.setOpacity(0);
	}

	/**
	 * Burn the hit flash off.
	 *
	 * Cleared outright rather than faded to nothing, so a hunter cannot
	 * spend the rest of its approach glowing a few percent.
	 * @param dt - frame time, ms
	 */
	private burnFlash(dt: number): void {
		if (this.flashMs <= 0 || this.mesh === undefined) {
			return;
		}
		this.flashMs -= dt;
		if (this.flashMs <= 0) {
			this.writeFlash(0);
			return;
		}
		this.writeFlash((this.flashMs / HUNTER_FLASH_MS) ** 1.4);
	}

	/**
	 * Carry the shell forward one frame: the regen, the flare, and the colour
	 * that is the whole of what tells the player how close it is to opening.
	 * @param dt - frame time, ms
	 */
	private tickShell(dt: number): void {
		if (this.bubble === undefined || this.shellFx === undefined) {
			return;
		}
		if (this.frame === undefined) {
			this.bubble.setOpacity(0);
			return;
		}
		this.shellClock += dt / 1000;
		this.sinceShellHitMs += dt;
		this.shellFlashMs = Math.max(0, this.shellFlashMs - dt);
		// The regen, and only while it is HUNTING: a shell refilling behind
		// the horizon on the way out is one nobody was ever going to shoot,
		// and it would arrive at the next fight full anyway.
		if (
			this.phase === "hunt" &&
			this.shellLeft < HUNTER_SHIELD_HITS &&
			this.sinceShellHitMs >= HUNTER_SHIELD_REGEN_DELAY_MS
		) {
			this.shellLeft = Math.min(
				HUNTER_SHIELD_HITS,
				this.shellLeft +
					(HUNTER_SHIELD_REGEN_PER_S * HUNTER_SHIELD_HITS * dt) / 1000,
			);
		}
		// Amber at full, red on the last one it can take. The player's own
		// shell does exactly this, so the reading is already learnt; this is
		// the only thing on screen that says how many bolts are left in it,
		// and it has to be answerable from the hue alone at a glance.
		const left = this.shellLeft / HUNTER_SHIELD_HITS;
		_shellMix.copy(_shellEmpty).lerp(_shellFull, left);
		const flash = this.shellFlashMs / HUNTER_SHIELD_FLASH_MS;
		// Toward white with the flash. See HUNTER_SHIELD_FLASH_WHITEN: the
		// shader's tone map cannot be driven to white from a coloured shell,
		// so the colour is what has to move.
		const white = flash * HUNTER_SHIELD_FLASH_WHITEN;
		this.shellRgb[0] = (_shellMix.r / 255) * (1 - white) + white;
		this.shellRgb[1] = (_shellMix.g / 255) * (1 - white) + white;
		this.shellRgb[2] = (_shellMix.b / 255) * (1 - white) + white;
		// Wrapped HERE, in double precision, rather than in the shader from a
		// clock that only grows: see `shaders/shield.ts`.
		this.shellFx.setUniform(
			"uSpinA",
			wrapAngle(this.shellClock * SHIELD_SPIN_A),
		);
		this.shellFx.setUniform(
			"uSpinB",
			wrapAngle(this.shellClock * SHIELD_SPIN_B),
		);
		this.shellFx.setUniform("uColor", this.shellRgb);
		this.shellFx.setUniform("uImpact", flash);
		this.shellFx.setTime(this.shellClock);
		// It THINS as it drains, so the shell is a readout even between
		// hits, and the flare lifts it while one lasts. At zero all that is
		// left is the collapse: the flare of the hit that took it burns off
		// and then there is nothing, which is the tell that the hull is bare
		// and the next bolt counts. Multiplied by the hull's own fade, so the
		// shell arrives and leaves with the craft rather than popping.
		const alpha =
			this.shellLeft <= 0
				? flash * HUNTER_SHIELD_FLASH_ALPHA
				: HUNTER_SHIELD_ALPHA * (0.45 + 0.55 * left) +
					(HUNTER_SHIELD_FLASH_ALPHA - HUNTER_SHIELD_ALPHA) * flash;
		this.bubble.setOpacity(alpha * (this.mesh?.getOpacity() ?? 0));
	}

	/**
	 * Put the flash colour on the hull at a given strength.
	 * @param k - 0 for none, 1 for the full flash
	 */
	private writeFlash(k: number): void {
		if (this.mesh === undefined) {
			return;
		}
		// WHERE on the ramp this hit sits, by the rocks' rule: 0 at full
		// health, 1 on the hit that leaves one. The kill is hidden under its
		// own burst on the frame it lands, so a colour saved for the kill
		// itself would never be seen; the red has to arrive before it.
		const spent =
			HUNTER_HP > 1 ? 1 - Math.max(0, this.hp - 1) / (HUNTER_HP - 1) : 1;
		for (let c = 0; c < 3; c++) {
			const hot =
				HUNTER_FLASH_HIT[c] +
				(HUNTER_FLASH_LAST[c] - HUNTER_FLASH_HIT[c]) * spent;
			// back to its own glow, not to black: the hull has a standing
			// emissive, and fading the flash to zero would dim it every time
			// it was shot
			this.flashRgb[c] = HUNTER_EMISSIVE[c] + (hot - HUNTER_EMISSIVE[c]) * k;
		}
		this.mesh.emissive = this.flashRgb;
	}

	/** Put the mesh where the frame says, facing the way it is going. */
	private place(): void {
		if (this.mesh === undefined || this.frame === undefined) {
			return;
		}
		// Coming DOWN while `dropMs` runs: the same flight radius it will
		// hold, times a factor easing back to 1. It steers and moves the
		// whole way, so it is already chasing when it lands rather than
		// arriving and then starting.
		const flight = HUNTER_ALT;
		const k = this.dropMs > 0 ? this.dropMs / HUNTER_DROP_MS : 0;
		const radius = flight * math.lerp(1, HUNTER_DROP_FROM, k * k);
		onGlobe(this.frame.pos, radius, PLANET_Z, _at);
		this.mesh.setPosition(_at[0], _at[1], _at[2]);
		// The shell, on the hull and one hull NEARER the camera: it has to
		// draw OVER the craft, because a shell the nose pokes through is not
		// a shell. It descends with the hull too, so an arrival is a shielded
		// craft coming down rather than one that raises its shield on
		// landing.
		//
		// Nearer the camera is a change in DEPTH, which is why this reuses
		// the hull's own x and y rather than asking `onGlobe` for a bigger
		// radius: a bigger radius scales all three components, so off-axis it
		// slides the shell out across the screen as well. Here that was a
		// whole hull's width and plainly visible.
		if (this.bubble !== undefined) {
			stepToward(_at, this.host.eye(), HUNTER_SIZE, _shellAt);
			this.bubble.setPosition(_shellAt[0], _shellAt[1], _shellAt[2]);
		}
		// `craftMatrix`, not `surfaceMatrixWorld`. The latter is what the
		// ROCKS use: it builds a frame from a normal and picks a tangent,
		// which is fine for a lump whose orientation nobody reads and wrong
		// for a craft, which looked skewed the whole time it flew. This one
		// builds all three axes from the frame the hunter is actually flying
		// on, with the Y bridge already baked into the signs, so the hull
		// sits flat on the curvature and points where it is going.
		// the streak, laid a little behind the hull so it leaves the engine
		// rather than the middle of the craft
		// One point per reactor, stepped out to either side along the
		// frame's own side axis. A single ribbon down the centre line came
		// out of the gap BETWEEN the two nozzles, which is the one place on
		// this hull that has no engine in it.
		const tail = advance(this.frame, -HUNTER_TRAIL_OFFSET);
		for (let i = 0; i < this.exhausts.length; i++) {
			const nozzle = advance(
				turn(tail, i === 0 ? Math.PI / 2 : -Math.PI / 2),
				HUNTER_TRAIL_SPREAD,
			).pos;
			onGlobe(nozzle, radius, PLANET_Z, _at);
			this.exhausts[i].addPoint(_at[0], _at[1], _at[2]);
		}
		craftMatrix(this.frame, this.mesh.currentTransform);
	}

	/** Send it home and set the clock for the next one. */
	/**
	 * Break off for good: turn away, keep flying, fade once out of sight.
	 *
	 * The old giving-up set `pass = "attack"` and turned the hunter back
	 * toward the craft, on the reasoning that flying away would finish the
	 * fade behind the planet. That reasoning was measured at an altitude the
	 * hunter no longer flies at: the dome does not hide it until
	 * `HUNTER_DOME_ARC`, 1.87 radians, so turning in pointed it at the one
	 * place the fade was certain to be watched.
	 *
	 * The break here takes NO lead. {@link HUNTER_BREAK_LEAD} exists to vary
	 * the angle the next run comes in from, and a departure has no next run;
	 * straight away opens the range at the full `HUNTER_SPEED` instead of
	 * `cos(lead)` of it.
	 */
	private depart(): void {
		this.phase = "depart";
		this.unseenMs = 0;
		this.phaseMs = HUNTER_DEPART_MAX_MS;
		this.pass = "break";
		this.breakTo = this.escapeTo(this.host.shipPos(), 0);
	}

	private goAway(): void {
		this.phase = "away";
		this.frame = undefined;
		this.phaseMs = math.random(HUNTER_IDLE_MIN_MS, HUNTER_IDLE_MAX_MS);
		this.mesh?.setOpacity(0);
		this.bubble?.setOpacity(0);
	}

	/**
	 * End the run: it leaves and stays gone, and its shots go with it.
	 *
	 * The shots because `tick` stops being called the moment the run ends,
	 * so one in the air on that frame hung over the whole game-over screen,
	 * frozen where it was. Safe to reach from inside `flyBolts`, which is
	 * where a shot that ends the run comes from: nothing here changes the
	 * list it is walking, only the entries.
	 */
	recall(): void {
		this.goAway();
		this.phaseMs = Number.POSITIVE_INFINITY;
		for (const shot of this.bolts) {
			if (shot.live) {
				this.retire(shot);
			}
		}
	}

	/**
	 * Hand back what the world cannot see, which here is nothing.
	 *
	 * The hull and every shot are world children, and the stage's reset
	 * destroys those itself on the way out. The raid and the blast pool
	 * reach in for what sits OUTSIDE the world, an idle pool entry or a
	 * looping voice; this holds neither, so there is nothing to tear down by
	 * hand, and removing the hull here with `keepalive` only skipped the
	 * destroy the reset would have given it.
	 * @ignore
	 */
	destroy(): void {
		this.mesh = undefined;
		this.bubble = undefined;
		this.shellFx = undefined;
		this.frame = undefined;
		this.bolts.length = 0;
	}
}
