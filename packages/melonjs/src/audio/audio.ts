// external import
import { Howl, Howler } from "howler";
import { clamp } from "./../math/math.ts";
import { isDataUrl } from "./../utils/string.ts";

/**
 * Sound asset descriptor used by the audio loader
 */
interface SoundAsset {
	name: string;
	src: string;
	autoplay?: boolean;
	loop?: boolean;
	stream?: boolean;
	html5?: boolean;
}

/**
 * Load settings for audio resources
 */
interface LoadSettings {
	nocache?: string;
	withCredentials?: boolean;
}

/**
 * Panner attributes for spatial audio
 */
interface PannerAttributes {
	coneInnerAngle?: number;
	coneOuterAngle?: number;
	coneOuterGain?: number;
	distanceModel?: string;
	maxDistance?: number;
	refDistance?: number;
	rolloffFactor?: number;
	panningModel?: string;
}

/**
 * audio channel list
 * @ignore
 */
const audioTracks: Record<string, Howl> = {};

/**
 * current active track
 * @ignore
 */
let current_track_id: string | null = null;

/**
 * error retry counter
 * @ignore
 */
let retry_counter: number = 0;

/**
 * list of active audio formats
 * @ignore
 */
let audioExts: string[] = [];

/**
 * event listener callback on load error
 * @ignore
 */
const soundLoadError = function (
	sound_name: string,
	onerror_cb?: () => void,
): void {
	// check the retry counter
	if (retry_counter++ > 3) {
		// something went wrong
		const errmsg = `melonJS: failed loading ${sound_name}`;
		if (!stopOnAudioError) {
			// disable audio
			disable();
			// call error callback if defined
			onerror_cb?.();
			// warning
			console.log(`${errmsg}, disabling audio`);
		} else {
			onerror_cb?.();
			// throw an exception and stop everything !
			throw new Error(errmsg);
		}
		// else try loading again !
	} else {
		audioTracks[sound_name].load();
	}
};

/**
 * Specify either to stop on audio loading error or not<br>
 * if true, melonJS will throw an exception and stop loading<br>
 * if false, melonJS will disable sounds and output a warning message
 * in the console<br>
 * @default true
 */
// eslint-disable-next-line prefer-const
export let stopOnAudioError: boolean = true;

/**
 * Initialize and configure the audio support.<br>
 * For a maximum browser coverage the recommendation is to use at least two of them,
 * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
 * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
 * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
 * So if you want webm to be used before mp3, you need to put the audio format in that order.
 * @param [format="mp3"] - audio format to prioritize ("mp3"|"mpeg"|"opus"|"ogg"|"oga"|"wav"|"aac"|"caf"|"m4a"|"m4b"|"mp4"|"weba"|"webm"|"dolby"|"flac")
 * @returns Indicates whether audio initialization was successful
 * @example
 * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
 * if (!me.audio.init("webm,mp3")) {
 *     alert("Sorry but your browser does not support html 5 audio !");
 *     return;
 * }
 * @category Audio
 */
export function init(format: string = "mp3"): boolean {
	// convert it into an array
	audioExts = format.split(",");

	return !Howler.noAudio;
}

/**
 * check if the given audio format is supported
 * @param codec - the audio format to check for support
 * @returns return true if the given audio format is supported
 * @category Audio
 */
export function hasFormat(codec: string): boolean {
	return hasAudio() && Howler.codecs(codec);
}

/**
 * check if audio (HTML5 or WebAudio) is supported
 * @returns return true if audio (HTML5 or WebAudio) is supported
 * @category Audio
 */
export function hasAudio(): boolean {
	return !Howler.noAudio;
}

/**
 * enable audio output <br>
 * only useful if audio supported and previously disabled through
 * @see {@link disable}
 * @category Audio
 */
export function enable(): void {
	unmuteAll();
}

/**
 * disable audio output
 * @category Audio
 */
export function disable(): void {
	muteAll();
}

/**
 * Load an audio file
 * @param sound - sound asset descriptor
 * @param [onloadcb] - function to be called when the resource is loaded
 * @param [onerrorcb] - function to be called in case of error
 * @param [settings] - custom settings to apply to the request (@link https://developer.mozilla.org/en-US/docs/Web/API/fetch#options)
 * @returns the amount of asset loaded (always 1 if successful)
 * @category Audio
 */
export function load(
	sound: SoundAsset,
	onloadcb?: () => void,
	onerrorcb?: () => void,
	settings: LoadSettings = {},
): number {
	const urls: string[] = [];
	if (audioExts.length === 0) {
		throw new Error(
			"target audio extension(s) should be set through me.audio.init() before calling the preloader.",
		);
	}
	if (isDataUrl(sound.src)) {
		urls.push(sound.src);
	} else {
		for (let i = 0; i < audioExts.length; i++) {
			urls.push(
				`${sound.src + sound.name}.${audioExts[i]}${settings.nocache ?? ""}`,
			);
		}
	}

	audioTracks[sound.name] = new Howl({
		src: urls,
		volume: Howler.volume(),
		autoplay: sound.autoplay === true,
		loop: (sound.loop = true),
		html5: sound.stream === true || sound.html5 === true,
		// @ts-expect-error xhrWithCredentials is a valid Howl option but not in the type definitions
		xhrWithCredentials: settings.withCredentials,
		onloaderror() {
			soundLoadError.call(this, sound.name, onerrorcb);
		},
		onload() {
			retry_counter = 0;
			if (typeof onloadcb === "function") {
				onloadcb();
			}
		},
	});

	return 1;
}

/**
 * play the specified sound
 * @param sound_name - audio clip name - case sensitive
 * @param [loop=false] - loop audio
 * @param [onend] - Function to call when sound instance ends playing.
 * @param [volume=default] - Float specifying volume (0.0 - 1.0 values accepted).
 * @returns the sound instance ID.
 * @example
 * // play the "cling" audio clip
 * me.audio.play("cling");
 * // play & repeat the "engine" audio clip
 * me.audio.play("engine", true);
 * // play the "gameover_sfx" audio clip and call myFunc when finished
 * me.audio.play("gameover_sfx", false, myFunc);
 * // play the "gameover_sfx" audio clip with a lower volume level
 * me.audio.play("gameover_sfx", false, null, 0.5);
 * @category Audio
 */
export function play(
	sound_name: string,
	loop: boolean = false,
	onend?: (() => void) | null,
	volume?: number,
): number {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		const id = sound.play();
		if (typeof loop === "boolean") {
			// arg[0] can take different types in howler 2.0
			sound.loop(loop, id);
		}
		sound.volume(
			typeof volume === "number" ? clamp(volume, 0.0, 1.0) : Howler.volume(),
			id,
		);
		if (typeof onend === "function") {
			if (loop) {
				sound.on("end", onend, id);
			} else {
				sound.once("end", onend, id);
			}
		}
		return id;
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Fade a currently playing sound between two volumes.
 * @param sound_name - audio clip name - case sensitive
 * @param from - Volume to fade from (0.0 to 1.0).
 * @param to - Volume to fade to (0.0 to 1.0).
 * @param duration - Time in milliseconds to fade.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will fade.
 * @category Audio
 */
export function fade(
	sound_name: string,
	from: number,
	to: number,
	duration: number,
	id?: number,
): void {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		sound.fade(from, to, duration, id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * get/set the position of playback for a sound.
 * @param sound_name - audio clip name - case sensitive
 * @param args - optional seek position (in seconds) and optional sound instance ID
 * @returns return the current seek position (if no extra parameters were given)
 * @example
 * // return the current position of the background music
 * let current_pos = me.audio.seek("dst-gameforest");
 * // set back the position of the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 * @category Audio
 */
export function seek(sound_name: string, ...args: number[]): number {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return sound.seek(...args);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * get or set the rate of playback for a sound.
 * @param sound_name - audio clip name - case sensitive
 * @param args - optional playback rate (0.5 to 4.0, with 1.0 being normal speed) and optional sound instance ID
 * @returns return the current playback rate (if no extra parameters were given)
 * @example
 * // get the playback rate of the background music
 * let rate = me.audio.rate("dst-gameforest");
 * // speed up the playback of the background music
 * me.audio.rate("dst-gameforest", 2.0);
 * @category Audio
 */
export function rate(sound_name: string, ...args: number[]): number {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return sound.rate(...args);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * get or set the stereo panning for the specified sound.
 * @param sound_name - audio clip name - case sensitive
 * @param [pan] - the panning value - A value of -1.0 is all the way left and 1.0 is all the way right.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns the current panning value
 * @example
 * me.audio.stereo("cling", -1);
 * @category Audio
 */
export function stereo(sound_name: string, pan?: number, id?: number): number {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return (
			pan !== undefined ? sound.stereo(pan, id) : sound.stereo()
		) as number;
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * get or set the 3D spatial position for the specified sound.
 * @param sound_name - audio clip name - case sensitive
 * @param x - the x-position of the audio source.
 * @param y - the y-position of the audio source.
 * @param z - the z-position of the audio source.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns the current 3D spatial position: [x, y, z]
 * @category Audio
 */
export function position(
	sound_name: string,
	x: number,
	y: number,
	z: number,
	id?: number,
): number[] {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return sound.pos(x, y, z, id) as unknown as number[];
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * Get/set the direction the audio source is pointing in the 3D cartesian coordinate space.
 * Depending on how direction the sound is, based on the `cone` attributes, a sound pointing away from the listener can be quiet or silent.
 * @param sound_name - audio clip name - case sensitive
 * @param x - the x-orientation of the audio source.
 * @param y - the y-orientation of the audio source.
 * @param z - the z-orientation of the audio source.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns the current 3D spatial orientation: [x, y, z]
 * @category Audio
 */
export function orientation(
	sound_name: string,
	x: number,
	y: number,
	z: number,
	id?: number,
): number[] {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return sound.orientation(x, y, z, id) as unknown as number[];
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * get or set the panner node's attributes for a sound or group of sounds.
 * See {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics#creating_a_panner_node}
 * @param sound_name - audio clip name - case sensitive
 * @param [attributes] - the panner attributes to set
 * @param [attributes.coneInnerAngle=360] - A parameter for directional audio sources, this is an angle, in degrees, inside of which there will be no volume reduction.
 * @param [attributes.coneOuterAngle=360] - A parameter for directional audio sources, this is an angle, in degrees, outside of which the volume will be reduced to a constant value of `coneOuterGain`.
 * @param [attributes.coneOuterGain=0] - A parameter for directional audio sources, this is the gain outside of the `coneOuterAngle`. It is a linear value in the range `[0, 1]`.
 * @param [attributes.distanceModel="inverse"] - Determines algorithm used to reduce volume as audio moves away from listener. Can be `linear`, `inverse` or `exponential.
 * @param [attributes.maxDistance=10000] - The maximum distance between source and listener, after which the volume will not be reduced any further.
 * @param [attributes.refDistance=1] - A reference distance for reducing volume as source moves further from the listener. This is simply a variable of the distance model and has a different effect depending on which model is used and the scale of your coordinates. Generally, volume will be equal to 1 at this distance.
 * @param [attributes.rolloffFactor=1] - How quickly the volume reduces as source moves from listener. This is simply a variable of the distance model and can be in the range of `[0, 1]` with `linear` and `[0, ∞]` with `inverse` and `exponential`.
 * @param [attributes.panningModel="HRTF"] - Determines which spatialization algorithm is used to position audio. Can be `HRTF` or `equalpower`.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns current panner attributes.
 * @example
 * me.audio.panner("cling", {
 *    panningModel: 'HRTF',
 *    refDistance: 0.8,
 *    rolloffFactor: 2.5,
 *    distanceModel: 'exponential'
 * });
 * @category Audio
 */
export function panner(
	sound_name: string,
	attributes?: PannerAttributes,
	id?: number,
): PannerAttributes {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		return sound.pannerAttr(
			attributes as any,
			id,
		) as unknown as PannerAttributes;
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * stop the specified sound on all channels
 * @param [sound_name] - audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 * @category Audio
 */
export function stop(sound_name?: string, id?: number): void {
	if (typeof sound_name !== "undefined") {
		const sound = audioTracks[sound_name];
		if (sound && typeof sound !== "undefined") {
			sound.stop(id);
			// remove the defined onend callback (if any defined)
			sound.off("end", undefined, id);
		} else {
			throw new Error(`audio clip ${sound_name} does not exist`);
		}
	} else {
		Howler.stop();
	}
}

/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @param sound_name - audio clip name - case sensitive
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 * @category Audio
 */
export function pause(sound_name: string, id?: number): void {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		sound.pause(id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * resume the specified sound on all channels<br>
 * @param sound_name - audio clip name - case sensitive
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will resume.
 * @example
 * // play an audio clip
 * let id = me.audio.play("myClip");
 * ...
 * // pause it
 * me.audio.pause("myClip", id);
 * ...
 * // resume
 * me.audio.resume("myClip", id);
 * @category Audio
 */
export function resume(sound_name: string, id?: number): void {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		sound.play(id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * play the specified audio track<br>
 * this function automatically set the loop property to true<br>
 * and keep track of the current sound being played.
 * @param sound_name - audio track name - case sensitive
 * @param [volume=default] - Float specifying volume (0.0 - 1.0 values accepted).
 * @returns the sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 * @category Audio
 */
export function playTrack(sound_name: string, volume?: number): number {
	current_track_id = sound_name;
	return play(current_track_id, true, null, volume);
}

/**
 * stop the current audio track
 * @see {@link playTrack}
 * @example
 * // play an awesome music
 * me.audio.playTrack("awesome_music");
 * // stop the current music
 * me.audio.stopTrack();
 * @category Audio
 */
export function stopTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id].stop();
		current_track_id = null;
	}
}

/**
 * pause the current audio track
 * @example
 * me.audio.pauseTrack();
 * @category Audio
 */
export function pauseTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id].pause();
	}
}

/**
 * resume the previously paused audio track
 * @example
 * // play an awesome music
 * me.audio.playTrack("awesome_music");
 * // pause the audio track
 * me.audio.pauseTrack();
 * // resume the music
 * me.audio.resumeTrack();
 * @category Audio
 */
export function resumeTrack(): void {
	if (current_track_id !== null) {
		audioTracks[current_track_id].play();
	}
}

/**
 * returns the current track Id
 * @returns audio track name
 * @category Audio
 */
export function getCurrentTrack(): string | null {
	return current_track_id;
}

/**
 * set the default global volume
 * @param volume - Float specifying volume (0.0 - 1.0 values accepted).
 * @category Audio
 */
export function setVolume(volume: number): void {
	Howler.volume(volume);
}

/**
 * get the default global volume
 * @returns current volume value in Float [0.0 - 1.0] .
 * @category Audio
 */
export function getVolume(): number {
	return Howler.volume();
}

/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @param sound_name - audio clip name - case sensitive
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will mute.
 * @param [shouldMute=true] - True to mute and false to unmute
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 * @category Audio
 */
export function mute(
	sound_name: string,
	id?: number,
	shouldMute: boolean = true,
): void {
	const sound = audioTracks[sound_name];
	if (sound && typeof sound !== "undefined") {
		sound.mute(shouldMute, id);
	} else {
		throw new Error(`audio clip ${sound_name} does not exist`);
	}
}

/**
 * unmute the specified sound
 * @param sound_name - audio clip name
 * @param [id] - the sound instance ID. If none is passed, all sounds in group will unmute.
 * @category Audio
 */
export function unmute(sound_name: string, id?: number): void {
	mute(sound_name, id, false);
}

/**
 * mute all audio
 * @category Audio
 */
export function muteAll(): void {
	Howler.mute(true);
}

/**
 * unmute all audio
 * @category Audio
 */
export function unmuteAll(): void {
	Howler.mute(false);
}

/**
 * Returns true if audio is muted globally.
 * @returns true if audio is muted globally
 * @category Audio
 */
export function muted(): boolean {
	return (Howler as any)._muted;
}

/**
 * unload specified audio track to free memory
 * @param sound_name - audio track name - case sensitive
 * @returns true if unloaded
 * @example
 * me.audio.unload("awesome_music");
 * @category Audio
 */
export function unload(sound_name: string): boolean {
	if (!(sound_name in audioTracks)) {
		return false;
	}

	// destroy the Howl object
	audioTracks[sound_name].unload();
	delete audioTracks[sound_name];
	return true;
}

/**
 * unload all audio to free memory
 * @example
 * me.audio.unloadAll();
 * @category Audio
 */
export function unloadAll(): void {
	for (const sound_name in audioTracks) {
		if (Object.prototype.hasOwnProperty.call(audioTracks, sound_name)) {
			unload(sound_name);
		}
	}
}

/**
 * Returns the underlying {@link AudioContext} used by the audio module
 * (the same one Howler uses for file-based playback), or `null` if
 * audio is disabled or no compatible WebAudio implementation is
 * available.
 *
 * Use this when you need to build a custom WebAudio graph — procedural
 * SFX, custom filters / spatial nodes, audio analysis — without
 * spawning a second context. Browsers throttle or refuse multiple
 * `AudioContext` instances on the same page and each has its own
 * suspend-until-gesture state, so sharing matters.
 *
 * The context is lazily created on first access; the call also returns
 * the cached instance on every subsequent call.
 * @example
 * const ctx = me.audio.getAudioContext();
 * if (ctx) {
 *     const analyser = ctx.createAnalyser();
 *     ctx.destination.connect(analyser); // (illustrative)
 * }
 * @category Audio
 */
export function getAudioContext(): AudioContext | null {
	if (Howler.noAudio) return null;
	// Howler's `ctx` is declared non-nullable in @types/howler but can
	// be undefined when `noAudio` is true (some test environments).
	return Howler.ctx ?? null;
}

/**
 * Options for {@link tone}.
 * @category Audio
 */
export interface ToneOptions {
	/**
	 * Carrier frequency in Hz. Pass an array to layer multiple
	 * partials (chord, bell ring, fundamental + harmonic) — they
	 * share the gain envelope, pan, and pitch slide.
	 */
	freq: number | number[];
	/** Total sound length in seconds (envelope decays over this window). */
	duration: number;
	/** Oscillator waveform. Defaults to `"sine"`. */
	wave?: OscillatorType;
	/** Peak gain at attack end, `0..1`. Defaults to `0.1`. */
	gain?: number;
	/**
	 * Attack time in seconds — linear ramp from 0 up to `gain`.
	 * Capped at `duration / 2`. Defaults to `0.005`.
	 */
	attack?: number;
	/**
	 * Stereo pan, `-1` (full left) to `1` (full right). Defaults to `0`.
	 */
	pan?: number;
	/**
	 * Frequency multiplier applied over `duration` as an exponential
	 * ramp. `1` = no slide (default); `0.5` = slide an octave down;
	 * `2` = slide an octave up. Useful for percussive impacts (small
	 * value < 1) or rising stings (value > 1).
	 */
	pitchSlide?: number;
}

/**
 * Fire a single-shot envelope-shaped oscillator on the shared
 * {@link getAudioContext} context. Designed for the "just play a beep"
 * niche where loading an audio file is overkill — UI clicks, hit
 * confirms, retro arcade-style cues, placeholder feedback during
 * prototyping.
 *
 * Multi-partial `freq` makes chimes, bells, and simple chords a single
 * call; `pitchSlide` covers percussive pitch-drops and rising stings.
 * The context shares state with Howler's file-based playback, so the
 * usual browser autoplay gating applies: the first call after a user
 * gesture lets every subsequent call play.
 *
 * No-op if audio is disabled (`getAudioContext()` returns `null`).
 * @param opts - tone descriptor (frequency, duration, envelope, pan, slide)
 * @example
 * // simple UI click
 * me.audio.tone({ freq: 1200, duration: 0.08, pitchSlide: 0.5 });
 * // chime, panned right, two partials a fifth apart
 * me.audio.tone({ freq: [880, 1320], duration: 0.4, gain: 0.18, pan: 0.5 });
 * // descending "thud" — square wave with a wide pitch drop
 * me.audio.tone({ freq: 200, duration: 0.15, wave: "square", pitchSlide: 0.25 });
 * @category Audio
 */
export function tone(opts: ToneOptions): void {
	const ctx = getAudioContext();
	if (!ctx) return;

	const {
		freq,
		duration,
		wave = "sine",
		gain = 0.1,
		attack = 0.005,
		pan = 0,
		pitchSlide = 1,
	} = opts;

	// Browsers suspend the context until a user gesture; calling
	// `resume()` from inside a gesture-driven handler is a no-op once
	// the context is running. Best-effort — ignore the promise.
	if (ctx.state === "suspended") {
		ctx.resume().catch(() => {
			/* ignore */
		});
	}

	const dur = Math.max(0.001, duration);
	const t0 = ctx.currentTime;
	const t1 = t0 + dur;
	const atk = Math.max(0.001, Math.min(attack, dur / 2));

	// Gain envelope shared by every partial: linear attack → exp decay.
	// `exponentialRampToValueAtTime` won't ramp to 0, so we use a near-
	// zero floor that's inaudible.
	const env = ctx.createGain();
	env.gain.setValueAtTime(0, t0);
	env.gain.linearRampToValueAtTime(gain, t0 + atk);
	env.gain.exponentialRampToValueAtTime(0.0001, t1);

	const freqs = Array.isArray(freq) ? freq : [freq];
	for (const f of freqs) {
		const osc = ctx.createOscillator();
		osc.type = wave;
		osc.frequency.setValueAtTime(f, t0);
		if (pitchSlide !== 1) {
			osc.frequency.exponentialRampToValueAtTime(
				Math.max(0.01, f * pitchSlide),
				t1,
			);
		}
		osc.connect(env);
		osc.start(t0);
		// Small tail so the exponential ramp has room to settle before
		// the node is torn down.
		osc.stop(t1 + 0.02);
	}

	if (pan === 0) {
		env.connect(ctx.destination);
	} else {
		const panner = ctx.createStereoPanner();
		panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
		env.connect(panner).connect(ctx.destination);
	}
}
