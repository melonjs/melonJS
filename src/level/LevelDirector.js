/*
 * MelonJS Game Engine
 * Copyright (C) 2012, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {

	
	/**
	 * a level manager object <br>
	 * once ressources loaded, the level director contains all references of defined levels<br>
	 * There is no constructor function for me.levelDirector, this is a static object
	 * @final
	 * @memberOf me
	 * @constructor Should not be called by the user.
	 */
	me.levelDirector = (function() {
		// hold public stuff in our singletong
		var obj = {};

		/*---------------------------------------------
			
			PRIVATE STUFF
				
			---------------------------------------------*/

		// our levels
		var levels = {};
		// level index table
		var levelIdx = [];
		// current level index
		var currentLevelIdx = 0;
		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
  		  ---------------------------------------------*/
		/**
		 * reset the level director 
		 * @private
		 */
		obj.reset = function() {

		};

		/**
		 * add a level  
		 * @private
		 */
		obj.addLevel = function(level) {
			throw "melonJS: no level loader defined";
		};

		/**
		 *
		 * add a TMX level  
		 * @private
		 */
		obj.addTMXLevel = function(levelId, callback) {
			// just load the level with the XML stuff
			if (levels[levelId] == null) {
				//console.log("loading "+ levelId);
				levels[levelId] = new me.TMXTileMap(levelId, 0, 0);
				// set the name of the level
				levels[levelId].name = levelId;
				// level index
				levelIdx[levelIdx.length] = levelId;
			} 
			else  {
				//console.log("level %s already loaded", levelId);
				return false;
			}
			
			// call the callback if defined
			if (callback)
				callback();
			
			// true if level loaded
			return true;
		};

		/**
		 * load a level into the game manager<br>
		 * (will also create all level defined entities, etc..)
		 * @name me.levelDirector#loadLevel
		 * @public
		 * @function
		 * @param {String} level level id
		 * @example
		 * // the game defined ressources
		 * // to be preloaded by the loader
		 * // TMX maps
		 * ...
		 * {name: "a4_level1",   type: "tmx",   src: "data/level/a4_level1.tmx"},
		 * {name: "a4_level2",   type: "tmx",   src: "data/level/a4_level2.tmx"},
		 * {name: "a4_level3",   type: "tmx",   src: "data/level/a4_level3.tmx"},
		 * ...
		 * ...
		 * // load a level
		 * me.levelDirector.loadLevel("a4_level1");
		 */
		obj.loadLevel = function(levelId) {
			// make sure it's a string
			levelId = levelId.toString().toLowerCase();
			// throw an exception if not existing
			if (levels[levelId] === undefined) {
				throw ("melonJS: level " + levelId + " not found");
			}

			if (levels[levelId] instanceof me.TMXTileMap) {

				// check the status of the state mngr
				var isRunning = me.state.isRunning();

				if (isRunning) {
					// pause the game loop to avoid 
					// some silly side effects
					me.state.pause();
				}

				// reset the gameObject Manager (just in case!)
				me.game.reset();
				
				// reset the GUID generator
				// and pass the level id as parameter
				me.utils.resetGUID(levelId);
				
				// reset the current (previous) level
				if (levels[obj.getCurrentLevelId()]) {
					levels[obj.getCurrentLevelId()].reset();
				}
				levels[levelId].load();
			
				// update current level index
				currentLevelIdx = levelIdx.indexOf(levelId);
				
				// add the specified level to the game manager
				me.game.loadTMXLevel(levels[levelId]);
				
				if (isRunning) {
					// resume the game loop if it was
					// previously running
					me.state.resume();
				}
			} else
				throw "melonJS: no level loader defined";
			
			return true;
		};

		/**
		 * return the current level id<br>
		 * @name me.levelDirector#getCurrentLevelId
		 * @public
		 * @function
		 * @return {String}
		 */
		obj.getCurrentLevelId = function() {
			return levelIdx[currentLevelIdx];
		},

		/**
		 * reload the current level<br>
		 * @name me.levelDirector#reloadLevel
		 * @public
		 * @function
		 */
		obj.reloadLevel = function() {
			// reset the level to initial state
			//levels[currentLevel].reset();
			return obj.loadLevel(obj.getCurrentLevelId());
		},

		/**
		 * load the next level<br>
		 * @name me.levelDirector#nextLevel
		 * @public
		 * @function
		 */
		obj.nextLevel = function() {
			//go to the next level 
			if (currentLevelIdx + 1 < levelIdx.length) {
				return obj.loadLevel(levelIdx[currentLevelIdx + 1]);
			} else {
				return false;
			}
		};

		/**
		 * load the previous level<br>
		 * @name me.levelDirector#previousLevel
		 * @public
		 * @function
		 */
		obj.previousLevel = function() {
			// go to previous level
			if (currentLevelIdx - 1 >= 0) {
				return obj.loadLevel(levelIdx[currentLevelIdx - 1]);
			} else {
				return false;
			}
		};

		// return our object
		return obj;

	})();
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
