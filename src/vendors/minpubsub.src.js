/*!
* MinPubSub
* Copyright(c) 2011 Daniel Lamb <daniellmb.com>
* MIT Licensed
*/

(function(d){

	// the topic/subscription hash
	var cache = d.c_ || {}; //check for "c_" cache for unit testing
	
	/*
	 * Publish some data on a channel
	 * @public
	 * @function
	 * @param {String} topic The topic to publish on
	 * @param {Array} arguments The data to publish
	 *
	 * @example Publish stuff on '/some/topic'.
	 * Anything subscribed will be called with a function
	 * signature like: function(a,b,c){ ... }
	 *
	 * me.publish("/some/topic", ["a","b","c"]);
	 * 
	 */
	me.publish = function(topic, args){
		var subs = cache[topic],
			len = subs ? subs.length : 0;

		//can change loop or reverse array if the order matters
		while(len--){
			subs[len].apply(d, args || []);
		}
	};

	/*
	 * Register a callback on a named topic.
	 * @public
	 * @function
	 * @param {String} channel The channel to subscribe to
	 * @param {Function} callback The event handler, any time something is
	 * published on a subscribed channel, the callback will be called
	 * with the published array as ordered arguments
	 * @return Array A handle which can be used to unsubscribe this
	 * particular subscription
	 * @example
	 * me.subscribe("/some/topic", function(a, b, c){ doSomething(); });
	 */

	me.subscribe = function(topic, callback){
		if(!cache[topic]){
			cache[topic] = [];
		}
		cache[topic].push(callback);
		return [topic, callback]; // Array
	};
	
	/*
	 * Disconnect a subscribed function for a topic.
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