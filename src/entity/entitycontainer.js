/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier Biot, Jason Oster
 * http://www.melonjs.org
 *
 */

(function(window) {

	/**
	 * EntityContainer represents a collection of entity objects.<br>	 *
	 * @class
	 * @extends me.Renderable
	 * @memberOf me
	 * @constructor
	 * @param {Number} [x=0] position of the container
	 * @param {Number} [y=0] position of the container
	 * @param {Number} [w=me.game.viewport.width] width of the container
	 * @param {number} [h=me.game.viewport.height] height of the container
	 */

	me.EntityContainer = me.Renderable.extend(
		/** @scope me.EntityContainer.prototype */ {

		/* The property of entity that should be used to sort on (default: "z")
		 * @public
		 * @type String
		 * @name propertyToSortOn
		 * @memberOf me.EntityContainer
		 */
		propertyToSortOn : "z",

		/**
		 * [read-only] The array of children of this container.
		 * @property children {Array}
		 */	
		children : null,


		// constructor
		init : function(x, y, width, height) {
			// call the parent constructor
			this.parent(
				new me.Vector2d(x || 0, y || 0),
				width || me.game.viewport.width,  // which default value here ?
				height || me.game.viewport.height 
			);
			//init the children array
			this.children = [];
		},

		/**
		 * reset the object.
		 * @name reset
		 * @memberOf me.EntityContainer
		 * @function
		 */
		reset : function() {
			this.children = [];
			this.propertyToSortOn = "z";
		},

		/**
		 * Adds a child to the container.
		 * @name addChild
		 * @memberOf me.EntityContainer
		 * @function
		 * @param {me.ObjectEntity} child
		 */
		addChild : function(child) {
			this.addChildAt(child, child[this.propertyToSortOn]);
		},

		/**
		 * Adds a child to the container at a specified index. 
		 * @name addChildAt
		 * @memberOf me.EntityContainer
		 * @function
		 * @param {me.ObjectEntity} child 
		 * @param {Number} [index="Object Property based on the `me.EntityContainer.propertyToSortOn` setting"]
		 */
		addChildAt : function(child, index) {

			var index = index;

			if (typeof(index) === 'undefined') {
				index = child[this.propertyToSortOn];
			}


			if(typeof(child.ancestor) !== 'undefined') {
				child.ancestor.removeChild(child);
			}

			child.ancestor = this;
			child.childIndex = index;
			
			//reuse index
			index =0;

			for (var i=0, l=this.children.length; i < l; i++) {
				// the list is indexed using the childIndex property
				// update/draw loop are inverted, so test sith "<"
				if (this.children[i].childIndex < child.childIndex) {
					break;
				}
				index++;
			}

			this.children.splice(index, 0, child);
			
		},

		/**
		 * Swaps the depth of 2 childs
		 * @name swapChildren
		 * @memberOf me.EntityContainer
		 * @function
		 * @param {me.ObjectEntity} child
		 * @param {me.ObjectEntity} child
		 */
		swapChildren : function(child, child2) {
			var index = this.children.indexOf( child );
			var index2 = this.children.indexOf( child2 );
			
			if ((index !== -1) && (index2 !== -1)) {
				
				// swap the indexes..
				child.childIndex = child2.childIndex;
				child2.childIndex = child.childIndex;
				// swap the positions..
				this.children[index] = child2;
				this.children[index2] = child;
				
			} else {
				throw "melonJS (me.EntityContainer): " + child + " Both the supplied entities must be a child of the caller " + this;
			}
		},

		/**
		 * Returns the Child at the specified index
		 * @name getChildAt
		 * @memberOf me.EntityContainer
		 * @function
		 * @param {Number} index
		 */
		getChildAt : function(index) {
			if((index >= 0) && (index < this.children.length)) {
				return this.children[index];
			} else {
				throw "melonJS (me.EntityContainer): " + child + " Both the supplied entities must be a child of the caller " + this;
			}
		},

		/**
		 * Returns true if contains the specified Child
		 * @name hasChild
		 * @memberOf me.EntityContainer
		 * @function
		 * @return {Boolean}
		 */
		hasChild : function(child) {
			return (this.children.indexOf( child ) !== -1);
		},

		/**
		 * Returns the Parent of the specified Child
		 * @name getParent
		 * @memberOf me.EntityContainer
		 * @function
		 * @return {me.ObjectEntity}
		 */
		getParent : function(child) {
			return child.ancestor;
		},
		
		/**
		 * return the entity corresponding to the property and value<br>
		 * note : avoid calling this function every frame since
		 * it parses the whole object tree each time
		 * @name getEntityByProp
		 * @memberOf me.EntityContainer
		 * @public
		 * @function
		 * @param {String} prop Property name
		 * @param {String} value Value of the property
		 * @return {me.ObjectEntity[]} Array of object entities
		 */
		getEntityByProp : function(prop, value)	{
			var objList = [];	
			// for string comparaisons
			var _regExp = new RegExp(value, "i");
			for (var i = this.children.length, obj; i--, obj = this.children[i];) {
				if (obj instanceof me.EntityContainer) {
					objList = objList.concat(obj.getEntityByProp(prop, value));
				} else if (obj.isEntity) {
					if (typeof (obj[prop]) === 'string') {
						if (obj[prop].match(_regExp)) {
							objList.push(obj);
						}
					} else if (obj[prop] == value) {
						objList.push(obj);
					}
				}
			}
			return objList;
		},
		
		/**
		 * Removes a child from the container.
		 * @name removeChild
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		removeChild : function(child) {
			var index = this.children.indexOf( child );
			
			if ( index !== -1 )  {
				
				child.ancestor = undefined;

				this.children.splice( index, 1 );
			
				// update indexes!
				for(var i=index,j=this.children.length; i<j; i++) {
					this.children[i].childIndex -= 1;
				}
			} else {
				throw "melonJS (me.EntityContainer): " + child + " The supplied entity must be a child of the caller " + this;
			}
		},

		/**
		 * Move the child in the group one step forward (depth).
		 * @name moveUp
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveUp : function(child) {
			// TODO : move one depth to the front
			throw "melonJS (me.EntityContainer): function moveUp() not implemented";
		},

		/**
		 * Move the child in the group one step backward (depth).
		 * @name moveDown
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveDown : function(child) {
			// TODO : move one depth to the back
			throw "melonJS (me.EntityContainer): function moveDown() not implemented";
		},

		/**
		 * Move the child in the group to the front(depth).
		 * @name moveToTop
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveToTop : function(child) {
			// TODO : move to the top
			throw "melonJS (me.EntityContainer): function moveToTop() not implemented";
		},

		/**
		 * Move the child in the group to the back(depth).
		 * @name moveToBottom
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveToBottom : function(child) {
			// TODO : move to the bottom
			throw "melonJS (me.EntityContainer): function moveToBottom() not implemented";
		},

		/**
		 * @private
		 */
		update : function() {
			var isDirty = false;

			if (me.state.isPaused()) {
				// game is paused so include an extra check
				for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
					if (obj.updateWhenPaused)
						continue;
			
					// check if object is visible
					obj.inViewport = obj.visible && (
						obj.floating || (obj.getRect && me.game.viewport.isVisible(obj))
					);

					// update our object
					isDirty |= (obj.inViewport || obj.alwaysUpdate) && obj.update();
				}
			} else {
				// normal loop, game isn't paused
				for ( var i = this.children.length, obj; i--, obj =this.children[i];) {

					// check if object is visible
					obj.inViewport = obj.visible && (
						obj.floating || (obj.getRect && me.game.viewport.isVisible(obj))
					);

					// update our object
					isDirty |= (obj.inViewport || obj.alwaysUpdate) && obj.update();
				}
			}

			return isDirty;

		},

		/**
		 * @private
		 */
		draw : function(context, rect) {
			this.drawCount = 0;			
			
			// translate to the container position
			context.translate(this.pos.x, this.pos.y);
			
			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
				
				if (obj.inViewport && obj.isRenderable) {

					if (obj.floating==true) {
						context.save();
						// translate back object
						context.translate(me.game.viewport.screenX -this.pos.x, me.game.viewport.screenY -this.pos.y);
					}

					// draw the object
					obj.draw(context, rect);

					if (obj.floating==true) {
						context.restore();
					}

					this.drawCount++;
				}
			}
			
			// translate back to origin
			context.translate(-this.pos.x, -this.pos.y);
		}

	});
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
