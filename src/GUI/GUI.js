/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($, undefined) {
	
	/**
	 * GUI Object<br>
	 * A basic object to manage GUI elements <br>
	 * @deprecated won't survive version 0.9.3
	 * @class
	 * @extends me.SpriteObject
	 * @memberOf me
	 * @example
	 * // Enable Mouse Event Management
	 * // should be ideally in the main at initialization
	 * me.input.enableMouseEvent(true);
	 *
	 * // create a basic GUI Object
	 * var myButton = me.GUI_Object.extend(
	 * {	
	 *    init:function(x, y)
	 *   {
	 *      settings = {}
	 *      settings.image = "button";
	 *      settings.spritewidth = 100;
	 *      settings.spriteheight = 50;
	 *      // parent constructor
	 *      this.parent(x, y, settings);
	 *   },
	 *	
	 *   // output something in the console
	 *   // when the object is clicked
	 *   clicked:function()
	 *   {
	 *      console.log("clicked!");
	 *      return false;
	 *   }
	 * });
	 * 
	 * // add the object at pos (10,10), z index 4
	 * me.game.add((new myButton(10,10)),4);
	 *
	 */
	GUI_Object = me.SpriteObject.extend({
	/** @scope me.GUI_Object.prototype */
	
		/**
		 * object can be clicked or not
		 * @public
		 * @type boolean
		 * @name me.GUI_Object#isClickable
		 */
		isClickable : true,
		
		// object has been updated (clicked,etc..)	
		updated : false,

		/**
		 * @Constructor
		 * @private
		 */
		 init : function(x, y, settings) {
			this.parent(x, y, 
						((typeof settings.image == "string") ? me.loader.getImage(settings.image) : settings.image), 
						settings.spritewidth, 
						settings.spriteheight);
		},

		/**
		 * return true if the object has been clicked
		 * @private
		 */
		update : function() {
			if (this.updated) {
				// clear the flag
				this.updated = false;
				return true;
			}
			return false;
		},

		
		/**
		 * function called when the object is clicked <br>
		 * to be overwritten <br>
		 * return true if object need to be updated
		 * @public
		 * @function
		 * @deprecated won't survive version 0.9.3
		 */
		clicked : function() {
			return false;
		},


		/**
		 * mouse event detection
		 * @private
		 */
		mouseEvent : function(x, y) {
			if ((x > this.pos.x) && (x < this.pos.x + this.width)
					&& (y > this.pos.y)
					&& (y < this.pos.y + this.height)) {
				// notify the object we have been clicked :)
				if (this.isClickable) {
					this.updated = this.clicked();
				}
			}
			return this.updated;
		}
	});
	// expose our stuff to the global scope
	$.me.GUI_Object = GUI_Object;

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
