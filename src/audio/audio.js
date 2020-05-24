// external import
import {Howl, Howler} from "howler";

(function () {
    /**
     * There is no constructor function for me.audio.
     * @namespace me.audio
     * @memberOf me
     */
    me.audio = (function () {
        /*
         * PRIVATE STUFF
         */

        // hold public stuff in our singleton
        var api = {};

        // audio channel list
        var audioTracks = {};

        // current music
        var current_track_id = null;

        // a retry counter
        var retry_counter = 0;

        /**
         * event listener callback on load error
         * @ignore
         */
        function soundLoadError(sound_name, onerror_cb) {
            // check the retry counter
            if (retry_counter++ > 3) {
                // something went wrong
                var errmsg = "melonJS: failed loading " + sound_name;
                if (me.sys.stopOnAudioError === false) {
                    // disable audio
                    me.audio.disable();
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
        }

        /*
         * PUBLIC STUFF
         */

        /**
         * Initialize and configure the audio support.<br>
         * melonJS supports a wide array of audio codecs that have varying browser support :
         * <i> ("mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "m4b", "mp4", "weba", "webm", "dolby", "flac")</i>.<br>
         * For a maximum browser coverage the recommendation is to use at least two of them,
         * typically default to webm and then fallback to mp3 for the best balance of small filesize and high quality,
         * webm has nearly full browser coverage with a great combination of compression and quality, and mp3 will fallback gracefully for other browsers.
         * It is important to remember that melonJS selects the first compatible sound based on the list of extensions and given order passed here.
         * So if you want webm to be used before mp3, you need to put the audio format in that order.
         * @name init
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} [audioFormat="mp3"] audio format provided
         * @return {Boolean} Indicates whether audio initialization was successful
         * @example
         * // initialize the "sound engine", giving "webm" as default desired audio format, and "mp3" as a fallback
         * if (!me.audio.init("webm,mp3")) {
         *     alert("Sorry but your browser does not support html 5 audio !");
         *     return;
         * }
         */
        api.init = function (audioFormat) {
            if (!me.initialized) {
                throw new Error("me.audio.init() called before engine initialization.");
            }
            // if no param is given to init we use mp3 by default
            audioFormat = typeof audioFormat === "string" ? audioFormat : "mp3";
            // convert it into an array
            this.audioFormats = audioFormat.split(",");

            return !Howler.noAudio;
        };

        /**
         * return true if audio (HTML5 or WebAudio) is supported
         * @see me.audio#hasAudio
         * @name hasAudio
         * @memberOf me.audio
         * @public
         * @function
         */
        api.hasAudio = function () {
            return !Howler.noAudio;
        };

        /**
         * enable audio output <br>
         * only useful if audio supported and previously disabled through
         *
         * @see me.audio#disable
         * @name enable
         * @memberOf me.audio
         * @public
         * @function
         */
        api.enable = function () {
            this.unmuteAll();
        };

        /**
         * disable audio output
         *
         * @name disable
         * @memberOf me.audio
         * @public
         * @function
         */
        api.disable = function () {
            this.muteAll();
        };

        /**
         * Load an audio file.<br>
         * <br>
         * sound item must contain the following fields :<br>
         * - name    : name of the sound<br>
         * - src     : source path<br>
         * @ignore
         */
        api.load = function (sound, html5, onload_cb, onerror_cb) {
            var urls = [];
            if (typeof(this.audioFormats) === "undefined" || this.audioFormats.length === 0) {
                throw new Error("target audio extension(s) should be set through me.audio.init() before calling the preloader.");
            }
            for (var i = 0; i < this.audioFormats.length; i++) {
                urls.push(sound.src + sound.name + "." + this.audioFormats[i] + me.loader.nocache);
            }
            audioTracks[sound.name] = new Howl({
                src : urls,
                volume : Howler.volume(),
                html5 : html5 === true,
                xhrWithCredentials : me.loader.withCredentials,
                /**
                 * @ignore
                 */
                onloaderror : function () {
                    soundLoadError.call(me.audio, sound.name, onerror_cb);
                },
                /**
                 * @ignore
                 */
                onload : function () {
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
         * @name play
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Boolean} [loop=false] loop audio
         * @param {Function} [onend] Function to call when sound instance ends playing.
         * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
         * @return {Number} the sound instance ID.
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
        api.play = function (sound_name, loop, onend, volume) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                var id = sound.play();
                if (typeof loop === "boolean") {
                    // arg[0] can take different types in howler 2.0
                    sound.loop(loop, id);
                }
                sound.volume(typeof(volume) === "number" ? me.Math.clamp(volume, 0.0, 1.0) : Howler.volume(), id);
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
         * @name fade
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} from Volume to fade from (0.0 to 1.0).
         * @param {Number} to Volume to fade to (0.0 to 1.0).
         * @param {Number} duration Time in milliseconds to fade.
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will fade.
         */
        api.fade = function (sound_name, from, to, duration, id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.fade(from, to, duration, id);
            } else {
                throw new Error("audio clip " + sound_name + " does not exist");
            }
        };

        /**
         * get/set the position of playback for a sound.
         * @name seek
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [seek]  The position to move current playback to (in seconds).
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will changed.
         * @return return the current seek position (if no extra parameters were given)
         * @example
         * // return the current position of the background music
         * var current_pos = me.audio.seek("dst-gameforest");
         * // set back the position of the background music to the beginning
         * me.audio.seek("dst-gameforest", 0);
         */
        api.seek = function (sound_name, seek, id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                return sound.seek.apply(sound, Array.prototype.slice.call(arguments, 1));
            } else {
                throw new Error("audio clip " + sound_name + " does not exist");
            }
        };

        /**
         * get or set the rate of playback for a sound.
         * @name rate
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
         * @return return the current playback rate (if no extra parameters were given)
         * @example
         * // get the playback rate of the background music
         * var rate = me.audio.rate("dst-gameforest");
         * // speed up the playback of the background music
         * me.audio.rate("dst-gameforest", 2.0);
         */
        api.rate = function (sound_name, rate, id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                return sound.rate.apply(sound, Array.prototype.slice.call(arguments, 1));
            } else {
                throw new Error("audio clip " + sound_name + " does not exist");
            }
        };

        /**
         * stop the specified sound on all channels
         * @name stop
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} [sound_name] audio clip name (case sensitive). If none is passed, all sounds are stopped.
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
         * @example
         * me.audio.stop("cling");
         */
        api.stop = function (sound_name, id) {
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
         * @name pause
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will pause.
         * @example
         * me.audio.pause("cling");
         */
        api.pause = function (sound_name, id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.pause(id);
            } else {
                throw new Error("audio clip " + sound_name + " does not exist");
            }
        };

        /**
         * resume the specified sound on all channels<br>
         * @name resume
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will resume.
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
        api.resume = function (sound_name, id) {
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
         * @name playTrack
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio track name - case sensitive
         * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
         * @return {Number} the sound instance ID.
         * @example
         * me.audio.playTrack("awesome_music");
         */
        api.playTrack = function (sound_name, volume) {
            current_track_id = sound_name;
            return me.audio.play(
                current_track_id,
                true,
                null,
                volume
            );
        };

        /**
         * stop the current audio track
         *
         * @see me.audio#playTrack
         * @name stopTrack
         * @memberOf me.audio
         * @public
         * @function
         * @example
         * // play a awesome music
         * me.audio.playTrack("awesome_music");
         * // stop the current music
         * me.audio.stopTrack();
         */
        api.stopTrack = function () {
            if (current_track_id !== null) {
                audioTracks[current_track_id].stop();
                current_track_id = null;
            }
        };

        /**
         * pause the current audio track
         *
         * @name pauseTrack
         * @memberOf me.audio
         * @public
         * @function
         * @example
         * me.audio.pauseTrack();
         */
        api.pauseTrack = function () {
            if (current_track_id !== null) {
                audioTracks[current_track_id].pause();
            }
        };

        /**
         * resume the previously paused audio track
         *
         * @name resumeTrack
         * @memberOf me.audio
         * @public
         * @function
         * @example
         * // play an awesome music
         * me.audio.playTrack("awesome_music");
         * // pause the audio track
         * me.audio.pauseTrack();
         * // resume the music
         * me.audio.resumeTrack();
         */
        api.resumeTrack = function () {
            if (current_track_id !== null) {
                audioTracks[current_track_id].play();
            }
        };

        /**
         * returns the current track Id
         * @name getCurrentTrack
         * @memberOf me.audio
         * @public
         * @function
         * @return {String} audio track name
         */
        api.getCurrentTrack = function () {
            return current_track_id;
        };

        /**
         * set the default global volume
         * @name setVolume
         * @memberOf me.audio
         * @public
         * @function
         * @param {Number} volume Float specifying volume (0.0 - 1.0 values accepted).
         */
        api.setVolume = function (volume) {
            Howler.volume(volume);
        };

        /**
         * get the default global volume
         * @name getVolume
         * @memberOf me.audio
         * @public
         * @function
         * @returns {Number} current volume value in Float [0.0 - 1.0] .
         */
        api.getVolume = function () {
            return Howler.volume();
        };

        /**
         * mute or unmute the specified sound, but does not pause the playback.
         * @name mute
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
         * @param {Boolean} [mute=true] True to mute and false to unmute
         * @example
         * // mute the background music
         * me.audio.mute("awesome_music");
         */
        api.mute = function (sound_name, id, mute) {
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
         * @name unmute
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will unmute.
         */
        api.unmute = function (sound_name, id) {
            api.mute(sound_name, id, false);
        };

        /**
         * mute all audio
         * @name muteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        api.muteAll = function () {
            Howler.mute(true);
        };

        /**
         * unmute all audio
         * @name unmuteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        api.unmuteAll = function () {
            Howler.mute(false);
        };

        /**
         * Returns true if audio is muted globally.
         * @name muted
         * @memberOf me.audio
         * @public
         * @function
         * @return {Boolean} true if audio is muted globally
         */
        api.muted = function () {
            return Howler._muted;
        };

        /**
         * unload specified audio track to free memory
         *
         * @name unload
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio track name - case sensitive
         * @return {Boolean} true if unloaded
         * @example
         * me.audio.unload("awesome_music");
         */
        api.unload = function (sound_name) {
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
         *
         * @name unloadAll
         * @memberOf me.audio
         * @public
         * @function
         * @example
         * me.audio.unloadAll();
         */
        api.unloadAll = function () {
            for (var sound_name in audioTracks) {
                if (audioTracks.hasOwnProperty(sound_name)) {
                    api.unload(sound_name);
                }
            }
        };

        // return our object
        return api;
    })();

})();
