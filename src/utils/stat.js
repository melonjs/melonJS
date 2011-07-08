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
	/*		Game stat FUNCTIONS	:																			*/
	/*		a basic object to store and retreive values												*/
	/*																												*/
	/************************************************************************************/
	
	
	
	/* ----
		Item skeleton for game stat element
	
			--- */
		
	function Stat_Item(val)
	{	
		this.defaultvalue	= val || 0;
		this.value			= val || 0;
		this.updated		= true;
	};
	
	/* ----
		
		reset to default value
		
		--- */
		
	Stat_Item.prototype.reset = function ()
	{
		this.value	= this.defaultvalue;
		this.updated = true;
	};

	
	/* ----
		
		update the value of an item
		
		--- */
		
	Stat_Item.prototype.update = function (value)
	{
		this.value += value;
		this.updated = true;
		return this.updated;
	};
	
	/*---------------------------------------------------------*/

	/**
	 * manage game statistics<p>
    * me.gamestat can be used to store useful values during the game<p>
    * there is no constructor for me.gamestat
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	gamestat = (function()
	{	
		
		// hold public stuff in our singletong
		var singleton	= {};
		
		/*---------------------------------------------
			
			PRIVATE STUFF
				
		  ---------------------------------------------*/
			// hold all the items							
			var items		= {};
			var obj			= [];
			var objCount	= 0;
		
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/
		
      /**
		 * add an item to the me.gamestat Object
		 * @name me.gamestat#add
		 * @public
		 * @function
       *	@param {String} name name of the item
       *	@param {int} [val="0"] default value
       * @example
       * // add a "stars" item
       * me.gamestat.add("stars", 0);
		 */
		singleton.add = function (name, val)
		{
			items[name] = new Stat_Item(val);
			obj.push(items[name]);
			objCount ++;
		};

		
		/**
		 * update an item
		 * @name me.gamestat#updateValue
		 * @public
		 * @function
       *	@param {String} name name of the item
       *	@param {int} val value to be added
       * @example
       * // update the"stars" item
       * me.gamestat.updateValue("stars", 1);
		 */
		singleton.updateValue = function (name, value)
		{
			if (items[name]) 
			 items[name].update(value);
		};
		
		/**
		 * return an item value
		 * @name me.gamestat#getItemValue
		 * @public
		 * @function
       *	@param {String} name name of the item
       * @return {int}
       * @example
       * // get the "stars" value
       * totalStars = me.gamestat.getItemValue("stars");
       */
		singleton.getItemValue = function (name)
		{
			return (items[name])?items[name].value:0;
		};

		
		/**
		 * reset the specified item to default value
		 * @name me.gamestat#reset
		 * @public
		 * @function
       *	@param {String} [name="all"] name of the item
       * @example
       */
		singleton.reset = function (name)
		{	
			if (name!=undefined) 
			{	
				// only reset the specified one
				if (items[name])
				items[name].reset();
			}
			else
			{
				// reset everything
				singleton.resetAll();
			}
		};

		
		/**
		 * reset all items to default value
		 * @name me.gamestat#resetAll
		 * @private
		 * @function
       */
		singleton.resetAll = function ()
		{
			for (var i = objCount, objt; i--, objt = obj[i];)
			{
				objt.reset();
			}
		};
	
		// return our object
		return singleton;

	})();

	// expose our stuff to the global scope
	$.me.gamestat	=	gamestat;

/*---------------------------------------------------------*/
// END END END
/*---------------------------------------------------------*/
})(window);
