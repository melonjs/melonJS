/*
 * MelonJS Game Engine
 * Copyright (C) 2011, Olivier BIOT
 * http://olivierbiot.wordpress.com/
 *
 *
 */

(function($, undefined)
{	
	
	/************************************************************************************/
	/*		HUD FUNCTIONS	:																					*/
	/*		a basic HUD to be extended																		*/
	/*																												*/
	/************************************************************************************/
	
	
	
	/**
	 * Item skeleton for HUD element 
    * @class
	 *	@extends Object
	 * @memberOf me
	 * @constructor
	 *	@param {int} x x position (relative to the HUD position)
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
   HUD_Item = Object.extend(
   /** @scope me.HUD_Item.prototype */
	{	
		init:function (x, y, val)
		{	
         /**
          * position of the item
          * @public
          * @type me.Vector2d
          * @name me.HUD_Item#pos
         */
			this.pos = new me.Vector2d(x || 0, y || 0);

			// visible or not...	
			this.visible		= true;
			
			this.defaultvalue	= val || 0;
         
         /**
          * value of the item
          * @public
          * @type Int
          * @name me.HUD_Item#value
         */

			this.value			= val || 0;
			
			this.updated		= true;
		},
		
		/**
		 * reset the item to the default value
		 */
		reset : function ()
		{
			this.value	= this.defaultvalue;
			this.updated = true;
		},

		
		/**
		 * update the item value
       *	@param {int} value add the specified value
		 */
		update : function (value)
		{
			this.value += value;
			this.updated = true;
			return this.updated;
		},
		
		/**
		 * draw the HUD item
		 * @protected
       *	@param {Context2D} context 2D context
       *	@param {x} x
       *	@param {y} y
		 */		
      draw : function (context, x, y)
		{
			//console.log("call score");
			if (this.updated)
			{
				//console.log("score : " + this.value);
				this.updated = false;
			}
		}
	});
	/*---------------------------------------------------------*/

	
	/* -----

		a Simple HUD object
			
		------									*/
   HUD_Object = me.Rect.extend(
   {	
      /**
		 * Constructor
		 */
      init:function (x, y, w, h, bg)
		{	
         // call the parent constructor
         this.parent(new me.Vector2d(x || 0, y || 0), w || me.video.getWidth(), h || me.video.getHeight());
         
         // default background color (if specified)
         this.bgcolor = bg;
               
         // hold all the items labels						
         this.HUDItems	= {};
         // hold all the items objects
         this.HUDobj		= [];
         // Number of items in the HUD
         this.objCount = 0;
         
         // visible or not...	
         this.visible		= true;
               
         // state of HUD (to trigger redraw);
         this.HUD_invalidated = true;
               
         // create a canvas where to draw everything
         HUDCanvasSurface = me.video.createCanvasSurface(this.width, this.height);

         // this is a little hack to ensure the HUD is always the first draw
         this.z = 999;
                  
      },
	
      /**
		 * add an item to the HUD Object
		 */   
      addItem:function (name, item)
      {
         this.HUDItems[name] = item;
         this.HUDobj.push(this.HUDItems[name]);
         this.objCount ++;
         this.HUD_invalidated = true;
      },

	
      /**
		 * update the value of an item
		 */   	
      updateItemValue:function (name, value)
      {
         if (this.HUDItems[name] && (this.HUDItems[name].update(value)==true))
            this.HUD_invalidated = true;
      },
	
      /**
		 * get the value of an item
		 */   	
      getItemValue:function (name)
      {
         return (this.HUDItems[name])?this.HUDItems[name].value:0;
      },

	
      /**
		 * return true if the HUD has been updated
		 */   	
      update:function ()
      {
         return this.HUD_invalidated;
      },

	
      /**
		 * reset the item to it's default value
		 */   
      reset:function (name)
      {
         if (this.HUDItems[name])
            this.HUDItems[name].reset();
         this.HUD_invalidated = true;
      },

      /**
		 * reset all items to their default value
		 */   
      resetAll:function ()
      {
         for (var i = this.objCount, obj; i--, obj = this.HUDobj[i];)
         {
            obj.reset();
         }
         this.HUD_invalidated = true;
      },
      
      /**
       * override the default me.Rect get Rectangle definition
       * since the HUD if a flaoting object
       * (is this correct?)
       * @return {me.Rect} new rectangle	
		 */
      
		getRect : function() 
		{
        p = this.pos.clone();
        p.add(me.game.viewport.pos);
        return new me.Rect(p, this.width, this.height);
		},
      
		
      /**
		 * draw the HUD
		 */  
      draw:function (context)
      {
         //console.log("draw HUD");
         if (this.HUD_invalidated)
         {
            if (this.bgcolor)
               me.video.clearSurface(HUDCanvasSurface, this.bgcolor);
            else
               HUDCanvasSurface.canvas.width = HUDCanvasSurface.canvas.width;
			
            for (var i = this.objCount, obj; i--, obj = this.HUDobj[i];)
            {
               if (obj.visible)
               {
                  obj.draw(HUDCanvasSurface, 0, 0);
               }
            }
         }
         // draw the HUD
         context.drawImage(HUDCanvasSurface.canvas, this.pos.x, this.pos.y);	
         // reset the flag
         this.HUD_invalidated = false;
      }
	});


	// expose our stuff to the global scope
	$.me.HUD_Item		= HUD_Item;
	$.me.HUD_Object	= HUD_Object;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
