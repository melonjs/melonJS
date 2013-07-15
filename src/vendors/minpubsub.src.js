/**
 * @preserve MinPubSub
 * a micro publish/subscribe messaging framework
 * @see https://github.com/daniellmb/MinPubSub 
 * @author Daniel Lamb <daniellmb.com>
 *
 * Released under the MIT License
 */

(function() {

	/**
	 * There is no constructor function for me.event
	 * @namespace me.event
	 * @memberOf me
	 */
	me.event = (function() {
		
		// hold public stuff inside the singleton
		var obj = {};
		
		/**
		 * the channel/subscription hash
		 * @ignore
		 */
		var cache = {};
		
		/*--------------
			PUBLIC 
		  --------------*/
		  
		/**
		 * Channel Constant when the game is paused <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#STATE_PAUSE
		 */		
		obj.STATE_PAUSE = "me.state.onPause";
		
		/**
		 * Channel Constant for when the game is resumed <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#STATE_RESUME
		 */		
		obj.STATE_RESUME = "me.state.onResume";

		/**
		 * Channel Constant when the game is stopped <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#STATE_STOP
		 */		
		obj.STATE_STOP = "me.state.onStop";
		
		/**
		 * Channel Constant for when the game is restarted <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#STATE_RESTART
		 */		
		obj.STATE_RESTART = "me.state.onRestart";
		
		/**
		 * Channel Constant for when the game manager is initialized <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#GAME_INIT
		 */		
		obj.GAME_INIT = "me.game.onInit";
		
		/**
		 * Channel Constant for when a level is loaded <br>
		 * Data passed : {String} Level Name
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#LEVEL_LOADED
		 */		
		obj.LEVEL_LOADED = "me.game.onLevelLoaded";

		/**
		 * Channel Constant for when everything has loaded <br>
		 * Data passed : none <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#LOADER_COMPLETE
		 */
		obj.LOADER_COMPLETE = "me.loader.onload";

		/**
		 * Channel Constant for displaying a load progress indicator <br>
		 * Data passed : {Number} [0 .. 1] <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#LOADER_PROGRESS
		 */
		obj.LOADER_PROGRESS = "me.loader.onProgress";

		/**
		 * Channel Constant for pressing a binded key <br>
		 * Data passed : {String} user-defined action <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#KEYDOWN
		 */
		obj.KEYDOWN = "me.input.keydown";

		/**
		 * Channel Constant for releasing a binded key <br>
		 * Data passed : {Number} user-defined action <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#KEYUP
		 */
		obj.KEYUP = "me.input.keyup";

		/**
		 * Channel Constant for when the (browser) window is resized <br>
		 * note the `orientationchange` event will also trigger this channel<br>
		 * Data passed : {Event} Event object <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#WINDOW_ONRESIZE
		 */
		obj.WINDOW_ONRESIZE = "window.onresize";

		/**
		 * Channel Constant for when the (browser) window is scrolled <br>
		 * Data passed : {Event} Event object <br>
		 * @public
		 * @constant
		 * @type String
		 * @name me.event#WINDOW_ONSCROLL
		 */
		obj.WINDOW_ONSCROLL = "window.onscroll";

		/**
		 * Publish some data on a channel
		 * @name me.event#publish
		 * @public
		 * @function
		 * @param {String} channel The channel to publish on
		 * @param {Array} arguments The data to publish
		 *
		 * @example Publish stuff on '/some/channel'.
		 * Anything subscribed will be called with a function
		 * signature like: function(a,b,c){ ... }
		 *
		 * me.event.publish("/some/channel", ["a","b","c"]);
		 * 
		 */
		obj.publish = function(channel, args){
			var subs = cache[channel],
				len = subs ? subs.length : 0;

			//can change loop or reverse array if the order matters
			while(len--){
				subs[len].apply(window, args || []); // is window correct here?
			}
		};

		/**
		 * Register a callback on a named channel.
		 * @name me.event#subscribe
		 * @public
		 * @function
		 * @param {String} channel The channel to subscribe to
		 * @param {Function} callback The event handler, any time something is
		 * published on a subscribed channel, the callback will be called
		 * with the published array as ordered arguments
		 * @return {handle} A handle which can be used to unsubscribe this
		 * particular subscription
		 * @example
		 * me.event.subscribe("/some/channel", function(a, b, c){ doSomething(); });
		 */

		obj.subscribe = function(channel, callback){
			if(!cache[channel]){
				cache[channel] = [];
			}
			cache[channel].push(callback);
			return [channel, callback]; // Array
		};
		
		/**
		 * Disconnect a subscribed function for a channel.
		 * @name me.event#unsubscribe
		 * @public
		 * @function
		 * @param {handle} handle The return value from a subscribe call or the
		 * name of a channel as a String
		 * @param {Function} [callback] The return value from a subscribe call.
		 * @example
		 * var handle = me.subscribe("/some/channel", function(){});
		 * me.event.unsubscribe(handle);
		 */
		obj.unsubscribe = function(handle, callback){
			var subs = cache[callback ? handle : handle[0]],
				callback = callback || handle[1],
				len = subs ? subs.length : 0;
			
			while(len--){
				if(subs[len] === callback){
					subs.splice(len, 1);
				}
			}
		};
		
		// return our object
		return obj;

	})();

})();
