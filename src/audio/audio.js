/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
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

        // unique store for callbacks
        var callbacks = {};

        // current music
        var current_track_id = null;
        var current_track_instance = null;

        // a retry counter
        var retry_counter = 0;

        /**
         * event listener callback on load error
         * @ignore
         */
        function soundLoadError(sound_id, onerror_cb) {
            // check the retry counter
            if (retry_counter++ > 3) {
                // something went wrong
                var errmsg = "melonJS: failed loading " + sound_id;
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
                    throw errmsg;
                }
            // else try loading again !
            }
            else {
                audioTracks[sound_id].load();
            }
        }

        function setTrackInstance(id) {
            current_track_instance = id;
        }


        /*
         * PUBLIC STUFF
         */

        /**
         * initialize the audio engine<br>
         * the melonJS loader will try to load audio files corresponding to the
         * browser supported audio format<br>
         * if no compatible audio codecs are found, audio will be disabled
         * @name init
         * @memberOf me.audio
         * @public
         * @function
         * @param {String}
         *          audioFormat audio format provided ("mp3, ogg, m4a, wav")
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
                throw "melonJS: me.audio.init() called before engine initialization.";
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
         * - name    : id of the sound<br>
         * - src     : source path<br>
         * @ignore
         */
        api.load = function (sound, onload_cb, onerror_cb) {
            var urls = [];
            if (typeof(this.audioFormats) === "undefined" || this.audioFormats.length === 0) {
                throw "melonJS: target audio extension(s) should be set through me.audio.init() before calling the preloader.";
            }
            for (var i = 0; i < this.audioFormats.length; i++) {
                urls.push(sound.src + sound.name + "." + this.audioFormats[i] + me.loader.nocache);
            }
            var soundclip = new Howl({
                urls : urls,
                volume : Howler.volume(),
                onend : function (soundId) {
                    if (callbacks[soundId]) {
                        // fire call back if it exists, then delete it
                        callbacks[soundId]();
                        callbacks[soundId] = null;
                    }
                },
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

            audioTracks[sound.name] = soundclip;

            return 1;
        };

        /**
         * play the specified sound
         * @name play
         * @memberOf me.audio
         * @public
         * @function
         * @param {String}
         *            sound_id audio clip id
         * @param {Boolean}
         *            [loop=false] loop audio
         * @param {Function}
         *            [onend] Function to call when sound instance ends playing.
         * @param {Number}
         *            [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
         * @param {Function}
         *            [oncreate] Callback to receive the internal sound ID when created
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
        api.play = function (sound_id, loop, onend, volume, oncreate) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if (sound && typeof sound !== "undefined") {
                sound.loop(loop || false);
                sound.volume(typeof(volume) === "number" ? volume.clamp(0.0, 1.0) : Howler.volume());
                if (typeof(onend) === "function" || typeof(oncreate) === "function") {
                    sound.play("_default", function (soundId) {
                        if (onend) {
                            callbacks[soundId] = onend;
                        }
                        if (oncreate) {
                            oncreate(soundId);
                        }
                    });
                }
                else {
                    sound.play();
                }
                return sound;
            }
        };

        /**
         * stop the specified sound on all channels
         * @name stop
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio clip id
         * @param {String} [id] the play instance ID.
         * @example
         * me.audio.stop("cling");
         */
        api.stop = function (sound_id, instance_id) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if (sound && typeof sound !== "undefined") {
                sound.stop(instance_id);
            }
        };

        /**
         * pause the specified sound on all channels<br>
         * this function does not reset the currentTime property
         * @name pause
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio clip id
         * @param {String} [id] the play instance ID.
         * @example
         * me.audio.pause("cling");
         */
        api.pause = function (sound_id, instance_id) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if (sound && typeof sound !== "undefined") {
                sound.pause(instance_id);
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
         * @param {String} sound_id audio track id
         * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
         * @example
         * me.audio.playTrack("awesome_music");
         */
        api.playTrack = function (sound_id, volume) {
            current_track_id = sound_id.toLowerCase();
            return me.audio.play(
                current_track_id,
                true,
                null,
                volume,
                navigator.isCocoonJS && (!Howler.usingWebAudio) ? setTrackInstance : undefined
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
                audioTracks[current_track_id].stop(
                    navigator.isCocoonJS && (!Howler.usingWebAudio) ? current_track_instance : undefined
                );
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
                audioTracks[current_track_id].pause(
                    navigator.isCocoonJS && (!Howler.usingWebAudio) ? current_track_instance : undefined
                );
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
                audioTracks[current_track_id].play(
                    null,
                    navigator.isCocoonJS && (!Howler.usingWebAudio) ? setTrackInstance : undefined
                );
            }
        };

        /**
         * returns the current track Id
         * @name getCurrentTrack
         * @memberOf me.audio
         * @public
         * @function
         * @return {String} audio track id
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
         * @param {String} sound_id audio clip id
         */
        api.mute = function (sound_id, mute) {
            // if not defined : true
            mute = (typeof(mute) === "undefined" ? true : !!mute);
            var sound = audioTracks[sound_id.toLowerCase()];
            if (sound && typeof(sound) !== "undefined") {
                sound.mute(true);
            }
        };

        /**
         * unmute the specified sound
         * @name unmute
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio clip id
         */
        api.unmute = function (sound_id) {
            api.mute(sound_id, false);
        };

        /**
         * mute all audio
         * @name muteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        api.muteAll = function () {
            Howler.mute();
        };

        /**
         * unmute all audio
         * @name unmuteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        api.unmuteAll = function () {
            Howler.unmute();
        };

        /**
         * unload specified audio track to free memory
         *
         * @name unload
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio track id
         * @return {Boolean} true if unloaded
         * @example
         * me.audio.unload("awesome_music");
         */
        api.unload = function (sound_id) {
            sound_id = sound_id.toLowerCase();
            if (!(sound_id in audioTracks)) {
                return false;
            }

            // destroy the Howl object
            audioTracks[sound_id].unload();
            delete audioTracks[sound_id];

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
            for (var sound_id in audioTracks) {
                if (audioTracks.hasOwnProperty(sound_id)) {
                    api.unload(sound_id);
                }
            }
        };

        // return our object
        return api;
    })();
})();
