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
			//todo
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
		 * @param {Number} [index]
		 */
		addChildAt : function(child, index) {

			var index = index;

			if (index === undefined) {
				index = child[this.propertyToSortOn];
			}


			if(child.ancestor !== undefined) {
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
		 * @name moveForward
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveForward : function(child) {
			// TODO : move one depth to the front
			throw "melonJS (me.EntityContainer): function moveForward() not implemented";
		},

		/**
		 * Move the child in the group one step backward (depth).
		 * @name moveBackward
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveBackward : function(child) {
			// TODO : move one depth to the back
			throw "melonJS (me.EntityContainer): function moveBackward() not implemented";
		},

		/**
		 * Move the child in the group to the front(depth).
		 * @name moveToFront
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveToFront : function(child) {
			// TODO : move to the top
			throw "melonJS (me.EntityContainer): function moveToFront() not implemented";
		},

		/**
		 * Move the child in the group to the back(depth).
		 * @name moveToBack
		 * @memberOf me.EntityContainer
		 * @function
		 * @param  {me.ObjectEntity} child
		 */
		moveToBack : function(child) {
			// TODO : move to the bottom
			throw "melonJS (me.EntityContainer): function moveToBack() not implemented";
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

			for ( var i = this.children.length, obj; i--, obj = this.children[i];) {
				
				if (obj.inViewport && obj.isRenderable) {

					if (obj.floating==true) {
						context.save();
						// translate back object
						context.translate(me.game.viewport.screenX, me.game.viewport.screenY);
					}

					// draw the object
					obj.draw(context, rect);

					if (obj.floating==true) {
						context.restore();
					}

					this.drawCount++;
				}
			}
		}

	});
	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);