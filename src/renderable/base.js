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
	 * @param {me.Vector2d} pos position of the renderable object
	 * @param {int} width object width
	 * @param {int} height object height
	 */
	me.Renderable = me.Rect.extend(
	/** @scope me.Renderable.prototype */
	{
		/**
		 * to identify the object as a renderable object
		 * @ignore
		 */
		isRenderable : true,
		
		/**
		 * the visible state of the renderable object<br>
		 * default value : true
		 * @public
		 * @type Boolean
		 * @name visible
		 * @memberOf me.Renderable
		 */
		visible : true,

		/**
		 * Whether the renderable object is visible and within the viewport<br>
		 * default value : false
		 * @public
		 * @readonly
		 * @type Boolean
		 * @name inViewport
		 * @memberOf me.Renderable
		 */
		inViewport : false,

		/**
		 * Whether the renderable object will always update, even when outside of the viewport<br>
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name alwaysUpdate
		 * @memberOf me.Renderable
		 */
		alwaysUpdate : false,

		/**
		 * Whether to update this object when the game is paused.
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name updateWhenPaused
		 * @memberOf me.Renderable
		 */
		updateWhenPaused: false,

		/**
		 * make the renderable object persistent over level changes<br>
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name isPersistent
		 * @memberOf me.Renderable
		 */
		isPersistent : false,
		
		/**
		 * Define if a renderable follows screen coordinates (floating)<br>
		 * or the world coordinates (not floating)<br>
		 * default value : false
		 * @public
		 * @type Boolean
		 * @name floating
		 * @memberOf me.Renderable
		 */
		floating : false,

		/**
		 * Z-order for object sorting<br>
		 * default value : 0
		 * @private
		 * @type Number
		 * @name z
		 * @memberOf me.Renderable
		 */
		z : 0,
        
        /**
		 * Define the object anchoring point<br>
		 * This is used when positioning, or scaling the object<br>
		 * The anchor point is a value between 0.0 and 1.0 (1.0 being the maximum size of the object) <br>
		 * (0, 0) means the top-left corner, <br> 
		 * (1, 1) means the bottom-right corner, <br>
		 * default anchoring point is the center (0.5, 0.5) of the object.
		 * @public
		 * @type me.Vector2d
		 * @name anchorPoint
		 * @memberOf me.Renderable
		 */
		anchorPoint: null,

        /**
         * @ignore
         */
        init : function(pos, width, height) {
            // call the parent constructor
            this.parent(pos, width, height);

            // set the default anchor point (middle of the renderable)
            if (this.anchorPoint === null) {
                this.anchorPoint = new me.Vector2d();
            }
            this.anchorPoint.set(0.5, 0.5);
        },

		/**
		 * update function
		 * called by the game manager on each game loop
		 * @name update
		 * @memberOf me.Renderable
		 * @function
		 * @protected
		 * @return false
		 **/
		update : function() {
			return false;
		},

		/**
		 * object draw
		 * called by the game manager on each game loop
		 * @name draw
		 * @memberOf me.Renderable
		 * @function
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
