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
		var obj = {};
		
		/*--------------
			PUBLIC 
		  --------------*/

		/**
		 * plug a function  
		 * @name me.plugin#plug
		 * @public
		 * @function
		 */
		obj.plug = function(){
			;
		};

		/**
		 * Register a plugin.
		 * @name me.plugin#register
		 * @public
		 * @function
		 */

		obj.register = function(){
			;
		};
		
		
		// return our object
		return obj;

	})();

})();
