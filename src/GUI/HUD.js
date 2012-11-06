/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 *
 */

(function($) {

	/************************************************************************************/
	/*      HUD FUNCTIONS :                                                             */
	/*      a basic HUD to be extended                                                  */
	/*                                                                                  */
	/************************************************************************************/

	/**
	 * Item skeleton for HUD element 
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {int} x x position (relative to the HUD position)
	 * @param {int} y y position (relative to the HUD position)
	 * @param {int} [val="0"] default value
	 * @example
	 * // create a "score object" that will use a Bitmap font
	 * // to display the score value
	 * ScoreObject = me.HUD_Item.extend(
	 * {	
	 *    // constructor
	 *    init: function(x, y)
	 *    {
	 *       // call the parent constructor
	 *       this.parent(x, y);
	 *       // create a font
	 *       this.font = new me.BitmapFont("font16px", 16);
	 *    },
	 *    // draw function
	 *    draw : function (context, x, y)
	 *    {
	 *       this.font.draw (context, this.value, this.pos.x +x, this.pos.y +y);
	 *    }
	 * });
	 * 
	 * // add a default HUD to the game mngr (with no background)
	 * me.game.addHUD(0,0,480,100);
	 * // add the "score" HUD item
	 * me.game.HUD.addItem("score", new ScoreObject(470,10));
	 */
	me.HUD_Item = Object.extend(
	/** @scope me.HUD_Item.prototype */
	{
		init : function(x, y, val) {
			/**
			 * position of the item
			 * @public
			 * @type me.Vector2d
			 * @name me.HUD_Item#pos
			 */
			this.pos = new me.Vector2d(x || 0, y || 0);

			// visible or not...	
			this.visible = true;

			this.defaultvalue = val || 0;

			/**
			 * value of the item
			 * @public
			 * @type Int
			 * @name me.HUD_Item#value
			 */

			this.value = val || 0;

			this.updated = true;
		},

		/**
		 * reset the item to the default value
		 */
		reset : function() {
			this.set(this.defaultvalue);
		},
		
		/**
		 * set the item value to the specified one
		 */
		set : function(value) {
			this.value = value;
			this.updated = true;
			return true;
		},

		/**
		 * update the item value
		 * @param {int} value add the specified value
		 */
		update : function(value) {
			return this.set(this.value + value);
		},

		/**
		 * draw the HUD item
		 * @protected
		 * @param {Context2D} context 2D context
		 * @param {x} x
		 * @param {y} y
		 */
		draw : function(context, x, y) {
			;// to be extended
		}
	});
	/*---------------------------------------------------------*/

	/**
	 * HUD Object<br>
	 * There is no constructor function for me.HUD_Object<br>
	 * Object instance is accessible through me.game.HUD if previously initialized using me.game.addHUD(...);
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @example
	 * // create a "score object" that will use a Bitmap font
	 * // to display the score value
	 * ScoreObject = me.HUD_Item.extend(
	 * {	
	 *    // constructor
	 *    init: function(x, y)
	 *    {
	 *       // call the parent constructor
	 *       this.parent(x, y);
	 *       // create a font
	 *       this.font = new me.BitmapFont("font16px", 16);
	 *    },
	 *    // draw function
	 *    draw : function (context, x, y)
	 *    {
	 *       this.font.draw (context, this.value, this.pos.x +x, this.pos.y +y);
	 *    }
	 * });
	 * 
	 * // add a default HUD to the game mngr (with no background)
	 * me.game.addHUD(0,0,480,100);
	 * // add the "score" HUD item
	 * me.game.HUD.addItem("score", new ScoreObject(470,10));
	 */


	me.HUD_Object = me.Rect.extend(
	/** @scope me.HUD_Object.prototype */
	{	
	
		
		/**
		 * @Constructor
		 * @private
		 */
		init : function(x, y, w, h, bg) {
			// call the parent constructor
			this.parent(new me.Vector2d(x || 0, y || 0), 
						w || me.video.getWidth(), h || me.video.getHeight());

			// default background color (if specified)
			this.bgcolor = bg;

			// hold all the items labels						
			this.HUDItems = {};
			// hold all the items objects
			this.HUDobj = [];
			// Number of items in the HUD
			this.objCount = 0;

			// visible or not...	
			this.visible = true;
			
			// use screen coordinates
			this.floating = true;

			// state of HUD (to trigger redraw);
			this.HUD_invalidated = true;

			// create a canvas where to draw everything
			this.HUDCanvas = me.video.createCanvas(this.width, this.height);
			this.HUDCanvasSurface = this.HUDCanvas.getContext('2d');
			
			// this is a little hack to ensure the HUD is always the first draw
			this.z = 999;
			
			// ensure me.game.removeAll() will not remove the HUD
			this.isPersistent = true;

		},

		/**
		 * add an item to the me.game.HUD Object
		 * @name me.HUD_Object#addItem
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @param {me.HUD_Item} item HUD Item to be added
		 * @example
		 * // add a "score" HUD item
		 * me.game.HUD.addItem("score", new ScoreObject(470,10));
		 */
		addItem : function(name, item) {
			this.HUDItems[name] = item;
			this.HUDobj.push(this.HUDItems[name]);
			this.objCount++;
			this.HUD_invalidated = true;
		},
		
		/**
		 * remove an item from the me.game.HUD Object
		 * @name me.HUD_Object#removeItem
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @example
		 * // remove the "score" HUD item
		 * me.game.HUD.removeItem("score");
		 */
		removeItem : function(name) {
			if (this.HUDItems[name]) {
				this.HUDobj.splice(this.HUDobj.indexOf(this.HUDItems[name]),1);
				this.HUDItems[name] = null;
				this.objCount--;
				this.HUD_invalidated = true;
			}
		},
		
		/**
		 * set the value of the specified item
		 * @name me.HUD_Object#setItemValue
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @param {int} val value to be set 
		 * @example
		 * // set the "score" item value to 100
		 * me.game.HUD.setItemValue("score", 100);
		 */
		setItemValue : function(name, value) {
			if (this.HUDItems[name] && (this.HUDItems[name].set(value) == true))
				this.HUD_invalidated = true;				
		},

		
		/**
		 * update (add) the value of the specified item
		 * @name me.HUD_Object#updateItemValue
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @param {int} val value to be set 
		 * @example
		 * // add 10 to the current "score" item value
		 * me.game.HUD.updateItemValue("score", 10);
		 */
		updateItemValue : function(name, value) {
			if (this.HUDItems[name] && (this.HUDItems[name].update(value) == true))
				this.HUD_invalidated = true;
		},

		/**
		 * return the value of the specified item
		 * @name me.HUD_Object#getItemValue
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @return {int}
		 * @example
		 * // return the value of the "score" item
		 * score = me.game.HUD.getItemValue("score");
		 */
		getItemValue : function(name) {
			return (this.HUDItems[name]) ? this.HUDItems[name].value : 0;
		},
		
		
		/**
		 * return true if the HUD has been updated
		 * @private
		 */
		update : function() {
			return this.HUD_invalidated;
		},

		/**
		 * reset the specified item to default value
		 * @name me.HUD_Object#reset
		 * @public
		 * @function
		 * @param {String} [name="all"] name of the item
		 */		
		reset : function(name) {
			if (name != undefined) {
				// only reset the specified one
				if (this.HUDItems[name])
					this.HUDItems[name].reset();
				this.HUD_invalidated = true;
			} else {
				// reset everything
				this.resetAll();
			}
		},

		/**
		 * reset all items to default value
		 * @private
		 */
		resetAll : function() {
			for ( var i = this.objCount, obj; i--, obj = this.HUDobj[i];) {
				obj.reset();
			}
			this.HUD_invalidated = true;
		},

		/**
		 * override the default me.Rect get Rectangle definition
		 * since the HUD if a flaoting object
		 * (is this correct?)
		 * @private
		 * @return {me.Rect} new rectangle
		 */

		getRect : function() {
			p = this.pos.clone();
			p.add(me.game.viewport.pos);
			return new me.Rect(p, this.width, this.height);
		},

		/**
		 * draw the HUD
		 * @private
		 */
		draw : function(context) {
			if (this.HUD_invalidated) {
				if (this.bgcolor) {
					me.video.clearSurface(this.HUDCanvasSurface, this.bgcolor);
				}
				else {
					this.HUDCanvas.width = this.HUDCanvas.width;
				}
				for ( var i = this.objCount, obj; i--, obj = this.HUDobj[i];) {
					if (obj.visible) {
						obj.draw(this.HUDCanvasSurface, 0, 0);
						// clear the updated flag
						if (obj.updated) {
							obj.updated = false;
						}
					}
				}
			}
			// draw the HUD
			context.drawImage(this.HUDCanvas, this.pos.x, this.pos.y);
			// reset the flag
			this.HUD_invalidated = false;
		}
	});


	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
