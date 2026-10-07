/**
 * Spatial audio placed in WORLD coordinates.
 *
 * The backend speaks Web Audio's language: a listener at the origin, metres,
 * and +Y UP. A 2D or 2.5D game speaks pixels with +Y DOWN and has a camera
 * that moves. This module is the bridge.
 *
 * It is opt-in end to end. Until a game calls {@link setListener} or
 * {@link listener}, the listener never moves, no frame handler is installed,
 * and every existing `position` / `stereo` / `panner` call behaves exactly as
 * it did.
 */

import type Camera3d from "../camera/camera3d.ts";
import { Vector3d } from "../math/vector3d.ts";
import type Renderable from "../renderable/renderable.js";
import { GAME_AFTER_UPDATE, off, on } from "../system/event.ts";
import { position as setPosition, stop as stopSound } from "./playback.ts";
import {
	state as audioState,
	getListenerOrientation,
	getListenerPosition,
	isAudioAvailable,
	setListenerOrientation,
	setListenerPosition,
} from "./state.ts";
import type { PannerAttributes } from "./types.ts";

/**
 * Defaults given to a sound placed through `follow` or `at`.
 *
 * Only two of these differ from what the backend already uses, and those two
 * are the whole point:
 *
 * - `refDistance` is **240** rather than `1`. Web Audio's `1` describes one
 *   METRE, so a sound a couple of tiles away in a game measured in pixels is
 *   already near silent. This is the single most common reason positional
 *   audio "does not work".
 * - `panningModel` is `"equalpower"` rather than `"HRTF"`. Plain left/right
 *   panning is what a flat scene wants, and it is markedly cheaper. A scene
 *   with a posed {@link Camera3d}, where front-to-back is meaningful, wants
 *   `setSpatialDefaults({ panningModel: "HRTF" })`.
 *
 * With `"inverse"` and a rolloff of 1 the curve never reaches zero: it is
 * about 0.5 at 480 px, 0.2 at 1200 px and 0.11 at 2200 px, with
 * `maxDistance` the far clamp. These are a starting point, not a measurement;
 * a world much larger or smaller than a few screens wants
 * {@link setSpatialDefaults}.
 */
const PIXEL_DEFAULTS: Readonly<PannerAttributes> = Object.freeze({
	coneInnerAngle: 360,
	coneOuterAngle: 360,
	coneOuterGain: 0,
	distanceModel: "inverse",
	maxDistance: 10000,
	panningModel: "equalpower",
	refDistance: 240,
	rolloffFactor: 1,
});

/** the attributes a spatially placed sound is given, until a game changes them */
let spatialDefaults: PannerAttributes = { ...PIXEL_DEFAULTS };

/** what the listener follows, or `null` for a listener that does not move */
let listenerTarget: Renderable | null = null;

/** one sound whose position is re-read every frame */
interface FollowedSound {
	name: string;
	target: Renderable;
	stopWithTarget: boolean;
}

/** followed sounds, keyed by the playback id `play()` returned */
const followed = new Map<number, FollowedSound>();

/** whether the per-frame handler is currently subscribed */
let ticking = false;

/** collects ids to drop, reused so a frame of tracking allocates nothing */
const _dead: number[] = [];

/**
 * Whether a renderable has been destroyed.
 *
 * `Renderable#destroy()` sets `pos` to `undefined` and releases `_absPos` back
 * to the pool, and `getAbsolutePosition()` dereferences `pos` with no guard of
 * its own. So a destroyed target is not merely stale, it THROWS, and it would
 * do so from inside the frame loop on every frame thereafter. There is no
 * "finalized" flag on `Renderable` to ask instead.
 * @param target - the renderable to test
 * @returns true when the renderable has been destroyed
 */
function isDestroyed(target: Renderable): boolean {
	// the type says `pos` is always a vector; `destroy()` says otherwise
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	return target.pos === undefined;
}

/**
 * Where a renderable is, in WORLD coordinates.
 *
 * `getAbsolutePosition()` sums the ancestor chain, which is what a sound
 * parented into a moving container needs.
 * @param target - the renderable to locate
 * @returns the world position, which is the renderable's own live vector
 */
function worldPositionOf(target: Renderable) {
	return target.getAbsolutePosition();
}

/** Subscribe to the frame loop, but only once something needs it. */
function startTicking() {
	if (!ticking) {
		on(GAME_AFTER_UPDATE, tick);
		ticking = true;
	}
}

/** Drop the frame handler as soon as nothing is being tracked. */
function stopTickingIfIdle() {
	if (ticking && listenerTarget === null && followed.size === 0) {
		off(GAME_AFTER_UPDATE, tick);
		ticking = false;
	}
}

/**
 * Re-read the listener and every followed sound.
 *
 * Hung off `GAME_AFTER_UPDATE` rather than `GAME_UPDATE` deliberately: the
 * latter is emitted INSIDE the fixed-step catch-up loop and BEFORE the world
 * updates, so it would sample last frame's positions and sample them several
 * times over on a catch-up frame. After the update is where "where is
 * everything now" is answerable.
 *
 * Nothing ticks while the game is paused, so a followed sound holds its last
 * position until play resumes.
 */
function tick() {
	if (listenerTarget !== null) {
		if (isDestroyed(listenerTarget)) {
			// the camera or renderable was destroyed under us; a stage that
			// owns its camera destroys it on every state change
			setListener(null);
		} else {
			const p = worldPositionOf(listenerTarget);
			listener(p.x, p.y, p.z);
			const camera = listenerTarget as Camera3d;
			if (typeof camera.getBasis === "function") {
				camera.getBasis(_right, _up, _forward);
				listenerOrientation(
					_forward.x,
					_forward.y,
					_forward.z,
					_up.x,
					_up.y,
					_up.z,
				);
			}
		}
	}

	for (const [id, entry] of followed) {
		if (isDestroyed(entry.target)) {
			_dead.push(id);
			continue;
		}
		// the clip can be unloaded out from under a live follow, and
		// `position()` throws on a name it cannot find
		if (audioState.tracks[entry.name] === undefined) {
			_dead.push(id);
			continue;
		}
		const p = worldPositionOf(entry.target);
		setPosition(entry.name, p.x, -p.y, p.z, id);
	}
	if (_dead.length > 0) {
		for (const id of _dead) {
			releaseFollow(id);
		}
		_dead.length = 0;
	}
	stopTickingIfIdle();
}

/**
 * Stop tracking one followed sound, stopping the sound too if it asked.
 * @param id - the playback id to release
 */
function releaseFollow(id: number) {
	const entry = followed.get(id);
	if (entry === undefined) {
		return;
	}
	followed.delete(id);
	if (entry.stopWithTarget && audioState.tracks[entry.name] !== undefined) {
		stopSound(entry.name, id);
	}
	stopTickingIfIdle();
}

// scratch for the camera basis, reused every frame
const _right = new Vector3d();
const _up = new Vector3d();
const _forward = new Vector3d();

/** @inheritDoc */
export function listener(): [number, number, number];
/** @inheritDoc */
export function listener(x: number, y: number, z?: number): void;
/**
 * Get or set the listener's position, in WORLD coordinates.
 *
 * Called with no arguments it reads the position back. Called with
 * coordinates it moves the listener, which is what makes a sound at a fixed
 * world point pan and fade as the player moves past it.
 *
 * The listener starts at the origin and stays there until something moves it,
 * so a game that never calls this sounds exactly as it did before.
 * @param x - world x, or omitted to read
 * @param y - world y, measured DOWN like every other melonJS coordinate
 * @param z - world z, defaulting to 0
 * @returns the current `[x, y, z]` when reading, otherwise nothing
 * @example
 * // follow the player by hand, if `setListener` is not wanted
 * audio.listener(player.pos.x, player.pos.y);
 * @category Audio
 */
export function listener(
	x?: number,
	y?: number,
	z?: number,
): [number, number, number] | void {
	if (x === undefined) {
		const read = getListenerPosition();
		// back into world space, so what is read matches what was set
		return read === null ? [0, 0, 0] : [read[0], -read[1], read[2]];
	}
	// the Y flip to Web Audio's +Y-up happens HERE and in
	// `listenerOrientation`, and nowhere else
	setListenerPosition(x, -(y ?? 0), z ?? 0);
}

/** @inheritDoc */
export function listenerOrientation(): [
	number,
	number,
	number,
	number,
	number,
	number,
];
/** @inheritDoc */
export function listenerOrientation(
	fx: number,
	fy: number,
	fz: number,
	ux: number,
	uy: number,
	uz: number,
): void;
/**
 * Get or set which way the listener faces, in WORLD coordinates.
 *
 * Two vectors: the direction the listener looks along, and which way is up for
 * it. This is what decides left from right, so a game that only moves the
 * listener around a flat plane can leave it alone.
 *
 * World up in melonJS is `(0, -1, 0)`, because render space is Y-down, and
 * that is what to pass here. The conversion to Web Audio's Y-up is applied
 * for you, which matters: handing Web Audio a Y-down up vector mirrors the
 * stereo image, since it derives right from `forward × up`.
 * @param fx - forward x, or omitted to read
 * @param fy - forward y
 * @param fz - forward z
 * @param ux - up x
 * @param uy - up y
 * @param uz - up z
 * @returns the current `[fx, fy, fz, ux, uy, uz]` when reading
 * @example
 * // face the way the player is walking, with melonJS world up
 * audio.listenerOrientation(dir.x, dir.y, 0, 0, -1, 0);
 * @category Audio
 */
export function listenerOrientation(
	fx?: number,
	fy?: number,
	fz?: number,
	ux?: number,
	uy?: number,
	uz?: number,
): [number, number, number, number, number, number] | void {
	if (fx === undefined) {
		const read = getListenerOrientation();
		return read === null
			? [0, 0, -1, 0, -1, 0]
			: [read[0], -read[1], read[2], read[3], -read[4], read[5]];
	}
	setListenerOrientation(fx, -(fy ?? 0), fz ?? 0, ux ?? 0, -(uy ?? 0), uz ?? 0);
}

/**
 * Have the listener follow a camera or a renderable, every frame.
 *
 * Pass `app.viewport` and world-placed sounds pan and fade around the view
 * with nothing else to write. Pass the player and they are heard from the
 * character rather than the camera, which is usually what a scrolling game
 * with a lagging camera wants. Pass `null` to stop, leaving the listener
 * where it was.
 *
 * A {@link Camera3d} also contributes its ORIENTATION, so turning the camera
 * swings the stereo image. Anything else contributes position only.
 *
 * Following stops on its own if the target is destroyed, which a stage that
 * owns its camera does on every state change.
 * @param target - what to follow, or `null` to stop following
 * @example
 * audio.setListener(app.viewport); // hear from the camera
 * audio.setListener(player); // hear from the player
 * audio.setListener(null); // stop following
 * @category Audio
 */
export function setListener(target: Renderable | null): void {
	listenerTarget = target;
	if (target !== null && !isDestroyed(target)) {
		startTicking();
		tick(); // place it now, so the first frame of audio is already right
	} else {
		listenerTarget = null;
		stopTickingIfIdle();
	}
}

/**
 * Set the panner attributes new spatially placed sounds are given.
 *
 * Applies to sounds placed through `follow` or `at` from this point on.
 * Sounds already playing keep what they were given, and `audio.panner()`
 * still overrides per clip.
 *
 * The shipped defaults suit a world measured in pixels rather than metres. A
 * world much larger or smaller than a few screens, or a posed 3D scene that
 * wants `"HRTF"` back, says so here once.
 * @param attributes - attributes to merge over the current defaults
 * @example
 * // a planet-scale scene, heard through a posed 3D camera
 * audio.setSpatialDefaults({ refDistance: 900, panningModel: "HRTF" });
 * @category Audio
 */
export function setSpatialDefaults(attributes: PannerAttributes): void {
	spatialDefaults = { ...spatialDefaults, ...attributes };
}

/**
 * Read back the defaults new spatially placed sounds are given.
 * @returns a copy of the current defaults
 * @category Audio
 */
export function getSpatialDefaults(): PannerAttributes {
	return { ...spatialDefaults };
}

/**
 * Stop tracking a followed sound, leaving it playing where it last was.
 *
 * `audio.stop()` releases tracking on its own; this is for keeping a sound
 * going while detaching it from whatever it was following.
 * @param id - the playback id to detach
 * @example
 * const id = audio.play("engine", { follow: car });
 * audio.unfollow(id); // the hum stays where the car was
 * @category Audio
 */
export function unfollow(id: number): void {
	if (followed.delete(id)) {
		stopTickingIfIdle();
	}
}

/**
 * Place a just-started sound in the world, and track it if asked.
 * @param name - the clip name
 * @param id - the playback id `play()` returned
 * @param options - the placement the caller asked for
 * @param options.follow - a renderable to track every frame
 * @param options.at - a fixed world point to pin the sound to
 * @param options.stopWithTarget - stop the sound when `follow` is destroyed
 * @internal
 * @ignore
 */
export function applySpatialPlacement(
	name: string,
	id: number,
	options: {
		follow?: Renderable | undefined;
		at?: { x: number; y: number; z?: number } | undefined;
		stopWithTarget?: boolean | undefined;
	},
): void {
	const { follow, at, stopWithTarget } = options;
	if (follow === undefined && at === undefined) {
		return;
	}
	if (follow !== undefined && at !== undefined) {
		throw new Error(
			"melonJS: audio.play() takes `follow` or `at`, not both — `follow` " +
				"tracks a renderable, `at` pins a fixed point",
		);
	}
	if (!isAudioAvailable()) {
		return;
	}

	// pixel-shaped attributes BEFORE the first position is written, so the
	// sound is never briefly audible under metre defaults
	applyPannerAttributes(name, id);

	if (at !== undefined) {
		setPosition(name, at.x, -at.y, at.z ?? 0, id);
		return;
	}
	if (follow !== undefined) {
		if (isDestroyed(follow)) {
			return;
		}
		const p = worldPositionOf(follow);
		setPosition(name, p.x, -p.y, p.z, id);
		followed.set(id, {
			name,
			target: follow,
			stopWithTarget: stopWithTarget === true,
		});
		startTicking();
	}
}

/**
 * Apply the current spatial defaults to one playing instance.
 * @param name - the clip name
 * @param id - the playback id
 */
function applyPannerAttributes(name: string, id: number) {
	const sound = audioState.tracks[name];
	// the backend's own typing lists a narrower `distanceModel` union than
	// WebAudio accepts; the runtime takes all three
	sound?.pannerAttr(
		spatialDefaults as Parameters<NonNullable<typeof sound>["pannerAttr"]>[0],
		id,
	);
}

/**
 * Forget a playback id, so a stopped or ended sound stops being tracked.
 * @param id - the playback id that ended
 * @internal
 * @ignore
 */
export function releaseSpatialPlacement(id: number): void {
	if (followed.delete(id)) {
		stopTickingIfIdle();
	}
}

/**
 * Forget every followed sound belonging to one clip.
 *
 * Called when a clip is unloaded, so tracking cannot outlive the sound it
 * writes positions to.
 * @param name - the clip being unloaded, or omitted for all of them
 * @internal
 * @ignore
 */
export function releaseSpatialClip(name?: string): void {
	for (const [id, entry] of followed) {
		if (name === undefined || entry.name === name) {
			followed.delete(id);
		}
	}
	stopTickingIfIdle();
}

/**
 * Drop every listener target and followed sound, and restore the defaults.
 * @internal
 * @ignore
 */
export function resetSpatialTracking(): void {
	listenerTarget = null;
	followed.clear();
	spatialDefaults = { ...PIXEL_DEFAULTS };
	stopTickingIfIdle();
}
