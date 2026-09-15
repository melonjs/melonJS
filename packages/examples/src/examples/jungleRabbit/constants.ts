/**
 * melonJS — Jungle Rabbit: tuning constants.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/**
 * Internal render size, upscaled to fill the page.
 *
 * This is what makes the picture chunky: everything is drawn at 480×270 and
 * blown up with `antiAlias: false`, so one source pixel lands as a visible
 * block. Rendering at the real canvas size and merely filtering textures with
 * "nearest" gives crisp texels on smooth geometry, which is a different look
 * entirely — the stair-stepped edges are the point.
 */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** the sky. The haze has its own colour now, so this one can be sky blue */
export const SKY = "#8fd0e6";

// ── the gorge ───────────────────────────────────────────────────────────
/** half-width of the navigable river, in world units */
export const HALF_W = 900;
/**
 * How far the banks climb at the edge (Y-down, so this is subtracted).
 *
 * Lower than a ski slope wants. Steep walls close the frame in and leave a
 * slot of sky at the top; a jungle river should show its sky, and the canopy
 * reads better silhouetted against it than against more bank.
 */
export const WALL_H = 520;
/** world Y of the deepest point of the river bed */
export const GROUND_Y = 0;

/**
 * How far the water surface sits above the deepest point of the bed.
 *
 * The river is its own surface now, laid over the bed rather than painted onto
 * it. That gives the shoreline for free: the surface is flat, the bed is a
 * parabola, and they meet where the parabola reaches this height — so the
 * waterline is wherever the geometry says, instead of wherever a colour blend
 * was tuned to.
 */
export const WATER_DEPTH = 150;

/** world Y of the water surface (Y-down, so above the bed is negative) */
export const WATER_LEVEL = GROUND_Y - WATER_DEPTH;

/**
 * Half-width of the water, solved from the bed's parabola rather than chosen.
 * Change the depth or the bank height and the shore follows on its own.
 */
export const WATER_HALF_W = HALF_W * Math.sqrt(WATER_DEPTH / WALL_H);

/**
 * How far the river surface reaches behind and ahead of the boat.
 *
 * It is one plane that travels with the run, so this is its whole extent: far
 * enough back to sit under the camera, far enough forward to reach past where
 * the haze closes.
 */
export const WATER_BACK = -2400;
export const WATER_FRONT = 7600;

/**
 * How much of the boat's speed the river carries downstream with it.
 *
 * ZERO — the surface is anchored to the world, exactly like the bed, the
 * boulders and the banks.
 *
 * A flowing river is the physically honest answer and it looked wrong, because
 * everything IN the river is world-anchored: at 0.72 the boulders raced across
 * a nearly-still surface and the whole thing read as a parallax layer that had
 * come unstuck from the scene. Consistency with the objects sitting in the
 * water matters more here than the fact that rivers move.
 *
 * The ripples are legible anyway now that the texture has real contrast and
 * whitecaps — a rapid moving at speed is what this is meant to be.
 */
export const RIVER_FLOW = 0;

/**
 * World units per repeat of the water surface texture.
 *
 * Large. Small features scroll past too fast to be seen changing; big ones
 * linger on screen long enough for the animation to register as movement of
 * the water rather than movement past it.
 */
export const RIPPLE_UV = 520;

/**
 * How far above the water a blob shadow floats, in world units.
 *
 * The engine centres a blob under its caster and does not offset it by the
 * light direction, so a boulder sitting in the shallows hides its own contact
 * shadow completely from this camera. A small lift brings the near edge out
 * from under the rock; too much and the blob rides up over the top of it.
 */
export const SHADOW_LIFT = 8;

/** length of one terrain tile along +Z */
export const TILE_LEN = 2400;
/**
 * Columns across a tile, rows along it.
 *
 * The columns shape the parabola and carry the baked ambient occlusion, so
 * they stay dense. The rows carried nothing but the old per-vertex distance
 * haze — the profile, the normals, the UVs and the vertex colours are all
 * constant along Z — so with `camera.setFog` doing that per fragment they came
 * down from 9. Measured rather than assumed: the largest step in the fog
 * gradient is under a quarter of one colour level at every value from 9 to 2.
 */
export const TILE_NX = 21;
export const TILE_NZ = 3;
/**
 * World units per texture repeat.
 *
 * Small. At 520 a single band in the source was 130 units wide on the water,
 * and under perspective a handful of bands that size converge into a fan of
 * rays pointing at the horizon — the river read as a sunburst rather than as
 * current. Tiling more often keeps the features under the size at which the
 * eye starts reading them as one big shape.
 */
export const WATER_UV = 190;

/**
 * How far past `HALF_W` the terrain mesh reaches, as a multiple of it.
 *
 * Purely so the ground does not run out inside the frame: the planting bands
 * go past `HALF_W`, and the profile is flat out there, so the extra width is
 * two more columns of triangles and no new silhouette.

 */
export const TERRAIN_OVERHANG = 1.7;

/** where the haze starts — just past the boat, so the playfield stays crisp */
export const FOG_NEAR = 2600;

/**
 * ...and where it hides the far end of the course entirely.
 *
 * This has to land INSIDE the spawn distance or props visibly appear before
 * the fog has finished with them: they arrive `SPAWN_AHEAD` down the course
 * with the camera `CAM_BACK` behind that, so a prop is ~6100 away the frame it
 * pops in. Fog measured beyond that can never complete in time.
 *
 * The height falloff pulls it in further still. The camera rides ~450 above
 * `fogHeight`, so density along its rays starts at `exp(-k · 450)` ≈ 0.5, and
 * a wall tree's effective distance is a little over half its real one. That is
 * the falloff doing its job — but it means this number is compared against
 * roughly `0.55 ×` the geometric distance, not the distance itself.
 */
export const FOG_FAR = 6400;

/**
 * How fast the haze thins with altitude.
 *
 * Low, so it climbs. A strong falloff pools it in the channel and leaves the
 * canopy and the far bend perfectly crisp, which is what made props visible
 * as they arrived; 0 would be uniform at every height.
 */
export const FOG_HEIGHT_FALLOFF = 0.0005;

/**
 * Music level. Balanced against the procedural effects in `sfx.ts` by lifting
 * THOSE rather than dropping this: at 0.5 the track buried them, but taking the
 * music down to compensate just made it sound like it had failed to start. The
 * effects now sit at roughly 0.09–0.37 and cut through a track at this level.
 */
export const MUSIC_VOLUME = 0.32;

// ── the boat ────────────────────────────────────────────────────────────
/**
 * World units per glTF unit for the authored boat. The rig is modelled around
 * a 1.4-unit rabbit, so this is what puts it back at the size the built
 * geometry it replaced used to be.
 */
export const BOAT_SCALE = 44;
/**
 * World units per glTF unit for every authored prop. The models are sized
 * against this one number rather than each carrying its own, so a prop that
 * looks wrong is a modelling problem and not a scaling one.
 */
export const MODEL_SCALE = 40;
/**
 * Paddle playback, as a multiple of the authored tempo: the slowest stroke at
 * a standing start, and how much faster it gets at full pace.
 */
export const PADDLE_TEMPO_MIN = 0.85;
export const PADDLE_TEMPO_GAIN = 0.9;
/**
 * Where the boat model's ORIGIN sits relative to the river surface, in render
 * space — so **positive is down**, and a positive value is what puts the hull
 * *in* the water rather than above it.
 *
 * The authored hull's underside is 0.03 model units below that origin, which
 * is 1.3 world units at `MODEL_SCALE`, so the draft is very nearly this number
 * minus whatever the bob has lifted. `BOB_RISE` never exceeds it, which is
 * what keeps the boat from leaving the water at the top of a swell.
 */
export const RIDE_Y = 9;
/**
 * How far the swell lifts the hull. Kept below `RIDE_Y` + the hull's own
 * underside so the boat rides the water instead of hopping off it.
 */
export const BOB_RISE = 7;
/**
 * Forward speed at the start, and the ceiling it ramps to (units/second).
 *
 * The start is NOT a gentle one. This is a rapid, and the opening seconds have
 * to read as one — at half this the river looked like a canal and the first
 * stretch was something to sit through. The warm-up that keeps the opening
 * readable is a DISTANCE band (see `WARMUP_DISTANCE`), not a timer, so a
 * quicker start shortens how long the player waits without taking away the
 * clear lane they learn the controls on.
 */
export const SPEED_START = 780;
export const SPEED_MAX = 1500;
/** how long, in seconds, it takes to reach SPEED_MAX */
export const SPEED_RAMP = 70;
/** sideways acceleration and the top sideways speed */
export const STEER_ACCEL = 2600;
export const STEER_MAX = 620;
/** sideways drag applied when nothing is held, per second */
export const STEER_DRAG = 3.2;
/** how far from the centre the boat may get before it runs aground */
export const STEER_LIMIT = WATER_HALF_W * 0.82;
/** jump impulse (negative = up) and gravity, units/second */
export const JUMP_VELOCITY = -1150;
export const GRAVITY = 2900;

// ── the camera ──────────────────────────────────────────────────────────
/**
 * Behind (−Z) and above (−Y) the boat.
 *
 * Low and close. Riding high and far back reads as a map view: the horizon
 * sinks to the middle of the frame, the banks flatten out and the boat becomes
 * a detail in the picture. Down here the gorge walls loom either side and the
 * horizon sits high, which is the difference between watching the run and
 * being in it.
 */
export const CAM_BACK = -620;
export const CAM_UP = -230;
/** how fast the camera catches up; higher is tighter */
export const CAM_DAMP = 6;
/**
 * Downward tilt, in radians. Without it the camera looks dead level, the
 * horizon sits across the middle of the frame and everything at ground level
 * between the camera and the skier projects off the bottom edge — including
 * the whole trail.
 */
export const CAM_PITCH = -0.1;

/**
 * Vertical field of view, in radians.
 *
 * Narrower than the 60° default. A wide angle exaggerates depth — the banks
 * rush past and anything more than a few hundred units out shrinks to nothing
 * — while pulling in flattens the run and keeps the scenery ahead readable at
 * a size worth having drawn.
 */
export const CAM_FOV = Math.PI / 4;

/** HUD depth: near the camera, so screen-space overlays draw last */
export const HUD_Z = -150;

// ── the course ──────────────────────────────────────────────────────────
/** how far ahead of the boat props are recycled to */
export const SPAWN_AHEAD = 5200;

/**
 * The nearest a recycled prop may arrive, as a fraction of its spawn distance.
 *
 * Must land beyond where the fog has finished. At 0.55 a carrot could appear
 * 2900 out — well inside the haze — and pop into view fully formed, which is
 * the one thing an endless runner must never show.
 */
export const SPAWN_MIN_FRACTION = 0.84;
/**
 * Boulders arrive further out too, for a reason of their own.
 *
 * The floor is a parabola, so a boulder out at `STEER_LIMIT` sits ~510 above
 * the valley bottom — HIGHER than the camera — while one in the middle of the
 * run sits at the bottom. The height falloff reads those two very differently:
 * roughly 0.49 against 0.73 of the geometric distance. Tuned for the edge
 * case, since that is the one that was arriving in plain sight.
 */
export const ROCK_SPAWN_AHEAD = 6600;

/**
 * Bank planting arrives further out than everything else.
 *
 * They stand on the walls, well above the valley floor, and the height falloff
 * thins the fog exactly where they are — so a tree is the last thing to be
 * fully hidden and the first thing seen arriving. Spawning them deeper buys
 * the fog the extra distance it needs. Kept clear of the 9000 far clip plane:
 * the camera trails `CAM_BACK` behind, so this plus ~880 is the real distance.
 */
export const TREE_SPAWN_AHEAD = 7200;
/**
 * How far behind before a prop — or a terrain tile — is recycled.
 *
 * Must clear the CAMERA, not the boat. The camera trails `CAM_BACK` behind,
 * and a low one looks at ground close to and behind itself, so a margin
 * measured from the boat leaves the bottom of the frame hanging over the edge
 * of the world: the river ends in a pale arc with the sky showing under it.
 */
export const SPAWN_BEHIND = 1800;
/**
 * Boulders and trees are drawn as instanced sets — one draw call each — so the
 * counts are set by how the slope should LOOK rather than by what the frame
 * budget can afford. As individual meshes these were 20 and 40.
 */
/**
 * Deliberately sparse. The river is the obstacle course on its own — at 90 the
 * rocks formed a near-continuous slalom with no line through it, which reads
 * as unfair rather than difficult. Sparse enough now that every gap is
 * takeable, and the boulders punctuate the run instead of blocking it.
 */
export const ROCK_COUNT = 24;
/**
 * How many logs the course keeps in rotation.
 *
 * Far fewer than the boulders on purpose. Spacing is derived from the count —
 * the pool has to cover `SPAWN_AHEAD + SPAWN_BEHIND`, so a smaller pool means a
 * longer gap — which puts a log roughly every four boulders. It should read as
 * something you meet once in a while, not a second kind of clutter.
 */
export const LOG_COUNT = 6;
/**
 * The bank is three instanced sets in layers, not one: palms overhead, broad
 * leaves at mid height, ferns down at the waterline. One draw call each, so
 * the counts answer to how dense the jungle should LOOK and nothing else —
 * and depth in planting is what separates jungle from a row of trees.
 *
 * They also have to cover the ground that EXISTS. The terrain runs out to
 * `HALF_W * TERRAIN_OVERHANG`, and `valleyY` clamps past `HALF_W`, so beyond
 * the wall the bank is a flat plateau — bands that stopped at ~1.1 left a bare
 * green shelf above the tree line, which is what the gaps were. The bands below
 * reach the terrain edge instead, and the counts rise with the area so the
 * density near the water does not thin out to pay for it.
 */
export const PALM_COUNT = 460;
export const BUSH_COUNT = 460;
export const FERN_COUNT = 1150;
/**
 * Blooms per colour, threaded through the leaf band. Kept well below the
 * foliage counts: flowers are the accent, and a bank as dense in blooms as in
 * leaves stops reading as jungle and starts reading as a flowerbed.
 */
export const FLOWER_COUNT = 120;

/** leaves drifting on the river, purely to fill the middle distance */
export const LEAF_COUNT = 90;
/** carrots stay one mesh each, being collected individually */
export const CARROT_COUNT = 14;
/**
 * How far the run goes before the boulders reach the middle of the river.
 *
 * The opening should be readable. For this first stretch rocks are placed out
 * toward the banks only, leaving a clear lane down the centre that narrows as
 * it goes — so the player learns the controls on an empty river and meets the
 * real obstacle course once they can steer. Nothing is spawned or despawned to
 * do it; the placement band simply opens up.
 */
export const WARMUP_DISTANCE = 9000;

/** a rock only counts as a hit while the boat is below this height */
export const CLEAR_HEIGHT = 120;
/** how long the boat flashes and cannot be hit again, in ms */
export const INVULN_MS = 1900;

export const START_LIVES = 3;
export const CARROT_SCORE = 25;

/**
 * Carrots in a row per multiplier step, and the ceiling it stops at.
 *
 * Short on purpose. A run here is measured in tens of seconds, so a combo that
 * takes a minute to build is one nobody ever sees — four carrots puts the first
 * step inside the opening stretch, which is where it has to be to change how
 * the river gets read. A boulder or a log resets it to nothing.
 */
export const COMBO_STEP = 4;
export const COMBO_MAX = 4;

/** the multiplier's own ramp — hotter than the HUD's cream-to-gold */
export const MULT_RAMP_TOP = "#fff3c4";
export const MULT_RAMP_BOTTOM = "#ff3b1f";

/**
 * The punch the multiplier gives when it steps, and how long it takes to
 * settle.
 *
 * It is the only HUD line that changes rarely, so it is the only one worth
 * animating: a counter that ticks every frame would be noise. Scaling from
 * its own position means it grows out of where it already was rather than
 * jumping, which is what keeps the eye on it without the number moving.
 */
/**
 * How long a combo survives without another carrot, in milliseconds.
 *
 * Without this the multiplier is free to hold: dodge everything, never take a
 * pickup, and it rides at its ceiling forever. The window makes it something
 * you have to KEEP EARNING — the run has to stay greedy, which is the whole
 * point of having it.
 *
 * Set against how often a carrot actually passes. Spacing is
 * `(SPAWN_AHEAD + SPAWN_BEHIND) / CARROT_COUNT` = 500 units, and the boat
 * covers that in 0.33-0.64s depending on how far into the speed ramp it is —
 * so this is worth about three to six of them going by. At nearly twice this
 * it was a safety net rather than a pressure: a combo would essentially only
 * ever end by hitting something.
 */
export const COMBO_WINDOW_MS = 2200;

/**
 * How long before a combo lapses that the label starts blinking, and how fast.
 *
 * Score-chain games usually drain a bar, which says how much time is left
 * rather than just that it is short. A blink is the cheap version of that and
 * enough here — the window is under four seconds, so "it is flashing" and "it
 * is nearly gone" are the same statement.
 */
export const COMBO_WARN_MS = 800;
export const COMBO_BLINK_MS = 110;

export const MULT_PUNCH = 0.85;
export const MULT_PUNCH_MS = 380;

// ── the rainbow ─────────────────────────────────────────────────────────
/**
 * How far up the gorge the sun sits.
 *
 * Past the fog, and past the far clip plane's reach for anything else — it is
 * exempt from both, so this only has to be far enough that it reads as sky
 * rather than as an object in the scene the boat is closing on.
 */
export const SUN_AHEAD = 8200;

/**
 * The sun's lens flare: one entry per ghost.
 *
 * `at` is where the ghost sits along the line running from the sun's SCREEN
 * position through the centre of the frame — 1 is on the sun, 0 is the centre,
 * negative is the far side. That single number is the whole trick: steering
 * swings the sun across the frame, and every ghost slides along the same line
 * in response, which is what makes a flare read as lens glass rather than as
 * decals pinned to the sky.
 *
 * Sizes and tints are deliberately mismatched. Real ghosts are images of the
 * aperture formed by different elements, so they differ in both — a row of
 * identical dots reads as a mistake.
 */
/**
 * How far into the frame's edge the flare fades out, as a fraction of the
 * frame. A flare that snapped off the instant the sun left the view would read
 * as a bug; glass keeps scattering light for a moment after.
 */
export const FLARE_EDGE_FADE = 0.22;

/** the haze: a humid green, not the sky's blue, so the gorge reads as jungle */
export const FOG_COLOR = "#bcd8c4";

/**
 * How fast a floating leaf turns on the current, in radians per second, before
 * the per-instance jitter. Slow on purpose: a leaf that spins is a pinwheel,
 * and what reads as water is the set turning at visibly DIFFERENT rates.
 */
export const LEAF_TURN = 0.34;

/** world units a leaf sways across the current, and how fast it cycles */
export const LEAF_SWAY = 6;
export const LEAF_SWAY_RATE = 0.6;

/**
 * How far a leaf rides up and down the swell. Kept under the boat's `BOB_RISE`
 * — a leaf sitting ON the surface should move less than a hull driving through
 * it, or the river reads as choppier than the boat is having to work for.
 */
export const LEAF_BOB = 3.2;
export const LEAF_BOB_RATE = 1.25;

/**
 * Hit-stop: how long the whole run holds still on a non-fatal collision, in
 * milliseconds. Short on purpose — long enough to register as an impact,
 * short enough that it never reads as a dropped frame. The fatal hit does
 * not take one: the game-over fade is already the pause.
 */
export const HIT_STOP_MS = 90;

/**
 * How much wider the camera opens at `SPEED_MAX` than at `SPEED_START`, in
 * radians. A river that scrolls faster does not, on its own, feel faster —
 * the frame looks identical and only the numbers move. Widening the field as
 * the ramp climbs pushes the banks outward and pulls the horizon back, which
 * is what actually reads as acceleration. Kept small: past roughly 0.1 the
 * perspective distortion starts to bend the bank into a fisheye.
 */
export const FOV_PUNCH = 0.075;

/** model-to-world scale for a bird — wingspan is ~1.3 model units */
export const BIRD_SCALE = 78;

/** how many birds drift above the gorge */
export const BIRD_COUNT = 7;
/** how far above the water they fly, and how far that varies */
export const BIRD_HEIGHT = 520;
export const BIRD_HEIGHT_SPREAD = 260;
/** how far up the run they fly — near enough to read, far enough not to intrude */
export const BIRD_AHEAD = 1750;

/** their speed across the gorge, in world units per second */
export const BIRD_SPEED = 95;
/** how far out from the centre line they range */
export const BIRD_SPAN = 1700;

/** how long one on/off cycle of the title's prompt takes, in milliseconds */
export const PROMPT_BLINK_MS = 1100;
/** the prompt never fades to nothing — it dips to this and back */
export const PROMPT_DIM = 0.45;

/**
 * The boat's reflection: how far its mirrored copy is squashed toward the
 * surface, and how strongly it shows through.
 *
 * A true 1:1 mirror reads as a second boat hanging underwater at this
 * viewing angle. Foreshortening it is both cheaper to look at and closer to
 * what a low sun actually does to a reflection on moving water.
 */
export const REFLECT_SQUASH = 0.62;

/**
 * The reflection's tint, multiplied into the rig's own colours.
 *
 * This is where its darkness comes from — it is drawn OPAQUE, under the
 * water, so it has no alpha of its own and the river supplies the
 * translucency.
 *
 * Not decoration — it is what makes the reflection read as one whichever way
 * the transparent pass happens to sort it. The reflection and the water plane
 * are sorted per OBJECT, and steering changes their relative distance to the
 * camera, so the order flips mid-turn: under the river it looked like a
 * reflection, over it like a second rabbit at half opacity. Tinted down to a
 * dark water blue it reads as a reflection in both orderings, and the sort
 * stops mattering.
 */
export const REFLECT_TINT: [number, number, number] = [46, 104, 128];
/** how far under the surface it sits, so it never z-fights the water */
export const REFLECT_SINK = 1;

/**
 * The kick the bow takes on a survivable hit, in radians per second.
 *
 * A boat striking a rock pitches — it does not roll over and carry on. The
 * impulse is sprung back to level rather than tweened, so a second hit while
 * the first is still settling compounds instead of restarting, the way a real
 * hull would keep getting knocked about.
 */
export const LURCH_IMPULSE = 3.1;
/** how hard the hull is pulled back to level, and how fast the kick dies */
export const PITCH_SPRING = 46;
export const PITCH_DAMP = 7.5;

/**
 * The capsize: how fast the boat tumbles forward once the last life is gone,
 * in radians per second. It plays out over the game-over fade, so this is
 * tuned to land roughly a half-turn in that window — enough to read as going
 * over, not so much that it spins like a coin.
 */
export const TUMBLE_RATE = 4.2;

/**
 * The title's river drifts even though nothing is travelling down it: the
 * water texture is baked, so its motion is UV scroll, and the menu has no
 * `travelled` to drive it. This is that stand-in, in world units per second.
 * Slower than the run — a menu river should idle, not race.
 */
export const TITLE_DRIFT = 150;

/** the pair of carrots flanking the title, and how fast they turn */
export const TITLE_CARROT_X = 330;
export const TITLE_CARROT_Y = WATER_LEVEL - 168;
export const TITLE_CARROT_Z = 620;
export const TITLE_CARROT_SCALE = 43;
export const TITLE_CARROT_SPIN = 1.15;
/** how far they bob, and how fast */
export const TITLE_CARROT_BOB = 12;
export const TITLE_CARROT_BOB_RATE = 1.6;

/**
 * The menu/HUD text ramp: light at the top falling into gold.
 *
 * Handed to `Text.fillStyle` as a `Gradient`, so it colours the glyph fill and
 * leaves the black outline alone — `Text` strokes in a separate pass.
 */
export const TEXT_RAMP_TOP = "#fffdf0";
/** the deep end of the same ramp */
export const TEXT_RAMP_BOTTOM = "#ffa71d";

/** how many "+N" pops can be in the air at once */
export const POP_POOL = 6;

/** how long one stays up, in milliseconds */
export const POP_MS = 620;

/** how far it drifts up over that time, in buffer pixels */
export const POP_RISE = 22;

/**
 * The boat's wake: two narrow ribbons off the stern corners, laid down on the
 * surface along the path the hull actually took.
 *
 * Two rather than one down the middle, because that is what a hull does — it
 * pushes water out to either side and the disturbance spreads behind it as a
 * V. A single centre trail reads as exhaust.
 *
 * Kept SHORT on purpose. A long ribbon mostly lives behind the camera (which
 * trails `CAM_BACK` back), and what does remain in front has to win a
 * per-object sort against the translucent water plane it lies on. A few
 * hundred units just behind the stern is the part you can actually see.
 */
export const TRAIL_POINTS = 20;
/** how far the boat travels between samples, in world units */
export const TRAIL_STEP = 26;
/** how far out from the centre line each ribbon starts, and ends */
export const TRAIL_SPREAD_NEAR = 26;
export const TRAIL_SPREAD_FAR = 82;
/** each ribbon's own half-width, at the stern and at the tail */
export const TRAIL_WIDTH_NEAR = 5;
export const TRAIL_WIDTH_FAR = 13;
/** clear of the surface, so it never z-fights the water */
export const TRAIL_LIFT = 3;

/**
 * The foam's colour at the stern and at the tail, as 0..255 triples.
 *
 * The wake is drawn OPAQUE and fakes its translucency with this ramp, which
 * is not the first choice but is the one that works. In the transparent pass
 * it is sorted per OBJECT against the water plane it lies on, and it loses
 * that comparison however the tie is broken — by depth bias, by z order, by
 * insertion — so the foam simply vanished under the river. Ramping toward the
 * river's own tone instead reads as foam thinning into the water, and it
 * draws every frame.
 *
 * `TRAIL_FOAM` is deliberately NOT pure white: even at the stern the wake
 * should look like disturbed water rather than paint.
 */
export const TRAIL_FOAM: [number, number, number] = [236, 252, 255];
export const TRAIL_RIVER: [number, number, number] = [116, 222, 240];

/**
 * How far toward the camera the ribbon sorts, in world units.
 *
 * The transparent pass orders per OBJECT, back to front. The water plane and
 * the wake both sit at `travelled`, and a tie is resolved by insertion order —
 * the water is built first, so it drew last and painted over the foam. This
 * biases the wake a couple of units nearer the camera so it sorts after the
 * surface it lies on. It is a SORT key only: the vertices compensate, so
 * nothing actually moves.
 */
export const TRAIL_SORT_BIAS = 2;

/**
 * Half-extents of each prop's `Box3d`, in world units.
 *
 * Sized to the part of the model that should actually stop a boat, not to its
 * drawn bounds: a carrot's leaves and a boulder's sloping shoulders overhang
 * the volume a hull can hit, and boxing those makes the course feel unfair.
 */
export const ROCK_HALF: [number, number, number] = [46, 34, 40];
/**
 * Half-extents of a drifting log, lying ACROSS the current.
 *
 * Wide and low: wide enough that steering around it is a commitment rather
 * than a twitch, low enough that a jump clears it comfortably. That is the
 * whole point of the second obstacle — a boulder asks you to steer, a log asks
 * you to jump, and the two want different things from the same run.
 */
export const LOG_HALF: [number, number, number] = [88, 26, 26];

/**
 * How far a drifting log swings either side of the heading it settled at, in
 * radians, and how fast.
 *
 * Small and slow. This is a log being worked on by a current, not a compass
 * needle — past about a fifth of a radian it stops reading as drift and starts
 * reading as something powered. The range is what keeps six of them from
 * looking like one animation played six times.
 */
export const LOG_SWAY_MIN = 0.07;
export const LOG_SWAY_MAX = 0.2;
export const LOG_SWAY_RATE_MIN = 0.35;
export const LOG_SWAY_RATE_MAX = 0.7;
export const CARROT_HALF: [number, number, number] = [22, 44, 22];

/** and the hull's own box — narrow, so a near miss reads as a near miss */
export const BOAT_HALF: [number, number, number] = [26, 30, 46];
