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
	/*		GUI FUNCTIONS	:																					*/
	/*		a basic set of objects to manage GUI elements											*/
	/*		basically they are sprite object with some event management							*/
	/************************************************************************************/

	/* -----

		a Simple GUI object
			
		------									*/
	var GUI_Object = me.SpriteObject.extend(
	{	
		// object can be clicked or not
		isClickable : true,
		// object has been updated (clicked,etc..)	
		updated		: false,

		/* -----

			constructor function
				
			------ */

		init: function (x, y, image, spritewidth)
		{	
			this.parent(this,x, y, image, spritewidth);	
		},
	
		/* -----

			update function
				
			------ */
		update : function ()
		{
			if (this.updated)
			{
				// clear the flag
				this.updated = false;
				return true;
			}
			return false;
		},
		
		/* -----

			a clicked function called when the object is clicked
			return true if the object is to be redraw
				
			------									*/
		clicked : function ()
		{
			return false;
		},
		
		/* -----

			mouse event detection
				
			------									*/
		mouseEvent : function (x, y)
		{
			if ((x > this.pos.x) && (x < this.pos.x + this.displayWidth) && (y > this.pos.y) && (y < this.pos.y + this.displayHeight))
			{
				// notify the object we have been clicked :)
				if (this.isClickable)
				{	
					this.updated = this.clicked();
				}
			}
			return this.updated;
		}
	});
	// expose our stuff to the global scope
	$.me.GUI_Object	= GUI_Object;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
