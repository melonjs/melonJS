/**
 * @preserve MinPubSub
 * a micro publish/subscribe messaging framework
 * @see https://github.com/daniellmb/MinPubSub 
 * @author Daniel Lamb <daniellmb.com>
 *
 * Released under the MIT License
 */

(function(d) {

	/**
	 * the channel/subscription hash
	 * @private
	 */
	var cache = d.c_ || {}; //check for "c_" cache for unit testing
	
	/**
	 * Publish some data on a channel
	 * @public
	 * @function
	 * @param {String} channel The channel to publish on
	 * @param {Array} arguments The data to publish
	 *
	 * @example Publish stuff on '/some/channel'.
	 * Anything subscribed will be called with a function
	 * signature like: function(a,b,c){ ... }
	 *
	 * me.publish("/some/channel", ["a","b","c"]);
	 * 
	 */
	me.publish = function(channel, args){
		var subs = cache[channel],
			len = subs ? subs.length : 0;

		//can change loop or reverse array if the order matters
		while(len--){
			subs[len].apply(d, args || []);
		}
	};

	/**
	 * Register a callback on a named channel.
	 * @public
	 * @function
	 * @param {String} channel The channel to subscribe to
	 * @param {Function} callback The event handler, any time something is
	 * published on a subscribed channel, the callback will be called
	 * with the published array as ordered arguments
	 * @return {Array} A handle which can be used to unsubscribe this
	 * particular subscription
	 * @example
	 * me.subscribe("/some/channel", function(a, b, c){ doSomething(); });
	 */

	me.subscribe = function(channel, callback){
		if(!cache[channel]){
			cache[channel] = [];
		}
		cache[channel].push(callback);
		return [channel, callback]; // Array
	};
	
	/**
	 * Disconnect a subscribed function for a channel.
	 * @public
	 * @function
	 * @param {Array} handle The return value from a subscribe call or the
	 * name of a channel as a String
	 * @param {Function} [callback] The return value from a subscribe call.
	 * @example
	 * var handle = me.subscribe("/some/channel", function(){});
	 * me.unsubscribe(handle);
	 */
	me.unsubscribe = function(handle, callback){
		var subs = cache[callback ? handle : handle[0]],
			callback = callback || handle[1],
			len = subs ? subs.length : 0;
		
		while(len--){
			if(subs[len] === callback){
				subs.splice(len, 1);
			}
		}
	};

})(this);