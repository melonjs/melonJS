/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/**
	 * debug stuff.
	 * @namespace
	 */
	me.debug = {
		
		/**
		 * enable the FPS counter <br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		displayFPS : false,

		/**
		 * render object Rectangle & Collision Box<br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderHitBox : false,

		/**
		 * render Collision Map layer<br>
		 * default value : false
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderCollisionMap : false,

		/**
		 * render dirty region/rectangle<br>
		 * default value : false<br>
		 * (feature must be enabled through the me.sys.dirtyRegion flag)
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderDirty : false,
		
		/**
		 * render entities current velocity<br>
		 * default value : false<br>
		 * @type {Boolean}
		 * @memberOf me.debug
		 */
		renderVelocity : false
		
	};


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
