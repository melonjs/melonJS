/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 */

(function($) {
	
	/************************************************************************************/
	/*                                                                                  */
	/*      a rectangle Class Object                                                    */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * a rectangle Object
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {me.Vector2d} v x,y position of the rectange
	 * @param {Number} w width of the rectangle
	 * @param {Number} h height of the rectangle
	 */
	me.Rect = Object.extend(
	/** @scope me.Rect.prototype */	{
	
		/**
		 * position of the Rectange
		 * @public
		 * @type me.Vector2d
		 * @name pos
		 * @memberOf me.Rect
		 */
		pos : null,

		/**
		 * allow to reduce the collision box size<p>
		 * while keeping the original position vector (pos)<p>
		 * corresponding to the entity<p>
		 * colPos is a relative offset to pos
		 * @ignore
		 * @type me.Vector2d
		 * @name colPos
		 * @memberOf me.Rect
		 * @see me.Rect#adjustSize
		 */
		colPos : null,
		
		/**
		 * left coordinate of the Rectange<br>
		 * takes in account the adjusted size of the rectangle (if set)
		 * @public
		 * @type Int
		 * @name left
		 * @memberOf me.Rect
		 */
		 // define later in the constructor
		
		/**
		 * right coordinate of the Rectange<br>
		 * takes in account the adjusted size of the rectangle (if set)
		 * @public
		 * @type Int
		 * @name right
		 * @memberOf me.Rect
		 */
		 // define later in the constructor
		 
		/**
		 * bottom coordinate of the Rectange<br>
		 * takes in account the adjusted size of the rectangle (if set)
		 * @public
		 * @type Int
		 * @name bottom
		 * @memberOf me.Rect
		 */
		// define later in the constructor
		
		/**
		 * top coordinate of the Rectange<br>
		 * takes in account the adjusted size of the rectangle (if set)
		 * @public
		 * @type Int
		 * @name top
		 * @memberOf me.Rect
		 */
		// define later in the constructor
		 
		/**
		 * width of the Rectange
		 * @public
		 * @type Int
		 * @name width
		 * @memberOf me.Rect
		 */
		width : 0,
		/**
		 * height of the Rectange
		 * @public
		 * @type Int
		 * @name height
		 * @memberOf me.Rect
		 */
		height : 0,

		// half width/height
		hWidth : 0,
		hHeight : 0,

		// the shape type
		shapeType : "Rectangle",

		/*
		 * will be replaced by pos and replace colPos in 1.0.0 :)
		 * @ignore
		 */
		offset: null,
		
		/** @ignore */
		init : function(v, w, h) {
            if (this.pos === null) {
                this.pos = new me.Vector2d();
            }
            this.pos.setV(v);

            if (this.offset === null) {
                this.offset = new me.Vector2d();
            }
            this.offset.set(0, 0);

            // allow to reduce the hitbox size
            // while on keeping the original pos vector
            // corresponding to the entity
            if (this.colPos === null) {
                this.colPos = new me.Vector2d();
            }
            this.colPos.setV(0, 0);

			this.width = w;
			this.height = h;

			// half width/height
			this.hWidth = ~~(w / 2);
			this.hHeight = ~~(h / 2);
			
			// redefine some properties to ease our life when getting the rectangle coordinates
			Object.defineProperty(this, "left", {
				get : function() {
					return this.pos.x;
				},
				configurable : true
			});
			
			Object.defineProperty(this, "right", {
				get : function() {
					return this.pos.x + this.width;
				},
				configurable : true
			});

			Object.defineProperty(this, "top", {
				get : function() {
					return this.pos.y;
				},
				configurable : true
			});

			Object.defineProperty(this, "bottom", {
				get : function() {
					return this.pos.y + this.height;
				},
				configurable : true
			});

		},

		/**
		 * set new value to the rectangle
		 * @name set
		 * @memberOf me.Rect
		 * @function
		 * @param {me.Vector2d} v x,y position for the rectangle
		 * @param {Number} w width of the rectangle
		 * @param {Number} h height of the rectangle
		 */
		set : function(v, w, h) {
			this.pos.setV(v);

			this.width = w;
			this.height = h;
			
			this.hWidth = ~~(w / 2);
			this.hHeight = ~~(h / 2);

			//reset offset
			this.offset.set(0, 0);
		},

        /**
         * returns the bounding box for this shape, the smallest rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} new rectangle	
         */
        getBounds : function() {
            return this.clone();
        },
        
        /**
         * clone this rectangle
         * @name clone
         * @memberOf me.Rect
         * @function
         * @return {me.Rect} new rectangle	
         */
        clone : function() {
            return new me.Rect(this.pos.clone(), this.width, this.height);
        },
		
		/**
		 * translate the rect by the specified offset
		 * @name translate
		 * @memberOf me.Rect
		 * @function
		 * @param {Number} x x offset
		 * @param {Number} y y offset
		 * @return {me.Rect} this rectangle	
		 */
		translate : function(x, y) {
			this.pos.x+=x;
			this.pos.y+=y;
			return this;
		},

		/**
		 * translate the rect by the specified vector
		 * @name translateV
		 * @memberOf me.Rect
		 * @function
		 * @param {me.Vector2d} v vector offset
		 * @return {me.Rect} this rectangle	
		 */
		translateV : function(v) {
			this.pos.add(v);
			return this;
		},

		/**
		 * merge this rectangle with another one
		 * @name union
		 * @memberOf me.Rect
		 * @function
		 * @param {me.Rect} rect other rectangle to union with
		 * @return {me.Rect} the union(ed) rectangle	 
		 */
		union : function(/** {me.Rect} */ r) {
			var x1 = Math.min(this.pos.x, r.pos.x);
			var y1 = Math.min(this.pos.y, r.pos.y);

			this.width  = Math.ceil( Math.max(this.pos.x + this.width,  r.pos.x + r.width)  - x1 );
			this.height = Math.ceil( Math.max(this.pos.y + this.height, r.pos.y + r.height) - y1 );
			
			this.hWidth = ~~(this.width / 2);
			this.hHeight = ~~(this.height / 2);
			
			this.pos.x  = ~~x1;
			this.pos.y  = ~~y1;

			return this;
		},

		/**
		 * update the size of the collision rectangle<br>
		 * the colPos Vector is then set as a relative offset to the initial position (pos)<br>
		 * <img src="images/me.Rect.colpos.png"/>
		 * @name adjustSize
		 * @memberOf me.Rect
		 * @function
		 * @param {Number} x x offset (specify -1 to not change the width)
		 * @param {Number} w width of the hit box
		 * @param {Number} y y offset (specify -1 to not change the height)
		 * @param {Number} h height of the hit box
		 */
		adjustSize : function(x, w, y, h) {
			if (x !== -1) {
				this.colPos.x = x;
				this.width = w;
				this.hWidth = ~~(this.width / 2);
				
				// avoid Property definition if not necessary
				if (this.left !== this.pos.x + this.colPos.x) {
					// redefine our properties taking colPos into account
					Object.defineProperty(this, "left", {
						get : function() {
							return this.pos.x + this.colPos.x;
						},
						configurable : true
					});
				}
				if (this.right !== this.pos.x + this.colPos.x + this.width) {
					Object.defineProperty(this, "right", {
						get : function() {
							return this.pos.x + this.colPos.x + this.width;
						},
						configurable : true
					});
				}
			}
			if (y !== -1) {
				this.colPos.y = y;
				this.height = h;
				this.hHeight = ~~(this.height / 2);
				
				// avoid Property definition if not necessary
				if (this.top !== this.pos.y + this.colPos.y) {
					// redefine our properties taking colPos into account
					Object.defineProperty(this, "top", {
						get : function() {
							return this.pos.y + this.colPos.y;
						},
						configurable : true
					});
				}
				if (this.bottom !== this.pos.y + this.colPos.y + this.height) {
					Object.defineProperty(this, "bottom", {
						get : function() {
							return this.pos.y + this.colPos.y + this.height;
						},
						configurable : true
					});
				}
			}
		},

		/**
		 *	
		 * flip on X axis
		 * usefull when used as collision box, in a non symetric way
		 * @ignore
		 * @param sw the sprite width
		 */
		flipX : function(sw) {
			this.colPos.x = sw - this.width - this.colPos.x;
			this.hWidth = ~~(this.width / 2);
		},

		/**
		 *	
		 * flip on Y axis
		 * usefull when used as collision box, in a non symetric way
		 * @ignore
		 * @param sh the height width
		 */
		flipY : function(sh) {
			this.colPos.y = sh - this.height - this.colPos.y;
			this.hHeight = ~~(this.height / 2);
		},
		
		/**
		 * return true if this rectangle is equal to the specified one
		 * @name equals
		 * @memberOf me.Rect
		 * @function
		 * @param {me.Rect} rect
		 * @return {Boolean}
		 */
		equals : function(r) {
			return (this.left   === r.left  && 
					this.right  === r.right && 
					this.top    === r.top   &&
					this.bottom === r.bottom);
		},

		/**
		 * check if this rectangle is intersecting with the specified one
		 * @name overlaps
		 * @memberOf me.Rect
		 * @function
		 * @param  {me.Rect} rect
		 * @return {Boolean} true if overlaps
		 */
		overlaps : function(r)	{
			return (this.left < r.right && 
					r.left < this.right && 
					this.top < r.bottom &&
					r.top < this.bottom);
		},
		
		/**
		 * check if this rectangle is within the specified one
		 * @name within
		 * @memberOf me.Rect
		 * @function
		 * @param  {me.Rect} rect
		 * @return {Boolean} true if within
		 */
		within: function(r) {
			return (r.left <= this.left && 
					r.right >= this.right &&
					r.top <= this.top && 
					r.bottom >= this.bottom);
		},
		
		/**
		 * check if this rectangle contains the specified one
		 * @name contains
		 * @memberOf me.Rect
		 * @function
		 * @param  {me.Rect} rect
		 * @return {Boolean} true if contains
		 */
		contains: function(r) {
			return (r.left >= this.left && 
					r.right <= this.right &&
					r.top >= this.top && 
					r.bottom <= this.bottom);
		},
		
		/**
		 * check if this rectangle contains the specified point
		 * @name containsPointV
		 * @memberOf me.Rect
		 * @function
		 * @param  {me.Vector2d} point
		 * @return {Boolean} true if contains
		 */
		containsPointV: function(v) {
			return this.containsPoint(v.x, v.y);
		},

		/**
		 * check if this rectangle contains the specified point
		 * @name containsPoint
		 * @memberOf me.Rect
		 * @function
		 * @param  {Number} x x coordinate
		 * @param  {Number} y y coordinate
		 * @return {Boolean} true if contains
		 */
		containsPoint: function(x, y) {
			return  (x >= this.left && x <= this.right && 
					(y >= this.top) && y <= this.bottom);
		},

		/**
		 * AABB vs AABB collission dectection<p>
		 * If there was a collision, the return vector will contains the following values: 
		 * @example
		 * if (v.x != 0 || v.y != 0)
		 * {
		 *   if (v.x != 0)
		 *   {
		 *      // x axis
		 *      if (v.x<0)
		 *         console.log("x axis : left side !");
		 *      else
		 *         console.log("x axis : right side !");
		 *   }
		 *   else
		 *   {
		 *      // y axis
		 *      if (v.y<0)
		 *         console.log("y axis : top side !");
		 *      else
		 *         console.log("y axis : bottom side !");			
		 *   }
		 *		
		 * }
		 * @ignore
		 * @param {me.Rect} rect
		 * @return {me.Vector2d} 
		 */
		collideWithRectangle : function(/** {me.Rect} */ rect) {
			// response vector
			var p = new me.Vector2d(0, 0);

			// check if both box are overlaping
			if (this.overlaps(rect)) {
				// compute delta between this & rect
				var dx = this.left + this.hWidth  - rect.left - rect.hWidth;
				var dy = this.top  + this.hHeight - rect.top  - rect.hHeight;

				// compute penetration depth for both axis
				p.x = (rect.hWidth  + this.hWidth)  - (dx < 0 ? -dx : dx); // - Math.abs(dx);
				p.y = (rect.hHeight + this.hHeight) - (dy < 0 ? -dy : dy); // - Math.abs(dy);

				// check and "normalize" axis
				if (p.x < p.y) {
					p.y = 0;
					p.x = dx < 0 ? -p.x : p.x;
				} else {
					p.x = 0;
					p.y = dy < 0 ? -p.y : p.y;
				}
			}
			return p;
		},

		/**
		 * debug purpose
		 * @ignore
		 */
		draw : function(context, color) {
			// draw the rectangle
			context.strokeStyle = color || "red";
			context.strokeRect(this.left, this.top, this.width, this.height);

		}
	});

    /************************************************************************************/
	/*                                                                                  */
	/*      a Ellipse Class Object                                                      */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * an ellipse Object
	 * (Tiled specifies top-left coordinates, and width and height of the ellipse)
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {me.Vector2d} v top-left origin position of the Ellipse
	 * @param {Number} w width of the elipse
	 * @param {Number} h height of the elipse
	 */
	me.Ellipse = Object.extend(
	/** @scope me.Ellipse.prototype */	{
	
		/**
		 * center point of the Ellipse
		 * @public
		 * @type me.Vector2d
		 * @name pos
		 * @memberOf me.Ellipse
		 */
		pos : null,
		 
		/**
		 * radius (x/y) of the ellipse
		 * @public
		 * @type me.Vector2d
		 * @name radius
		 * @memberOf me.Ellipse
		 */
		radius : null,
        

		// the shape type
		shapeType : "Ellipse",
		
		
		/** @ignore */
		init : function(v, w, h) {
            if (this.pos === null) {
                this.pos = new me.Vector2d();
            }
            if (this.radius === null) {
                this.radius = new me.Vector2d();
            }
			this.set(v, w, h);
		},

		/**
		 * set new value to the Ellipse
		 * @name set
		 * @memberOf me.Ellipse
		 * @function
		 * @param {me.Vector2d} v top-left origin position of the Ellipse
		 * @param {Number} w width of the Ellipse
		 * @param {Number} h height of the Ellipse
		 */
		set : function(v, w, h) {
			this.radius.set(w/2, h/2);
            this.pos.setV(v).add(this.radius); 
            this.offset = new me.Vector2d();
		},

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.Ellipse
         * @function
         * @return {me.Rect} the bounding box Rectangle	object
         */
        getBounds : function() {
            //will return a rect, with pos being the top-left coordinates 
            return new me.Rect(
                this.pos.clone().sub(this.radius), 
                this.radius.x * 2, 
                this.radius.y * 2
            );
        },
        
        /**
         * clone this Ellipse
         * @name clone
         * @memberOf me.Ellipse
         * @function
         * @return {me.Ellipse} new Ellipse	
         */
        clone : function() {
            return new me.Ellipse(this.pos.clone(), this.radius.x * 2, this.radius.y * 2);
        },


		/**
		 * debug purpose
		 * @ignore
		 */
		draw : function(context, color) {
			// http://tinyurl.com/opnro2r
			context.save();
			context.beginPath();

			context.translate(this.pos.x-this.radius.x, this.pos.y-this.radius.y);
			context.scale(this.radius.x, this.radius.y);
			context.arc(1, 1, 1, 0, 2 * Math.PI, false);

			context.restore();
			context.strokeStyle = color || "red";
			context.stroke();
		}
	});
    
    /************************************************************************************/
	/*                                                                                  */
	/*      a PolyShape Class Object                                                    */
	/*                                                                                  */
	/************************************************************************************/
	/**
	 * a polyshape (polygone/polyline) Object
	 * @class
	 * @extends Object
	 * @memberOf me
	 * @constructor
	 * @param {me.Vector2d} v origin point of the PolyShape
	 * @param {me.Vector2d[]} points array of vector defining the polyshape
	 * @param {Boolean} closed true if a polygone, false if a polyline
	 */
	me.PolyShape = Object.extend(
	/** @scope me.PolyShape.prototype */	{
	
		/**
		 * @ignore
		 */
		offset : null,

		/**
		 * origin point of the PolyShape
		 * @public
		 * @type me.Vector2d
		 * @name pos
		 * @memberOf me.PolyShape
		 */
		pos : null,
		 
		/**
		 * Array of points defining the polyshape
		 * @public
		 * @type me.Vector2d[]
		 * @name points
		 * @memberOf me.PolyShape
		 */
		points : null,

		/**
		 * Specified if the shape is closed (i.e. polygon)
		 * @public
		 * @type boolean
		 * @name closed
		 * @memberOf me.PolyShape
		 */
		closed : null,
        

		// the shape type
		shapeType : "PolyShape",
		
		
		/** @ignore */
		init : function(v, points, closed) {
            if (this.pos === null) {
                this.pos = new me.Vector2d();
            }

            if (this.offset === null) {
                this.offset = new me.Vector2d();
            }
 
            this.set(v, points, closed);
		},

		/**
		 * set new value to the PolyShape
		 * @name set
		 * @memberOf me.PolyShape
		 * @function
		 * @param {me.Vector2d} v origin point of the PolyShape
		 * @param {me.Vector2d[]} points array of vector defining the polyshape
		 * @param {Boolean} closed true if a polygone, false if a polyline
		 */
		set : function(v, points, closed) {
			this.pos.setV(v);
            this.points = points;
            this.closed = (closed === true);
            this.offset.set(0, 0);
            this.getBounds();
		},

        /**
         * returns the bounding box for this shape, the smallest Rectangle object completely containing this shape.
         * @name getBounds
         * @memberOf me.PolyShape
         * @function
         * @return {me.Rect} the bounding box Rectangle	object
         */
        getBounds : function() {
            var pos = this.offset, right = 0, bottom = 0;
            this.points.forEach(function(point) {
                pos.x = Math.min(pos.x, point.x);
                pos.y = Math.min(pos.y, point.y);
                right = Math.max(right, point.x);
                bottom = Math.max(bottom, point.y);
            });
            return new me.Rect(pos, right - pos.x, bottom - pos.y);
        },
        
        /**
         * clone this PolyShape
         * @name clone
         * @memberOf me.PolyShape
         * @function
         * @return {me.PolyShape} new PolyShape	
         */
        clone : function() {
            return new me.PolyShape(this.pos.clone(), this.points, this.closed);
        },


		/**
		 * debug purpose
		 * @ignore
		 */
		draw : function(context, color) {
			context.save();
			context.translate(-this.offset.x, -this.offset.y);
			context.strokeStyle = color || "red";
			context.beginPath();
			context.moveTo(this.points[0].x, this.points[0].y);
			this.points.forEach(function(point) {
				context.lineTo(point.x, point.y);
				context.moveTo(point.x, point.y);
			
			});
			if (this.closed===true) {
				context.lineTo(this.points[0].x, this.points[0].y);
			}
			context.stroke();
			context.restore();
		}

	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
