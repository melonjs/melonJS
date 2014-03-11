    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2013, Olivier BIOT
     * http://www.melonjs.org
     *
     * Audio Mngt Objects
     *
     *
     */

    /**
     * There is no constructor function for me.audio.
     * @namespace me.audio
     * @memberOf me
     */
    me.audio = (function() {

        /*
         * ---------------------------------------------
         * PRIVATE STUFF
         * ---------------------------------------------
         */

        // hold public stuff in our singleton
        var obj = {};

        // audio channel list
        var audioTracks = {};

        // unique store for callbacks
        var callbacks = {};

        // current music
        var current_track_id = null;
        var current_track = null;

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
                if (me.sys.stopOnAudioError===false) {
                    // disable audio
                    me.audio.disable();
                    // call error callback if defined
                    if (onerror_cb) {
                        onerror_cb();
                    }
                    // warning
                    console.log(errmsg + ", disabling audio");
                } else {
                    // throw an exception and stop everything !
                    throw errmsg;
                }
            // else try loading again !
            } else {
                audioTracks[sound_id].load();
            }
        }

        /*
         *---------------------------------------------
         * PUBLIC STUFF
         *---------------------------------------------
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
         * @example
         * // initialize the "sound engine", giving "mp3" and "ogg" as desired audio format
         * // i.e. on Safari, the loader will load all audio.mp3 files,
         * // on Opera the loader will however load audio.ogg files
         * me.audio.init("mp3,ogg");
         */
        obj.init = function(audioFormat) {
            if (!me.initialized) {
                throw "melonJS: me.audio.init() called before engine initialization.";
            }
            // if no param is given to init we use mp3 by default
            audioFormat = typeof audioFormat === "string" ? audioFormat : "mp3";
            // convert it into an array
            this.audioFormats = audioFormat.split(',');
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
        obj.enable = function() {
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
        obj.disable = function() {
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
        obj.load = function(sound, onload_cb, onerror_cb) {
            var urls = [];
            for(var i = 0; i < this.audioFormats.length; i++) {
                urls.push(sound.src + sound.name + "." + this.audioFormats[i] + me.loader.nocache);
            }
            var soundclip = new Howl({
                urls : urls,
                volume : Howler.volume(),
                onend : function(soundId) {
                    if(callbacks[soundId]) {
                        // fire call back if it exists, then delete it
                        callbacks[soundId]();
                        callbacks[soundId] = null;
                    }
                },
                onloaderror : function() {
                    soundLoadError.call(me.audio, sound.name, onerror_cb);
                },
                onload : function() {
                    retry_counter = 0;
                    if(onload_cb) {
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
         *            [callback] callback function
         * @param {Number}
         *            [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
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

        obj.play = function(sound_id, loop, callback, volume) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if(sound && typeof sound !== 'undefined') {
                sound.loop(loop || false);
                sound.volume(typeof(volume) === 'number' ? volume.clamp(0.0, 1.0) : Howler.volume());
                if (typeof(callback) === 'function') {
                    sound.play(function(soundId) {
                        callbacks[soundId] = callback;
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
         *
         * @name stop
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio clip id
         * @example
         * me.audio.stop("cling");
         */
        obj.stop = function(sound_id) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if(sound && typeof sound !== 'undefined') {
                sound.stop();
            }
        };

        /**
         * pause the specified sound on all channels<br>
         * this function does not reset the currentTime property
         *
         * @name pause
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio clip id
         * @example
         * me.audio.pause("cling");
         */
        obj.pause = function(sound_id) {
            var sound = audioTracks[sound_id.toLowerCase()];
            if(sound && typeof sound !== 'undefined') {
                sound.pause();
            }
        };

        /**
         * play the specified audio track<br>
         * this function automatically set the loop property to true<br>
         * and keep track of the current sound being played.
         *
         * @name playTrack
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio track id
         * @param {Number} [volume=default] Float specifying volume (0.0 - 1.0 values accepted).
         * @example
         * me.audio.playTrack("awesome_music");
         */
        obj.playTrack = function(sound_id, volume) {
            current_track = me.audio.play(sound_id, true, null, volume);
            current_track_id = sound_id.toLowerCase();
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
        obj.stopTrack = function() {
            if (current_track) {
                current_track.pause();
                current_track_id = null;
                current_track = null;
            }
        };

        /**
         * set the default global volume
         * @name setVolume
         * @memberOf me.audio
         * @public
         * @function
         * @param {Number} volume Float specifying volume (0.0 - 1.0 values accepted).
         */
        obj.setVolume = function(volume) {
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
        obj.getVolume = function() {
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
        obj.mute = function(sound_id, mute) {
            // if not defined : true
            mute = (mute === undefined)?true:!!mute;
            var sound = audioTracks[sound_id.toLowerCase()];
            if(sound && typeof sound !== 'undefined') {
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
        obj.unmute = function(sound_id) {
            obj.mute(sound_id, false);
        };

        /**
         * mute all audio
         * @name muteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        obj.muteAll = function() {
            Howler.mute();
        };

        /**
         * unmute all audio
         * @name unmuteAll
         * @memberOf me.audio
         * @public
         * @function
         */
        obj.unmuteAll = function() {
            Howler.unmute();
        };

        /**
         * returns the current track Id
         * @name getCurrentTrack
         * @memberOf me.audio
         * @public
         * @function
         * @return {String} audio track id
         */
        obj.getCurrentTrack = function() {
            return current_track_id;
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
        obj.pauseTrack = function() {
            if (current_track) {
                current_track.pause();
            }
        };

        /**
         * resume the previously paused audio track
         *
         * @name resumeTrack
         * @memberOf me.audio
         * @public
         * @function
         * @param {String} sound_id audio track id
         * @example
         * // play an awesome music
         * me.audio.playTrack("awesome_music");
         * // pause the audio track
         * me.audio.pauseTrack();
         * // resume the music
         * me.audio.resumeTrack();
         */
        obj.resumeTrack = function() {
            if (current_track) {
                current_track.play();
            }
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
        obj.unload = function(sound_id) {
            sound_id = sound_id.toLowerCase();
            if (!(sound_id in audioTracks))
                return false;

            if (current_track_id === sound_id) {
                obj.stopTrack();
            }
            else {
                obj.stop(sound_id);
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
        obj.unloadAll = function() {
            for (var sound_id in audioTracks) {
                obj.unload(sound_id);
            }
        };

        // return our object
        return obj;
    })();
