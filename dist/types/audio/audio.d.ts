/**
 * Initialize and configure the audio support.<br>
 * melonJS supports a wide array of audio codecs that have varying browser support :
 * <i> ("mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac")</i>.<br>
 * For a maximum browser coverage the recommendation is to use at least two of them,
 * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
 * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
 * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
 * So if you want webm to be used before mp3, you need to put the audio format in that order.
 * @function audio.init
 * @param {string} [format="mp3"] - audio format to prioritize
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
 * @function audio.hasFormat
 * @param {string} codec - audio format : "mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac"
 * @returns {boolean} return true if the given audio format is supported
 */
export function hasFormat(codec: string): boolean;
/**
 * check if audio (HTML5 or WebAudio) is supported
 * @function audio.hasAudio
 * @returns {boolean} return true if audio (HTML5 or WebAudio) is supported
 */
export function hasAudio(): boolean;
/**
 * enable audio output <br>
 * only useful if audio supported and previously disabled through
 * @function audio.enable
 * @see audio.disable
 */
export function enable(): void;
/**
 * disable audio output
 * @function audio.disable
 */
export function disable(): void;
/**
 * Load an audio file.<br>
 * <br>
 * sound item must contain the following fields :<br>
 * - name    : name of the sound<br>
 * - src     : source path<br>
 * @ignore
 */
export function load(sound: any, html5: any, onload_cb: any, onerror_cb: any): number;
/**
 * play the specified sound
 * @function audio.play
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
 * @function audio.fade
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} from - Volume to fade from (0.0 to 1.0).
 * @param {number} to - Volume to fade to (0.0 to 1.0).
 * @param {number} duration - Time in milliseconds to fade.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will fade.
 */
export function fade(sound_name: string, from: number, to: number, duration: number, id?: number | undefined): void;
/**
 * get/set the position of playback for a sound.
 * @function audio.seek
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
 * @function audio.rate
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
 * stop the specified sound on all channels
 * @function audio.stop
 * @param {string} [sound_name] - audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 */
export function stop(sound_name?: string | undefined, id?: number | undefined): void;
/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @function audio.pause
 * @param {string} sound_name - audio clip name - case sensitive
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 */
export function pause(sound_name: string, id?: number | undefined): void;
/**
 * resume the specified sound on all channels<br>
 * @function audio.resume
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
 * @function audio.playTrack
 * @param {string} sound_name - audio track name - case sensitive
 * @param {number} [volume=default] - Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 */
export function playTrack(sound_name: string, volume?: number | undefined): number;
/**
 * stop the current audio track
 * @function audio.stopTrack
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
 * @function audio.pauseTrack
 * @example
 * me.audio.pauseTrack();
 */
export function pauseTrack(): void;
/**
 * resume the previously paused audio track
 * @function audio.resumeTrack
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
 * @function audio.getCurrentTrack
 * @returns {string} audio track name
 */
export function getCurrentTrack(): string;
/**
 * set the default global volume
 * @function audio.setVolume
 * @param {number} volume - Float specifying volume (0.0 - 1.0 values accepted).
 */
export function setVolume(volume: number): void;
/**
 * get the default global volume
 * @function audio.getVolume
 * @returns {number} current volume value in Float [0.0 - 1.0] .
 */
export function getVolume(): number;
/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @function audio.mute
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
 * @function audio.unmute
 * @param {string} sound_name - audio clip name
 * @param {number} [id] - the sound instance ID. If none is passed, all sounds in group will unmute.
 */
export function unmute(sound_name: string, id?: number | undefined): void;
/**
 * mute all audio
 * @function audio.muteAll
 */
export function muteAll(): void;
/**
 * unmute all audio
 * @function audio.unmuteAll
 */
export function unmuteAll(): void;
/**
 * Returns true if audio is muted globally.
 * @function audio.muted
 * @returns {boolean} true if audio is muted globally
 */
export function muted(): boolean;
/**
 * unload specified audio track to free memory
 * @function audio.unload
 * @param {string} sound_name - audio track name - case sensitive
 * @returns {boolean} true if unloaded
 * @example
 * me.audio.unload("awesome_music");
 */
export function unload(sound_name: string): boolean;
/**
 * unload all audio to free memory
 * @function audio.unloadAll
 * @example
 * me.audio.unloadAll();
 */
export function unloadAll(): void;
/**
 * Specify either to stop on audio loading error or not<br>
 * if true, melonJS will throw an exception and stop loading<br>
 * if false, melonJS will disable sounds and output a warning message
 * in the console<br>
 * @name stopOnAudioError
 * @type {boolean}
 * @default true
 * @memberof audio
 */
export let stopOnAudioError: boolean;
