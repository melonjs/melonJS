/**
 * melonJS — Earth Defender: the raid.
 *
 * The flying saucer and the bombs it leaves behind, which is the only thing
 * in the game that can end a run outright. The asteroids chip at the shield;
 * this cracks the glass.
 *
 * A class because it owns a great deal of state nothing else reads: where
 * the saucer is on its ring, which phase of the raid it is in, and every
 * live bomb with its fuse. What it does NOT own arrives through
 * {@link RaidHost}, written out so the list stays honest — the saucer and
 * its bombs touch more of the game than the glass does, and that is worth
 * being able to see in one place.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	type Camera3d,
	Color,
	collision,
	Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	type Renderable,
	Sphere,
	Vector3d,
} from "melonjs";
import {
	AXIS_X,
	AXIS_Y,
	BOMB_BLINK_FAST_MS,
	BOMB_BLINK_GAIN,
	BOMB_BLINK_SLOW_MS,
	BOMB_BLINK_TINT,
	BOMB_BURST_AREA,
	BOMB_BURST_COUNT,
	BOMB_BURST_LIFE,
	BOMB_BURST_LIFT,
	BOMB_BURST_SPEED,
	BOMB_BURST_TINT,
	BOMB_CLEARANCE,
	BOMB_CLUSTER_ARC,
	BOMB_CLUSTER_FAR,
	BOMB_CLUSTER_NEAR,
	BOMB_DEFUSE_BURST,
	BOMB_DEFUSE_SHAKE,
	BOMB_DEFUSE_SHAKE_MS,
	BOMB_DEFUSE_TINT,
	BOMB_FALL_MS,
	BOMB_FALL_SPIN,
	BOMB_FLASH_INTENSITY,
	BOMB_FLASH_MS,
	BOMB_FLASH_RANGE,
	BOMB_FUSE_MS,
	BOMB_HIT_RADIUS,
	BOMB_LAND_BURST,
	BOMB_LIGHT_COLOR,
	BOMB_LIGHT_INTENSITY,
	BOMB_LIGHT_LIFT,
	BOMB_LIGHT_RANGE,
	BOMB_LINE_FAR,
	BOMB_LINE_NEAR,
	BOMB_MODEL,
	BOMB_PANE_TRIES,
	BOMB_PATTERN_CLUSTER,
	BOMB_PATTERN_LINE,
	BOMB_PATTERN_PINCER,
	BOMB_PINCER_ARC,
	BOMB_POOL,
	BOMB_SHAKE,
	BOMB_SHAKE_MS,
	BOMB_SHOCK_RADIUS,
	BOMB_SIZE,
	BOMB_SPREAD,
	BOMB_SPREAD_INNER,
	BOMB_STAGGER_MS,
	BURST_LIFE,
	BURST_SPEED,
	DOME_R,
	FREEZE_BOMB_MS,
	PANE_ARC,
	PLANET_R,
	PLANET_Z,
	RUMBLE_BOMB,
	SCORE_PER_BOMB,
	SHIP_SHININESS,
	SHIP_SPECULAR,
	UFO_AIM_DAMP,
	UFO_ALT,
	UFO_AUDIO_REF,
	UFO_AUDIO_ROLLOFF,
	UFO_BOMBS_PER_RUN,
	UFO_GLOW_MAX,
	UFO_GLOW_MIN,
	UFO_GLOW_MS,
	UFO_IDLE_MAX_MS,
	UFO_IDLE_MIN_MS,
	UFO_LEAVE_SPEED,
	UFO_MODEL,
	UFO_POLAR,
	UFO_RUN_LINGER_MS,
	UFO_RUN_POLAR,
	UFO_SHADOW_OPACITY,
	UFO_SHADOW_SCALE,
	UFO_SHADOW_THROW,
	UFO_SIZE,
	UFO_SOUND,
	UFO_SOUND_VOLUME,
	UFO_SPEED,
	UFO_SPIN,
	UFO_TRANSFER_MS,
	UFO_WARNING_LAPS,
} from "../constants";
import type { BlastFx } from "../fx/blastFx";
import { playAt, playOn, playRaidWarning, rumble, SFX } from "../fx/sfx";
import {
	advance,
	bridgeY,
	dot,
	frameAt,
	normalize,
	onGlobe,
	onRing,
	ringBasis,
	ringBasisFrom,
	ringHeading,
	type SurfaceFrame,
	sightlineClearance2,
	slerp,
	surfaceMatrixWorld,
	turn,
	wrapAngle,
} from "../lib/sphereMath";
import type { Dome } from "./dome";
import type { RockContacts } from "./rocks";

/** scratch, so a frame of the raid allocates nothing @ignore */
const _at: [number, number, number] = [0, 0, 0];
const _bridged = new Vector3d(0, 0, 0);
const _mat = new Matrix3d();

/**
 * What the raid needs from the rest of the game.
 *
 * Eleven things, against the dome's five, and each one earns its place: the
 * saucer and its bombs score, shake the frame, hold the fight, are shot at
 * and flown into, and crack the glass. Written out rather than handing the
 * raid the controller, so that list cannot grow quietly.
 */
export interface RaidHost {
	/** the shared blast pool: the landing puff, the blast, the defuse */
	readonly blast: BlastFx;
	/**
	 * The glass the bombs are aimed at: which pane one will crack, asked when
	 * it is dropped, and the crack itself when it goes off. A sibling service
	 * like `blast`, not a window onto the controller.
	 */
	readonly dome: Dome;
	/**
	 * The view, for the shake a blast gives the frame, and nothing else. The
	 * limb test in `ufoOnScreen` deliberately stands its own camera straight
	 * out from the player rather than reading this one's pose: the pan is no
	 * part of whether the globe hides the saucer.
	 */
	readonly camera: Camera3d;
	/**
	 * The key light the saucer's blob shadow is cast from. The run hands the
	 * same light to every caster it builds, the craft and each rock; the
	 * saucer is built here, so it is handed in.
	 */
	readonly sun: Light3d;
	/**
	 * Where the craft is on the unit sphere. The formation is laid around it,
	 * the run ring tracks it, and the limb test stands a camera out from it.
	 *
	 * The POSITION only, never the craft's frame. The raid read the craft's
	 * HEADING once, for the warning lap, and when the view was decoupled from
	 * the nose that lap started ringing the bottom of the screen. What is up
	 * on screen is {@link RaidHost#viewHeading}, and this shape makes the old
	 * mistake unwritable.
	 *
	 * Read live, never captured: the craft's frame is REPLACED every frame it
	 * moves, so a value held here would pin every raid to wherever the player
	 * was standing when the scene loaded.
	 */
	readonly shipPos: Vector3d;
	/**
	 * The direction that is UP ON SCREEN, which the warning lap is centred on
	 * so the saucer arrives over the top of the view wherever the player is
	 * looking. The VIEW's heading, not the craft's: see
	 * {@link RaidHost#shipPos}.
	 * @returns the view's heading, as a unit direction
	 */
	viewHeading(): Vector3d;
	/**
	 * Put the WARNING banner up: the saucer has committed to a bombing run.
	 *
	 * Called once, on the frame the raid leaves its warning lap, so the
	 * banner has the whole transfer to cross before the first bomb is laid.
	 * The raid says WHEN, the controller owns the banner itself, the same
	 * split as every other thing the raid asks the scene for.
	 */
	warnOfRaid(): void;
	/**
	 * Stand a blob shadow under something, on the glass.
	 *
	 * On the host rather than in here because three unrelated things use it —
	 * the saucer, the craft and every rock — and it has not been given a home
	 * of its own yet. It arguably belongs on {@link Dome}, whose panes the
	 * blob lands on and whose radius it is lifted from.
	 * @param mesh - the caster
	 * @param q - where it stands, as a unit direction
	 */
	layShadow(mesh: Mesh, q: Vector3d): void;
	/**
	 * A live bomb was touched by something.
	 *
	 * Reported, not acted on, for two reasons. What touched it is the run's to
	 * recognise: the craft's mesh and the bolts in flight are its state, and
	 * the raid has no business knowing the shape of a bolt. And what to DO
	 * about it has to wait, because this fires inside the world's own update
	 * walk and the response tears renderables out of it. It comes back as
	 * {@link Raid#defuse} or {@link Raid#detonate}.
	 * @param bomb - the one that was touched
	 * @param other - whatever touched it
	 */
	bombTouched(bomb: Bomb, other: Renderable): void;
	/**
	 * Points scored at a spot: bank them, fly the number up from there, and
	 * redraw the readout.
	 *
	 * One call rather than three writes, and the raid hands over what the bomb
	 * is WORTH rather than what it scored. The multiplier rides a kill streak
	 * the raid neither sees nor feeds, and that is deliberate: defusing a bomb
	 * does not advance the streak where killing a rock does.
	 * @param x - where, in scene units
	 * @param y - where, in scene units
	 * @param z - where, in scene units
	 * @param base - what it is worth before the run's multiplier
	 */
	award(x: number, y: number, z: number, base: number): void;
	/**
	 * Hold the fight for a few frames.
	 *
	 * The raid says how long, because a bomb's punch is its own tuning and is
	 * sized against a shield hit's. It has no business knowing the hold is a
	 * gate in the run's update loop, or what the field behind it is called.
	 * @param ms - how long to hold
	 */
	freeze(ms: number): void;
	/** kick the screen's channel split */
	pulseAberration(): void;
}

export /** one bomb on the glass, counting down */
interface Bomb {
	/** its three meshes, moved together */
	parts: Mesh[];
	/** the red band, which is the warning lamp */
	lamp: Mesh | undefined;
	/** what that lamp throws onto the glass, in the world only while it is */
	light: Light3d;
	/** the one part carrying the collision shape */
	collider: Mesh;
	/** that shape, so the fall can take it out of collision; see {@link Drifter.hit} */
	hit: Sphere;
	/** where it sits on the shell, as a unit direction */
	at: Vector3d;
	/** the pane it will crack */
	pane: number;
	/** what is left of the fuse, milliseconds; only counts once it has landed */
	fuseMs: number;
	/** where it left the saucer, so the fall can be drawn */
	from: Vector3d;
	/** what is left of the fall, milliseconds; `0` once it is on the glass */
	fallMs: number;
	/** how far through its tumble on the way down, radians */
	fallSpin: number;
	/** false while it is in the pool */
	live: boolean;
}

export class Raid {
	private app: Application;
	private host: RaidHost;

	/**
	 * @param app - the application the saucer and its bombs are added to
	 * @param host - the eleven things the raid reaches back for
	 */
	constructor(app: Application, host: RaidHost) {
		this.app = app;
		this.host = host;
		// bombs first, then the saucer: the order the world's children were
		// added in before this was a class, and `sortOn: "depth"` makes that
		// a tie-break rather than nothing
		this.initBombs(app);
		this.initUfo(app);
	}

	/** the bombs on the glass, and the ones waiting to be used */
	bombs: Bomb[] = [];
	bombPool: Bomb[] = [];
	/** the app, for adding and removing bombs and cracks */
	bombApp: Application | undefined;
	/**
	 * The saucer, as one mesh per material the model carries.
	 *
	 * Three meshes rather than a container, the same shape as the globe and
	 * the dome above: the glTF loader flattens a multi-material mesh into one
	 * node per primitive, and placing three meshes from one matrix costs less
	 * than a `GLTFModel` whose own width is `Infinity` and whose scale
	 * multiplies the node transforms instead of replacing them.
	 */
	ufoParts: Mesh[] = [];
	/**
	 * The emissive parts, each with the colour the model authored.
	 *
	 * The base is kept per part rather than once for the saucer: the pulse
	 * SCALES the authored colour, so it has to multiply the original every
	 * frame instead of the value it wrote last, which would compound away to
	 * nothing or to white within a second.
	 */
	ufoGlowParts: { mesh: Mesh; base: Float32Array }[] = [];
	/** where the saucer is and which way it is going, on the unit sphere */
	ufo: SurfaceFrame = {
		pos: new Vector3d(0, 1, 0),
		heading: new Vector3d(1, 0, 0),
	};
	/**
	 * Which part of the raid the saucer is in.
	 *
	 * `away` is the resting state and the only one in which it is not in the
	 * sky at all. The rest run in order: it rises over the limb and rings the
	 * high pole once in plain sight (`lap`), slides down to a tight ring about
	 * the player (`transfer`), drops its bombs there (`run`), then spirals
	 * back out until the globe hides it (`leaving`).
	 */
	ufoPhase: "away" | "lap" | "transfer" | "run" | "leaving" = "away";
	/** counts down to the next raid while `away`, milliseconds */
	ufoNextMs = 0;
	/** the pole the current ring is centred on */
	ufoAxis: Vector3d = new Vector3d(0, 1, 0);
	/** the pole it is sliding towards, during `transfer` */
	ufoAxisFrom: Vector3d = new Vector3d(0, 1, 0);
	ufoAxisTo: Vector3d = new Vector3d(0, 1, 0);
	/** the ring basis, perpendicular to the axis and to each other */
	ufoRingB: Vector3d = new Vector3d(1, 0, 0);
	ufoRingC: Vector3d = new Vector3d(0, 0, 1);
	/** how far round the ring, radians, and how far from its pole */
	ufoRing = 0;
	ufoPolar = UFO_POLAR;
	/** how far through the current phase, milliseconds or radians as it suits */
	ufoPhaseMs = 0;
	/** how much of the warning lap is done, radians */
	ufoLapped = 0;
	/** bombs left to drop on this run, and the wait until the next */
	ufoBombsLeft = 0;
	ufoBombMs = 0;
	/** how far through its own spin it is, radians */
	ufoSpin = 0;
	/** how far through the running-lights pulse it is, milliseconds */
	ufoGlowMs = 0;
	/** the drone's playback id, so its position can be written per frame */
	ufoSoundId: number | undefined;
	/** whether the saucer is in the sky, which is when its drone belongs */
	private ufoAudible = false;
	/**
	 * Whether the run is paused, which silences the drone whatever the
	 * saucer is doing.
	 *
	 * Kept apart from {@link Raid.ufoAudible} because the two are different
	 * questions with the same answer, and resuming on the wrong one is how a
	 * drone comes back for a saucer that is not there: a pause taken while
	 * the sky is empty would otherwise start it on the way out.
	 */
	private silenced = false;

	/**
	 * The saucer that raids the dome.
	 *
	 * Built once and kept: there is one of them, it never dies, and it is on
	 * a great circle that carries it round the planet whether anyone is
	 * watching or not. Half of every orbit is spent behind the globe, which
	 * is the arrival: it rises over the limb under its own motion, with no
	 * spawn to schedule and nothing to fade in.
	 *
	 * Its glow is the model's own `emissiveFactor`, kept rather than tinted
	 * in: the author lit the trim and the ports, and reproducing that by hand
	 * would be guessing at a mask the geometry already carries.
	 * @param app - the application to add the parts to
	 */
	initUfo(app: Application): void {
		const data = loader.getGLTF(UFO_MODEL);
		if (!data) {
			throw new Error(`earthDefender: glTF "${UFO_MODEL}" was not preloaded`);
		}
		for (const node of data.nodes) {
			const mesh = new Mesh(0, 0, {
				vertices: node.vertices,
				normals: node.normals,
				uvs: node.uvs,
				indices: node.indices,
				normalize: false,
				scale: UFO_SIZE,
				lit: true,
				// DOUBLE SIDED, unlike every other mesh here, because this
				// model is not a closed solid: its trim is separate strips
				// lying on the hull, which leaves 72 non-manifold edges and
				// about a hundred faces wound inward. Culled, those faces
				// vanish and the saucer reads as see-through. Recalculating
				// the normals is not the answer either, since a recalculation
				// needs a manifold surface to agree on and it relit the whole
				// hull from the inside when tried. 564 triangles drawn from
				// both sides is the cheap, honest way to take the asset as it
				// actually is.
				cullBackFaces: false,
				// the same rotation-not-reflection bridge the globe needs, or
				// the saucer banks the opposite way to the world it crosses
				rightHanded: true,
				specular: SHIP_SPECULAR,
				shininess: SHIP_SHININESS,
				// the material's own base colour, encoded from the
				// loader's LINEAR factor by the engine
				baseColorFactor: node.baseColorFactor,
			});
			if (node.emissive) {
				// the lit trim: kept apart, with its authored colour, so
				// `updateUfo` can pulse it without losing the original
				const lit = new Float32Array(node.emissive);
				mesh.emissive = new Float32Array(lit);
				this.ufoGlowParts.push({ mesh, base: lit });
			}
			// Only the hull casts. The saucer is several meshes, and every
			// one of them dropping its own blob on the same spot stacks them
			// into a hard dark disc; the first part is the body.
			// All three settings inside the condition, so the intent reads:
			// only the hull casts, and only the hull is configured.
			if (this.ufoParts.length === 0) {
				mesh.castGroundShadow = true;
				mesh.shadowScale = UFO_SHADOW_SCALE;
				mesh.shadowOpacity = UFO_SHADOW_OPACITY;
				mesh.shadowLight = this.host.sun;
				mesh.shadowOffset = UFO_SHADOW_THROW;
			}
			this.ufoParts.push(mesh);
			app.world.addChild(mesh, PLANET_Z);
		}
		// The drone, looping for as long as the saucer is in the sky, and
		// positioned in 3D rather than merely panned.
		//
		// `follow` hands the saucer's own hull to the engine, which re-reads
		// its absolute position after every world update and places the sound
		// there. The listener rides the camera (`setListener` below), so the
		// two are expressed in the same scene coordinates and nothing has to
		// be re-stated in the listener's frame by hand.
		//
		// HRTF gives this front-to-back as well as left-to-right, which is the
		// half a stereo pan cannot do. The distances are scene units, so the
		// reference distance is one too.
		//
		// This has to come BEFORE the `showUfo` below, and that ordering is
		// load bearing: `showUfo` pauses the drone through `ufoSoundId`, and
		// returns early while that is undefined. Hiding the saucer first left
		// the drone playing from load and through every idle gap, with no
		// saucer anywhere in the sky to explain it.
		audio.panner(UFO_SOUND, {
			panningModel: "HRTF",
			distanceModel: "inverse",
			refDistance: UFO_AUDIO_REF,
			rolloffFactor: UFO_AUDIO_ROLLOFF,
		});
		this.ufoSoundId = audio.play(UFO_SOUND, {
			loop: true,
			volume: UFO_SOUND_VOLUME,
			follow: this.ufoParts[0],
		});
		// the ear travels with the view, orientation included: a `Camera3d`
		// contributes its basis as well as its position
		audio.setListener(this.host.camera);

		// nothing in the sky to begin with: the first raid is on the clock
		this.ufoPhase = "away";
		this.ufoNextMs = math.random(UFO_IDLE_MIN_MS, UFO_IDLE_MAX_MS);
		this.showUfo(false);
	}

	/**
	 * Build the bombs, once, and keep them.
	 *
	 * Pooled for the same reason the bolts are: each one is three meshes, and
	 * a raid drops them in quick succession, so building them per drop would
	 * put the allocation exactly where the frame is busiest.
	 *
	 * The model arrives as one node per material. The red band is kept apart
	 * because it is the lamp: the glTF gives it no emission of its own, so it
	 * is given one here and driven by the fuse.
	 * @param app - the application the parts are added to and removed from
	 */
	private initBombs(app: Application): void {
		const data = loader.getGLTF(BOMB_MODEL);
		if (!data) {
			throw new Error(`earthDefender: glTF "${BOMB_MODEL}" was not preloaded`);
		}
		for (let i = 0; i < BOMB_POOL; i++) {
			const parts: Mesh[] = [];
			let lamp: Mesh | undefined;
			let body: Mesh | undefined;
			for (const node of data.nodes) {
				const mesh = new Mesh(0, 0, {
					vertices: node.vertices,
					normals: node.normals,
					uvs: node.uvs,
					indices: node.indices,
					normalize: false,
					scale: BOMB_SIZE,
					lit: true,
					cullBackFaces: true,
					rightHanded: true,
					specular: SHIP_SPECULAR,
					shininess: SHIP_SHININESS,
					// the material's own base colour, encoded from the
					// loader's LINEAR factor by the engine
					baseColorFactor: node.baseColorFactor,
				});
				const c = node.baseColorFactor;
				if (c) {
					// the red band is the lamp. Recognised by its colour
					// rather than by a material name, because a name is a
					// string in an asset and this is a property of the thing.
					if (c[0] > 0.6 && c[1] < 0.3 && c[2] < 0.35) {
						lamp = mesh;
						mesh.emissive = new Float32Array([0, 0, 0]);
					} else if (body === undefined) {
						body = mesh;
					}
				}
				parts.push(mesh);
			}
			// ONE of the three carries the collision shape, since a bomb is
			// one thing to shoot at rather than three
			const collider = body ?? parts[0];
			const hit = new Sphere(0, 0, 0, BOMB_HIT_RADIUS);
			// out of collision until it lands; see `tickBombs`
			hit.isActive = false;
			collider.bodyDef = {
				type: "dynamic",
				gravityScale: 0,
				shapes: [hit],
				isSensor: true,
				// ENEMY so the bolts' mask reaches it. It answers to bolts and
				// to the craft, and NOT to rocks: a rock rolling over one
				// neither moves it (every body here is a sensor, so nothing is
				// ever pushed) nor sets it off. A bomb is the player's
				// problem, not the rocks'.
				collisionType: collision.types.ENEMY_OBJECT,
				collisionMask:
					collision.types.PROJECTILE_OBJECT | collision.types.PLAYER_OBJECT,
			};
			// Into the broadphase, same as the rocks, the bolts and the craft:
			// `isKinematic` defaults TRUE, which keeps a renderable out of the
			// Octree, and the 3D narrowphase walks that tree. Without this the
			// body exists, the masks match, and nothing is ever reported, so
			// shooting a bomb did exactly nothing.
			collider.isKinematic = false;
			const bomb: Bomb = {
				hit,
				parts,
				lamp,
				// built with the bomb and NOT added to the world: a light
				// only costs the lit shader while it is registered with the
				// stage, so a pooled one is free
				light: new Light3d({
					type: "point",
					intensity: 0,
					range: BOMB_LIGHT_RANGE,
					color: new Color().parseCSS(BOMB_LIGHT_COLOR),
				}),
				collider,
				at: new Vector3d(0, 1, 0),
				pane: 0,
				fuseMs: 0,
				from: new Vector3d(0, 1, 0),
				fallMs: 0,
				fallSpin: 0,
				live: false,
			};
			const contacts = collider as RockContacts;
			contacts.onCollisionStart = (_response, other) => {
				// A bomb is a hazard where it LANDS: one that could be shot
				// or flown into mid-air would be answered before it ever
				// threatened the thing it was aimed at. The FALL is kept out
				// of collision by `hit.isActive`, in `tickBombs`, and not by
				// returning from here — returning swallows the contact, and
				// because `onCollisionStart` is an entry event there is no
				// second one once the bomb lands, so anything already
				// overlapping it at touchdown never registered at all.
				// `isActive` takes the shape out of the broadphase instead, so
				// the contact is made fresh when it comes back.
				if (!bomb.live) {
					return;
				}
				// Reported, not acted on. What touched it is the run's to
				// recognise, and what to DO about it has to wait: this fires
				// inside the world's own update walk, and the response tears
				// renderables out of it.
				this.host.bombTouched(bomb, other);
			};
			this.bombPool.push(bomb);
		}
		this.app = app;
	}

	/**
	 * Lay the whole formation, in one go.
	 *
	 * All eight at once rather than one every so often: a star arrives as a
	 * star, and dropping them in sequence had the first already counting down
	 * while the last was still being placed, which read as a trickle rather
	 * than as a raid.
	 */
	dropBombStar(): void {
		// ONE offset for the whole formation, not one per bomb. A figure is
		// only legible if it is regular, so the shape itself is exact and it
		// is the shape AS A WHOLE that is turned: every raid lays its pattern
		// at a different bearing, rather than points that each wandered.
		const offset = math.randomFloat(0, Math.PI * 2);
		// the craft's frame taken ONCE, so every point is measured from the
		// same place even though it is still moving as they fall
		const origin = frameAt(this.host.shipPos);
		const points = this.bombPattern(offset);
		// One bomb per pane, enforced here rather than left to the patterns.
		// A pane is `PANE_ARC` across and breaks on `PANE_CRACKS_MAX`, and
		// the line lays its points barely half a pane apart, so three of
		// them shared one pane and took it out in a single raid. The cluster
		// is supposed to be the only shape that can do that. A point whose
		// pane is already taken is walked OUTWARD along its own bearing,
		// which keeps the figure's shape and direction while separating it.
		const taken = new Set<number>();
		const last = points.length - 1;
		points.forEach((point, i) => {
			const distance = this.freePaneDistance(
				origin,
				point.bearing,
				point.distance,
				taken,
			);
			// Staggered, so the formation goes off as a wave travelling along
			// itself rather than as one frame of noise: see `BOMB_STAGGER_MS`.
			// The ORDER is the pattern's own, so the sweep reads as the shape
			// being walked rather than as bombs popping at random.
			//
			// Anchored to the LAST point, not the first. The stagger used to
			// be added on top of the fuse, so eight bombs pushed the raid's
			// deadline out to `BOMB_FUSE_MS + 7 * BOMB_STAGGER_MS`, nearly
			// eight seconds. Nobody chose that number: it fell out of adding
			// a visual wave to a tuned fuse. Counting down to the fuse
			// instead keeps the wave, its spacing and its order, and gives
			// the raid back the deadline the constant actually names.
			this.dropBomb(
				origin,
				point.bearing,
				distance,
				BOMB_FUSE_MS - (last - i) * BOMB_STAGGER_MS,
			);
		});
	}

	/**
	 * Walk a formation point outward until it lands on a pane nobody has.
	 *
	 * The patterns are laid in arcs, and an arc says nothing about which
	 * pane it ends on, so two points a third of a pane apart are two bombs
	 * on the same glass. Three of them is a pane gone in one raid, which is
	 * supposed to be the cluster's trick alone.
	 *
	 * Outward rather than sideways so the figure keeps its bearing: a line
	 * stays a line and only gets longer. Capped, and the cap matters: a
	 * formation can want more panes than the cap can reach, and a point that
	 * cannot be separated is better laid on a shared pane than dropped, so
	 * the raid always has the weight the pattern promised.
	 * @param origin - the craft's frame when the formation was laid
	 * @param bearing - the point's bearing from it
	 * @param distance - the arc the pattern asked for
	 * @param taken - panes already claimed by this formation, added to here
	 * @returns the arc to actually drop at
	 */
	freePaneDistance(
		origin: SurfaceFrame,
		bearing: number,
		distance: number,
		taken: Set<number>,
	): number {
		const spun = turn(origin, bearing);
		for (let step = 0; step <= BOMB_PANE_TRIES; step++) {
			const at = distance + step * PANE_ARC;
			const pane = this.host.dome.paneAt(advance(spun, at).pos);
			if (!taken.has(pane)) {
				taken.add(pane);
				return at;
			}
		}
		return distance;
	}

	/**
	 * Where this raid's bombs go, in the order they will go off.
	 *
	 * Four shapes, rolled per raid. Each asks a different question of the
	 * player, and the order each is returned in is what the stagger turns
	 * into a sweep: round the ring, along the line, outward from the middle
	 * of a cluster, and arm-by-arm for a pincer so both close together.
	 *
	 * All four lay {@link UFO_BOMBS_PER_RUN}, so the SHAPE is the whole of
	 * what varies between raids and the weight of one never depends on which
	 * came up. Each derives its count from that constant rather than naming
	 * its own, which is what stops them drifting apart again.
	 *
	 * Bearings are measured from the craft and distances are arcs along the
	 * shell, which is what `dropBomb` walks.
	 * @param offset - the bearing the whole figure is turned by
	 * @returns the points, in detonation order
	 */
	bombPattern(offset: number): { bearing: number; distance: number }[] {
		const roll = Math.random();
		const points: { bearing: number; distance: number }[] = [];

		if (roll < BOMB_PATTERN_LINE) {
			// A stripe THROUGH the craft: swept from one end to the other, so
			// the player picks an end and works across rather than orbiting.
			// Half the raid each side, stepped evenly between the two ends.
			const perSide = UFO_BOMBS_PER_RUN / 2;
			const step =
				perSide > 1 ? (BOMB_LINE_FAR - BOMB_LINE_NEAR) / (perSide - 1) : 0;
			// the far arm first and inward, then out along the near one, so
			// the sweep crosses the craft once rather than starting again
			for (let i = perSide - 1; i >= 0; i--) {
				points.push({
					bearing: offset + Math.PI,
					distance: BOMB_LINE_NEAR + i * step,
				});
			}
			for (let i = 0; i < perSide; i++) {
				points.push({
					bearing: offset,
					distance: BOMB_LINE_NEAR + i * step,
				});
			}
			return points;
		}

		if (roll < BOMB_PATTERN_LINE + BOMB_PATTERN_CLUSTER) {
			// All of it on one patch of glass, and the only pattern that can
			// take a pane out on its own. Laid from the far edge inward, so
			// the one nearest the player is the last to go and there is a
			// reason to stay with it.
			for (let i = 0; i < UFO_BOMBS_PER_RUN; i++) {
				const k = UFO_BOMBS_PER_RUN > 1 ? i / (UFO_BOMBS_PER_RUN - 1) : 0;
				points.push({
					bearing: offset + (k - 0.5) * BOMB_CLUSTER_ARC,
					distance: math.lerp(BOMB_CLUSTER_FAR, BOMB_CLUSTER_NEAR, k),
				});
			}
			return points;
		}

		if (roll < BOMB_PATTERN_LINE + BOMB_PATTERN_CLUSTER + BOMB_PATTERN_PINCER) {
			// two arms on opposite bearings, alternating, so neither can be
			// finished before the other starts going off
			const perArm = UFO_BOMBS_PER_RUN / 2;
			for (let i = 0; i < perArm; i++) {
				const k = perArm > 1 ? i / (perArm - 1) - 0.5 : 0;
				points.push({
					bearing: offset + k * BOMB_PINCER_ARC,
					distance: BOMB_SPREAD,
				});
				points.push({
					bearing: offset + Math.PI + k * BOMB_PINCER_ARC,
					distance: BOMB_SPREAD,
				});
			}
			return points;
		}

		// the ring, which stays the most common: evenly spaced, alternating
		// near and far so the figure has points rather than being a circle
		for (let i = 0; i < UFO_BOMBS_PER_RUN; i++) {
			points.push({
				bearing: offset + (i / UFO_BOMBS_PER_RUN) * Math.PI * 2,
				distance: i % 2 === 0 ? BOMB_SPREAD : BOMB_SPREAD_INNER,
			});
		}
		return points;
	}

	/**
	 * Drop one, on its point of the star.
	 *
	 * Around the PLAYER rather than anywhere on the shell, because a bomb is
	 * only a fair threat if it can be seen and reached. Held off far enough
	 * that the craft, which turns on the spot and fires forward, has room to
	 * come about and line one up.
	 *
	 * Alternate points sit at the near arc, which is what gives the formation
	 * its points and gives the player an order to work in.
	 * @param origin - the craft's frame when the formation was laid
	 * @param angle - the bearing for this point, radians
	 * @param distance - how far along that bearing, as an arc on the shell
	 * @param fuseMs - how long this one sits before it goes off
	 */
	dropBomb(
		origin: SurfaceFrame,
		angle: number,
		distance: number,
		fuseMs: number,
	): void {
		const bomb = this.bombPool.pop();
		if (bomb === undefined) {
			return;
		}
		// from the saucer, wherever it currently is
		playOn(SFX.bombDrop, this.ufoParts[0]);
		const spun = turn(origin, angle);
		const at = advance(spun, distance).pos;
		bomb.at = at;
		bomb.pane = this.host.dome.paneAt(at);
		bomb.fuseMs = fuseMs;
		// it leaves the saucer and falls to its point. The fuse does not start
		// until it lands, so the seven seconds a player gets are seven of
		// it sitting there rather than partly spent in the air.
		bomb.from = this.ufo.pos;
		bomb.fallMs = BOMB_FALL_MS;
		bomb.fallSpin = 0;
		// out of collision for the fall, set HERE and not left to the first
		// tick: this bomb comes off the pool still carrying the `true` its
		// last landing wrote, which would make it collidable for the frame
		// between leaving the saucer and the first `tickBombs`
		bomb.hit.isActive = false;
		bomb.live = true;
		for (const part of bomb.parts) {
			this.app.world.addChild(part, PLANET_Z);
		}
		// and its lamp's light, which is what registers it with the stage.
		// Dark until the first blink, so the frame it arrives on is not a
		// red flash out of nothing.
		bomb.light.intensity = 0;
		this.app.world.addChild(bomb.light);
		this.placeBomb(bomb);
		this.bombs.push(bomb);
	}

	/**
	 * Stand one on the glass.
	 *
	 * The model was cut off at the bottom of its red band and its origin put
	 * on that cut, so placing it AT the shell radius already sits it flat:
	 * there is no half-height to add and no per-bomb offset to remember.
	 *
	 * The surface normal is bridged first, the same correction the saucer and
	 * the blast waves need: `Mesh` composes `diag(1, -1, -1) * transform` for
	 * a right-handed source, so an un-bridged normal stands the bomb at an
	 * angle that grows with how far it is from the equator.
	 * @param bomb - the bomb to place
	 */
	placeBomb(bomb: Bomb): void {
		// Where along the fall it is, `0` at the saucer and `1` on the glass.
		// The surface point SLERPS from under the saucer to its own, while the
		// radius drops, so it comes down on an arc rather than dead vertical:
		// a thing let go by something moving, which is what happened.
		const t = bomb.fallMs > 0 ? 1 - bomb.fallMs / BOMB_FALL_MS : 1;
		const here = t >= 1 ? bomb.at : slerp(bomb.from, bomb.at, t);
		const radius =
			PLANET_R + UFO_ALT + (DOME_R + BOMB_CLEARANCE - PLANET_R - UFO_ALT) * t;
		onGlobe(here, radius, PLANET_Z, _at);
		bridgeY(here, true, _bridged);
		surfaceMatrixWorld(_bridged, _mat);
		for (const part of bomb.parts) {
			part.setPosition(_at[0], _at[1], _at[2]);
			part.currentTransform.copy(_mat);
			if (bomb.fallMs > 0) {
				// tumbling on the way down, and upright the moment it lands
				part.currentTransform.rotate(bomb.fallSpin, AXIS_X);
			}
		}
		// The lamp's light rides with it, so the red patch follows the thing
		// down the sky rather than appearing once it has landed. Placed on
		// the same surface point but HIGHER, for the reason set out in
		// `BOMB_LIGHT_LIFT`: a light level with a surface cannot light it.
		onGlobe(here, radius + BOMB_LIGHT_LIFT, PLANET_Z, _at);
		bomb.light.setPosition(_at[0], _at[1], _at[2]);
	}

	/**
	 * Take one off the glass and give it back to the pool.
	 * @param bomb - the bomb to retire
	 */
	retireBomb(bomb: Bomb): void {
		bomb.live = false;
		// and out of the broadphase while it sits in the pool
		bomb.hit.isActive = false;
		// `removeChildNow`, for the reason set out at length in `removeBolt`:
		// `removeChild` DEFERS to the end of the update and draw stack, which
		// is wrong for anything going back into a pool. `dropBomb` pops this
		// same bomb off the pool and re-adds its parts, and the queued
		// removal then fires and takes the LIVE one out of the world. Today's
		// timings hide it: a bomb lives about eight seconds and raids are half a
		// minute apart, so a retire and a drop never share a frame — which
		// makes it the kind of thing that waits for a tuning change to
		// surface.
		for (const part of bomb.parts) {
			this.app.world.removeChildNow(part, true);
		}
		// `keepalive`, so the light is deregistered rather than destroyed:
		// this bomb is going back in the pool and will want it again
		if (this.app.world.hasChild(bomb.light) === true) {
			this.app.world.removeChildNow(bomb.light, true);
		}
		bomb.light.intensity = 0;
		if (bomb.lamp?.emissive !== undefined) {
			bomb.lamp.emissive[0] = 0;
			bomb.lamp.emissive[1] = 0;
			bomb.lamp.emissive[2] = 0;
		}
		const i = this.bombs.indexOf(bomb);
		if (i >= 0) {
			this.bombs.splice(i, 1);
		}
		this.bombPool.push(bomb);
	}

	/**
	 * Run the fuses.
	 *
	 * The lamp blinks on a period that shortens as the fuse runs down, from
	 * {@link BOMB_BLINK_SLOW_MS} to {@link BOMB_BLINK_FAST_MS}. A blink rate
	 * rather than a bar: it is readable from across the globe at a glance and
	 * needs no screen furniture, and the rate IS the information.
	 * @param dt - milliseconds since the last frame
	 */
	tickBombs(dt: number): void {
		for (let i = this.bombs.length - 1; i >= 0; i--) {
			const bomb = this.bombs[i];
			if (bomb.fallMs > 0) {
				bomb.fallMs -= dt;
				bomb.fallSpin = wrapAngle(bomb.fallSpin + BOMB_FALL_SPIN * dt);
				// out of collision until it arrives, exactly as a rock's
				// entry does it: the engine's own per-shape switch
				bomb.hit.isActive = bomb.fallMs <= 0;
				if (bomb.fallMs <= 0) {
					bomb.fallMs = 0;
					// landed: a small puff where it met the glass, so the
					// arrival is a thing that happened rather than a thing
					// that merely stopped
					onGlobe(bomb.at, DOME_R + BOMB_BURST_LIFT, PLANET_Z, _at);
					this.host.blast.burst(
						_at[0],
						_at[1],
						_at[2],
						BOMB_BURST_TINT,
						BOMB_LAND_BURST,
						bomb.at,
						BURST_SPEED,
						BURST_LIFE,
						BOMB_BURST_AREA * 0.5,
					);
				}
				this.placeBomb(bomb);
				continue;
			}
			bomb.fuseMs -= dt;
			if (bomb.fuseMs <= 0) {
				this.detonate(bomb);
				continue;
			}
			const lamp = bomb.lamp;
			if (lamp?.emissive === undefined) {
				continue;
			}
			// how far through the fuse, 0 at the drop and 1 at the blast
			const t = 1 - bomb.fuseMs / BOMB_FUSE_MS;
			const period = math.lerp(BOMB_BLINK_SLOW_MS, BOMB_BLINK_FAST_MS, t);
			// a hard on/off rather than a fade: this is a warning light, and
			// the eye reads a switch faster than it reads a ramp
			const on = bomb.fuseMs % period < period * 0.45;
			const k = on ? BOMB_BLINK_GAIN : 0;
			lamp.emissive[0] = BOMB_BLINK_TINT[0] * k;
			lamp.emissive[1] = BOMB_BLINK_TINT[1] * k;
			lamp.emissive[2] = BOMB_BLINK_TINT[2] * k;
			// and the glass under it, off the SAME switch, so the patch on
			// the dome is the lamp rather than a second thing near it
			bomb.light.intensity = on ? BOMB_LIGHT_INTENSITY : 0;
		}
	}

	/**
	 * A bomb that was not dealt with.
	 * @param bomb - the one going off
	 */
	detonate(bomb: Bomb): void {
		// Thrown CLEAR of the shell, not at it. The dome's frame is opaque and
		// writes depth, so a burst emitted on the surface is half swallowed by
		// the very thing it is breaking and barely reads at all.
		onGlobe(bomb.at, DOME_R + BOMB_BURST_LIFT, PLANET_Z, _at);
		playAt(SFX.bombBlast, _at[0], _at[1], _at[2]);
		rumble(RUMBLE_BOMB);
		this.host.blast.burst(
			_at[0],
			_at[1],
			_at[2],
			BOMB_BURST_TINT,
			BOMB_BURST_COUNT,
			bomb.at,
			BOMB_BURST_SPEED,
			BOMB_BURST_LIFE,
			BOMB_BURST_AREA,
		);
		// `force`, the fifth argument, and it is the whole reason this was
		// not landing: `shake()` returns WITHOUT DOING ANYTHING when one is
		// already in flight, and a bomb goes off in the middle of constant
		// shooting, so the 130 ms twitch from whatever rock was killed a
		// moment earlier swallowed the blast entirely. The dome taking a hit
		// outranks anything already shaking the frame.
		this.host.camera.shake(
			BOMB_SHAKE,
			BOMB_SHAKE_MS,
			undefined,
			undefined,
			true,
		);
		this.host.freeze(FREEZE_BOMB_MS);
		// and the channel split, which until now only the craft's own shield
		// and the breach got. A bomb going off IS a hit on the dome, so it
		// earns the same punch: the shake moves the frame and this one
		// disturbs the image in it, and the two together read as a concussion
		// rather than as a camera wobble.
		this.host.pulseAberration();
		this.host.blast.flash(
			_at[0],
			_at[1],
			_at[2],
			BOMB_BURST_TINT,
			BOMB_FLASH_INTENSITY,
			BOMB_FLASH_RANGE,
			BOMB_FLASH_MS,
		);
		this.host.blast.shock(bomb.at, DOME_R + BOMB_CLEARANCE, BOMB_SHOCK_RADIUS);
		const pane = bomb.pane;
		this.retireBomb(bomb);
		this.host.dome.crackPane(bomb.at, pane);
	}

	/**
	 * A bomb that was.
	 * @param bomb - the one being defused
	 */
	defuse(bomb: Bomb): void {
		// clear of the shell, same as the blast it is not going to be
		onGlobe(bomb.at, DOME_R + BOMB_BURST_LIFT, PLANET_Z, _at);
		playAt(SFX.bombDefuse, _at[0], _at[1], _at[2]);
		// Cold and smaller: it still has to LAND as an event, or shooting one
		// feels like nothing happened, but it must not look like the thing
		// the player just prevented.
		this.host.blast.burst(
			_at[0],
			_at[1],
			_at[2],
			BOMB_DEFUSE_TINT,
			BOMB_DEFUSE_BURST,
			bomb.at,
			BURST_SPEED,
			BURST_LIFE,
			BOMB_BURST_AREA * 0.6,
		);
		this.host.blast.flash(
			_at[0],
			_at[1],
			_at[2],
			BOMB_DEFUSE_TINT,
			BOMB_FLASH_INTENSITY * 0.5,
			BOMB_FLASH_RANGE * 0.7,
			BOMB_FLASH_MS,
		);
		this.host.camera.shake(BOMB_DEFUSE_SHAKE, BOMB_DEFUSE_SHAKE_MS);
		// What a bomb is WORTH, not what it scored: the multiplier rides a
		// kill streak this code neither sees nor feeds, and a defuse
		// deliberately does not advance it where a kill does.
		this.host.award(_at[0], _at[1], _at[2], SCORE_PER_BOMB);
		// the HUD is event-driven, not polled: without this the score sits at
		// its old value until the next rock dies
		this.retireBomb(bomb);
	}

	/**
	 * Show or hide the saucer and its drone together.
	 *
	 * The drone is PAUSED rather than stopped: a stop discards the playback
	 * id, and that id is what `audio.position` writes through, so the next
	 * raid would arrive silent and stay that way.
	 * @param visible - whether the saucer is in the sky
	 */
	showUfo(visible: boolean): void {
		// opacity rather than a visibility flag: `isRenderable` is engine
		// internals and not in the published types, and a mesh at alpha 0 is
		// hidden outright on this path rather than merely faint
		for (const part of this.ufoParts) {
			part.setOpacity(visible ? 1 : 0);
		}
		this.ufoAudible = visible;
		this.syncDrone();
	}

	/**
	 * Silence the looping drone for a pause, or give it back.
	 *
	 * `state.pause()` reaches the current music track and nothing else, so a
	 * looping sound effect plays straight through a paused game. The engine
	 * has the same split and says so: the blur path pauses the state AND
	 * mutes, because one does not imply the other. This is that mute, for
	 * the one looping voice this game owns.
	 *
	 * Not `recall()`, which the game-over path uses for the same drone: that
	 * sends the saucer home, and a pause has to give back the raid exactly as
	 * it was.
	 * @param on - true to silence it
	 */
	setSilenced(on: boolean): void {
		this.silenced = on;
		this.syncDrone();
	}

	/**
	 * Put the drone in whatever state the two flags add up to.
	 *
	 * One place, so the orderings cannot disagree: paused while the saucer is
	 * away, shown while the game is paused, and resumed in either order all
	 * end up here.
	 */
	private syncDrone(): void {
		if (this.ufoSoundId === undefined) {
			return;
		}
		if (this.ufoAudible && !this.silenced) {
			audio.resume(UFO_SOUND, this.ufoSoundId);
		} else {
			audio.pause(UFO_SOUND, this.ufoSoundId);
		}
	}

	/**
	 * Point the saucer's ring at a new pole, without moving the saucer.
	 *
	 * The phase is re-solved from where it already is rather than carried
	 * over: dropping in a new pole and keeping the old angle teleports it to
	 * wherever that angle happens to land on the new circle.
	 * @param axis - the new pole, unit
	 * @param polar - how far from it the ring sits, radians
	 */
	aimUfoRing(axis: Vector3d, polar: number): void {
		this.ufoAxis = axis;
		// Carried forward from the frame before rather than reseeded, so the
		// frame the angle is measured in cannot jump out from under it: see
		// `ringBasisFrom`. This is what the saucer's approach teleport was.
		const basis = ringBasisFrom(axis, this.ufoRingB);
		this.ufoRingB = basis.b;
		this.ufoRingC = basis.c;
		this.ufoPolar = polar;
		const p = this.ufo.pos;
		this.ufoRing = Math.atan2(dot(p, basis.c), dot(p, basis.b));
	}

	/**
	 * Open a raid.
	 *
	 * The high ring is centred on whatever appears UP ON SCREEN, which is the
	 * craft's own heading (see `viewBasis`), so the saucer arrives over the
	 * top of the view wherever the player happens to be looking rather than
	 * at some fixed place on the globe.
	 *
	 * It starts on the far side of that ring, where the planet is between it
	 * and the camera, and rises over the limb under its own motion. Switching
	 * a renderable on in open sky is the thing this avoids.
	 */
	beginUfoRaid(): void {
		// A warning rather than a hit, and deliberately NOT placed: the saucer
		// is still over the horizon when this plays, so a sound coming from
		// where it is would be inaudible exactly when it matters.
		playRaidWarning();
		// The direction that appears UP ON SCREEN, which is the VIEW's heading
		// and not the craft's. They were the same thing when this was written
		// and the yaw decoupling separated them: `viewFrame()` is
		// `turn(ship, -yaw)`, so with the craft turned about by half a circle
		// the two point opposite ways and the warning lap rang the BOTTOM of
		// the view. Both this function's own comment and `UFO_POLAR` say
		// screen-up, so the code was the part that was wrong.
		const axis = normalize(this.host.viewHeading());
		const basis = ringBasis(axis);
		this.ufoPhase = "lap";
		this.ufoLapped = 0;
		this.ufoPolar = UFO_POLAR;
		this.ufoAxis = axis;
		this.ufoRingB = basis.b;
		this.ufoRingC = basis.c;
		// the point of the ring furthest from the player, which is the one
		// the globe is hiding
		const px = -dot(this.host.shipPos, basis.b);
		const py = -dot(this.host.shipPos, basis.c);
		this.ufoRing = Math.atan2(py, px);
		this.ufo = {
			pos: onRing(axis, basis.b, basis.c, UFO_POLAR, this.ufoRing),
			heading: ringHeading(basis.b, basis.c, this.ufoRing),
		};
		this.showUfo(true);
	}

	/**
	 * Whether the globe still leaves the saucer in view of the camera.
	 *
	 * Not "is it past some angle": the saucer flies ABOVE the surface, so the
	 * angle at which the planet hides it depends on how high it is and how far
	 * back the camera stands. The honest test is whether the line from the
	 * camera to the saucer passes through the planet, which is the point on
	 * that segment closest to the planet's centre falling inside its radius.
	 * @returns true while the camera can still see it
	 */
	ufoOnScreen(): boolean {
		// the camera stands straight out from the player, at PLANET_Z
		const c = this.host.shipPos;
		const cam = new Vector3d(c.x * PLANET_Z, c.y * PLANET_Z, c.z * PLANET_Z);
		const r = PLANET_R + UFO_ALT;
		const p = this.ufo.pos;
		// globe space, where the planet's centre IS the origin, so the camera
		// and the saucer are already relative to it
		const clear2 = sightlineClearance2(
			cam.x,
			cam.y,
			cam.z,
			p.x * r,
			p.y * r,
			p.z * r,
		);
		// a little inside the surface, so it is hidden a moment before the
		// limb rather than popping out at the exact tangent
		return clear2 > PLANET_R * PLANET_R * 1.02;
	}

	/**
	 * Carry the saucer through its raid and place its parts.
	 *
	 * A raid runs: it rises over the limb and rings the high pole once in
	 * plain sight, slides down to a tight ring about the player, drops its
	 * bombs there, then spirals back out until the globe hides it again.
	 *
	 * The ring is evaluated from an angle rather than integrated, so however
	 * long a session runs the saucer is exactly on its circle. That is the
	 * difference from `advance`, which walks a great circle step by step and
	 * has to re-orthonormalize to stop the drift compounding.
	 * @param dt - milliseconds since the last frame
	 */
	updateUfo(dt: number): void {
		if (this.ufoPhase === "away") {
			this.ufoNextMs -= dt;
			if (this.ufoNextMs <= 0) {
				this.beginUfoRaid();
			}
			return;
		}

		const step = UFO_SPEED * dt;
		this.ufoRing = wrapAngle(this.ufoRing + step);

		switch (this.ufoPhase) {
			case "lap": {
				// one full turn of the high ring before anything is dropped,
				// so a bombing run is never the first you hear of it
				this.ufoLapped += step;
				if (this.ufoLapped >= Math.PI * 2 * UFO_WARNING_LAPS) {
					// The lap was the warning the player had to be looking up
					// to catch. This is the one they cannot miss, and it goes
					// up here rather than at the drop so it is a warning
					// rather than a caption.
					this.host.warnOfRaid();
					this.ufoPhase = "transfer";
					this.ufoPhaseMs = 0;
					this.ufoAxisFrom = this.ufoAxis;
					this.ufoAxisTo = normalize(this.host.shipPos);
				}
				break;
			}
			case "transfer": {
				// the pole slides from the high one to the player's own, and
				// the saucer spirals across with it rather than jumping
				this.ufoPhaseMs += dt;
				const t = Math.min(1, this.ufoPhaseMs / UFO_TRANSFER_MS);
				// Through `aimUfoRing`, which is the whole reason that helper
				// exists: it re-derives the saucer's angle ON THE NEW BASIS
				// from where the saucer actually is. Setting the basis by hand
				// here and keeping the old angle meant the angle was being
				// read against axes that had moved under it. `ringBasis`
				// chooses its seed by `|axis.x| < 0.8`, and this slerp runs
				// from the craft's heading to its position, a quarter turn
				// apart, so it crosses that boundary routinely — and when it
				// did, `b` and `c` flipped and the saucer jumped to another
				// point on the ring. The slide is supposed to come from the
				// pole and the polar angle moving, never from the frame the
				// angle is measured in being swapped out.
				// The target is read LIVE, not snapshotted when the transfer
				// opened. It used to be, and `run` on the very next frame
				// re-aims at wherever the craft is NOW, so the ring's axis
				// jumped by however far the player had flown during the
				// slide: 0.78 rad at cruise over `UFO_TRANSFER_MS`, 2.2 rad
				// boosting. The saucer is forced onto a cone about that axis,
				// so it snapped to another point on the ring in one frame,
				// which read as a teleport right before the bombs fell.
				// Tracking it live means the slerp lands on exactly what
				// `run` is about to ask for, and the handoff is continuous.
				// The target is SNAPSHOTTED, not re-read each frame. A moving
				// end point makes the slerp's own great circle move, and when
				// the two ends drift near antipodal the path swings: measured
				// at 2.0 rad in a single frame, worse than the problem it was
				// meant to fix. The handoff into `run` is smoothed at the
				// other end instead, by `UFO_AIM_DAMP`.
				this.aimUfoRing(
					slerp(this.ufoAxisFrom, this.ufoAxisTo, t),
					math.lerp(UFO_POLAR, UFO_RUN_POLAR, t),
				);
				// and it keeps ORBITING while it slides across. `aimUfoRing`
				// re-derives the angle from where the saucer is, which throws
				// away the `step` added above, so without this the saucer
				// stopped travelling its circle for the whole transfer and
				// only drifted inward. `run` does the same thing for the same
				// reason.
				this.ufoRing = wrapAngle(this.ufoRing + step);
				if (t >= 1) {
					this.ufoPhase = "run";
					this.ufoBombsLeft = UFO_BOMBS_PER_RUN;
					this.ufoBombMs = UFO_RUN_LINGER_MS;
				}
				break;
			}
			case "run": {
				// Tight overhead, and the pole keeps tracking the player so
				// flying off does not shake the raid: it follows.
				//
				// EASED onto the craft, not snapped. The transfer ends on a
				// pole aimed where the player was 2.6 seconds ago, and this
				// used to set the live one outright on the next frame: the
				// axis moved by however far the player had flown, and the
				// saucer, forced onto a cone about it, jumped 0.79 rad in one
				// frame. That is the teleport just before the bombs drop.
				// An exponential approach on the sphere closes the same gap
				// over a few frames instead, and keeps tracking afterwards.
				this.aimUfoRing(
					slerp(
						this.ufoAxis,
						normalize(this.host.shipPos),
						1 - Math.exp(-UFO_AIM_DAMP * dt),
					),
					UFO_RUN_POLAR,
				);
				this.ufoRing = wrapAngle(this.ufoRing + step);
				if (this.ufoBombsLeft > 0) {
					this.dropBombStar();
					this.ufoBombsLeft = 0;
				}
				// then it holds a beat, so the star is laid by something still
				// overhead rather than by a ship already on its way out
				this.ufoBombMs -= dt;
				if (this.ufoBombMs <= 0) {
					this.ufoPhase = "leaving";
				}
				break;
			}
			case "leaving": {
				// STRAIGHT out, along the heading it already had, rather than
				// widening the ring: a widening ring still curves around the
				// player, so the saucer drifted outward and then switched off
				// wherever it happened to be. Holding its heading carries it
				// off one side of the view and over the limb, which is what
				// leaving looks like.
				//
				// It is hidden only once the globe is genuinely between it and
				// the camera, measured rather than assumed, so the moment it
				// stops being drawn is a moment nobody can see.
				this.ufo = advance(this.ufo, UFO_LEAVE_SPEED * dt);
				if (!this.ufoOnScreen()) {
					this.ufoPhase = "away";
					this.ufoNextMs = math.random(UFO_IDLE_MIN_MS, UFO_IDLE_MAX_MS);
					this.showUfo(false);
					return;
				}
				break;
			}
		}

		if (this.ufoPhase !== "leaving") {
			this.ufo = {
				pos: onRing(
					this.ufoAxis,
					this.ufoRingB,
					this.ufoRingC,
					this.ufoPolar,
					this.ufoRing,
				),
				heading: ringHeading(this.ufoRingB, this.ufoRingC, this.ufoRing),
			};
		}

		this.ufoSpin = wrapAngle(this.ufoSpin + UFO_SPIN * dt);
		this.ufoGlowMs = (this.ufoGlowMs + dt) % UFO_GLOW_MS;

		onGlobe(this.ufo.pos, PLANET_R + UFO_ALT, PLANET_Z, _at);
		// The Y-down bridge, undone before the orientation is built.
		//
		// `Mesh` composes its model matrix as `diag(1, -1, -1) * transform`
		// when `rightHanded`, applied on the LEFT, so whatever
		// `surfaceMatrixWorld` puts on local Y comes out reflected in Y and Z.
		// The POSITION gets no such treatment: `onGlobe` places it at `q`
		// directly. So the saucer's up and the direction it stands in only
		// agreed where `q.y` and `q.z` were near zero, and everywhere else it
		// was rolled over, inverting as it went round the ring.
		//
		// Feeding the bridge's own inverse in means the bridge undoes it:
		// `diag(1, -1, -1)` applied to `(q.x, -q.y, -q.z)` is `q` again, so
		// local Y lands on the true outward normal and the spin below turns
		// about the saucer's own vertical instead of tumbling it.
		bridgeY(this.ufo.pos, true, _bridged);
		surfaceMatrixWorld(_bridged, _mat);
		// The saucer's own blob on the glass, by the same rule as the rocks:
		// the dome point radially under it, and the outward normal there.
		// Cast from a few hundred units up rather than resting on the dome,
		// so the engine's height fade does the work and the shadow arrives
		// wide and faint, which is what says "that thing is high".
		this.host.layShadow(this.ufoParts[0], this.ufo.pos);
		for (const part of this.ufoParts) {
			part.setPosition(_at[0], _at[1], _at[2]);
			part.currentTransform.copy(_mat);
			// now a genuine spin on the spot, about the saucer's own vertical
			part.currentTransform.rotate(this.ufoSpin, AXIS_Y);
		}

		// the running lights, breathing rather than blinking: a cosine so the
		// turn at each end is gradual and nothing reads as a hard switch
		const phase = (this.ufoGlowMs / UFO_GLOW_MS) * Math.PI * 2;
		const k =
			UFO_GLOW_MIN +
			(UFO_GLOW_MAX - UFO_GLOW_MIN) * (0.5 - 0.5 * Math.cos(phase));
		for (const { mesh, base } of this.ufoGlowParts) {
			const e = mesh.emissive;
			if (e !== undefined) {
				e[0] = base[0] * k;
				e[1] = base[1] * k;
				e[2] = base[2] * k;
			}
		}
	}
	/**
	 * Send the saucer home and leave it there.
	 *
	 * One call rather than a phase write plus a hide, because the run has no
	 * business knowing the saucer has phases. It knows the fight is over.
	 */
	recall(): void {
		this.recalled = true;
		this.ufoPhase = "away";
		this.showUfo(false);
	}

	/**
	 * Set once the run is over, and never cleared: a `Raid` lives exactly as
	 * long as the run that built it.
	 *
	 * It exists because {@link Raid#recall} can be called from INSIDE this
	 * class's own tick. A bomb whose fuse runs out takes the last pane, and
	 * that path is `tickBombs` -> `detonate` -> `crackPane` -> the host's
	 * `endRun` -> `recall`, all on one stack. Control then unwound back into
	 * {@link Raid#tick}, which went straight on to `updateUfo` and undid the
	 * recall in the same frame: the saucer reappeared and its drone resumed,
	 * both of them running over the whole game-over screen. The controller's
	 * own game-over gate could not help, because the raid was already inside
	 * its tick when the run ended.
	 */
	private recalled = false;

	/**
	 * Carry the raid forward one frame.
	 *
	 * The fuses first and the saucer second, and that order is load-bearing:
	 * the saucer can drop a star this frame, and running the fuses first is
	 * what stops a bomb dropped this frame also falling this frame. One
	 * method so the order belongs here rather than to whoever calls it.
	 * @param dt - milliseconds since the last frame
	 */
	tick(dt: number): void {
		this.tickBombs(dt);
		// `tickBombs` can end the run from under us: see `recalled`. Asked
		// AFTER it rather than at the top, because the frame the run ends on
		// is exactly the one that must not fly the saucer again.
		if (this.recalled) {
			return;
		}
		this.updateUfo(dt);
	}

	/**
	 * @ignore
	 */
	destroy(): void {
		// the drone is a looping voice and not a world child, so nothing else
		// would ever stop it
		if (this.ufoSoundId !== undefined) {
			audio.stop(UFO_SOUND, this.ufoSoundId);
			this.ufoSoundId = undefined;
		}
		this.bombPool.length = 0;
		this.bombs.length = 0;
	}
}
