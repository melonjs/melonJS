/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	/************************************************************************************/
	/*      Game stat FUNCTIONS :                                                       */
	/*      a basic object to store and retreive values                                 */
	/*                                                                                  */
	/************************************************************************************/

	/**
	 * Item skeleton for game stat element
	 * @private
	 */
	function Stat_Item(val) {
		this.defaultvalue = val || 0;
		this.value = val || 0;
		this.updated = true;
	};

	/**
	 * reset to default value
	 * @private
	 */
	Stat_Item.prototype.reset = function() {
		this.set(this.defaultvalue);
	};

	/**
	 * update the value of an item
	 * @private
	 */
	Stat_Item.prototype.update = function(val) {
		return this.set(this.value + val);
	};
	
	/** 
      * Sets the value of an item 
	 * @private
	 */
    Stat_Item.prototype.set = function(value) { 
		this.value = value; 
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
	me.gamestat = (function() {

		// hold public stuff in our singletong
		var singleton = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
		  ---------------------------------------------*/
		// hold all the items							
		var items = {};
		var obj = [];
		var objCount = 0;

		/*---------------------------------------------
			
			PUBLIC STUFF
				
		  ---------------------------------------------*/

		/**
		 * add an item to the me.gamestat Object
		 * @name me.gamestat#add
		 * @public
		 * @function
		 * @param {String||Object} name name of the item or hash of items
		 * @param {int} [val="0"] default value
		 * @example
		 * // add a "stars" item
		 * me.gamestat.add("stars", 0);
		 */
		singleton.add = function(name, val) {
                  var addStat = function(k, v) {
                    items[k] = new Stat_Item(v);
                    obj.push(items[k]);
                    objCount++;
                  };
                  if (name.constructor === Object) {
                    for (var key in name) {
                      addStat(key, name[key]);
                    }
                  }
                  else { addStat(name, val); }
		};

		/**
		 * update an item
		 * @name me.gamestat#updateValue
		 * @public
		 * @function
		 * @param {String||Object} name name of the item or hash of items
		 * @param {int} val value to be added
		 * @example
		 * // update the "stars" item
		 * me.gamestat.updateValue("stars", 1);
		 */
		singleton.updateValue = function(name, value) {
                  var updateStat = function(k, v) {
                    items[k].update(v);
                  };
                  if (name.constructor === Object) {
                    for (var key in name) {
                      if (items[key]) { updateStat(key, name[key]); }
                    }
                  }
                  else if (items[name]) { updateStat(name, value); }
		};
		
		/** 
		 * set value of an item 
		 * @name me.gamestat#setValue 
		 * @public 
		 * @function 
		 * @param {String||Object} name name of the item or hash of items
		 * @param {int} val value to be set 
		 * @example 
		 * // set the"stars" item 
		 * me.gamestat.setValue("stars", 1); 
		 */ 
		singleton.setValue = function(name, value) { 
                  var setStat = function(k, v) {
                    items[k].set(v);
                  };
                  if (name.constructor === Object) {
                    for (var key in name) {
                      if (items[key]) { setStat(key, name[key]); }
                    }
                  }
                  else if (items[name]) { setStat(name, value); }
		};

		
		/**
		 * return an item value
		 * @name me.gamestat#getItemValue
		 * @public
		 * @function
		 * @param {String} name name of the item
		 * @return {int}
		 * @example
		 * // get the "stars" value
		 * totalStars = me.gamestat.getItemValue("stars");
		 */
		singleton.getItemValue = function(name) {
			return (items[name]) ? items[name].value : 0;
		};

		/**
		 * reset the specified item to default value
		 * @name me.gamestat#reset
		 * @public
		 * @function
		 * @param {String} [name="all"] name of the item
		 */
		singleton.reset = function(name) {
			if (name != undefined) {
				// only reset the specified one
				if (items[name])
					items[name].reset();
			} else {
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
		singleton.resetAll = function() {
			for ( var i = objCount, objt; i--, objt = obj[i];) {
				objt.reset();
			}
		};

		// return our object
		return singleton;

	})();

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
