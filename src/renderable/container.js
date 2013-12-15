/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier Biot, Jason Oster
 * http://www.melonjs.org
 *
 */

(function(window) {

	/**
	 * A global "translation context" for nested ObjectContainers
	 * @ignore
	 */
	var globalTranslation = new me.Rect(new me.Vector2d(), 0, 0);

	/**
	 * A global "floating entity" reference counter for nested ObjectContainers
	 * @ignore
	 */
	var globalFloatingCounter = 0;

	/**
	 * EntityContainer represents a collection of child objects
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Number} [x=0] position of the container
	 * @param {Number} [y=0] position of the container
	 * @param {Number} [w=me.game.viewport.width] width of the container
	 * @param {number} [h=me.game.viewport.height] height of the container
	 */
	me.ObjectContainer = me.Renderable.extend(
		/** @scope me.ObjectContainer.prototype */ {

		/**
		 * The property of entity that should be used to sort on <br>
		 * value : "x", "y", "z" (default: me.game.sortOn)
		 * @public
		 * @type String
		 * @name sortOn
		 * @memberOf me.ObjectContainer
		 */
		sortOn : "z",
		
		/** 
		 * Specify if the entity list should be automatically sorted when adding a new child
		 * @public
		 * @type Boolean
		 * @name autoSort
		 * @memberOf me.ObjectContainer
		 */
		autoSort : true,
		
		/** 
		 * keep track of pending sort
		 * @ignore
		 */
		pendingSort : null,
		
		/**
		 * The array of children of this container.
		 * @ignore
		 */	
		children : null,

		/**
		 * Enable collision detection for this container (default true)<br>
		 * @public
		 * @type Boolean
		 * @name collidable
		 * @memberOf me.ObjectContainer
		 */
		collidable : true,
		

		/** 
		 * constructor
		 * @ignore
		 */
		init : function(x, y, width, height) {
			// call the parent constructor
			this.parent(
				new me.Vector2d(x || 0, y || 0),
				width || Infinity, 
				height || Infinity 
			);
			this.children = [];
			// by default reuse the global me.game.setting
			this.sortOn = me.game.sortOn;
			this.autoSort = true;
		},


		/**
		 * Add a child to the container <br>
		 * if auto-sort is disable, the object will be appended at the bottom of the list
		 * @name addChild
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		addChild : function(child) {
			if(typeof(child.ancestor) !== 'undefined') {
				child.ancestor.removeChild(child);
			} else {
				// only allocate a GUID if the object has no previous ancestor 
				// (e.g. move one child from one container to another)
				if (child.isRenderable) {
					// allocated a GUID value
					child.GUID = me.utils.createGUID();
				}
            }

            // specify a z property to infinity if not defined
			if (typeof child.z === 'undefined') {
				child.z = Infinity;
			}

			child.ancestor = this;
            
			this.children.push(child);
			
			if (this.autoSort === true) {
				this.sort();
			}
		},
		
		/**
		 * Add a child to the container at the specified index<br>
		 * (the list won't be sorted after insertion)
		 * @name addChildAt
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 * @param {Number} index
		 */
		addChildAt : function(child, index) {
			if((index >= 0) && (index < this.children.length)) {
				
				if(typeof(child.ancestor) !== 'undefined') {
					child.ancestor.removeChild(child);
				} else {
					// only allocate a GUID if the object has no previous ancestor 
					// (e.g. move one child from one container to another)
					if (child.isRenderable) {
						// allocated a GUID value
						child.GUID = me.utils.createGUID();
					}
				}
				
				child.ancestor = this;
				
				this.children.splice(index, 0, child);
			
			} else {
				throw "melonJS (me.ObjectContainer): Index (" + index + ") Out Of Bounds for addChildAt()";
			}
		},

		/**
		 * Swaps the position (z depth) of 2 childs
		 * @name swapChildren
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 * @param {me.Renderable} child
		 */
		swapChildren : function(child, child2) {
			var index = this.getChildIndex( child );
			var index2 = this.getChildIndex( child2 );
			
			if ((index !== -1) && (index2 !== -1)) {
				
				// swap z index
				var _z = child.z;
				child.z = child2.z;
				child2.z = _z;
				// swap the positions..
				this.children[index] = child2;
				this.children[index2] = child;
				
			} else {
				throw "melonJS (me.ObjectContainer): " + child + " Both the supplied entities must be a child of the caller " + this;
			}
		},

		/**
		 * Returns the Child at the specified index
		 * @name getChildAt
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {Number} index
		 */
		getChildAt : function(index) {
			if((index >= 0) && (index < this.children.length)) {
				return this.children[index];
			} else {
				throw "melonJS (me.ObjectContainer): Index (" + index + ") Out Of Bounds for getChildAt()";
			}
		},
		
		/**
		 * Returns the index of the Child
		 * @name getChildAt
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		getChildIndex : function(child) {
			return this.children.indexOf( child );
		},

		/**
		 * Returns true if contains the specified Child
		 * @name hasChild
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 * @return {Boolean}
		 */
		hasChild : function(child) {
			return this === child.ancestor;
		},
		
		/**
		 * return the child corresponding to the given property and value.<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object tree each time
		 * @name getEntityByProp
		 * @memberOf me.ObjectContainer
		 * @public
		 * @function
		 * @param {String} prop Property name
		 * @param {String} value Value of the property
		 * @return {me.Renderable[]} Array of childs
		 * @example
		 * // get the first entity called "mainPlayer" in a specific container :
		 * ent = myContainer.getEntityByProp("name", "mainPlayer");
		 * // or query the whole world :
		 * ent = me.game.world.getEntityByProp("name", "mainPlayer");
		 */
		getEntityByProp : function(prop, value)	{
			var objList = [];	
			// for string comparaisons
			var _regExp = new RegExp(value, "i");

			function compare(obj, prop) {
				if (typeof (obj[prop]) === 'string') {
					if (obj[prop].match(_regExp)) {
						objList.push(obj);
					}
				} else if (obj[prop] === value) {
					objList.push(obj);
				}
			}

			for (var i = this.children.length, obj; i--, obj = this.children[i];) {
				if (obj instanceof me.ObjectContainer) {
					compare(obj, prop);
					objList = objList.concat(obj.getEntityByProp(prop, value));
				} else if (obj.isEntity) {
					compare(obj, prop);
				}
			}
			return objList;
		},
		
		/**
		 * Removes (and optionally destroys) a child from the container.<br>
		 * (removal is immediate and unconditional)<br>
		 * Never use keepalive=true with objects from {@link me.entityPool}. Doing so will create a memory leak.
		 * @name removeChild
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
		 */
		removeChild : function(child, keepalive) {

			if  (this.hasChild(child)) {
				
				child.ancestor = undefined;

				if (!keepalive) {
					if (typeof (child.destroy) === 'function') {
						child.destroy();
					}

					me.entityPool.freeInstance(child);
				}
				
				this.children.splice( this.getChildIndex(child), 1 );
			
			} else {
				throw "melonJS (me.ObjectContainer): " + child + " The supplied entity must be a child of the caller " + this;
			}
		},
        
		/**
		 * Automatically set the specified property of all childs to the given value
		 * @name setChildsProperty
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {String} property property name
		 * @param {Object} value property value
		 * @param {Boolean} [recursive=false] recursively apply the value to child containers if true
		 */
		setChildsProperty : function(prop, val, recursive) {
		    for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
		        if ((recursive === true) && (obj instanceof me.ObjectContainer)) {
		            obj.setChildsProperty(prop, val, recursive);
		        } 
		        obj[prop] = val;
		    }
		},
		
		/**
		 * Move the child in the group one step forward (z depth).
		 * @name moveUp
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		moveUp : function(child) {
			var childIndex = this.getChildIndex(child);
			if (childIndex -1 >= 0) {
				// note : we use an inverted loop
				this.swapChildren(child, this.getChildAt(childIndex-1));
			}
		},

		/**
		 * Move the child in the group one step backward (z depth).
		 * @name moveDown
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		moveDown : function(child) {
			var childIndex = this.getChildIndex(child);
			if (childIndex+1 < this.children.length) {
				// note : we use an inverted loop
				this.swapChildren(child, this.getChildAt(childIndex+1));
			}
		},

		/**
		 * Move the specified child to the top(z depth).
		 * @name moveToTop
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		moveToTop : function(child) {
			var childIndex = this.getChildIndex(child);
			if (childIndex > 0) {
				// note : we use an inverted loop
				this.splice(0, 0, this.splice(childIndex, 1)[0]);
				// increment our child z value based on the previous child depth
				child.z = this.children[1].z + 1;
			}
		},

		/**
		 * Move the specified child the bottom (z depth).
		 * @name moveToBottom
		 * @memberOf me.ObjectContainer
		 * @function
		 * @param {me.Renderable} child
		 */
		moveToBottom : function(child) {
			var childIndex = this.getChildIndex(child);
			if (childIndex < (this.children.length -1)) {
				// note : we use an inverted loop
				this.splice((this.children.length -1), 0, this.splice(childIndex, 1)[0]);
				// increment our child z value based on the next child depth
				child.z = this.children[(this.children.length -2)].z - 1;
			}
		},
		
		/**
		 * Checks if the specified entity collides with others entities in this container
		 * @name collide
		 * @memberOf me.ObjectContainer
		 * @public
		 * @function
		 * @param {me.Renderable} obj Object to be tested for collision
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 */
		collide : function(objA, multiple) {
			return this.collideType(objA, null, multiple);
		},
		
		/**
		 * Checks if the specified entity collides with others entities in this container
		 * @name collideType
		 * @memberOf me.ObjectContainer
		 * @public
		 * @function
		 * @param {me.Renderable} obj Object to be tested for collision
		 * @param {String} [type=undefined] Entity type to be tested for collision
		 * @param {Boolean} [multiple=false] check for multiple collision
		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
		 */
		collideType : function(objA, type, multiple) {
			var res, mres;
			// make sure we have a boolean
			multiple = multiple===true ? true : false;
			if (multiple===true) {
				mres = [];
			} 

			// this should be replace by a list of the 4 adjacent cell around the object requesting collision
			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
			
				if ( (obj.inViewport || obj.alwaysUpdate ) && obj.collidable ) {
					
					// recursivly check through
					if (obj instanceof me.ObjectContainer) {
					
						res = obj.collideType(objA, type, multiple); 
						if (multiple) {
							mres.concat(res);
						} else if (res) {
							// the child container returned collision information
							return res;
						}
						
					} else if ( (obj !== objA) && (!type || (obj.type === type)) ) {
			
						res = obj.collisionBox["collideWith"+objA.shapeType].call(obj.collisionBox, objA.collisionBox);
						
						if (res.x !== 0 || res.y !== 0) {
							// notify the object
							obj.onCollision.call(obj, res, objA);
							// return the type (deprecated)
							res.type = obj.type;
							// return a reference of the colliding object
							res.obj = obj;
							// stop here if we don't look for multiple collision detection
							if (!multiple) {
								return res;
							}
							mres.push(res);
						}
					}
				}
			}
			return multiple?mres:null;
		},
		
		/**
		 * Manually trigger the sort of all the childs in the container</p>
		 * @name sort
		 * @memberOf me.ObjectContainer
		 * @public
		 * @function
		 * @param {Boolean} [recursive=false] recursively sort all containers if true
		 */
		sort : function(recursive) {
						
			// do nothing if there is already a pending sort
			if (this.pendingSort === null) {
				if (recursive === true) {
					// trigger other child container sort function (if any)
					for (var i = this.children.length, obj; i--, obj = this.children[i];) {
						if (obj instanceof me.ObjectContainer) {
							// note : this will generate one defered sorting function
							// for each existing containe
							obj.sort(recursive);
						}
					}
				}
				/** @ignore */
				this.pendingSort = (function (self) {
					// sort everything in this container
					self.children.sort(self["_sort"+self.sortOn.toUpperCase()]);
					// clear the defer id
					self.pendingSort = null;
					// make sure we redraw everything
					me.game.repaint();
				}.defer(this));
			}
		},
		
		/**
		 * Z Sorting function
		 * @ignore
		 */
		_sortZ : function (a,b) {
			return (b.z) - (a.z);
		},
		/**
		 * X Sorting function
		 * @ignore
		 */
		_sortX : function(a,b) { 
			/* ? */
			var result = (b.z - a.z);
			return (result ? result : ((b.pos && b.pos.x) - (a.pos && a.pos.x)) || 0);
		},
		/**
		 * Y Sorting function
		 * @ignore
		 */
		_sortY : function(a,b) {
			var result = (b.z - a.z);
			return (result ? result : ((b.pos && b.pos.y) - (a.pos && a.pos.y)) || 0);
		},
		
		
		/**
		 * Destroy function<br>
		 * @ignore
		 */
		destroy : function() {
			// cancel any sort operation
			if (this.pendingSort) {
				clearTimeout(this.pendingSort);
				this.pendingSort = null;
			}
			// delete all children
			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
				// don't remove it if a persistent object
				if ( !obj.isPersistent ) {
					this.removeChild(obj);
				}	
			}
		},

		/**
		 * @ignore
		 */
		update : function() {
			var isDirty = false;
			var isFloating = false;
			var isPaused = me.state.isPaused();
			var isTranslated;
			var x;
			var y;
			var viewport = me.game.viewport;

			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
				if (isPaused && (!obj.updateWhenPaused)) {
					// skip this object
					continue;
				}
                
                if ( obj.isRenderable ) {

                    isFloating = (globalFloatingCounter > 0 || obj.floating);
                    if (isFloating) {
                        globalFloatingCounter++;
                    }

                    // Translate global context
                    isTranslated = (obj.visible && !isFloating);
                    if (isTranslated) {
                        x = obj.pos.x;
                        y = obj.pos.y;
                        globalTranslation.translateV(obj.pos);
                        globalTranslation.set(globalTranslation.pos, obj.width, obj.height);
                    }

                    // check if object is visible
                    obj.inViewport = obj.visible && (
                        isFloating || viewport.isVisible(globalTranslation)
                    );

                    // update our object
                    isDirty |= (obj.inViewport || obj.alwaysUpdate) && obj.update();

                    // Undo global context translation
                    if (isTranslated) {
                        globalTranslation.translate(-x, -y);
                    }

                    if (globalFloatingCounter > 0) {
                        globalFloatingCounter--;
                    }
                    
                } else {
                
                    // just directly call update() for non renderable object
                    isDirty |= obj.update();
                }
			}

			return isDirty;
		},

		/**
		 * @ignore
		 */
		draw : function(context, rect) {
			var viewport = me.game.viewport;
            var isFloating = false;
			
			this.drawCount = 0;			

			// save the current context
			context.save();
            
			// apply the group opacity
			context.globalAlpha *= this.getOpacity();
            
			// translate to the container position
			context.translate(this.pos.x, this.pos.y);

			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
				isFloating = obj.floating;
				if (obj.isRenderable && (obj.inViewport || (isFloating && obj.visible))) {

					if (isFloating === true) {
						context.save();
						// translate back object
						context.translate(
							viewport.screenX -this.pos.x, 
							viewport.screenY -this.pos.y
						);
					}

					// draw the object
					obj.draw(context, rect);

					if (isFloating === true) {
						context.restore();
					}

					this.drawCount++;
				}
			}

			// restore the context
			context.restore();
		}

	});
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
