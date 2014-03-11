    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2013, Olivier BIOT
     * http://www.melonjs.org
     *
     */

	/**
	 * a level manager object <br>
	 * once ressources loaded, the level director contains all references of defined levels<br>
	 * There is no constructor function for me.levelDirector, this is a static object
	 * @namespace me.levelDirector
	 * @memberOf me
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
        
		/**
		 * Load a TMX level
		 * @name loadTMXLevel
		 * @memberOf me.game
		 * @private
		 * @param {String} level to be loaded
		 * @param {me.ObjectContainer} target container
		 * @ignore
		 * @function
		 */
		var loadTMXLevel = function(level, container) {
			
			// disable auto-sort for the given container
			container.autoSort = false;
			
			// load our map
			me.game.currentLevel = level;

			// get the collision map
			me.game.collisionMap = me.game.currentLevel.getLayerByName("collision");
			if (!me.game.collisionMap || !me.game.collisionMap.isCollisionMap) {
				console.error("WARNING : no collision map detected");
			}

			// add all defined layers
			var layers = level.getLayers();
			for ( var i = layers.length; i--;) {
				// don't add the collision layer
				if (!layers[i].isCollisionMap) {
					container.addChild(layers[i]);
				}
			}

			// change the viewport bounds
            me.game.viewport.setBounds(
				0,0,
				Math.max(level.width, me.game.viewport.width),
				Math.max(level.height, me.game.viewport.height)
            );
                                       

			// game world as default container
			var targetContainer = container;

			// load all ObjectGroup and Object definition
			var objectGroups = level.getObjectGroups();
			
			for ( var g = 0; g < objectGroups.length; g++) {
				
				var group = objectGroups[g];

				if (me.game.mergeGroup === false) {

					// create a new container with Infinite size (?)
					// note: initial position and size seems to be meaningless in Tiled
					// https://github.com/bjorn/tiled/wiki/TMX-Map-Format :
					// x: Defaults to 0 and can no longer be changed in Tiled Qt.
					// y: Defaults to 0 and can no longer be changed in Tiled Qt.
					// width: The width of the object group in tiles. Meaningless.
					// height: The height of the object group in tiles. Meaningless.
					targetContainer = new me.ObjectContainer();
					
					// set additional properties
					targetContainer.name = group.name;
					targetContainer.z = group.z;
					targetContainer.setOpacity(group.opacity);                  
                 
					// disable auto-sort
					targetContainer.autoSort = false;
				}

				// iterate through the group and add all object into their
				// corresponding target Container
				for ( var o = 0; o < group.objects.length; o++) {
					
					// TMX object settings
					var settings = group.objects[o];
                    
					var obj = me.pool.pull(
						settings.name, 
						settings.x, settings.y,
						// 'TileObject' will instantiate a Sprite Object
						settings.name === 'TileObject' ? settings.image : settings
					);
                    
					// ignore if the pull function does not return a corresponding object
					if (obj) {
						
						// set the obj z order correspondingly to its parent container/group
						obj.z = group.z;

						//apply group opacity value to the child objects if group are merged
						if (me.game.mergeGroup === true && obj.isRenderable === true) {
							obj.setOpacity(obj.getOpacity() * group.opacity);
							// and to child renderables if any
							if (obj.renderable instanceof me.Renderable) {
								obj.renderable.setOpacity(obj.renderable.getOpacity() * group.opacity);
							}
						}                        
						// add the obj into the target container
						targetContainer.addChild(obj);
					}
				}

				// if we created a new container
				if (me.game.mergeGroup === false) {
										
					// add our container to the world
					container.addChild(targetContainer);
					
					// re-enable auto-sort
					targetContainer.autoSort = true;	
				
				}

			}

			// sort everything (recursively)
			container.sort(true);
			
			// re-enable auto-sort
			container.autoSort = true;

			// translate the display if required
			me.game.world.transform.translateV( me.game.currentLevel.pos );

			// fire the callback if defined
			if (me.game.onLevelLoaded) {
				me.game.onLevelLoaded.call(me.game.onLevelLoaded, level.name);
			}
			//publish the corresponding message
			me.event.publish(me.event.LEVEL_LOADED, [level.name]);

		};

		
		/*---------------------------------------------
			
			PUBLIC STUFF
				
		 ---------------------------------------------*/
		/**
		 * reset the level director 
		 * @ignore
		 */
		obj.reset = function() {

		};

		/**
		 * add a level  
		 * @ignore
		 */
		obj.addLevel = function(level) {
			throw "melonJS: no level loader defined";
		};

		/**
		 *
		 * add a TMX level  
		 * @ignore
		 */
		obj.addTMXLevel = function(levelId, callback) {
			// just load the level with the XML stuff
			if (levels[levelId] == null) {
				//console.log("loading "+ levelId);
				levels[levelId] = new me.TMXTileMap(levelId);
				// set the name of the level
				levels[levelId].name = levelId;
				// level index
				levelIdx.push(levelId);
			} 
			else  {
				//console.log("level %s already loaded", levelId);
				return false;
			}
			
			// call the callback if defined
			if (callback) {
				callback();
			}
			// true if level loaded
			return true;
		};

		/**
		 * load a level into the game manager<br>
		 * (will also create all level defined entities, etc..)
		 * @name loadLevel
		 * @memberOf me.levelDirector
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
				var wasRunning = me.state.isRunning();

				if (wasRunning) {
					// stop the game loop to avoid 
					// some silly side effects
					me.state.stop();
				}

				// reset the gameObject Manager (just in case!)
				me.game.reset();
				
				// reset the GUID generator
				// and pass the level id as parameter
				me.utils.resetGUID(levelId);
				
				// clean the current (previous) level
				if (levels[obj.getCurrentLevelId()]) {
					levels[obj.getCurrentLevelId()].destroy();
				}
				
				// read the map data
				me.mapReader.readMap(levels[levelId]);
			
				// update current level index
				currentLevelIdx = levelIdx.indexOf(levelId);
				
				// add the specified level to the game world
				loadTMXLevel(levels[levelId], me.game.world);
				
				if (wasRunning) {
					// resume the game loop if it was
					// previously running
					me.state.restart.defer(this);
				}
			} else {
				throw "melonJS: no level loader defined";
			}
			return true;
		};

		/**
		 * return the current level id<br>
		 * @name getCurrentLevelId
		 * @memberOf me.levelDirector
		 * @public
		 * @function
		 * @return {String}
		 */
		obj.getCurrentLevelId = function() {
			return levelIdx[currentLevelIdx];
		};

		/**
		 * reload the current level<br>
		 * @name reloadLevel
		 * @memberOf me.levelDirector
		 * @public
		 * @function
		 */
		obj.reloadLevel = function() {
			// reset the level to initial state
			//levels[currentLevel].reset();
			return obj.loadLevel(obj.getCurrentLevelId());
		};

		/**
		 * load the next level<br>
		 * @name nextLevel
		 * @memberOf me.levelDirector
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
		 * @name previousLevel
		 * @memberOf me.levelDirector
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

		/**
		 * return the amount of level preloaded<br>
		 * @name levelCount
		 * @memberOf me.levelDirector
		 * @public
		 * @function
		 */
		obj.levelCount = function() {
			return levelIdx.length;
		};
		
		// return our object
		return obj;
	})();
