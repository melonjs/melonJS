/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2016, Olivier Biot, Jason Oster, Aaron McLeod
 * http://www.melonjs.org
 *
 * Audio Mngt Objects
 *
 *
 */
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
                    throw new api.Error(errmsg);
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
         * Base class for Audio exception handling.
         * @name Error
         * @class
         * @memberOf me.audio
         * @constructor
         * @param {String} msg Error message.
         */
        api.Error = me.Error.extend({
            init : function (msg) {
                this._super(me.Error, "init", [ msg ]);
                this.name = "me.audio.Error";
            }
        });

        /**
         * configure and initialize the audio engine<br>
         * melonJS will try to load audio files corresponding to the browser supported audio format(s)<br>
         * below is the list of supported file extentions : <br>
         * <i>"mp3", "mpeg", opus", "ogg", "oga", "wav", "aac", "caf", "m4a", "mp4", "weba", "webm", "dolby" </i> <br>
         * keep in mind that not all browsers can play all audio formats, and if no compatible codecs are detected, audio will be disabled.
         * @name init
         * @memberOf me.audio
         * @public
         * @function
         * @param {String}
         *          [audioFormat="mp3"] audio format provided
         * @return {Boolean} Indicates whether audio initialization was successful
         * @example
         * // initialize the "sound engine", giving "mp3" and "ogg" as desired audio format
         * // i.e. on Safari, the loader will load all audio.mp3 files,
         * // on Opera the loader will however load audio.ogg files
         * if (!me.audio.init("mp3,ogg")) {
         *     alert("Sorry but your browser does not support html 5 audio !");
         *     return;
         * }
         */
        api.init = function (audioFormat) {
            if (!me.initialized) {
                throw new api.Error("me.audio.init() called before engine initialization.");
            }
            // if no param is given to init we use mp3 by default
            audioFormat = typeof audioFormat === "string" ? audioFormat : "mp3";
            // convert it into an array
            this.audioFormats = audioFormat.split(",");

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
                throw new api.Error("target audio extension(s) should be set through me.audio.init() before calling the preloader.");
            }
            for (var i = 0; i < this.audioFormats.length; i++) {
                urls.push(sound.src + sound.name + "." + this.audioFormats[i] + me.loader.nocache);
            }
            audioTracks[sound.name] = new Howl({
                src : urls,
                volume : Howler.volume(),
                html5 : html5 === true,
                onloaderror : function () {
                    soundLoadError.call(me.audio, sound.name, onerror_cb);
                },
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
                var instance_id = sound.play();
                if (typeof loop === "boolean") {
                    // arg[0] can take different types in howler 2.0
                    sound.loop(loop, instance_id);
                }
                sound.volume(typeof(volume) === "number" ? volume.clamp(0.0, 1.0) : Howler.volume(), instance_id);
                if (typeof(onend) === "function") {
                    if (loop === true) {
                        sound.on("end", onend, instance_id);
                    }
                    else {
                        sound.once("end", onend, instance_id);
                    }
                }
                return instance_id;
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
        api.fade = function (sound_name, from, to, duration, instance_id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.fade(from, to, duration, instance_id);
            }
        };

        /**
         * change the playback rate of a sound.
         * @name rate
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [rate] playback rate : 0.5 to 4.0, with 1.0 being normal speed.
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will be changed.
         * @return current playback rate.
         * @example
         * // speed up the playback of the background music
         * me.audio.rate("dst-gameforest", 2.0);
         *
         */
        api.rate = function (sound_name, rate, instance_id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                var _args = [];
                if (typeof rate !== "undefined") {
                    _args[_args.length] = rate;
                }
                if (typeof instance_id !== "undefined") {
                    _args[_args.length] = instance_id;
                }
                return sound.rate.apply(sound, _args);
            }
        };

        /**
         * stop the specified sound on all channels
         * @name stop
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will stop.
         * @example
         * me.audio.stop("cling");
         */
        api.stop = function (sound_name, instance_id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.stop(instance_id);
                // remove the defined onend callback (if any defined)
                sound.off("end", instance_id);
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
        api.pause = function (sound_name, instance_id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.pause(instance_id);
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
        api.resume = function (sound_name, instance_id) {
            var sound = audioTracks[sound_name];
            if (sound && typeof sound !== "undefined") {
                sound.play(instance_id);
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
         * mute the specified sound
         * @name mute
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_name audio clip name - case sensitive
         * @param {Number} [id] the sound instance ID. If none is passed, all sounds in group will mute.
         */
        api.mute = function (sound_name, instance_id, mute) {
            // if not defined : true
            mute = (typeof(mute) === "undefined" ? true : !!mute);
            var sound = audioTracks[sound_name];
            if (sound && typeof(sound) !== "undefined") {
                sound.mute(mute, instance_id);
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
        api.unmute = function (sound_name, instance_id) {
            api.mute(sound_name, instance_id, false);
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
            sound_name = sound_name;
            if (!(sound_name in audioTracks)) {
                return false;
            }

            // destroy the Howl object
            audioTracks[sound_name].unload();
            if (typeof(audioTracks[sound_name].dispose) === "function") {
                // cocoonJS implements a dispose function to free
                // corresponding allocated audio in memory
                audioTracks[sound_name].dispose();
            }
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
