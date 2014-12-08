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

(function () {

    // ensure that me.debug is defined
    me.debug = me.debug || {};

    var DEBUG_HEIGHT = 50;

    /**
     * @class
     * @public
     * @extends me.plugin.Base
     * @memberOf me
     * @constructor
     */
    me.debug.Panel = me.plugin.Base.extend(
    /** @scope me.debug.Panel.prototype */
    {

        /** @private */
        init : function (showKey, hideKey) {
            // call the super constructor
            this._super(me.plugin.Base, "init");

            // minimum melonJS version expected
            this.version = "2.0.0";

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

            // WebGL/Canvas compatibility
            var canvas = me.video.renderer.getCanvas();
            this.canvas = me.video.createCanvas(canvas.width, DEBUG_HEIGHT, true);
            this.context = me.CanvasRenderer.getContext2d(this.canvas);
            this.overlay = new me.Color(255, 255, 255, 1.0);

            // Size
            this.rect = new me.Rect(0, 0, canvas.width, DEBUG_HEIGHT);

            // create a default font, with fixed char width
            var s = 10;
            this.mod = 1;
            if (me.game.viewport.width < 500) {
                s = 7;
                this.mod = 0.7;
            }
            this.font = new me.Font("courier", s, "white");

            // clickable areas
            var size = 12 * this.mod;
            this.area.renderHitBox   = new me.Rect(163, 5,  size, size);
            this.area.renderVelocity = new me.Rect(163, 20, size, size);
            this.area.renderQuadTree = new me.Rect(253, 5,  size, size);

            // some internal string/length
            this.help_str        = "(s)how/(h)ide";
            this.help_str_len    = this.font.measureText(this.context, this.help_str).width;
            this.fps_str_len     = this.font.measureText(this.context, "00/00 fps").width;
            this.memoryPositionX = this.font.measureText(this.context, "Draw   : ").width * 2.2 + 310 * this.mod;

            // enable the FPS counter
            me.debug.displayFPS = true;

            // bind the "S" and "H" keys
            me.input.bindKey(showKey || me.input.KEY.S, "show", false, false);
            me.input.bindKey(hideKey || me.input.KEY.H, "hide", false, false);

            // add some keyboard shortcuts
            var self = this;
            this.keyHandler = me.event.subscribe(me.event.KEYDOWN, function (action) {
                if (action === "show") {
                    self.show();
                }
                else if (action === "hide") {
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
        patchSystemFn : function () {

            // add a few new debug flag (if not yet defined)
            me.debug.renderHitBox   = me.debug.renderHitBox   || false;
            me.debug.renderVelocity = me.debug.renderVelocity || false;
            me.debug.renderQuadTree = me.debug.renderQuadTree || false;

            var _this = this;

            // patch timer.js
            me.plugin.patch(me.timer, "update", function (dt) {
                // call the original me.timer.update function
                this._patched(dt);

                // call the FPS counter
                me.timer.countFPS();
            });

            // patch me.game.update
            me.plugin.patch(me.game, "update", function (dt) {
                var frameUpdateStartTime = window.performance.now();

                this._patched(dt);

                // calculate the update time
                _this.frameUpdateTime = window.performance.now() - frameUpdateStartTime;
            });

            // patch me.game.draw
            me.plugin.patch(me.game, "draw", function () {
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
                    renderer.save();
                    renderer.setColor("green");
                    renderer.strokeRect(this.left, this.top, this.width, this.height);
                    renderer.restore();
                }
            });

            // patch entities.js
            me.plugin.patch(me.Entity, "draw", function (renderer) {
                // call the original me.game.draw function
                this._patched(renderer);

                // check if debug mode is enabled

                if (me.debug.renderHitBox) {
                    renderer.save();
                    renderer.setColor("orange");
                    renderer.setLineWidth(1);
                    // draw the bounding rect shape
                    renderer.drawShape(this.getBounds());
                    renderer.translate(this.pos.x, this.pos.y);
                    // draw all defined shapes
                    renderer.setColor("red");
                    for (var i = this.body.shapes.length, shape; i--, (shape = this.body.shapes[i]);) {
                        renderer.drawShape(shape);
                    }
                    renderer.restore();
                }

                if (me.debug.renderVelocity) {
                    // draw entity current velocity
                    var x = ~~(this.pos.x + this.hWidth);
                    var y = ~~(this.pos.y + this.hHeight);
                    renderer.save();
                    renderer.setColor("blue");
                    renderer.setLineWidth(1);
                    renderer.strokeLine(x, y, x + ~~(this.body.vel.x * this.hWidth), y + ~~(this.body.vel.y * this.hHeight));
                    renderer.restore();
                }
            });
        },

        /**
         * show the debug panel
         */
        show : function () {
            if (!this.visible) {
                // register a mouse event for the checkboxes
                me.input.registerPointerEvent("pointerdown", this.rect, this.onClick.bind(this), true);
                // add the debug panel to the game world
                me.game.world.addChild(this, Infinity);
                // mark it as visible
                this.visible = true;
            }
        },

        /**
         * hide the debug panel
         */
        hide : function () {
            if (this.visible) {
                // release the mouse event for the checkboxes
                // me.input.releasePointerEvent("pointerdown", this.rect);
                this.canvas.removeEventListener("click", this.onClick.bind(this));
                // remove the debug panel from the game world
                me.game.world.removeChild(this);
                // mark it as invisible
                this.visible = false;
            }
        },


        /** @private */
        update : function () {
            if (me.input.isKeyPressed("show")) {
                this.show();
            }
            else if (me.input.isKeyPressed("hide")) {
                this.hide();
            }
            return true;
        },

        /**
         * @private
         */
        getBounds : function () {
            return this.rect;
        },

        /** @private */
        onClick : function (e)  {
            // check the clickable areas
            if (this.area.renderHitBox.containsPoint(e.gameX, e.gameY)) {
                me.debug.renderHitBox = !me.debug.renderHitBox;
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
            if (node.nodes.length === 0) {
                // cap the alpha value to 0.4 maximum
                var _alpha = (node.objects.length * 0.4) / me.collision.maxChildren;
                if (_alpha > 0.0) {
                    renderer.save();
                    renderer.setGlobalAlpha(_alpha);
                    renderer.setColor("red");
                    renderer.fillRect(bounds.pos.x, bounds.pos.y, bounds.width, bounds.height);
                    renderer.restore();
                }
            }
            else {
                //has subnodes? drawQuadtree them!
                for (var i = 0; i < node.nodes.length; i++) {
                    this.drawQuadTreeNode(renderer, node.nodes[i]);
                }
            }
        },

        /** @private */
        drawQuadTree : function (renderer) {
            // save the current globalAlpha value
            var _alpha = renderer.globalAlpha();
            var x = me.game.viewport.pos.x;
            var y = me.game.viewport.pos.y;

            renderer.translate(-x, -y);

            this.drawQuadTreeNode(renderer, me.collision.quadTree);

            renderer.translate(x, y);

            renderer.setGlobalAlpha(_alpha);
        },

        /** @private */
        drawMemoryGraph : function (context, endX) {
            if (window.performance && window.performance.memory) {
                var usedHeap  = Number.prototype.round(window.performance.memory.usedJSHeapSize / 1048576, 2);
                var totalHeap =  Number.prototype.round(window.performance.memory.totalJSHeapSize / 1048576, 2);
                var len = ~~(endX - this.memoryPositionX - 5);

                // remove the first item
                this.samples.shift();
                // add a new sample (25 is the height of the graph)
                this.samples[len] = (usedHeap / totalHeap) * 20;

                // draw the graph
                for (var x = len; x >= 0; x--) {
                    var where = endX - (len - x) - 5;
                    context.beginPath();
                    context.strokeStyle = "lightblue";
                    context.moveTo(where, 40 * this.mod);
                    context.lineTo(where, 40 * this.mod - (this.samples[x] || 0));
                    context.stroke();
                }
                // display the current value

                this.font.draw(context, "Heap : " + usedHeap + "/" + totalHeap + " MB", this.memoryPositionX, 5 * this.mod);
            }
            else {
                // Heap Memory information not available
                this.font.draw(context, "Heap : ??/?? MB", this.memoryPositionX, 5 * this.mod);
            }
        },

        /** @private */
        draw : function (renderer) {
            this.context.save();

            // draw the QuadTree (before the panel)
            if (me.debug.renderQuadTree === true) {
                this.drawQuadTree(renderer);
            }

            // draw the panel
            this.context.globalAlpha = 0.5;
            this.context.fillStyle = "black";
            this.context.fillRect(this.rect.left,  this.rect.top,
                                  this.rect.width, this.rect.height);
            this.context.globalAlpha = 1.0;

            this.font.draw(this.context, "#objects : " + me.game.world.children.length, 5 * this.mod, 5 * this.mod);
            this.font.draw(this.context, "#draws   : " + me.game.world.drawCount, 5 * this.mod, 20 * this.mod);

            // debug checkboxes
            this.font.draw(this.context, "?hitbox   [" + (me.debug.renderHitBox ? "x" : " ") + "]",   100 * this.mod, 5 * this.mod);
            this.font.draw(this.context, "?velocity [" + (me.debug.renderVelocity ? "x" : " ") + "]", 100 * this.mod, 20 * this.mod);

            this.font.draw(this.context, "?QuadTree [" + (me.debug.renderQuadTree ? "x" : " ") + "]", 190 * this.mod, 5 * this.mod);

            // draw the update duration
            this.font.draw(this.context, "Update : " + this.frameUpdateTime.toFixed(2) + " ms", 285 * this.mod, 5 * this.mod);
            // draw the draw duration
            this.font.draw(this.context, "Draw   : " + this.frameDrawTime.toFixed(2) + " ms", 285 * this.mod, 20 * this.mod);

            // draw the memory heap usage
            var endX = this.rect.width - 25;
            this.drawMemoryGraph(this.context, endX - this.help_str_len);

            // some help string
            this.font.draw(this.context, this.help_str, endX - this.help_str_len, 20 * this.mod);

            //fps counter
            var fps_str = me.timer.fps + "/" + me.sys.fps + " fps";
            this.font.draw(this.context, fps_str, this.rect.width - this.fps_str_len - 5, 5 * this.mod);

            this.context.restore();
            me.video.renderer.setGlobalAlpha(0.7);
            var color = me.video.renderer.getColor();
            me.video.renderer.setColor(this.overlay);
            me.video.renderer.drawImage(
                this.canvas, 0, 0,
                this.canvas.width, this.canvas.height,
                0, 0, this.rect.width, this.rect.height
            );
            me.video.renderer.setColor(color);
            me.video.renderer.setGlobalAlpha(1.0);
        },

        /** @private */
        onDestroyEvent : function () {
            // hide the panel
            this.hide();
            // unbind keys event
            me.input.unbindKey(me.input.KEY.S);
            me.input.unbindKey(me.input.KEY.H);
            me.event.unsubscribe(this.keyHandler);
        }
    });

    /*---------------------------------------------------------*/
    // END END END
    /*---------------------------------------------------------*/
})();
