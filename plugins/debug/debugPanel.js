/*
 * MelonJS Game Engine
 * Copyright (C) 2011 - 2014 Olivier Biot, Jason Oster, Aaron McLeod
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

        /** @private */
        init : function(showKey, hideKey) {
            // call the super constructor
            this._super(me.plugin.Base, 'init');

            // minimum melonJS version expected
            this.version = "1.1.0";

            // to hold the debug options
            // clickable rect area
            this.area = {};

            // panel position and size
            this.rect = null;

            // for z ordering
            // make it ridiculously high
            this.z = Infinity;

            // visibility flag
            this.visible = false;

            // frame update time in ms
            this.frameUpdateTime = 0;

            // frame draw time in ms
            this.frameDrawTime = 0;
		
            this.rect = new me.Rect(0, 0, me.video.renderer.getWidth(), 35);

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
            var s = 10;
            this.mod = 1;
            if(me.game.viewport.width < 500) {
                s = 7;
                this.mod = 0.7;
            }
            this.font = new me.Font('courier', s, 'white');

            // clickable areas
            this.area.renderHitBox = new me.Rect(160,5,15,15);
            this.area.renderVelocity = new me.Rect(165,18,15,15);

            this.area.renderQuadTree = new me.Rect(270,5,15,15);
            this.area.renderCollisionMap = new me.Rect(270,18,15,15);

            // some internal string/length
            this.help_str      = "(s)how/(h)ide";
            this.help_str_len = this.font.measureText(me.video.renderer.getContext(), this.help_str).width;
            this.fps_str_len = this.font.measureText(me.video.renderer.getContext(), "00/00 fps").width;
            this.memoryPositionX = this.font.measureText(me.video.renderer.getContext(), "Draw   : ").width * 2.2 + 310 * this.mod;

            // enable the FPS counter
            me.debug.displayFPS = true;

            // bind the "S" and "H" keys
            me.input.bindKey(showKey || me.input.KEY.S, "show", false, false);
            me.input.bindKey(hideKey || me.input.KEY.H, "hide", false, false);

            // add some keyboard shortcuts
            var self = this;
            this.keyHandler = me.event.subscribe(me.event.KEYDOWN, function (action, keyCode, edge) {
                if (action === "show") {
                    self.show();
                } else if (action === "hide") {
                    self.hide();
                }
            });

            // re-apply panel settings on level changes
            this.levelHandler = me.event.subscribe(me.event.LEVEL_LOADED, function () {
                var layer = me.game.currentLevel.getLayerByName("collision");
                if (layer) {
                    layer.setOpacity((me.debug.renderCollisionMap===true)?1:0);
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
            me.debug.renderCollisionMap = me.debug.renderCollisionMap || false;
            me.debug.renderQuadTree = me.debug.renderQuadTree || false;
            
            var _this = this;
            
            // patch timer.js
            me.plugin.patch(me.timer, "update", function (time) {
                // call the original me.timer.update function
                this._patched(time);

                // call the FPS counter
                me.timer.countFPS();
            });

            // patch me.game.update
            me.plugin.patch(me.game, 'update', function(time) {
                var frameUpdateStartTime = window.performance.now();

                this._patched(time);

                // calculate the update time
                _this.frameUpdateTime = window.performance.now() - frameUpdateStartTime;
            });

            // patch me.game.draw
            me.plugin.patch(me.game, 'draw', function() {
                var frameDrawStartTime = window.performance.now();

                this._patched();

                // calculate the drawing time
                _this.frameDrawTime = window.performance.now() - frameDrawStartTime;
            });

            // patch sprite.js
            me.plugin.patch(me.Sprite, "draw", function (renderer) {
                // call the original me.Sprite function
                this._patched(renderer);

                // draw the sprite rectangle
                if (me.debug.renderHitBox) {
                    renderer.strokeRect(this.left, this.top, this.width, this.height, "green");
                }
            });

            // patch entities.js
            me.plugin.patch(me.Entity, "draw", function (renderer) {
                // call the original me.game.draw function
                this._patched(renderer);

                // check if debug mode is enabled

                if (me.debug.renderHitBox) {
                    renderer.save();
                    // draw the bounding rect shape
                    this.getBounds().draw(renderer, "orange");
                    renderer.translate(this.pos.x, this.pos.y);
                    if (this.body.shapes.length) {
                        // TODO : support multiple shapes
                        this.body.getShape().draw(renderer, "red");
                    }
                    renderer.restore();
                }

                if (me.debug.renderVelocity) {
                    // draw entity current velocity
                    var x = ~~(this.pos.x + this.hWidth);
                    var y = ~~(this.pos.y + this.hHeight);
                    // TODO: This will also be tricky for WebGL.
                    var context = renderer.getContext();
                    context.strokeStyle = "blue";
                    context.lineWidth = 1;
                    context.beginPath();
                    context.moveTo(x, y);
                    context.lineTo(
                        x + ~~(this.body.vel.x * this.hWidth),
                        y + ~~(this.body.vel.y * this.hHeight)
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
                var layer = me.game.currentLevel.getLayerByName("collision");
                if (layer) {
                    if (layer.getOpacity() === 0) {
                        layer.setOpacity(1);
                        me.debug.renderCollisionMap = true;
                    } else {
                        layer.setOpacity(0);
                        me.debug.renderCollisionMap = false;
                    }
                }
            } 
            else if (this.area.renderVelocity.containsPoint(e.gameX, e.gameY)) {
                // does nothing for now, since velocity is
                // rendered together with hitboxes (is a global debug flag required?)
                me.debug.renderVelocity = !me.debug.renderVelocity;
            } 
            else if (this.area.renderQuadTree.containsPoint(e.gameX, e.gameY)) {
                me.debug.renderQuadTree = !me.debug.renderQuadTree;
            }
            // force repaint
            me.game.repaint();
        },

        /** @private */        
        drawQuadTreeNode : function (renderer, node) {      
            var bounds = node.bounds;
        
            // draw the current bounds
            if( node.nodes.length === 0) {
                // cap the alpha value to 0.4 maximum
                var _alpha = (node.objects.length * 0.4) / me.collision.maxChildren;
                if (_alpha > 0.0) {
                    renderer.setGlobalAlpha(_alpha);
                    renderer.fillRect(bounds.pos.x, bounds.pos.y, bounds.width, bounds.height, "red");
                }
            } else {
                //has subnodes? drawQuadtree them!
                for( var i=0;i<node.nodes.length;i=i+1 ) {
                    this.drawQuadTreeNode( renderer, node.nodes[ i ] );
                }
            } 
        },
        
        /** @private */
        drawQuadTree : function (renderer) {
            // save the current globalAlpha value
            var _alpha = renderer.globalAlpha();
            
            renderer.translate(-me.game.viewport.pos.x, -me.game.viewport.pos.y);
            
            this.drawQuadTreeNode(renderer, me.collision.quadTree);
            
            renderer.translate(me.game.viewport.pos.x, me.game.viewport.pos.y);
            
            renderer.setGlobalAlpha(_alpha);
        },

        /** @private */
        drawMemoryGraph : function (renderer, endX) {
            if (window.performance && window.performance.memory) {
                var context = renderer.getContext();
                var usedHeap  = Number.prototype.round(window.performance.memory.usedJSHeapSize/1048576, 2);
                var totalHeap =  Number.prototype.round(window.performance.memory.totalJSHeapSize/1048576, 2);
                var len = endX - this.memoryPositionX;

                // remove the first item
                this.samples.shift();
                // add a new sample (25 is the height of the graph)
                this.samples[len] = (usedHeap / totalHeap)  * 25;

                // draw the graph
                for (var x = len; x >= 0; x--) {
                    var where = endX - (len - x);
                    context.beginPath();
                    context.strokeStyle = "lightblue";
                    context.moveTo(where, 30 * this.mod);
                    context.lineTo(where, (30 - (this.samples[x] || 0)) * this.mod);
                    context.stroke();
                }
                // display the current value
                this.font.draw(context, "Heap : " + usedHeap + '/' + totalHeap + ' MB', this.memoryPositionX, 5 * this.mod);
            } else {
                // Heap Memory information not available
                this.font.draw(renderer.getContext(), "Heap : ??/?? MB", this.memoryPositionX, 5 * this.mod);
            }
        },

        /** @private */
        draw : function(renderer) {
            renderer.save();
            
            // draw the QuadTree (before the panel)
            if (me.debug.renderQuadTree === true) {
                this.drawQuadTree(renderer);
            }

            // draw the panel
            renderer.setGlobalAlpha(0.5);
            renderer.fillRect(this.rect.left,  this.rect.top,
                             this.rect.width, this.rect.height, "black");
            renderer.setGlobalAlpha(1.0);

            var context = renderer.getContext();

            // # entities / draw
            this.font.draw(context, "#objects : " + me.game.world.children.length, 5 * this.mod, 5 * this.mod);
            this.font.draw(context, "#draws   : " + me.game.world.drawCount, 5 * this.mod, 18 * this.mod);

            // debug checkboxes
            this.font.draw(context, "?hitbox   ["+ (me.debug.renderHitBox?"x":" ") +"]",     100 * this.mod, 5 * this.mod);
            this.font.draw(context, "?velocity ["+ (me.debug.renderVelocity?"x":" ") +"]",     100 * this.mod, 18 * this.mod);

            this.font.draw(context, "?QuadTree   ["+ (me.debug.renderQuadTree?"x":" ") +"]",    200 * this.mod, 5 * this.mod);
            this.font.draw(context, "?col. layer ["+ (me.debug.renderCollisionMap?"x":" ") +"]", 200 * this.mod, 18 * this.mod);

            // draw the update duration
            this.font.draw(context, "Update : " + this.frameUpdateTime.toFixed(2) + " ms", 310 * this.mod, 5 * this.mod);
            // draw the draw duration
            this.font.draw(context, "Draw   : " + (this.frameDrawTime).toFixed(2) + " ms", 310 * this.mod, 18 * this.mod);

            // draw the memory heap usage
            var endX = this.rect.width - 25;
            this.drawMemoryGraph(renderer, endX - this.help_str_len);

            // some help string
            this.font.draw(context, this.help_str, endX - this.help_str_len, 18 * this.mod);

            //fps counter
            var fps_str = "" + me.timer.fps + "/"    + me.sys.fps + " fps";
            this.font.draw(context, fps_str, this.rect.width - this.fps_str_len - 5, 5 * this.mod);

            renderer.restore();

        },

        /** @private */
        onDestroyEvent : function() {
            // hide the panel
            this.hide();
            // unbind keys event
            me.input.unbindKey(me.input.KEY.S);
            me.input.unbindKey(me.input.KEY.H);
            me.event.unsubscribe(this.keyHandler);
            me.event.unsubscribe(this.levelHandler);
        }


    });

    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})(window);
