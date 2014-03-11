    /*
     * MelonJS Game Engine
     * Copyright (C) 2011 - 2013, Olivier Biot, Jason Oster
     * http://www.melonjs.org
     *
     */
    
    (function() {
    
    	/**
    	 * Private function to re-use for object removal in a defer
    	 * @ignore
    	 */
    	var deferredRemove = function(child, keepalive) {
    		if(child.ancestor) {
    			child.ancestor.removeChildNow(child, keepalive);
    		}
    	};
    
    	/**
    	 * A global "translation context" for nested ObjectContainers
    	 * @ignore
    	 */
    	var globalTranslation = new me.Rect(new me.Vector2d(), 0, 0);
    
    	/**
    	 * A global "floating children" reference counter for nested ObjectContainers
    	 * @ignore
    	 */
    	var globalFloatingCounter = 0;
    
    	/**
    	 * ObjectContainer represents a collection of child objects
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
    		 * The property of the child object that should be used to sort on <br>
    		 * value : "x", "y", "z" (default: me.game.sortOn)
    		 * @public
    		 * @type String
    		 * @name sortOn
    		 * @memberOf me.ObjectContainer
    		 */
    		sortOn : "z",
    		
    		/** 
    		 * Specify if the children list should be automatically sorted when adding a new child
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
    		 * Container bounds
    		 * @ignore
    		 */	
    		bounds : null,
            
    		/**
    		 * Enable collision detection for this container (default true)<br>
    		 * @public
    		 * @type Boolean
    		 * @name collidable
    		 * @memberOf me.ObjectContainer
    		 */
    		collidable : true,
            
    		/**
    		 * the container default transformation matrix
    		 * @public
    		 * @type me.Matrix2d
    		 * @name transform
    		 * @memberOf me.ObjectContainer
    		 */
    		transform : new me.Matrix2d(),
    		
    		
    
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
    			// init the bounds to an empty rect
    			this.bounds = new me.Rect(new me.Vector2d(0,0), 0, 0);
    			this.children = [];
    			// by default reuse the global me.game.setting
    			this.sortOn = me.game.sortOn;
    			this.autoSort = true;
                this.transform.identity();
    		},
    
    
    		/**
    		 * Add a child to the container <br>
    		 * if auto-sort is disable, the object will be appended at the bottom of the list
    		 * @name addChild
    		 * @memberOf me.ObjectContainer
    		 * @function
    		 * @param {me.Renderable} child
    		 * @param {number} [zIndex] forces the z index of the child to the specified value.
    		 */
    		addChild : function(child, zIndex) {
    			if(typeof(child.ancestor) !== 'undefined') {
    				child.ancestor.removeChildNow(child);
    			} else {
    				// only allocate a GUID if the object has no previous ancestor 
    				// (e.g. move one child from one container to another)
    				if (child.isRenderable) {
    					// allocated a GUID value
    					child.GUID = me.utils.createGUID();
    				}
                }
                
                // change the child z-index if one is specified
                if (typeof(zIndex) === 'number') {
                    child.z = zIndex;
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
    					child.ancestor.removeChildNow(child);
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
    				throw "melonJS (me.ObjectContainer): " + child + " Both the supplied childs must be a child of the caller " + this;
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
    		 * @name getChildByProp
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {String} prop Property name
    		 * @param {String} value Value of the property
    		 * @return {me.Renderable[]} Array of childs
    		 * @example
    		 * // get the first child object called "mainPlayer" in a specific container :
    		 * ent = myContainer.getChildByProp("name", "mainPlayer");
    		 * // or query the whole world :
    		 * ent = me.game.world.getChildByProp("name", "mainPlayer");
    		 */
    		getChildByProp : function(prop, value)	{
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
    					objList = objList.concat(obj.getChildByProp(prop, value));
    				} else {
    					compare(obj, prop);
    				}
    			}
    			return objList;
    		},
    		
    
    		/**
    		 * returns the list of childs with the specified name<br>
    		 * as defined in Tiled (Name field of the Object Properties)<br>
    		 * note : avoid calling this function every frame since
    		 * it parses the whole object list each time
    		 * @name getChildByName
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {String} name entity name
    		 * @return {me.Renderable[]} Array of childs
    		 */
    		getChildByName : function(name) {
    			return this.getChildByProp("name", name);
    		},
    		
    		/**
    		 * return the child corresponding to the specified GUID<br>
    		 * note : avoid calling this function every frame since
    		 * it parses the whole object list each time
    		 * @name getChildByGUID
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {String} GUID entity GUID
    		 * @return {me.Renderable} corresponding child or null
    		 */
    		getChildByGUID : function(guid) {
    			var obj = this.getChildByProp("GUID", guid);
    			return (obj.length>0)?obj[0]:null;
    		},
            
            
            /**
             * returns the bounding box for this container, the smallest rectangle object completely containing all childrens
             * @name getBounds
             * @memberOf me.ObjectContainer
             * @function
             * @param {me.Rect} [rect] an optional rectangle object to use when returning the bounding rect(else returns a new object)
             * @return {me.Rect} new rectangle    
             */
            getBounds : function(rect) {
                var _bounds = (typeof(rect) !== 'undefined') ? rect : this.bounds;
                
                // reset the rect with default values
                _bounds.pos.set(Infinity, Infinity);
                _bounds.resize(-Infinity, -Infinity);
                
                var childBounds;
                for ( var i = this.children.length, child; i--, child = this.children[i];) {
                    if(child.isRenderable) {
                        childBounds = child.getBounds();
                        // TODO : returns an "empty" rect instead of null (e.g. EntityObject)
                        // TODO : getBounds should always return something anyway
                        if (childBounds !== null) {
                            _bounds.union(childBounds);
                        }
                    }
                }
                // TODO : cache the value until any childs are modified? (next frame?) 
                return _bounds;
            },
    
    		/**
    		 * Invokes the removeChildNow in a defer, to ensure the child is removed safely after the update & draw stack has completed
    		 * @name removeChild
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {me.Renderable} child
    		 * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
    		 */
    		removeChild : function(child, keepalive) {
    			if(child.ancestor) {
    				deferredRemove.defer(this, child, keepalive);
    			}
    		},
    
    
    		/**
    		 * Removes (and optionally destroys) a child from the container.<br>
    		 * (removal is immediate and unconditional)<br>
    		 * Never use keepalive=true with objects from {@link me.pool}. Doing so will create a memory leak.
    		 * @name removeChildNow
    		 * @memberOf me.ObjectContainer
    		 * @function
    		 * @param {me.Renderable} child
    		 * @param {Boolean} [keepalive=False] True to prevent calling child.destroy()
    		 */
    		removeChildNow : function(child, keepalive) {
    			if  (this.hasChild(child)) {
    				
    				child.ancestor = undefined;
    
    				if (!keepalive) {
    					if (typeof (child.destroy) === 'function') {
    						child.destroy();
    					}
    
    					me.pool.push(child);
    				}
    				
    				this.children.splice( this.getChildIndex(child), 1 );
    			
    			} else {
    				throw "melonJS (me.ObjectContainer): " + child + " The supplied child must be a child of the caller " + this;
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
    		 * Checks if the specified child collides with others childs in this container
    		 * @name collide
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {me.Renderable} obj Object to be tested for collision
    		 * @param {Boolean} [multiple=false] check for multiple collision
    		 * @return {me.Vector2d} collision vector or an array of collision vector (multiple collision){@link me.Rect#collideVsAABB}
    		 * @example
    		 * // check for collision between this object and others
    		 * res = me.game.world.collide(this);
    		 *
    		 * // check if we collide with an enemy :
    		 * if (res && (res.obj.type == game.constants.ENEMY_OBJECT)) {
    		 *   if (res.x != 0) {
    		 *      // x axis
    		 *      if (res.x<0)
    		 *         console.log("x axis : left side !");
    		 *      else
    		 *         console.log("x axis : right side !");
    		 *   }
    		 *   else {
    		 *      // y axis
    		 *      if (res.y<0)
    		 *         console.log("y axis : top side !");
    		 *      else
    		 *         console.log("y axis : bottom side !");
    		 *   }
    		 * }
    		 */
    		collide : function(objA, multiple) {
    			return this.collideType(objA, null, multiple);
    		},
    		
    		/**
    		 * Checks if the specified child collides with others childs in this container
    		 * @name collideType
    		 * @memberOf me.ObjectContainer
    		 * @public
    		 * @function
    		 * @param {me.Renderable} obj Object to be tested for collision
    		 * @param {String} [type=undefined] child type to be tested for collision
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
    
    						this._boundsA = obj.getBounds(this._boundsA).translateV(obj.pos);
    						this._boundsB = objA.getBounds(this._boundsB).translateV(objA.pos);
    					
    						res = this._boundsA["collideWith"+this._boundsB.shapeType].call(
    							this._boundsA, 
    							this._boundsB
    						);
    
    						
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
    				}.defer(this, this));
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
    					this.removeChildNow(obj);
    				}	
    			}
                
                // reset the transformation matrix
                this.transform.identity();
    		},
    
    		/**
    		 * @ignore
    		 */
    		update : function( dt ) {
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
                        isTranslated = !isFloating;
                        if (isTranslated) {
                            x = obj.pos.x;
                            y = obj.pos.y;
                            globalTranslation.translateV(obj.pos);
                            globalTranslation.resize(obj.width, obj.height);
                        }
    
                        // check if object is visible
                        obj.inViewport = isFloating || viewport.isVisible(globalTranslation);
    
                        // update our object
                        isDirty |= (obj.inViewport || obj.alwaysUpdate) && obj.update( dt );
    
                        // Undo global context translation
                        if (isTranslated) {
                            globalTranslation.translate(-x, -y);
                        }
    
                        if (globalFloatingCounter > 0) {
                            globalFloatingCounter--;
                        }
                        
                    } else {                
                        // just directly call update() for non renderable object
                        isDirty |= obj.update( dt );
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
                
                context.save();
                
    			// apply the container current transform
    			context.transform(
                    this.transform.a, this.transform.b,
                    this.transform.c, this.transform.d, 
                    this.transform.e, this.transform.f
                );
                
    			// apply the group opacity
    			context.globalAlpha *= this.getOpacity();
                
    			// translate to the container position
    			context.translate(this.pos.x, this.pos.y);
    
    			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
    				isFloating = obj.floating;
    				if ((obj.inViewport || isFloating) && obj.isRenderable) {
    
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
    
    					if (isFloating === true) 
    						context.restore();
    
    					this.drawCount++;
    				}
    			}
                context.restore();
    		}
    	});
    	/*---------------------------------------------------------*/
    	// END END END
    	/*---------------------------------------------------------*/
    })();
