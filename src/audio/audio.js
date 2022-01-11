// external import
import {Howl, Howler} from "howler";
import {clamp} from "./../math/math.js";
import loader from "./../loader/loader.js";

/**
 * @namespace audio
 * @memberof me
 */

/**
 * audio channel list
 * @ignore
 */
var audioTracks = {};

/**
 * current active track
 * @ignore
 */
var current_track_id = null;

/**
 * error retry counter
 * @ignore
 */
var retry_counter = 0;

/**
 * list of active audio formats
 * @ignore
 */
var audioExts = [];

/**
 * event listener callback on load error
 * @ignore
 */
var soundLoadError = function (sound_name, onerror_cb) {
    // check the retry counter
    if (retry_counter++ > 3) {
        // something went wrong
        var errmsg = "melonJS: failed loading " + sound_name;
        if (stopOnAudioError === false) {
            // disable audio
            disable();
            // call error callback if defined
            if (onerror_cb) {
                onerror_cb();
            }
            // warning
            console.log(errmsg + ", disabling audio");
        }
        else {
            // throw an exception and stop everything !
            throw new Error(errmsg);
        }
    // else try loading again !
    }
    else {
        audioTracks[sound_name].load();
    }
};

/**
 * Specify either to stop on audio loading error or not<br>
 * if true, melonJS will throw an exception and stop loading<br>
 * if false, melonJS will disable sounds and output a warning message
 * in the console<br>
 * @name stopOnAudioError
 * @type {boolean}
 * @default true
 * @memberof me.audio
 */
export let stopOnAudioError = true;

/**
 * Initialize and configure the audio support.<br>
 * melonJS supports a wide array of audio codecs that have varying browser support :
 * <i> ("mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac")</i>.<br>
 * For a maximum browser coverage the recommendation is to use at least two of them,
 * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
 * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
 * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
 * So if you want webm to be used before mp3, you need to put the audio format in that order.
 * @function me.audio.init
 * @param {string} [format="mp3"] audio format to prioritize
 * @returns {boolean} Indicates whether audio initialization was successful
 * @example
 * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
 * if (!me.audio.init("webm,mp3")) {
 *     alert("Sorry but your browser does not support html 5 audio !");
 *     return;
 * }
 */
 export function init(format = "mp3") {
    // convert it into an array
    audioExts = format.split(",");

    return !Howler.noAudio;
};

/**
 * check if the given audio format is supported
 * @function me.audio.hasFormat
 * @param {string} codec audio format : "mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac"
 * @returns {boolean} return true if the given audio format is supported
 */
export function hasFormat(codec) {
    return hasAudio() && Howler.codecs(codec);
};

/**
 * check if audio (HTML5 or WebAudio) is supported
 * @function me.audio.hasAudio
 * @returns {boolean} return true if audio (HTML5 or WebAudio) is supported
 */
export function hasAudio() {
    return !Howler.noAudio;
};

/**
 * enable audio output <br>
 * only useful if audio supported and previously disabled through
 * @function me.audio.enable
 * @see me.audio#disable
 */
export function enable() {
    unmuteAll();
};

/**
 * disable audio output
 * @function me.audio.disable
 */
export function disable() {
    muteAll();
};

/**
 * Load an audio file.<br>
 * <br>
 * sound item must contain the following fields :<br>
 * - name    : name of the sound<br>
 * - src     : source path<br>
 * @ignore
 */
export function load(sound, html5, onload_cb, onerror_cb) {
    var urls = [];
    if (audioExts.length === 0) {
        throw new Error("target audio extension(s) should be set through me.audio.init() before calling the preloader.");
    }
    for (var i = 0; i < audioExts.length; i++) {
        urls.push(sound.src + sound.name + "." + audioExts[i] + loader.nocache);
    }
    audioTracks[sound.name] = new Howl({
        src : urls,
        volume : Howler.volume(),
        html5 : html5 === true,
        xhrWithCredentials : loader.withCredentials,
        /**
         * @ignore
         */
        onloaderror() {
            soundLoadError.call(this, sound.name, onerror_cb);
        },
        /**
         * @ignore
         */
        onload() {
            retry_counter = 0;
            if (onload_cb) {
                onload_cb();
            }
        }
    });

    return 1;
};

/**
 * play the specified sound
 * @function me.audio.play
 * @param {string} sound_name audio clip name - case sensitive
 * @param {boolean} [loop=false] loop audio
 * @param {Function} [onend] Function to call when sound instance ends playing.
 * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
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
export function play(sound_name, loop = false, onend, volume) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        var id = sound.play();
        if (typeof loop === "boolean") {
            // arg[0] can take different types in howler 2.0
            sound.loop(loop, id);
        }
        sound.volume(typeof(volume) === "number" ? clamp(volume, 0.0, 1.0) : Howler.volume(), id);
        if (typeof(onend) === "function") {
            if (loop === true) {
                sound.on("end", onend, id);
            }
            else {
                sound.once("end", onend, id);
            }
        }
        return id;
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * Fade a currently playing sound between two volumee.
 * @function me.audio.fade
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} from Volume to fade from (0.0 to 1.0).
 * @param {number} to Volume to fade to (0.0 to 1.0).
 * @param {number} duration Time in milliseconds to fade.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will fade.
 */
export function fade(sound_name, from, to, duration, id) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        sound.fade(from, to, duration, id);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * get/set the position of playback for a sound.
 * @function me.audio.seek
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [seek] the position to move current playback to (in seconds).
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will changed.
 * @returns {number} return the current seek position (if no extra parameters were given)
 * @example
 * // return the current position of the background music
 * var current_pos = me.audio.seek("dst-gameforest");
 * // set back the position of the background music to the beginning
 * me.audio.seek("dst-gameforest", 0);
 */
export function seek(sound_name, ...args) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        return sound.seek(...args);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * get or set the rate of playback for a sound.
 * @function me.audio.rate
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
 * @returns {number} return the current playback rate (if no extra parameters were given)
 * @example
 * // get the playback rate of the background music
 * var rate = me.audio.rate("dst-gameforest");
 * // speed up the playback of the background music
 * me.audio.rate("dst-gameforest", 2.0);
 */
export function rate(sound_name, ...args) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        return sound.rate(...args);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * stop the specified sound on all channels
 * @function me.audio.stop
 * @param {string} [sound_name] audio clip name (case sensitive). If none is passed, all sounds are stopped.
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
 * @example
 * me.audio.stop("cling");
 */
export function stop(sound_name, id) {
    if (typeof sound_name !== "undefined") {
        var sound = audioTracks[sound_name];
        if (sound && typeof sound !== "undefined") {
            sound.stop(id);
            // remove the defined onend callback (if any defined)
            sound.off("end", undefined, id);
        } else {
            throw new Error("audio clip " + sound_name + " does not exist");
        }
    } else {
        Howler.stop();
    }
};

/**
 * pause the specified sound on all channels<br>
 * this function does not reset the currentTime property
 * @function me.audio.pause
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will pause.
 * @example
 * me.audio.pause("cling");
 */
export function pause(sound_name, id) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        sound.pause(id);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * resume the specified sound on all channels<br>
 * @function me.audio.resume
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will resume.
 * @example
 * // play a audio clip
 * var id = me.audio.play("myClip");
 * ...
 * // pause it
 * me.audio.pause("myClip", id);
 * ...
 * // resume
 * me.audio.resume("myClip", id);
 */
export function resume(sound_name, id) {
    var sound = audioTracks[sound_name];
    if (sound && typeof sound !== "undefined") {
        sound.play(id);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * play the specified audio track<br>
 * this function automatically set the loop property to true<br>
 * and keep track of the current sound being played.
 * @function me.audio.playTrack
 * @param {string} sound_name audio track name - case sensitive
 * @param {number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
 * @returns {number} the sound instance ID.
 * @example
 * me.audio.playTrack("awesome_music");
 */
export function playTrack(sound_name, volume) {
    current_track_id = sound_name;
    return play(
        current_track_id,
        true,
        null,
        volume
    );
};

/**
 * stop the current audio track
 * @function me.audio.stopTrack
 * @see me.audio#playTrack
 * @example
 * // play a awesome music
 * me.audio.playTrack("awesome_music");
 * // stop the current music
 * me.audio.stopTrack();
 */
export function stopTrack() {
    if (current_track_id !== null) {
        audioTracks[current_track_id].stop();
        current_track_id = null;
    }
};

/**
 * pause the current audio track
 * @function me.audio.pauseTrack
 * @example
 * me.audio.pauseTrack();
 */
export function pauseTrack() {
    if (current_track_id !== null) {
        audioTracks[current_track_id].pause();
    }
};

/**
 * resume the previously paused audio track
 * @function me.audio.resumeTrack
 * @example
 * // play an awesome music
 * me.audio.playTrack("awesome_music");
 * // pause the audio track
 * me.audio.pauseTrack();
 * // resume the music
 * me.audio.resumeTrack();
 */
export function resumeTrack() {
    if (current_track_id !== null) {
        audioTracks[current_track_id].play();
    }
};

/**
 * returns the current track Id
 * @function me.audio.getCurrentTrack
 * @returns {string} audio track name
 */
export function getCurrentTrack() {
    return current_track_id;
};

/**
 * set the default global volume
 * @function me.audio.setVolume
 * @param {number} volume Float specifying volume (0.0 - 1.0 values accepted).
 */
export function setVolume(volume) {
    Howler.volume(volume);
};

/**
 * get the default global volume
 * @function me.audio.getVolume
 * @returns {number} current volume value in Float [0.0 - 1.0] .
 */
export function getVolume() {
    return Howler.volume();
};

/**
 * mute or unmute the specified sound, but does not pause the playback.
 * @function me.audio.mute
 * @param {string} sound_name audio clip name - case sensitive
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
 * @param {boolean} [mute=true] True to mute and false to unmute
 * @example
 * // mute the background music
 * me.audio.mute("awesome_music");
 */
export function mute(sound_name, id, mute) {
    // if not defined : true
    mute = (typeof(mute) === "undefined" ? true : !!mute);
    var sound = audioTracks[sound_name];
    if (sound && typeof(sound) !== "undefined") {
        sound.mute(mute, id);
    } else {
        throw new Error("audio clip " + sound_name + " does not exist");
    }
};

/**
 * unmute the specified sound
 * @function me.audio.unmute
 * @param {string} sound_name audio clip name
 * @param {number} [id] the sound instance ID. If none is passed, all sounds in group will unmute.
 */
export function unmute(sound_name, id) {
    mute(sound_name, id, false);
};

/**
 * mute all audio
 * @function me.audio.muteAll
 */
export function muteAll() {
    Howler.mute(true);
};

/**
 * unmute all audio
 * @function me.audio.unmuteAll
 */
export function unmuteAll() {
    Howler.mute(false);
};

/**
 * Returns true if audio is muted globally.
 * @function me.audio.muted
 * @returns {boolean} true if audio is muted globally
 */
export function muted() {
    return Howler._muted;
};

/**
 * unload specified audio track to free memory
 * @function me.audio.unload
 * @param {string} sound_name audio track name - case sensitive
 * @returns {boolean} true if unloaded
 * @example
 * me.audio.unload("awesome_music");
 */
export function unload(sound_name) {
    if (!(sound_name in audioTracks)) {
        return false;
    }

    // destroy the Howl object
    audioTracks[sound_name].unload();
    delete audioTracks[sound_name];
    return true;
};

/**
 * unload all audio to free memory
 * @function me.audio.unloadAll
 * @function
 * @example
 * me.audio.unloadAll();
 */
export function unloadAll() {
    for (var sound_name in audioTracks) {
        if (audioTracks.hasOwnProperty(sound_name)) {
            unload(sound_name);
        }
    }
};
