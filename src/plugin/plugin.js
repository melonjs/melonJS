/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 */
 
(function() {

	/**
	 * There is no constructor function for me.plugin
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.plugin = (function() {
		
		// hold public stuff inside the singleton
		var singleton = {};
		
		/*--------------
			PUBLIC 
		  --------------*/

		/**
		 * override a melonJS function  
		 * @name me.plugin#plug
		 * @public
		 * @function
		 * @example 
		 * // redefine the me.game.update function with a new one
		 * me.plugin.plug (me.game, "update", function () { 
		 * 	 // display something in the console
		 *   console.log("duh");
		 *   // call the original me.game.update function
		 *	 this.parent();
		 * });
		 */
		singleton.plug = function(proto, name, fn){
			// use the object prototype if possible
			if (proto.prototype!==undefined) {
				var proto = proto.prototype;
			}
			// reuse the logic behing Object.extend
			if (typeof(proto[name]) == "function") {
				// save the original function
				parent[name] = proto[name];
				// override the function with the new one
				proto[name] = (function(name, fn){
					return function() {
						var tmp = this.parent;
						this.parent = parent[name];
						var ret = fn.apply(this, arguments);			 
						this.parent = tmp;
						return ret;
					};
				})( name, fn );
			}
			else {
				console.error(name + " is not a defined function");
			}
		};

		/**
		 * Register a plugin.
		 * @name me.plugin#register
		 * @public
		 * @function
		 */

		singleton.register = function(){
			;
		};
		
		
		// return our singleton
		return singleton;

	})();

})();
