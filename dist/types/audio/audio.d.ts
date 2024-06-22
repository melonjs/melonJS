/**
 * Initialize and configure the audio support.<br>
 * For a maximum browser coverage the recommendation is to use at least two of them,
 * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
 * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
 * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
 * So if you want webm to be used before mp3, you need to put the audio format in that order.
 * @memberof audio
 * @param {string} [format="mp3"] - audio format to prioritize ("mp3"|"mpeg"|"opus"|"ogg"|"oga"|"wav"|"aac"|"caf"|"m4a"|"m4b"|"mp4"|"weba"|"webm"|"dolby"|"flac")
 * @returns {boolean} Indicates whether audio initialization was successful
 * @example
 * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
 * if (!me.audio.init("webm,mp3")) {
 *     alert("Sorry but your browser does not support html 5 audio !");
 *     return;
 * }
 */
export function init(format?: string | undefined): boolean;
/**
 * check if the given audio format is supported
 * @memberof audio
 * @param {"mp3"|"mpeg"|"opus"|"ogg"|"oga"|"wav"|"aac"|"caf"|"m4a"|"m4b"|"mp4"|"weba"|"webm"|"dolby"|"flac"} codec - the audio format to check for support
 * @returns {boolean} return true if the given audio format is supported
 */
export function hasFormat(codec: "mp3" | "mpeg" | "opus" | "ogg" | "oga" | "wav" | "aac" | "caf" | "m4a" | "m4b" | "mp4" | "weba" | "webm" | "dolby" | "flac"): boolean;
/**
 * check if audio (HTML5 or WebAudio) is supported
 * @memberof audio
 * @returns {boolean} return true if audio (HTML5 or WebAudio) is supported
 */
export function hasAudio(): boolean;
/**
 * enable audio output <br>
 * only useful if audio supported and previously disabled through
 * @memberof audio
 * @see audio.disable
 */
export function enable(): void;
/**
 * disable audio output
 * @memberof audio
 */
export function disable(): void;
/**
 * Load an audio file
 * @memberof audio
 * @param {Asset} sound
 * @param {Function} [onloadcb] - function to be called when the resource is loaded
 * @param {Function} [onerrorcb] - function to be called in case of error
 * @param {Object} [settings] - custom settings to apply to the request (@link https://developer.mozilla.org/en-US/docs/Web/API/fetch#options)
 * @returns {number} the amount of asset loaded (always 1 if successfull)
 */
export function load(sound: Asset, onloadcb?: Function | undefined, onerrorcb?: Function | undefined, settings?: Object | undefined): number;
/**
 * play the specified sound
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {boolean} [loop=false] - loop audio
 * @param {Function} [onend] - Function to call when sound instance ends playing.
 * @param {number} [volume=default] - Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * // play the "cling" audio clip
 * me.audio.play("cling");
 * // play & repeat the "engine" audio clip
 * me.audio.play("engine", true);
 * // play the "gameover_sfx" audio clip and call myFunc when finished
 * me.audio.play("gameover_sfx", false, myFunc);
 * // play the "gameover_sfx" audio clip with a lower volume level
 * me.audio.play("gameover_sfx", false, null, 0.5);
 */
export function play(sound_name: string, loop?: boolean | undefined, onend?: Function | undefined, volume?: number | undefined): number;
/**
 * Fade a currently playing sound between two volumee.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} from - Volume to fade from (0.0 to 1.0).
 * @param {number} to - Volume to fade to (0.0 to 1.0).
 * @param {number} duration - Time in milliseconds to fade.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will fade.
 */
export function fade(sound_name: string, from: number, to: number, duration: number, id?: number | undefined): void;
/**
 * get/set the position of playback for a sound.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [seek] - the position to move current playback to (in seconds).
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will changed.
 * @returns {number} return the current seek position (if no extra parameters were given)
 * @example
 * // return the current position of the background music
 * let current_pos = me.audio.seek("dst-gameforest");
 * // set back the position of the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 */
export function seek(sound_name: string, ...args: any[]): number;
/**
 * get or set the rate of playback for a sound.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [rate] - playback rate : 0.5 to 4.0, with 1.0 being normal speed.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns {number} return the current playback rate (if no extra parameters were given)
 * @example
 * // get the playback rate of the background music
 * let rate = me.audio.rate("dst-gameforest");
 * // speed up the playback of the background music
 * me.audio.rate("dst-gameforest", 2.0);
 */
export function rate(sound_name: string, ...args: any[]): number;
/**
 * get or set the stereo panning for the specified sound.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [pan] - the panning value - A value of -1.0 is all the way left and 1.0 is all the way right.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @return {number} the current panning value
 * @example
 * me.audio.stereo("cling", -1);
 */
export function stereo(sound_name: string, pan?: number | undefined, id?: number | undefined): number;
/**
 * get or set the 3D spatial position for the specified sound.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param  {Number} x - the x-position of the audio source.
 * @param  {Number} y - the y-position of the audio source.
 * @param  {Number} z - the z-position of the audio source.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @return {Array} the current 3D spatial position: [x, y, z]
 */
export function position(sound_name: string, x: number, y: number, z: number, id?: number | undefined): any[];
/**
 * Get/set the direction the audio source is pointing in the 3D cartesian coordinate space.
 * Depending on how direction the sound is, based on the `cone` attributes, a sound pointing away from the listener can be quiet or silent.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param  {Number} x - the x-orientation of the audio source.
 * @param  {Number} y - the y-orientation of the audio source.
 * @param  {Number} z - the z-orientation of the audio source.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @return {Array} the current 3D spatial orientation: [x, y, z]
 */
export function orientation(sound_name: string, x: number, y: number, z: number, id?: number | undefined): any[];
/**
 * get or set the panner node's attributes for a sound or group of sounds.
 * See {@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics#creating_a_panner_node}
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {object} [attribute] - the panner attributes to set
 * @param {string} [settings.coneInnerAngle=360] - A parameter for directional audio sources, this is an angle, in degrees, inside of which there will be no volume reduction.
 * @param {string} [settings.coneOuterAngle=360] - A parameter for directional audio sources, this is an angle, in degrees, outside of which the volume will be reduced to a constant value of `coneOuterGain`.
 * @param {string} [settings.coneOuterGain=0] - A parameter for directional audio sources, this is the gain outside of the `coneOuterAngle`. It is a linear value in the range `[0, 1]`.
 * @param {string} [settings.distanceModel="inverse"] - Determines algorithm used to reduce volume as audio moves away from listener. Can be `linear`, `inverse` or `exponential.
 * @param {string} [settings.maxDistance=10000] - The maximum distance between source and listener, after which the volume will not be reduced any further.
 * @param {string} [settings.refDistance=1] - A reference distance for reducing volume as source moves further from the listener. This is simply a variable of the distance model and has a different effect depending on which model is used and the scale of your coordinates. Generally, volume will be equal to 1 at this distance.
 * @param {string} [settings.rolloffFactor=1] - How quickly the volume reduces as source moves from listener. This is simply a variable of the distance model and can be in the range of `[0, 1]` with `linear` and `[0, ∞]` with `inverse` and `exponential`.
 * @param {string} [settings.panningModel="HRTF"] - Determines which spatialization algorithm is used to position audio. Can be `HRTF` or `equalpower`.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will be changed.
 * @return {Object} current panner attributes.
 * @example
 * me.audio.panner("cling", {
 *    panningModel: 'HRTF',
 *    refDistance: 0.8,
 *    rolloffFactor: 2.5,
 *    distanceModel: 'exponential'
 * });
 */
export function panner(sound_name: string, attributes: any, id?: number | undefined): Object;
/**
 * stop the specified sound on all channels
 * @memberof audio
 * @param {string} [sound_name] - audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 */
export function stop(sound_name?: string | undefined, id?: number | undefined): void;
/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 */
export function pause(sound_name: string, id?: number | undefined): void;
/**
 * resume the specified sound on all channels<br>
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will resume.
 * @example
 * // play a audio clip
 * let id = me.audio.play("myClip");
 * ...
 * // pause it
 * me.audio.pause("myClip", id);
 * ...
 * // resume
 * me.audio.resume("myClip", id);
 */
export function resume(sound_name: string, id?: number | undefined): void;
/**
 * play the specified audio track<br>
 * this function automatically set the loop property to true<br>
 * and keep track of the current sound being played.
 * @memberof audio
 * @param {string} sound_name - audio track name - case sensitive
 * @param {number} [volume=default] - Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 */
export function playTrack(sound_name: string, volume?: number | undefined): number;
/**
 * stop the current audio track
 * @memberof audio
 * @see audio.playTrack
 * @example
 * // play a awesome music
 * me.audio.playTrack("awesome_music");
 * // stop the current music
 * me.audio.stopTrack();
 */
export function stopTrack(): void;
/**
 * pause the current audio track
 * @memberof audio
 * @example
 * me.audio.pauseTrack();
 */
export function pauseTrack(): void;
/**
 * resume the previously paused audio track
 * @memberof audio
 * @example
 * // play an awesome music
 * me.audio.playTrack("awesome_music");
 * // pause the audio track
 * me.audio.pauseTrack();
 * // resume the music
 * me.audio.resumeTrack();
 */
export function resumeTrack(): void;
/**
 * returns the current track Id
 * @memberof audio
 * @returns {string} audio track name
 */
export function getCurrentTrack(): string;
/**
 * set the default global volume
 * @memberof audio
 * @param {number} volume - Float specifying volume (0.0 - 1.0 values accepted).
 */
export function setVolume(volume: number): void;
/**
 * get the default global volume
 * @memberof audio
 * @returns {number} current volume value in Float [0.0 - 1.0] .
 */
export function getVolume(): number;
/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @memberof audio
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will mute.
 * @param {boolean} [mute=true] - True to mute and false to unmute
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 */
export function mute(sound_name: string, id?: number | undefined, mute?: boolean | undefined): void;
/**
 * unmute the specified sound
 * @memberof audio
 * @param {string} sound_name - audio clip name
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will unmute.
 */
export function unmute(sound_name: string, id?: number | undefined): void;
/**
 * mute all audio
 * @memberof audio
 */
export function muteAll(): void;
/**
 * unmute all audio
 * @memberof audio
 */
export function unmuteAll(): void;
/**
 * Returns true if audio is muted globally.
 * @memberof audio
 * @returns {boolean} true if audio is muted globally
 */
export function muted(): boolean;
/**
 * unload specified audio track to free memory
 * @memberof audio
 * @param {string} sound_name - audio track name - case sensitive
 * @returns {boolean} true if unloaded
 * @example
 * me.audio.unload("awesome_music");
 */
export function unload(sound_name: string): boolean;
/**
 * unload all audio to free memory
 * @memberof audio
 * @example
 * me.audio.unloadAll();
 */
export function unloadAll(): void;
/**
 * Specify either to stop on audio loading error or not<br>
 * if true, melonJS will throw an exception and stop loading<br>
 * if false, melonJS will disable sounds and output a warning message
 * in the console<br>
 * @type {boolean}
 * @default true
 * @memberof audio
 */
export let stopOnAudioError: boolean;
import type { Asset } from "./../loader/loader.js";
