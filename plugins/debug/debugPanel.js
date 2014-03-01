/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2013, Olivier BIOT
 * http://www.melonjs.org
 *
 * a simple debug panel plugin
 * usage : me.plugin.register(debugPanel, "debug");
 *
 * you can then use me.plugin.debug.show() or me.plugin.debug.hide()
 * to show or hide the panel, or press respectively the "S" and "H" keys.
 *
 * note :
 * Heap Memory information is available under Chrome when using
 * the "--enable-memory-info" parameter to launch Chrome
 */

(function($) {

	// ensure that me.debug is defined
	me.debug = me.debug || {};

	/**
	 * @class
	 * @public
	 * @extends me.plugin.Base
	 * @memberOf me
	 * @constructor
	 */
	debugPanel = me.plugin.Base.extend(
	/** @scope me.debug.Panel.prototype */
	{

		// Object "Game Unique Identifier"
		GUID : null,

		// to hold the debug options
		// clickable rect area
		area : {},

		// panel position and size
		rect : null,

		// for z ordering
		// make it ridiculously high
		z : Infinity,

		// visibility flag
		visible : false,

		// frame update time in ms
		frameUpdateTime : 0,

		// frame draw time in ms
		frameDrawTime : 0,

		// minimum melonJS version expected
		version : "1.0.0",

		/** @private */
		init : function(showKey, hideKey) {
			// call the parent constructor
			this.parent();

			this.rect = new me.Rect(new me.Vector2d(0, 0), me.video.getWidth(), 35);

			// set the object GUID value
			this.GUID = "debug-" + me.utils.createGUID();

			// set the object entity name
			this.name = "me.debugPanel";

			// persistent
			this.isPersistent = true;

			// a floating object
			this.floating = true;

			// renderable
			this.isRenderable = true;

			// always update, even when not visible
			this.alwaysUpdate = true;

			// create a default font, with fixed char width
			this.font = new me.Font('courier', 10, 'white');

			// clickable areas
			this.area.renderHitBox = new me.Rect(new me.Vector2d(160,5),15,15);
			this.area.renderVelocity = new me.Rect(new me.Vector2d(165,18),15,15);

			this.area.renderDirty = new me.Rect(new me.Vector2d(270,5),15,15);
			this.area.renderCollisionMap = new me.Rect(new me.Vector2d(270,18),15,15);

			// some internal string/length
			this.help_str	  = "(s)how/(h)ide";
			this.help_str_len = this.font.measureText(me.video.getSystemContext(), this.help_str).width;
			this.fps_str_len = this.font.measureText(me.video.getSystemContext(), "00/00 fps").width;

			// enable the FPS counter
			me.debug.displayFPS = true;

			// bind the "S" and "H" keys
			me.input.bindKey(showKey || me.input.KEY.S, "show", false, false);
			me.input.bindKey(hideKey || me.input.KEY.H, "hide", false, false);
            
            // add some keyboard shortcuts
            var self = this;
            this.handler = me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
                if (action === "show") {
                    self.show();
                } else if (action === "hide") {
                    self.hide();
                }
            });

			// memory heap sample points
			this.samples = [];

			//patch patch patch !
			this.patchSystemFn();

			// make it visible
			this.show();
		},


		/**
		 * patch system fn to draw debug information
		 */
		patchSystemFn : function() {

			// add a few new debug flag (if not yet defined)
			me.debug.renderHitBox = me.debug.renderHitBox || false;
			me.debug.renderVelocity = me.debug.renderVelocity || false;
			var _this = this;
			// patch timer.js
			me.plugin.patch(me.timer, "update", function (time) {
				// call the original me.timer.update function
				this.parent(time);

				// call the FPS counter
				me.timer.countFPS();
			});

			// patch me.game.update
			me.plugin.patch(me.game, 'update', function(time) {
				var frameUpdateStartTime = window.performance.now();

				this.parent(time);

				// calculate the update time
				_this.frameUpdateTime = window.performance.now() - frameUpdateStartTime;
			});

			// patch me.game.draw
			me.plugin.patch(me.game, 'draw', function() {
				var frameDrawStartTime = window.performance.now();

				this.parent();

				// calculate the drawing time
				_this.frameDrawTime = window.performance.now() - frameDrawStartTime;
			});

			// patch sprite.js
			me.plugin.patch(me.SpriteObject, "draw", function (context) {
				// call the original me.SpriteObject function
				this.parent(context);

				// draw the sprite rectangle
				if (me.debug.renderHitBox) {
					context.strokeStyle =  "green";
					context.strokeRect(this.left, this.top, this.width, this.height);
				}
			});

			// patch entities.js
			me.plugin.patch(me.ObjectEntity, "draw", function (context) {
				// call the original me.game.draw function
				this.parent(context);

				// check if debug mode is enabled
				if (me.debug.renderHitBox && this.shapes.length) {

                    // translate to the object position
                    var translateX = this.pos.x ;
                    var translateY = this.pos.y ;

                    context.translate(translateX, translateY);

                    // draw the original shape
                    this.getShape().draw(context, "red");
             		if (this.getShape().shapeType!=="Rectangle") {
             			// draw the corresponding bounding box
	                    this.getShape().getBounds().draw(context, "red");
                    }

                    context.translate(-translateX, -translateY);

				}

				if (me.debug.renderVelocity) {
					// draw entity current velocity
					var x = ~~(this.pos.x + this.hWidth);
					var y = ~~(this.pos.y + this.hHeight);

					context.strokeStyle = "blue";
					context.lineWidth = 1;
					context.beginPath();
					context.moveTo(x, y);
					context.lineTo(
						x + ~~(this.vel.x * this.hWidth),
						y + ~~(this.vel.y * this.hHeight)
					);
					context.stroke();
				}
			});
		},

		/**
		 * show the debug panel
		 */
		show : function() {
			if (!this.visible) {
				// register a mouse event for the checkboxes
				me.input.registerPointerEvent('pointerdown', this.rect, this.onClick.bind(this), true);
				// add the debug panel to the game world
				me.game.world.addChild(this, Infinity);
				// mark it as visible
				this.visible = true;         
			}
		},

		/**
		 * hide the debug panel
		 */
		hide : function() {
			if (this.visible) {
				// release the mouse event for the checkboxes
				me.input.releasePointerEvent('pointerdown', this.rect);
				// remove the debug panel from the game world
				me.game.world.removeChild(this);
				// mark it as invisible
				this.visible = false;
			}
		},


		/** @private */
		update : function() {
			if (me.input.isKeyPressed('show')) {
				this.show();
			}
			else if (me.input.isKeyPressed('hide')) {
				this.hide();
			}
			return true;
		},

		/**
		 * @private
		 */
		getBounds : function() {
			return this.rect;
		},

		/** @private */
		onClick : function(e)  {
			// check the clickable areas
			if (this.area.renderHitBox.containsPoint(e.gameX, e.gameY)) {
				me.debug.renderHitBox = !me.debug.renderHitBox;
			}
			else if (this.area.renderCollisionMap.containsPoint(e.gameX, e.gameY)) {
				me.debug.renderCollisionMap = !me.debug.renderCollisionMap;
				/*
					// not working with dynamic rendering since
					// collision layer does not have allocated renderers
					var layer = me.game.currentLevel.getLayerByName("collision");
					if (layer && me.debug.renderCollisionMap === false) {
						layer.visible = true;
						me.game.world.addChild(layer);
						me.debug.renderCollisionMap = true;
						me.game.sort();
					} else if (layer) {
						layer.visible = false;
						me.game.world.removeChild(layer);
						me.debug.renderCollisionMap = false;
					}
				*/
			} else if (this.area.renderVelocity.containsPoint(e.gameX, e.gameY)) {
				// does nothing for now, since velocity is
				// rendered together with hitboxes (is a global debug flag required?)
				me.debug.renderVelocity = !me.debug.renderVelocity;
			}
			// force repaint
			me.game.repaint();
		},

		/** @private */
		drawMemoryGraph : function (context, startX, endX) {
			if (window.performance && window.performance.memory) {
				var usedHeap  = Number.prototype.round(window.performance.memory.usedJSHeapSize/1048576, 2);
				var totalHeap =  Number.prototype.round(window.performance.memory.totalJSHeapSize/1048576, 2);

				var len = endX - startX;

				// remove the first item
				this.samples.shift();
				// add a new sample (25 is the height of the graph)
				this.samples[len] = (usedHeap / totalHeap)  * 25;

				// draw the graph
				for (var x = len;x--;) {
					var where = endX - (len - x);
					context.beginPath();
					context.strokeStyle = "lightblue";
					context.moveTo(where, 30);
					context.lineTo(where, 30 - (this.samples[x] || 0));
					context.stroke();
				}
				// display the current value
				this.font.draw(context, "Heap : " + usedHeap + '/' + totalHeap + ' MB', startX + 5, 5);
			} else {
				// Heap Memory information not available
				this.font.draw(context, "Heap : ??/?? MB", startX + 5, 5);
			}
		},

		/** @private */
		draw : function(context) {
			context.save();

			// draw the panel
			context.globalAlpha = 0.5;
			context.fillStyle = "black";
			context.fillRect(this.rect.left,  this.rect.top,
							 this.rect.width, this.rect.height);
		    context.globalAlpha = 1.0;

			// # entities / draw
			this.font.draw(context, "#objects : " + me.game.world.children.length, 5, 5);
			this.font.draw(context, "#draws   : " + me.game.world.drawCount, 5, 18);

			// debug checkboxes
			this.font.draw(context, "?hitbox   ["+ (me.debug.renderHitBox?"x":" ") +"]", 	100, 5);
			this.font.draw(context, "?velocity ["+ (me.debug.renderVelocity?"x":" ") +"]", 	100, 18);

			this.font.draw(context, "?dirtyRect  [ ]",	200, 5);
			this.font.draw(context, "?col. layer ["+ (me.debug.renderCollisionMap?"x":" ") +"]", 200, 18);

			// draw the update duration
			this.font.draw(context, "Update : " + this.frameUpdateTime.toFixed(2) + " ms", 310, 5);
			// draw the draw duration
			this.font.draw(context, "Draw   : " + (this.frameDrawTime).toFixed(2) + " ms", 310, 18);

			// draw the memory heap usage
			this.drawMemoryGraph(context, 425, this.rect.width - this.help_str_len - 10);

			// some help string
			this.font.draw(context, this.help_str, this.rect.width - this.help_str_len - 5, 18);

			//fps counter
			var fps_str = "" + me.timer.fps + "/"	+ me.sys.fps + " fps";
			this.font.draw(context, fps_str, this.rect.width - this.fps_str_len - 5, 5);

			context.restore();

		},

		/** @private */
		onDestroyEvent : function() {
			// hide the panel
			this.hide();
			// unbind keys event
			me.input.unbindKey(me.input.KEY.S);
			me.input.unbindKey(me.input.KEY.H);
			me.event.unsubscribe(this.handler);
		}


	});

	/*---------------------------------------------------------*/
	// END END END
	/*---------------------------------------------------------*/
})(window);
