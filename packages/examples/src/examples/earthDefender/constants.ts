import { Vector3d } from "melonjs";

/**
 * melonJS — Earth Defender: tuning.
 *
 * Angular speeds are radians of arc per second, because that is what
 * movement on a sphere actually is. Multiply by {@link PLANET_R} for the
 * surface speed in world units if you want to compare them with a flat
 * game: the boost adds 0.55 rad/s, which over a 470 radius is 258 units/s
 * on top of the 329 it already had.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

const base = import.meta.env.BASE_URL;

export const SHIP_MODEL = "craft_speederA";
export const SHIP_ASSET_BASE = `${base}assets/multiMaterialMesh/`;
/**
 * The hunter: a second craft from the same pack, flown by the enemy.
 *
 * A different hull rather than the player's tinted red. The two are seen
 * together for whole seconds at a time, so the silhouette is what has to say
 * which is which; colour alone fails the moment one is in front of the lit
 * limb. The miner is the bulkiest of the four, which reads as the thing that
 * turns badly and keeps coming.
 */
export const HUNTER_MODEL = "craft_miner";
export const EARTH_MODEL = "earthGlobe";
export const EARTH_ASSET = `${base}assets/earthDefender/earth.glb`;
export const DOME_MODEL = "earthDome";
export const DOME_ASSET = `${base}assets/earthDefender/dome.glb`;
export const UFO_MODEL = "earthDefenderUfo";
export const UFO_ASSET = `${base}assets/earthDefender/ufo.glb`;
export const BOMB_MODEL = "earthDefenderBomb";
export const BOMB_ASSET = `${base}assets/earthDefender/bomb.glb`;
export const HUD_FONT = "FutureEarth";
/**
 * Shipped as the ORIGINAL `.ttf`, not re-encoded to woff2.
 *
 * dafont lists this as "100% free, free for commercial use", but the
 * `license.txt` inside the archive is what governs and it is CC BY-ND 3.0:
 * commercial use is fine, attribution is required, and NO DERIVATIVES.
 * Converting the file is a derivative, so it goes in untouched, and its
 * `license.txt` and `readme.txt` sit beside it because the readme requires
 * the archive's files to travel together.
 */
export const HUD_FONT_ASSET = `${base}assets/earthDefender/font/future-earth.ttf`;

/**
 * The asteroids: five shapes in one glTF, modelled as displaced icospheres
 * and exported as five nodes rather than five files.
 *
 * One rock repeated reads as one rock repeated, however it is tinted or
 * scaled; the eye finds the silhouette long before it finds the colour. So
 * there is a round one, an oblong one, a flat slab, a lumpy one and a
 * shard, each cratered by its own noise, and a spawn picks one at random
 * and gives it its own size on top.
 */
export const ROCK_MODEL = "earthDefenderRocks";
export const ROCK_ASSET = `${base}assets/earthDefender/asteroids.glb`;
/** how many shapes that file carries */
export const ROCK_SHAPES = 5;
/**
 * Rock, as a colour map and a normal map.
 *
 * The models are 320 triangles each, which is a silhouette and nothing
 * else: every bit of surface detail on them is these two textures. The
 * normal map is what makes the craters read, since it perturbs the shading
 * normal per fragment and the sun behind the camera then lights each
 * pit and rim separately.
 */
export const ROCK_ALBEDO = "rockAlbedo";
export const ROCK_ALBEDO_ASSET = `${base}assets/earthDefender/rock-albedo.png`;
export const ROCK_NORMAL = "rockNormal";
export const ROCK_NORMAL_ASSET = `${base}assets/earthDefender/rock-normal.png`;

/**
 * The globe everything happens on, and the one number the whole composition
 * is measured against.
 *
 * Every size and altitude below is a RATIO of it rather than an absolute,
 * so the scene keeps its proportions if the planet is ever resized. The
 * ratios themselves are taken off the arcade original this is styled after:
 * a globe leaving real margin in the frame, a craft about a twentieth of its
 * width, and a rock field standing clearly off the surface.
 */
export const PLANET_R = 470;
/**
 * Scene depth of the planet's centre; the camera sits at z = 0.
 *
 * Held as a ratio so the globe keeps the same share of the frame at any
 * radius: it subtends `asin(1 / PLANET_Z_RATIO)`, about 20 degrees here,
 * which leaves the sky visible around it.
 */
export const PLANET_Z_RATIO = 2.81;
export const PLANET_Z = PLANET_R * PLANET_Z_RATIO;

/**
 * Radius of the glass shell, authored into the model at this ratio. The
 * game has to know the number because everything that flies has to clear it.
 */
export const DOME_RATIO = 1.22;
export const DOME_R = PLANET_R * DOME_RATIO;

/*
 * How far off the surface each thing flies, all of it OUTSIDE the shell.
 *
 * The dome is what is being defended: the player patrols above it and the
 * rocks come down onto it. Flying inside would put the glass between the
 * guns and everything they are shooting at, and put the ship somewhere its
 * own collisions say it cannot be.
 */
/**
 * How high the craft flies above the glass.
 *
 * This number is not cosmetic: it is the CEILING of the rock field. Rocks
 * rest on the shell, so a rock of radius `r` reaches `DOME_R + 2r`, and
 * anything taller than the craft flies past OVER it, which reads as a
 * misplaced rock rather than as a big one. At the 0.09 this started at,
 * the band between the glass and the craft was 42 units, so any rock wider
 * than about 40 broke the picture, and "bigger asteroids" and "asteroids
 * below the ship" were a straight contradiction.
 *
 * Widening the band is what resolves it. The craft now flies a fifth of a
 * planet radius up, which is enough room for a boulder to sit under it.
 */
export const SHIP_ALT = PLANET_R * (DOME_RATIO + 0.44 - 1);
/**
 * The one altitude every CRAFT flies at, measured from the planet centre.
 *
 * The player and the hunter are the same kind of thing and must read as being
 * in the same layer of sky, so they share this rather than each carrying a
 * number. They did each carry one, and the numbers drifted: the player sat at
 * 780 and the hunter at 591, which is below the median rock top of 643, so
 * the hunter was flying INSIDE the boulder field while the player skimmed
 * over it.
 *
 * The value is not free. It is the ceiling of the rock field, so lowering it
 * shrinks the biggest asteroid that still fits underneath: at 780 a rock may
 * be 96 across, at 700 only 56, and at the collision shell itself only 2,
 * which is no field at all. Rocks today reach 94.6 and average 31.2, so the
 * cap genuinely binds and this number cannot come down without taking the
 * largest asteroids with it.
 */
export const CRAFT_ALT = PLANET_R + SHIP_ALT;
/**
 * How high the rock field may stack, measured from the planet centre.
 *
 * The same number as {@link CRAFT_ALT} and deliberately its own constant:
 * one is a question about where craft fly and the other about how big a rock
 * may be, and they only happen to agree because nothing should tower over
 * the things flying above it. Separating them is what lets either move.
 */
export const ROCK_CEILING = CRAFT_ALT;
/**
 * The bolts fly IN the rock field, not above it, and that is a collision
 * decision rather than a look.
 *
 * A bolt carries its collision sphere where it is drawn, so its altitude has
 * to be one from which it can reach every rock size. A rock of radius `r` has
 * its centre `r + ROCK_CLEARANCE` above the glass, so a bolt at radius `R`
 * meets it when `|R - (DOME_R + ROCK_CLEARANCE + r)| <= BOLT_HIT_RADIUS + r`.
 * The small rocks are the binding case, and they cap `R` at about 632; this
 * sits at 616, inside the band with room either side.
 *
 * Flying higher, as this did, meant the sphere had to be projected down onto
 * the shared shell to reach anything, which put it visibly off the streak in
 * the hitbox overlay. The craft has no such option (see SHIP_ALT) and is
 * still projected.
 */
export const BULLET_ALT = PLANET_R * (DOME_RATIO + 0.09 - 1);
/**
 * A rock does not get an altitude. It gets a CLEARANCE, in world units,
 * between the glass and its own lowest point, and works its altitude out
 * from its own size.
 *
 * One shared altitude was fine while every rock was the same size. Once
 * they were not, the same number put the big ones through the shell and
 * left the small ones hanging above it, because what was being held
 * constant was the centre and what has to be held constant is the gap.
 * Each rock is measured by its bounding SPHERE rather than its height,
 * since they tumble, and any vertex can be the one facing the glass.
 */
export const ROCK_CLEARANCE = 7;
/**
 * The shell the craft and every bolt collide on: the dome's radius plus a
 * rock's clearance.
 *
 * Nothing flies at this altitude. They collide here because a sphere test at
 * their TRUE altitudes could not reach a small rock; the reasoning in full is
 * beside `_hitShell` in the controller. It lives here so the hunter's shots
 * are tested on the same shell, against the same radii, as everything else.
 */
export const HIT_SHELL = DOME_R + ROCK_CLEARANCE;
/**
 * The largest radius a rock may be given, world units.
 *
 * Whatever fits between the glass and {@link ROCK_CEILING} with a clearance
 * at each end. Named rather than spelled out at the one place that caps rock
 * size, because it is also what tells everything else how big "big" is: a
 * rumble, a debris count or a camera shake that wants to scale with a rock
 * needs the top of the range, and deriving it twice is how the two drift.
 *
 * Works out to 96.4 today, against a measured largest rock of 94.6, so the
 * cap genuinely binds.
 */
export const ROCK_MAX_RADIUS = (ROCK_CEILING - DOME_R - ROCK_CLEARANCE * 2) / 2;
/**
 * Rocks ARRIVE. They start far out and fall in to the altitude they will
 * then keep, rather than appearing already in place.
 *
 * A rock that simply exists from one frame to the next has no story and,
 * worse, no warning: the player cannot see it coming. Falling in gives a
 * second or two of notice, gives the boulders the weight their size is
 * promising, and costs one interpolated number.
 *
 * Squared, not linear, so it accelerates the way something falling does.
 */
export const ROCK_ENTRY_MS = 2400;
export const ROCK_ENTRY_ALTITUDE = PLANET_R * 5;

/**
 * Scene depth the craft is drawn at: the front of its orbit, straight
 * between the camera and the planet centre. The sphere turns under the
 * player rather than the player moving over it, so this never changes, and
 * the backdrop's parallax is measured against it.
 */
export const SHIP_VIEW_Z = PLANET_Z - PLANET_R - SHIP_ALT;

/** the craft, about a twentieth of the globe's width */
export const SHIP_SIZE = PLANET_R * 0.09;
/** and the rocks, smaller again */
export const ROCK_SCALE = PLANET_R * 0.0377;
/**
 * How far either side of that a single rock is allowed to land, and how
 * often a much larger one turns up instead.
 *
 * Two bands rather than one wide range. A uniform range that reaches the
 * big sizes fills the sky with big rocks, and then "big" stops meaning
 * anything: the field has to be mostly ordinary for the occasional
 * boulder to read as an event. So a spawn is a normal rock unless it rolls
 * under the chance below, and then it is a very large one, worth several
 * bolts and worth steering around.
 */
export const ROCK_SCALE_MIN = 0.7;
export const ROCK_SCALE_MAX = 1.5;
export const ROCK_BIG_CHANCE = 0.18;
export const ROCK_BIG_MIN = 2.6;
export const ROCK_BIG_MAX = 3.6;

/** radians per second */
export const SHIP_TURN_RATE = 1.85;
export const SHIP_SPEED = 0.3;
export const SHIP_SPEED_BOOST = 0.55;

// ─── the hunter ────────────────────────────────────────────────────────
/**
 * How fast it flies, radians per second.
 *
 * Between the player's two speeds, and that is the whole design. Cruise is
 * {@link SHIP_SPEED} at 0.3, boost is 0.85 together: at 0.38 it GAINS on a
 * player who is merely flying and is hopeless against one who boosts. So the
 * answer to being hunted is the boost, which until now only ever meant
 * "reach the far side of a formation", and the cost of that answer is the
 * heat it builds. The first threat in this game that makes the player the
 * target rather than the dome.
 */
export const HUNTER_SPEED = 0.38;
/**
 * How fast it comes about, radians per second.
 *
 * Deliberately short of the player's {@link SHIP_TURN_RATE} of 1.85, so a
 * tight turn across its nose loses it ground. Being outrun is a resource
 * decision about heat; being out-turned is a piloting one, and a chase with
 * only the first is a chase the player cannot play well.
 */
export const HUNTER_TURN_RATE = 1.15;
/**
 * World size. Appreciably over the player's, because it is the heavier craft
 * and because it is seen from outside: the player's own craft is always at
 * the middle of the frame where the eye grants it presence, and a hunter
 * matched to it read as the smaller of the two.
 */
export const HUNTER_SIZE = SHIP_SIZE * 1.45;
/**
 * Bolts the bare HULL takes, once the shell is down.
 *
 * Two, not the seven it used to be: five of those seven now land on
 * {@link HUNTER_SHIELD_HITS} instead. The time to kill is unchanged; what
 * changed is that the shots are spent on two different things, and only the
 * last two are permanent.
 */
export const HUNTER_HP = 2;
/**
 * Hits its shell absorbs before the hull underneath is exposed.
 *
 * The shell is what makes the hunter a target the player has to COMMIT to.
 * Before it, seven bolts anywhere in seventeen seconds killed one, so there
 * was no wrong moment to shoot it and no reason to ever stop: chip at it
 * between bomb runs and it died eventually. The shell plus
 * {@link HUNTER_SHIELD_REGEN_PER_S} makes the fight a question of whether
 * the player can spare a continuous burst, which is the same question the
 * boost asks about heat, and it is asked while the thing is shooting back.
 */
export const HUNTER_SHIELD_HITS = 5;
/**
 * Quiet time before the shell starts coming back, milliseconds.
 *
 * Long enough that no sustained burst is ever interrupted by it, short enough
 * that a player who opens the shell and then leaves to deal with a bomb comes
 * back to a hunter that has to be opened again. Shorter than the player's own
 * {@link SHIELD_REGEN_DELAY_MS}, because this is the one being shot at, and a
 * regen the attacker never sees start is a regen that may as well not exist.
 */
export const HUNTER_SHIELD_REGEN_DELAY_MS = 2000;
/**
 * How fast the shell refills once it starts, full shells per second.
 *
 * Three and a third seconds from bare to whole, against the seventeen the
 * hunter is on station for, so a player who opens it and walks away has given
 * most of what they spent back.
 */
export const HUNTER_SHIELD_REGEN_PER_S = 0.3;
/** the shell quad, as a multiple of the hull it encloses */
export const HUNTER_SHIELD_SCALE = 2.1;
/**
 * The shell at full strength.
 *
 * Magenta, as far from the player's cyan ({@link SHIELD_FULL_COLOR}) as the
 * wheel goes. It was amber first, which is a different colour without being
 * an obviously hostile one: amber reads as a warning light on your own ship
 * as easily as on someone else's. Cold blue is the player's and hot magenta
 * is not, which wants no explaining and survives both shells overlapping
 * during a ram.
 *
 * Full strength is also where it matters. The shell spends most of its life
 * near the top of its range and the bottom of it lasts one flare, so the two
 * are told apart by the colour that is on screen the longest.
 */
export const HUNTER_SHIELD_FULL_COLOR = "#ff4de0";
/** the shell's own alpha at full strength, before the hit flare lifts it */
export const HUNTER_SHIELD_ALPHA = 0.46;
/** how long a bolt's flare lives on the shell, milliseconds */
export const HUNTER_SHIELD_FLASH_MS = 340;
/**
 * How far toward white the shell goes at the peak of a hit, 0 to 1.
 *
 * The flash has to move the COLOUR, because driving the shader harder cannot
 * produce one. Its tone map is `1 - exp(-uColor * energy)`, so each channel
 * saturates at a rate set by that channel's own value: on a magenta shell the
 * green channel is at 0.30, and at the energy a hit produces it reaches 0.62
 * while red is already at 0.96. The result is a brighter magenta. Reaching
 * white through energy alone would take three times as much, which blows the
 * rim out into a solid disc.
 *
 * Not all the way to 1, so the shell still reads as the hunter's at the
 * instant it is struck rather than becoming an anonymous white ring.
 */
export const HUNTER_SHIELD_FLASH_WHITEN = 0.88;
/** the shell's alpha at the peak of a hit, against its resting 0.46 */
export const HUNTER_SHIELD_FLASH_ALPHA = 1;
/** tone-map exposure for the shell, a little under the player's */
export const HUNTER_SHIELD_EXPOSURE = 1.35;
/**
 * How long the white flash a hit leaves burns for, milliseconds.
 *
 * The same device the rocks use, and for the same reason: a shot that
 * neither kills nor shows anything reads as a miss. Seven hits is a long
 * exchange to run on faith.
 */
export const HUNTER_FLASH_MS = 190;
/** the hit flash, hot and white so it reads against the hull's own red */
export const HUNTER_FLASH_HIT: [number, number, number] = [3.4, 3.4, 3.6];
/**
 * And the hot end the flash climbs to as the hits mount, red like the rocks'.
 * Reached on the hit that leaves one, not on the kill: the kill is hidden
 * under its own burst on the frame it lands, so a colour saved for it would
 * never be seen.
 */
export const HUNTER_FLASH_LAST: [number, number, number] = [2.0, 0.3, 0.12];
/**
 * How far above the shell it comes in from, as a multiple of the craft's
 * own flight radius, and how long the descent takes.
 *
 * It arrives from SPACE rather than fading in on the surface: a thing that
 * appears already standing on the glass has no travel for the eye to follow,
 * and the player needs the second or so of warning to know a chase is
 * starting. The same reasoning as the bombs, which are dropped rather than
 * placed.
 */
export const HUNTER_DROP_FROM = 1.18;
export const HUNTER_DROP_MS = 1150;

/**
 * Its gun: how often it fires, how far a shot reaches, and how fast.
 *
 * SLOWER than the player's bolt on purpose. The player's is a hitscan-feeling
 * streak because aiming is their whole job; the hunter's has to be dodgeable
 * by a craft that is already running away, often with the shot coming from
 * behind where it cannot be seen leaving. A shot that cannot be avoided is
 * not a threat, it is a tax.
 */
export const HUNTER_FIRE_INTERVAL_MS = 260;
/**
 * Playback rate for the hunter's gun, against the player's own sample.
 *
 * The same five laser samples, pitched down. They are the only guns in the
 * game and they should sound like the same KIND of thing, but the player has
 * to be able to tell incoming fire from their own without looking: a fifth
 * down is far enough apart to never be confused and close enough to still be
 * a laser.
 *
 * Below 1 also means longer, so the hunter's shots read as heavier.
 */
export const HUNTER_LASER_RATE = 0.67;
/** quieter than the player's: it is further away and it fires far more */
export const HUNTER_LASER_VOLUME = 0.55;
export const HUNTER_BOLT_SPEED = 1.05;
export const HUNTER_BOLT_LIFE_MS = 1700;
/**
 * How close it has to be before it will fire, radians round the globe.
 *
 * Without it the hunter shoots at the player's back from across the globe and
 * the shots arrive with no warning at all. The bearing half of this pair used
 * to live here too, as `HUNTER_FIRE_CONE`; it is now
 * {@link HUNTER_CANNON_TRAVERSE}, which gates on where the GUNS can point
 * rather than on where the hull happens to be facing.
 */
export const HUNTER_FIRE_ARC = 1.15;
/** the shot's own size and colour, read against the player's cyan */
export const HUNTER_BOLT_W = 14;
export const HUNTER_BOLT_H = 70;
export const HUNTER_BOLT_CORE = "#ffe0ff";
export const HUNTER_BOLT_EDGE = "#ff2ad8";
export const HUNTER_BOLT_LEN = PLANET_R * 0.055;
export const HUNTER_BOLT_WIDTH = PLANET_R * 0.016;
/**
 * How near a shot has to pass the craft to land, as a radius on `HIT_SHELL`
 * met against the craft's own. Half the streak's length, which is the
 * player's rule for their bolt: it connects when the streak touches rather
 * than when its centre arrives.
 */
export const HUNTER_BOLT_HIT_RADIUS = HUNTER_BOLT_LEN / 2;
/** how many can be in the air at once */
export const HUNTER_BOLT_POOL = 26;

/*
 * Ramming: how close before the hulls touch, and how long before it can
 * touch again.
 *
 * Without this the hunter flew straight THROUGH the craft, which besides
 * looking wrong let it fire at an arc of nearly zero, an undodgeable
 * point-blank hit that contradicts the whole reason its bolt is slow. A
 * contact now costs the same as a rock's, and shoves the hunter back off
 * its target so the two cannot grind through each other frame after frame.
 *
 * The cooldown is longer than the craft's own invulnerability window so one
 * pass is one hit, however long the two stay overlapped.
 */
/**
 * The closest it comes before breaking off, as an arc.
 *
 * It used to steer straight at the craft, so the only two states it ever had
 * were "coming at you" and "on top of you". A pursuer whose end state is
 * contact is answered by flying away from it, which is not flying, and it
 * made the ram the usual outcome rather than the punishment for standing
 * still.
 *
 * It is where the break STARTS, not how close it ends up. A craft that always
 * moves cannot stop, so it keeps closing for as long as the turn takes: at
 * {@link HUNTER_SPEED} over {@link HUNTER_TURN_RATE} it comes about on a
 * circle 195 units wide, and breaking at 0.48 has it pass between 157 and 264
 * units out, measured against a stationary craft over three runs.
 *
 * That is two and a half to four hull lengths, and a bolt at
 * {@link HUNTER_BOLT_SPEED} crosses it in half a second, which is the window
 * the player gets to not be there. Closer than this is the player's own
 * doing: fly at it and the ranges collapse, which is what {@link
 * HUNTER_RAM_ARC} is for.
 */
export const HUNTER_STANDOFF_ARC = 0.48;
/**
 * How far out it gets before turning back in, as an arc.
 *
 * Together with {@link HUNTER_STANDOFF_ARC} this is an attack run, and the
 * two numbers are a hysteresis band: one range test with one threshold would
 * flip between closing and breaking every frame at the boundary.
 *
 * Only 0.2 rad outside the break, because the break is expensive: the same
 * wide turning circle that makes it overshoot also makes reversing slow, and
 * at 0.9 it spent three quarters of its visit pointing away from the player
 * and got seven shots off in thirty seconds. The band has to be wide enough
 * to be hysteresis and no wider.
 *
 * It has to be a run and not a holding orbit, because the gun is the nose.
 * A bolt leaves along the hunter's own heading, so a craft keeping station
 * on a circle is a craft pointing ninety degrees off the only thing it wants
 * to shoot: when it orbited it got five shots away in thirty-two seconds, and
 * widening the firing cone to let it shoot off the beam would only have made
 * it fire where the player was not. Nose-on while it closes means its shots
 * are aimed at the craft and its approach is the dangerous half; the break is
 * the half the player gets to use.
 */
export const HUNTER_REATTACK_ARC = 0.9;
/**
 * How far off dead astern it curves on the way out, radians.
 *
 * Zero would have it reverse straight back down the line it came in on, a
 * yo-yo on one axis that a player answers once and then always. Off to the
 * side it leaves on an arc, so each run comes in from a different bearing.
 *
 * It must stay UNDER a right angle. At exactly one it would fly a tangent
 * and circle the player at whatever range the break began, never reaching
 * {@link HUNTER_REATTACK_ARC} and never turning back in. At 1.0 rad it opens
 * the range at a little over half its speed and spends the rest going round.
 */
export const HUNTER_BREAK_LEAD = 1.0;
/**
 * How far out it puts the point it runs to, radians.
 *
 * Comfortably past {@link HUNTER_REATTACK_ARC}, because it is a direction to
 * commit to and not a destination to arrive at: the break ends on the range
 * test, and a waypoint close enough to actually reach would have the hunter
 * turn back the moment it got there.
 */
export const HUNTER_BREAK_ARC = 1.1;
/**
 * How far past its own break a hunter may be before it counts as shaken off.
 *
 * Covers the turn at the end of a break, which keeps opening the range after
 * the hunter has already decided to come back, plus the arc a fleeing player
 * adds during {@link HUNTER_FADE_MS}.
 */
export const HUNTER_LOST_MARGIN = 0.3;
/**
 * Where the dome finally hides the hunter from the camera, radians.
 *
 * Computed from the real geometry rather than guessed: the camera sits at
 * `PLANET_Z` (2.81 R) and the hunter flies at `HUNTER_ALT` (1.66 R), so the
 * sightline between them first passes inside `DOME_R` at this arc. The planet
 * itself takes over at 2.12.
 *
 * The older figures of 1.35 and 1.86 still quoted nearby were measured when
 * the hunter flew at 591 rather than 780, and are wrong for the current
 * altitude. Note this is the only arc at which it is reliably unseen: the
 * frame is wider than it is tall, so going sideways it stays on screen the
 * whole way out.
 */
export const HUNTER_DOME_ARC = 1.87;
/**
 * How long it must be continuously out of sight before it fades, ms.
 *
 * A single frame off the edge is not "gone". Measured during a hunt, the
 * hunter is outside the frame 20 to 34 percent of the time in the 0.5 to 1.5
 * radian band, because it leaves the TOP of the view at 0.49 while never
 * leaving the sides at all. Fading on the first such frame finished a whole
 * departure in 0.3 seconds, and a player who panned back inside the 700ms
 * fade caught the tail of it, which is the thing this all started with.
 *
 * Long enough to outlast a blink past the edge, short enough that a real
 * departure does not hang around once it is behind the glass.
 */
export const HUNTER_UNSEEN_MS = 400;
/**
 * How far outside the frame counts as out of sight, pixels.
 *
 * The test is against the hull's CENTRE, so a craft whose middle has just
 * crossed the edge still has half of itself showing. About one hull at the
 * distance it flies.
 */
export const HUNTER_UNSEEN_MARGIN = 64;
export const HUNTER_RAM_PUSH = 0.16;
/**
 * How long the two take to come apart, milliseconds.
 *
 * The push used to land in ONE frame: 95 units for the hunter and 44 for the
 * craft, 139 units of separation between two consecutive frames, which is not
 * a bounce but a cut. Spread over a sixth of a second and eased out, the same
 * distance reads as both craft being thrown off each other.
 *
 * Short on purpose. It is a shove, not a stun, and a player who cannot steer
 * for half a second after brushing an enemy has had the controls taken away.
 */
export const HUNTER_RAM_PUSH_MS = 170;
export const HUNTER_RAM_COOLDOWN_MS = 1400;

/**
 * How high it flies: the player's altitude, because it is the same kind of
 * thing and has to read as being in the same sky.
 *
 * It flew lower for a while, just clear of the glass, because at the shared
 * height it looked like it was hovering rather than hunting. That turned out
 * to be the wrong fix for the right complaint. Rock tops run to a median of
 * 643 and a maximum of 770, so a hunter at 591 was not skimming the field,
 * it was INSIDE it, flying under the boulders the player flies over.
 *
 * Lowering it cannot be revisited on its own, either. {@link CRAFT_ALT} is
 * the ceiling of the rock field, so anything that brings craft down takes the
 * biggest asteroids with it, and both craft have to come down together or
 * they stop reading as peers.
 */
export const HUNTER_ALT = CRAFT_ALT;
/** debris a kill throws: a rock's terminal count, for a craft that took seven hits */
export const HUNTER_DEBRIS = 54;
/**
 * The kill, in stages, in milliseconds from the hit that ends it.
 *
 * A rock gets one burst because a rock is a lump. This is a crewed craft that
 * took seven hits and shot back the whole time, and one puff of debris read
 * as the shot having missed. It comes apart instead: the shell fails first,
 * then the hull goes, then the fuel.
 *
 * Staged rather than simultaneous because everything on the same frame is one
 * event however many particles are in it. A fifth of a second between beats
 * is enough to read as a sequence and short enough to still be one death.
 */
export const HUNTER_DEATH_SHELL_MS = 0;
export const HUNTER_DEATH_HULL_MS = 110;
export const HUNTER_DEATH_FUEL_MS = 260;
/** the shell letting go: a bright ring of its own colour, no debris */
export const HUNTER_DEATH_SHELL_BURST = 30;
/** the hull coming apart, in its own plating */
export const HUNTER_DEATH_HULL_BURST = 46;
/** the fuel going up, thrown hardest and living longest */
export const HUNTER_DEATH_FUEL_BURST = 38;
/** the plating, which is the hull's own tint rather than rock brown */
export const HUNTER_DEATH_HULL_TINT = "#ffb49a";
/** what the fuel burns as */
export const HUNTER_DEATH_FUEL_TINT = "#ffd27a";

/**
 * Its reactor trail: the same ribbon the player's craft lays, shorter and
 * narrower because the hunter is the one being watched rather than the one
 * doing the watching, and a long streak on it reads as the player's own.
 */
export const HUNTER_TRAIL_POINTS = 18;
export const HUNTER_TRAIL_LIFETIME = 300;
export const HUNTER_TRAIL_STEP = PLANET_R * 0.004;
export const HUNTER_TRAIL_WIDTH = PLANET_R * 0.006;
/**
 * The miner's two cannons, in its own model units.
 *
 * Measured the same way as the reactors below. Two barrels run along the nose
 * spanning x 0.40..0.60 and -0.60..-0.40, ending on the front face at
 * z = 1.30, so their centres are 0.50 either side of the centre line and
 * their muzzles are half a hull length ahead of the middle.
 */
const MINER_LONGEST = 2.6;
const MINER_CANNON_X = 0.5;
/** how far apart the two barrels sit, as an arc either side of the hull */
export const HUNTER_CANNON_SPREAD =
	(HUNTER_SIZE * (MINER_CANNON_X / MINER_LONGEST)) / HUNTER_ALT;
/**
 * How far ahead of the hull's middle the muzzles are, as an arc.
 *
 * Half a hull, the same number as the reactors behind it, because the model
 * runs from one face to the other and normalization puts its longest axis in
 * `[-0.5, 0.5]`. A bolt born at the centre instead was drawn emerging from
 * the middle of the craft, and with two of them it also put both on one
 * spot.
 */
export const HUNTER_CANNON_FORWARD = (HUNTER_SIZE * 0.5) / HUNTER_ALT;

/**
 * The miner's two reactors, in its own model units.
 *
 * `craft_miner.obj` measures 1.80 x 0.70 x 2.60, and `Mesh` normalization
 * fits the LARGEST of those into a unit cube before scaling by `width`, so
 * one hull length is 2.60 model units and nothing else is. Its two nozzle
 * boxes sit on the rear face, spanning x 0.30..0.50 and -0.50..-0.30 at
 * z -1.30..-1.10, so their mouths are at the very back and their centres
 * are 0.40 either side of the centre line.
 *
 * Written down because the two constants below are derived from them rather
 * than dialled in: eyeballed, the single ribbon came out of the middle of the
 * hull in both axes, which on this model is the one place at the back with no
 * engine in it.
 */
const MINER_NOZZLE_X = 0.4;
/**
 * How far behind the hull the ribbons are laid, as an arc.
 *
 * Half a hull length, which is where the rear face is: normalization puts the
 * longest axis in `[-0.5, 0.5]`, and on this model the longest axis is the
 * length. As an arc because that is what `advance` takes, and at
 * {@link HUNTER_ALT} because that is the radius it is flying.
 */
export const HUNTER_TRAIL_OFFSET = (HUNTER_SIZE * 0.5) / HUNTER_ALT;
/**
 * How far apart the two streaks sit, as an arc either side of the hull.
 *
 * The miner has TWO reactors at the back, so one ribbon down the centre line
 * came out of the gap between them. `turn` ninety degrees then `advance` by
 * this moves exactly this arc sideways, so the gap between the streaks is
 * twice it, and it lands on the nozzles rather than near them.
 */
export const HUNTER_TRAIL_SPREAD =
	(HUNTER_SIZE * (MINER_NOZZLE_X / MINER_LONGEST)) / HUNTER_ALT;
/**
 * White at the nozzle falling to nothing, so the tint carries the colour.
 * A coloured ribbon tinted again comes out muddy: the same rule the craft's
 * own exhaust follows.
 */
export const HUNTER_TRAIL_GRADIENT = [
	"#fff4e8",
	"#ffffffa0",
	"#ffffff00",
] as const;
/** what breaking one is worth, before the multiplier */
export const HUNTER_SCORE = 250;
/** the arc a bolt has to touch to hit it */
export const HUNTER_HIT_RADIUS = PLANET_R * 0.055;
/**
 * How far round the globe it enters from.
 *
 * Far enough to be a shape growing in the distance rather than a hit, and
 * close enough to be ON SCREEN while it does. At 1.7 it arrived from 97
 * degrees round the globe, outside the frame entirely, so the descent that
 * exists to warn the player happened where they could not see it, and the
 * hunter seemed to rise out of the ground instead.
 */
export const HUNTER_SPAWN_ARC = 1.25;
/** the gap between one leaving and the next arriving, milliseconds */
export const HUNTER_IDLE_MIN_MS = 9000;
export const HUNTER_IDLE_MAX_MS = 16000;
/**
 * How far the player may get before the hunter gives up, as an arc.
 *
 * A plain range test for a player who has genuinely outrun it, and nothing
 * to do with where the fade happens: {@link HUNTER_DEPART_MAX_MS} owns that
 * now, because a hunter that gives up FLIES OFF before it fades.
 *
 * The occlusion figures that used to be quoted here, 1.35 for the glass and
 * 1.86 for the planet, were measured when the hunter flew at 591. It flies
 * at `HUNTER_ALT`, 780, so the real numbers are {@link HUNTER_DOME_ARC} and
 * 2.12. Keeping the old ones made this read as if giving up at 1.25 kept the
 * fade on the near side of both, which was the reasoning behind turning the
 * hunter back toward the player as it left. At the current altitude that
 * aimed it at the one place the fade was certain to be watched.
 *
 * DERIVED, not chosen, and the fixed 1.2 it replaces was the bug. The text
 * below assumed the arc only ever opens that far because the player outran
 * it. It does not: the hunter breaks off at {@link HUNTER_STANDOFF_ARC} and
 * runs {@link HUNTER_BREAK_ARC} further out by design, so it opens the range
 * itself, and the turn at the far end carries it further still. Measured at
 * 1.44 radians against a player who never touched the controls, which is
 * past 1.2, so the hunter read its own break as having been shaken off and
 * quit. Two visits out of two in a 60 second idle test ended that way and
 * none ran its hunt timer out, which is why a player sitting in the open was
 * never in any danger, and why the hunter kept fading out near the limb.
 *
 * Built from the two arcs it is supposed to sit outside of so retuning the
 * break cannot silently reintroduce that.
 *
 * The number has to leave room for the fade as well as the fight. Over
 * {@link HUNTER_FADE_MS} a fleeing player opens another 0.12 radians, which
 * is why giving up has to turn the hunter back toward them: left on a break
 * it would be flying away at the same time, more than doubling that, and the
 * fade would finish inside the glass. That is exactly what it used to do, and
 * it spent 57% of every departure sinking into the planet.
 */
export const HUNTER_LOST_ARC =
	HUNTER_STANDOFF_ARC + HUNTER_BREAK_ARC + HUNTER_LOST_MARGIN;
/**
 * How long it may be out there before it gives up, milliseconds.
 *
 * Leaving is the honest answer rather than lifting it clear or capping the
 * range. The arc only grows that far because the PLAYER outran it, the boost
 * is the designed answer to being chased, and a pursuer that has been shaken
 * off should break off.
 *
 * Half a second of grace, so one long break does not end a visit that is
 * still a fight.
 */
export const HUNTER_LOST_MS = 500;
/**
 * The longest a departure may take before it fades wherever it is.
 *
 * A hunter that gave up used to start fading on the spot, which at a measured
 * 0.58 to 0.74 radians is the middle of the player's view: it dissolved in
 * their face. It flies off first now and fades only once it is genuinely out
 * of sight, which needs a bound, or a player boosting after it would hold it
 * on screen for ever.
 *
 * DERIVED from the two legs that departure actually is: one half turn at
 * `HUNTER_TURN_RATE`, then the arc to where the dome hides it at
 * `HUNTER_SPEED`. Only a player spending their whole heat bar to chase it
 * sees the bound, and what they get for that is a free shot at a tail that is
 * not shooting back.
 */
export const HUNTER_DEPART_MAX_MS =
	(Math.PI / HUNTER_TURN_RATE + HUNTER_DOME_ARC / HUNTER_SPEED) * 1000;
/**
 * How long it hunts before giving up and leaving.
 *
 * Bounded so a player who simply cannot shake it is not hounded for the whole
 * run; long enough that outrunning it costs most of a heat bar.
 */
export const HUNTER_HUNT_MS = 17000;
/** how long the arrival and the departure take to fade, milliseconds */
export const HUNTER_FADE_MS = 700;
/**
 * Its hull colour, so it reads as hostile at a glance. Light on purpose,
 * because `tint` MULTIPLIES.
 *
 * A saturated `#ff6a4d` cut green to 42% and blue to 30% of whatever the
 * material already was, and the miner's own palette is mid-grey to begin
 * with, so the craft came out nearly black and read as a silhouette rather
 * than a ship. The hostile colour has to be carried by a tint that mostly
 * leaves the lighting alone, with the emissive below doing the rest.
 */
export const HUNTER_TINT = "#ffd0bf";
/**
 * A constant warm glow, so it is legible on the planet's night side.
 *
 * It spends half of every lap in shadow, where a lit-only hull is invisible
 * exactly when it is most dangerous. Small enough that the hit flash still
 * reads as a flash against it.
 */
export const HUNTER_EMISSIVE: [number, number, number] = [0.34, 0.1, 0.05];
export const HUNTER_SPECULAR: [number, number, number] = [0.85, 0.8, 0.8];
export const HUNTER_SHININESS = 34;

// ─── attitude ──────────────────────────────────────────────────────────
/**
 * How far the craft leans, in radians, and how quickly it gets there.
 *
 * A ship that changes direction without changing attitude reads as a
 * cursor rather than as something flying: the bank is most of what sells
 * the turn, and the pitch is what makes throttle legible at a glance when
 * the speed itself is hard to judge over a featureless ocean.
 */
export const SHIP_BANK = 0.62;
export const SHIP_PITCH = 0.3;
/** approach rate for both, per second */
export const SHIP_ATTITUDE_DAMP = 7.0;
/**
 * How fast a rock turns about its own up, in radians per second, either way.
 *
 * Slow. A rock crossing the screen over several seconds should turn visibly
 * but not spin: this is a boulder adrift, not a thrown object. Signed, so
 * roughly half of them turn each way and a field of them never looks
 * choreographed.
 *
 * A yaw rather than a tumble, because the ground shadow reads the caster's
 * horizontal columns and a tipped rock has none; see `Drifter.spinPhase`.
 */
export const ROCK_SPIN_MIN = 0.12;
export const ROCK_SPIN_MAX = 0.55;

export const ROCK_SPEED_MIN = 0.1;
export const ROCK_SPEED_MAX = 0.19;
/** how sharply a drifter corrects toward the player, radians per second */
export const ROCK_STEER_RATE = 0.22;
export const BULLET_SPEED = 1.95;

// ─── the guns ──────────────────────────────────────────────────────────
/**
 * The bolt as a drawn streak: a long thin capsule, not a dot.
 *
 * A round bolt at this speed reads as a bead being carried along. The eye
 * gets the direction of travel from the shape itself when the shape has a
 * long axis, which is the whole difference between a pellet and a laser,
 * and it is why the sprite is turned to face where the bolt is going.
 */
export const LASER_TEX_W = 24;
export const LASER_TEX_H = 128;
export const LASER_WIDTH = PLANET_R * 0.018;
export const LASER_LENGTH = PLANET_R * 0.07;
/**
 * How long a bolt is while the LANCE prize is running.
 *
 * The lance behaves differently, passing through what it hits instead of
 * stopping at the first thing, and a prize the player cannot see is one
 * they have to infer from the body count. Length is the honest cue for it:
 * a shot that runs through a line of rocks should LOOK like something that
 * runs through a line of rocks.
 *
 * Roughly twice the normal bolt, which is far enough to read at a glance
 * and short enough to still be a bolt rather than a continuous beam. Read
 * from the bolt's own `pierces`, set at the muzzle, so one already in the
 * air does not shrink the instant the window closes behind it.
 */
export const LANCE_LENGTH = PLANET_R * 0.155;
/**
 * White-hot down the middle, reddish orange in the sheath.
 *
 * The core stays near white on purpose: a bolt coloured all the way
 * through reads as a painted stick, and it is the hot centre against the
 * cooler flank that reads as something burning.
 */
export const LASER_CORE = "#ffc86e";
export const LASER_EDGE = "#ff2f04";

/**
 * The pool of light each bolt throws down onto the glass.
 *
 * Sized against the bolt's own altitude above the shell: a light source
 * this close spills about as far as it is high, and a pool much wider than
 * that reads as a projected decal rather than as something lit.
 */
export const GLOW_SIZE = PLANET_R * 0.18;
export const GLOW_TINT = "#ff6a22";
export const GLOW_ALPHA = 0.85;
/** the shader asset, compiled at load time and cloned once per bolt */
export const GLOW_SHADER = "earthDefenderDomeGlow";

// ─── HDR ───────────────────────────────────────────────────────────────
/**
 * How far above the display's range each emitter is driven before it is
 * squeezed back into it, and how much harder its own bright parts are
 * driven than its flanks.
 *
 * The convention every emitter here follows, and the one the notes in
 * `shield.ts`, `shockwave.ts` and `domeGlow.ts` mean when they name it:
 * build the energy with NO ceiling, then squeeze it back with
 * `1 - exp(-energy * exposure)`. A sum that runs past one does not clip
 * flat, it approaches white asymptotically, so a core saturates while its
 * flanks keep their colour. `exposure` is how hard that emitter is driven.
 * The camera carries no tone curve of its own, deliberately; see the note
 * beside its effects in `ExampleEarthDefender.tsx`.
 *
 * The bolt gets the harder core: it has a filament down the middle that
 * should read as white-hot against a red sheath. The shield is a shell of
 * gas with no filament, so it lifts more evenly.
 */
export const HDR_BOLT_EXPOSURE = 1.9;
/** and the pool on the glass, which is shaped by its own shader */
export const GLOW_EXPOSURE = 1.25;

/*
 * The viewport pass that lets those highlights spill onto what is around
 * them, which is the half that makes them read as light rather than as
 * bright paint.
 *
 * The threshold is deliberately above what the planet's lit surface
 * reaches and below what the emitters do, so the bloom is theirs and the
 * terrain does not wash out with them.
 */
/**
 * Where the bloom starts.
 *
 * One value for both pipelines. It was briefly split, on the theory that with
 * headroom the threshold could sit AT 1 and mean "everything above display
 * white blooms" while ordinary lit surfaces never did. That reads well and
 * looked worse: the planet's specular and the HUD's neon both sit around 1 and
 * stopped blooming, which took the highlights out of the picture. The scene
 * was authored against this number, so it keeps it.
 */
export const BLOOM_THRESHOLD = 0.74;
export const BLOOM_INTENSITY = 0.8;
/**
 * Halo reach in texels. `BloomEffect` puts its inner ring here and its outer
 * one at twice this, which is where the pass this replaced sampled (3 and 8).
 */
export const BLOOM_RADIUS = 4;
/*
 * There is deliberately no tone curve here. This scene's look is built on the
 * clamp, and a curve maps 1 to less than 1, so grading it turns the clipped
 * white specular matte and flattens the picture. See the note beside the
 * camera's effects in `ExampleEarthDefender.tsx`.
 */

/**
 * The collision radii, each meeting the rock's OWN radius so a boulder is
 * the bigger target it looks like.
 *
 * The bolt's is half its own length, so it connects when the streak
 * touches rather than when its centre arrives. The craft's is its shield
 * bubble, which is the part of it a rock actually meets.
 */
export const BOLT_HIT_RADIUS = PLANET_R * 0.035;
export const SHIP_HIT_RADIUS = PLANET_R * 0.05;
/**
 * The arc a bolt has to come within to count as a hit on the craft.
 *
 * The same sum `flyBolts` tests, stated once so the FIRING side can aim by
 * the geometry it is actually judged against. Both radii sit on the shared
 * collision shell, so dividing by it turns a distance into the arc the
 * hunter steers and shoots in.
 */
export const HUNTER_HIT_ARC =
	(SHIP_HIT_RADIUS + HUNTER_BOLT_HIT_RADIUS) / HIT_SHELL;
/**
 * How far off the nose the cannons can be brought to bear, radians.
 *
 * The guns used to be welded to the hull: a bolt left along
 * `this.frame.heading` and nothing else, so the hunter could only shoot at
 * what it happened to be pointed at. A craft flying an attack run has its
 * nose on the player for a fraction of each pass, so it fired NEAR them by
 * design and the cone only chose how near. Watching it, the shots plainly do
 * not come at you, which is what was reported twice.
 *
 * A little traverse fixes that without turning the craft into a turret: it
 * still has to fly a pass to bring the guns into their arc, and outside the
 * arc it cannot shoot at all.
 */
export const HUNTER_CANNON_TRAVERSE = 0.45;
/**
 * How wide it scatters, in multiples of {@link HUNTER_HIT_ARC}.
 *
 * Aiming exactly would land every volley on a player holding still, which is
 * an execution rather than a fight. The scatter is stated as LATERAL error at
 * whatever range the shot is taken, not as an angle, because that is what
 * decides a hit: an angle that is harmless across the globe is a certain miss
 * from close in. At 1.5 roughly half of a volley lands on a stationary craft
 * and the rest walk past it, which reads as a gunner rather than as a dice
 * roll.
 */
export const HUNTER_AIM_SCATTER = 1.5;
/**
 * How much of the lead the hunter actually takes, 0 to 1.
 *
 * 1 aims at the exact intercept, which against a craft holding a straight
 * course is a hit every volley. Short of 1 it trails the target the way a
 * gunner who has misjudged the speed does, so flying straight is punished
 * and flying straight FAST is punished less than it should be, which is the
 * right way round: the boost is supposed to be an escape.
 */
export const HUNTER_LEAD = 0.85;
/**
 * How far off its last known bearing a hunter may come back, radians.
 *
 * A visit used to end wherever the hunter happened to be and the next one
 * opened on a bearing drawn fresh at random, so the craft vanished on one
 * side of the globe and returned from another with nothing connecting the
 * two. Measured over three cycles: 0.10, 2.39 and 0.86 radians of unexplained
 * hop, the middle one a third of the way round the planet. Olivier: it
 * "jumps to some location instead of keeping around the earth".
 *
 * Returning on roughly the bearing it left by reads as one craft circling and
 * coming back, which is what it is. The spread keeps it from being a metronome
 * and covers the first arrival of a run, where there is no last bearing yet.
 */
export const HUNTER_RETURN_SPREAD = 0.9;
/**
 * What a bolt landing on the craft looks and feels like.
 *
 * A bolt used to drain the shield and do nothing else: the drain goes through
 * the shared path a rock takes, but a rock's IMPACT, the burst and the shake
 * and the ring on the shell, lives in the rock's own handler, so being shot
 * registered as a number changing in the corner. Olivier: being hit by a bolt
 * does not flash or freeze "like when being hit by an asteroid".
 *
 * Smaller than a rock's, because a bolt is not a boulder: the shake sits
 * between the ice pickup's 4 and a collision's 11, and the flash is the
 * shield's own colour rather than an explosion's, so it reads as the bubble
 * taking it rather than as the hull being holed.
 */
export const BOLT_IMPACT_SHAKE = 5.5;
export const BOLT_IMPACT_SHAKE_MS = 180;
export const BOLT_IMPACT_BURST = 7;
export const BULLET_LIFE_MS = 2000;
export const FIRE_INTERVAL_MS = 190;
/**
 * The gun a radioactive rock hands over, and for how long.
 *
 * Three bolts in a fan rather than a faster single one: the fan is visible
 * the instant it starts, from the shape of what leaves the ship, where a
 * shorter interval has to be noticed from the rhythm. It also plays
 * differently rather than merely more, since a fan clears a spread of rocks
 * and is wasted on one.
 *
 * Here with the gun rather than with the rock that grants it, because
 * `BOLT_POOL` below is sized from it and a constant cannot be read before
 * it is declared.
 *
 * Ten seconds, not the eight it ran at. Every prize shares this window,
 * including the ward, and at eight it tended to expire just as the next
 * saucer arrived, so the thing a player crossed the field to collect was
 * gone before the moment it was wanted for. A hard game still has to make
 * its rewards worth going after.
 */
export const UPGRADE_MS = 10000;
export const UPGRADE_BOLTS = 3;
/** the angle between adjacent bolts in the fan, radians */
export const UPGRADE_SPREAD = 0.14;

/**
 * How many bolts can exist at once, and therefore how many of everything a
 * bolt owns: the streak, the pool of light, and the two shader clones that
 * shape them.
 *
 * Pooled rather than built per shot. Each carries compiled programs of its
 * own, and building one inside `fire()` is the kind of thing that shows up
 * as a stutter on the first volley and then never again, which is the
 * hardest kind to find. Derived rather than picked, so it cannot fall
 * behind a faster gun or a longer-lived bolt: a bolt lives
 * `BULLET_LIFE_MS` and one leaves every `FIRE_INTERVAL_MS`, plus a little
 * slack for the frame the two overlap on.
 */
export const BOLT_POOL =
	Math.ceil(BULLET_LIFE_MS / FIRE_INTERVAL_MS) * UPGRADE_BOLTS + 2;

export const ROCK_START_COUNT = 12;
export const ROCK_SPAWN_INTERVAL_MS = 1050;
export const ROCK_MAX = 30;
/** a drifter never spawns nearer the player than this, in radians */
export const ROCK_SPAWN_MIN_ARC = 1.15;
/**
 * What share of rocks are seeded on the player's OWN TRACK.
 *
 * `ROCK_SPEED_MAX` is 0.19 radians a second and `SHIP_SPEED` is 0.3, so a
 * rock can never run the craft down: it homes, but it is always losing
 * ground. The only rock that can reach a player flying straight is one the
 * player flies INTO, and seeding uniformly over a sphere leaves that to luck.
 * A craft that holds its course was therefore close to safe from the field,
 * which is the other half of "if I stay in the middle I never die" — the
 * first half being the shield regenerating between hunter visits.
 *
 * Putting a share of them on the great circle the craft is already flying
 * makes holding a course the dangerous thing it should be, without touching
 * a single speed or making the rocks cheat.
 */
export const ROCK_ON_TRACK_CHANCE = 0.45;
/**
 * And what share of THOSE are seeded behind rather than ahead.
 *
 * A rock behind can never catch the craft, so this is not a threat to a
 * player holding course: it is the price of turning back, so that neither
 * running straight nor doubling back is a free answer to the one in front.
 */
export const ROCK_ON_TRACK_BEHIND = 0.25;
/**
 * How far along the track they go, radians.
 *
 * Beyond {@link ROCK_SPAWN_MIN_ARC} so nothing lands in the player's lap, and
 * beyond the visible limb so it rises over the horizon rather than appearing
 * in the open. At 0.3 radians a second the craft reaches the near end in
 * about four seconds, sooner once the rock's own homing is counted.
 */
export const ROCK_ON_TRACK_MIN_ARC = 1.25;
export const ROCK_ON_TRACK_MAX_ARC = 1.9;
/**
 * How far off the line they are scattered, radians either way.
 *
 * Zero would be a shooting gallery down one meridian. This is wide enough
 * that most are a near miss the player has to watch, and the rock's own
 * homing closes the rest.
 */
export const ROCK_ON_TRACK_SPREAD = 0.18;

// ─── the shield ────────────────────────────────────────────────────────
/**
 * The craft has no lives. It has a shield, and the shield is the whole
 * damage model: full at the start, a bite out of it per impact, and it
 * comes back on its own for as long as nothing touches you.
 *
 * That changes what a collision means. A life is binary and ends the run
 * there and then; a shield turns the same contact into something you can
 * fly out of, and it rewards disengaging — which is the manoeuvre this
 * game is actually about, since the craft can turn but cannot stop.
 *
 * Held as a fraction so the bar, the tint and the bubble all read the one
 * number without converting between units.
 */
export const SHIELD_MAX = 1;
/** how much of it one impact costs: four hits from full */
/** chips off a rock that bounced off the shield rather than broke on it */
export const SHIELD_IMPACT_BURST = 40;
/**
 * The craft going, which is the loudest single thing in the game.
 *
 * Deliberately out of proportion to everything else: it is the last frame of
 * the run, nothing follows it, and there is no budget left to save.
 */
export const SHIP_DEATH_BURST = 300;
export const SHIP_DEATH_BURST_SPEED = 18;
export const SHIP_DEATH_BURST_LIFE = 1600;
export const SHIELD_HIT_COST = 0.25;
/**
 * How long after being hit before it starts coming back, milliseconds, and
 * how fast once it does.
 *
 * The delay is what makes the number mean anything. Regenerate straight
 * away and a hit costs a second of bar and nothing else; wait, and taking
 * two in quick succession is genuinely worse than taking two a lap apart,
 * which is the difference between a shield and a cooldown.
 */
export const SHIELD_REGEN_DELAY_MS = 2600;
/** per second: a full bar back from empty takes about ten seconds clean */
export const SHIELD_REGEN_PER_S = 0.1;
/**
 * Grace after an impact, milliseconds.
 *
 * Long enough to fly out of the group that landed the hit, not just out of
 * the one rock that did. Measured: at 900ms a stationary craft lost three
 * quarters of its shield in the first seven seconds of a run, because the
 * opening field arrives more or less together.
 */
export const INVULN_MS = 1000;
/** half-cycle of the blink once the shield is gone, milliseconds */
export const SHIELD_EMPTY_BLINK_MS = 170;

/** the bubble around the craft: how much bigger than the craft it is */
export const SHIELD_BUBBLE_SCALE = 2.4;
/**
 * The radius a rock has to reach to count as hitting the craft.
 *
 * The BUBBLE, not the hull. The quad above is `SHIP_SIZE *
 * SHIELD_BUBBLE_SCALE` across, so this is its own radius, and a rock now
 * stops where the shield is drawn instead of carrying on through it and
 * striking a hull the player can plainly see is covered. That it is 2.16
 * times `SHIP_HIT_RADIUS` is the point: the shield is a thing with a size,
 * and a shield that has to be reached through is not one.
 *
 * Bolts still answer to `SHIP_HIT_RADIUS`. A rock is a body and the bubble
 * stops bodies; the bolts are the hunter's aim being tested, and widening
 * their target by the same factor is a balance change rather than a
 * correction, so it is left alone deliberately.
 */
export const SHIP_SHIELD_RADIUS = (SHIP_SIZE * SHIELD_BUBBLE_SCALE) / 2;
/**
 * The fraction of a shield quad that the shell is actually DRAWN at.
 *
 * `shaders/shield.ts` puts the rim at `SHELL = 0.62` of the quad's half
 * width and fades to nothing past it, so a bubble looks a good deal smaller
 * than the sprite carrying it. Anything measuring where two shields MEET has
 * to use this, and the first version of the bounce did not: it fired at 115
 * units while the two bubbles do not appear to touch until 71, so the craft
 * were thrown apart a clear 44 units before anything on screen was in
 * contact.
 */
export const SHIELD_DRAWN_FRACTION = 0.62;
/**
 * How close the two craft get before they bounce apart, as an arc.
 *
 * SHELL on shell, not hull on hull. The two are wearing shields and a shield
 * is the thing that touches first, so contact is the sum of the two VISIBLE
 * shell radii: half of each quad, times {@link SHIELD_DRAWN_FRACTION}.
 *
 * It lives here rather than up with the rest of the hunter because it is
 * derived from both shells, and the player's scale is declared just above: a
 * module reads top to bottom, and a constant cannot be built from one further
 * down.
 */
export const HUNTER_RAM_ARC =
	((SHIP_SIZE * SHIELD_BUBBLE_SCALE + HUNTER_SIZE * HUNTER_SHIELD_SCALE) /
		2 /
		HUNTER_ALT) *
	SHIELD_DRAWN_FRACTION;
/**
 * The quad it is drawn on, in texels. Nothing is painted into it any more,
 * since the shell is generated per fragment, so this is only the
 * resolution the shader is evaluated at.
 */
export const SHIELD_BUBBLE_TEX = 128;
/** the shader asset for the shell, and how hard its rim is driven */
export const SHIELD_SHADER = "earthDefenderShield";
export const SHIELD_EXPOSURE = 1.5;
/** how fast each of the shell's two lights runs round it, radians a second */
export const SHIELD_SPIN_A = 1.5;
export const SHIELD_SPIN_B = 0.97;
/** how bright the bubble sits when nothing is happening to it */
export const SHIELD_BUBBLE_ALPHA = 0.55;
export const SHIELD_FLASH_MS = 420;
/**
 * The shield's colour at full and at empty. ONE pair, mixed once a frame,
 * and both the bubble and the readout are tinted with the result.
 *
 * The full end is the bubble's aqua rather than a plain white. They were
 * driven by the same number from the start, but a near-white tint on an
 * additively blended shell comes back as the aqua the texture and the
 * scene behind it make of it, while the same tint on an opaque bar comes
 * back as white: same number, two colours, and the bar stopped reading as
 * that thing around the craft. Anchoring the pair on what the bubble
 * actually renders as is what makes them one object.
 */
export const SHIELD_FULL_COLOR = "#7fe0ff";
export const SHIELD_EMPTY_COLOR = "#ff2a1e";

/** the readout, top right */
/**
 * The readout's frame colour.
 *
 * The bar's track is left hollow and this outline is the only chrome, so the
 * sky shows through the drained part rather than a panel sitting behind it.
 */
export const SHIELD_BAR_FRAME = "rgba(122, 190, 235, 0.8)";
/**
 * How far the readout's corners are rounded.
 *
 * Half the bar's height would make a capsule; this is short of that, so it
 * reads as a rounded panel rather than a pill and still has a flat run along
 * the top and bottom for the fill to measure against.
 */
export const SHIELD_BAR_RADIUS = 4;
export const SHIELD_BAR_W = 190;
export const SHIELD_BAR_H = 13;

/**
 * Engine heat, the cost of the boost.
 *
 * Boost nearly triples the ground speed, and a lap of the globe is about 21
 * seconds at `SHIP_SPEED` against 7.4 boosted, so it is the whole of the
 * player's reach: free, holding it is strictly better than not and there is
 * no spatial decision left to make.
 *
 * Heat rather than fuel, and the direction is the point. The shield bar sits
 * directly above this one and drains toward danger; a second bar that also
 * drained would read as the same thing twice at a glance. This one FILLS
 * toward danger instead, so the pair is legible out of the corner of an eye.
 *
 * The contract the tuning has to keep: every threat is answerable at base
 * speed if it is read early. Boost is for recovering from a bad position, not
 * for playing at all. If the spawn cadence ever makes a panel unreachable
 * without it, this stops being a decision and becomes a tax.
 */
export const HEAT_MAX = 1;
/** full from cold in 2s of held boost: a sprint, not a cruise */
export const HEAT_PER_S = 0.5;
/** off the key this long before it starts to cool, which is what kills tapping */
export const HEAT_COOL_DELAY_MS = 900;
/** 2.5s to clear from the redline */
export const HEAT_COOL_PER_S = 0.4;
/**
 * Redlining locks the boost out until it has cooled back to here.
 *
 * This is also where the bar turns fully red, and the two are the same number
 * on purpose: red means locked, and dropping out of the red means usable
 * again. A threshold the player has to infer from a bar that is "nearly empty"
 * is not a rule they can act on; a colour they can see is.
 *
 * It is deliberately not zero. A hard lockout at the moment a panel is about
 * to be hit reads as the game taking the controls away, and resuming here
 * means overspending costs a SHORT next sprint rather than several seconds as
 * a passenger.
 */
export const HEAT_RESUME = 0.6;
/** cool, and at the redline */
export const HEAT_COLD_COLOR = "#59d8ff";
export const HEAT_HOT_COLOR = "#ff5a2a";
/** the frame, dimmer than the shield's so the eye goes to that one first */
export const HEAT_BAR_FRAME = "rgba(150, 170, 190, 0.55)";
/** sits under the shield bar, same width, slightly shorter */
export const HEAT_BAR_H = 9;
/** the plume runs red as the heat climbs, on the same ramp the bar uses */
export const ENGINE_HOT_COLOR = "#ff4a1e";
/**
 * What redlining costs, beyond the lockout.
 *
 * Without it the lockout alone is survivable forever: wait it out, redline
 * again, and the gauge is a rhythm to sit through rather than a resource to
 * spend. A bite out of the shield makes overheating a decision with a price
 * the run remembers.
 *
 * Half of `SHIELD_HIT_COST` and deliberately NOT lethal, unlike a rock: the
 * cost floors at an empty shield rather than ending the run. Dying to a key
 * you held too long reads as the interface killing you, and the empty shield
 * it leaves is already the dangerous state.
 */
export const HEAT_OVERHEAT_SHIELD_COST = 0.12;
/** between the ice shake (4) and a collision (11): an event, not an impact */
export const HEAT_OVERHEAT_SHAKE = 7;
export const HEAT_OVERHEAT_SHAKE_MS = 260;

// ─── bouncing off ──────────────────────────────────────────────────────
/**
 * What an impact does to the two things in it.
 *
 * Neither is destroyed. The craft is knocked back along the line the rock
 * came in on and the rock is thrown the other way, which is what makes the
 * shield read as a shield rather than as a hit-point counter: something
 * physically kept the two apart.
 *
 * `ROCK_BOUNCE_MS` is also how long the rock stops homing for. It steers
 * toward the player continuously, so without it a bounced rock turns
 * straight back round and the two grind against each other.
 */
export const SHIP_BOUNCE_ARC = 0.075;
/**
 * How far the rock is thrown, as the CLEARANCE it needs rather than a
 * fixed arc: enough to put its own radius plus the craft's between them,
 * plus a margin, converted from world units to radians at the altitude it
 * flies. A constant arc is only right for one size of rock, and a boulder
 * bounced by a pebble's worth of arc is still touching on the next frame.
 */
export const ROCK_BOUNCE_MARGIN = 26;
/**
 * And rocks against each other.
 *
 * They were passing straight through one another, which is the one thing
 * in the scene that says "these are sprites" out loud: a field of solid
 * bodies that interpenetrate reads as a decal layer however well each one
 * is lit. Separating them is cheap — at most thirty of them, so under five
 * hundred pair tests a frame, each a couple of dot products.
 *
 * They are pushed apart along the great circle between them and then sent
 * on their way facing outward, with the same brief immunity from homing
 * that a rock bounced off the craft gets. Without that they turn round and
 * grind back into each other on the next frame.
 */
export const ROCK_PAIR_BOUNCE_MS = 700;
/** a little further than just touching, so they separate cleanly */
export const ROCK_PAIR_MARGIN = 1.04;
export const ROCK_BOUNCE_MS = 1400;
/** consecutive kills needed for each multiplier step */
export const MULTIPLIER_STEP = 5;
export const MULTIPLIER_MAX = 8;
export const SCORE_PER_ROCK = 40;

/**
 * The pause overlay.
 *
 * A veil rather than a curtain: the frozen frame stays visible through it, so
 * a pause reads as the game waiting rather than as having left it. Dark
 * enough that the card and the entries over it are the thing being read.
 */
export const PAUSE_VEIL = "rgba(4, 8, 16, 0.72)";
export const PAUSE_CARD_FILL = "#0a1526";
export const PAUSE_CARD_EDGE = "rgba(130, 200, 240, 0.55)";
export const PAUSE_TITLE_COLOR = "#8fd8ff";
export const PAUSE_HINT_COLOR = "#6f8da6";

/**
 * The game's own version, bumped by hand when the game changes.
 *
 * Separate from the engine's, which moves on its own schedule and says
 * nothing about whether the rocks got bigger. This is the number to raise
 * when something a player would notice is different.
 */
export const GAME_VERSION = "1.0";
/** the version stamp in the title's corner: present, not competing */
export const VERSION_COLOR = "#6f8da6";

/**
 * The best score, kept between runs.
 *
 * Through the engine's own `save`, not `localStorage` by hand: it already
 * does the JSON round trip and the defaulting, and an example that rolls its
 * own is teaching the wrong thing.
 */
export const BEST_SAVE_KEY = "earthDefenderBest";
/** dimmer than the live score, which is the number being played for */
export const BEST_COLOR = "#8a7a52";
export const BEST_NEW_COLOR = "#ffd98a";
/** how long NEW BEST stays lit before settling to the number */
export const BEST_NEW_MS = 2600;

/**
 * GAME OVER, stamped.
 *
 * It drops from well above full size and lands hard, which is the whole read:
 * a word that fades up is an announcement, a word that lands is a verdict.
 *
 * Driven by a `Tween` on `Back.Out`, which is what makes it a stamp rather
 * than a shrink. On a value coming DOWN to 1 that easing overshoots past the
 * target and settles back, so the word squashes through its resting size and
 * springs into it, and the overshoot is in the curve instead of being an
 * extra phase bolted on after it.
 */
export const OVER_STAMP_MS = 420;
/** the scale it falls from, as a multiple of its resting size */
export const OVER_STAMP_FROM = 5.5;
/**
 * Hit freeze: the fight stops dead for a few frames, the spectacle does not.
 *
 * Only for the two moments the player LOSES something that cannot be won
 * back in the next second: a bomb going off on the glass, and the craft
 * taking a hit. Everything else in the sky dies constantly, and a game that
 * stutters on every kill reads as a game that stutters.
 *
 * Measured in frames, roughly: 7 and 5 at 60Hz. Long enough to register as a
 * punch, short enough that nobody calls it a hitch.
 */
export const FREEZE_BOMB_MS = 115;
export const FREEZE_HIT_MS = 80;

/**
 * The thump as GAME OVER lands, and the biggest shake in the game by some way.
 *
 * For scale, everything else: ice 4, a defused bomb 3, a small rock 3.5, a
 * bomb or a boulder 9, a collision 11, an overheat 7. This is the ending, so
 * it is meant to be unmistakably the hardest hit the camera takes.
 *
 * Forced past any shake already running, which matters: the hit that kills you
 * fires its own, and `Camera2d#shake` DROPS a new one while another is live
 * unless told otherwise. Without the force the ending often had no thump at
 * all, and only sometimes, depending on what killed you.
 */
export const OVER_SHAKE = 24;
export const OVER_SHAKE_MS = 650;
/** the word fills this much of the viewport width at rest */
export const OVER_WIDTH_RATIO = 0.86;
export const OVER_COLOR = "#ff5566";
/** the restart line, which fades in once the stamp has landed */
export const OVER_HINT_COLOR = "#9fd7ff";
export const OVER_HINT_DELAY_MS = 220;
export const OVER_HINT_FADE_MS = 420;

/**
 * How much rock one bolt takes off, as a fraction of a full-size rock.
 *
 * Size is the difficulty here: a pebble goes on the first hit, a boulder
 * takes three, and the player can read which is which before firing
 * because the thing is right there in front of them at that size. Health
 * derived from the size rather than rolled separately is what keeps that
 * promise honest.
 */
export const ROCK_HP_PER_SIZE = 1.2;
/**
 * Extra bolts a radioactive rock costs on top of what its size earns.
 *
 * It is destroyed outright however big it is, because fragments of one would
 * each pay the bonus and a rare thing that multiplies when shot is not rare.
 * Paying for all of it at once is what this covers.
 */
export const ROCK_BONUS_EXTRA_HP = 3;
/**
 * The flash a rock gives when a bolt lands and does NOT finish it.
 *
 * Without it a hit on a big rock is indistinguishable from a miss, and the
 * player concludes the guns do not work rather than that the rock is
 * large. White while there is health left, red on the last one, so the
 * flash says how close it is as well as that it connected.
 */
export const ROCK_FLASH_MS = 190;
/**
 * The flash is EMISSIVE, not a tint.
 *
 * A tint multiplies the colour map, so the whitest tint available can only
 * take a rock as far as the rock's own texture already goes: on a dark
 * brown asteroid that is a barely perceptible lightening, which is exactly
 * how it looked. Emission is ADDED on top of the shaded colour, so it can
 * put light on the rock that the rock does not have, and past 1 it is in
 * the range the bloom pass picks up. Hence the values above one.
 */
export const ROCK_FLASH_HIT: [number, number, number] = [1.5, 1.5, 1.6];
export const ROCK_FLASH_LAST: [number, number, number] = [1.9, 0.16, 0.08];
/**
 * And the amber one, for a hit that will BREAK the rock rather than end it.
 *
 * The two hot ends are the whole point of the ramp: red says the next bolt
 * removes this rock, amber says the next bolt turns it into more of them.
 * A radioactive rock never splits, so red is the only end it can reach.
 */
export const ROCK_FLASH_SPLIT: [number, number, number] = [1.9, 0.95, 0.12];

// ─── the engine ────────────────────────────────────────────────────────
/**
 * The plume behind the craft under thrust, and the light it casts.
 *
 * Boost is currently invisible except as the speed itself, which over an
 * ocean of hexagons is almost impossible to judge: the craft goes faster
 * and nothing says so. A plume says it directly, and a light on the glass
 * under it says it a second time on the geometry.
 *
 * Damped rather than switched, because an exhaust that appears the instant
 * the key goes down and vanishes the instant it comes up reads as a
 * sprite being toggled, which is what it is.
 */
export const ENGINE_TEX_W = 28;
export const ENGINE_TEX_H = 96;
export const ENGINE_CORE = "#eaffff";
export const ENGINE_EDGE = "#2ea8ff";
/** plume size at full thrust, in world units */
export const ENGINE_WIDTH = PLANET_R * 0.022;
export const ENGINE_LENGTH = PLANET_R * 0.085;
/** how far behind the craft's centre it starts */
export const ENGINE_OFFSET = PLANET_R * 0.045;
/** approach rate of the thrust the plume is drawn from, per second */
export const ENGINE_DAMP = 6.5;
export const ENGINE_LIGHT_COLOR = "#7fd0ff";
export const ENGINE_LIGHT_INTENSITY = 1.15;
export const ENGINE_LIGHT_RANGE = 230;

/**
 * The exhaust RIBBON, which is a different thing from the plume.
 *
 * The plume is a hot baked core at the nozzle, a billboard that cannot be a
 * streak; the ribbon is the streak the plume cannot be. Both, rather than one
 * replacing the other, because together they read as one effect: a bright
 * mouth with something trailing out of it.
 *
 * A `Trail3d`, so it is laid down in WORLD space and stays where it was
 * dropped while the craft flies on. That works here only because the globe is
 * a fixed object and the camera orbits it, so the craft genuinely moves
 * through the scene.
 */
export const ENGINE_TRAIL_POINTS = 24;
/**
 * How long a point lives, in milliseconds.
 *
 * Short. The craft covers about 0.70 rad/s at cruise, so a quarter second is
 * roughly 10 degrees of arc: long enough to read as a streak, short enough
 * that it does not wrap into a ring the player is flying through.
 */
export const ENGINE_TRAIL_LIFETIME = 260;
/** how far the craft travels before another point is laid, in world units */
export const ENGINE_TRAIL_STEP = PLANET_R * 0.004;
/**
 * The ribbon's width at idle, which the boost multiplies up.
 *
 * Deliberately thin. At cruise this is a thread the craft draws behind
 * itself, not an effect; the boost is what turns it into one, and a thin
 * default is what gives that change somewhere to go.
 */
export const ENGINE_TRAIL_WIDTH = PLANET_R * 0.007;
/**
 * How much wider the boost makes it.
 *
 * Note this widens the WHOLE live ribbon rather than flaring from the nozzle,
 * because the width is a property of the trail and not of each point. At this
 * lifetime the difference does not read: the ribbon swells and brightens over
 * a quarter of a second, which is the effect wanted anyway.
 */
export const ENGINE_TRAIL_FLARE = 3.2;
/**
 * The heat at which the ribbon starts going red, on the 0 to
 * {@link HEAT_MAX} scale.
 *
 * LATER than the plume, which runs hot from {@link HEAT_RESUME} because it
 * is an early warning on the thing the player is already looking at. The
 * ribbon is the late one: it stays white through most of the bar and turns
 * over only as the limit arrives, so the two are not saying the same thing
 * twice. It also holds full red for the whole lockout, since red there means
 * "the boost is not coming back yet" rather than "it is getting warm".
 */
export const ENGINE_TRAIL_HOT_FROM = 0.55;
/**
 * The ribbon's own colour, before the heat tint.
 *
 * WHITE, and that is the point: `tint` multiplies, so a cyan ribbon tinted
 * red comes out muddy brown rather than red. Leaving the gradient neutral
 * hands the hue entirely to the tint, which is what lets one lever take it
 * from white to red.
 */
export const ENGINE_TRAIL_GRADIENT = [
	"#ffffff",
	"#ffffffb0",
	"#ffffff00",
] as const;
/** how visible it is with the boost off, so the craft always has a wake */
export const ENGINE_TRAIL_IDLE = 0.25;

// ─── the shield giving out ─────────────────────────────────────────────
/**
 * A chromatic aberration pulse the moment the shield empties.
 *
 * The bar turns red and starts blinking, which is information the player
 * has to be LOOKING at the corner to receive. Splitting the channels for a
 * moment puts it in the middle of the frame instead, where they already
 * are, and it costs one pass that is switched off the rest of the time.
 *
 * Toggled with `enabled`, never removed: `removePostEffect` destroys the
 * effect it removes, and this one has to survive to the next time.
 */
export const ABERRATION_PEAK = 9;
export const ABERRATION_MS = 700;

// ─── impact lights ─────────────────────────────────────────────────────
/**
 * Explosions as real {@link Light3d} point lights, not just bright pixels.
 *
 * The scene is lit by one directional sun and an ambient fill, so until
 * now a fireball could go off against a dome panel and leave it exactly as
 * dark as it was: the burst was additive sprites, and additive sprites
 * light nothing. A short point light at the burst puts that light back on
 * the glass and on whatever rocks are near it.
 *
 * Pooled and reused rather than created per burst. `MAX_LIGHTS` is 32
 * across the whole scene and lights past it are dropped SILENTLY, so a
 * game that allocates one per explosion is a game that stops lighting
 * anything the moment it gets busy, without saying so.
 */
export const FLASH_POOL = 7;
/** a rock going up: warm, brief, and sized to the rock that made it */
export const FLASH_ROCK_INTENSITY = 4.2;
export const FLASH_ROCK_RANGE = 420;
export const FLASH_ROCK_MS = 300;
/** a boulder, which is worth more of everything */
export const FLASH_BOULDER_INTENSITY = 7;
export const FLASH_BOULDER_RANGE = 900;
export const FLASH_BOULDER_MS = 520;
/** and the shield taking a hit, in the shield's own colour */
export const FLASH_SHIELD_INTENSITY = 5;
export const FLASH_SHIELD_RANGE = 560;
export const FLASH_SHIELD_MS = 380;

// ─── break-up ──────────────────────────────────────────────────────────
/**
 * A rock big enough to be worth several bolts does not simply vanish when
 * the last one lands: it comes apart.
 *
 * This is what makes the size tiers pay for themselves. Without it,
 * killing a boulder ENDS work, which is backwards, and the only thing its
 * size bought was a longer wait. With it, the boulder is a decision: break
 * it now and deal with the pieces, or leave it and keep flying.
 *
 * The pieces are thrown outward along the surface, and they keep a moment
 * of the parent's immunity so they clear each other before they start
 * homing.
 */
export const ROCK_SPLIT_MIN_GRADE = 1.25;
export const ROCK_SPLIT_COUNT_MIN = 2;
export const ROCK_SPLIT_COUNT_MAX = 3;
/** how big a piece is, as a share of what broke */
export const ROCK_SPLIT_SCALE = 0.55;
/**
 * How far apart the two fragments are placed when a rock breaks.
 *
 * `turn()` keeps the position it was given, so without this both halves are
 * born at exactly the SAME point. Two coincident spheres have no direction
 * between them to push along, and the overlap resolver then threw them apart
 * by their whole combined radius in one frame, which read as a teleport.
 */
export const ROCK_SPLIT_SPREAD = 1.25;
/**
 * How much of a rock-on-rock overlap is resolved per frame.
 *
 * Well under 1 on purpose: resolving all of it at once is the teleport, and
 * easing them apart over a few frames reads as two bodies shoving each other.
 */
export const ROCK_PAIR_RESOLVE = 0.34;
/**
 * How bouncy a rock-on-rock contact is, 0 to 1.
 *
 * 1 would be perfectly elastic, which stone is not; 0 would have them stop
 * dead against each other and sit there. Low enough that a collision reads as
 * two heavy things knocking together rather than as billiards.
 */
export const ROCK_PAIR_RESTITUTION = 0.55;
/**
 * The most a depenetration step may move a rock in one frame, radians.
 *
 * An impulse answers the VELOCITY of a collision but not the overlap already
 * there, so a little positional correction is still needed or a pair that is
 * homing on the same target rides along inside itself: measured at contacts
 * lasting 358 frames, six seconds, with the impulse alone.
 *
 * The cap is the whole point and it is a FLAT arc, not a share of the
 * overlap. A share scales with the radii, so a boulder pair got up to 0.0299
 * radians in one frame against the 0.0032 a rock covers at full speed, and
 * jumped nine times its own travel. Under its own travel, a correction
 * cannot look like anything but drift.
 */
export const ROCK_PAIR_MAX_PUSH = 0.0016;
/**
 * The band a rock's speed may be knocked into by a collision.
 *
 * An impulse changes SPEED as well as direction, which the old reflection
 * never did, so the designed `ROCK_SPEED_MIN`/`MAX` range is no longer a
 * guarantee. Floored so nothing is left drifting dead in the field, and
 * capped below `SHIP_SPEED` (0.3) so no amount of knocking about ever makes
 * a rock able to run the player down.
 */
export const ROCK_SPEED_FLOOR = ROCK_SPEED_MIN * 0.55;
export const ROCK_SPEED_CEIL = ROCK_SPEED_MAX * 1.4;
/** and how fast it leaves, in radians per second on top of its own speed */
export const ROCK_SPLIT_SPEED = 0.14;

// ─── blast waves ───────────────────────────────────────────────────────
/**
 * The wave a rock leaves when it breaks: a quad laid on the curvature
 * where it died, shaped entirely by its own shader. See `shockwave.ts`.
 *
 * Its size comes from the rock, not from here. `SHOCK_SIZE_RATIO` is how
 * many of the rock's own radii across the quad is drawn, which is what
 * makes a pebble leave a puff and a boulder leave something worth flying
 * away from, with nothing in the shader needing to know which it was.
 */
export const SHOCK_SHADER = "earthDefenderShock";
export const SHOCK_POOL = 6;
export const SHOCK_LIFE_MS = 340;
export const SHOCK_SIZE_RATIO = 3.4;
/**
 * The patch the wave is drawn on: how finely the spherical cap is
 * tessellated, and how far it reaches across the tangent plane as a
 * fraction of the radius it sits at.
 *
 * The half-width has to cover the largest blast the game can produce, and
 * nothing is gained by more: a blast smaller than the patch simply uses
 * less of it, which is what `uSize` tells the shader.
 */
export const SHOCK_CAP_STEPS = 20;
export const SHOCK_CAP_HALF = 0.42;
export const SHOCK_TINT = "#ff2a10";
export const SHOCK_EXPOSURE = 2.1;

// ─── ice ───────────────────────────────────────────────────────────────
/**
 * Some of the field is ice, and ice is the one thing the craft can clear by
 * flying INTO it.
 *
 * It gives the player a second verb. Everything else in the sky is a thing
 * to shoot or a thing to dodge, and both are done at arm's length; an ice
 * rock is a thing to aim yourself at, which is a different decision and a
 * different risk, since a mistake about which kind it is costs shield.
 *
 * So it has to be unmistakable at a glance: pale, glassy and bright where
 * the rock is dark and matte, with a hard specular that catches the sun.
 */
export const ROCK_ICE_CHANCE = 0.26;
export const ICE_SPECULAR: [number, number, number] = [0.95, 0.99, 1];
export const ICE_SHININESS = 90;
/**
 * Hue, saturation and lightness the ice is tinted with, and the light it
 * gives off on its own.
 *
 * The tint MULTIPLIES the rock colour map, which is a warm grey-brown, so
 * a tint alone can only ever pull the ice toward a cold grey: the blue
 * gets multiplied away by the red and green already in the texture. The
 * emissive is ADDED instead, so it puts blue on the ice that the texture
 * does not have, and it is what actually makes it read as ice rather than
 * as a pale rock.
 *
 * Kept low for exactly the same reason it is needed at all. Emission is a
 * FLAT addition: it does not vary with the surface, so past a certain
 * strength it swamps the colour map and the normal map underneath and the
 * rock arrives as a coloured blob with no relief on it. Enough to say what
 * the thing is made of, not enough to bury what it looks like.
 */
export const ICE_HUE = 0.56;
export const ICE_SATURATION = 0.85;
export const ICE_LIGHTNESS = 0.72;
export const ICE_EMISSIVE: [number, number, number] = [0.02, 0.11, 0.24];
/**
 * And what flying through one gives back: BOOST, by how big it was.
 *
 * Heat, strictly: the boost has no fuel, it has a temperature, so a block of
 * ice dumps heat out of it. Which is the one pickup whose fiction writes
 * itself, and it pairs with the verb: the only way to reach a block of ice
 * across the globe in time is to boost there, so the thing that costs heat
 * is the thing that earns it back.
 *
 * Shield deliberately belongs to the radioactive rock instead, so the two
 * pickups answer different trouble rather than being one pickup twice.
 *
 * Read off `grade` in BANDS rather than from three sizes, because there are
 * no three sizes: `grade` is a continuous float, rolled from one of two
 * ranges (an ordinary rock at 0.7 to 1.5, a boulder at 2.6 to 3.6). The
 * bands are where those ranges fall, so a boulder dumps the whole gauge, the
 * bigger ordinary ones two thirds, and the smallest a third.
 */
export const ICE_BOOST_BIG_GRADE = ROCK_BIG_MIN;
export const ICE_BOOST_MID_GRADE = (ROCK_SCALE_MIN + ROCK_SCALE_MAX) / 2;
export const ICE_BOOST_BIG = HEAT_MAX;
export const ICE_BOOST_MID = HEAT_MAX * (2 / 3);
export const ICE_BOOST_SMALL = HEAT_MAX * (1 / 3);
/*
 * The blob a rock drops on the glass below it.
 *
 * On a sphere "down" is RADIAL, so each rock names its own contact point on
 * the dome and the outward normal there as the floor it lands on, every
 * frame. Pinning the blob to the caster's vertical column, which is all
 * `shadowGroundY` can express, put it a whole rock-width to the side for
 * most of the sky: measured, only 24 percent of the rocks on screen were
 * even within the plane tilt the engine allows.
 *
 * Small and soft on purpose. A rock rests about its own radius off the
 * glass, so the blob is a contact shadow rather than a cast one, and a dense
 * field of them at full strength turns the dome into a dirty grey ball.
 */
/*
 * And the saucer's own, cast from much higher up.
 *
 * It cruises at `PLANET_R + UFO_ALT`, several hundred units over the glass,
 * so its blob is a real cast shadow rather than a contact one: wide, soft
 * and well ahead of being read as "touching". The engine's height fade spans
 * six blob radii and shrinks the blob as it rises, which is the behaviour
 * wanted here, so the scale is what buys the altitude: a bigger footprint is
 * a longer span, and the saucer is a big thing anyway.
 */
/**
 * How far each blob is thrown along the sunlight, in blob radii.
 *
 * `shadowLight` hands the engine the scene's own sun, whose direction is
 * rewritten in world terms every frame, so these are the only numbers the
 * throw needs. A rock resting on the glass gets a short one, because a
 * contact shadow that slides far reads as the rock floating; the saucer,
 * which genuinely is floating, gets a long one.
 */
export const ROCK_SHADOW_THROW = 0.35;
/**
 * And the craft's own, which is the one that reads as ALTITUDE.
 *
 * It flies at `PLANET_R * 0.66`, well clear of the glass, so the engine's
 * height fade has room to shrink and soften the blob as the player climbs
 * out of a boost: the boost is otherwise invisible except as the speed
 * itself. Fainter than a rock's, because it is cast from much further up.
 */
export const SHIP_SHADOW_SCALE = 1.3;
export const SHIP_SHADOW_OPACITY = 0.45;
export const SHIP_SHADOW_THROW = 0.9;
export const UFO_SHADOW_THROW = 1.1;

export const UFO_SHADOW_SCALE = 1.5;
export const UFO_SHADOW_OPACITY = 0.5;

export const ROCK_SHADOW_SCALE = 1.1;
export const ROCK_SHADOW_OPACITY = 0.75;
/**
 * How far the blob floats off the glass, world units.
 *
 * Sized against z-fighting, and nothing else. It used to be sized against
 * the PANES instead: contacts were computed on the sphere, every pane is a
 * chord plane sunk below that sphere by up to a sagitta, and this number was
 * the fudge that tried to span the gap. It could not, because the sagitta
 * runs from zero at a pane's corner to its full value at the middle, so the
 * blob floated by a different amount everywhere. `layShadow` now asks the
 * pane for its own plane, so there is no gap left to span.
 */
export const ROCK_SHADOW_LIFT = 1.5;

/** and what it throws off when it shatters */
export const TINT_ICE_EXPLOSION = "#bff2ff";
export const SHOCK_ICE_TINT = "#59d8ff";

// ─── the hot ones ──────────────────────────────────────────────────────
/**
 * And a few that are radioactive: green, visibly glowing, and worth
 * breaking.
 *
 * Ice is the one you fly INTO and rock is the one you avoid; this is the
 * one you go out of your way to SHOOT, which is the third verb. It has to
 * be the most conspicuous thing in the sky for that to work, so its glow
 * is driven hard enough to reach the bloom pass and it pulses, which no
 * other rock does.
 *
 * Flying into one still costs shield. The bonus is for the guns.
 *
 * It pays in SCORE and in one of two prizes, and deliberately not in shield:
 * shield is what ice is for, and two pickups that do the same thing is one
 * pickup with two skins. So this one is the aggressive choice and ice is the
 * defensive one, and a player low on shield has a real decision about which
 * of the two to go for.
 */
export const ROCK_BONUS_CHANCE = 0.12;
export const BONUS_SPECULAR: [number, number, number] = [0.5, 0.85, 0.4];
export const BONUS_SHININESS = 40;
export const BONUS_HUE = 0.29;
export const BONUS_SATURATION = 0.9;
export const BONUS_LIGHTNESS = 0.6;
/** its glow, and how far that swings as it pulses */
export const BONUS_EMISSIVE: [number, number, number] = [0.04, 0.3, 0.06];
export const BONUS_PULSE = 0.4;
export const BONUS_PULSE_HZ = 2.1;
/**
 * What breaking one is worth.
 *
 * Score every time, and then ONE of two prizes, rolled: the multiplier, or
 * the spread gun. Rolled rather than both, and rolled rather than
 * alternating, so that going after a radioactive rock is a gamble on which
 * kind of help arrives rather than a routine the player can plan around.
 * The score is the part that is never in doubt.
 */
export const BONUS_SCORE_MULT = 6;
/**
 * The three prizes, rolled one apiece.
 *
 * Shares of one roll, so they add to 1: the fan, the lance, the
 * shield-and-ward, and the multiplier as the remainder. Shield lives here
 * rather than on the ice, which gives boost back, so no two pickups do the
 * same job, and the two guns are split rather than rolled as one "better
 * gun" because width and depth answer different trouble.
 */
export const BONUS_SPREAD_CHANCE = 0.25;
export const BONUS_PIERCE_CHANCE = 0.25;
export const BONUS_WARD_CHANCE = 0.25;
/**
 * The score multipliers the prize rolls between, one of these for
 * {@link UPGRADE_MS}.
 *
 * It used to add two tiers to the kill STREAK instead, which was wrong in
 * two ways. The HUD had to announce it as "+2 MULTIPLIER", naming a unit the
 * game never shows and sitting untimed in a banner whose other entries are
 * countdowns. And a streak is lost on the next miss, so the prize could be
 * gone before the player noticed it had arrived.
 *
 * A window instead, the gun's own length so the two prizes feel like the
 * same KIND of thing, and it MULTIPLIES the streak tier rather than
 * replacing it: overriding would sometimes hand a player on a hot streak a
 * smaller number than they already had, which is a terrible thing for a
 * pickup to do.
 */
export const BONUS_MULTIPLIERS = [2, 3, 4] as const;
/**
 * The shield prize: the gauge topped right up, and nothing can touch the
 * craft while it lasts.
 *
 * The same clock as the gun, so the two strongest prizes are worth the same
 * amount of time and the HUD counts them down the same way.
 */
export const WARD_MS = UPGRADE_MS;
/** the other prize, the gun, is {@link UPGRADE_MS} up with the rest of it */
/** the colour the prize banner is lit in: the rock's own green */
export const PRIZE_COLOR = "#aaff6a";
/**
 * The halo behind a glowing rock.
 *
 * Emission is a FLAT addition across the whole surface, so it can say what
 * a rock is made of and it cannot put the light where light actually
 * gathers, which is around the silhouette. A hosted effect cannot either:
 * it is a colour hook with the texture coordinate and no normal, and the
 * UVs of an unwrapped asteroid say nothing about which way it faces.
 *
 * So the rim is a soft disc drawn BEHIND the rock. The mesh covers the
 * middle of it and what is left is a glow around the outside, which is
 * both what was asked for and what leaves the colour map and the relief
 * completely unobscured.
 */
export const HALO_TEX = 96;
export const HALO_SCALE = 1.65;
export const HALO_FALLOFF = 0.62;
export const HALO_ALPHA = 0.45;
export const HALO_ICE_TINT = "rgba(120, 214, 255, 0.95)";
export const HALO_BONUS_TINT = "rgba(120, 255, 96, 0.95)";

export const TINT_BONUS_EXPLOSION = "#8dff6a";
export const SHOCK_BONUS_TINT = "#57ff3c";

// ─── the shell reacting, and the frame reacting ────────────────────────
/**
 * Rings crossing the dome from where something hit the craft.
 *
 * Deliberately large: it is the shell ringing, not a spark, and the shell
 * is the biggest thing in the frame. It rides a hair above the glass so it
 * is unambiguously ON it rather than floating over it.
 */
export const RIPPLE_SHADER = "earthDefenderRipple";
export const DAMAGE_SHADER = "earthDefenderDamage";
export const RIPPLE_POOL = 4;
export const RIPPLE_LIFE_MS = 950;
/** how far the dome's ring floats off the glass, world units */
export const RIPPLE_LIFT = 2;
export const RIPPLE_RADIUS = PLANET_R * 0.42;
export const RIPPLE_TINT = "#7fe2ff";
export const RIPPLE_EXPOSURE = 0.95;

/**
 * And red at the edges of the frame as the shield goes.
 *
 * It starts only once the shield is below half, so a full bar is a clean
 * frame and the red genuinely means something when it arrives, and it
 * throbs once the bar is empty, in step with the bar's own blink.
 *
 * A screen-space QUAD with a painted radial gradient rather than a shader,
 * because a viewport-hosted effect written for this never reached the
 * screen: see `impact.ts`. A quad is also the cheaper answer, since the
 * gradient is fixed and only its opacity changes.
 */
export const DAMAGE_TEX = 256;
export const DAMAGE_TINT = "#e8180c";
export const DAMAGE_FROM = 0.5;
export const DAMAGE_MAX = 0.55;
export const DAMAGE_THROB_HZ = 3.4;

/**
 * The debris leaves as a RING hugging the surface, not as a cone pointing away
 * from it.
 *
 * A cone aimed straight out looked wrong because that is not what an explosion
 * in vacuum looks like: with nothing to push against, the debris spreads in
 * the plane it was free to spread in, and against a sphere that plane is the
 * tangent one. So the launch axis stays the surface normal and the particles
 * are thrown at ninety degrees to it, which is what `minSpread`/`maxSpread`
 * were added to the emitter to express.
 *
 * The band sits at or INSIDE ninety degrees, never past it. Past it is tilted
 * back toward the planet, and debris that crosses its own dome reads as a bug
 * however pretty the ring is.
 */
export const BURST_RING_MIN = Math.PI / 2 - 0.3;
export const BURST_RING_MAX = Math.PI / 2;
/**
 * How much debris a destruction throws, and over what area.
 *
 * Both come off the SIZE of the thing that was destroyed rather than being
 * fixed per event, which is the only version that stays honest across a size
 * ladder: a fixed count makes the smallest fragment pop exactly as hard as a
 * boulder four times its width, and the ladder stops meaning anything.
 *
 * The budget scales with `grade` SQUARED, so with how much of the rock the
 * player can see rather than with its width. Over the real grade range (a
 * fragment at the `ROCK_SCALE_MIN` floor up to a `ROCK_BIG_MAX` boulder) that
 * is a 26x spread, which is about right: the floor fragment is a puff and the
 * boulder is an event.
 *
 * `BURST_AREA_SCALE` is what lets the counts go up without the burst just
 * turning into a brighter flash. Every particle used to launch from the SAME
 * pixel, and additive particles piled on one point clip all three channels
 * there however well they are tinted: measured on the old burst, the body of
 * it stayed properly cyan while its core washed out to `[231 255 255]`.
 * Spawned across the silhouette of what actually broke, the same count reads
 * as debris instead.
 */
export const BURST_DEBRIS_PER_AREA = 40;
export const BURST_DEBRIS_MIN = 18;
/**
 * A terminal kill gets its OWN floor, far above the one a split gets.
 *
 * The quadratic budget is honest about size but a terminal kill is not just a
 * small event: it is the only thing that says a rock is gone for good, and at
 * the `ROCK_SCALE_MIN` floor the budget alone came to 35 particles thrown
 * over a second and a half, which is nothing. Since every break-up chain ENDS
 * in several floor fragments, the common case was a boulder exploding
 * properly and then each of its pieces vanishing quietly, which reads as the
 * particles having stopped working rather than as a small rock dying.
 */
export const BURST_TERMINAL_MIN = 70;
/**
 * A ceiling, because the budget is quadratic and one case multiplies on top of
 * it: a radioactive boulder is terminal at full grade (it never splits), which
 * is the one combination that runs away.
 */
export const BURST_DEBRIS_MAX = 300;
/** a rock that leaves fragments spends less: the pieces carry the rest */
export const BURST_SPLIT_FRACTION = 0.55;
/** one that leaves nothing at all gets the real explosion */
export const BURST_TERMINAL_BOOST = 1.8;
/**
 * A hit the rock SURVIVES scales with its width, not its area: this is chips
 * knocked off a surface, not a body coming apart.
 */
export const BURST_HIT_PER_SIZE = 9;
export const BURST_HIT_MIN = 8;
/** the spawn area, as a multiple of the radius of what blew up */
export const BURST_AREA_SCALE = 2;
/**
 * How big the debris is, and how much of it survives to the end of its life.
 *
 * The end scale is the one that was wrong. At `0.05` to `0.2` a 12px particle
 * died at half a pixel to two pixels across, and since a burst spreads fast —
 * traced in the browser, one covers 421x665 px within 360 ms — the whole
 * thing thinned out into sub-pixel specks almost immediately. A burst that
 * large on screen with nothing visible in it was the real reason the counts
 * looked like they were doing nothing.
 *
 * So: chunkier at birth, and still SOMETHING at death.
 */
export const BURST_START_SCALE_MIN = 0.45;
export const BURST_START_SCALE_MAX = 1.1;
export const BURST_END_SCALE_MIN = 0.12;
export const BURST_END_SCALE_MAX = 0.38;
/**
 * The sprite the debris is drawn from, before scaling, and how much of it is
 * solid before the edge falls away.
 *
 * The emitter's own default particle is a `fillRect` — a hard white SQUARE.
 * Additive blending hid that, because what the eye reads there is the sum
 * falling off where fewer particles overlap rather than any one sprite's
 * shape. Drawn normally, as the debris layer now is, every chunk was plainly
 * a rectangle. So this scene brings its own disc.
 *
 * Sized well above what it is drawn at and scaled DOWN, since a gradient
 * stretched past its own resolution bands visibly.
 */
export const BURST_TEXTURE_SIZE = 32;
export const BURST_TEXTURE_CORE = 0.42;
/**
 * How much of a burst is additive sparks rather than solid debris.
 *
 * Kept low on purpose. Sparks are what blows the middle of a burst out to
 * white, so they are the garnish and the debris is the dish.
 */
export const BURST_SPARK_SHARE = 0.3;
/** sparks are thrown harder and die sooner than the debris they come off */
export const BURST_SPARK_SPEED = 1.5;
export const BURST_SPARK_LIFE = 0.55;
export const BURST_SPARK_SCALE_MIN = 0.18;
export const BURST_SPARK_SCALE_MAX = 0.45;
/** the ordinary throw, slowed so a burst holds together long enough to read */
export const BURST_SPEED = 7;
export const BURST_LIFE = 950;
/** the last fragment: nothing is left behind it, so it is thrown properly */
export const BURST_FINAL_SPEED = 9.5;
export const BURST_FINAL_LIFE = 1200;
/**
 * The fuel going up, thrown harder and burning longer than ordinary debris.
 *
 * Declared here rather than with the rest of the hunter's death because it is
 * built from the two constants above: a module reads top to bottom.
 */
export const HUNTER_DEATH_FUEL_SPEED = BURST_FINAL_SPEED * 1.5;
export const HUNTER_DEATH_FUEL_LIFE = BURST_FINAL_LIFE * 1.4;
export const TINT_ROCK_EXPLOSION = "#ffb055";
export const TINT_SHIP_EXPLOSION = "#7fd8ff";

// ─── camera ────────────────────────────────────────────────────────────
/**
 * How far the camera slides off-axis as the player steers, in world units.
 *
 * The ship holds the middle of the frame by construction, so without this
 * the view is rigid: nothing on screen reports that you turned except the
 * planet rolling underneath. Sliding the camera instead moves the near
 * geometry against the far geometry, and the distance between them does the
 * rest. Small on purpose, since the camera also has to keep the ship framed.
 */
export const CAM_PAN_X = 120;
export const CAM_PAN_Y = 90;
/** how quickly the camera catches up to the pan target, per second */
export const CAM_PAN_DAMP = 3.2;

/**
 * How much of the planet's own screen motion the backdrop is allowed to
 * take, as a fraction: 0 leaves the sky glued to the camera and 1 makes it
 * travel exactly like the planet, which is no parallax at all.
 *
 * Left where geometry alone puts it the backdrop is dead. The sky sits at
 * better than fifteen times the planet's depth, so a camera slide that
 * swings the globe ninety pixels moves a nebula six, and six pixels of a
 * soft cloud is nothing the eye can see. The pan cannot simply be made
 * bigger either: the ship is fixed in the world and the pan is what slides
 * it off centre, so the framing runs out long before the backdrop starts
 * moving.
 *
 * So the sky is given a slide of its own, sized per sprite from its depth
 * to land on this fraction. It is a cheat, and it is the same cheat every
 * side-scroller makes: the far layer is moved by hand until it reads as
 * far rather than as painted on the lens.
 */
export const SKY_PARALLAX = 0.35;
/**
 * The two nebulae's own rates, as fractions of the planet's screen motion.
 *
 * They have to DIFFER, and that is the whole mechanism: a backdrop reads as
 * far away only in comparison with something nearer, so what the eye reads is
 * the gap between these two numbers, not either value on its own. Sharing
 * {@link SKY_PARALLAX} gave both layers the same rate at every depth, which
 * is why giving the second one a nearer depth changed nothing on screen.
 *
 * The far one is slower than the stars so it sits behind them; the near one
 * is appreciably quicker, because a difference the eye cannot resolve is the
 * same as no second layer at all.
 */
export const NEBULA_PARALLAX_FAR = 0.22;
export const NEBULA_PARALLAX_NEAR = 0.58;

// ─── the sky ───────────────────────────────────────────────────────────
/** how many stars are scattered across the backdrop */
export const STAR_COUNT = 180;
// ─── the nebula ────────────────────────────────────────────────────────
/** edge of the generated nebula tile, in pixels */
export const NEBULA_TEX = 512;
/**
 * How many times the tile is repeated into the texture that is actually
 * drawn, per axis.
 *
 * The backdrop is ONE quad, not a grid of them. A grid has edges, and two
 * quads meeting on an edge do not rasterise to exactly one pixel each
 * along it: the boundary column is claimed by both or by neither, and
 * under additive blending that showed up as a bright line straight down
 * the sky. Repeating the tile into a single bitmap instead puts the joins
 * inside a texture, where they are texel-aligned copies with no filtering
 * and no blending, so they cannot show.
 *
 * The cost of the repeat is memory rather than time: the expensive part is
 * generating the {@link NEBULA_TEX} tile, and the copies are nine
 * `drawImage` calls.
 */
export const NEBULA_REPEAT = 3;
/** the far cloud's seed: the same seed is the same sky */
export const NEBULA_SEED = 1337;
/**
 * How large that whole quad is drawn in the world.
 *
 * It has to cover what the frustum sees at the nebula's depth, about
 * 21000 x 13400 units at a 60 degree fov on a widescreen frame, with room
 * for the camera pan and for a window wider than the one this was tuned
 * on. What it divides by {@link NEBULA_REPEAT} is the zoom: 16000 units
 * per tile here, so a few large soft masses rather than a busy field of
 * small ones.
 */
export const NEBULA_SPAN = 48000;
/** how bright the cloud is allowed to get: a backdrop, not a subject */
export const NEBULA_ALPHA = 0.62;

/**
 * The NEAR cloud: a second layer of sky, in front of the first.
 *
 * One backdrop at one depth cannot parallax against anything, so panning the
 * camera slid the whole sky as a single flat. Two layers at different depths
 * drift against EACH OTHER, and that relative motion is what the eye reads as
 * distance: the far cloud barely moves, this one slides across it.
 *
 * It costs one more quad. The parallax itself is free, because `addSky`
 * derives a layer's pan from its depth, so putting this one nearer is the
 * whole of the setup.
 */
export const NEBULA_NEAR_SEED = 8821;
/**
 * Where it sits, and how big it is drawn.
 *
 * The span is the far cloud's scaled by the ratio of the two depths, which is
 * what keeps it covering the same part of the frustum: a nearer quad sees a
 * narrower cone. Its tile therefore works out slightly smaller in world units
 * and noticeably larger on screen, which is what a nearer cloud should do.
 */
export const NEBULA_NEAR_DEPTH = 6400;
export const NEBULA_NEAR_SPAN = 27000;
/** fewer repeats than the far cloud, so its masses read as bigger shapes */
export const NEBULA_NEAR_REPEAT = 2;
/**
 * Dimmer than the far cloud, and tinted away from it.
 *
 * Both draw additively, so two layers at the far cloud's brightness simply
 * add up to a washed-out sky. This one is a veil in front, not a second
 * backdrop: low enough to see the first one through, and pushed cold so the
 * two read as separate masses rather than as one cloud with a seam.
 */
export const NEBULA_NEAR_ALPHA = 0.3;
export const NEBULA_NEAR_TINT = "#5fb4ff";
/** offset across the sky, so the two masses are not stacked on one spot */
export const NEBULA_NEAR_OFFSET_X = -5200;
export const NEBULA_NEAR_OFFSET_Y = 2600;

/** the backdrop sits far beyond the planet, so it barely parallaxes */
export const SKY_Z = 9000;
/** half-extent of the star field in world units at `SKY_Z` */
export const SKY_SPREAD = 10500;
/** the distant worlds: size, depth and colour */
export const FAR_PLANETS: {
	size: number;
	x: number;
	y: number;
	z: number;
	tint: string;
	alpha: number;
}[] = [
	{ size: 520, x: -2600, y: -1500, z: 7400, tint: "#c98f5a", alpha: 0.5 },
	{ size: 300, x: 3100, y: -900, z: 8200, tint: "#7b8fb8", alpha: 0.42 },
	{ size: 880, x: 2100, y: 2100, z: 11000, tint: "#8f6f7a", alpha: 0.3 },
];

/**
 * The sun sits behind the camera, over the viewer's right shoulder and
 * high, so the dome catches a highlight.
 *
 * This is the direction light TRAVELS, so it is the opposite of where the
 * sun is. The highlight lands where the surface normal bisects the view
 * and the light, which for a sphere seen head on works out at roughly
 * `normalize(toLight + toViewer)` of the way off centre: the further this
 * leans down and left, the further up and right the hot spot sits. It was
 * landing close enough to the middle to sit on the craft itself.
 */
export const SUN_DIRECTION: [number, number, number] = [-0.75, 0.57, 0.33];

// ─── the air ───────────────────────────────────────────────────────────
/**
 * The atmosphere, as a billboard just larger than the PLANET and drawn
 * behind it. See `atmosphere.ts`.
 *
 * Sized against the planet and not the shell, which is the whole
 * difference between air and a painted ring. The planet is opaque, so it
 * cuts the inner edge of this exactly at its own silhouette and the band
 * starts precisely where the world does. The shell is transparent and
 * writes no depth, so sizing it there left the inner edge uncut and the
 * result was a flat donut lying across the glass.
 *
 * The air is then seen THROUGH the shell, which is also the right way
 * round: the dome is a thing built over the world, not over its sky.
 */
export const ATM_SHADER = "earthDefenderAtmosphere";
export const ATM_TEX = 256;
// Comfortably past DOME_R, not a hair past it. At 1.24 this was 583 against
// the dome's 573: the whole falloff happened INSIDE the shell, and the nine
// units that stuck out were not an atmosphere, they were a rounding error.
// The glow needs somewhere to go, and that somewhere is outside the
// outermost silhouette in the scene.
export const ATM_RADIUS = PLANET_R * 1.55;
/** where the planet's outline falls on that quad, as a fraction */
// Measured from the DOME, not the planet. The limb the eye reads is the
// outermost thing on the silhouette, and that is the shell; a rim placed at
// the planet's own surface sits well inside it and reads as haze on the
// ground rather than as air around a world.
export const ATM_INNER = DOME_R / ATM_RADIUS;
/** the band's width, as a fraction of the quad: about 7% of the planet */
export const ATM_FALLOFF = 0.085;
export const ATM_TINT = "#59a6ff";
export const ATM_EXPOSURE = 0.9;
/**
 * The screen direction the light arrives from, which is the opposite of
 * the direction it travels, normalised in x and y alone.
 */
export const ATM_SUN: [number, number] = (() => {
	const x = -SUN_DIRECTION[0];
	const y = -SUN_DIRECTION[1];
	const len = Math.hypot(x, y) || 1;
	return [x / len, y / len];
})();

export const SUN_COLOR = "#fff4e0";
export const SUN_INTENSITY = 1.15;
export const FILL_COLOR = "#43618f";
export const FILL_INTENSITY = 0.3;

/**
 * What each surface does with that sun, as `Ks` and `Ns` would in an MTL.
 *
 * A light with nothing to reflect off is only half a light: without these
 * every mesh in the scene took the sun as flat diffuse shading and the
 * glass dome, the one thing in frame that should have been throwing the
 * sun straight back at the camera, was as matte as the rock. The pair is
 * what makes a highlight: a colour to reflect and an exponent saying how
 * tightly, and a `shininess` of zero kills the term outright however
 * bright the colour is.
 *
 * The exponents are the material: glass is a small hard glint, the frame
 * around it a broader metallic sheen, wet rock barely anything at all.
 */
export const GLASS_SPECULAR: [number, number, number] = [0.36, 0.47, 0.6];
export const GLASS_SHININESS = 38;
export const FRAME_SPECULAR: [number, number, number] = [0.45, 0.68, 0.9];
export const FRAME_SHININESS = 30;
export const TERRAIN_SPECULAR: [number, number, number] = [0.22, 0.3, 0.38];
export const TERRAIN_SHININESS = 18;
export const SHIP_SPECULAR: [number, number, number] = [0.9, 0.9, 0.95];
export const SHIP_SHININESS = 36;
export const ROCK_SPECULAR: [number, number, number] = [0.5, 0.45, 0.4];
export const ROCK_SHININESS = 24;

// ─── the raiders ───────────────────────────────────────────────────────
/**
 * How high the saucers fly, as an altitude above the surface.
 *
 * Above the craft, which flies at `PLANET_R * 0.66`, so it cannot be answered
 * directly: the point is that you shoot what it drops, not the saucer.
 *
 * Only a LITTLE above, though, and that is the counter-intuitive part. The
 * camera stands outside everything, at `PLANET_R * 2.81`, so altitude here
 * moves a thing TOWARD the lens rather than away from it. The first attempt
 * put the saucer at `1.02` and it passed 371 units from the camera, nearer
 * than the craft at 540, and filled a quarter of the screen with hull. At
 * `0.78` it clears the craft by a visible margin while still reading as
 * something crossing the sky in the distance.
 */
export const UFO_ALT = PLANET_R * 0.78;
/** world size of one saucer, about twice the craft, so it reads as a bigger ship rather than a rock */
export const UFO_SIZE = PLANET_R * 0.18;
/**
 * How fast a saucer crosses the sky, in radians of arc per millisecond.
 *
 * Set from the lap rather than picked: the warning lap is a full turn of the
 * ring, so this is `2 pi / 14 seconds`. Much slower and the telegraph becomes
 * half a minute of waiting; much faster and there is no time to break off
 * what you are doing and be somewhere useful before the first bomb lands.
 */
export const UFO_SPEED = 0.00045;
/** how fast the saucer turns about its own axis, radians per millisecond */
export const UFO_SPIN = 0.0016;
/**
 * How far the saucer's circle sits from the pole it goes round, in radians.
 *
 * A SMALL circle, not a great one: the saucer rings the top of the planet
 * rather than cutting across it, which keeps it in the upper part of the view
 * and out of the player's own airspace at the centre. A quarter of the way
 * from pole to pole, which is what puts the ring across the top quarter of
 * the visible disc.
 *
 * The pole it rings is the direction that appears UP ON SCREEN, which is the
 * VIEW's heading (see `viewBasis`) and not the craft's — the two part company
 * as soon as the player turns — captured when the raid opens. So the
 * ring is laid out around wherever the player was looking at the time, and
 * then it stays put: the raid happens in a place, and flying away from it is
 * a decision rather than a dodge.
 */
export const UFO_POLAR = Math.PI / 4;
/**
 * How much of the high ring the saucer flies before it starts dropping.
 *
 * The lap is the warning: it rises over the limb, crosses the sky in plain
 * sight, and only then does anything fall.
 *
 * HALF a lap, not a whole one, and the half is chosen rather than rounded
 * down. The saucer opens a raid at the point of the ring FURTHEST from the
 * player, so half a turn lands it at the nearest point, which is where the
 * bombing run wants to begin anyway; a full turn carried it all the way back
 * round to the hidden side and transferred from there.
 *
 * A whole lap was also far more warning than the comment claimed. Measured,
 * it ran 16.7 seconds from the raid opening to the bombs dropping, and the
 * saucer was ON SCREEN for 16.2 of them: the "it starts hidden and rises
 * over the limb" part lasted half a second, because at {@link UFO_ALT} it
 * clears the limb almost immediately. Sixteen seconds of telegraph, inside a
 * cycle of twenty-four, is most of a raid spent waiting. Half a lap keeps
 * about nine seconds of it, which is still longer than the fuse.
 */
export const UFO_WARNING_LAPS = 0.5;
/**
 * How long between raids, in milliseconds, picked fresh each time.
 *
 * Random so the player cannot count the gap and be waiting, and wide so a
 * quiet spell reads as reprieve rather than as the feature being broken.
 *
 * It was 14 to 26 seconds, which was far too much reprieve: the dome is the
 * only thing that can end the run from across the globe, and with gaps that
 * long the game between raids was just rocks, which cost nothing to ignore.
 * The saucer is the clock, so the clock has to tick. Six to twelve was still
 * loose enough to farm between raids; at four to eight and a half there is
 * usually glass to defend, and the gaps that do open read as earned.
 */
export const UFO_IDLE_MIN_MS = 4000;
export const UFO_IDLE_MAX_MS = 8500;
/**
 * How tightly the saucer rings the player on its bombing run, in radians.
 *
 * A second ring, about the PLAYER'S own position rather than the pole it
 * first circled. Small, so the run passes close overhead and the bombs land
 * where they can be seen and reached: dropping them across the globe would
 * be asking the player to defend something they cannot even look at.
 */
export const UFO_RUN_POLAR = 0.3;
/** how long the saucer takes to slide from the high ring down to the player's, in ms */
/**
 * How quickly the bombing run's pole closes onto the craft, per millisecond.
 *
 * The transfer ends aimed where the player WAS when it opened, so the run
 * has a gap to close. Snapping it shut moved the saucer 0.79 rad in one
 * frame; this shuts it over a few frames instead. Fast enough that the ring
 * is centred before the star is laid, slow enough that no single frame reads
 * as a jump.
 */
export const UFO_AIM_DAMP = 0.006;
export const UFO_TRANSFER_MS = 2600;
/**
 * How many bombs one run leaves behind, whichever shape it lays.
 *
 * Eight, so a raid surrounds rather than sprinkles: whichever way the player
 * turns there is one to answer, and the order they are taken in is the
 * decision.
 *
 * The same for EVERY formation, which it did not used to be: the ring laid
 * eight, the line and the pincer six, the cluster five. The count being a
 * second hidden variable made a raid's weight a matter of which shape came
 * up, when the shape is supposed to be the whole of what varies. Every
 * pattern now derives its count from this one, so none of them can drift
 * from it again.
 */
export const UFO_BOMBS_PER_RUN = 8;
/**
 * How long the saucer stays overhead after dropping, in milliseconds.
 *
 * They all fall AT ONCE, so this is not a gap between drops: it is the beat
 * the saucer holds afterwards, so the star is laid by something still visibly
 * there rather than by a ship already leaving.
 */
export const UFO_RUN_LINGER_MS = 1400;
/**
 * How fast the saucer flies off once the run is done, radians of arc per ms.
 *
 * Faster than it circles: it holds the heading it already had and leaves on
 * it, so the departure reads as a ship going somewhere rather than as the
 * ring quietly getting wider. It is hidden only once the planet is actually
 * between it and the camera, so there is no moment of it blinking out.
 */
export const UFO_LEAVE_SPEED = 0.00075;

/** the saucer's drone, which plays for as long as it is in the sky */
export const UFO_SOUND = "earthDefenderUfoDrone";

/*
 * The gun, as five takes of the same shot.
 *
 * One clip fired every 190ms is the sound a machine makes; the ear locks onto
 * the repetition within a second or two and stops hearing a weapon at all.
 * Picking among several, never the same one twice running, is what keeps it
 * sounding like a gun being fired rather than a sample being retriggered.
 */
/** how a rumble is written down: heavy motor, light motor, milliseconds */
export type Rumble = readonly [number, number, number];
/**
 * Rumble, as `[strong, weak, milliseconds]` per event.
 *
 * `strong` is the heavy low-frequency motor and `weak` the light
 * high-frequency one, so the pair is a TIMBRE and not just a volume: a bomb
 * is mostly strong, glass breaking is mostly weak, and a hit is both.
 *
 * Everything here is short. A rumble that outlasts the thing that caused it
 * stops being feedback and becomes a setting the player wants to turn off,
 * and the engine preempts an effect with the next one anyway, so a long one
 * is also a rumble that eats the next three.
 */
export const RUMBLE_SHIELD_HIT: Rumble = [0.55, 0.9, 150];
/** the run ending: the one place a long heavy effect is the point */
export const RUMBLE_DEATH: Rumble = [1, 0.65, 650];
/**
 * A bomb going off on the glass: the heaviest thing that happens short of
 * the run ending, and now felt as one.
 */
export const RUMBLE_BOMB: Rumble = [1, 0.75, 440];
/** a pane letting go, which is the run ending too */
export const RUMBLE_PANE_SHATTER: Rumble = [0.8, 1, 380];
/** one more fracture across a pane */
export const RUMBLE_PANE_CRACK: Rumble = [0.3, 0.55, 110];
/** the hunter coming apart, one pulse per beat of its death */
export const RUMBLE_HUNTER_SHELL: Rumble = [0.4, 0.8, 110];
export const RUMBLE_HUNTER_HULL: Rumble = [0.6, 0.5, 130];
export const RUMBLE_HUNTER_FUEL: Rumble = [0.9, 0.6, 260];
/** two shields meeting: a shove, not a blast */
export const RUMBLE_BOUNCE: Rumble = [0.45, 0.7, 120];
/**
 * A rock blown apart, at the smallest and at the largest.
 *
 * Interpolated by size rather than fixed, because this is the one explosion
 * that happens several times a second. At one setting it is either inaudible
 * for a boulder or a permanent buzz for pebbles.
 */
export const RUMBLE_ROCK_SMALL: Rumble = [0.12, 0.3, 60];
export const RUMBLE_ROCK_BIG: Rumble = [0.5, 0.55, 150];

export const LASER_SOUNDS = [
	"earthDefenderLaser0",
	"earthDefenderLaser1",
	"earthDefenderLaser2",
	"earthDefenderLaser3",
	"earthDefenderLaser4",
];
/**
 * The gun is the QUIETEST thing in the game, deliberately.
 *
 * It fires every 190ms for as long as a finger is down, so it is the one
 * sound the player hears thousands of times; anything that reads as a
 * reasonable level on a single shot is exhausting as a volley, and it buries
 * the music underneath it.
 */
export const LASER_VOLUME = 0.18;
export const SFX_BASE = `${base}assets/earthDefender/sfx/`;

/**
 * The title screen's music, a 23 second loop.
 *
 * Shipped as `.ogg` and `.mp3` rather than `.wav`: the loader tries the
 * extensions `audio.init` was given in order, and a lossless copy of a stereo
 * minute is tens of megabytes for something nobody is going to A/B against the
 * original.
 */
export const MENU_MUSIC = "earthDefenderMenu";
export const BGM_BASE = `${base}assets/earthDefender/bgm/`;
/** under the sound effects, so it is a bed rather than the thing you hear */
export const MENU_MUSIC_VOLUME = 0.7;

/**
 * The game's music, two and a half minutes of it.
 *
 * Shipped `.ogg` and `.mp3` like the menu track. The source was an MP3, so
 * the Vorbis copy is a transcode; it was encoded with `oggenc -q 4` rather
 * than through ffmpeg, whose build here carries no Vorbis encoder at all.
 */
export const BATTLE_MUSIC = "earthDefenderBattle";
/** lower than the menu's: there is a lot more going on over the top of it */
export const BATTLE_MUSIC_VOLUME = 0.62;
/**
 * How long the battle track takes to go quiet once the run has ended.
 *
 * Faded rather than cut: the stamp, the death burst and the shake all land
 * together, and a track stopping dead in the middle of that reads as a bug
 * in the audio rather than as the end of the run. Long enough to hear it go,
 * short enough that the game-over screen is quiet before anyone reaches for
 * a key.
 */
export const OVER_MUSIC_FADE_MS = 1400;
/** how loud the drone is at its closest approach */
export const UFO_SOUND_VOLUME = 0.4;
/**
 * Distance at which the drone is at full volume, in SCENE units.
 *
 * The saucer is followed in scene coordinates and the listener rides the
 * camera, so there is no longer a separate listener-sized room to scale into:
 * this is the distance the engine itself is given. 480 is the old 1.5 in
 * listener units times the 320 world-units-per-listener-unit that used to
 * divide them, so the falloff is unchanged; the saucer's closest approach is
 * about this distance and its farthest a little over four times it, which is
 * a range the inverse model has somewhere to go in.
 */
export const UFO_AUDIO_REF = 480;
/** how steeply it falls away past that */
export const UFO_AUDIO_ROLLOFF = 1.1;
/** its running lights, pulsing: the emissive the model ships, scaled between these */
export const UFO_GLOW_MIN = 0.55;
export const UFO_GLOW_MAX = 1.5;
/** one pulse of the running lights, in milliseconds */
export const UFO_GLOW_MS = 1400;

// ─── the bombs ─────────────────────────────────────────────────────────
/**
 * How long a bomb sits on the glass before it goes off, in milliseconds.
 *
 * Long enough to cross a fair part of the globe and shoot it, because that is
 * the whole deal: the saucer cannot be answered, only what it leaves behind.
 * Not long enough to get all of them, which ten seconds was: a whole raid
 * could be cleared at a stroll, and a threat nobody has to hurry for is not
 * one. Seven still left room to walk it; six is a little over half the way
 * round at cruise, so the far side of a formation wants the boost.
 *
 * It is the FIRST bomb's fuse, not the raid's deadline: each point of the
 * formation adds another {@link BOMB_STAGGER_MS}, so the last of eight goes
 * at 6000 + 7 * 280, just under eight seconds.
 */
export const BOMB_FUSE_MS = 6000;
/** world size of a bomb, a little under the craft so it reads as cargo */
export const BOMB_SIZE = PLANET_R * 0.07;
/**
 * How far above the glass a bomb's base sits.
 *
 * The model was cut off at the bottom of its red band and its origin moved to
 * that cut, so placing it AT the dome radius already stands it flat on the
 * surface. This is only the hair of clearance that stops the two surfaces
 * z-fighting where they meet.
 */
export const BOMB_CLEARANCE = 1.5;
/**
 * How long a bomb takes to fall from the saucer to the glass, in ms.
 *
 * It is DROPPED, not placed: appearing on the shell out of nothing gave no
 * clue where it came from, and the fall is what ties the thing on the glass
 * to the ship that left it there. Long enough to follow with the eye, short
 * enough that the ring is laid before the saucer has gone.
 */
export const BOMB_FALL_MS = 1100;
/** how fast it tumbles on the way down, radians per millisecond */
export const BOMB_FALL_SPIN = 0.004;

/** how many can be on the glass at once, which is a run and a half */
export const BOMB_POOL = 10;
/** the collision radius a bolt has to touch to defuse one */
/**
 * The collision radius a bolt has to touch to defuse one.
 *
 * Generous on purpose, and the reason is geometric rather than a kindness.
 * Bolts fly at a FIXED altitude of `PLANET_R * 1.31` while a bomb sits on the
 * glass at `1.22`: 41 units of clear air between the bolt's line and the
 * bomb's centre. At the bomb's own size the two spheres summed to 37 and
 * could never meet, so shooting one did nothing at all, whatever the aim.
 *
 * This reaches up into the corridor the bolts actually travel in. The player
 * cannot change altitude to close that gap, so the target has to.
 */
export const BOMB_HIT_RADIUS = PLANET_R * 0.085;
/**
 * How far from the player the ring of bombs is laid, in radians of arc.
 *
 * Around the player rather than anywhere on the globe: a bomb on the far side
 * is one the player never sees and cannot answer, which would make the dome's
 * fate a matter of luck rather than of defending it.
 *
 * And not too close either. The craft turns on the spot and fires forward, so
 * it needs room to come about and line one up; dropped on top of it, the ring
 * would be a thing it is standing in rather than a thing it can work.
 *
 * Measured in PANES, which is the unit the shell is actually built in: a pane
 * is 0.314 radians across, so each step out here is one pane further from the
 * craft. At this arc the far points are still well inside the visible cap.
 */
export const BOMB_SPREAD = 0.65;
/**
 * The near arc of the star, against {@link BOMB_SPREAD} as the far one.
 *
 * Alternating the two is what makes the formation a STAR rather than a ring:
 * eight points at one radius is a circle, and a circle around the craft reads
 * as a fence. Alternating them gives the shape its points, and gives the
 * player near ones to take first and far ones to work out to.
 */
export const BOMB_SPREAD_INNER = 0.52;

/**
 * How long apart two points of a formation go off.
 *
 * Every bomb used to carry the same fuse and the same fall, laid in one
 * call, so all eight landed on one frame and detonated on one frame. That
 * is not an eight-bomb raid, it is one loud noise: eight copies of the same
 * clip summing to roughly seven times its gain and clipping, 1920 particles
 * in a frame, and two of the eight blast waves silently dropped because
 * `SHOCK_POOL` holds six.
 *
 * Staggered, the same eight become a wave rolling round the formation. The
 * player gets an ORDER to work in and a visible deadline moving along it,
 * and every pool has time to recycle.
 */
export const BOMB_STAGGER_MS = 280;

/**
 * The shapes a raid can lay, and how often each comes up.
 *
 * A ring every time is a raid the player solves once and then repeats. Each
 * of these asks a different question: the ring is about orbiting, the line
 * about sweeping, the cluster about choosing one pane to save, and the
 * pincer about which half of the dome you are willing to lose.
 *
 * The shares add to 1 and are rolled per raid.
 */
export const BOMB_PATTERN_LINE = 0.25;
export const BOMB_PATTERN_CLUSTER = 0.2;
export const BOMB_PATTERN_PINCER = 0.2;
/** anything else is the ring, which stays the most common */

/**
 * The line: half the raid each side of the craft, stepping outward.
 *
 * Stated as the two ends rather than as a list of steps, so the count can
 * come from {@link UFO_BOMBS_PER_RUN} and the FOOTPRINT stays put. It went
 * from three a side to four, and the outer end did not move with it: a
 * fourth step beyond the old 0.96 would have put the end of the line over
 * the horizon, where the player cannot see what they are being asked to
 * answer. The same stripe, laid more densely.
 */
export const BOMB_LINE_NEAR = 0.46;
export const BOMB_LINE_FAR = 0.97;
/**
 * The cluster: the whole raid inside one narrow arc.
 *
 * Deliberately overlapping panes. It is the only pattern that can take a
 * pane out in one raid if it is ignored, which is what makes it the one the
 * player has to answer rather than ration.
 *
 * The arc widened with the count, from 0.34 for five to 0.44 for eight. A
 * pane is 0.314 radians across and breaks on four cracks, so eight inside
 * the old arc was not a pattern any more, it was a pane gone and change to
 * spare. At this width the patch covers about a pane and a half: still one
 * patch of glass, still a pane lost if it is ignored, and now with a second
 * one at stake for anyone who leaves it too long.
 */
export const BOMB_CLUSTER_ARC = 0.44;
export const BOMB_CLUSTER_NEAR = 0.56;
export const BOMB_CLUSTER_FAR = 0.78;
/** the pincer: two arms on opposite bearings, half the raid apiece */
export const BOMB_PINCER_ARC = 0.46;
/**
 * The lamp's own light, thrown onto the glass it is standing on.
 *
 * The red band was emissive and nothing more: it glowed, and lit nothing. A
 * bomb is the one thing on the shell the player has to find in a hurry, and a
 * point light at it puts a moving red patch on the dome that can be seen from
 * the side the bomb is NOT on, which the band itself never could.
 *
 * One light per bomb, added to the world when it lands and taken out again
 * when it goes, so a pooled bomb costs nothing: a `Light3d` registers with the
 * stage on activation and deregisters on removal, and the lit shader's loop
 * runs to the LIVE count. Eight at once against a cap of thirty-two.
 *
 * The range is generous because the glass is close to it and curving away:
 * tight enough and the patch is a dot under the model rather than a wash
 * across the panes either side.
 */
export const BOMB_LIGHT_RANGE = PLANET_R * 0.55;
/**
 * How far ABOVE the glass the light sits, in world units.
 *
 * Not at the bomb, which is the obvious place and lights nothing. A bomb
 * stands 1.5 units off a shell of radius 573, so a light at it is
 * effectively IN the surface: the lambert term is `height / distance`, which
 * at that height is 0.07 twenty units away and nothing at all beyond. The
 * patch was a few pixels under the model and invisible against its own
 * emissive band.
 *
 * Lifted by about the bomb's own size, the same term is 0.45 sixty units out
 * and the light washes across the panes either side, which is the whole
 * point of it. The lamp mesh still sits on the glass; only what it casts is
 * raised.
 */
export const BOMB_LIGHT_LIFT = PLANET_R * 0.13;
/** how bright it gets at the top of a blink, and its colour */
export const BOMB_LIGHT_INTENSITY = 3.6;
export const BOMB_LIGHT_COLOR = "#ff3a24";
/** the blink period at the start of the fuse and at the end, milliseconds */
export const BOMB_BLINK_SLOW_MS = 900;
export const BOMB_BLINK_FAST_MS = 110;
/** the lamp colour, which is the model's own red band driven hot */
export const BOMB_BLINK_TINT: [number, number, number] = [1.0, 0.12, 0.1];
/** how hard the lamp is driven at the peak of a blink */
export const BOMB_BLINK_GAIN = 2.6;
export const BOMB_SHOCK_RADIUS = PLANET_R * 0.1;
/** particles in the blast, and its colour */
export const BOMB_BURST_COUNT = 240;
export const BOMB_BURST_TINT = "#ffb04a";
/** how hard and how long the blast throws them */
export const BOMB_BURST_SPEED = 16;
export const BOMB_BURST_LIFE = 1200;
/**
 * The area the blast is born over.
 *
 * A blast is not a point: spread across the span it is actually breaking, the
 * debris reads as the glass going rather than as a bright dot with sparks
 * coming off it. Matched to the shock ring, so the two agree about how big the
 * event was.
 */
export const BOMB_BURST_AREA = BOMB_SHOCK_RADIUS * 1.4;
/** the small puff where one touches down, so arriving is an event */
export const BOMB_LAND_BURST = 30;
/**
 * How far off the glass the blast is thrown.
 *
 * Clear of the shell rather than on it. The dome's frame is opaque and writes
 * depth, so particles emitted at the surface are half swallowed by the thing
 * they are supposed to be breaking, and the explosion read as barely there.
 */
export const BOMB_BURST_LIFT = 26;
/** how hard the screen shakes when one goes off, and for how long */
/**
 * The kick when one goes off, which is the second worst thing in the game.
 *
 * Well above a boulder coming apart (9) and below the thump that lands with
 * GAME OVER ({@link OVER_SHAKE}), because a pane is lost for the rest of the
 * run and cannot be won back. It was the same 9 a boulder gets, which put
 * the dome being damaged and an ordinary kill at the same weight.
 */
export const BOMB_SHAKE = 18;
export const BOMB_SHAKE_MS = 450;
/** and the smaller one for a bomb the player got to first */
export const BOMB_DEFUSE_BURST = 46;
/**
 * A defused bomb throws RED, not the green the bonus rocks use.
 *
 * It was reading as a pickup rather than as ordnance: green is this scene's
 * colour for the radioactive rocks that pay out, and a bomb is the opposite
 * of that whether it went off or not. Still distinct from the amber of a
 * blast, so shooting one in time does not look like failing to.
 */
export const BOMB_DEFUSE_TINT = "#ff3b30";
export const BOMB_DEFUSE_SHAKE = 3;
export const BOMB_DEFUSE_SHAKE_MS = 130;
/**
 * What defusing one is worth.
 *
 * Deliberately modest against `SCORE_PER_ROCK`: a bomb is a thing you deal
 * with because the dome is behind it, not a better rock. Paying more would
 * turn the raid into the thing worth waiting for.
 */
export const SCORE_PER_BOMB = 60;

/**
 * The points flying from a kill to the readout.
 *
 * A number that appears at the rock and travels to the score says what the
 * kill was worth AND where the worth went, which a readout quietly ticking up
 * in a corner does not. It is also the only place a radioactive rock's six
 * times payout is ever visible.
 */
export const SCORE_POP_MS = 900;
/**
 * How big the number is, and how much bigger a bigger payout makes it.
 *
 * The point size TRACKS WHAT THE KILL WAS WORTH. A rock is worth its size,
 * so the number that flies off a boulder is visibly larger than the one off
 * a pebble, and the scoring is readable from the screen rather than from the
 * readout ticking by different amounts.
 *
 * It was a flat 19 point and the first pass of it could not be read at all:
 * amber, small, and sitting inside the explosion that had just gone off
 * underneath it. Both halves of that are fixed here, size and lift.
 */
export const SCORE_POP_SIZE = 24;
/** added per whole rock's worth above the first, up to the cap below */
export const SCORE_POP_STEP = 4;
export const SCORE_POP_STEPS_MAX = 5;
export const SCORE_POP_COLOR = "#ffe6a0";
export const SCORE_POP_BONUS_COLOR = "#b6ff78";
/** a ceiling, so a chain of kills cannot fill the screen with numbers */
export const SCORE_POP_MAX = 14;
/**
 * How far above the kill the number appears, screen px.
 *
 * It is lifted on arrival rather than animated upwards, because the one tween
 * that carries it owns `pos` outright and a second one writing `y` would
 * fight it. The lift is there to get the digits clear of the explosion that
 * is going off underneath them, which does not need animating to work, and
 * it has to be most of the blast's radius or the number is simply inside it.
 */
export const SCORE_POP_RISE = 52;
/** the size it pops in at, and the size it arrives at */
export const SCORE_POP_START_SCALE = 1.35;
export const SCORE_POP_END_SCALE = 0.72;
/** the eased progress it starts fading at, so it stays legible until then */
export const SCORE_POP_FADE_FROM = 0.78;
/** the HUD layer it flies in: over the score, under the GAME OVER stamp */
export const SCORE_POP_Z = 20;

/**
 * Where the raid warning sits among the HUD's own children.
 *
 * Above the readout and the score pops: it is a full-width band and anything
 * drawn through it would read as part of the word.
 */
export const WARNING_Z = 30;
/** the light a blast throws on the glass */
export const BOMB_FLASH_INTENSITY = 6.5;
export const BOMB_FLASH_RANGE = 780;
export const BOMB_FLASH_MS = 420;
/** how wide the blast wave is on the shell */

// ─── the dome's panes ──────────────────────────────────────────────────
/**
 * How wide one pane is, as an arc along the shell in radians.
 *
 * The number several comments in this file already quote, now a constant,
 * because code needs it too: the raid uses it to keep a formation's points
 * one pane apart. It is a property of the geodesic the dome is built from
 * rather than something tunable, so changing it does not move the glass,
 * it only lies to whoever reads it.
 */
export const PANE_ARC = 0.314;
/**
 * How many panes outward a formation point may be walked to find glass of
 * its own, before it is laid on a shared pane anyway.
 *
 * Enough that a full formation can always find glass of its own: eight
 * bombs can need eight panes, and a cap below that quietly puts the
 * leftovers back on top of each other, which is the whole thing this
 * prevents. Three was too few and did exactly that.
 */
export const BOMB_PANE_TRIES = 8;
/**
 * How many blasts one pane takes before the dome is breached.
 *
 * Counted per pane and never healed, so the damage is somewhere you can see
 * and the pane that is one hit from ending the run is the one with the most
 * cracks on it. Spreading the damage is survivable; ignoring one pane is not.
 */
export const PANE_CRACKS_MAX = 4;
/**
 * The crack count at which a pane starts pulsing red.
 *
 * One short of the breach, so the warning is a warning: the pane that will
 * end the run announces itself with a whole blast still to go, and the player
 * gets to decide whether to defend it or to spend that time elsewhere.
 */
export const PANE_CRITICAL = 3;
/** one breath of that pulse, in milliseconds */
export const PANE_PULSE_MS = 1500;
/**
 * How far the pulse swings, as the pane's opacity.
 *
 * The top is 1 and not higher. Opacity is what drives this, and a figure over
 * 1 does not make an additive pane brighter, it only parks it at full for the
 * part of the cycle that is past the limit: measured at 1.6, the pane sat at
 * full opacity for better than half of every breath, which is a blink with
 * soft edges rather than a pulse. Ending exactly at 1 spends the whole cycle
 * moving.
 */
export const PANE_PULSE_MIN = 0.2;
export const PANE_PULSE_MAX = 1.0;
/** the warning colour */
export const PANE_WARN_TINT: [number, number, number] = [1.0, 0.1, 0.08];

// ─── the breach ────────────────────────────────────────────────────────
/**
 * How long the dome takes to come apart, in real milliseconds.
 *
 * Real rather than scaled: the slow motion below stretches everything the
 * game does, and a window measured in that stretched time would run for as
 * long again. This is the wall clock, so the sequence lasts what it says.
 */
export const SHATTER_MS = 2800;
/**
 * How far time is slowed while it happens.
 *
 * The game's own clock only. The engine's particle systems run on the real
 * frame delta and are not slowed with it, which is deliberate: the blast is
 * the one thing that should still move at speed while everything else hangs.
 */
export const SHATTER_TIME_SCALE = 0.22;
/** how many blasts walk round the shell as it goes */
export const SHATTER_BURSTS = 30;
/** particles in each, and what they are lit with */
export const SHATTER_BURST_COUNT = 70;
export const SHATTER_TINT = "#9fe8ff";
/** the one that did it goes first and biggest */
export const SHATTER_FIRST_BURST = 300;
/** how hard and how long each blast throws, and the span it comes off */
export const SHATTER_BURST_SPEED = 15;
export const SHATTER_BURST_LIFE = 1400;
export const SHATTER_BURST_AREA = PLANET_R * 0.16;
/** the light each one throws */
export const SHATTER_FLASH_INTENSITY = 5.0;
export const SHATTER_FLASH_RANGE = 900;
export const SHATTER_FLASH_MS = 500;
/**
 * How wide a crack is drawn, as a multiple of the pane's own corner reach.
 *
 * Two landmarks set the range, since the pane is a hexagon and the decal is a
 * square: at `1.73` the fractures just touch the six flats, and at `2` they
 * reach the corners while overhanging each flat by about a seventh. Between
 * the two, so the pane reads as broken edge to edge without the cracks
 * carrying visibly onto the undamaged panes next to it, which would leave the
 * player unable to tell which pane is the one about to go.
 *
 * The reach itself is measured off the dome's geometry at load, so this holds
 * whatever shell the model carries.
 */
export const CRACK_FILL = 1.9;
/**
 * How far off the glass a crack is drawn.
 *
 * Clear of it rather than on it: the pane and the decal are the same surface
 * at the same radius, and two coplanar surfaces decide which is in front per
 * fragment, so a crack laid exactly on the glass shows through it in patches.
 */
export const CRACK_LIFT = 3;
/**
 * How far off the glass the critical-pane warning is drawn.
 *
 * Same reasoning as {@link CRACK_LIFT} and the same cure: a surface laid
 * EXACTLY on the glass decides which is in front per fragment and tears. The
 * first attempt switched the depth test off instead, which does stop the
 * tearing but also stops the planet hiding the pane, so a warned pane on the
 * far side of the globe showed straight through it and a near one drew over
 * the craft. Lifting clear keeps the test, and the test is what makes the
 * depth sorting correct.
 *
 * Under `CRACK_LIFT`, so the cracks on a warned pane still read on top of it.
 */
export const PANE_WARN_LIFT = 2;
/** the crack's colour, hot at first and duller as the pane fills up */
export const CRACK_TINT: [number, number, number] = [1.0, 0.45, 0.12];

// ─── axes ──────────────────────────────────────────────────────────────
/** reusable rotation axes, so no vector is allocated per frame */
export const AXIS_X = new Vector3d(1, 0, 0);
export const AXIS_Y = new Vector3d(0, 1, 0);
/** the axis through the camera: what a turn on screen rotates about */
export const AXIS_Z = new Vector3d(0, 0, 1);
