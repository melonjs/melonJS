/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * Audio Mngt Objects
 *
 *
 */

(function($) {

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
		var audio_channels = {};

		// Active (supported) audio extension
		var activeAudioExt = -1;

		// current music
		var current_track_id = null;
		var current_track = null;

		// enable/disable flag
		var sound_enable = true;

		// defaut reset value
		var reset_val = 0;// .01;

		// a retry counter
		var retry_counter = 0;
		
		// global volume setting
		var settings = {
			volume : 1.0,
			muted : false
		};

		// synchronous loader for mobile user agents
		var sync_loading = false;
		var sync_loader = [];
		 
		/**
		 * return the first audio format extension supported by the browser
		 * @ignore
		 */
		function getSupportedAudioFormat(requestedFormat) {
			var result = "";
			var len = requestedFormat.length;

			// check for sound support by the browser
			if (me.device.sound) {
				var ext = "";
				for (var i = 0; i < len; i++) {
					ext = requestedFormat[i].toLowerCase().trim();
					// check extension against detected capabilities
					if (obj.capabilities[ext] && 
						obj.capabilities[ext].canPlay && 
						// get only the first valid OR first 'probably' playable codec
						(result === "" || obj.capabilities[ext].canPlayType === 'probably')
					) {
						result = ext;
						if (obj.capabilities[ext].canPlayType === 'probably') {
							break;
						}
					}
				}
			}

			if (result === "") {
				// deactivate sound
				sound_enable = false;
			}

			return result;
		}

		/**
		 * return the specified sound
		 * @ignore
		 */

		function get(sound_id) {
			var channels = audio_channels[sound_id];
			// find which channel is available
			for ( var i = 0, soundclip; soundclip = channels[i++];) {
				if (soundclip.ended || !soundclip.currentTime)// soundclip.paused)
				{
					// console.log ("requested %s on channel %d",sound_id, i);
					soundclip.currentTime = reset_val;
					return soundclip;
				}
			}
			// else force on channel 0
			channels[0].pause();
			channels[0].currentTime = reset_val;
			return channels[0];
		}

		/**
		 * event listener callback on load error
		 * @ignore
		 */

		function soundLoadError(sound_id, onerror_cb) {
			// check the retry counter
			if (retry_counter++ > 3) {
				// something went wrong
				var errmsg = "melonJS: failed loading " + sound_id + "." + activeAudioExt;
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
				audio_channels[sound_id][0].load();
			}
		}

		/**
		 * event listener callback when a sound is loaded
		 * @ignore
		 */

		function soundLoaded(sound_id, sound_channel, onload_cb) {
			// reset the retry counter
			retry_counter = 0;
			// create other "copy" channels if necessary
			if (sound_channel > 1) {
				var soundclip = audio_channels[sound_id][0];
				// clone copy to create multiple channel version
				for (var channel = 1; channel < sound_channel; channel++) {
					// allocate the new additional channels
					audio_channels[sound_id][channel] = new Audio( soundclip.src );
					audio_channels[sound_id][channel].preload = 'auto';
					audio_channels[sound_id][channel].load();
				}
			}
			// callback if defined
			if (onload_cb) {
				onload_cb();
			}
		}

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

		function _play_audio_enable(sound_id, loop, callback, volume) {
			var soundclip = get(sound_id.toLowerCase());
	
			soundclip.loop = loop || false;
			soundclip.volume = volume ? parseFloat(volume).clamp(0.0,1.0) : settings.volume;
			soundclip.muted = settings.muted;
			soundclip.play();

			// set a callback if defined
			if (callback && !loop) {
				soundclip.addEventListener('ended', function callbackFn(event) {
					soundclip.removeEventListener('ended', callbackFn,
							false);
					// soundclip.pause();
					// soundclip.currentTime = reset_val;
					// execute a callback if required
					callback();
				}, false);
			}			
			return soundclip;

		}

		/**
		 * play_audio with simulated callback
		 * @ignore
		 */

		function _play_audio_disable(sound_id, loop, callback) {
			// check if a callback need to be called
			if (callback && !loop) {
				// SoundMngr._play_cb = callback;
				setTimeout(callback, 2000); // 2 sec as default timer ?
			}
			return null;
		}

		/*
		 *---------------------------------------------
		 * PUBLIC STUFF
		 *---------------------------------------------
		 */

		// audio capabilities
		obj.capabilities = {
			mp3: {
				codec: 'audio/mpeg',
				canPlay: false,
				canPlayType: 'no'
			},
			ogg: {
				codec: 'audio/ogg; codecs="vorbis"',
				canPlay: false,
				canPlayType: 'no'
			},
			m4a: {
				codec: 'audio/mp4; codecs="mp4a.40.2"',
				canPlay: false,
				canPlayType: 'no'
			},
			wav: {
				codec: 'audio/wav; codecs="1"',
				canPlay: false,
				canPlayType: 'no'
			}
		};	
		
		/**
		 * @ignore
		 */
		obj.detectCapabilities = function () {
			// init some audio variables
			var a = document.createElement('audio');
			if (a.canPlayType) {
				for (var c in obj.capabilities) {
					var canPlayType = a.canPlayType(obj.capabilities[c].codec);
					// convert the string to a boolean
					if (canPlayType !== "" && canPlayType !== "no") {
						obj.capabilities[c].canPlay = true;
						obj.capabilities[c].canPlayType = canPlayType;
					}
					// enable sound if any of the audio format is supported
					me.device.sound |= obj.capabilities[c].canPlay;					
				}
			}
		};

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
			audioFormat = audioFormat.split(',');
			// detect the prefered audio format
			activeAudioExt = getSupportedAudioFormat(audioFormat);

			// Disable audio on Mobile devices for now. (ARGH!)
			if (me.device.isMobile && !navigator.isCocoonJS) {
				sound_enable = false;
			}

			// enable/disable sound
			obj.play = obj.isAudioEnable() ? _play_audio_enable : _play_audio_disable;

			return obj.isAudioEnable();
		};

		/**
		 * return true if audio is enable
		 * 
		 * @see me.audio#enable
		 * @name isAudioEnable
		 * @memberOf me.audio
		 * @public
		 * @function
		 * @return {Boolean}
		 */
		obj.isAudioEnable = function() {
			return sound_enable;
		};

		/**
		 * enable audio output <br>
		 * only useful if audio supported and previously disabled through
		 * audio.disable()
		 * 
		 * @see me.audio#disable
		 * @name enable
		 * @memberOf me.audio
		 * @public
		 * @function
		 */
		obj.enable = function() {
			sound_enable = me.device.sound;

			if (sound_enable)
				obj.play = _play_audio_enable;
			else
				obj.play = _play_audio_disable;
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
			// stop the current track 
			me.audio.stopTrack();
			// disable sound
			obj.play = _play_audio_disable;
			sound_enable = false;
		};

		/**
		 * Load an audio file.<br>
		 * <br>
		 * sound item must contain the following fields :<br>
		 * - name    : id of the sound<br>
		 * - src     : source path<br>
		 * - channel : [Optional] number of channels to allocate<br>
		 * - stream  : [Optional] boolean to enable streaming<br>
		 * @ignore
		 */
		obj.load = function(sound, onload_cb, onerror_cb) {
			// do nothing if no compatible format is found
			if (activeAudioExt === -1)
				return 0;

			// check for specific platform
			if (me.device.isMobile && !navigator.isCocoonJS) {
				if (sync_loading) {
					sync_loader.push([ sound, onload_cb, onerror_cb ]);
					return;
				}
				sync_loading = true;
			}

			var channels = sound.channel || 1;
			var eventname = "canplaythrough";

			if (sound.stream === true && !me.device.isMobile) {
				channels = 1;
				eventname = "canplay";
			}

			var soundclip = new Audio(sound.src + sound.name + "." + activeAudioExt + me.loader.nocache);
			soundclip.preload = 'auto';
			soundclip.addEventListener(eventname, function callbackFn(e) {
				soundclip.removeEventListener(eventname, callbackFn, false);
				sync_loading = false;
				soundLoaded.call(
					me.audio,
					sound.name,
					channels,
					onload_cb
				);

				// Load next audio clip synchronously
				var next = sync_loader.shift();
				if (next) {
					obj.load.apply(obj, next);
				}
			}, false);

			soundclip.addEventListener("error", function(e) {
				soundLoadError.call(me.audio, sound.name, onerror_cb);
			}, false);

			// load it
			soundclip.load();

			audio_channels[sound.name] = [ soundclip ];

			return 1;
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
			if (sound_enable) {
				var sound = audio_channels[sound_id.toLowerCase()];
				for (var channel_id = sound.length; channel_id--;) {
					sound[channel_id].pause();
					// force rewind to beginning
					sound[channel_id].currentTime = reset_val;
				}

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
			if (sound_enable) {
				var sound = audio_channels[sound_id.toLowerCase()];
				for (var channel_id = sound.length; channel_id--;) {
					sound[channel_id].pause();
				}

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
			if (sound_enable && current_track) {
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
			if (typeof(volume) === "number") {
				settings.volume = volume.clamp(0.0,1.0);
			}
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
			return settings.volume;
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
			var channels = audio_channels[sound_id.toLowerCase()];
			for ( var i = 0, soundclip; soundclip = channels[i++];) {
				soundclip.muted = mute;
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
			settings.muted = true;
			for (var sound_id in audio_channels) {
				obj.mute(sound_id, settings.muted);
			}
		};
		
		/**
		 * unmute all audio 
		 * @name unmuteAll
		 * @memberOf me.audio
		 * @public
		 * @function
		 */
		obj.unmuteAll = function() {
			settings.muted = false;
			for (var sound_id in audio_channels) {
				obj.mute(sound_id, settings.muted);
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
			if (sound_enable && current_track) {
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
			if (sound_enable && current_track) {
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
			if (!(sound_id in audio_channels))
				return false;

			if (current_track_id === sound_id) {
				obj.stopTrack();
			}
			else {
				obj.stop(sound_id);
			}

			delete audio_channels[sound_id];

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
			for (var sound_id in audio_channels) {
				obj.unload(sound_id);
			}
		};

		// return our object
		return obj;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
