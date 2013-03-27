/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {
	
	/**
	 * A base class for renderable objects.
	 * @class
	 * @extends me.Rect
	 * @memberOf me
	 * @constructor
	 * @param {me.Vector2d} position of the renderable object
	 * @param {int} object width
	 * @param {int} object height
	 */
	me.Renderable = me.Rect.extend(
	/** @scope me.Renderable.prototype */
	{
		// to identify the object as a renderable object
		isRenderable: true,
		
		/**
		 * the visible state of the renderable object<br>
		 * default value : true
		 * @public
		 * @type Boolean
		 * @name me.Renderable#visible
		 */
		visible : true,

		/**
		 * Whether the renderable object is visible and within the viewport<br>
		 * default value : false
		 * @public
		 * @readonly
		 * @type Boolean
		 * @name me.Renderable#inViewport
		 */
		inViewport : false,
		
		/**
		 * make the renderable object persistent over level changes
		 * default value : false
		 * @public
		 * @readonly
		 * @type Boolean
		 * @name me.Renderable#isPersistent
		 */
		isPersistent : false,
		
		/**
		 * Define if a renderable follows screen coordinates (floating)<br>
		 * or the world coordinates (not floating)<br>
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name me.Renderable#floating
		 */
		floating: false,

		/**
		 * @ignore
		 */
		init : function(pos, width, height) {
			// call the parent constructor
			this.parent(pos, width, height);
		},

		/**
		 * update function
		 * called by the game manager on each game loop
		 * @protected
		 * @return false
		 **/
		update : function() {
			return false;
		},

		/**
		 * object draw
		 * called by the game manager on each game loop
		 * @protected
		 * @param {Context2d} context 2d Context on which draw our object
		 **/
		draw : function(context, color) {
			// draw the parent rectangle
			this.parent(context, color);
		}
	});
	

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
