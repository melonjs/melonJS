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
		* a base Object for plugin <br>
		* plugin must be installed using the register function
		* @see me.plugin#Base
		* @class
		* @extends Object
		* @memberOf me
		* @constructor
		*/
		singleton.Base = Object.extend(
		/** @scope me.plugin.Base.prototype */
		{
			/**
			 * define the minimum required <br>
			 * version of melonJS  <br>
			 * this need to be defined by the plugin
			 * @public
			 * @type String
			 * @name me.plugin.Base#version
			 */
			version : undefined,
			
			/** @private */
			init : function() {
				// compatibility testing
				if (this.version === undefined) {
					throw "melonJS: Plugin version not defined !";
				} else if (me.sys.checkVersion(this.version) > 0) {
					throw ("melonJS: Plugin version mismatch, expected: "+ this.version +", got: " + me.version);
				}
			}
		});


		/**
		 * patch a melonJS function
		 * @name me.plugin#patch
		 * @public
		 * @function
		 * @param {Object} object target object
		 * @param {name} name target function
		 * @param {Function} fn function
		 * @example 
		 * // redefine the me.game.update function with a new one
		 * me.plugin.patch(me.game, "update", function () { 
		 * 	 // display something in the console
		 *   console.log("duh");
		 *   // call the original me.game.update function
		 *	 this.parent();
		 * });
		 */
		singleton.patch = function(proto, name, fn){
			// use the object prototype if possible
			if (proto.prototype!==undefined) {
				var proto = proto.prototype;
			}
			// reuse the logic behind Object.extend
			if (typeof(proto[name]) == "function") {
				// save the original function
				var _parent = proto[name];
				// override the function with the new one
				proto[name] = (function(name, fn){
					return function() {
						var tmp = this.parent;
						this.parent = _parent;
						var ret = fn.apply(this, arguments);			 
						this.parent = tmp;
						return ret;
					};
				})( name, fn );
			}
			else {
				console.error(name + " is not an existing function");
			}
		};

		/**
		 * Register a plugin.
		 * @name me.plugin#register
		 * @see me.plugin#Base
		 * @public
		 * @function
		 * @param {me.plugin.Base} plugin Plugin to instiantiate and register
		 * @param {String} name
		 * @example
		 * // register a new plugin
		 * me.plugin.register(TestPlugin, "testPlugin");
		 * // the plugin then also become available
		 * // under then me.plugin namespace
 		 * me.plugin.testPlugin.myFunction();
		 */
		singleton.register = function(plugin, name){
			// ensure me.plugin[name] is not already "used"
			if (me.plugin[name]) {
				console.error ("plugin " + name + " already registered");
			}
			
			// try to instantiate the plugin
			me.plugin[name] = new plugin();
			
			// inheritance check
			if (!(me.plugin[name] instanceof me.plugin.Base)) {
				throw "melonJS: Plugin should extend the me.plugin.Base Class !";
			}
		};
		
		// return our singleton
		return singleton;

	})();
})();
