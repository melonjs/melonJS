/**
 * melonJS — Jungle Rabbit: the scene and the per-frame tick.
 *
 * An endless river runner: the boat holds station on screen while the course
 * is recycled past it, so the world is a handful of pooled objects rather than
 * a level that grows. `travelled` is the only thing that really moves.
 *
 * ## Which melonJS features this example leans on
 *
 * | area | API |
 * | --- | --- |
 * | 3D scene | `Camera3d`, `Mesh`, `Sprite3d`, `GLTFModel`, `Light3d` |
 * | drawing at scale | `InstancedMesh` — a whole class of scenery per draw call |
 * | collision | `Box3d` + `bodyDef` sensors, dispatched by `onCollisionStart` |
 * | effects | `ShaderEffect` (the water), `NoiseTexture2d`, `ParticleEmitter` |
 * | motion | `math.damp` camera follow, `Tween` for the hull bob |
 * | feel | `viewport.shake`, `app.freeze` for hit-stop |
 * | screen space | `Camera3d.worldToScreen` to float a "+N" over a pickup |
 * | the rest | `state`, `input`, `loader`, `audio` |
 *
 * What the game still owns by choice: the boat's motion (its body is a
 * SENSOR — the engine reports contacts, the game decides what they mean) and
 * the course layout. See `addProp` for the collision setup and `drive` for the
 * per-frame simulation.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	Box3d,
	type Camera3d,
	Color,
	collision,
	GLTFModel,
	InstancedMesh,
	input,
	Light3d,
	loader,
	Matrix3d,
	Mesh,
	math,
	type NoiseTexture2d,
	ParticleEmitter,
	type Sprite3d,
	Stage,
	state,
	Text,
	Tween,
	Vector2d,
	Vector3d,
} from "melonjs";
import {
	geometry,
	getGround,
	getPalette,
	getPuff,
	getRipples,
	getWater,
} from "./assets";
import {
	BIRD_AHEAD,
	BIRD_COUNT,
	BIRD_HEIGHT,
	BIRD_HEIGHT_SPREAD,
	BIRD_SCALE,
	BIRD_SPAN,
	BIRD_SPEED,
	BOAT_HALF,
	BOAT_SCALE,
	BOB_RISE,
	BUSH_COUNT,
	CAM_BACK,
	CAM_DAMP,
	CAM_FOV,
	CAM_PITCH,
	CAM_UP,
	CARROT_COUNT,
	CARROT_HALF,
	CARROT_SCORE,
	CLEAR_HEIGHT,
	COMBO_BLINK_MS,
	COMBO_MAX,
	COMBO_STEP,
	COMBO_WARN_MS,
	COMBO_WINDOW_MS,
	FERN_COUNT,
	FLOWER_COUNT,
	FOG_COLOR,
	FOG_FAR,
	FOG_HEIGHT_FALLOFF,
	FOG_NEAR,
	FOV_PUNCH,
	GRAVITY,
	GROUND_Y,
	HALF_W,
	HIT_STOP_MS,
	HUD_Z,
	INVULN_MS,
	JUMP_VELOCITY,
	LEAF_BOB,
	LEAF_BOB_RATE,
	LEAF_COUNT,
	LEAF_SWAY,
	LEAF_SWAY_RATE,
	LEAF_TURN,
	LOG_COUNT,
	LOG_HALF,
	LOG_SWAY_MAX,
	LOG_SWAY_MIN,
	LOG_SWAY_RATE_MAX,
	LOG_SWAY_RATE_MIN,
	LURCH_IMPULSE,
	MODEL_SCALE,
	MULT_PUNCH,
	MULT_PUNCH_MS,
	MULT_RAMP_BOTTOM,
	MULT_RAMP_TOP,
	MUSIC_VOLUME,
	PADDLE_TEMPO_GAIN,
	PADDLE_TEMPO_MIN,
	PALM_COUNT,
	PITCH_DAMP,
	PITCH_SPRING,
	POP_MS,
	POP_POOL,
	POP_RISE,
	REFLECT_SINK,
	REFLECT_SQUASH,
	REFLECT_TINT,
	RIDE_Y,
	ROCK_COUNT,
	ROCK_HALF,
	SHADOW_LIFT,
	SKY,
	SPAWN_AHEAD,
	SPAWN_BEHIND,
	SPAWN_MIN_FRACTION,
	SPEED_MAX,
	SPEED_RAMP,
	SPEED_START,
	START_LIVES,
	STEER_ACCEL,
	STEER_DRAG,
	STEER_LIMIT,
	STEER_MAX,
	SUN_AHEAD,
	TEXT_RAMP_BOTTOM,
	TEXT_RAMP_TOP,
	TILE_LEN,
	TRAIL_FOAM,
	TRAIL_LIFT,
	TRAIL_POINTS,
	TRAIL_RIVER,
	TRAIL_SORT_BIAS,
	TRAIL_SPREAD_FAR,
	TRAIL_SPREAD_NEAR,
	TRAIL_STEP,
	TRAIL_WIDTH_FAR,
	TRAIL_WIDTH_NEAR,
	TREE_SPAWN_AHEAD,
	TUMBLE_RATE,
	VIEW_W,
	WARMUP_DISTANCE,
	WATER_LEVEL,
} from "./constants";
import { menuText } from "./menuText";
import type { Geometry } from "./props";
import { PALETTE_CELLS, WHITE_CELL } from "./props";
import { bestMetres, bestScore, initRecords, submitRun } from "./records";
import { aimFlare, createSun } from "./scenery";
import {
	playCapsize,
	playHit,
	playJump,
	playPickup,
	playRiver,
	playSplash,
} from "./sfx";
import {
	createTerrainTile,
	createWaterPlane,
	scrollWaterPlane,
	valleyY,
} from "./terrain";

/**
 * The parsed descriptor for a preloaded glTF, or a loud failure.
 *
 * `loader.getGLTF` answers `null` for a name that was never preloaded, and a
 * model built from `null` fails somewhere far away from the typo that caused
 * it. Refusing here names the asset instead.
 * @param name - the name the asset was preloaded under
 */
const gltf = (name: string) => {
	const data = loader.getGLTF(name);
	if (data === null) {
		throw new Error(`jungleRabbit: glTF "${name}" was not preloaded`);
	}
	return data;
};

/**
 * A renderable that implements the modern collision hook.
 *
 * The engine deliberately does NOT declare `onCollisionStart` on the base
 * class: a stub there would make every renderable look like it implements
 * every hook, and the dispatcher decides what to fire by testing for the
 * method. So a subscriber declares the one it implements, which is what this
 * says.
 */
type CollisionAware = {
	onCollisionStart?: (response: object, other: Mesh) => void;
};

/** scratch for projecting a pickup to the screen — zero allocation per pop */
const _popAt = new Vector3d();
const _popScreen = new Vector2d();

/** scratch for projecting the sun each frame — zero allocation per frame */

/** one reused matrix for every instance placement — zero allocation per frame */
const _placement = new Matrix3d();

/** the axis the hull lists about — Z, the direction of travel */
const AXIS_Z = new Vector3d(0, 0, 1);

/** the axis a planted instance turns about — Y, so a tree spins where it stands */
const AXIS_Y = new Vector3d(0, 1, 0);

/** the axis the hull PITCHES about — X, so the bow rises and the stern drops */
const AXIS_X = new Vector3d(1, 0, 0);

/**
 * A pickup the course recycles ahead of the boat.
 *
 * Carrots stay one `Mesh` each on purpose. They are collected individually,
 * and `InstancedMesh#removeInstance` swaps the last instance into the hole —
 * so every pickup would permute the array and the bookkeeping to repair it
 * costs more than the draw call saves at this count. See the scatters below
 * for the other side of that trade.
 */
interface Prop {
	sprite: Mesh;
	kind: "carrot" | "log" | "rock";
	/**
	 * Radians per second this one turns about its own axis, and the angle it
	 * has turned so far. `rotate()` is RELATIVE, so the angle has to be tracked
	 * to feed it a delta — handing it the absolute value winds the mesh up like
	 * a spring within seconds.
	 */
	spin: number;
	angle: number;
	/**
	 * A log does not spin, it SWAYS: the current keeps turning it, so it
	 * drifts a few degrees either side of the angle it settled at. `sway` is
	 * how far, `swayRate` how fast, and `phase` is what keeps six of them from
	 * swinging in step — the giveaway that they are one animation, not six
	 * pieces of timber on the same river.
	 */
	sway: number;
	swayRate: number;
	phase: number;
	/**
	 * The heading a log settled at, which its sway swings either side of.
	 * Carries the half-turn that puts the stub branch on the other end, so a
	 * pool of six does not read as one asset repeated six times.
	 */
	baseAngle: number;
}

/**
 * Scenery drawn as one `InstancedMesh`: hundreds of copies of one geometry in
 * a single draw call.
 *
 * The game never addresses a tree individually, and a boulder only by the
 * position recorded here — which instancing does not take away. What it does
 * take away is per-object ground shadows (an instanced set gets ONE shadow
 * plane, and this floor is a parabola) and a per-object depth sort key, and
 * neither matters for opaque scenery resolved by the depth buffer.
 */
interface Scatter {
	mesh: InstancedMesh;
	/**
	 * Where each instance sits, so the game can read positions back — plus the
	 * pose it was placed with. `yaw`/`jitter` used to be rolled inline and
	 * thrown away, which is fine for scenery that never moves again; a set that
	 * is rewritten every frame has to be able to rebuild the SAME matrix, or
	 * each leaf re-rolls its rotation and size per frame and the set boils.
	 */
	items: {
		x: number;
		y: number;
		z: number;
		yaw: number;
		jitter: number;
		/** so a set does not bob and turn in unison */
		phase: number;
	}[];
	/** plants hug the banks; boulders sit in the navigable middle */
	onWall: boolean;
	/**
	 * For bank planting, the span of the bank it occupies, as a fraction of
	 * `HALF_W`. Layering these is what makes the gorge read as jungle rather
	 * than as a row of trees: ferns down at the waterline, broad leaves above
	 * them, palms overhead and furthest out.
	 */
	band: [number, number];
	/** how far down the course this set is recycled to */
	spawnAhead: number;
	/** give each instance its own yaw, so a radial model does not repeat */
	spin: boolean;
	/** rewritten every frame: turns and bobs on the current, for things afloat */
	drift: boolean;
	/**
	 * The furthest z placed on each side, `[left, right]`.
	 *
	 * Each respawn is placed relative to the LAST one rather than to the boat.
	 * A window measured from the boat cannot hold a spacing however evenly it
	 * is filled, because the window moves with the boat and the run speeds up —
	 * so arrivals scatter more and more. Measuring from a frontier makes the
	 * spacing something this code controls, and speed drops out of it.
	 */
	frontier: [number, number];
	/** target mean gap between neighbours on one side */
	spacing: number;
}

export class GameStage extends Stage {
	private app!: Application;

	// ── the cast: everything the scene draws ────────────────────────────────

	/** the boat and its rabbit — one animated rig, and the only body that moves */
	private rabbit!: GLTFModel;
	private tiles: ReturnType<typeof createTerrainTile>[] = [];
	/** the translucent river surface — one plane that travels with the boat */
	private waterPlane!: ReturnType<typeof createWaterPlane>;
	/** the one scatter that is animated per frame */
	private leaves!: Scatter;
	/** pooled "+N" labels, cycled so a fast run never allocates one mid-frame */
	private pops: { label: Text; age: number; x: number; y: number }[] = [];
	private nextPop = 0;
	/** the boat's reflection: the same rig, upside down under the surface */
	private reflection!: GLTFModel;
	/** ambient birds crossing the gorge, each flapping on its own beat */
	private birds: { model: GLTFModel; x: number; dir: number; phase: number }[] =
		[];
	/** hull pitch: sprung back to level after a hit, free-running on a capsize */
	private pitch = 0;
	private pitchVel = 0;
	private lastPitch = 0;
	/** set once the last life is gone — the boat goes over as the fade runs */
	private tumbling = false;
	/** carrots to collect and rocks to dodge — the only things with bodies */
	private props: Prop[] = [];
	/**
	 * The furthest z each KIND of prop has been placed at.
	 *
	 * Same reasoning as the scatters' frontier: a window measured from the boat
	 * cannot hold a spacing, and a long stretch with no obstacle in the lane
	 * reads as the collision being broken rather than as a gap in the course.
	 *
	 * One frontier per kind, so a run of carrot respawns cannot starve the
	 * boulders (or the reverse).
	 */
	private propFrontier: Record<Prop["kind"], number> = {
		carrot: 0,
		log: 0,
		rock: 0,
	};
	/** every instanced set, in one list — recycling and restart walk this */
	private scatters: Scatter[] = [];
	/** the river surface — a static field; the ripple motion is the UV scroll */
	private water!: NoiseTexture2d;
	private sunDisc!: Sprite3d;
	/** fired on impact and on pickup — never streamed */
	private splash!: ParticleEmitter;
	private sparkle!: ParticleEmitter;
	/** the boat's wake: two stern ribbons, rebuilt each frame from where it has been */
	private trail!: Mesh;
	private trailPath: { x: number; z: number }[] = [];
	private trailColors!: Uint32Array;
	private trailVerts!: Float32Array;
	private lastTrailZ = 0;
	private sun!: Light3d;
	private ambient!: Light3d;
	/** LIVES — rebaked only when a life is lost */
	private hudLives!: Text;
	/** CARROTS — rebaked only on a pickup */
	private hudCarrots!: Text;
	/**
	 * The multiplier, as its OWN label: one `Text` carries one `fillStyle`, so
	 * a second colour in the same line needs a second label. It also lets the
	 * two animate independently — the score ticks constantly, the multiplier
	 * changes rarely, and only the rare one is worth punching.
	 */
	private hudMultiplier!: Text;
	/** what the multiplier label is currently showing, to notice a step */
	private shownMultiplier = 1;
	/** when the current run of carrots goes stale, measured against `elapsed` */
	private comboExpires = 0;
	/** how far through the step animation, in ms; at or past the duration = idle */
	private multPunchAge = MULT_PUNCH_MS;
	/** the distance, the one line that really changes every frame */
	private hudDistance!: Text;
	/** the persisted best, top right */
	private bestLabels: Text[] = [];
	private beatRecord = false;
	private banner!: Text;

	// ── the run: the whole simulation, in a dozen numbers ───────────────────

	/** how far the course has been pulled past the boat — the only real motion */
	private travelled = 0;
	private forwardSpeed = SPEED_START;
	private steerVel = 0;
	private verticalVel = 0;
	private height = 0;
	private score = 0;
	/**
	 * Carrots taken since the last hit. The multiplier is derived from it
	 * rather than stored, so there is one number to reset and no way for the
	 * two to disagree.
	 */
	private combo = 0;
	private lives = START_LIVES;
	private invulnUntil = 0;
	private elapsed = 0;
	private over = false;
	private camTarget = new Vector3d();
	/**
	 * What the hull is doing on the water, driven by a `Tween` rather than by
	 * a sine in `update`: rise is a vertical bob, roll a slight list to one
	 * side. A boat held at a fixed height reads as a sled that happens to be
	 * on a river.
	 */
	private bob = { rise: 0, roll: 0 };
	private lastRoll = 0;
	private nextRiverSound = 0;

	onResetEvent(app: Application) {
		this.app = app;
		const world = app.world;

		// A `Stage` instance is registered once and RE-ENTERED on every switch
		// back to it, so these arrays still hold the previous run's objects —
		// whose renderables the world reset has already destroyed. Rebuilding
		// on top of them crashes on the first recycle, reaching into a sprite
		// that no longer has a position. Everything below is rebuilt from
		// scratch, so everything here must start empty.
		this.tiles = [];
		this.props = [];
		this.propFrontier = { carrot: 0, log: 0, rock: 0 };
		this.scatters = [];
		this.trailPath = [];
		this.lastTrailZ = 0;
		this.travelled = 0;
		this.forwardSpeed = SPEED_START;
		this.steerVel = 0;
		this.verticalVel = 0;
		this.height = 0;
		this.score = 0;
		this.combo = 0;
		this.comboExpires = 0;
		this.shownMultiplier = 1;
		this.multPunchAge = MULT_PUNCH_MS;
		this.lives = START_LIVES;
		this.elapsed = 0;
		this.invulnUntil = 0;
		this.over = false;
		this.pitch = 0;
		this.pitchVel = 0;
		this.lastPitch = 0;
		this.tumbling = false;
		this.beatRecord = false;
		this.lastRoll = 0;
		this.nextRiverSound = 0;

		// Depth IS the Z coordinate under a Camera3d, so the container must not
		// be allowed to overwrite it with a child index.
		world.autoDepth = false;
		app.renderer.backgroundColor.parseCSS(SKY);

		// the one texture every model in the scene samples
		const palette = getPalette();

		this.buildLighting(world);
		this.buildRiver(world);
		this.buildScenery(palette);
		this.buildBoat(world);
		this.buildEffects(world, palette);
		this.buildHud(world);
		this.setupCamera(app);
		this.bindInputAndAmbience(world);
	}

	/**
	 * The sun and the ambient fill.
	 * @param world - the world to add them to
	 */
	private buildLighting(world: Application["world"]) {
		// Y-down: a sun pointing down-and-forward lights the valley floor and
		// leaves the far wall a shade darker, which is what gives the parabola
		// its shape.
		this.sun = new Light3d({
			type: "directional",
			direction: [-0.35, 0.82, 0.45],
			color: "#fff6df",
			// diffuse and ambient SUM, so this is set against the ambient
			// below rather than on its own: together they land just under
			// the point where the water clips to flat white and takes its
			// texture, and the shading across the valley walls, with it
			intensity: 0.85,
		});
		// Green rather than blue: everything not in direct sun here is lit by
		// light bounced off the canopy. Dim enough that the lit and unlit faces
		// of the gorge still differ — a bright ambient flattens it back out.
		this.ambient = new Light3d({ type: "ambient", color: "#6f9179" });
		world.addChild(this.sun, 0);
		world.addChild(this.ambient, 0);
	}

	/**
	 * The riverbed: terrain tiles that leapfrog, and the water plane over them.
	 * @param world - the world to add them to
	 */
	private buildRiver(world: Application["world"]) {
		const ground = getGround();
		this.water = getWater();
		for (let i = 0; i < 4; i++) {
			const tile = createTerrainTile(ground);
			tile.depth = i * TILE_LEN;
			world.addChild(tile, tile.depth);
			this.tiles.push(tile);
		}
		this.waterPlane = createWaterPlane(this.water);
		// Travelling crests, as a ShaderEffect hosted on the MESH. The engine
		// splices the body into its own mesh shader, so the surface keeps its
		// placement, lighting and fog and this only colours the result.
		// `addPostEffect` with a single effect on a plain renderable takes the
		// no-FBO fast path — the effect becomes the mesh's shader for the
		// draw, which is exactly what hosting means here.
		this.waterPlane.addPostEffect(getRipples());
		world.addChild(this.waterPlane, 0);
	}

	/**
	 * Everything that decorates the course — instanced scenery, and the pooled props the boat actually collides with.
	 * @param palette - the shared model texture
	 */
	private buildScenery(palette: HTMLCanvasElement) {
		// Every prop is an authored model now, and every set is one instanced
		// draw. The bank layers overlap on purpose: a fern band that stops
		// where the leaves begin reads as three stripes, and the eye picks the
		// seams out immediately. Overlapping them reads as undergrowth.
		// Boulders in the channel. Individual renderables rather than one
		// `InstancedMesh`, because an instance is not a renderable and so
		// cannot carry a body — and these need one to reach the narrowphase.
		// At `ROCK_COUNT` that is a handful of extra draw calls against a
		// scene that already issues one per planting band.
		for (let i = 0; i < ROCK_COUNT; i++) {
			this.addProp("rock", geometry("rock"), palette, MODEL_SCALE, ROCK_HALF);
		}

		// Drifting logs: the obstacle you JUMP rather than steer around. Far
		// fewer than the boulders, and on their own frontier, so meeting one is
		// an event rather than more of the same clutter.
		for (let i = 0; i < LOG_COUNT; i++) {
			this.addProp("log", geometry("log"), palette, MODEL_SCALE, LOG_HALF);
		}

		// Ferns first, at the waterline — but no further in than that. These
		// are low and flat, so a band that reaches into the channel does not
		// read as planting at all: the parabola is nearly level down there and
		// the fronds lie on the surface like lily pads.
		this.addScatter(
			geometry("fern"),
			palette,
			MODEL_SCALE,
			FERN_COUNT,
			true,
			TREE_SPAWN_AHEAD,
			[0.55, 1.34],
			true,
		);
		// broad leaves through the middle of the bank
		this.addScatter(
			geometry("bigleaf"),
			palette,
			MODEL_SCALE,
			BUSH_COUNT,
			true,
			TREE_SPAWN_AHEAD,
			[0.68, 1.52],
			true,
		);
		// Flowers, in two colours, threaded through the same band as the
		// leaves. Nothing about the bank was any colour but green before, and
		// a jungle floor that is uniformly green reads as a texture rather
		// than as planting.
		for (const bloom of ["flower-red", "flower-pink"]) {
			this.addScatter(
				geometry(bloom),
				palette,
				MODEL_SCALE,
				FLOWER_COUNT,
				true,
				TREE_SPAWN_AHEAD,
				[0.58, 1.3],
				true,
			);
		}
		// Leaves on the water, in the channel rather than on the bank — and the
		// one set that is rewritten every frame, so they turn and ride the
		// surface instead of sitting on it like decals.
		this.leaves = this.addScatter(
			geometry("leaf"),
			palette,
			MODEL_SCALE,
			LEAF_COUNT,
			false,
			SPAWN_AHEAD,
			undefined,
			true,
			true,
		);
		// palms overhead and furthest out, leaning over the gorge
		this.addScatter(
			geometry("palm"),
			palette,
			MODEL_SCALE,
			PALM_COUNT,
			true,
			TREE_SPAWN_AHEAD,
			[0.6, 1.64],
			true,
		);
		for (let i = 0; i < CARROT_COUNT; i++) {
			this.addProp(
				"carrot",
				geometry("carrot"),
				palette,
				MODEL_SCALE,
				CARROT_HALF,
			);
		}
		// Seed the WHOLE live window — `SPAWN_BEHIND` back through `spawnAhead`
		// out — not just the stretch ahead. A fill that starts at the boat
		// leaves recycling dormant until the first instance falls behind, and
		// while it sleeps the min-spawn floor keeps moving with the boat until
		// it passes the frontier — skipping a band that nothing ever plants,
		// which rides through the near field as bare banks once per run.
		for (const scatter of this.scatters) {
			for (let i = 0; i < scatter.items.length; i++) {
				this.placeInstance(
					scatter,
					i,
					math.random(-SPAWN_BEHIND, scatter.spawnAhead),
				);
			}
		}
		for (const prop of this.props) {
			this.recycle(prop, math.random(-SPAWN_BEHIND, SPAWN_AHEAD));
		}
	}

	/**
	 * The boat, its reflection, and the hull's idle bob.
	 * @param world - the world to add them to
	 */
	private buildBoat(world: Application["world"]) {
		// An authored model rather than built geometry: the rabbit, the hull
		// and the paddle are one rig, and the paddle stroke is a clip baked
		// into the asset instead of a tween the game has to drive. Placing it
		// is ordinary renderable work — `pos`, `depth` and `rotate` move the
		// whole rig, and compose with whatever the clip is doing.
		this.rabbit = new GLTFModel(gltf("boat"), {
			scale: BOAT_SCALE,
			// unlit, like the carrots: the faces that point at the camera are
			// the ones the sun misses, so lighting the character turns its
			// ears and face into dark silhouettes. The palette already carries
			// a lit and a shaded fur tone, which is enough shape at this size.
			lit: false,
			castGroundShadow: true,
			shadowGroundY: WATER_LEVEL + SHADOW_LIFT,
		});
		// The hull's own box. A SENSOR: the engine reports the contact and the
		// game decides what it means (a life, a lurch, a hit-stop, a pickup) —
		// a push-out would fight the steering, which drives `pos` directly.
		this.rabbit.bodyDef = {
			// DYNAMIC, not kinematic: a broadphase pairs a body against the
			// world only when one side actually moves under the simulation,
			// and a kinematic hull against static props produced no contacts
			// at all. `gravityScale: 0` keeps it weightless — the game owns
			// where the boat is, and writes `pos` after the world step.
			type: "dynamic",
			gravityScale: 0,
			shapes: [
				new Box3d(
					0,
					0,
					0,
					BOAT_HALF[0] * 2,
					BOAT_HALF[1] * 2,
					BOAT_HALF[2] * 2,
				),
			],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask:
				collision.types.ENEMY_OBJECT | collision.types.COLLECTABLE_OBJECT,
			isSensor: true,
		};
		// The handler lives on the RENDERABLE that owns the body, not on the
		// stage: the dispatcher calls it on the colliding object. None of the
		// collision callbacks are declared on `Renderable` — it checks
		// `typeof`, so assigning one is how you opt in.
		//
		// `onCollisionStart` rather than the legacy `onCollision`: it is
		// receiver-symmetric (`other` is always the thing that was hit) and
		// deduped to once per pair per side per frame.
		(this.rabbit as CollisionAware).onCollisionStart = (
			_response: object,
			other: Mesh,
		) => {
			const prop = this.props.find((candidate) => {
				return candidate.sprite === other;
			});
			if (prop === undefined || this.over) {
				return;
			}
			if (prop.kind === "carrot") {
				this.eatCarrot(prop);
			} else {
				this.hitRock(prop);
			}
		};
		this.rabbit.pos.set(0, WATER_LEVEL + RIDE_Y);
		this.rabbit.setCurrentAnimation("paddle", { loop: true });
		world.addChild(this.rabbit, 0);

		// The reflection: a second instance of the same rig, turned upside
		// down and parked under the surface.
		//
		// Turned with a HALF TURN ABOUT Z rather than a negative Y scale. That
		// rotation maps (x, y, z) to (-x, -y, z) — a mirror in Y and a mirror
		// in X — and the hull is symmetric left to right, so the extra X
		// mirror is invisible and the result is the reflection you want,
		// without a negative scale flipping every face winding.
		//
		// It runs its own copy of the paddle clip, so the reflected rabbit
		// paddles in step rather than sitting frozen under a moving boat.
		this.reflection = new GLTFModel(gltf("boat"), {
			scale: BOAT_SCALE,
			lit: false,
			castGroundShadow: false,
		});
		this.reflection.rotate(Math.PI, AXIS_Z);
		// Darkened toward the water. The TINT has to be assigned onto the
		// parts: opacity cascades, but a tint colour does not — each child's
		// `preDraw` copies its own `tint` over the renderer's, so a colour set
		// on the container alone would be overwritten by every part. Assigning
		// the same colour at every level is idempotent, unlike alpha.
		//
		// The tint is what makes this read as a reflection whichever way the
		// transparent pass sorts it against the water. Sorting is per OBJECT
		// (see the 20.4.0 notes), so steering flips the order mid-turn: under
		// the river it looked like a reflection, over it like a second rabbit
		// at half opacity. Tinted down, both orderings read correctly.
		this.reflection.setChildsProperty(
			"tint",
			new Color(REFLECT_TINT[0], REFLECT_TINT[1], REFLECT_TINT[2]),
			true,
		);
		// OPAQUE, which is what keeps it looking the same frame to frame.
		//
		// The transparent pass sorts per object by the squared view-space
		// distance of each mesh's ORIGIN. The water plane's origin sits at
		// x = 0 while the reflection's follows the boat — and so does the
		// camera — so steering changed which of the two was "nearer" and
		// flipped the order. Drawn under the river it read as a reflection;
		// drawn over it, as a solid block. Opaque geometry is drawn before
		// the whole transparent pass, so the water now composites over it
		// every frame, whatever the boat is doing.
		this.reflection.setChildsProperty("transparent", false, true);
		this.reflection.setCurrentAnimation("paddle", { loop: true });
		world.addChild(this.reflection, 0);

		// yoyo + infinite repeat: one tween for the whole run, and the boat
		// never settles. The two axes share it, so the list is always in step
		// with the rise, the way a hull actually moves.
		new Tween(this.bob)
			.to({ rise: BOB_RISE, roll: 0.05 }, { duration: 1500 })
			.easing(Tween.Easing.Sinusoidal.InOut)
			.yoyo(true)
			.repeat(Number.POSITIVE_INFINITY)
			.start();
	}

	/**
	 * The sun disc, the two particle bursts, and the wake ribbon.
	 * @param world - the world to add them to
	 * @param palette - the shared model texture
	 */
	private buildEffects(
		world: Application["world"],
		palette: HTMLCanvasElement,
	) {
		const puff = getPuff();
		// The sun and its flare, built by the same helper the menu screens use so
		// the run and the title share one sky rather than two that drift apart.
		this.sunDisc = createSun(world).sunDisc;

		// No hull spray. It streamed a soft radial puff off the bow, which at
		// this camera distance resolved into a white ball sitting behind the
		// rabbit rather than into spray. The wake ribbons say the hull is in
		// the water, and they say it in the shape water actually takes.

		// Two emitters that never stream: they are fired with
		// `burstParticles` at the moment of an impact or a pickup, and sit
		// idle otherwise. `referenceSpace: "world"` leaves each particle where
		// it was born, so a splash stays on the water the boat has already
		// left rather than travelling along with it.
		this.splash = new ParticleEmitter(0, WATER_LEVEL, {
			image: puff,
			referenceSpace: "world",
			totalParticles: 60,
			maxParticles: 24,
			minLife: 320,
			maxLife: 620,
			speed: 0.45,
			speedVariation: 0.3,
			angle: Math.PI / 2,
			angleVariation: Math.PI,
			minStartScale: 0.8,
			maxStartScale: 1.8,
			minEndScale: 0,
			maxEndScale: 0.4,
			tint: "#e8fbff",
		});
		world.addChild(this.splash, 0);

		this.sparkle = new ParticleEmitter(0, WATER_LEVEL, {
			image: puff,
			referenceSpace: "world",
			totalParticles: 40,
			maxParticles: 16,
			minLife: 260,
			maxLife: 500,
			speed: 0.3,
			speedVariation: 0.2,
			angle: Math.PI / 2,
			angleVariation: Math.PI,
			minStartScale: 0.5,
			maxStartScale: 1.1,
			minEndScale: 0,
			maxEndScale: 0.2,
			tint: "#ffd447",
		});
		world.addChild(this.sparkle, 0);

		// Two ribbons off the stern corners rather than one down the middle:
		// that is what a hull does — it pushes water out to either side and
		// the disturbance spreads behind it as a V. A single centre trail
		// reads as exhaust.
		//
		// Both strips live in ONE mesh, so it is one draw and the pair can
		// never disagree about where the boat has been. Kept SHORT on purpose:
		// a long ribbon mostly lives behind the camera (which trails
		// `CAM_BACK` back), and what remains in front has to win a per-object
		// sort against the translucent water it lies on.
		//
		// The fade is per-vertex colour, not per-object alpha: the near end
		// has to be strong and the tail gone, and `alpha` is one number for
		// the whole mesh.
		const rungs = TRAIL_POINTS * 2;
		const strip = rungs * 2;
		const trailVerts = new Float32Array(strip * 3);
		const trailUVs = new Float32Array(strip * 2);
		const trailIndices = new Uint16Array(TRAIL_POINTS * 2 * 6);
		const trailColors = new Uint32Array(strip);
		let quad = 0;
		for (let r = 0; r < rungs; r++) {
			for (let k = 0; k < 2; k++) {
				// both vertices sample the palette's white cell — the colour
				// comes from the vertex tint, not from the texture
				trailUVs[(r * 2 + k) * 2] = (WHITE_CELL + 0.5) / PALETTE_CELLS;
				trailUVs[(r * 2 + k) * 2 + 1] = 0.5;
			}
			// no quad spanning the seam between the two ribbons
			if (r % TRAIL_POINTS === TRAIL_POINTS - 1) {
				continue;
			}
			const a = r * 2;
			trailIndices[quad] = a;
			trailIndices[quad + 1] = a + 1;
			trailIndices[quad + 2] = a + 2;
			trailIndices[quad + 3] = a + 1;
			trailIndices[quad + 4] = a + 3;
			trailIndices[quad + 5] = a + 2;
			quad += 6;
		}
		this.trail = new Mesh(0, WATER_LEVEL, {
			vertices: trailVerts,
			uvs: trailUVs,
			indices: trailIndices,
			texture: palette,
			vertexColors: trailColors,
			normalize: false,
			scale: 1,
			width: 240,
			height: 200,
			textureFilter: "nearest",
			cullBackFaces: false,
			lit: false,
			castGroundShadow: false,
			// OPAQUE, and the translucency is faked by the colour ramp below —
			// see `TRAIL_FOAM`. In the transparent pass this loses its sort
			// against the water plane it lies on and disappears under it.
			transparent: false,
		});
		world.addChild(this.trail, 0);
		this.trailColors = this.trail.vertexColors as Uint32Array;
		// `originalVertices` is the MODEL-space source: it is what the bounds
		// are computed from and what the retained path uploads. `vertices` is
		// the working copy a draw leaves behind, so writing there moves
		// nothing and the camera culls the ribbon on its stale bounds.
		this.trailVerts = this.trail.originalVertices;
		this.trailPath = [];
		this.lastTrailZ = 0;
	}

	/**
	 * The three HUD labels.
	 * @param world - the world to add them to
	 */
	private buildHud(world: Application["world"]) {
		// The ramp each HUD label fills with — a `Gradient` handed to `fillStyle`,
		// which colours the fill and leaves the outline alone.
		//
		// One line box: `Text` re-anchors a gradient to each line by default, so
		// every line of a multi-line label gets the same ramp.
		const ramp = (size: number) => {
			const g = this.app.renderer.createLinearGradient(0, 0, 0, size * 1.45);
			g.addColorStop(0, TEXT_RAMP_TOP);
			g.addColorStop(1, TEXT_RAMP_BOTTOM);
			return g;
		};
		// `Text` already anchors at (0, 0) — passing textAlign/textBaseline on
		// top of that fights the default rather than helping
		// sized for the 480×270 internal buffer, not for the window it is
		// blown up into — a 26px face here would fill a third of the screen
		// One label PER ENTRY, not one multi-line label. Each then carries its
		// own ramp without the gradient having to span a block, and — the part
		// that actually matters in a run — only the line whose value changed is
		// re-baked. `setText` re-measures, re-rasterizes the offscreen canvas
		// and invalidates the GPU texture on every call, so a distance counter
		// ticking every frame used to drag LIVES and CARROTS through all of
		// that with it.
		const line = (index: number, align: "left" | "right" = "left") => {
			const label = new Text(align === "left" ? 10 : VIEW_W - 10, 0, {
				// the preloaded face, by the name it was registered under
				font: "Crang",
				size: align === "left" ? 15 : 13,
				// Crang is a chunky display face and its glyphs fill the em box,
				// so consecutive lines collide at the default 1.0
				lineHeight: 1.45,
				fillStyle: ramp(align === "left" ? 15 : 13),
				// The outline. `lineWidth` is what switches stroking on at all —
				// a strokeStyle with zero width draws nothing — but keep it THIN:
				// the stroke is drawn ON TOP of the fill and centred on the glyph
				// outline, so half of it eats inward. At 3 on a 15px face the
				// letters came out solid black.
				strokeStyle: "#000000",
				lineWidth: 1,
				textAlign: align,
				text: "",
			});
			const size = align === "left" ? 15 : 13;
			label.pos.y = (align === "left" ? 8 : 7) + index * size * 1.45;
			// `floating` exempts it from the perspective projection, but NOT
			// from the depth sort — z still means distance. A HUD wants to be
			// NEAR the camera to draw last; parked at a large z it sorts to the
			// far end of the valley and the trees draw over the score.
			label.floating = true;
			world.addChild(label, HUD_Z);
			return label;
		};

		this.hudLives = line(0);
		this.hudCarrots = line(1);
		this.hudDistance = line(2);

		// Same row as the carrots, its own hotter ramp. Positioned in
		// `refreshCounters` from the carrots line's measured width, because
		// where it belongs depends on how many digits the score has.
		const hot = this.app.renderer.createLinearGradient(0, 0, 0, 15 * 1.45);
		hot.addColorStop(0, MULT_RAMP_TOP);
		hot.addColorStop(1, MULT_RAMP_BOTTOM);
		this.hudMultiplier = new Text(10, 8 + 15 * 1.45, {
			font: "Crang",
			size: 15,
			lineHeight: 1.45,
			fillStyle: hot,
			strokeStyle: "#000000",
			lineWidth: 1,
			textAlign: "left",
			text: "",
		});
		this.hudMultiplier.floating = true;
		world.addChild(this.hudMultiplier, HUD_Z);

		// the record, opposite the live score so the two read as a pair
		initRecords();
		this.bestLabels = [line(0, "right"), line(1, "right"), line(2, "right")];
		// The persisted record does not move during a run, so it is written
		// once here rather than re-set every frame.
		this.bestLabels[0].setText("BEST");
		this.bestLabels[1].setText(`${bestScore()}`);
		this.bestLabels[2].setText(`${bestMetres()}M`);

		this.banner = new Text(VIEW_W / 2, 105, {
			font: "Crang",
			size: 20,
			lineHeight: 1.45,
			fillStyle: ramp(20),
			strokeStyle: "#000000",
			// 1, not 1.5. Text metrics size the box from the line height alone
			// and make no allowance for the stroke, and `textBaseline: "top"`
			// puts the first line's ascenders at y = 0 — so the outer half of a
			// thick stroke overflows the top of the box and is clipped away.
			lineWidth: 1,
			textAlign: "center",
			text: "",
		});
		this.banner.floating = true;
		world.addChild(this.banner, HUD_Z);
	}

	/**
	 * Point the `Camera3d` down the river and frame the boat.
	 * @param app - the running application
	 */
	private setupCamera(app: Application) {
		const camera = app.viewport as Camera3d;
		camera.setClipPlanes?.(1, 9000);
		// Distance fog. The colour is omitted on purpose: it tracks
		// `renderer.backgroundColor`, which is already the sky, so the valley
		// dissolves into the horizon and props arrive without a hard edge.
		camera.setFog?.({
			near: FOG_NEAR,
			far: FOG_FAR,
			// A humid green rather than the sky's blue. Left to default the
			// haze tracks `backgroundColor`, which washes the far gorge to the
			// same pale tone as the sky and loses the horizon altogether.
			color: FOG_COLOR,
			// Mist pools in the run rather than hanging at every altitude
			// equally: density falls off above the river, so the canopy stays
			// crisp while the bottom of the gorge fills in.
			// Y-down, so `fogHeight` is the floor and density rises below it.
			fogHeight: WATER_LEVEL,
			heightFalloff: FOG_HEIGHT_FALLOFF,
		});
		// A light grade — one line, and the frame stops reading as a default
		// render. A vignette was tried alongside it and dropped: the gorge
		// already frames the shot, and darkening the corners buried the HUD.
		camera.colorMatrix.contrast(1.06).saturate(1.14);
		camera.fov = CAM_FOV;
		camera.pitch = CAM_PITCH;
		this.camTarget.set(0, WATER_LEVEL + RIDE_Y + CAM_UP, CAM_BACK);
		camera.pos.set(this.camTarget.x, this.camTarget.y);
		camera.depth = this.camTarget.z;
	}

	/**
	 * Key bindings, the pooled "+N" labels, the birds, and the music.
	 * @param world - the world to add them to
	 */
	private bindInputAndAmbience(world: Application["world"]) {
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.SPACE, "jump", true);

		// A pooled set of "+N" labels. Pooled rather than created on pickup:
		// a `Text` rasterizes its glyphs on construction, and doing that in
		// the middle of a run is a visible hitch for the sake of two
		// characters. Six is more than a fast run ever has in the air at once.
		this.pops = [];
		this.nextPop = 0;
		for (let i = 0; i < POP_POOL; i++) {
			const label = menuText(0, 0, 13, "");
			label.alpha = 0;
			world.addChild(label, HUD_Z);
			// `age` past POP_MS means "retired" — nothing to draw and nothing
			// to advance
			this.pops.push({ label, age: POP_MS, x: 0, y: 0 });
		}

		// Birds crossing the gorge. The upper half of the frame is sky and
		// canopy and nothing else moves in it; a few silhouettes drifting
		// across give the shot a scale it does not otherwise have.
		//
		// `GLTFModel` rather than one `InstancedMesh`: an instanced set shares
		// one geometry, so every copy would beat its wings in lockstep — and a
		// flock flapping in perfect unison reads as a machine. Each bird runs
		// its own clip at its own rate instead. Seven rigs of three parts is
		// the price of that, and it buys the one thing the sky was missing.
		this.birds = [];
		for (let i = 0; i < BIRD_COUNT; i++) {
			const model = new GLTFModel(gltf("bird"), {
				scale: BIRD_SCALE,
				// silhouettes against the sky: lighting them would tint them
				// with the scene's green bounce and lose the read
				lit: false,
				castGroundShadow: false,
			});
			const dir = i % 2 === 0 ? 1 : -1;
			// authored nose-forward (+Z after the axis bridge), so one flying
			// the other way is turned about once, here
			model.rotate(dir > 0 ? -Math.PI / 2 : Math.PI / 2, AXIS_Y);
			model.setCurrentAnimation("flap", { loop: true });
			// each on its own beat, so the flock never flaps in unison
			model.animationspeed = math.randomFloat(0.8, 1.35);
			world.addChild(model, 0);
			this.birds.push({
				model,
				x: math.randomFloat(-BIRD_SPAN, BIRD_SPAN),
				dir,
				phase: math.randomFloat(0, Math.PI * 2),
			});
		}

		// seed the counters; from here they are written by the events
		this.refreshCounters();
		this.refreshHud();

		// The track belongs to the run, not the session: it starts here and is
		// cut on the capsize, so the menus stay quiet and every run opens on
		// the same bar. Browsers hold audio until a user gesture — the SPACE
		// that got us here is one.
		audio.playTrack("jungle-theme", MUSIC_VOLUME);
	}

	// ── the endless course: placing, spacing and recycling ─────────────────
	//
	// Nothing is created or destroyed during a run. A fixed pool of props and
	// instanced scenery is moved back out in front of the boat once it falls
	// behind, so the course is endless at a constant object count.

	/**
	 * One `InstancedMesh` for a whole class of scenery — every tree in one
	 * draw call, every boulder in another.
	 * @param geometry - the shape every instance shares
	 * @param palette - the shared texture
	 * @param scale - model-to-world scale for the group
	 * @param count - how many instances to place
	 * @param onWall - true to scatter up the banks, false for the river bed
	 * @param spawnAhead - how far down the course this set is recycled to
	 * @param band - for bank planting, the span of bank it occupies
	 * @param spin - turn each instance to its own random heading
	 */
	private addScatter(
		geometry: Geometry,
		palette: HTMLCanvasElement,
		scale: number,
		count: number,
		onWall: boolean,
		spawnAhead: number,
		band: [number, number] = [0.58, 1.05],
		spin = false,
		drift = false,
	): Scatter {
		const mesh = new InstancedMesh(0, GROUND_Y, {
			...geometry,
			texture: palette,
			normalize: false,
			scale,
			width: 120,
			height: 200,
			textureFilter: "nearest",
			cullBackFaces: false,
			lit: true,
			instanceCount: count,
			// An instanced set gets ONE ground-shadow plane for all of it, and
			// this floor is a parabola — every instance would cast onto the
			// same height and the blobs would slide off the slope. The carrots
			// and the boat still cast, being ordinary meshes.
			castGroundShadow: false,
		});
		this.app.world.addChild(mesh, 0);
		const items = [];
		for (let i = 0; i < count; i++) {
			items.push({ x: 0, y: GROUND_Y, z: 0, yaw: 0, jitter: 1, phase: 0 });
		}
		// Instances live from `SPAWN_BEHIND` behind the boat out to `spawnAhead`,
		// and each side carries half of them — so this is the gap the set can
		// actually sustain. Placing closer than this would run the set out of
		// instances before the far end; further apart leaves holes.
		const live = spawnAhead + SPAWN_BEHIND;
		const scatter: Scatter = {
			mesh,
			items,
			onWall,
			spawnAhead,
			band,
			frontier: [0, 0],
			// Per FRONTIER, not per set: a frontier is kept per x-sign, so each
			// carries half the instances. Dividing by the full count advances
			// each frontier at half the boat's speed, which lets the min-spawn
			// floor become the placement rule again — the very model the
			// frontier exists to replace — and a bare stretch then repeats
			// forever at a fixed period.
			spacing: live / Math.max(1, count / 2),
			spin,
			drift,
		};
		this.scatters.push(scatter);
		return scatter;
	}

	/**
	 * Write one instance's transform from its stored pose.
	 *
	 * An instance transform is applied in the GROUP's local space, and the
	 * group's model matrix is `diag(s, -s, s)` — the mesh scale with the Y-axis
	 * bridge folded in. So a world position has to be divided back through it
	 * and its Y negated. Left in world units, every instance lands `scale` times
	 * too far away: mispositioned, and fogged as if it were past the far plane.
	 *
	 * Rotating AFTER the translate turns the instance about its own trunk
	 * rather than swinging it around the group origin.
	 * @param scatter - the set being written
	 * @param index - which instance
	 * @param turn - extra yaw, for a set that drifts
	 * @param sway - extra world-X offset, ditto
	 * @param bob - extra world-Y offset, ditto
	 */
	private writeInstance(
		scatter: Scatter,
		index: number,
		turn = 0,
		sway = 0,
		bob = 0,
	) {
		const item = scatter.items[index];
		const s = scatter.mesh.meshScale;
		_placement
			.identity()
			.translate((item.x + sway) / s, -(item.y + bob) / s, item.z / s);
		if (scatter.spin) {
			_placement.rotate(item.yaw + turn, AXIS_Y);
			_placement.scale(item.jitter, item.jitter, item.jitter);
		} else if (turn !== 0) {
			_placement.rotate(turn, AXIS_Y);
		}
		scatter.mesh.setInstance(index, _placement);
	}

	/**
	 * Where the next prop of this kind goes, spread rather than random.
	 *
	 * Measured from the KIND's own frontier rather than from the boat, so the
	 * spacing is what this code controls and the run's speed drops out of it.
	 * @param kind - carrot or rock
	 * @returns a distance ahead of the boat
	 */
	private nextPropDistance(kind: Prop["kind"]) {
		const count =
			kind === "rock" ? ROCK_COUNT : kind === "log" ? LOG_COUNT : CARROT_COUNT;
		// the stretch the pool has to cover, so this is the gap it can sustain
		const spacing = (SPAWN_AHEAD + SPAWN_BEHIND) / Math.max(1, count);
		// jittered, or the course reads as a slalom gate
		const step = spacing * math.randomFloat(0.55, 1.45);
		const z = Math.max(
			this.propFrontier[kind] + step,
			// never inside the haze — anything closer pops in visibly
			this.travelled + SPAWN_AHEAD * SPAWN_MIN_FRACTION,
		);
		this.propFrontier[kind] = z;
		return z - this.travelled;
	}

	private nextSpawnDistance(scatter: Scatter) {
		// Serve whichever side has fallen furthest behind. Choosing at random
		// lets one bank starve for a stretch purely by chance, which is the
		// other half of how a bald patch forms.
		const i = scatter.frontier[0] <= scatter.frontier[1] ? 0 : 1;
		// Jittered, or the bank reads as a picket fence. The frontier advances
		// by the mean either way, so the jitter costs no density.
		const step = scatter.spacing * math.randomFloat(0.55, 1.45);
		// Never inside the haze: an instance that appears in clear sight reads
		// as a pop-in however well spaced it is.
		const z = Math.max(
			scatter.frontier[i] + step,
			this.travelled + scatter.spawnAhead * SPAWN_MIN_FRACTION,
		);
		scatter.frontier[i] = z;
		this.spawnSide = i === 0 ? -1 : 1;
		return z - this.travelled;
	}

	/** which bank `nextSpawnDistance` just chose; read by `placeInstance` */
	private spawnSide: -1 | 1 = -1;

	/**
	 * Move one instance to a fresh spot ahead of the boat.
	 *
	 * The position is recorded in `items` as well as written to the instance
	 * buffer: the game reads positions back for collision, and an instance
	 * buffer is write-only as far as the CPU is concerned.
	 * @param scatter - the set to place into
	 * @param index - which instance
	 * @param aheadOfSkier - how far down the course to put it
	 */
	private placeInstance(
		scatter: Scatter,
		index: number,
		aheadOfSkier: number,
		side?: -1 | 1,
	) {
		// Bank planting fills its whole band from the start. Obstacles in the
		// channel are BIASED outward early on rather than excluded from the
		// middle: a hard clear lane read as two tidy rows down the banks,
		// which looks authored rather than natural. Raising a uniform sample
		// to a power below one crowds it toward the edge while still letting
		// the occasional rock sit mid-river, and the exponent walks back to 1
		// — a plain uniform spread — as the run goes on.
		const warmup = Math.min(1, this.travelled / WARMUP_DISTANCE);
		const bias = 0.3 + 0.7 * warmup;
		const dir = side ?? (Math.random() < 0.5 ? -1 : 1);
		const x = scatter.onWall
			? math.randomFloat(HALF_W * scatter.band[0], HALF_W * scatter.band[1]) *
				dir
			: STEER_LIMIT * Math.random() ** bias * dir;
		const item = scatter.items[index];
		item.x = x;
		// bank planting stands on the bed; anything in the channel floats at
		// the surface, which is a flat height rather than the parabola
		item.y = scatter.onWall ? GROUND_Y + valleyY(x) : WATER_LEVEL;
		item.z = this.travelled + aheadOfSkier;
		// Keep the frontier honest even on the initial fill, or the first
		// respawns measure from zero and pile up at the near edge.
		const f = dir < 0 ? 0 : 1;
		if (item.z > scatter.frontier[f]) {
			scatter.frontier[f] = item.z;
		}
		// One geometry stamped out hundreds of times reads as one tree copied
		// hundreds of times unless each copy faces its own way. The pose is
		// STORED rather than applied and forgotten, so a drifting set can
		// rebuild the same matrix every frame with only the current added.
		if (scatter.spin) {
			item.yaw = math.randomFloat(0, Math.PI * 2);
			item.jitter = math.randomFloat(0.82, 1.18);
		}
		item.phase = math.randomFloat(0, Math.PI * 2);
		this.writeInstance(scatter, index);
	}

	/**
	 * Build one pooled prop — a carrot to collect or a rock to dodge.
	 *
	 * Both carry a `Box3d` body, which is what puts them in the engine's 3D
	 * narrowphase: `Box3d`-vs-`Box3d` is the only contact that resolves in
	 * three dimensions, and it is what a course of obstacles laid out in XZ
	 * under a `Camera3d` wants. The alternative — a hand-rolled distance
	 * check — throws away the penetration the response already carries and
	 * has to be kept in step with the art by hand.
	 *
	 * Declared as `bodyDef` rather than `new Body(...)`: the engine hands it
	 * to whichever adapter is active when the renderable is added, so the
	 * example is not pinned to the built-in world.
	 *
	 * Sensors, both of them. A rock costs a life and a carrot is eaten —
	 * neither should shove the hull, and the game's own response (the lurch,
	 * the hit-stop, the speed rewind) is the interesting part.
	 * @param kind - what this prop is
	 * @param geometry - the shape it draws
	 * @param palette - the shared texture
	 * @param scale - model-to-world scale
	 * @param half - half-extents for its collision box, in world units
	 */
	private addProp(
		kind: Prop["kind"],
		geometry: Geometry,
		palette: HTMLCanvasElement,
		scale: number,
		half: [number, number, number],
	) {
		const sprite = new Mesh(0, GROUND_Y, {
			...geometry,
			texture: palette,
			normalize: false,
			scale,
			width: 120,
			height: 200,
			textureFilter: "nearest",
			cullBackFaces: false,
			// A carrot's sides slope outward as they rise, so their normals
			// tip AWAY from a sun that shines down and the whole pickup reads
			// as a dark brown lump. Pickups want to pop anyway — leave them
			// fullbright rather than lighting them badly. A rock is a broad
			// flat boulder and lights correctly.
			lit: kind !== "carrot",
			castGroundShadow: true,
			shadowGroundY: WATER_LEVEL + SHADOW_LIFT,
			// The engine default (0.45), for both kinds. A carrot used to be
			// darkened to 0.78 here because its shadow was barely there — but
			// that was the renderer replaying the river plane over the top of
			// it, not the opacity being wrong. With the transparent pass
			// sorting on geometry rather than origin the shadow composites as
			// authored, and 0.78 reads as a painted-on hole rather than as
			// something cast on moving water.
		});
		sprite.bodyDef = {
			type: "static",
			shapes: [new Box3d(0, 0, 0, half[0] * 2, half[1] * 2, half[2] * 2)],
			collisionType:
				kind === "rock"
					? collision.types.ENEMY_OBJECT
					: collision.types.COLLECTABLE_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};
		this.app.world.addChild(sprite, 0);
		// Mixed directions and rates: a field of props all turning together
		// reads as one mechanism rather than as scattered objects. Rocks sit
		// still — a tumbling boulder reads as debris, not as an obstacle.
		const spin =
			kind === "carrot"
				? math.randomFloat(1.1, 2.2) * (Math.random() < 0.5 ? -1 : 1)
				: 0;
		this.props.push({
			sprite,
			kind,
			spin,
			angle: 0,
			sway: 0,
			swayRate: 0,
			phase: 0,
			baseAngle: 0,
		});
	}

	/** move a carrot to a fresh spot ahead of the boat */
	private recycle(prop: Prop, aheadOfSkier: number) {
		const { sprite } = prop;
		// Carrots drift in the navigable middle, where the boat can reach
		// them. Boulders are BIASED OUTWARD rather than excluded from the
		// middle: a hard clear lane reads as two tidy rows down the banks,
		// which looks authored rather than natural. Raising a uniform sample
		// to a power below one crowds it toward the edge while still letting
		// the occasional rock sit mid-river, and the exponent walks back to 1
		// — a plain uniform spread — as the run goes on.
		let x: number;
		if (prop.kind === "rock") {
			const warmup = Math.min(1, this.travelled / WARMUP_DISTANCE);
			const bias = 0.3 + 0.7 * warmup;
			const dir = Math.random() < 0.5 ? -1 : 1;
			x = dir * STEER_LIMIT * Math.random() ** bias;
		} else {
			x = math.randomFloat(-STEER_LIMIT, STEER_LIMIT);
		}

		sprite.pos.x = x;
		sprite.pos.y = WATER_LEVEL;
		// Render space is Y-DOWN, so the floor an object stands on is a GREATER
		// y than the object: the shadow plane is `pos.y + LIFT`, never minus.
		sprite.shadowGroundY = sprite.pos.y + SHADOW_LIFT;
		sprite.depth = this.travelled + aheadOfSkier;
		// keep the frontier honest even on the initial fill, or the first
		// respawns measure from zero and pile up at the near edge
		if (sprite.depth > this.propFrontier[prop.kind]) {
			this.propFrontier[prop.kind] = sprite.depth;
		}
		// a fresh spin each time, so the same mesh does not come back at the
		// same rate in the same phase. Rocks stay still — a tumbling boulder
		// reads as debris rather than as something to steer around.
		prop.spin =
			prop.kind === "carrot"
				? math.randomFloat(1.1, 2.2) * (Math.random() < 0.5 ? -1 : 1)
				: 0;

		// A log is modelled lying along X, which is across the current — the
		// orientation that makes it something to jump. Nudged off square by a
		// little each time, because six identical bars laid perpendicular read
		// as hurdles someone placed rather than timber the river brought down.
		if (prop.kind === "log") {
			// It is not anchored — the current keeps working on it, so it
			// swings a few degrees either side of square rather than holding
			// one heading. A fresh amplitude, rate and phase each time it comes
			// round, so the same six never fall into step with each other.
			prop.sway = math.randomFloat(LOG_SWAY_MIN, LOG_SWAY_MAX);
			prop.swayRate = math.randomFloat(LOG_SWAY_RATE_MIN, LOG_SWAY_RATE_MAX);
			prop.phase = math.randomFloat(0, Math.PI * 2);
			// Off square by a little, and half of them turned end for end. A
			// HALF TURN rather than a mirrored scale: the log is symmetric
			// apart from its stub, so a rotation puts the branch on the other
			// side without inverting the winding or the normals with it.
			prop.baseAngle =
				math.randomFloat(-0.42, 0.42) + (Math.random() < 0.5 ? 0 : Math.PI);
		}
	}

	// ── the per-frame tick ─────────────────────────────────────────────────

	/**
	 * One frame: simulate, then place everything that follows from it.
	 *
	 * The order matters. `drive` advances `travelled` and the boat, and every
	 * scroll, respawn and camera move below reads it — so the simulation runs
	 * first and the scene is placed from the result, never the other way round.
	 *
	 * A `Stage`'s own `update` is NOT gated by the pause (only `Container`
	 * checks it, for its children), which is why this returns early on a paused
	 * state rather than relying on the engine to skip it.
	 * @param dt - milliseconds since the last frame
	 * @returns true, so the stage is always considered dirty
	 */
	update(dt: number) {
		super.update(dt);

		// A Stage's own `update` is NOT gated by the pause, unlike its world's
		// children: `Application.update` calls `world.update()` and
		// `state.current().update()` unconditionally, and only `Container`
		// checks `state.isPaused()` (skipping children without
		// `updateWhenPaused`). A game that keeps its simulation in entities
		// therefore pauses for free — this one keeps it here, so without this
		// guard the run carried on through a lost window: `travelled` and the
		// camera advanced while every world child was frozen, which left the
		// boat standing still in world space and scrolling off the screen.
		if (state.isPaused()) {
			return true;
		}

		const seconds = dt / 1000;
		this.elapsed += dt;
		// one clock for every animated set in the frame — the birds, the
		// leaves and the ripple effect all read the same value
		const t = this.elapsed / 1000;

		// The surface is a fixed plane the boat travels over, so its movement
		// is parallax against the banks rather than anything animating in the
		// texture. The field itself is deliberately static — see the dead ends
		// recorded on `makeWater`.
		scrollWaterPlane(this.waterPlane, this.travelled);

		// The river, retriggered as a bed. Overlapping attacks and decays make
		// a continuous wash out of short bursts, which needs no looping source
		// and no asset.
		if (this.elapsed > this.nextRiverSound && !this.over) {
			this.nextRiverSound = this.elapsed + 700;
			playRiver();
		}

		// The sun is scenery, not a prop: parked at a fixed depth it is left
		// behind within seconds. Kept far up the gorge so it sits on the
		// horizon and never arrives.
		this.sunDisc.depth = this.travelled + SUN_AHEAD;

		if (!this.over) {
			this.drive(seconds, t);
		}

		// Hull pitch. A spring while the boat is alive — the kick from a rock
		// decays back to level — and a free run once it has capsized.
		if (this.tumbling) {
			this.pitch += TUMBLE_RATE * seconds;
		} else {
			this.pitchVel -= PITCH_SPRING * this.pitch * seconds;
			this.pitchVel -= this.pitchVel * Math.min(1, PITCH_DAMP * seconds);
			this.pitch += this.pitchVel * seconds;
		}
		// relative, like the roll above it: `rotate` takes a delta, and an
		// absolute angle would wind the hull up a turn per frame
		this.rabbit.rotate(this.pitch - this.lastPitch, AXIS_X);
		this.lastPitch = this.pitch;

		// Birds drift across and wrap round when they leave the gorge. Their
		// depth rides with the run, so they never fall behind it.
		for (const bird of this.birds) {
			bird.x += bird.dir * BIRD_SPEED * seconds;
			if (bird.x > BIRD_SPAN) {
				bird.x = -BIRD_SPAN;
			} else if (bird.x < -BIRD_SPAN) {
				bird.x = BIRD_SPAN;
			}
			bird.model.pos.x = bird.x;
			// Y-down: subtracting lifts it. Each holds its own altitude and
			// rides a slow sine on top, so the flock never flies as a rigid
			// formation.
			bird.model.pos.y =
				WATER_LEVEL -
				BIRD_HEIGHT -
				((bird.phase / (Math.PI * 2)) * BIRD_HEIGHT_SPREAD +
					Math.sin(t + bird.phase) * 18);
			// near enough to read as birds rather than as specks, far enough
			// that they never cross in front of the boat
			bird.model.depth = this.travelled + BIRD_AHEAD;
		}

		this.updatePops(dt);

		// A combo has to be KEPT UP, not merely not-lost: stop taking carrots
		// and it goes stale on its own, so dodging everything for a minute does
		// not park the multiplier at its ceiling for free.
		if (this.combo > 0 && this.elapsed > this.comboExpires) {
			this.combo = 0;
			this.refreshCounters();
		}

		// Running out: blink, faster the closer it gets. A blink cannot say HOW
		// long is left the way a draining bar does, so the acceleration is what
		// carries that — steady means "soon", frantic means "now".
		const nearlyGone =
			this.combo > 0 && this.comboExpires - this.elapsed < COMBO_WARN_MS;
		this.hudMultiplier.alpha =
			nearlyGone && Math.floor(this.elapsed / COMBO_BLINK_MS) % 2 === 1
				? 0.15
				: 1;

		// The step itself: a scale that starts big and settles back. Only this
		// label gets one — the score and the distance tick every frame, and
		// animating those would be noise rather than emphasis.
		if (this.multPunchAge < MULT_PUNCH_MS) {
			this.multPunchAge += dt;
			const k = Math.min(1, this.multPunchAge / MULT_PUNCH_MS);
			// out-quadratic, so most of the shrink happens at once and it reads
			// as a snap rather than a slow deflate
			const punch = 1 + MULT_PUNCH * (1 - k) * (1 - k);
			// `preDraw` pivots a renderable's transform around its own `pos`,
			// so this grows out of where the label already is
			this.hudMultiplier.currentTransform.identity();
			this.hudMultiplier.currentTransform.scale(punch, punch);
		}

		this.followCamera(seconds);
		// Pickups turn on the spot — a carrot that just slides toward you reads
		// as scenery, and the turn is what marks it as something to collect.
		for (const prop of this.props) {
			// A carrot spins at a constant rate; a log is pushed back and forth
			// about where it settled. Both end up as a delta, because `rotate`
			// is relative and handing it an absolute angle winds the mesh up.
			const turned =
				prop.kind === "log"
					? prop.baseAngle +
						prop.sway * Math.sin(t * prop.swayRate + prop.phase)
					: prop.angle + prop.spin * seconds;
			prop.sprite.rotate(turned - prop.angle, AXIS_Y);
			prop.angle = turned;
		}

		this.placeFlare();

		this.recycleCourse();
		this.refreshHud();
		return true;
	}

	/** steering, jumping, forward motion, and everything they touch */
	private drive(seconds: number, t: number) {
		// forward speed ramps toward its ceiling, so the run gets harder
		this.forwardSpeed = math.lerp(
			SPEED_START,
			SPEED_MAX,
			Math.min(1, this.elapsed / 1000 / SPEED_RAMP),
		);
		this.travelled += this.forwardSpeed * seconds;

		// The leaves ride the surface. Only this set is rewritten per frame —
		// 90 instances against the banks' several thousand, which is why it is
		// worth doing for the things actually afloat and not for the planting.
		// Each leaf carries its own `phase`, so the set never turns or rises in
		// unison; the alternating sign gives neighbours opposite spins, which
		// is what stops a drifting field reading as one rotating sheet.
		// The engine never advances an effect's clock — animation is opt-in,
		// the same contract as re-baking a NoiseTexture2d.
		getRipples().setTime(t);
		for (let i = 0; i < this.leaves.items.length; i++) {
			const { phase } = this.leaves.items[i];
			const sign = i % 2 === 0 ? 1 : -1;
			this.writeInstance(
				this.leaves,
				i,
				sign * (t * LEAF_TURN + phase),
				Math.sin(t * LEAF_SWAY_RATE + phase) * LEAF_SWAY,
				Math.sin(t * LEAF_BOB_RATE + phase) * LEAF_BOB,
			);
		}

		// steering
		let steering = 0;
		if (input.isKeyPressed("left")) {
			steering -= 1;
		}
		if (input.isKeyPressed("right")) {
			steering += 1;
		}
		if (steering !== 0) {
			this.steerVel = math.clamp(
				this.steerVel + steering * STEER_ACCEL * seconds,
				-STEER_MAX,
				STEER_MAX,
			);
		} else {
			this.steerVel -= this.steerVel * Math.min(1, STEER_DRAG * seconds);
		}
		const x = math.clamp(
			this.rabbit.pos.x + this.steerVel * seconds,
			-STEER_LIMIT,
			STEER_LIMIT,
		);
		if (x !== this.rabbit.pos.x + this.steerVel * seconds) {
			// scraped a wall — kill the sideways momentum rather than sticking
			this.steerVel = 0;
		}
		this.rabbit.pos.x = x;

		// jumping
		if (input.isKeyPressed("jump") && this.height === 0) {
			this.verticalVel = JUMP_VELOCITY;
			playJump();
		}
		if (this.verticalVel !== 0 || this.height !== 0) {
			this.verticalVel += GRAVITY * seconds;
			this.height += this.verticalVel * seconds;
			if (this.height >= 0) {
				// landing: only worth a splash if it was a real fall, or every
				// bob against the floor triggers one
				if (this.verticalVel > 400) {
					playSplash();
					this.splash.pos.x = this.rabbit.pos.x;
					this.splash.pos.y = WATER_LEVEL - 4;
					this.splash.depth = this.travelled;
					this.splash.burstParticles(10);
				}
				this.height = 0;
				this.verticalVel = 0;
			}
		}

		// A boat floats at a FLAT height. Following the bed's parabola was
		// right for a sled on snow — it climbed the banks as it steered — and
		// is wrong here: water finds its own level, so steering across the
		// river changes nothing about how high the hull sits.
		this.rabbit.pos.y = WATER_LEVEL + RIDE_Y + this.height - this.bob.rise;

		// The field of view opens slightly as the run speeds up. A few degrees
		// is enough: the periphery stretches, the banks rush, and the sense of
		// speed comes from the lens rather than from the numbers.
		const pace = (this.forwardSpeed - SPEED_START) / (SPEED_MAX - SPEED_START);
		(this.app.viewport as Camera3d).fov = CAM_FOV * (1 + 0.16 * pace);
		// The list is the bob PLUS a lean into the turn, so hard steering banks
		// the boat. Fed to `rotate` as a DELTA, because `rotate` is relative —
		// an absolute angle winds the hull up like a spring within seconds.
		//
		// PLUS, not minus: render space is Y-DOWN and the mesh model matrix
		// carries the axis bridge `diag(s, -s, s)`, which negates vertex Y, so
		// a positive turn about +Z reads on screen as the maths-book negative.
		const lean = this.bob.roll + (this.steerVel / STEER_MAX) * 0.22;
		this.rabbit.rotate(lean - this.lastRoll, AXIS_Z);
		this.lastRoll = lean;

		// The clip has one authored tempo; the run does not. Driving playback
		// off the pace is what makes the rabbit look like it is working for
		// the speed rather than paddling to a metronome.
		this.rabbit.animationspeed = PADDLE_TEMPO_MIN + PADDLE_TEMPO_GAIN * pace;

		this.rabbit.depth = this.travelled;

		// The reflection tracks the hull, mirrored about the waterline.
		// `REFLECT_SQUASH` pulls it back toward the surface: a 1:1 mirror
		// reads as a second boat hanging in the water at this camera angle,
		// and foreshortening is what a low sun actually does to a reflection.
		this.reflection.pos.x = this.rabbit.pos.x;
		this.reflection.pos.y =
			WATER_LEVEL +
			(WATER_LEVEL - this.rabbit.pos.y) * REFLECT_SQUASH +
			REFLECT_SINK;
		this.reflection.depth = this.travelled;
		this.reflection.animationspeed = this.rabbit.animationspeed;
		// Full alpha: the darkness is the TINT's job, and the water drawn over
		// it supplies the translucency. An opaque draw has blending off, so a
		// fractional alpha there would darken toward black rather than fade —
		// the reflection would go muddy instead of soft.
		//
		// It still blinks out with the boat during the invulnerability flash,
		// by hiding rather than fading, for the same reason.
		// `alpha`, not `isRenderable`: that flag only gates bounds updates on a
		// Container, so it never hid anything. Zero and one rather than a ramp
		// keeps this a blink rather than a fade.
		this.reflection.alpha = this.rabbit.alpha > 0.5 ? 1 : 0;

		// The wake is laid down only while the hull is actually in the water —
		// a boat in mid-jump is not disturbing anything.
		if (this.height >= -40) {
			this.updateTrail(x);
		}

		this.afterCollide();
	}

	// ── what a contact means ───────────────────────────────────────────────
	//
	// Both bodies are SENSORS: the engine reports the overlap and these decide
	// what it costs. Nothing here adds or removes a renderable — a prop is
	// recycled by moving it, which is safe to do inside contact dispatch.

	/**
	 * React to a contact the engine reported.
	 *
	 * Dispatched by the physics step, once per contact, with the receiver as
	 * `response.a` — so `other` is always the thing that was hit. Which branch
	 * to take comes off the body's collision type rather than any bookkeeping
	 * the game keeps, which is the whole reason the props carry bodies.
	 *
	 * Nothing here mutates the world: recycling a prop moves it, and the life
	 * and score changes are plain fields. Adding or removing a renderable from
	 * inside contact dispatch is what the physics skill warns against.
	 * @param _response - the contact, unused: these are sensors, so there is
	 * no penetration to resolve — the game's own reaction is the response
	 * @param other - the prop that was hit
	 * @returns false, so the built-in push-out is skipped
	 */
	private hitRock(prop: Prop) {
		// a jump clears a boulder outright — the hull is not in the water
		if (this.height < -CLEAR_HEIGHT || this.elapsed <= this.invulnUntil) {
			return;
		}
		const px = prop.sprite.pos.x;
		// the run of carrots ends here — that is what makes a boulder cost
		// something even while you still have lives in hand
		this.combo = 0;
		this.lives -= 1;
		this.refreshCounters();

		// A hit costs speed by winding the ramp back, since `drive` derives
		// `forwardSpeed` from `elapsed` at the top of every frame — assigning
		// the speed here would be overwritten before anything read it.
		//
		// Every deadline measured against `elapsed` has to be rebased with it,
		// so the rewind happens FIRST: set after it, the invulnerability
		// window would inherit the rewind and last many times its length.
		const rewind = Math.min(this.elapsed, 12000);
		this.elapsed -= rewind;
		this.nextRiverSound = Math.max(0, this.nextRiverSound - rewind);
		this.invulnUntil = this.elapsed + INVULN_MS;

		// the hit, felt rather than counted: the camera takes the
		// blow, the hull throws water, and it is audible
		const pan = Math.max(-1, Math.min(1, px / STEER_LIMIT));
		this.app.viewport.shake(9, 260);
		this.splash.pos.x = px;
		this.splash.pos.y = WATER_LEVEL - 4;
		this.splash.depth = this.travelled;
		this.splash.burstParticles(18);
		if (this.lives <= 0) {
			playCapsize();
			this.gameOver();
		} else {
			playHit(pan);
			// Hit-stop. The shake and the splash say something struck
			// the hull; holding the whole run still for a few frames is
			// what gives it weight, and it is the one cue that reads
			// even when the collision happens off to the side of the
			// frame. Only on a survivable hit — the fatal one already
			// has the game-over fade to land on, and stacking a freeze
			// in front of that just delays the result.
			// `music` is left false so the track plays through it.
			void this.app.freeze(HIT_STOP_MS);
			// and the bow kicks. Added to the velocity rather than
			// assigned, so a second rock while the first kick is still
			// settling compounds instead of restarting it.
			this.pitchVel -= LURCH_IMPULSE;
		}
	}

	/** the boat reached a carrot */
	private eatCarrot(prop: Prop) {
		// recycled rather than hidden: `alpha = 0` on a Mesh draws it black
		// instead of hiding it, which left an eaten carrot as a dark
		// silhouette lying on the water
		const pickX = prop.sprite.pos.x;
		// read before `recycle` moves the carrot away
		const pickY = prop.sprite.pos.y;
		const pickZ = prop.sprite.depth;
		this.recycle(prop, this.nextPropDistance(prop.kind));
		// the multiplier THIS carrot earns, read before the count advances, so
		// the number that floats up is the number that was added
		const worth = CARROT_SCORE * this.multiplier;
		this.combo += 1;
		this.comboExpires = this.elapsed + COMBO_WINDOW_MS;
		this.score += worth;
		this.refreshCounters();
		this.sparkle.pos.x = pickX;
		this.sparkle.pos.y = WATER_LEVEL - 40;
		this.sparkle.depth = this.travelled;
		this.sparkle.burstParticles(12);
		playPickup(Math.max(-1, Math.min(1, pickX / STEER_LIMIT)), this.multiplier);
		this.popScore(pickX, pickY, pickZ, worth);
	}

	/** the per-frame tail of what `collide` used to do */
	private afterCollide() {
		// flash while the hit still counts as recent
		this.rabbit.alpha =
			this.elapsed < this.invulnUntil && Math.floor(this.elapsed / 90) % 2 === 0
				? 0.35
				: 1;
	}

	/**
	 * Point the lens flare at wherever the sun currently lands on screen.
	 *
	 * Run AFTER the camera has moved, or the flare trails the frame by one
	 * update — the one place where a flare stops looking like glass and starts
	 * looking like a bug.
	 */
	private placeFlare() {
		aimFlare(this.app.viewport as Camera3d, this.sunDisc);
	}

	/** leapfrog the terrain tiles and re-seed props that fell behind */
	private recycleCourse() {
		for (const tile of this.tiles) {
			if (tile.depth + TILE_LEN < this.travelled - SPAWN_BEHIND) {
				tile.depth += TILE_LEN * this.tiles.length;
			}
		}
		for (const scatter of this.scatters) {
			for (let i = 0; i < scatter.items.length; i++) {
				if (scatter.items[i].z < this.travelled - SPAWN_BEHIND) {
					this.placeInstance(
						scatter,
						i,
						this.nextSpawnDistance(scatter),
						this.spawnSide,
					);
				}
			}
		}
		for (const prop of this.props) {
			if (prop.sprite.depth < this.travelled - SPAWN_BEHIND) {
				this.recycle(prop, this.nextPropDistance(prop.kind));
			}
		}
	}

	// ── the scene that follows from the simulation ─────────────────────────

	/**
	 * Rebuild the wake from where the hull has been.
	 *
	 * A sample is taken every `TRAIL_STEP` of travel rather than every frame:
	 * the ribbon then has a fixed length in WORLD units regardless of frame
	 * rate or speed, instead of shortening whenever the game runs fast.
	 * @param x - the hull's current x
	 */
	private updateTrail(x: number) {
		if (this.travelled - this.lastTrailZ >= TRAIL_STEP) {
			this.lastTrailZ = this.travelled;
			this.trailPath.unshift({ x, z: this.travelled });
			if (this.trailPath.length > TRAIL_POINTS) {
				this.trailPath.length = TRAIL_POINTS;
			}
		}
		const verts = this.trailVerts;
		const count = this.trailPath.length;
		const trailDepth = this.travelled - TRAIL_SORT_BIAS;
		for (let side = 0; side < 2; side++) {
			const sign = side === 0 ? -1 : 1;
			for (let i = 0; i < TRAIL_POINTS; i++) {
				// Past the end of the history every remaining rung pins to the
				// oldest real sample, so a young wake collapses into a point
				// rather than fanning out from the origin.
				const point = this.trailPath[Math.min(i, count - 1)] ?? {
					x,
					z: this.travelled,
				};
				const age = i / (TRAIL_POINTS - 1);
				// the V: each ribbon walks outward as it falls behind
				const offset =
					sign *
					(TRAIL_SPREAD_NEAR + (TRAIL_SPREAD_FAR - TRAIL_SPREAD_NEAR) * age);
				// It widens as it falls behind, and pinches out at the very
				// end so the ribbon has a tip rather than a cut edge.
				const taper = 1 - age * age * age;
				const half =
					(TRAIL_WIDTH_NEAR + (TRAIL_WIDTH_FAR - TRAIL_WIDTH_NEAR) * age) *
					(count > 1 ? taper : 0);
				// and it thins toward the river's own colour as it goes:
				// squared, so the foam holds just behind the stern and then
				// lets the water back through
				const fade = (1 - age) * (1 - age);
				const r = Math.round(
					TRAIL_RIVER[0] + (TRAIL_FOAM[0] - TRAIL_RIVER[0]) * fade,
				);
				const g = Math.round(
					TRAIL_RIVER[1] + (TRAIL_FOAM[1] - TRAIL_RIVER[1]) * fade,
				);
				const b = Math.round(
					TRAIL_RIVER[2] + (TRAIL_FOAM[2] - TRAIL_RIVER[2]) * fade,
				);
				// packed as `Color.toUint32` does it: A, then R, G, B
				const packed = ((255 << 24) | (r << 16) | (g << 8) | b) >>> 0;
				const rung = side * TRAIL_POINTS + i;
				for (let k = 0; k < 2; k++) {
					const v = (rung * 2 + k) * 3;
					verts[v] = point.x + offset + (k === 0 ? -half : half);
					// POSITIVE lifts it clear of the surface, which looks
					// backwards in a Y-down world and is not: a mesh's model
					// matrix carries the axis bridge `diag(s, -s, s)`, so
					// vertex Y is NEGATED on the way to world space — the same
					// reason the instance placements pass `-item.y / s`.
					verts[v + 1] = TRAIL_LIFT;
					// measured from the BIASED origin, so biasing the sort key
					// does not also shift the geometry down the river
					verts[v + 2] = point.z - trailDepth;
					this.trailColors[rung * 2 + k] = packed;
				}
			}
		}
		this.trail.depth = trailDepth;
		this.trail.needsUpdate = true;
	}

	/**
	 * Float a "+N" where the carrot was taken.
	 *
	 * Projected with `Camera3d.worldToScreen`, so the label appears on the
	 * pickup rather than at a fixed spot near the boat. It hands back screen
	 * pixels in the engine's own 2D draw space, which is exactly what a
	 * `floating` renderable wants, and `null` for a point at or behind the
	 * camera — the one case worth skipping rather than drawing at a mirrored
	 * coordinate.
	 * @param x - the carrot's world x
	 * @param y - its world y
	 * @param z - its world z
	 * @param worth - what it scored, multiplier already applied
	 */
	private popScore(x: number, y: number, z: number, worth: number) {
		const camera = this.app.viewport as Camera3d;
		const screen = camera.worldToScreen(_popAt.set(x, y, z), _popScreen);
		if (screen === null) {
			return;
		}
		const pop = this.pops[this.nextPop];
		this.nextPop = (this.nextPop + 1) % this.pops.length;
		// The rise and the fade are driven from `age` in `update` rather than
		// by a `Tween`. These labels are POOLED, so one can be re-fired long
		// before its last flight finished — a fresh tween would then start
		// from a half-risen position and run alongside the one still
		// animating, with both writing the same `pos`. A timer just restarts.
		pop.age = 0;
		pop.x = screen.x;
		// a line below the pickup, so the label clears the carrot it came from
		pop.y = screen.y + 19;
		pop.label.pos.set(pop.x, pop.y);
		pop.label.depth = HUD_Z;
		// the pool is built empty, so a label carries no text until it fires
		pop.label.setText(`+${worth}`);
	}

	/**
	 * Advance the "+N" labels: rise and fade, then retire.
	 * @param dt - frame time in milliseconds
	 */
	private updatePops(dt: number) {
		for (const pop of this.pops) {
			if (pop.age >= POP_MS) {
				continue;
			}
			pop.age += dt;
			const t = Math.min(1, pop.age / POP_MS);
			// Drifts up as it fades. Out-quadratic on the rise, so it leaves
			// the pickup quickly and settles rather than sliding at a constant
			// speed; in-quadratic on the fade, so it holds long enough to read
			// before going.
			pop.label.pos.y = pop.y - POP_RISE * (1 - (1 - t) * (1 - t));
			pop.label.alpha = 1 - t * t;
		}
	}

	private gameOver() {
		this.over = true;
		// Over she goes. `drive` stops at `over`, so the pitch integrator in
		// `update` is what carries this — it runs through the game-over fade,
		// which is the window the tumble is tuned to fill.
		this.tumbling = true;
		audio.stopTrack();
		// recorded once, at the end: writing every frame would hammer
		// localStorage for a number that only matters when the run stops
		const metres = Math.floor(this.travelled / 10);
		this.beatRecord = submitRun(this.score, metres);
		// the banner says nothing until this moment, so this is the only place
		// that writes it
		this.banner.setText(this.beatRecord ? "NEW BEST!" : "CAPSIZED!");
		// Hand the result to the game-over stage rather than freezing here.
		// It rebuilds the world, so nothing can be read back off this one —
		// the numbers travel as `state.change` arguments.
		state.change(state.GAMEOVER, false, this.score, metres, this.beatRecord);
	}

	/** the camera trails the boat, damped so a hard turn reads as a turn */
	private followCamera(seconds: number) {
		this.sun.depth = this.travelled;
		this.ambient.depth = this.travelled;
		const camera = this.app.viewport as Camera3d;
		// Follow the boat's x exactly. A fixed fraction of it used to stand in
		// for camera lag, but that lag GROWS with distance from the centre —
		// at full steer it left the boat 59 units off-axis, which at this
		// focal length is 451px of a 480px half-frame: hard against the edge,
		// overlapping the far bank, and reading as though the boat had beached
		// itself. The trailing feel belongs to `CAM_DAMP`, which lags only
		// while the boat is actually moving across and settles centred.
		this.camTarget.set(
			this.rabbit.pos.x,
			this.rabbit.pos.y + CAM_UP,
			this.travelled + CAM_BACK,
		);
		camera.pos.x = math.damp(camera.pos.x, this.camTarget.x, CAM_DAMP, seconds);
		camera.pos.y = math.damp(camera.pos.y, this.camTarget.y, CAM_DAMP, seconds);
		// depth is not damped: the boat must never outrun the camera
		camera.depth = this.camTarget.z;

		// The field opens as the ramp climbs. Scrolling faster does not by
		// itself feel faster — the frame looks the same and only the distance
		// counter moves — but widening the view pushes the banks outward and
		// pulls the horizon back, which is what the eye reads as acceleration.
		// Damped rather than assigned, so a hit's speed rewind eases the view
		// back in instead of snapping it.
		const speedT = math.clamp(
			(this.forwardSpeed - SPEED_START) / (SPEED_MAX - SPEED_START),
			0,
			1,
		);
		camera.fov = math.damp(
			camera.fov,
			CAM_FOV + FOV_PUNCH * speedT,
			CAM_DAMP,
			seconds,
		);
	}

	/**
	 * The live counter, the one label whose content actually changes per frame.
	 *
	 * `best` and `banner` are NOT touched here: they change only when a run
	 * starts or ends, so they are written from those events instead. `setText`
	 * re-measures, re-rasterizes the offscreen canvas and invalidates the GPU
	 * texture on every call — its early-out guards the assignment only — so a
	 * label that says the same thing should not be re-set at all.
	 */
	/**
	 * The distance, and only the distance.
	 *
	 * It is the one value that changes every frame. `LIVES` and `CARROTS` are
	 * written from the events that change them, and `BEST` once when the run
	 * starts — `setText` re-measures, re-rasterizes and re-uploads on every
	 * call, so a label that says the same thing should not be re-set at all.
	 */
	private refreshHud() {
		this.hudDistance.setText(`${Math.floor(this.travelled / 10)}M`);
	}

	/** LIVES and CARROTS, from the events that move them */
	/** what the next carrot is worth, derived from the run of them so far */
	private get multiplier() {
		return Math.min(COMBO_MAX, 1 + Math.floor(this.combo / COMBO_STEP));
	}

	private refreshCounters() {
		// No ♥ in a display face like this one — it renders as tofu, and
		// spelling it out survives whatever font the game ends up with.
		this.hudLives.setText(`LIVES ${Math.max(0, this.lives)}`);
		this.hudCarrots.setText(`CARROTS ${this.score}`);

		// only once it is actually multiplying: a permanent "x1" is noise, and
		// the label appearing is itself the signal that the run is going well
		const mult = this.multiplier;
		this.hudMultiplier.setText(mult > 1 ? `COMBO x${mult}` : "");
		// Sits after the score, so where it goes depends on how many digits
		// that has — measured rather than guessed. Moving a `Text` is what
		// this relies on, which is why it can follow the number as it grows.
		this.hudMultiplier.pos.x =
			this.hudCarrots.pos.x + this.hudCarrots.measureText().width + 9;
		if (mult !== this.shownMultiplier) {
			this.shownMultiplier = mult;
			// restart the punch, including on the drop back to x1 — losing a
			// combo is worth as much of a beat as earning one
			this.multPunchAge = 0;
		}
	}

	onDestroyEvent() {
		// belt and braces: `gameOver` already cuts it, but leaving the stage by
		// any other route must not leave the track playing under the menus
		audio.stopTrack();
		input.unbindKey(input.KEY.LEFT);
		input.unbindKey(input.KEY.A);
		input.unbindKey(input.KEY.RIGHT);
		input.unbindKey(input.KEY.D);
		input.unbindKey(input.KEY.SPACE);
	}
}
