/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 * Audio Mngt Objects
 *
 *
 */

(function($) {

	/*
	 * -----------------------------------------------------
	 * 
	 * a audio class singleton to manage the game fx & music
	 * -----------------------------------------------------
	 */

	/**
	 * There is no constructor function for me.audio.
	 * 
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */

	me.audio = (function() {
		// hold public stuff in our singletong
		var obj = {};

		// audio channel list
		var audio_channels = {};

		// supported Audio Format
		var supportedFormat = [  "m4a", "mp3", "ogg", "wav"];

		// Request format by the app/game
		var requestedFormat = null;

		// Active (supported) audio extension
		var activeAudioExt = -1;

		// loadcb function
		var load_cb = null;

		// current music
		var current_track_id = null;
		var current_track = null;

		// enable/disable flag
		var sound_enable = true;

		// defaut reset value
		var reset_val = 0;// .01;

		// a retry counter
		var retry_counter = 0;

		/*
		 * ---------------------------------------------
		 * 
		 * PRIVATE STUFF
		 * 
		 * ---------------------------------------------
		 */

		/*
		 * ---
		 * 
		 * return the audio format extension supported by the browser ---
		 */

		function getSupportedAudioFormat() {

			var result = "";
			var ext = "";
			var rx = null;
			var i = 0;
			var len = supportedFormat.length;

			// check for sound support by the browser
			if (me.sys.sound) {
				for (; i < len; i++) {
					ext = supportedFormat[i];
					rx = new RegExp(ext, "i");
					if ((requestedFormat.search(rx) != -1) && obj.capabilities[ext]) {
						result = ext;
						break;
					}
				}
			}

			if (result === "") {
				// deactivate sound
				sound_enable = false;
			}

			return result;
		}

		/*
		 * ---
		 * 
		 * return the specified sound ---
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
		;

		/*
		 * ---
		 * 
		 * event listener callback on load error
		 * 
		 * ---
		 */

		function soundLoadError(sound_id) {
			// check the retry counter
			if (retry_counter++ > 3) {
				// something went wrong
				var errmsg = "melonJS: failed loading " + sound_id + "." + activeAudioExt;
				if (me.sys.stopOnAudioError===false) {
					// disable audio
					me.audio.disable();
					// call load callback if defined
					if (load_cb) {
						load_cb();
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
		};

		/*
		 * ---
		 * 
		 * event listener callback when a sound is loaded
		 * 
		 * ---
		 */

		function soundLoaded(sound_id, sound_channel) {
			// reset the retry counter
			retry_counter = 0;

			// create other "copy" channels if necessary
			if (sound_channel > 1) {
				var soundclip = audio_channels[sound_id][0];
				// clone copy to create multiple channel version
				for (var channel = 1; channel < sound_channel; channel++) {
					// allocate the new additional channels
					audio_channels[sound_id][channel] = new Audio( soundclip.src );
					audio_channels[sound_id][channel].preload = "auto";
					audio_channels[sound_id][channel].load();
				}
			}
			// callback if defined
			if (load_cb) {
				load_cb();
			}
		}
		;

		/**
		 * play the specified sound
		 * 
		 * @name me.audio#play
		 * @public
		 * @function
		 * @param {String}
		 *            sound_id audio clip id
		 * @param {String}
		 *            [loop="false"] loop audio
		 * @param {Function}
		 *            [callback] callback function
		 * @example // play the "cling" audio clip me.audio.play("cling"); //
		 *          play & repeat the "engine" audio clip
		 *          me.audio.play("engine", true); // play the "gameover_sfx"
		 *          audio clip and call myFunc when finished
		 *          me.audio.play("gameover_sfx", false, myFunc);
		 */

		function _play_audio_enable(sound_id, loop, callback) {
			// console.log("play!!");
			var soundclip = get(sound_id.toLowerCase());

			soundclip.loop = loop || false;
			soundclip.play();

			// set a callback if defined
			if (callback && !loop) {
				soundclip.addEventListener('ended', function(event) {
					soundclip.removeEventListener('ended', arguments.callee,
							false);
					// soundclip.pause();
					// soundclip.currentTime = reset_val;
					// execute a callback if required
					callback();
				}, false);
			}

		}
		;

		/*
		 * ---
		 * 
		 * play_audio with simulated callback ---
		 */

		function _play_audio_disable(sound_id, loop, callback) {
			// check if a callback need to be called
			if (callback && !loop) {
				// SoundMngr._play_cb = callback;
				setTimeout(callback, 2000); // 2 sec as default timer ?
			}
		}
		;

		/*
		 * ---------------------------------------------
		 * 
		 * PUBLIC STUFF
		 * 
		 * ---------------------------------------------
		 */

		// audio capabilities
		obj.capabilities = {
			mp3 : false,
			ogg : false,
			m4a : false,
			wav : false
		};
		
		/**
		 * @private
		 */
		obj.detectCapabilities = function () {
		
			// init some audio variables
			var a = document.createElement('audio');

			if (a.canPlayType) {
				obj.capabilities.mp3 = ("no" != a.canPlayType("audio/mpeg")) 
									&& ("" != a.canPlayType("audio/mpeg"));

				obj.capabilities.ogg = ("no" != a.canPlayType('audio/ogg; codecs="vorbis"'))
									&& ("" != a.canPlayType('audio/ogg; codecs="vorbis"'));

				obj.capabilities.wav = ("no" != a.canPlayType('audio/wav; codecs="1"'))
									&& ("" != a.canPlayType('audio/wav; codecs="1"'));
				
				obj.capabilities.m4a = ("no" != a.canPlayType('audio/mp4; codecs="mp4a.40.2"'))
									&& ("" != a.canPlayType('audio/mp4; codecs="mp4a.40.2"'));

				// enable sound if any of the audio format is supported
				me.sys.sound = obj.capabilities.mp3 ||
							   obj.capabilities.ogg ||
							   obj.capabilities.wav || 
							   obj.capabilities.m4a;
			}
			
			// check for specific platform
			if ((me.sys.ua.search("iphone") > -1) || (me.sys.ua.search("ipod") > -1) || 
				(me.sys.ua.search("ipad") > -1) || (me.sys.ua.search("android") > -1)) {
				// if on mobile device, without a specific HTML5 acceleration framework
				if (!navigator.isCocoonJS) {
					// disable sound for now
					me.sys.sound = false;
				}
			}
		};

		/**
		 * initialize the audio engine<br>
		 * the melonJS loader will try to load audio files corresponding to the
		 * browser supported audio format<br>
		 * if not compatible audio format is found, audio will be disabled
		 * 
		 * @name me.audio#init
		 * @public
		 * @function
		 * @param {String}
		 *            audioFormat audio format provided ("mp3, ogg, wav")
		 * @example // initialize the "sound engine", giving "mp3" and "ogg" as
		 *          available audio format me.audio.init("mp3,ogg"); // i.e. on
		 *          Safari, the loader will load all audio.mp3 files, // on
		 *          Opera the loader will however load audio.ogg files
		 */
		obj.init = function(audioFormat) {
			if (!me.initialized) {
				throw "melonJS: me.audio.init() called before engine initialization.";
			}

			if (audioFormat)
				requestedFormat = new String(audioFormat);
			else
				// if no param is given to init we use mp3 by default
				requestedFormat = new String("mp3");

			// detect the prefered audio format
			activeAudioExt = getSupportedAudioFormat();

			if (sound_enable)
				obj.play = _play_audio_enable;
			else
				obj.play = _play_audio_disable;

			return sound_enable;
		};

		/*
		 * ---
		 * 
		 * 
		 * ---
		 */

		/**
		 * set call back when a sound (and instances) is/are loaded
		 * 
		 * @name me.audio#setLoadCallback
		 * @private
		 * @function
		 */
		obj.setLoadCallback = function(callback) {
			load_cb = callback;
		};

		/**
		 * return true if audio is enable
		 * 
		 * @see me.audio#enable
		 * @name me.audio#isAudioEnable
		 * @public
		 * @function
		 * @return {boolean}
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
		 * @name me.audio#enable
		 * @public
		 * @function
		 */
		obj.enable = function() {
			sound_enable = me.sys.sound;

			if (sound_enable)
				obj.play = _play_audio_enable;
			else
				obj.play = _play_audio_disable;
		};

		/**
		 * disable audio output
		 * 
		 * @name me.audio#disable
		 * @public
		 * @function
		 */
		obj.disable = function() {
			sound_enable = false;
			obj.play = _play_audio_disable;
		};

		/**
		 * load a sound sound struct : name: id of the sound src: src path
		 * channel: number of channel to allocate
		 * 
		 * @private
		 */
		obj.load = function(sound) {
			// do nothing if no compatible format is found
			if (activeAudioExt == -1)
				return 0;

			// var soundclip = document.createElement("audio");

			var soundclip = new Audio(sound.src + sound.name + "."
					+ activeAudioExt + me.nocache);

			// soundclip.autobuffer = true; // obsolete
			soundclip.preload = 'auto';

			soundclip.addEventListener('canplaythrough', function(e) {
				// console.log(soundclip);
				this.removeEventListener('canplaythrough', arguments.callee,
						false);
				soundLoaded(sound.name, sound.channel);
			}, false);

			soundclip.addEventListener("error", function(e) {
				soundLoadError(sound.name);
			}, false);

			soundclip.src = sound.src + sound.name + "." + activeAudioExt
					+ me.nocache;

			// document.body.appendChild(soundclip);

			// load it
			soundclip.load();

			audio_channels[sound.name] = [ soundclip ];

			return 1;
		};

		/**
		 * stop the specified sound on all channels
		 * 
		 * @name me.audio#stop
		 * @public
		 * @function
		 * @param {String}
		 *            sound_id audio clip id
		 * @example me.audio.stop("cling");
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
		 * @name me.audio#pause
		 * @public
		 * @function
		 * @param {String}
		 *            sound_id audio clip id
		 * @example me.audio.pause("cling");
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
		 * @name me.audio#playTrack
		 * @public
		 * @function
		 * @param {String}
		 *            sound_id audio track id
		 * @example me.audio.playTrack("awesome_music");
		 */
		obj.playTrack = function(sound_id) {
			if (sound_enable) {
				if (current_track != null)
					obj.stopTrack();

				sound_id = sound_id.toLowerCase();
				current_track = get(sound_id);

				if (current_track) {
					current_track_id = sound_id;
					current_track.loop = true;
					current_track.play();
				}
			}
		};

		/**
		 * stop the current audio track
		 * 
		 * @see me.audio#playTrack
		 * @name me.audio#stopTrack
		 * @public
		 * @function
		 * @example // play a awesome music me.audio.playTrack("awesome_music"); //
		 *          stop the current music me.audio.stopTrack();
		 */
		obj.stopTrack = function() {
			if (sound_enable && current_track) {
				current_track.pause();
				current_track_id = null;
				current_track = null;
			}
		};

		/**
		 * pause the current audio track
		 * 
		 * @name me.audio#pauseTrack
		 * @public
		 * @function
		 * @example me.audio.pauseTrack();
		 */
		obj.pauseTrack = function() {
			if (sound_enable && current_track) {
				current_track.pause();
			}
		};

		/**
		 * resume the previously paused audio track
		 * 
		 * @name me.audio#resumeTrack
		 * @public
		 * @function
		 * @param {String}
		 *            sound_id audio track id
		 * @example // play a awesome music me.audio.playTrack("awesome_music"); //
		 *          pause the audio track me.audio.pauseTrack(); // resume the
		 *          music me.audio.resumeTrack();
		 */
		obj.resumeTrack = function() {
			if (sound_enable && current_track) {
				current_track.play();
			}
		};

		/**
		 * unload specified audio track to free memory
		 *
		 * @name me.audio#unload
		 * @public
		 * @function
		 * @param {String} sound_id audio track id
		 * @return {boolean} true if unloaded
		 * @example me.audio.unload("awesome_music");
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
		 * @name me.audio#unloadAll
		 * @public
		 * @function
		 * @example me.audio.unloadAll();
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
